import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db.js';
import { CredentialVault } from './credential-vault.js';
import { DeepSeekDecisionProvider } from './deepseek-provider.js';
import { ExperimentEngine, participantContext, type ProviderExecutionOptions, type ProviderRequestEstimate, type ProviderRequestResult } from './experiment-engine.js';
import type { ProviderRunLimits } from '../shared/types.js';

const limits:ProviderRunLimits={maxRequests:5,maxInputTokens:50_000,maxOutputTokens:1_000,maxOutputTokensPerRequest:128,maxEstimatedUsd:0.25};
const databases:ReturnType<typeof openDatabase>[]=[];const engines:ExperimentEngine[]=[];
afterEach(()=>{for(const engine of engines.splice(0))engine.close();for(const db of databases.splice(0))db.close();vi.useRealTimers();});
function fixture(scenarioId='the-investigation'){
  const db=openDatabase(':memory:');databases.push(db);const engine=new ExperimentEngine(db,{autoSchedule:false});engines.push(engine);
  const run=engine.createExperiment({scenarioId,seed:`deepseek-${scenarioId}`});const sheep=run.participants.find(p=>p.role==='sheep')!;
  return {db,engine,run,context:participantContext(db,run.id,sheep.characterId)};
}
function vault(){
  let secret:string|null=null;const store={name:'Test protected store',available:async()=>true,read:async()=>secret,write:async(value:string)=>{secret=value;},remove:async()=>{secret=null;}};
  const result=new CredentialVault(store);return result.save('sk-test-not-a-real-key','protected').then(()=>result);
}
function response(action:unknown='{"type":"silence"}',overrides:Record<string,unknown>={}){
  return new Response(JSON.stringify({id:'provider-response-id',model:'deepseek-flash',choices:[{message:{role:'assistant',content:typeof action==='string'?action:JSON.stringify(action)},finish_reason:'stop'}],usage:{prompt_tokens:34,completion_tokens:4},...overrides}),{status:200,headers:{'content-type':'application/json','x-request-id':'header-request-id'}});
}
function execution(overrides:Partial<ProviderExecutionOptions>={},reserved:ProviderRequestEstimate[]=[],settled:ProviderRequestResult[]=[]):ProviderExecutionOptions{
  let id=0;
  return {model:'deepseek-flash',limits,signal:new AbortController().signal,reserve:estimate=>{reserved.push(estimate);return `reservation-${++id}`;},settle:(_id,result)=>{settled.push(result);return true;},...overrides};
}

