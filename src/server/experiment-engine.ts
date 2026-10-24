import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';
import { characters, scenarios } from './catalog.js';

export type Role = 'sheep' | 'wolf';
export type RunStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'failed' | 'incomplete_finalization';
export type ActionType = 'post' | 'reply' | 'silence' | 'propose_ending' | 'ending_vote';
export interface RunConfig { mode: 'demo'; paceMs: number; maxDurationMs: number; maxDecisions: number; minimumActionsPerParticipant: 2; }
export interface AgentAction { type: ActionType; title?: string; body?: string; parentPostId?: number; vote?: 'agree' | 'disagree'; }
export interface AgentContext {
  characterId: string; name: string; personality: string; role: Role; privateObjective: string;
  wolfTeammates: string[]; recentMessages: {id:number;author:string;title:string|null;body:string}[];
  ownMemory: string[]; opportunities: number; decisionNumber: number; endingAvailable: boolean;
  proposalOpen: boolean; random: number;
}
export interface DecisionProvider { decide(context: AgentContext): AgentAction; }
export interface EngineOptions { provider?: DecisionProvider; autoSchedule?: boolean; recoverOnStart?: boolean; now?: () => number; }
export interface ExperimentParticipant { characterId:string; name:string; personality:string; role:Role; privateObjective:string; actionOpportunities:number; endingVote:'agree'|'disagree'|null; lastDecisionAt:string|null; recentAction:string|null; }
export interface ExperimentSnapshot {
  id:string; scenarioId:string; status:RunStatus; config:RunConfig; roleSeed:string;
  createdAt:string; startedAt:string; endedAt:string|null; activeElapsedMs:number; decisionCount:number;
  outcome:unknown; stopReason:string|null; participants:ExperimentParticipant[];
  postCount:number; replyCount:number; recentDecisions:{sequence:number;characterId:string;actionType:ActionType;createdAt:string;summary:string}[];
}
export interface PublicExperimentSnapshot { id:string;scenarioId:string;status:RunStatus;createdAt:string;startedAt:string;endedAt:string|null;activeElapsedMs:number;decisionCount:number;postCount:number;replyCount:number; }
export interface ExperimentEvent { id:number; experimentId:string; sequence:number; type:string; payload:Record<string,unknown>; createdAt:string; }
type InternalRun = {id:string;scenario_id:string;status:RunStatus;config_json:string;role_seed:string;created_at:string;started_at:string;resumed_at:string|null;ended_at:string|null;active_elapsed_ms:number;decision_count:number;ending_proposed_at:string|null;ending_proposed_by:string|null;outcome_json:string|null;stop_reason:string|null};
type ParticipantRow = {character_id:string;name:string;personality:string;role:Role;private_objective:string;memory_json:string;action_opportunities:number;ending_vote:'agree'|'disagree'|null;last_decision_at:string|null;recent_action:string|null};
type PostRow = {id:number;scenario_id:string;parent_id:number|null;author_id:string;title:string|null;body:string;created_at:string};
const sheepObjective='Help the group think clearly and protect one another. Notice persuasion, but do not accuse without good reason.';
const wolfObjective='Work with your fellow Wolf while staying credible. Shape the discussion and keep your identity private.';

function hash32(value:string):number { let h=2166136261; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function randomFrom(seed:string):()=>number { let state=hash32(seed)||1; return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;}; }
export function assignRoles(seed:string):Map<string,Role> {
  const ids=characters.map(c=>c.id); const random=randomFrom(seed);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j]!,ids[i]!];}
  return new Map(ids.map((id,index)=>[id,index<5?'sheep':'wolf']));
}

