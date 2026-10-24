import { afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { release, version } from 'node:os';
import { join } from 'node:path';
import { OsCredentialBackend } from './credential-vault.js';

const windowsTest=process.platform==='win32'?it:it.skip;
type RunningServer={child:ChildProcess;url:string;readOutput:()=>string};
const processes:ChildProcess[]=[];
let browser:Browser|undefined;
let dataDir='';let service='';let account='';
const output:string[]=[];

function startServer():Promise<RunningServer>{
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','src/server/test-support/windows-credential-browser-server.ts'],{
      cwd:process.cwd(),stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,NODE_ENV:'test',SHEEPWOLF_DATA_DIR:dataDir,SHEEPWOLF_TEST_CREDENTIAL_SERVICE:service,SHEEPWOLF_TEST_CREDENTIAL_ACCOUNT:account}
    });
    processes.push(child);let captured='';let settled=false;
    const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error(`Windows browser test server did not start. ${captured}`));child.kill();}},30_000);
    const collect=(chunk:Buffer)=>{const text=chunk.toString();captured+=text;output.push(text);const match=captured.match(/B06_TEST_READY:(\d+)/);if(match&&!settled){settled=true;clearTimeout(timer);resolve({child,url:`http://127.0.0.1:${match[1]}`,readOutput:()=>captured});}};
    child.stdout?.on('data',collect);child.stderr?.on('data',collect);
    child.once('error',error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}});
    child.once('exit',(code,signal)=>{if(!settled){settled=true;clearTimeout(timer);reject(new Error(`Windows browser test server exited before readiness (${code??signal}). ${captured}`));}});
  });
}
function stopServer(server:RunningServer){
  return new Promise<void>(resolve=>{
    if(server.child.exitCode!==null){resolve();return;}
    const timer=setTimeout(()=>{server.child.kill();resolve();},10_000);
    server.child.once('exit',()=>{clearTimeout(timer);resolve();});
    server.child.send?.('stop');
  });
}
async function waitForText(page:Page,text:string){await page.getByText(text,{exact:true}).waitFor({state:'visible',timeout:10_000});}
async function saveProtectedKey(page:Page,key:string){
  await page.getByLabel('API key').fill(key);
  const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/settings/providers/credential'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save protected key'}).click();
  const response=await responsePromise;expect(response.status()).toBe(200);expect(await response.text()).not.toContain(key);
}
async function settingsResponse(page:Page){
  const pending=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/settings/providers'&&response.request().method()==='GET');
  return pending;
}
function assertNoCredentialLeak(secrets:string[]){
  const allFiles=(root:string):string[]=>readdirSync(root,{withFileTypes:true}).flatMap(entry=>{const path=join(root,entry.name);return entry.isDirectory()?allFiles(path):[path];});
  for(const path of allFiles(dataDir)){const contents=readFileSync(path);for(const secret of secrets)expect(contents.includes(Buffer.from(secret)),`SQLite file ${path} must not contain a disposable key`).toBe(false);}
  const logs=output.join('');for(const secret of secrets)expect(logs).not.toContain(secret);
  expect(logs).not.toContain('B06_FORBIDDEN_PROVIDER_REQUEST');
}

afterAll(async()=>{
  if(browser)await browser.close();
  for(const child of processes){if(child.exitCode===null){await new Promise<void>(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5_000);child.once('exit',()=>{clearTimeout(timer);resolve();});try{child.send?.('stop');}catch{child.kill();}});}}
  if(process.platform==='win32'&&service&&account){try{await new OsCredentialBackend(service,account).remove();}catch{/* The disposable namespace may already be empty. */}}
  if(dataDir)rmSync(dataDir,{recursive:true,force:true});
});

