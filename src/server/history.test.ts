import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db.js';
import { buildApp } from './app.js';
import type Database from 'better-sqlite3';

const databases:Database.Database[]=[];
const apps:Awaited<ReturnType<typeof buildApp>>[]=[];
afterEach(async()=>{for(const app of apps.splice(0))await app.close();for(const db of databases.splice(0))db.close();});
function savedRows(db:Database.Database,id:string){
  const queries:[string,string][]=[
    ['experiments','SELECT * FROM experiments WHERE id=?'],['participants','SELECT * FROM experiment_participants WHERE experiment_id=?'],
    ['decisions','SELECT * FROM agent_decisions WHERE experiment_id=?'],['events','SELECT * FROM experiment_events WHERE experiment_id=?'],
    ['posts','SELECT * FROM forum_posts WHERE experiment_id=?'],['flags','SELECT * FROM capture_flags WHERE experiment_id=?'],
    ['investigation','SELECT * FROM investigation_runs WHERE experiment_id=?'],['opinions','SELECT * FROM investigation_opinions WHERE experiment_id=?'],
    ['changes','SELECT * FROM investigation_opinion_changes WHERE experiment_id=?'],['votes','SELECT * FROM investigation_votes WHERE experiment_id=?'],
    ['providerRequests','SELECT * FROM provider_requests WHERE experiment_id=?']
  ];
  return Object.fromEntries(queries.map(([name,sql])=>[name,db.prepare(sql).all(id)]));
}