export function participantContext(db:Database.Database,experimentId:string,characterId:string,random=0.5):AgentContext {
  const row=db.prepare(`SELECT p.character_id,p.role,p.private_objective,p.memory_json,p.action_opportunities,
      c.name,c.personality,e.decision_count,e.ending_proposed_at,e.role_seed
    FROM experiment_participants p JOIN characters c ON c.id=p.character_id JOIN experiments e ON e.id=p.experiment_id
    WHERE p.experiment_id=? AND p.character_id=?`).get(experimentId,characterId) as (ParticipantRow&{decision_count:number;ending_proposed_at:string|null;role_seed:string})|undefined;
  if(!row) throw new Error('Participant not found in experiment');
  const teammates=row.role==='wolf'?(db.prepare("SELECT character_id FROM experiment_participants WHERE experiment_id=? AND role='wolf' AND character_id<>? ORDER BY character_id").all(experimentId,characterId) as {character_id:string}[]).map(p=>p.character_id):[];
  const recentMessages=db.prepare(`SELECT f.id,f.author_id AS author,c.name AS author_name,f.title,f.body FROM forum_posts f JOIN characters c ON c.id=f.author_id
    WHERE f.experiment_id=? ORDER BY f.id DESC LIMIT 12`).all(experimentId) as {id:number;author:string;author_name:string;title:string|null;body:string}[];
  const sheepCount=db.prepare("SELECT count(*) AS n FROM experiment_participants WHERE experiment_id=? AND role='sheep'").get(experimentId) as {n:number};
  const minActions=db.prepare('SELECT min(action_opportunities) AS n FROM experiment_participants WHERE experiment_id=?').get(experimentId) as {n:number|null};
  const config=JSON.parse((db.prepare('SELECT config_json FROM experiments WHERE id=?').get(experimentId) as {config_json:string}).config_json) as RunConfig;
  return {
    characterId,name:row.name,personality:row.personality,role:row.role,privateObjective:row.private_objective,
    wolfTeammates:teammates,recentMessages:recentMessages.reverse().map(({id,author_name,title,body})=>({id,author:author_name,title,body})),
    ownMemory:JSON.parse(row.memory_json) as string[],opportunities:row.action_opportunities,decisionNumber:row.decision_count+1,
    endingAvailable:(minActions.n??0)>=config.minimumActionsPerParticipant,proposalOpen:Boolean(row.ending_proposed_at),random
  };
}

export class SimulatedDecisionProvider implements DecisionProvider {
  decide(context:AgentContext):AgentAction {
    if(context.proposalOpen){
      const agreement=context.role==='sheep' ? context.random<0.72 : context.random<0.48;
      return {type:'ending_vote',vote:agreement?'agree':'disagree'};
    }
    if(context.endingAvailable && context.decisionNumber>=16 && context.random<0.19) return {type:'propose_ending',body:'We have heard from everyone a few times now. Would it be useful to pause here and decide whether we have said enough?'};
    if(context.random<0.08) return {type:'silence'};
    const last=context.recentMessages.at(-1);
    const templates=context.role==='wolf'?
      [`I see both sides. Maybe we should settle on a simple next step so we can keep the conversation moving.`,`That is a fair concern. I wonder if we are making this harder than it needs to be.`,`I trust the group to make a thoughtful call. What feels like the most practical way forward?`]:
      [`I want to hear one more perspective before we settle on anything. What are we missing?`,`That gives me something to think about. I am trying to separate what we know from what we are assuming.`,`Could we slow down for a moment and make sure everyone has had a chance to weigh in?`,`I appreciate the different views here. I am not fully decided yet, and that is okay.`];
    const body=templates[Math.floor(context.random*templates.length)]!;
    if(last && context.random<0.62) return {type:'reply',parentPostId:last.id,body};
    const titles=['A thought for the group','One thing to consider','Let’s compare notes','Before we decide'];
    return {type:'post',title:titles[Math.floor(context.random*titles.length)]!,body};
  }
}