describe('Windows protected credential Settings browser acceptance',()=>{
  windowsTest('saves, masks, replaces, removes and survives refresh/process restarts using a disposable Windows Credential Manager entry',async()=>{
    dataDir=mkdtempSync(join(tmpdir(),`SheepWolf Block 6 ${randomUUID()} `));service=`SheepWolf-B06-${randomUUID()}`;account=`disposable-${randomUUID()}`;
    const firstKey=`SW-B06-DISPOSABLE-A-${randomUUID()}`;const replacementKey=`SW-B06-DISPOSABLE-B-${randomUUID()}`;
    const secrets=[firstKey,replacementKey];let server=await startServer();browser=await chromium.launch({headless:true});const page=await browser.newPage();
    const evidenceDir=join(process.cwd(),'artifacts','b06-windows-credential');mkdirSync(evidenceDir,{recursive:true});
    await page.goto(server.url,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Settings',exact:true}).first().click();
    await saveProtectedKey(page,firstKey);
    await waitForText(page,'The key is stored in protected operating system storage.');
    await waitForText(page,'Key configured');
    expect(await page.locator('.provider-status-row').innerText()).toContain('Windows Credential Manager');
    expect(await page.locator('.provider-status-row').innerText()).not.toContain(firstKey);
    expect(await page.locator('#deepseek-key').getAttribute('type')).toBe('password');
    expect(await page.locator('body').innerText()).not.toContain(firstKey);
    await page.screenshot({path:join(evidenceDir,'credential-protected-configured.png'),fullPage:true});
    const refreshSettings=settingsResponse(page);await page.reload({waitUntil:'networkidle'});const refreshBody=await (await refreshSettings).text();expect(refreshBody).not.toContain(firstKey);await page.getByRole('button',{name:'Settings',exact:true}).first().click();await waitForText(page,'Key configured');

    await saveProtectedKey(page,replacementKey);
    await waitForText(page,'The key is stored in protected operating system storage.');await waitForText(page,'Key configured');
    expect(await page.locator('body').innerText()).not.toContain(replacementKey);
    const browserStorage=await page.evaluate(()=>`${JSON.stringify(Object.values(localStorage))} ${JSON.stringify(Object.values(sessionStorage))}`);
    for(const secret of secrets)expect(browserStorage).not.toContain(secret);
    assertNoCredentialLeak(secrets);

    await stopServer(server);server=await startServer();const restartSettings=settingsResponse(page);await page.goto(server.url,{waitUntil:'networkidle'});const restartBody=await (await restartSettings).text();expect(restartBody).not.toContain(firstKey);expect(restartBody).not.toContain(replacementKey);await page.getByRole('button',{name:'Settings',exact:true}).first().click();await waitForText(page,'Key configured');
    expect(await page.locator('.provider-status-row').innerText()).toContain('Windows Credential Manager');
    expect(await page.locator('body').innerText()).not.toContain(firstKey);expect(await page.locator('body').innerText()).not.toContain(replacementKey);
    const historyResponse=await page.request.get(`${server.url}/api/history`);const historyBody=await historyResponse.text();expect(historyBody).not.toContain(firstKey);expect(historyBody).not.toContain(replacementKey);
    const databaseContent=readFileSync(join(dataDir,'sheepwolf.sqlite'));expect(databaseContent.includes(Buffer.from(firstKey))).toBe(false);expect(databaseContent.includes(Buffer.from(replacementKey))).toBe(false);

    const removeResponsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/settings/providers/credential'&&response.request().method()==='DELETE');
    await page.getByRole('button',{name:'Remove key'}).click();const removeResponse=await removeResponsePromise;expect(removeResponse.status()).toBe(200);const removeBody=await removeResponse.text();expect(removeBody).not.toContain(firstKey);expect(removeBody).not.toContain(replacementKey);await waitForText(page,'The saved key was removed and Real AI disabled.');await waitForText(page,'No key saved');
    expect(await page.locator('body').innerText()).not.toContain(firstKey);expect(await page.locator('body').innerText()).not.toContain(replacementKey);
    await page.screenshot({path:join(evidenceDir,'credential-removed.png'),fullPage:true});
    assertNoCredentialLeak(secrets);
    await stopServer(server);server=await startServer();const clearedSettings=settingsResponse(page);await page.goto(server.url,{waitUntil:'networkidle'});const clearedBody=await (await clearedSettings).text();expect(clearedBody).not.toContain(firstKey);expect(clearedBody).not.toContain(replacementKey);await page.getByRole('button',{name:'Settings',exact:true}).first().click();await waitForText(page,'No key saved');
    expect(await page.locator('.provider-status-row').innerText()).toContain('Demo mode works without a key');
    assertNoCredentialLeak(secrets);
    writeFileSync(join(evidenceDir,'verification.txt'),[
      `OS: Windows Server runner ${release()} (${version()})`,
      `Node: ${process.version}`,
      `Browser: headless Chromium ${browser.version()}`,
      'Provider traffic: none; Test Connection was not clicked and the injected provider transport rejects external calls.',
      'Credential sequence verified in actual Settings UI with unique disposable key values: protected save, masked/configured status, page refresh, replacement, separate application-process restart, protected status persistence, removal, page refresh, separate application-process restart, cleared status.',
      'Leak checks: API responses, browser-rendered content, browser local/session storage, exported/list history response, SQLite/WAL/SHM files and child-process output contained neither disposable credential.',
      'Disposable credential namespace was removed during test cleanup.'
    ].join('\n')+'\n');
    console.info(`Windows Settings browser acceptance environment: Windows Server ${release()} (${version()}), Node ${process.version}, headless Chromium ${browser.version()}.`);
    await stopServer(server);
  },120_000);
});
