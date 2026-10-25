import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db.js';
import { CredentialVault } from './credential-vault.js';
import { DeepSeekDecisionProvider } from './deepseek-provider.js';
import { ExperimentEngine, type DecisionProvider } from './experiment-engine.js';
import type { ProviderRunLimits } from '../shared/types.js';

const baseLimits:ProviderRunLimits={maxRequests:4,maxInputTokens:50_000,maxOutputTokens:1_000,maxOutputTokensPerRequest:128,maxEstimatedUsd:0.25};
const databases:ReturnType<typeof openDatabase>[]=[];const engines:ExperimentEngine[]=[];
afterEach(()=>{for(const engine of engines.splice(0))engine.close();for(const db of databases.splice(0))db.close();});
async function vault(){let stored:string|null=null;const value=new CredentialVault({name:'Test protected store',available:async()=>true,read:async()=>stored,write:async(secret:string)=>{stored=secret;},remove:async()=>{stored=null;}});await value.save('sk-test-no-paid-call','protected');return value;}
function providerWith(fetcher:typeof fetch){return vault().then(value=>new DeepSeekDecisionProvider({vault:value,settings:{realModeEnabled:()=>true},fetcher}));}
function completion(action:unknown={type:'silence'},status=200,usage={prompt_tokens:41,completion_tokens:5},finishReason='stop'){return new Response(JSON.stringify({id:'run-request-1',choices:[{message:{content:typeof action==='string'?action:JSON.stringify(action)},finish_reason:finishReason}],usage}),{status,headers:{'content-type':'application/json'}});}
function setup(realProvider:DecisionProvider,limits=baseLimits,scenarioId='capture-the-flags'){
  const db=openDatabase(':memory:');databases.push(db);const engine=new ExperimentEngine(db,{autoSchedule:false,realProvider});engines.push(engine);
  const run=engine.createExperiment({scenarioId,seed:`engine-${Math.random()}`,mode:'real',provider:{provider:'deepseek',model:'deepseek-flash',limits}});
  return {db,engine,run};
}