describe('experiment history and read-only replay',()=>{
  it('starts empty, preserves immutable run configuration and participant profiles, and replays saved events without changing source rows',async()=>{
    const db=openDatabase(':memory:');databases.push(db);const providerFetch=vi.fn<typeof fetch>();
    const app=await buildApp(db,{autoSchedule:false,provider:{decide:()=>({type:'post',title:'A recorded opening',body:'A reliable history should show this message exactly once.'})}}, {providerFetch});apps.push(app);
    expect((await app.inject('/api/history')).json()).toEqual([]);
    const created=await app.inject({method:'POST',url:'/api/experiments',payload:{scenarioId:'capture-the-flags',seed:'history-run',maxDecisions:1,mode:'demo'}});expect(created.statusCode).toBe(201);
    const run=created.json();expect(run.scenarioVersion).toBe('flags-1');
    await app.inject({method:'POST',url:`/api/experiments/${run.id}/pause`});
    const stepped=await app.inject({method:'POST',url:`/api/experiments/${run.id}/step`});expect(stepped.statusCode).toBe(200);expect(stepped.json().status).toBe('completed');
    const baselineName=run.participants.find((person:{characterId:string})=>person.characterId==='willow').name;
    const baselineFlagState=run.scenarioState;
    db.prepare("UPDATE characters SET name='Changed catalog name',personality='Changed catalog trait'").run();
    const before=savedRows(db,run.id);
    const list=await app.inject('/api/history');expect(list.statusCode).toBe(200);expect(list.json()).toHaveLength(1);
    expect(list.json()[0].snapshot).toMatchObject({id:run.id,status:'completed',scenarioVersion:'flags-1',roleSeed:'history-run',config:{mode:'demo',maxDecisions:1}});
    const detail=await app.inject(`/api/history/${run.id}`);expect(detail.statusCode).toBe(200);
    const recording=detail.json();expect(recording.snapshot.participants.find((person:{characterId:string})=>person.characterId==='willow')).toMatchObject({name:baselineName,personality:run.participants.find((person:{characterId:string})=>person.characterId==='willow').personality});
    expect(recording.snapshot.scenarioState).toEqual(baselineFlagState);
    const flattenPosts=(posts:{body:string;children:{body:string;children:never[]}[]}[]):string[]=>posts.flatMap(post=>[post.body,...flattenPosts(post.children)]);
    expect(flattenPosts(recording.forum).join(' ')).toContain('A reliable history');
    expect(recording.snapshot.postCount+recording.snapshot.replyCount).toBe(flattenPosts(recording.forum).length);
    expect(recording.events.map((event:{sequence:number})=>event.sequence)).toEqual([...recording.events].map((event:{sequence:number})=>event.sequence).sort((a:number,b:number)=>a-b));
    expect(recording.events.some((event:{type:string})=>event.type==='forum.post')).toBe(true);
    expect(recording.decisions).toHaveLength(1);expect(recording.decisions[0].result.summary).toContain('A recorded opening');
    expect(recording.snapshot.participants.filter((person:{role:string})=>person.role==='wolf')).toHaveLength(2);
    const publicRun=await app.inject(`/api/experiments/${run.id}/public`);expect(publicRun.body).not.toMatch(/wolf|privateObjective|roleSeed/i);
    expect(savedRows(db,run.id)).toEqual(before);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('lists and opens stopped, failed and incomplete records without inventing a victory',async()=>{
    const db=openDatabase(':memory:');databases.push(db);const app=await buildApp(db,{autoSchedule:false});apps.push(app);
    const create=async(scenarioId:string,seed:string)=>{
      const response=await app.inject({method:'POST',url:'/api/experiments',payload:{scenarioId,seed}});expect(response.statusCode).toBe(201);return response.json();
    };
    const stopped=await create('capture-the-flags','history-stopped');await app.inject({method:'POST',url:`/api/experiments/${stopped.id}/stop`});
    const failed=await create('capture-the-flags','history-failed');db.prepare("UPDATE experiments SET status='failed',ended_at=?,stop_reason=?,outcome_json=NULL,resumed_at=NULL WHERE id=?").run(new Date().toISOString(),'test provider interruption',failed.id);
    const providerLimits={maxRequests:4,maxInputTokens:5000,maxOutputTokens:500,maxOutputTokensPerRequest:128,maxEstimatedUsd:0.25};
    db.prepare('UPDATE experiments SET config_json=? WHERE id=?').run(JSON.stringify({...failed.config,mode:'real',provider:{provider:'deepseek',model:'deepseek-flash',limits:providerLimits}}),failed.id);
    db.prepare(`INSERT INTO provider_requests (id,experiment_id,model_id,status,estimated_input_tokens,reserved_output_tokens,input_tokens,output_tokens,reserved_cost_usd,actual_cost_usd,provider_request_id,elapsed_ms,created_at,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('history-mock-request',failed.id,'deepseek-flash','succeeded',40,128,36,14,0.01,0.008,'mock-provider-id',250,new Date().toISOString(),new Date().toISOString());
    const incomplete=await create('the-investigation','history-incomplete');db.prepare("UPDATE experiments SET status='incomplete_finalization',ended_at=?,stop_reason=?,outcome_json=NULL,resumed_at=NULL WHERE id=?").run(new Date().toISOString(),'missing Sheep votes',incomplete.id);
    const investigationNames=new Map(incomplete.participants.map((person:{characterId:string;name:string})=>[person.characterId,person.name]));
    db.prepare("UPDATE characters SET name='Changed catalog name',personality='Changed catalog trait'").run();
    const rows=(await app.inject('/api/history')).json();expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row:{snapshot:{status:string}})=>row.snapshot.status))).toEqual(new Set(['stopped','failed','incomplete_finalization']));
    expect(rows.find((row:{snapshot:{id:string}})=>row.snapshot.id===stopped.id).snapshot).toMatchObject({status:'stopped',outcome:null,stopReason:'administrator_stop'});
    expect(rows.find((row:{snapshot:{id:string}})=>row.snapshot.id===failed.id).snapshot).toMatchObject({status:'failed',outcome:null,stopReason:'test provider interruption'});
    expect(rows.find((row:{snapshot:{id:string}})=>row.snapshot.id===failed.id).snapshot.providerUsage).toMatchObject({requests:1,inputTokens:36,outputTokens:14,estimatedUsd:0.008,model:'deepseek-flash',limits:providerLimits});
    expect(rows.find((row:{snapshot:{id:string}})=>row.snapshot.id===incomplete.id).snapshot).toMatchObject({scenarioVersion:'archive-1',status:'incomplete_finalization',outcome:null,stopReason:'missing Sheep votes'});
    for(const run of [stopped,failed,incomplete])expect((await app.inject(`/api/history/${run.id}`)).statusCode).toBe(200);
    const investigationDetail=(await app.inject(`/api/history/${incomplete.id}`)).json();
    expect(investigationDetail.snapshot.scenarioState.opinions.every((opinion:{characterId:string;characterName:string})=>opinion.characterName===investigationNames.get(opinion.characterId))).toBe(true);
  });
});