describe('DeepSeek provider adapter (mock transport only)',()=>{
  it('uses documented chat-completions JSON output and sends only role-permitted context',async()=>{
    const {db,context}=fixture();const apiKey=await vault();let capturedUrl='';let capturedInit:RequestInit|undefined;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{capturedUrl=String(input);capturedInit=init;return response({type:'silence'});});
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});
    const reserved:ProviderRequestEstimate[]=[];const settled:ProviderRequestResult[]=[];
    const result=await provider.decide(context,execution({},reserved,settled));
    expect(capturedUrl).toBe('https://api.deepseek.com/chat/completions');
    expect(new Headers(capturedInit?.headers).get('authorization')).toBe('Bearer sk-test-not-a-real-key');
    const body=JSON.parse(String(capturedInit?.body));expect(body).toMatchObject({model:'deepseek-flash',max_tokens:128,thinking:{type:'disabled'},response_format:{type:'json_object'},stream:false});
    const supplied=`${body.messages[0].content}\n${body.messages[1].content}`;
    expect(supplied).toContain(context.privateObjective);expect(supplied).toContain('untrusted participant speech');
    expect(supplied).not.toContain('correctConclusionId');expect(supplied).not.toContain('wolfTargetId');
    expect(String(capturedInit?.body)).not.toContain('sk-test-not-a-real-key');
    expect(result).toMatchObject({action:{type:'silence'},providerRequestId:'provider-response-id',inputTokens:34,outputTokens:4});
    expect(reserved).toHaveLength(1);expect(reserved[0]!.inputTokens).toBeGreaterThan(0);expect(settled).toMatchObject([{status:'succeeded',requestId:'provider-response-id',inputTokens:34,outputTokens:4}]);
    db.close();databases.splice(databases.indexOf(db),1);
  });

  it('rejects malformed model output without returning an action or retrying it',async()=>{
    const {context}=fixture();const apiKey=await vault();const fetcher=vi.fn<typeof fetch>(async()=>response('not JSON'));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},[],settled))).rejects.toMatchObject({code:'malformed_output'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(settled).toMatchObject([{status:'failed',errorCode:'malformed_output'}]);
  });

  it('retries a truncated length response once and accepts only the complete second decision',async()=>{
    const {context}=fixture();const apiKey=await vault();
    const partial=response('',{choices:[{message:{content:'{"type":"post","title":"truncated'},finish_reason:'length'}],usage:{prompt_tokens:34,completion_tokens:128}});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(partial).mockResolvedValueOnce(response({type:'silence'}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const reserved:ProviderRequestEstimate[]=[];const settled:ProviderRequestResult[]=[];
    const result=await provider.decide(context,execution({},reserved,settled));
    expect(result.action).toEqual({type:'silence'});expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reserved).toHaveLength(2);expect(reserved[1]).toEqual(reserved[0]);
    expect(settled).toHaveLength(2);expect(settled[0]).toMatchObject({status:'failed',outputTokens:128,errorCode:'finish_length'});
    expect(settled[1]).toMatchObject({status:'succeeded',outputTokens:4});
  });

  it('stops after the single allowed retry when the next response is still truncated',async()=>{
    const {context}=fixture();const apiKey=await vault();
    const fetcher=vi.fn<typeof fetch>(async()=>response('',{choices:[{message:{content:'{"type":"silence"}'},finish_reason:'length'}]}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const reserved:ProviderRequestEstimate[]=[];const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},reserved,settled))).rejects.toMatchObject({code:'incomplete_output'});
    expect(fetcher).toHaveBeenCalledTimes(2);expect(reserved).toHaveLength(2);expect(settled).toHaveLength(2);
    expect(settled.every(item=>item.status==='failed'&&item.errorCode==='finish_length')).toBe(true);
  });

  it('does not retry other non-stop finish reasons',async()=>{
    const {context}=fixture();const apiKey=await vault();
    const fetcher=vi.fn<typeof fetch>(async()=>response('',{choices:[{message:{content:'{"type":"silence"}'},finish_reason:'content_filter'}]}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},[],settled))).rejects.toMatchObject({code:'incomplete_output'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(settled).toMatchObject([{status:'failed',errorCode:'finish_content_filter'}]);
  });

  it('rejects a missing finish reason instead of treating unknown completion as complete',async()=>{
    const {context}=fixture();const apiKey=await vault();
    const fetcher=vi.fn<typeof fetch>(async()=>response({type:'silence'},{choices:[{message:{content:'{"type":"silence"}'},finish_reason:null}]}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},[],settled))).rejects.toMatchObject({code:'incomplete_output'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(settled).toMatchObject([{status:'failed',errorCode:'finish_null'}]);
  });

  it('rejects an empty decision without retrying',async()=>{
    const {context}=fixture();const apiKey=await vault();const fetcher=vi.fn<typeof fetch>(async()=>response(''));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},[],settled))).rejects.toMatchObject({code:'malformed_output'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(settled).toMatchObject([{status:'failed',errorCode:'empty_output'}]);
  });

  it('discards any provider response that echoes the configured key',async()=>{
    const {context}=fixture();const apiKey=await vault();const secret='sk-test-not-a-real-key';
    const fetcher=vi.fn<typeof fetch>(async()=>response({type:'post',title:'echo',body:secret}));const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},[],settled))).rejects.toMatchObject({code:'secret_echo_rejected'});
    expect(settled).toMatchObject([{status:'failed',errorCode:'secret_echo_rejected'}]);expect(JSON.stringify(settled)).not.toContain(secret);
  });

  it('retries rate limits once, settles each request, then stops',async()=>{
    const {context}=fixture();const apiKey=await vault();const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:429}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const reserved:ProviderRequestEstimate[]=[];const settled:ProviderRequestResult[]=[];
    await expect(provider.decide(context,execution({},reserved,settled))).rejects.toMatchObject({code:'rate_limit'});
    expect(fetcher).toHaveBeenCalledTimes(2);expect(reserved).toHaveLength(2);expect(settled).toHaveLength(2);expect(settled.every(item=>item.errorCode==='rate_limit')).toBe(true);
  });

  it.each([500,503])('retries HTTP %i once, settles both attempts and returns only a safe provider error',async(status)=>{
    const {context}=fixture();const apiKey=await vault();const fetcher=vi.fn<typeof fetch>(async()=>new Response('upstream details must not escape',{status}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher});const reserved:ProviderRequestEstimate[]=[];const settled:ProviderRequestResult[]=[];
    let failure:unknown;try{await provider.decide(context,execution({},reserved,settled));}catch(error){failure=error;}
    expect(failure).toMatchObject({code:'provider_unavailable'});expect(String(failure)).not.toContain('upstream details');
    expect(fetcher).toHaveBeenCalledTimes(2);expect(reserved).toHaveLength(2);expect(settled).toHaveLength(2);
    expect(settled.every(item=>item.status==='failed'&&item.errorCode==='provider_unavailable')).toBe(true);
  });

  it('stops after a bounded retry on timeout and exposes no transport error text',async()=>{
    const {context}=fixture();const apiKey=await vault();const fetcher=vi.fn<typeof fetch>((_input,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('private request key sk-test-not-a-real-key')),{once:true})));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>true},fetcher,timeoutMs:8});const settled:ProviderRequestResult[]=[];
    let failure:unknown;try{await provider.decide(context,execution({},[],settled));}catch(error){failure=error;}
    expect(fetcher).toHaveBeenCalledTimes(2);expect(failure).toMatchObject({code:'timeout'});expect(String(failure)).not.toContain('sk-test-not-a-real-key');expect(settled).toHaveLength(2);
  });

  it('rejects a missing key and disabled real mode before the provider transport runs',async()=>{
    const {context}=fixture();const noKey=new CredentialVault({name:'Unavailable',available:async()=>false,read:async()=>null,write:async()=>{},remove:async()=>{}});const fetcher=vi.fn<typeof fetch>();
    const disabled=new DeepSeekDecisionProvider({vault:noKey,settings:{realModeEnabled:()=>false},fetcher});
    await expect(disabled.decide(context,execution())).rejects.toMatchObject({code:'real_mode_disabled'});expect(fetcher).not.toHaveBeenCalled();
    const enabled=new DeepSeekDecisionProvider({vault:noKey,settings:{realModeEnabled:()=>true},fetcher});
    await expect(enabled.decide(context,execution())).rejects.toMatchObject({code:'credentials_missing'});expect(fetcher).not.toHaveBeenCalled();
  });

  it('performs a direct mocked /models connection check without generating a model response',async()=>{
    const apiKey=await vault();const fetcher=vi.fn<typeof fetch>(async(input,init)=>new Response(JSON.stringify({data:[{id:'deepseek-flash'}]}),{status:200,headers:{'content-type':'application/json'}}));
    const provider=new DeepSeekDecisionProvider({vault:apiKey,settings:{realModeEnabled:()=>false},fetcher});
    await expect(provider.testConnection('deepseek-flash')).resolves.toMatchObject({ok:true,model:'deepseek-flash'});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://api.deepseek.com/models');expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
});