describe('real AI experiment engine path',()=>{
  it('commits exactly one mocked DeepSeek action and persists non-secret usage metadata',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion({type:'post',title:'A careful proposal',body:'Let us compare the facts before moving any flag.'}));
    const provider=await providerWith(fetcher);const {db,engine,run}=setup(provider);engine.pause(run.id);
    const after=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(after).toMatchObject({status:'paused',decisionCount:1,postCount:1,providerUsage:{requests:1,inputTokens:41,outputTokens:5,model:'deepseek-flash'}});
    expect(engine.getForumRows(run.id)).toHaveLength(1);
    expect(db.prepare('SELECT status,model_id,input_tokens,output_tokens,provider_request_id FROM provider_requests WHERE experiment_id=?').get(run.id)).toMatchObject({status:'succeeded',model_id:'deepseek-flash',input_tokens:41,output_tokens:5,provider_request_id:'run-request-1'});
    const saved=String(db.prepare('SELECT config_json FROM experiments WHERE id=?').get(run.id) as {config_json:string});expect(saved).not.toContain('sk-test-no-paid-call');
    const events=JSON.stringify(engine.getEvents(run.id));expect(events).not.toContain('sk-test-no-paid-call');
  });

  it('retries a mocked truncated response and persists only the complete decision',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(completion('{"type":"post","title":"partial',200,{prompt_tokens:41,completion_tokens:128},'length'))
      .mockResolvedValueOnce(completion({type:'silence'}));
    const provider=await providerWith(fetcher);const {db,engine,run}=setup(provider);engine.pause(run.id);
    const after=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(2);expect(after).toMatchObject({status:'paused',decisionCount:1,postCount:0,providerUsage:{requests:2,inputTokens:82,outputTokens:133,model:'deepseek-flash'}});
    expect(engine.getForumRows(run.id)).toHaveLength(0);
    expect(db.prepare('SELECT action_type FROM agent_decisions WHERE experiment_id=?').get(run.id)).toMatchObject({action_type:'silence'});
    expect(db.prepare('SELECT status,error_code,output_tokens FROM provider_requests WHERE experiment_id=? ORDER BY rowid').all(run.id)).toEqual([
      {status:'failed',error_code:'finish_length',output_tokens:128},
      {status:'succeeded',error_code:null,output_tokens:5},
    ]);
  });

  it.each(['capture-the-flags','the-investigation'])('stops after an incomplete response when the saved request budget cannot fund a retry (%s)',async(scenarioId)=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion('{"type":"post","title":"partial',200,{prompt_tokens:41,completion_tokens:128},'length'));
    const provider=await providerWith(fetcher);const oneRequest={...baseLimits,maxRequests:1};const {db,engine,run}=setup(provider,oneRequest,scenarioId);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(result.stopReason).toMatch(/usage limit/i);expect(engine.getForumRows(run.id)).toHaveLength(0);
    expect(db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=?').get(run.id)).toMatchObject({n:0});
    if(scenarioId==='the-investigation')expect(engine.getInvestigationState(run.id)).toMatchObject({votes:[],opinionChanges:[],phase:'discussion'});
    else expect(engine.getCaptureTheFlagsState(run.id)).toMatchObject({safeCount:5,capturedCount:0,transfers:[]});
    expect(db.prepare('SELECT status,error_code,output_tokens FROM provider_requests WHERE experiment_id=? ORDER BY rowid').all(run.id)).toEqual([
      {status:'failed',error_code:'finish_length',output_tokens:128},
      {status:'budget_rejected',error_code:'budget_exceeded',output_tokens:null},
    ]);
  });

  it('does not retry a truncated response after reported output usage exceeds its saved token budget',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion('{"type":"post","title":"partial',200,{prompt_tokens:41,completion_tokens:129},'length'));
    const provider=await providerWith(fetcher);const outputCap={...baseLimits,maxOutputTokens:128};const {db,engine,run}=setup(provider,outputCap);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(result.stopReason).toMatch(/saved local limits/i);expect(engine.getForumRows(run.id)).toHaveLength(0);
    expect(db.prepare('SELECT status,error_code,output_tokens FROM provider_requests WHERE experiment_id=?').get(run.id)).toMatchObject({status:'failed',error_code:'finish_length',output_tokens:129});
  });

  it('charges an incomplete response to the saved spend ceiling before considering a retry',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion('{"type":"post","title":"partial',200,{prompt_tokens:2_000,completion_tokens:1_024},'length'));
    const provider=await providerWith(fetcher);const spendCap={...baseLimits,maxOutputTokens:2_048,maxOutputTokensPerRequest:1_024,maxEstimatedUsd:0.01};
    const {db,engine,run}=setup(provider,spendCap);engine.pause(run.id);const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(result.stopReason).toMatch(/usage limit/i);expect(engine.getForumRows(run.id)).toHaveLength(0);
    const requests=db.prepare('SELECT status,error_code,output_tokens,actual_cost_usd FROM provider_requests WHERE experiment_id=? ORDER BY rowid').all(run.id) as {status:string;error_code:string|null;output_tokens:number|null;actual_cost_usd:number|null}[];
    expect(requests).toHaveLength(2);expect(requests[0]).toMatchObject({status:'failed',error_code:'finish_length',output_tokens:1_024});
    expect(requests[0]!.actual_cost_usd).toBeGreaterThan(0);expect(requests[1]).toMatchObject({status:'budget_rejected',error_code:'budget_exceeded'});
    expect(engine.getExperiment(run.id).providerUsage?.estimatedUsd).toBeLessThanOrEqual(spendCap.maxEstimatedUsd);
  });

  it('marks invalid scenario actions failed without applying posts, flags or votes',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion({type:'change_opinion',conclusionId:'mara-key'}));
    const provider=await providerWith(fetcher);const {db,engine,run}=setup(provider);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(engine.getForumRows(run.id)).toHaveLength(0);expect(engine.getCaptureTheFlagsState(run.id)).toMatchObject({safeCount:5,capturedCount:0,transfers:[]});
    expect((db.prepare('SELECT count(*) AS n FROM investigation_votes WHERE experiment_id=?').get(run.id) as {n:number}).n).toBe(0);
    expect((db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=?').get(run.id) as {n:number}).n).toBe(0);
  });

  it('discards a decision when provider-reported usage exceeds its pre-request reservation',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>completion({type:'post',title:'May be billed',body:'This response must not be committed.'},200,{prompt_tokens:50_001,completion_tokens:5}));
    const provider=await providerWith(fetcher);const capped={...baseLimits,maxInputTokens:50_000};const {db,engine,run}=setup(provider,capped);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(engine.getForumRows(run.id)).toHaveLength(0);expect(db.prepare('SELECT input_tokens,status FROM provider_requests WHERE experiment_id=?').get(run.id)).toMatchObject({input_tokens:50_001,status:'succeeded'});
  });

  it('rejects an over-budget request before HTTP and records the safe reason',async()=>{
    const fetcher=vi.fn<typeof fetch>();const provider=await providerWith(fetcher);const tiny={...baseLimits,maxInputTokens:1};const {db,engine,run}=setup(provider,tiny);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).not.toHaveBeenCalled();expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(result.stopReason).toContain('usage limit');
    expect(db.prepare('SELECT status,error_code FROM provider_requests WHERE experiment_id=?').get(run.id)).toMatchObject({status:'budget_rejected',error_code:'budget_exceeded'});
  });

  it('counts retry attempts against request limits before another network call',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:429}));const provider=await providerWith(fetcher);const oneRequest={...baseLimits,maxRequests:1};const {db,engine,run}=setup(provider,oneRequest);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(db.prepare('SELECT status,error_code FROM provider_requests WHERE experiment_id=? ORDER BY created_at,id').all(run.id)).toHaveLength(2);
    expect((db.prepare("SELECT count(*) AS n FROM provider_requests WHERE experiment_id=? AND status='budget_rejected'").get(run.id) as {n:number}).n).toBe(1);
  });

  it.each([
    {status:500,scenarioId:'capture-the-flags'},
    {status:503,scenarioId:'capture-the-flags'},
    {status:500,scenarioId:'the-investigation'},
    {status:503,scenarioId:'the-investigation'}
  ])('fails HTTP $status for $scenarioId after bounded retries without persisting a partial game action',async({status,scenarioId})=>{
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('mock upstream failure details',{status}));const provider=await providerWith(fetcher);
    const {db,engine,run}=setup(provider,baseLimits,scenarioId);engine.pause(run.id);
    const result=await engine.step(run.id);
    expect(fetcher).toHaveBeenCalledTimes(2);expect(result).toMatchObject({status:'failed',decisionCount:0,outcome:null});
    expect(engine.getForumRows(run.id)).toHaveLength(0);
    expect((db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=?').get(run.id) as {n:number}).n).toBe(0);
    const actions=db.prepare(`SELECT count(*) AS n FROM experiment_events WHERE experiment_id=? AND event_type IN ('forum.post','forum.reply','flag.transferred','flag.captured','investigation.opinion_changed','investigation.vote_recorded')`).get(run.id) as {n:number};
    expect(actions.n).toBe(0);
    if(scenarioId==='capture-the-flags'){
      expect(engine.getCaptureTheFlagsState(run.id)).toMatchObject({safeCount:5,capturedCount:0,transfers:[]});
    }else{
      expect(engine.getInvestigationState(run.id)).toMatchObject({votes:[],opinionChanges:[],phase:'discussion'});
    }
    const requestRows=db.prepare('SELECT status,error_code FROM provider_requests WHERE experiment_id=? ORDER BY created_at,id').all(run.id) as {status:string;error_code:string}[];
    expect(requestRows).toHaveLength(2);expect(requestRows.every(row=>row.status==='failed'&&row.error_code==='provider_unavailable')).toBe(true);
    expect(result.stopReason).not.toContain('mock upstream failure details');
  });

  it('cancels an in-flight decision on pause so a late completion cannot commit',async()=>{
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
    const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});started();});
    const provider=await providerWith(fetcher);const db=openDatabase(':memory:');databases.push(db);let time=10_000;
    const engine=new ExperimentEngine(db,{autoSchedule:false,now:()=>time,realProvider:provider});engines.push(engine);
    const run=engine.createExperiment({scenarioId:'capture-the-flags',seed:'pause-flight',mode:'real',paceMs:100,provider:{provider:'deepseek',model:'deepseek-flash',limits:baseLimits}});
    time+=100;const ticking=engine.tick();await pending;const paused=engine.pause(run.id);await ticking;
    expect(paused.status).toBe('paused');expect(engine.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:0,outcome:null});expect(engine.getForumRows(run.id)).toHaveLength(0);
    expect(engine.getCaptureTheFlagsState(run.id).transfers).toHaveLength(0);
  });

  it('stops an in-flight real run and rejects its late provider response',async()=>{
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
    const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});started();});
    const provider=await providerWith(fetcher);const {engine,run}=setup(provider);engine.pause(run.id);
    const stepping=engine.step(run.id);await pending;const stopped=engine.stop(run.id);await stepping;
    expect(stopped.status).toBe('stopped');expect(engine.getExperiment(run.id)).toMatchObject({status:'stopped',decisionCount:0,outcome:null});expect(engine.getForumRows(run.id)).toHaveLength(0);
  });

  it('disabling Real AI pauses its active run and cancels its in-flight request',async()=>{
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('disabled')),{once:true});started();});
    const provider=await providerWith(fetcher);const db=openDatabase(':memory:');databases.push(db);let time=20_000;const engine=new ExperimentEngine(db,{autoSchedule:false,now:()=>time,realProvider:provider});engines.push(engine);
    const run=engine.createExperiment({scenarioId:'capture-the-flags',seed:'disable-flight',mode:'real',paceMs:100,provider:{provider:'deepseek',model:'deepseek-flash',limits:baseLimits}});time+=100;
    const ticking=engine.tick();await pending;engine.disableRealRuns();await ticking;
    expect(engine.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:0,outcome:null});expect(engine.getForumRows(run.id)).toHaveLength(0);
  });

  it('prevents overlapping one-step calls from accepting duplicate responses',async()=>{
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});let resolveFetch!:(value:Response)=>void;
    const fetcher=vi.fn<typeof fetch>(async()=>{started();return new Promise<Response>(resolve=>{resolveFetch=resolve;});});const provider=await providerWith(fetcher);const {engine,run}=setup(provider);engine.pause(run.id);
    const first=engine.step(run.id);await pending;await expect(engine.step(run.id)).rejects.toThrow('already in progress');resolveFetch(completion({type:'silence'}));
    const after=await first;expect(after.decisionCount).toBe(1);expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps reserved cost and accepted state safe through restart during an in-flight request',async()=>{
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
    const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('shutdown')),{once:true});started();});
    const provider=await providerWith(fetcher);const db=openDatabase(':memory:');databases.push(db);const first=new ExperimentEngine(db,{autoSchedule:false,realProvider:provider});engines.push(first);
    const run=first.createExperiment({scenarioId:'the-investigation',seed:'restart-flight',mode:'real',provider:{provider:'deepseek',model:'deepseek-flash',limits:baseLimits}});first.pause(run.id);
    const stepping=first.step(run.id);await pending;first.close();await stepping;
    const restarted=new ExperimentEngine(db,{autoSchedule:false,realProvider:provider});engines.push(restarted);
    expect(restarted.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:0,outcome:null,providerUsage:{requests:1}});
    expect(restarted.getInvestigationState(run.id).votes).toHaveLength(0);
    expect((db.prepare('SELECT status,error_code FROM provider_requests WHERE experiment_id=?').get(run.id) as {status:string;error_code:string}).status).toBe('failed');
  });

  it('marks an orphaned reservation interrupted on restart and keeps its budget reserved',async()=>{
    const db=openDatabase(':memory:');databases.push(db);const first=new ExperimentEngine(db,{autoSchedule:false,recoverOnStart:false});engines.push(first);
    const run=first.createExperiment({scenarioId:'capture-the-flags',seed:'abrupt-restart',mode:'real',provider:{provider:'deepseek',model:'deepseek-flash',limits:baseLimits}});
    db.prepare(`INSERT INTO provider_requests (id,experiment_id,model_id,status,estimated_input_tokens,reserved_output_tokens,reserved_cost_usd,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run('orphaned-request',run.id,'deepseek-flash','reserved',99,128,0.0009,new Date().toISOString());
    first.close();
    const recovered=new ExperimentEngine(db,{autoSchedule:false});engines.push(recovered);
    expect(recovered.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:0,outcome:null,providerUsage:{requests:1,inputTokens:99,outputTokens:128,estimatedUsd:0.0009}});
    expect(db.prepare('SELECT status,error_code FROM provider_requests WHERE id=?').get('orphaned-request')).toMatchObject({status:'failed',error_code:'interrupted'});
    expect(recovered.getEvents(run.id,0,true).some(event=>event.type==='provider.request_settled'&&event.payload.errorCode==='interrupted')).toBe(true);
  });
});
