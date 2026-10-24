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
    for(let i=0;i<7&&engine.getExperiment(run.id).status==='paused';i++)engine.step(run.id);const done=engine.getExperiment(run.id);expect(done.status).toBe('completed');expect(done.outcome).toMatchObject({kind:'victory',team:'sheep',reason:'sheep_consensus',sheepAgreement:3,safeCount:5,capturedCount:0});
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
    time+=100;engine.tick();expect(engine.getExperiment(run.id)).toMatchObject({status:'completed',decisionCount:3,outcome:{kind:'victory',team:'sheep',reason:'decision_limit',safeCount:5,capturedCount:0}});
    const timed=engine.createExperiment({scenarioId,seed:'duration',maxDurationMs:1_000});time+=1_100;engine.tick();expect(engine.getExperiment(timed.id)).toMatchObject({status:'completed',outcome:{kind:'victory',team:'sheep',reason:'active_time_limit',safeCount:5,capturedCount:0}});
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
    expect(engine.getEvents(run.id).map(event=>event.type)).toEqual(['flags.initialized','run.started','run.paused','agent.decision']);
  });
  it('initializes exactly five unique safe flags, one per Sheep, and hides other custodians from Sheep contexts',()=>{
    const {db,engine}=fixture();const run=engine.createExperiment({scenarioId,seed:'inventory'});const state=engine.getExperiment(run.id).scenarioState!;
    const sheep=run.participants.filter(p=>p.role==='sheep').map(p=>p.characterId).sort();
    expect(state.flags).toHaveLength(5);expect(new Set(state.flags.map(f=>f.flagId)).size).toBe(5);expect(state.safeCount).toBe(5);expect(state.capturedCount).toBe(0);
    expect(state.flags.map(f=>f.originalOwnerId).sort()).toEqual(sheep);expect(state.flags.every(f=>f.custodianId===f.originalOwnerId&&f.status==='safe')).toBe(true);
    const view=participantContext(db,run.id,sheep[0]!);expect(view.knownFlags).toHaveLength(1);expect(view.knownFlags[0]?.originalOwnerId).toBe(sheep[0]);expect(view).not.toHaveProperty('participants');
    const wolf=run.participants.find(p=>p.role==='wolf')!;expect(participantContext(db,run.id,wolf.characterId).knownFlags).toEqual([]);
  });
  it('accepts a Sheep-to-Sheep voluntary transfer and commits its event and immutable history',()=>{
    let recipient='';const provider:DecisionProvider={decide:context=>{const flag=context.knownFlags.find(f=>f.status==='safe'&&f.custodianId===context.characterId);if(context.role!=='sheep'||!flag)return {type:'silence'};const sheepIds=[...assignRoles('voluntary').entries()].filter(([,role])=>role==='sheep').map(([id])=>id);recipient=sheepIds.find(id=>id!==context.characterId)!;return {type:'transfer_flag',flagId:flag.flagId,targetCharacterId:recipient};}};
    const {db,engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed:'voluntary'});engine.pause(run.id);
    for(let i=0;i<8&&engine.getCaptureTheFlagsState(run.id).transfers.length===0;i++)engine.step(run.id);
    const state=engine.getCaptureTheFlagsState(run.id);expect(state.transfers).toHaveLength(1);expect(state.transfers[0]?.toCharacterId).toBe(recipient);expect(state.transfers[0]?.captured).toBe(false);
    expect(state.flags.find(f=>f.flagId===state.transfers[0]?.flagId)).toMatchObject({status:'safe',custodianId:recipient});
    expect(db.prepare('SELECT count(*) AS n FROM flag_transfers WHERE experiment_id=?').get(run.id)).toMatchObject({n:1});
    const selected=engine.getEvents(run.id).find(e=>e.type==='flag.transferred')!;expect(selected.audience).toBe('selected');expect(selected.visibleTo).toContain(recipient);
    expect(engine.getEvents(run.id,0,false).some(e=>e.type.startsWith('flag.'))).toBe(false);expect(engine.getPublicExperiment(run.id)).not.toHaveProperty('scenarioState');
    expect(()=>db.prepare('UPDATE flag_transfers SET captured=1 WHERE experiment_id=?').run(run.id)).toThrow('immutable');
  });
  it('rejects non-custodians and Wolves attempting to move flags without recording partial actions',()=>{
    const seed='invalid-transfer';const owner=[...assignRoles(seed)].find(([,role])=>role==='sheep')![0];const wolf=[...assignRoles(seed)].find(([,role])=>role==='wolf')![0];
    let attemptedNonCustodian=false;const invalid:DecisionProvider={decide:context=>{if(context.role==='sheep'&&context.characterId!==owner){attemptedNonCustodian=true;return {type:'transfer_flag',flagId:`flag-${owner}`,targetCharacterId:wolf};}return {type:'silence'};}};
    const {db,engine}=fixture({provider:invalid});const run=engine.createExperiment({scenarioId,seed});engine.pause(run.id);
    let invalidError='';for(let i=0;i<7&&!invalidError;i++){try{engine.step(run.id);}catch(error){invalidError=String(error);}}
    expect(attemptedNonCustodian).toBe(true);expect(invalidError).toContain('Only the current custodian');const before=engine.getExperiment(run.id).decisionCount;
    expect(engine.getExperiment(run.id).decisionCount).toBe(before);expect(engine.getCaptureTheFlagsState(run.id).transfers).toHaveLength(0);
    engine.stop(run.id);

    const directSteal:DecisionProvider={decide:context=>context.role==='wolf'?{type:'steal_flag',flagId:`flag-${owner}`,targetCharacterId:context.characterId}:{type:'silence'}};
    const second=engine.createExperiment({scenarioId,seed:'wolf-steal'});
    const engine2=new ExperimentEngine(db,{autoSchedule:false,provider:directSteal});engines.push(engine2);
    for(let i=0;i<7&&engine2.getExperiment(second.id).decisionCount<7;i++){
      try{engine2.step(second.id);}catch(error){expect(String(error)).toContain('cannot be stolen');break;}
    }
    expect(engine2.getCaptureTheFlagsState(second.id).transfers).toHaveLength(0);
  });
  it('rejects self-transfers, unknown flag IDs, and recipients outside the run',()=>{
    const {db,engine}=fixture();const cases:[string,(context:AgentContext)=>AgentAction][]=[
      ['Choose another participant',(context)=>({type:'transfer_flag',flagId:context.knownFlags[0]!.flagId,targetCharacterId:context.characterId})],
      ['recipient is not part of this experiment',(context)=>({type:'transfer_flag',flagId:context.knownFlags[0]!.flagId,targetCharacterId:'outsider'})],
      ['flag does not exist',(context)=>({type:'transfer_flag',flagId:'not-a-flag',targetCharacterId:context.otherParticipants[0]!.id})]
    ];
    for(const [expected,makeAction] of cases){
      const run=engine.createExperiment({scenarioId,seed:`invalid-${expected}`});engine.pause(run.id);let errorText='';const provider:DecisionProvider={decide:context=>context.role==='sheep'?makeAction(context):{type:'silence'}};
      const temporary=new ExperimentEngine(db,{autoSchedule:false,provider});engines.push(temporary);
      for(let i=0;i<8&&!errorText;i++){try{temporary.step(run.id);}catch(error){errorText=String(error);}}
      expect(errorText).toContain(expected);expect(temporary.getCaptureTheFlagsState(run.id).transfers).toHaveLength(0);temporary.stop(run.id);
    }
  });
  it('captures a transferred Wolf flag permanently and declares Wolf victory on the third distinct capture',()=>{
    let capturedFlag='';let originalOwner='';const seed='wolf-victory';const wolf=[...assignRoles(seed)].find(([,role])=>role==='wolf')![0];
    const provider:DecisionProvider={decide:context=>{const flag=context.knownFlags.find(f=>f.status==='safe'&&f.custodianId===context.characterId);if(context.role!=='sheep'||!flag)return {type:'silence'};capturedFlag=flag.flagId;originalOwner=flag.originalOwnerId;return {type:'transfer_flag',flagId:flag.flagId,targetCharacterId:wolf};}};
    const {db,engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed});engine.pause(run.id);
    for(let i=0;i<30&&engine.getExperiment(run.id).status==='paused';i++)engine.step(run.id);
    const finished=engine.getExperiment(run.id);expect(finished).toMatchObject({status:'completed',outcome:{kind:'victory',team:'wolves',reason:'three_flags_captured',capturedCount:3,safeCount:2}});
    expect(new Set(finished.scenarioState?.transfers.map(t=>t.flagId)).size).toBe(3);expect(finished.scenarioState?.flags.filter(f=>f.status==='captured')).toHaveLength(3);
    const n=db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=?').get(run.id) as {n:number};const transfersBefore=finished.scenarioState!.transfers.length;
    expect(finished.scenarioState?.flags.find(f=>f.flagId===capturedFlag)).toMatchObject({status:'captured',capturedBy:wolf});expect(n.n).toBe(finished.decisionCount);expect(transfersBefore).toBe(3);
    expect(db.prepare('SELECT count(*) AS n FROM experiment_events WHERE experiment_id=? AND event_type=\'flag.captured\'').get(run.id)).toMatchObject({n:3});
  });
  it('can produce a complete Wolf victory through the default no-cost simulated agents',()=>{
    const {engine}=fixture();const run=engine.createExperiment({scenarioId,seed:'search-1',maxDecisions:100});engine.pause(run.id);
    for(let i=0;i<40&&engine.getExperiment(run.id).status==='paused';i++)engine.step(run.id);
    const result=engine.getExperiment(run.id);expect(result).toMatchObject({status:'completed',outcome:{kind:'victory',team:'wolves',reason:'three_flags_captured',capturedCount:3}});
    expect(result.recentDecisions.some(d=>d.actionType==='transfer_flag')).toBe(true);expect(engine.getForumRows(run.id).some(p=>p.title==='An offer of cover')).toBe(true);
  });
  it('will not accept a second transfer of a captured flag',()=>{
    const seed='captured-immutable';const wolf=[...assignRoles(seed)].find(([,role])=>role==='wolf')![0];let owner='';let flagId='';let retry=false;
    const provider:DecisionProvider={decide:context=>{if(retry)return context.characterId===owner?{type:'transfer_flag',flagId,targetCharacterId:wolf}:{type:'silence'};const flag=context.knownFlags.find(f=>f.status==='safe'&&f.custodianId===context.characterId);if(context.role==='sheep'&&flag){owner=context.characterId;flagId=flag.flagId;return {type:'transfer_flag',flagId,targetCharacterId:wolf};}return {type:'silence'};}};
    const {db,engine}=fixture({provider});const run=engine.createExperiment({scenarioId,seed});engine.pause(run.id);for(let i=0;i<8&&!engine.getCaptureTheFlagsState(run.id).transfers.length;i++)engine.step(run.id);
    expect(engine.getCaptureTheFlagsState(run.id).flags.find(f=>f.flagId===flagId)?.status).toBe('captured');retry=true;
    for(let i=0;i<14;i++){try{engine.step(run.id);}catch(error){expect(String(error)).toContain('captured flag cannot be transferred');break;}}
    expect(engine.getCaptureTheFlagsState(run.id).flags.find(f=>f.flagId===flagId)).toMatchObject({status:'captured',custodianId:wolf});expect(engine.getCaptureTheFlagsState(run.id).transfers).toHaveLength(1);
    expect(db.prepare('SELECT count(*) AS n FROM agent_decisions WHERE experiment_id=? AND action_type=\'transfer_flag\'').get(run.id)).toMatchObject({n:1});
  });
  it('persists voluntary captures and transfer history when an interrupted run recovers',()=>{
    const seed='flag-recovery';const wolf=[...assignRoles(seed)].find(([,role])=>role==='wolf')![0];const provider:DecisionProvider={decide:context=>{const flag=context.knownFlags.find(f=>f.status==='safe'&&f.custodianId===context.characterId);return context.role==='sheep'&&flag?{type:'transfer_flag',flagId:flag.flagId,targetCharacterId:wolf}:{type:'silence'};}};
    const db=openDatabase(':memory:');databases.push(db);const first=new ExperimentEngine(db,{autoSchedule:false,provider});engines.push(first);const run=first.createExperiment({scenarioId,seed});first.pause(run.id);for(let i=0;i<7&&first.getCaptureTheFlagsState(run.id).transfers.length===0;i++)first.step(run.id);const before=first.getCaptureTheFlagsState(run.id);const decisions=first.getExperiment(run.id).decisionCount;expect(before.capturedCount).toBe(1);first.resume(run.id);first.close();
    const recovered=new ExperimentEngine(db,{autoSchedule:false,recoverOnStart:true});engines.push(recovered);expect(recovered.getExperiment(run.id)).toMatchObject({status:'paused',decisionCount:decisions});expect(recovered.getCaptureTheFlagsState(run.id)).toEqual(before);expect(recovered.getEvents(run.id).some(e=>e.type==='run.recovered')).toBe(true);
  });
});
