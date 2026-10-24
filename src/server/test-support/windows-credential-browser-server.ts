import { join } from 'node:path';
import { openDatabase } from '../db.js';
import { buildApp } from '../app.js';
import { CredentialVault, OsCredentialBackend } from '../credential-vault.js';

const dataDir=process.env.SHEEPWOLF_DATA_DIR;
const service=process.env.SHEEPWOLF_TEST_CREDENTIAL_SERVICE;
const account=process.env.SHEEPWOLF_TEST_CREDENTIAL_ACCOUNT;
if(process.platform!=='win32'||!dataDir||!service||!account)throw new Error('Windows credential browser harness requires a disposable data directory and credential namespace.');

const db=openDatabase(join(dataDir,'sheepwolf.sqlite'));
const app=await buildApp(db,{autoSchedule:false},{
  credentialVault:new CredentialVault(new OsCredentialBackend(service,account)),
  providerFetch:async()=>{console.error('B06_FORBIDDEN_PROVIDER_REQUEST');throw new Error('Provider traffic is disabled in this acceptance test.');}
});
await app.listen({port:0,host:'127.0.0.1'});
const address=app.server.address();
if(!address||typeof address==='string')throw new Error('Test server did not bind an ephemeral loopback port.');
console.log(`B06_TEST_READY:${address.port}`);

let closing=false;
process.on('message',async(message)=>{
  if(message!=='stop'||closing)return;
  closing=true;
  await app.close();
  db.close();
  process.exit(0);
});
