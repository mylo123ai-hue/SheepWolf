import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from './db.js';
import { assignRoles, ExperimentEngine, participantContext, type AgentAction, type AgentContext, type DecisionProvider } from './experiment-engine.js';
const engines:ExperimentEngine[]=[];const databases:Database.Database[]=[];
function fixture(options:ConstructorParameters<typeof ExperimentEngine>[1]={}){const db=openDatabase(':memory:');databases.push(db);const engine=new ExperimentEngine(db,{autoSchedule:false,...options});engines.push(engine);return {db,engine};}
afterEach(()=>{for(const engine of engines.splice(0))engine.close();for(const db of databases.splice(0))db.close();});
const scenarioId='capture-the-flags';
class FixedProvider implements DecisionProvider { constructor(private action:AgentAction){} decide(){return this.action;} }

describe('shared autonomous experiment engine',()=>{
  it('assigns exactly five Sheep and two Wolves independently for each run seed',()=>{
    const a=assignRoles('seed-a'),b=assignRoles('seed-b');
    expect([...a.values()].filter(role=>role==='sheep')).toHaveLength(5);expect([...a.values()].filter(role=>role==='wolf')).toHaveLength(2);
    expect([...b.values()].filter(role=>role==='sheep')).toHaveLength(5);expect([...b.values()].filter(role=>role==='wolf')).toHaveLength(2);
    expect([...a].some(([id,role])=>b.get(id)!==role)).toBe(true);
  });
  it('keeps roles and private objectives out of public summaries and gives each run fresh memory',()=>{
    const {db,engine}=fixture();const first=engine.createExperiment({scenarioId,seed:'privacy-a'});const sheep=first.participants.find(p=>p.role==='sheep')!;const wolf=first.participants.find(p=>p.role==='wolf')!;
    expect(participantContext(db,first.id,sheep.characterId).wolfTeammates).toEqual([]);
    expect(participantContext(db,first.id,wolf.characterId).wolfTeammates).toHaveLength(1);
    db.prepare("UPDATE experiment_participants SET memory_json='[\"private note\"]' WHERE experiment_id=? AND character_id=?").run(first.id,sheep.characterId);
    expect(engine.getPublicExperiment(first.id)).not.toHaveProperty('participants');expect(engine.getPublicExperiment(first.id)).not.toHaveProperty('roleSeed');expect(engine.getPublicExperiment(first.id)).not.toHaveProperty('role');
    engine.stop(first.id);const second=engine.createExperiment({scenarioId,seed:'privacy-b'});
    expect(participantContext(db,second.id,sheep.characterId).ownMemory).toEqual([]);expect(engine.getCurrent()?.id).toBe(second.id);
  });
  it('offers fair opportunities in a shuffled order rather than a fixed character sequence',()=>{
    const {engine}=fixture({provider:new FixedProvider({type:'silence'})});const orders:string[][]=[];
    for(let n=0;n<4;n++){const run=engine.createExperiment({scenarioId,seed:`fair-${n}`});engine.pause(run.id);for(let i=0;i<7;i++)engine.step(run.id);orders.push(engine.getExperiment(run.id).recentDecisions.map(d=>d.characterId));engine.stop(run.id);}
    expect(orders.every(order=>new Set(order).size===7)).toBe(true);
    expect(new Set(orders.map(order=>order.join(','))).size).toBeGreaterThan(1);
    expect(orders[0]).not.toEqual(['willow','rowan','clover','fern','moss','ash','brook']);
  });
  it('steps once while paused and atomically persists a new post and reply',()=>{
    let calls=0;const provider:DecisionProvider={decide:(context:AgentContext)=>{calls++;return calls===1?{type:'post',title:'A new thought',body:'Let us take this one point at a time.'}:{type:'reply',parentPostId:context.recentMessages[0]!.id,body:'That helps me follow the question.'};}};
    const {engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed:'persist'});engine.pause(run.id);
    const afterOne=engine.step(run.id);expect(afterOne.status).toBe('paused');expect(afterOne.decisionCount).toBe(1);expect(afterOne.postCount).toBe(1);
    expect(engine.getExperiment(run.id).decisionCount).toBe(1);
    const afterTwo=engine.step(run.id);expect(afterTwo.decisionCount).toBe(2);expect(afterTwo.postCount).toBe(2);expect(afterTwo.replyCount).toBe(1);
    const rows=engine.getForumRows(run.id);expect(rows.map(row=>row.body)).toContain('Let us take this one point at a time.');expect(rows.find(row=>row.body.startsWith('That helps'))?.parent_id).toBe(rows[0]?.id);
  });
  it('pauses without charging paused time, resumes, and stops without declaring a victory',()=>{
    let time=1_000;const {engine}=fixture({now:()=>time,provider:new FixedProvider({type:'silence'})});const run=engine.createExperiment({scenarioId,seed:'lifecycle'});
    time+=2_000;engine.pause(run.id);expect(engine.getExperiment(run.id).activeElapsedMs).toBe(2_000);
    time+=40_000;expect(engine.getExperiment(run.id).activeElapsedMs).toBe(2_000);
    engine.resume(run.id);time+=500;engine.pause(run.id);expect(engine.getExperiment(run.id).activeElapsedMs).toBe(2_500);
    engine.stop(run.id);const stopped=engine.getExperiment(run.id);expect(stopped.status).toBe('stopped');expect(stopped.outcome).toBeNull();
  });
  it('only allows a consensus conclusion after two opportunities per participant and three Sheep agreements',()=>{
    const provider:DecisionProvider={decide:(context)=>context.proposalOpen?{type:'ending_vote',vote:context.role==='sheep'?'agree':'disagree'}:context.endingAvailable?{type:'propose_ending',body:'Shall we wrap up?'}:{type:'silence'}};
    const {engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed:'consensus'});engine.pause(run.id);
    for(let i=0;i<14;i++)engine.step(run.id);
    expect(engine.getExperiment(run.id).status).toBe('paused');
    expect(engine.getExperiment(run.id).participants.every(p=>p.actionOpportunities>=2)).toBe(true);
    for(let i=0;i<7&&engine.getExperiment(run.id).status==='paused';i++)engine.step(run.id);const done=engine.getExperiment(run.id);expect(done.status).toBe('completed');expect(done.outcome).toMatchObject({kind:'unscored',reason:'sheep_consensus',sheepAgreement:3});
  });
  it('does not conclude when fewer than three Sheep agree to an ending proposal',()=>{
    const runSeed='minority';const roles=assignRoles(runSeed);const firstTwoSheep=[...roles].filter(([,role])=>role==='sheep').slice(0,2).map(([id])=>id);
    const provider:DecisionProvider={decide:(context)=>context.proposalOpen?{type:'ending_vote',vote:context.role==='sheep'&&firstTwoSheep.includes(context.characterId)?'agree':'disagree'}:context.endingAvailable?{type:'propose_ending',body:'Shall we wrap up?'}:{type:'silence'}};
    const {engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed:runSeed});engine.pause(run.id);
    for(let i=0;i<24&&!engine.getEvents(run.id).some(event=>event.type==='ending.declined');i++)engine.step(run.id);
    expect(engine.getExperiment(run.id).status).toBe('paused');expect(engine.getEvents(run.id).some(event=>event.type==='ending.declined')).toBe(true);
    expect(engine.getExperiment(run.id).outcome).toBeNull();
  });
  it('enforces decision and active-time limits with explicit unscored completion',()=>{
    let time=10_000;const {engine}=fixture({now:()=>time,provider:new FixedProvider({type:'silence'})});const run=engine.createExperiment({scenarioId,seed:'limits',paceMs:100,maxDurationMs:1_000,maxDecisions:3});
    time+=100;engine.tick();expect(engine.getExperiment(run.id).decisionCount).toBe(1);
    time+=100;engine.tick();expect(engine.getExperiment(run.id).decisionCount).toBe(2);
    time+=100;engine.tick();expect(engine.getExperiment(run.id)).toMatchObject({status:'completed',decisionCount:3,outcome:{kind:'unscored',reason:'decision_limit'}});
    const timed=engine.createExperiment({scenarioId,seed:'duration',maxDurationMs:1_000});time+=1_100;engine.tick();expect(engine.getExperiment(timed.id)).toMatchObject({status:'completed',outcome:{kind:'unscored',reason:'active_time_limit'}});
  });
  it('recovers an interrupted running experiment as paused without losing decisions',()=>{
    let time=50_000;const db=openDatabase(':memory:');databases.push(db);const first=new ExperimentEngine(db,{autoSchedule:false,now:()=>time});engines.push(first);const run=first.createExperiment({scenarioId,seed:'recover'});first.pause(run.id);first.resume(run.id);first.close();
    const recovery=new ExperimentEngine(db,{autoSchedule:false,now:()=>time+400,recoverOnStart:true});engines.push(recovery);expect(recovery.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:0});
    expect(recovery.getEvents(run.id).some(event=>event.type==='run.recovered')).toBe(true);
  });
  it('records decisions and events in sequence and never makes external requests',()=>{
    const {db,engine}=fixture({provider:new FixedProvider({type:'silence'})});const run=engine.createExperiment({scenarioId,seed:'events'});engine.pause(run.id);engine.step(run.id);
    const decisions=db.prepare('SELECT sequence,action_type FROM agent_decisions WHERE experiment_id=?').all(run.id) as {sequence:number;action_type:string}[];
    expect(decisions).toEqual([{sequence:1,action_type:'silence'}]);
    expect(engine.getEvents(run.id).map(event=>event.type)).toEqual(['run.started','run.paused','agent.decision']);
  });
});
