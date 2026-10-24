import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db.js';
import { buildApp } from './app.js';
import { CredentialVault, type CredentialBackend } from './credential-vault.js';
import type { ProviderRunLimits } from '../shared/types.js';

class MemoryBackend implements CredentialBackend {
  readonly name='Mock OS store';value:string|null=null;availableState=true;
  async available(){return this.availableState;}
  async read(){return this.value;}
  async write(secret:string){this.value=secret;}
  async remove(){this.value=null;}
}
const limits:ProviderRunLimits={maxRequests:3,maxInputTokens:50_000,maxOutputTokens:900,maxOutputTokensPerRequest:128,maxEstimatedUsd:0.25};
const apps:Awaited<ReturnType<typeof buildApp>>[]=[];const databases:ReturnType<typeof openDatabase>[]=[];
afterEach(async()=>{for(const app of apps.splice(0))await app.close();for(const db of databases.splice(0))db.close();});
function makeApp(fetcher:typeof fetch=vi.fn<typeof fetch>()){
  const db=openDatabase(':memory:');databases.push(db);const vault=new CredentialVault(new MemoryBackend());
  return buildApp(db,{autoSchedule:false}, {credentialVault:vault,providerFetch:fetcher}).then(app=>{apps.push(app);return {app,db,vault};});
}
const payload={provider:'deepseek',model:'deepseek-flash',realModeEnabled:false,limits};
function completion(){return new Response(JSON.stringify({id:'mock-request-id',choices:[{message:{content:'{"type":"silence"}'},finish_reason:'stop'}],usage:{prompt_tokens:28,completion_tokens:2}}),{status:200,headers:{'content-type':'application/json'}});}

describe('provider settings and HTTP controls',()=>{
  it('defaults to demo, lists only implemented models and never returns a credential',async()=>{
    const fetcher=vi.fn<typeof fetch>();const {app}=await makeApp(fetcher);
    const settings=await app.inject({method:'GET',url:'/api/settings/providers'});expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({provider:'deepseek',model:'deepseek-flash',realModeEnabled:false,credential:{configured:false,storage:'none'}});
    expect(settings.json().supportedModels.map((m:{id:string})=>m.id)).toEqual(['deepseek-flash','deepseek-v4-pro']);
    expect(settings.body).not.toMatch(/api.?key|secret/i);
    const run=await app.inject({method:'POST',url:'/api/experiments',payload:{scenarioId:'capture-the-flags',mode:'demo'}});
    expect(run.statusCode).toBe(201);expect(run.json().config.mode).toBe('demo');expect(fetcher).not.toHaveBeenCalled();
    const denied=await app.inject({method:'POST',url:'/api/experiments',payload:{scenarioId:'capture-the-flags',mode:'real'}});
    expect(denied.statusCode).toBe(409);expect(fetcher).not.toHaveBeenCalled();
  });

  it('saves a key outside SQLite, requires explicit enablement and drives one real HTTP/UI control path with mocks',async()=>{
    const fetcher=vi.fn<typeof fetch>(async(url)=>String(url).endsWith('/models')?new Response(JSON.stringify({data:[{id:'deepseek-flash'}]}),{status:200}):completion());
    const {app,db}=await makeApp(fetcher);const fakeKey='sk-mock-not-a-real-provider-key';
    const saved=await app.inject({method:'POST',url:'/api/settings/providers/credential',payload:{key:fakeKey,persistence:'session'}});
    expect(saved.statusCode).toBe(200);expect(saved.body).not.toContain(fakeKey);expect(saved.json().credential).toMatchObject({configured:true,storage:'session'});
    expect(JSON.stringify(db.prepare("SELECT * FROM provider_settings WHERE id='default'").get())).not.toContain(fakeKey);
    expect(db.prepare("SELECT real_mode_enabled FROM provider_settings WHERE id='default'").get()).toMatchObject({real_mode_enabled:0});

    const enabled=await app.inject({method:'PUT',url:'/api/settings/providers',payload:{...payload,realModeEnabled:true}});
    expect(enabled.statusCode).toBe(200);expect(enabled.body).not.toContain(fakeKey);
    const started=await app.inject({method:'POST',url:'/api/experiments',payload:{scenarioId:'the-investigation',mode:'real',seed:'app-real-mock'}});
    expect(started.statusCode).toBe(201);const run=started.json();expect(run.config).toMatchObject({mode:'real',provider:{provider:'deepseek',model:'deepseek-flash',limits}});
    expect(JSON.stringify(run)).not.toContain(fakeKey);
    await app.inject({method:'POST',url:`/api/experiments/${run.id}/pause`});
    const stepped=await app.inject({method:'POST',url:`/api/experiments/${run.id}/step`});expect(stepped.statusCode).toBe(200);
    expect(stepped.json()).toMatchObject({status:'paused',decisionCount:1,providerUsage:{requests:1,inputTokens:28,outputTokens:2}});
    expect(fetcher).toHaveBeenCalledTimes(1);const chat=fetcher.mock.calls.find(call=>String(call[0]).endsWith('/chat/completions'))!;
    expect(new Headers(chat[1]?.headers).get('authorization')).toBe(`Bearer ${fakeKey}`);
    expect(String(chat[1]?.body)).not.toContain(fakeKey);
    const publicView=await app.inject({method:'GET',url:`/api/experiments/${run.id}/public`});expect(publicView.json()).not.toHaveProperty('config');expect(publicView.json()).not.toHaveProperty('participants');
    const decisionRows=db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=?').get(run.id) as {n:number};expect(decisionRows.n).toBe(1);

    const test=await app.inject({method:'POST',url:'/api/settings/providers/test',payload:{confirm:true}});
    expect(test.statusCode).toBe(200);expect(test.json()).toMatchObject({ok:true,model:'deepseek-flash'});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not echo keys or raw provider response text from credential/model errors',async()=>{
    const fakeKey='sk-do-not-echo-this-key';const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${fakeKey}`);
      return new Response(JSON.stringify({error:`invalid token ${fakeKey}`}),{status:401});
    });
    const {app}=await makeApp(fetcher);await app.inject({method:'POST',url:'/api/settings/providers/credential',payload:{key:fakeKey,persistence:'session'}});
    const response=await app.inject({method:'POST',url:'/api/settings/providers/test',payload:{confirm:true}});
    expect(response.statusCode).toBe(502);expect(response.body).not.toContain(fakeKey);expect(response.body).not.toContain('invalid token');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit confirmation before a connection test and refuses insecure settings payloads',async()=>{
    const fetcher=vi.fn<typeof fetch>();const {app}=await makeApp(fetcher);
    expect((await app.inject({method:'POST',url:'/api/settings/providers/test',payload:{}})).statusCode).toBe(400);
    expect((await app.inject({method:'PUT',url:'/api/settings/providers',payload:{...payload,key:'sk-injected-key'}})).statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