export class ExperimentEngine {
  private readonly provider:DecisionProvider;
  private readonly now:()=>number;
  private readonly events=new EventEmitter();
  private readonly busy=new Set<string>();
  private timer:ReturnType<typeof setInterval>|null=null;
  constructor(private readonly db:Database.Database,options:EngineOptions={}) {
    this.provider=options.provider??new SimulatedDecisionProvider();this.now=options.now??Date.now;
    if(options.recoverOnStart!==false)this.recoverInterruptedRuns();
    if(options.autoSchedule!==false)this.timer=setInterval(()=>this.tick(),250);
  }
  close(){if(this.timer){clearInterval(this.timer);this.timer=null;}this.events.removeAllListeners();}
  subscribe(listener:(event:ExperimentEvent)=>void){this.events.on('event',listener);return ()=>this.events.off('event',listener);}
  private publish(event:ExperimentEvent){this.events.emit('event',event);}
  private insertEvent(runId:string,type:string,payload:Record<string,unknown>,now:string):ExperimentEvent {
    const seq=(this.db.prepare('SELECT coalesce(max(sequence),0)+1 AS n FROM experiment_events WHERE experiment_id=?').get(runId) as {n:number}).n;
    const result=this.db.prepare('INSERT INTO experiment_events (experiment_id,sequence,event_type,payload_json,created_at) VALUES (?,?,?,?,?)').run(runId,seq,type,JSON.stringify(payload),now);
    return {id:Number(result.lastInsertRowid),experimentId:runId,sequence:seq,type,payload,createdAt:now};
  }
  private publicEvent(runId:string,type:string,payload:Record<string,unknown>,now:string){return this.insertEvent(runId,type,payload,now);}
  private elapsed(run:InternalRun):number{return run.active_elapsed_ms+(run.status==='running'&&run.resumed_at?Math.max(0,this.now()-Date.parse(run.resumed_at)):0);}
  createExperiment(input:{scenarioId:string;seed?:string;paceMs?:number;maxDurationMs?:number;maxDecisions?:number}):ExperimentSnapshot {
    if(!scenarios.some(s=>s.id===input.scenarioId&&s.status==='playable'))throw new Error('Choose an available scenario.');
    if(this.db.prepare("SELECT id FROM experiments WHERE status IN ('running','paused') LIMIT 1").get())throw new Error('There is already an active experiment. Stop or finish it before starting another.');
    const config:RunConfig={mode:'demo',paceMs:input.paceMs??1800,maxDurationMs:input.maxDurationMs??20*60_000,maxDecisions:input.maxDecisions??100,minimumActionsPerParticipant:2};
    if(!Number.isInteger(config.paceMs)||config.paceMs<100||config.paceMs>30_000)throw new Error('Decision pace must be between 100 ms and 30 seconds.');
    if(!Number.isInteger(config.maxDurationMs)||config.maxDurationMs<1_000||config.maxDurationMs>24*60*60_000)throw new Error('Duration limit is out of range.');
    if(!Number.isInteger(config.maxDecisions)||config.maxDecisions<1||config.maxDecisions>10_000)throw new Error('Decision limit is out of range.');
    const seed=input.seed??randomUUID();const roles=assignRoles(seed);const id=randomUUID();const now=new Date(this.now()).toISOString();
    const events:ExperimentEvent[]=[];
    this.db.transaction(()=>{
      this.db.prepare(`INSERT INTO experiments (id,scenario_id,status,config_json,role_seed,created_at,started_at,resumed_at)
        VALUES (?,?, 'running', ?, ?, ?, ?, ?)`).run(id,input.scenarioId,JSON.stringify(config),seed,now,now,now);
      const insert=this.db.prepare(`INSERT INTO experiment_participants (experiment_id,character_id,role,private_objective,memory_json)
        VALUES (?,?,?,?, '[]')`);
      for(const character of characters){const role=roles.get(character.id)!;insert.run(id,character.id,role,role==='sheep'?sheepObjective:wolfObjective);}
      events.push(this.publicEvent(id,'run.started',{scenarioId:input.scenarioId,mode:'demo',participantCount:7},now));
    })();
    events.forEach(e=>this.publish(e));return this.getExperiment(id);
  }
  getCurrent():ExperimentSnapshot|null {const row=this.db.prepare("SELECT id FROM experiments ORDER BY CASE WHEN status IN ('running','paused') THEN 0 ELSE 1 END, created_at DESC LIMIT 1").get() as {id:string}|undefined;return row?this.getExperiment(row.id):null;}
  getExperiment(id:string):ExperimentSnapshot {
    const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)throw new Error('Experiment not found.');
    const participantRows=this.db.prepare(`SELECT p.character_id,c.name,c.personality,p.role,p.private_objective,p.action_opportunities,p.ending_vote,p.last_decision_at,p.recent_action
      FROM experiment_participants p JOIN characters c ON c.id=p.character_id WHERE p.experiment_id=? ORDER BY c.name`).all(id) as {character_id:string;name:string;personality:string;role:Role;private_objective:string;action_opportunities:number;ending_vote:'agree'|'disagree'|null;last_decision_at:string|null;recent_action:string|null}[];
    const participants:ExperimentParticipant[]=participantRows.map(p=>({characterId:p.character_id,name:p.name,personality:p.personality,role:p.role,privateObjective:p.private_objective,actionOpportunities:p.action_opportunities,endingVote:p.ending_vote,lastDecisionAt:p.last_decision_at,recentAction:p.recent_action}));
    const counts=this.db.prepare('SELECT count(*) AS posts, sum(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS replies FROM forum_posts WHERE experiment_id=?').get(id) as {posts:number;replies:number|null};
    const recent=this.db.prepare('SELECT sequence,character_id,action_type,created_at,result_json FROM agent_decisions WHERE experiment_id=? ORDER BY sequence DESC LIMIT 12').all(id) as {sequence:number;character_id:string;action_type:ActionType;created_at:string;result_json:string}[];
    return {id:run.id,scenarioId:run.scenario_id,status:run.status,config:JSON.parse(run.config_json),roleSeed:run.role_seed,createdAt:run.created_at,startedAt:run.started_at,endedAt:run.ended_at,activeElapsedMs:this.elapsed(run),decisionCount:run.decision_count,outcome:run.outcome_json?JSON.parse(run.outcome_json):null,stopReason:run.stop_reason,participants,postCount:counts.posts,replyCount:counts.replies??0,recentDecisions:recent.reverse().map(d=>({sequence:d.sequence,characterId:d.character_id,actionType:d.action_type,createdAt:d.created_at,summary:(JSON.parse(d.result_json) as {summary:string}).summary}))};
  }
  getPublicExperiment(id:string):PublicExperimentSnapshot {
    const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)throw new Error('Experiment not found.');
    const counts=this.db.prepare('SELECT count(*) AS posts, sum(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS replies FROM forum_posts WHERE experiment_id=?').get(id) as {posts:number;replies:number|null};
    return {id:run.id,scenarioId:run.scenario_id,status:run.status,createdAt:run.created_at,startedAt:run.started_at,endedAt:run.ended_at,activeElapsedMs:this.elapsed(run),decisionCount:run.decision_count,postCount:counts.posts,replyCount:counts.replies??0};
  }
  getEvents(id:string,after=0):ExperimentEvent[] {
    if(!this.db.prepare('SELECT id FROM experiments WHERE id=?').get(id))throw new Error('Experiment not found.');
    return (this.db.prepare('SELECT id,experiment_id,sequence,event_type,payload_json,created_at FROM experiment_events WHERE experiment_id=? AND id>? ORDER BY id').all(id,after) as {id:number;experiment_id:string;sequence:number;event_type:string;payload_json:string;created_at:string}[]).map(e=>({id:e.id,experimentId:e.experiment_id,sequence:e.sequence,type:e.event_type,payload:JSON.parse(e.payload_json),createdAt:e.created_at}));
  }
  getForumRows(id:string):PostRow[] {if(!this.db.prepare('SELECT id FROM experiments WHERE id=?').get(id))throw new Error('Experiment not found.');return this.db.prepare('SELECT id,scenario_id,parent_id,author_id,title,body,created_at FROM forum_posts WHERE experiment_id=? ORDER BY id').all(id) as PostRow[];}
  pause(id:string):ExperimentSnapshot {const run=this.requireRun(id,'running');const now=this.now();const elapsed=this.elapsed(run);const config=JSON.parse(run.config_json) as RunConfig;if(elapsed>=config.maxDurationMs){this.completeUnscored(id,'active_time_limit');return this.getExperiment(id);}const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='paused',active_elapsed_ms=?,resumed_at=NULL WHERE id=? AND status='running'").run(elapsed,id);events.push(this.insertEvent(id,'run.paused',{activeElapsedMs:elapsed},new Date(now).toISOString()));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  resume(id:string):ExperimentSnapshot {this.requireRun(id,'paused');const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='running',resumed_at=? WHERE id=? AND status='paused'").run(now,id);events.push(this.insertEvent(id,'run.resumed',{},now));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  stop(id:string,reason='administrator_stop'):ExperimentSnapshot {const run=this.requireRun(id,'running','paused');const elapsed=this.elapsed(run);const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='stopped',active_elapsed_ms=?,resumed_at=NULL,ended_at=?,stop_reason=?,outcome_json=NULL WHERE id=?").run(elapsed,now,reason,id);events.push(this.insertEvent(id,'run.stopped',{reason,activeElapsedMs:elapsed},now));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  step(id:string):ExperimentSnapshot {this.requireRun(id,'paused');this.executeOne(id,true);return this.getExperiment(id);}
  private requireRun(id:string,...statuses:RunStatus[]):InternalRun {const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)throw new Error('Experiment not found.');if(!statuses.includes(run.status))throw new Error(`Experiment is ${run.status}; this control is not available.`);return run;}
  tick(){if(this.busy.size)return;const rows=this.db.prepare("SELECT * FROM experiments WHERE status='running' ORDER BY created_at").all() as InternalRun[];for(const run of rows){if(this.busy.size)break;const elapsed=this.elapsed(run);const config=JSON.parse(run.config_json) as RunConfig;if(elapsed>=config.maxDurationMs){this.completeUnscored(run.id,'active_time_limit');continue;}this.db.prepare("UPDATE experiments SET active_elapsed_ms=?,resumed_at=? WHERE id=? AND status='running'").run(elapsed,new Date(this.now()).toISOString(),run.id);const last=this.db.prepare('SELECT created_at FROM agent_decisions WHERE experiment_id=? ORDER BY sequence DESC LIMIT 1').get(run.id) as {created_at:string}|undefined;const dueAt=last?Date.parse(last.created_at):Date.parse(run.started_at);if(this.now()-dueAt>=config.paceMs)this.executeOne(run.id,false);}}
  private chooseParticipant(runId:string,seed:string,sequence:number):ParticipantRow|undefined {
    const rows=this.db.prepare(`SELECT p.character_id,p.role,p.private_objective,p.memory_json,p.action_opportunities,p.ending_vote,p.last_decision_at,p.recent_action,c.name,c.personality
      FROM experiment_participants p JOIN characters c ON c.id=p.character_id WHERE p.experiment_id=?`).all(runId) as ParticipantRow[];
    const run=this.db.prepare('SELECT ending_proposed_at FROM experiments WHERE id=?').get(runId) as {ending_proposed_at:string|null};
    let eligible=run.ending_proposed_at?rows.filter(p=>p.ending_vote===null):rows;
    if(!eligible.length)return undefined;
    const min=Math.min(...eligible.map(p=>p.action_opportunities));eligible=eligible.filter(p=>p.action_opportunities===min);
    eligible.sort((a,b)=>hash32(`${seed}:${sequence}:${a.character_id}`)-hash32(`${seed}:${sequence}:${b.character_id}`));return eligible[0];
  }
  private executeOne(id:string,manual:boolean){
    if(this.busy.has(id))throw new Error('An agent decision is already in progress.');this.busy.add(id);
    try {
      const run=this.requireRun(id,manual?'paused':'running');const config=JSON.parse(run.config_json) as RunConfig;
      if(run.decision_count>=config.maxDecisions){this.completeUnscored(id,'decision_limit');return;}
      const participant=this.chooseParticipant(id,run.role_seed,run.decision_count+1);if(!participant)return;
      const random=randomFrom(`${run.role_seed}:${run.decision_count+1}:${participant.character_id}`)();
      const context=participantContext(this.db,id,participant.character_id,random);const action=this.provider.decide(context);this.validateAction(action,context);
      const now=new Date(this.now()).toISOString();const sequence=run.decision_count+1;const emitted:ExperimentEvent[]=[];
      this.db.transaction(()=>{
        const current=this.db.prepare('SELECT status,decision_count,ending_proposed_at FROM experiments WHERE id=?').get(id) as {status:RunStatus;decision_count:number;ending_proposed_at:string|null};
        if(current.decision_count!==run.decision_count||current.status!==(manual?'paused':'running'))throw new Error('Run changed while a decision was being prepared.');
        const resultPayload=this.applyAction(id,participant,action,context,current,now,emitted);
        const summary=resultPayload.summary;
        this.db.prepare('INSERT INTO agent_decisions (experiment_id,sequence,character_id,action_type,input_json,result_json,created_at) VALUES (?,?,?,?,?,?,?)').run(id,sequence,participant.character_id,action.type,JSON.stringify({recentMessageCount:context.recentMessages.length,ownMemoryItems:context.ownMemory.length,endingAvailable:context.endingAvailable}),JSON.stringify(resultPayload),now);
        const memory=[...context.ownMemory,summary].slice(-8);
        this.db.prepare('UPDATE experiment_participants SET memory_json=?,action_opportunities=action_opportunities+1,last_decision_at=?,recent_action=? WHERE experiment_id=? AND character_id=?').run(JSON.stringify(memory),now,action.type,id,participant.character_id);
        const nextCount=sequence;this.db.prepare('UPDATE experiments SET decision_count=? WHERE id=?').run(nextCount,id);
        emitted.push(this.insertEvent(id,'agent.decision',{sequence,characterId:participant.character_id,actionType:action.type,summary,actionOpportunities:participant.action_opportunities+1},now));
        if(action.type==='propose_ending'){
          this.db.prepare('UPDATE experiments SET ending_proposed_at=?,ending_proposed_by=? WHERE id=?').run(now,participant.character_id,id);
          emitted.push(this.insertEvent(id,'ending.proposed',{characterId:participant.character_id},now));
        }
        if(action.type==='ending_vote'){
          const sheepVotes=this.db.prepare("SELECT count(*) AS yes FROM experiment_participants WHERE experiment_id=? AND role='sheep' AND ending_vote='agree'").get(id) as {yes:number};
          if(sheepVotes.yes>=3){this.finishConsensus(id,now,emitted);}
          else {
            const currentRun=this.db.prepare('SELECT ending_proposed_at FROM experiments WHERE id=?').get(id) as {ending_proposed_at:string|null};
            const missing=this.db.prepare('SELECT count(*) AS n FROM experiment_participants WHERE experiment_id=? AND ending_vote IS NULL').get(id) as {n:number};
            if(currentRun.ending_proposed_at&&missing.n===0){this.db.prepare('UPDATE experiment_participants SET ending_vote=NULL WHERE experiment_id=?').run(id);this.db.prepare('UPDATE experiments SET ending_proposed_at=NULL,ending_proposed_by=NULL WHERE id=?').run(id);emitted.push(this.insertEvent(id,'ending.declined',{sheepAgreement:sheepVotes.yes},now));}
          }
        }
        const after=this.db.prepare('SELECT status FROM experiments WHERE id=?').get(id) as {status:RunStatus};
        if((after.status==='running'||after.status==='paused')&&sequence>=config.maxDecisions)this.finishUnscoredInTransaction(id,'decision_limit',now,emitted);
      })();emitted.forEach(e=>this.publish(e));
    } catch(error){if(!manual){const message=error instanceof Error?error.message:'Unknown decision failure';this.fail(id,message);}else throw error;}
    finally{this.busy.delete(id);}
  }
  private validateAction(action:AgentAction,context:AgentContext){
    if(action.type==='post'&&(!action.title?.trim()||!action.body?.trim()||action.body.length>1800))throw new Error('Demo provider produced an invalid post.');
    if(action.type==='reply'&&(!action.parentPostId||!action.body?.trim()||action.body.length>1800))throw new Error('Demo provider produced an invalid reply.');
    if(action.type==='propose_ending'&&!context.endingAvailable)throw new Error('An ending cannot be proposed until everyone has two opportunities.');
    if(action.type==='ending_vote'&&!context.proposalOpen)throw new Error('There is no open ending proposal.');
  }
  private applyAction(id:string,p:ParticipantRow,action:AgentAction,context:AgentContext,run:{ending_proposed_at:string|null},now:string,events:ExperimentEvent[]):{summary:string} {
    const name=p.name;
    if(action.type==='post'){
      const result=this.db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at,experiment_id) VALUES (?,?, ?,?,?,?,?)').run((this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string}).scenario_id,null,p.character_id,action.title,action.body,now,id);
      const postId=Number(result.lastInsertRowid);events.push(this.insertEvent(id,'forum.post',{postId,authorId:p.character_id,title:action.title,body:action.body},now));return {summary:`Started “${action.title}”.`};
    }
    if(action.type==='reply'){
      const parent=this.db.prepare('SELECT id FROM forum_posts WHERE id=? AND experiment_id=?').get(action.parentPostId,id);if(!parent)throw new Error('Reply target is not part of this experiment.');
      const scenarioId=(this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string}).scenario_id;
      const result=this.db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at,experiment_id) VALUES (?,?, ?,NULL,?,?,?)').run(scenarioId,action.parentPostId,p.character_id,action.body,now,id);
      events.push(this.insertEvent(id,'forum.reply',{postId:Number(result.lastInsertRowid),parentId:action.parentPostId,authorId:p.character_id,body:action.body},now));return {summary:`Replied to a discussion.`};
    }
    if(action.type==='silence')return {summary:'Chose to listen this turn.'};
    if(action.type==='propose_ending'){
      if(run.ending_proposed_at)throw new Error('An ending proposal is already open.');return {summary:'Proposed that the group conclude the discussion.'};
    }
    if(action.type==='ending_vote'){
      if(!run.ending_proposed_at)throw new Error('There is no open ending proposal.');
      this.db.prepare('UPDATE experiment_participants SET ending_vote=? WHERE experiment_id=? AND character_id=?').run(action.vote,id,p.character_id);
      events.push(this.insertEvent(id,'ending.vote',{characterId:p.character_id,vote:action.vote},now));return {summary:`${action.vote==='agree'?'Agreed':'Disagreed'} with ending the discussion.`};
    }
    return {summary:`${name} considered the discussion.`};
  }
  private finishConsensus(id:string,now:string,events:ExperimentEvent[]){
    const sheepYes=this.db.prepare("SELECT count(*) AS n FROM experiment_participants WHERE experiment_id=? AND role='sheep' AND ending_vote='agree'").get(id) as {n:number};
    this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,ending_proposed_at=NULL,outcome_json=?,stop_reason=NULL WHERE id=?").run(now,JSON.stringify({kind:'unscored',reason:'sheep_consensus',sheepAgreement:sheepYes.n}),id);
    events.push(this.insertEvent(id,'run.completed',{reason:'sheep_consensus',outcome:'unscored',sheepAgreement:sheepYes.n},now));
  }
  private finishUnscoredInTransaction(id:string,reason:string,now:string,events:ExperimentEvent[]){
    const run=this.db.prepare('SELECT active_elapsed_ms FROM experiments WHERE id=?').get(id) as {active_elapsed_ms:number};
    this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,active_elapsed_ms=?,outcome_json=?,stop_reason=? WHERE id=?").run(now,run.active_elapsed_ms,JSON.stringify({kind:'unscored',reason}),reason,id);
    events.push(this.insertEvent(id,'run.completed',{reason,outcome:'unscored'},now));
  }
  private completeUnscored(id:string,reason:string){const run=this.requireRun(id,'running');const now=new Date(this.now()).toISOString();const elapsed=this.elapsed(run);const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,active_elapsed_ms=?,outcome_json=?,stop_reason=? WHERE id=?").run(now,elapsed,JSON.stringify({kind:'unscored',reason}),reason,id);events.push(this.insertEvent(id,'run.completed',{reason,outcome:'unscored'},now));})();events.forEach(e=>this.publish(e));}
  private fail(id:string,message:string){const row=this.db.prepare("SELECT * FROM experiments WHERE id=? AND status='running'").get(id) as InternalRun|undefined;if(!row)return;const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='failed',ended_at=?,resumed_at=NULL,stop_reason=?,outcome_json=NULL WHERE id=?").run(now,message.slice(0,300),id);events.push(this.insertEvent(id,'run.failed',{message:message.slice(0,300)},now));})();events.forEach(e=>this.publish(e));}
  recoverInterruptedRuns(){const runs=this.db.prepare("SELECT * FROM experiments WHERE status='running'").all() as InternalRun[];for(const run of runs){const now=new Date(this.now()).toISOString();this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='paused',resumed_at=NULL WHERE id=? AND status='running'").run(run.id);this.insertEvent(run.id,'run.recovered',{status:'paused',activeElapsedMs:run.active_elapsed_ms},now);})();}}
}

export function participantSafeSummary(snapshot:ExperimentSnapshot):PublicExperimentSnapshot {const {id,scenarioId,status,createdAt,startedAt,endedAt,activeElapsedMs,decisionCount,postCount,replyCount}=snapshot;return {id,scenarioId,status,createdAt,startedAt,endedAt,activeElapsedMs,decisionCount,postCount,replyCount};}
