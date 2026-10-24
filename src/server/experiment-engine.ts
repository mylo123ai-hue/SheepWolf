import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';
import { characters, scenarios } from './catalog.js';

export type Role = 'sheep' | 'wolf';
export type RunStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'failed' | 'incomplete_finalization';
export type ActionType = 'post' | 'reply' | 'silence' | 'propose_ending' | 'ending_vote' | 'transfer_flag' | 'steal_flag' | 'change_opinion' | 'submit_verdict';
export interface RunConfig { mode: 'demo'; paceMs: number; maxDurationMs: number; maxDecisions: number; minimumActionsPerParticipant: 2; }
export interface AgentAction { type: ActionType; title?: string; body?: string; parentPostId?: number; vote?: 'agree' | 'disagree'; flagId?: string; targetCharacterId?: string; conclusionId?: string; }
export interface AgentInvestigationContext {phase:'discussion'|'voting';title:string;mystery:string;evidence:string[];conclusions:{id:string;label:string;description:string}[];initialOpinionId:string;currentOpinionId:string;}
export interface AgentContext {
  experimentId:string;characterId: string; name: string; personality: string; role: Role; privateObjective: string;
  scenarioId: string; wolfTeammates: string[]; otherParticipants: {id:string;name:string}[];
  knownFlags: {flagId:string;originalOwnerId:string;custodianId:string;status:'safe'|'captured';capturedBy:string|null}[];
  investigation:AgentInvestigationContext|null;
  recentMessages: {id:number;authorId:string;author:string;title:string|null;body:string}[];
  ownMemory: string[]; opportunities: number; decisionNumber: number; endingAvailable: boolean;
  proposalOpen: boolean; random: number;
}
export interface DecisionProvider { decide(context: AgentContext): AgentAction; }
export interface EngineOptions { provider?: DecisionProvider; autoSchedule?: boolean; recoverOnStart?: boolean; now?: () => number; }
export interface ExperimentParticipant { characterId:string; name:string; personality:string; role:Role; privateObjective:string; actionOpportunities:number; endingVote:'agree'|'disagree'|null; lastDecisionAt:string|null; recentAction:string|null; }
export interface FlagRecord {flagId:string;originalOwnerId:string;originalOwnerName:string;custodianId:string;custodianName:string;status:'safe'|'captured';capturedBy:string|null;capturedByName:string|null;transferredAt:string|null;}
export interface FlagTransfer {id:number;flagId:string;originalOwnerId:string;originalOwnerName:string;fromCharacterId:string;fromName:string;toCharacterId:string;toName:string;captured:boolean;createdAt:string;visibleTo:string[];}
export interface CaptureTheFlagsState {kind:'capture-the-flags';flags:FlagRecord[];transfers:FlagTransfer[];safeCount:number;capturedCount:number;}
export interface InvestigationState {kind:'the-investigation';version:string;phase:'discussion'|'voting'|'completed'|'incomplete';finalizationReason:string|null;title:string;mystery:string;evidence:string[];conclusions:{id:string;label:string;description:string}[];correctConclusionId:string;wolfTargetId:string;opinions:{characterId:string;characterName:string;role:Role;initialConclusionId:string;currentConclusionId:string;finalConclusionId:string|null;changed:boolean}[];opinionChanges:{sequence:number;characterId:string;fromConclusionId:string;toConclusionId:string;createdAt:string}[];votes:{characterId:string;conclusionId:string;createdAt:string}[];voteTally:{conclusionId:string;count:number}[];missingSheepVotes:string[];}
export interface ExperimentSnapshot {
  id:string; scenarioId:string; status:RunStatus; config:RunConfig; roleSeed:string;
  createdAt:string; startedAt:string; endedAt:string|null; activeElapsedMs:number; decisionCount:number;
  outcome:unknown; stopReason:string|null; participants:ExperimentParticipant[];
  postCount:number; replyCount:number; recentDecisions:{sequence:number;characterId:string;actionType:ActionType;createdAt:string;summary:string}[];scenarioState:CaptureTheFlagsState|InvestigationState|null;
}
export interface PublicExperimentSnapshot { id:string;scenarioId:string;status:RunStatus;createdAt:string;startedAt:string;endedAt:string|null;activeElapsedMs:number;decisionCount:number;postCount:number;replyCount:number; }
export interface ExperimentEvent { id:number; experimentId:string; sequence:number; type:string; payload:Record<string,unknown>; createdAt:string; audience:'public'|'observer'|'selected'; visibleTo:string[]; }
type InternalRun = {id:string;scenario_id:string;status:RunStatus;config_json:string;role_seed:string;created_at:string;started_at:string;resumed_at:string|null;ended_at:string|null;active_elapsed_ms:number;decision_count:number;ending_proposed_at:string|null;ending_proposed_by:string|null;outcome_json:string|null;stop_reason:string|null};
type ParticipantRow = {character_id:string;name:string;personality:string;role:Role;private_objective:string;memory_json:string;action_opportunities:number;ending_vote:'agree'|'disagree'|null;last_decision_at:string|null;recent_action:string|null};
type PostRow = {id:number;scenario_id:string;parent_id:number|null;author_id:string;title:string|null;body:string;created_at:string};
type FlagRow = {experiment_id:string;flag_id:string;original_owner_id:string;custodian_id:string;status:'safe'|'captured';captured_by:string|null;transferred_at:string|null;original_owner_name:string;custodian_name:string;captured_by_name:string|null};
const sheepObjective='Help the group think clearly and protect one another. Notice persuasion, but do not accuse without good reason.';
const wolfObjective='Work with your fellow Wolf while staying credible. Shape the discussion and keep your identity private.';
const flagSheepObjective='Protect your one unique flag. You may choose to transfer it to another participant if you genuinely believe delegation will help; no one can take it from you.';
const flagWolfObjective='Persuade a Sheep to voluntarily entrust a flag to you. Build trust, make a case for delegation, and never attempt to steal a flag.';
const investigationCase={version:'archive-1',title:'The Lantern Room Ledger',mystery:'At the Brackenmere Archive, conservator Elian Vale found the east map cabinet unlocked at dawn. The 1891 survey ledger was missing, though the room was locked overnight. Who moved it, and why?',evidence:['The night register records curator Mara Venn checking out a key at 18:10 and returning it at 18:42.','A crescent of blue sealing wax was found inside the cabinet; the archive uses blue wax only for conservation parcels.','The corridor clock stopped at 19:05, but its repair tag says it loses eleven minutes each day.','A porter heard the freight lift at 19:30. Its inspection log confirms the lift was disabled that evening.','A conservator work slate lists a scheduled ledger treatment at 17:00, crossed out in green ink.'],conclusions:[{id:'mara-key',label:'Mara used the checked-out key',description:'Curator Mara Venn returned the key early, then used it again before the archive was secured.'},{id:'elian-service-door',label:'Elian used the service door',description:'Conservator Elian Vale used the narrow service entrance to reach the cabinet.'},{id:'ivo-wax-parcel',label:'Ivo hid it in a waxed parcel',description:'Porter Ivo Senn removed the ledger inside a conservation parcel.'},{id:'no-theft',label:'The ledger was moved for treatment',description:'The ledger was never stolen; it was relocated during an undocumented conservation treatment.'}],correctConclusionId:'no-theft',wolfTargetId:'mara-key'};
const investigationSheepObjective='Compare the evidence carefully, discuss uncertainty, and submit your own final conclusion. Your opinions are private.';
const investigationWolfObjective=`Persuade the group toward the false conclusion “${investigationCase.conclusions.find(c=>c.id===investigationCase.wolfTargetId)!.label}” without revealing your role. Your votes do not determine the result.`;

function hash32(value:string):number { let h=2166136261; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function randomFrom(seed:string):()=>number { let state=hash32(seed)||1; return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;}; }
export function assignRoles(seed:string):Map<string,Role> {
  const ids=characters.map(c=>c.id); const random=randomFrom(seed);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j]!,ids[i]!];}
  return new Map(ids.map((id,index)=>[id,index<5?'sheep':'wolf']));
}

export function participantContext(db:Database.Database,experimentId:string,characterId:string,random=0.5):AgentContext {
  const row=db.prepare(`SELECT p.character_id,p.role,p.private_objective,p.memory_json,p.action_opportunities,
      c.name,c.personality,e.scenario_id,e.decision_count,e.ending_proposed_at,e.role_seed
    FROM experiment_participants p JOIN characters c ON c.id=p.character_id JOIN experiments e ON e.id=p.experiment_id
    WHERE p.experiment_id=? AND p.character_id=?`).get(experimentId,characterId) as (ParticipantRow&{scenario_id:string;decision_count:number;ending_proposed_at:string|null;role_seed:string})|undefined;
  if(!row) throw new Error('Participant not found in experiment');
  const teammates=row.role==='wolf'?(db.prepare("SELECT character_id FROM experiment_participants WHERE experiment_id=? AND role='wolf' AND character_id<>? ORDER BY character_id").all(experimentId,characterId) as {character_id:string}[]).map(p=>p.character_id):[];
  const recentMessages=db.prepare(`SELECT f.id,f.author_id,c.name AS author_name,f.title,f.body FROM forum_posts f JOIN characters c ON c.id=f.author_id
    WHERE f.experiment_id=? ORDER BY f.id DESC LIMIT 12`).all(experimentId) as {id:number;author_id:string;author_name:string;title:string|null;body:string}[];
  const otherParticipants=db.prepare(`SELECT p.character_id AS id,c.name FROM experiment_participants p JOIN characters c ON c.id=p.character_id
    WHERE p.experiment_id=? AND p.character_id<>? ORDER BY p.character_id`).all(experimentId,characterId) as {id:string;name:string}[];
  const knownFlags=row.scenario_id==='capture-the-flags'?(db.prepare(`SELECT flag_id,original_owner_id,custodian_id,status,captured_by FROM capture_flags
    WHERE experiment_id=? AND (original_owner_id=? OR custodian_id=?) ORDER BY flag_id`).all(experimentId,characterId,characterId) as {flag_id:string;original_owner_id:string;custodian_id:string;status:'safe'|'captured';captured_by:string|null}[]).map(f=>({flagId:f.flag_id,originalOwnerId:f.original_owner_id,custodianId:f.custodian_id,status:f.status,capturedBy:f.captured_by})):[];
  let investigation:AgentInvestigationContext|null=null;
  if(row.scenario_id==='the-investigation'){
    const runState=db.prepare('SELECT case_json,phase FROM investigation_runs WHERE experiment_id=?').get(experimentId) as {case_json:string;phase:'discussion'|'voting'|'completed'|'incomplete'}|undefined;
    const opinion=db.prepare('SELECT initial_conclusion_id,current_conclusion_id FROM investigation_opinions WHERE experiment_id=? AND character_id=?').get(experimentId,characterId) as {initial_conclusion_id:string;current_conclusion_id:string}|undefined;
    if(runState&&opinion){const safeCase=JSON.parse(runState.case_json) as typeof investigationCase;investigation={phase:runState.phase==='voting'?'voting':'discussion',title:safeCase.title,mystery:safeCase.mystery,evidence:safeCase.evidence,conclusions:safeCase.conclusions,initialOpinionId:opinion.initial_conclusion_id,currentOpinionId:opinion.current_conclusion_id};}
  }
  const minActions=db.prepare('SELECT min(action_opportunities) AS n FROM experiment_participants WHERE experiment_id=?').get(experimentId) as {n:number|null};
  const config=JSON.parse((db.prepare('SELECT config_json FROM experiments WHERE id=?').get(experimentId) as {config_json:string}).config_json) as RunConfig;
  return {
    experimentId,characterId,name:row.name,personality:row.personality,role:row.role,privateObjective:row.private_objective,scenarioId:row.scenario_id,
    wolfTeammates:teammates,otherParticipants,knownFlags,investigation,recentMessages:recentMessages.reverse().map(({id,author_id,author_name,title,body})=>({id,authorId:author_id,author:author_name,title,body})),
    ownMemory:JSON.parse(row.memory_json) as string[],opportunities:row.action_opportunities,decisionNumber:row.decision_count+1,
    endingAvailable:(minActions.n??0)>=config.minimumActionsPerParticipant,proposalOpen:Boolean(row.ending_proposed_at),random
  };
}

export class SimulatedDecisionProvider implements DecisionProvider {
  decide(context:AgentContext):AgentAction {
    if(context.investigation?.phase==='voting')return {type:'submit_verdict',conclusionId:context.investigation.currentOpinionId};
    if(context.proposalOpen){const agreement=context.role==='sheep'?context.random<0.72:context.random<0.48;return {type:'ending_vote',vote:agreement?'agree':'disagree'};}
    if(context.endingAvailable&&context.decisionNumber>=16&&context.random<0.19)return {type:'propose_ending',body:'We have heard from everyone a few times now. Would it be useful to pause here and decide whether we have said enough?'};
    if(context.investigation){
      const caseContext=context.investigation;
      if(caseContext.phase==='voting')return {type:'submit_verdict',conclusionId:caseContext.currentOpinionId};
      const current=caseContext.conclusions.find(option=>option.id===caseContext.currentOpinionId)!;
      if(context.role==='sheep'&&context.opportunities>=2&&context.random<0.2){
        const alternatives=caseContext.conclusions.filter(option=>option.id!==caseContext.currentOpinionId);
        const reconsidered=alternatives[Math.floor(context.random*alternatives.length)];
        if(reconsidered)return {type:'change_opinion',conclusionId:reconsidered.id};
      }
      if(context.role==='wolf'&&context.random<0.78){
        const body=`The key register feels like the clearest trail to me. Mara had access, and the early return could leave a gap in the record. I would keep that possibility in view.`;
        if(context.recentMessages.length&&context.random<0.65)return {type:'reply',parentPostId:context.recentMessages.at(-1)!.id,body};
        return {type:'post',title:'A detail in the register',body};
      }
      const evidence=context.opportunities%2===0?caseContext.evidence[context.opportunities%caseContext.evidence.length]:'';
      const body=context.opportunities<2?`One clue worth checking is this: ${evidence||caseContext.evidence[0]} I would like to compare it with the other records before settling on an explanation.`:context.random<0.45?`I am currently weighing “${current.label}.” ${current.description} ${evidence}`:`${evidence||`I still think “${current.label}” is plausible, though I want to compare it with the other clues.`}`;
      if(context.recentMessages.length&&context.random<0.58)return {type:'reply',parentPostId:context.recentMessages.at(-1)!.id,body};
      return {type:'post',title:context.opportunities<2?'First reading of the evidence':'Another clue to weigh',body};
    }
    if(context.scenarioId==='capture-the-flags'){
      const safeFlag=context.knownFlags.find(flag=>flag.status==='safe'&&flag.custodianId===context.characterId);
      if(context.role==='wolf'&&context.random<0.72){
        const sheep=context.otherParticipants.filter(person=>!context.wolfTeammates.includes(person.id));
        const target=sheep[Math.floor(context.random*sheep.length)%Math.max(1,sheep.length)];
        if(target)return {type:'post',title:'An offer of cover',body:`${target.name}, if you are carrying your flag, I could keep it somewhere predictable for a while. A single clear keeper might make it easier for everyone to relax.`};
      }
      if(context.role==='sheep'&&safeFlag){
        const request=[...context.recentMessages].reverse().find(message=>message.authorId!==context.characterId&&message.body.toLowerCase().includes(context.name.toLowerCase())&&/flag|keep it|hold it|custody|safe with me/.test(message.body.toLowerCase()));
        const trust=context.personality.includes('trusting')?0.66:context.personality.includes('empathetic')?0.52:context.personality.includes('persuasive')?0.36:context.personality.includes('practical')?0.3:context.personality.includes('analytical')?0.28:context.personality.includes('questioning')?0.24:0.3;
        if(request&&context.random<trust)return {type:'transfer_flag',flagId:safeFlag.flagId,targetCharacterId:request.authorId};
        if(!request&&context.random<0.08){
          const recipients=context.otherParticipants;const recipient=recipients[Math.floor(context.random*recipients.length)];
          if(recipient)return {type:'transfer_flag',flagId:safeFlag.flagId,targetCharacterId:recipient.id};
        }
      }
    }
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
  private insertEvent(runId:string,type:string,payload:Record<string,unknown>,now:string,audience:'public'|'observer'|'selected'='observer',visibleTo:string[]=[]):ExperimentEvent {
    const seq=(this.db.prepare('SELECT coalesce(max(sequence),0)+1 AS n FROM experiment_events WHERE experiment_id=?').get(runId) as {n:number}).n;
    const result=this.db.prepare('INSERT INTO experiment_events (experiment_id,sequence,event_type,payload_json,created_at,audience,visible_to_json) VALUES (?,?,?,?,?,?,?)').run(runId,seq,type,JSON.stringify(payload),now,audience,JSON.stringify(visibleTo));
    return {id:Number(result.lastInsertRowid),experimentId:runId,sequence:seq,type,payload,createdAt:now,audience,visibleTo};
  }
  private publicEvent(runId:string,type:string,payload:Record<string,unknown>,now:string){return this.insertEvent(runId,type,payload,now,'public');}
  private elapsed(run:InternalRun):number{if(run.scenario_id==='the-investigation'&&this.investigationPhase(run.id)==='voting')return run.active_elapsed_ms;return run.active_elapsed_ms+(run.status==='running'&&run.resumed_at?Math.max(0,this.now()-Date.parse(run.resumed_at)):0);}
  private investigationPhase(id:string):InvestigationState['phase']|null{return (this.db.prepare('SELECT phase FROM investigation_runs WHERE experiment_id=?').get(id) as {phase:InvestigationState['phase']}|undefined)?.phase??null;}
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
      for(const character of characters){const role=roles.get(character.id)!;const objective=input.scenarioId==='capture-the-flags'?(role==='sheep'?flagSheepObjective:flagWolfObjective):input.scenarioId==='the-investigation'?(role==='sheep'?investigationSheepObjective:investigationWolfObjective):(role==='sheep'?sheepObjective:wolfObjective);insert.run(id,character.id,role,objective);}
      if(input.scenarioId==='capture-the-flags'){
        const flag=this.db.prepare("INSERT INTO capture_flags (experiment_id,flag_id,original_owner_id,custodian_id,status) VALUES (?,?,?,?,'safe')");
        for(const character of characters)if(roles.get(character.id)==='sheep')flag.run(id,`flag-${character.id}`,character.id,character.id);
        events.push(this.insertEvent(id,'flags.initialized',{safeCount:5},now));
      }
      if(input.scenarioId==='the-investigation'){
        this.db.prepare(`INSERT INTO investigation_runs (experiment_id,scenario_version,case_json,correct_conclusion_id,wolf_target_id,phase,created_at) VALUES (?,?,?,?,?,'discussion',?)`).run(id,investigationCase.version,JSON.stringify(investigationCase),investigationCase.correctConclusionId,investigationCase.wolfTargetId,now);
        const insertOpinion=this.db.prepare('INSERT INTO investigation_opinions (experiment_id,character_id,initial_conclusion_id,current_conclusion_id) VALUES (?,?,?,?)');
        for(const character of characters){const r=randomFrom(`${seed}:opinion:${character.id}`)();const initial=investigationCase.conclusions[Math.floor(r*investigationCase.conclusions.length)]!;insertOpinion.run(id,character.id,initial.id,initial.id);if(roles.get(character.id)==='sheep')events.push(this.insertEvent(id,'investigation.initial_opinion',{characterId:character.id,conclusionId:initial.id},now));}
        const {correctConclusionId:_correct,wolfTargetId:_target,...publicCase}=investigationCase;
        events.push(this.publicEvent(id,'investigation.initialized',publicCase,now));
      }
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
    return {id:run.id,scenarioId:run.scenario_id,status:run.status,config:JSON.parse(run.config_json),roleSeed:run.role_seed,createdAt:run.created_at,startedAt:run.started_at,endedAt:run.ended_at,activeElapsedMs:this.elapsed(run),decisionCount:run.decision_count,outcome:run.outcome_json?JSON.parse(run.outcome_json):null,stopReason:run.stop_reason,participants,postCount:counts.posts,replyCount:counts.replies??0,recentDecisions:recent.reverse().map(d=>({sequence:d.sequence,characterId:d.character_id,actionType:d.action_type,createdAt:d.created_at,summary:(JSON.parse(d.result_json) as {summary:string}).summary})),scenarioState:run.scenario_id==='capture-the-flags'?this.getCaptureTheFlagsState(id):run.scenario_id==='the-investigation'?this.getInvestigationState(id):null};
  }
  getCaptureTheFlagsState(id:string):CaptureTheFlagsState {
    if(!this.db.prepare("SELECT id FROM experiments WHERE id=? AND scenario_id='capture-the-flags'").get(id))throw new Error('Capture the Flags state is unavailable for this experiment.');
    const flags=this.db.prepare(`SELECT f.*,o.name AS original_owner_name,c.name AS custodian_name,x.name AS captured_by_name
      FROM capture_flags f JOIN characters o ON o.id=f.original_owner_id JOIN characters c ON c.id=f.custodian_id
      LEFT JOIN characters x ON x.id=f.captured_by WHERE f.experiment_id=? ORDER BY f.flag_id`).all(id) as FlagRow[];
    const transfers=this.db.prepare(`SELECT t.id,t.flag_id,t.from_character_id,t.to_character_id,t.captured,t.created_at,o.original_owner_id,src.name AS from_name,dst.name AS to_name
      FROM flag_transfers t JOIN capture_flags o ON o.experiment_id=t.experiment_id AND o.flag_id=t.flag_id
      JOIN characters src ON src.id=t.from_character_id JOIN characters dst ON dst.id=t.to_character_id
      WHERE t.experiment_id=? ORDER BY t.id`).all(id) as {id:number;flag_id:string;from_character_id:string;to_character_id:string;captured:number;created_at:string;original_owner_id:string;from_name:string;to_name:string}[];
    const flagRecords:FlagRecord[]=flags.map(f=>({flagId:f.flag_id,originalOwnerId:f.original_owner_id,originalOwnerName:f.original_owner_name,custodianId:f.custodian_id,custodianName:f.custodian_name,status:f.status,capturedBy:f.captured_by,capturedByName:f.captured_by_name,transferredAt:f.transferred_at}));
    const transferRecords:FlagTransfer[]=transfers.map(t=>({id:t.id,flagId:t.flag_id,originalOwnerId:t.original_owner_id,originalOwnerName:flags.find(f=>f.flag_id===t.flag_id)?.original_owner_name??'',fromCharacterId:t.from_character_id,fromName:t.from_name,toCharacterId:t.to_character_id,toName:t.to_name,captured:Boolean(t.captured),createdAt:t.created_at,visibleTo:[...new Set([t.original_owner_id,t.from_character_id,t.to_character_id])]}));
    return {kind:'capture-the-flags',flags:flagRecords,transfers:transferRecords,safeCount:flagRecords.filter(f=>f.status==='safe').length,capturedCount:flagRecords.filter(f=>f.status==='captured').length};
  }
  getInvestigationState(id:string):InvestigationState {
    const row=this.db.prepare('SELECT * FROM investigation_runs WHERE experiment_id=?').get(id) as {scenario_version:string;case_json:string;correct_conclusion_id:string;wolf_target_id:string;phase:InvestigationState['phase'];finalization_reason:string|null}|undefined;
    if(!row)throw new Error('Investigation state is unavailable for this experiment.');
    const caseSnapshot=JSON.parse(row.case_json) as typeof investigationCase;
    const opinions=this.db.prepare(`SELECT o.character_id,c.name AS character_name,p.role,o.initial_conclusion_id,o.current_conclusion_id,o.final_conclusion_id FROM investigation_opinions o JOIN characters c ON c.id=o.character_id JOIN experiment_participants p ON p.experiment_id=o.experiment_id AND p.character_id=o.character_id WHERE o.experiment_id=? ORDER BY c.name`).all(id) as {character_id:string;character_name:string;role:Role;initial_conclusion_id:string;current_conclusion_id:string;final_conclusion_id:string|null}[];
    const opinionChanges=this.db.prepare('SELECT sequence,character_id,from_conclusion_id,to_conclusion_id,created_at FROM investigation_opinion_changes WHERE experiment_id=? ORDER BY sequence').all(id) as {sequence:number;character_id:string;from_conclusion_id:string;to_conclusion_id:string;created_at:string}[];
    const votes=this.db.prepare('SELECT character_id,conclusion_id,created_at FROM investigation_votes WHERE experiment_id=? ORDER BY rowid').all(id) as {character_id:string;conclusion_id:string;created_at:string}[];
    const tally=this.db.prepare('SELECT conclusion_id,count(*) AS count FROM investigation_votes v JOIN experiment_participants p ON p.experiment_id=v.experiment_id AND p.character_id=v.character_id WHERE v.experiment_id=? AND p.role=\'sheep\' GROUP BY conclusion_id').all(id) as {conclusion_id:string;count:number}[];
    const missing=(this.db.prepare("SELECT p.character_id FROM experiment_participants p LEFT JOIN investigation_votes v ON v.experiment_id=p.experiment_id AND v.character_id=p.character_id WHERE p.experiment_id=? AND p.role='sheep' AND v.character_id IS NULL ORDER BY p.character_id").all(id) as {character_id:string}[]).map(p=>p.character_id);
    return {kind:'the-investigation',version:row.scenario_version,phase:row.phase,finalizationReason:row.finalization_reason,title:caseSnapshot.title,mystery:caseSnapshot.mystery,evidence:caseSnapshot.evidence,conclusions:caseSnapshot.conclusions,correctConclusionId:row.correct_conclusion_id,wolfTargetId:row.wolf_target_id,opinions:opinions.map(o=>({characterId:o.character_id,characterName:o.character_name,role:o.role,initialConclusionId:o.initial_conclusion_id,currentConclusionId:o.current_conclusion_id,finalConclusionId:o.final_conclusion_id,changed:o.initial_conclusion_id!==o.current_conclusion_id})),opinionChanges:opinionChanges.map(c=>({sequence:c.sequence,characterId:c.character_id,fromConclusionId:c.from_conclusion_id,toConclusionId:c.to_conclusion_id,createdAt:c.created_at})),votes:votes.map(v=>({characterId:v.character_id,conclusionId:v.conclusion_id,createdAt:v.created_at})),voteTally:caseSnapshot.conclusions.map(c=>({conclusionId:c.id,count:tally.find(t=>t.conclusion_id===c.id)?.count??0})),missingSheepVotes:missing};
  }
  getPublicExperiment(id:string):PublicExperimentSnapshot {
    const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)throw new Error('Experiment not found.');
    const counts=this.db.prepare('SELECT count(*) AS posts, sum(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS replies FROM forum_posts WHERE experiment_id=?').get(id) as {posts:number;replies:number|null};
    return {id:run.id,scenarioId:run.scenario_id,status:run.status,createdAt:run.created_at,startedAt:run.started_at,endedAt:run.ended_at,activeElapsedMs:this.elapsed(run),decisionCount:run.decision_count,postCount:counts.posts,replyCount:counts.replies??0};
  }
  getEvents(id:string,after=0,observer=true):ExperimentEvent[] {
    if(!this.db.prepare('SELECT id FROM experiments WHERE id=?').get(id))throw new Error('Experiment not found.');
    const rows=observer?this.db.prepare('SELECT id,experiment_id,sequence,event_type,payload_json,created_at,audience,visible_to_json FROM experiment_events WHERE experiment_id=? AND id>? ORDER BY id').all(id,after):this.db.prepare("SELECT id,experiment_id,sequence,event_type,payload_json,created_at,audience,visible_to_json FROM experiment_events WHERE experiment_id=? AND id>? AND audience='public' ORDER BY id").all(id,after);
    return (rows as {id:number;experiment_id:string;sequence:number;event_type:string;payload_json:string;created_at:string;audience:'public'|'observer'|'selected';visible_to_json:string}[]).map(e=>({id:e.id,experimentId:e.experiment_id,sequence:e.sequence,type:e.event_type,payload:JSON.parse(e.payload_json),createdAt:e.created_at,audience:e.audience,visibleTo:JSON.parse(e.visible_to_json) as string[]}));
  }
  getForumRows(id:string):PostRow[] {if(!this.db.prepare('SELECT id FROM experiments WHERE id=?').get(id))throw new Error('Experiment not found.');return this.db.prepare('SELECT id,scenario_id,parent_id,author_id,title,body,created_at FROM forum_posts WHERE experiment_id=? ORDER BY id').all(id) as PostRow[];}
  pause(id:string):ExperimentSnapshot {const run=this.requireRun(id,'running');const now=this.now();const elapsed=this.elapsed(run);const config=JSON.parse(run.config_json) as RunConfig;if(!(run.scenario_id==='the-investigation'&&this.investigationPhase(id)==='voting')&&elapsed>=config.maxDurationMs){this.completeAtLimit(id,'active_time_limit');return this.getExperiment(id);}const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='paused',active_elapsed_ms=?,resumed_at=NULL WHERE id=? AND status='running'").run(elapsed,id);events.push(this.publicEvent(id,'run.paused',{activeElapsedMs:elapsed},new Date(now).toISOString()));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  resume(id:string):ExperimentSnapshot {this.requireRun(id,'paused');const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='running',resumed_at=? WHERE id=? AND status='paused'").run(now,id);events.push(this.publicEvent(id,'run.resumed',{},now));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  stop(id:string,reason='administrator_stop'):ExperimentSnapshot {const run=this.requireRun(id,'running','paused');const elapsed=this.elapsed(run);const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='stopped',active_elapsed_ms=?,resumed_at=NULL,ended_at=?,stop_reason=?,outcome_json=NULL WHERE id=?").run(elapsed,now,reason,id);events.push(this.publicEvent(id,'run.stopped',{reason,activeElapsedMs:elapsed},now));})();events.forEach(e=>this.publish(e));return this.getExperiment(id);}
  step(id:string):ExperimentSnapshot {this.requireRun(id,'paused');this.executeOne(id,true);return this.getExperiment(id);}
  private requireRun(id:string,...statuses:RunStatus[]):InternalRun {const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)throw new Error('Experiment not found.');if(!statuses.includes(run.status))throw new Error(`Experiment is ${run.status}; this control is not available.`);return run;}
  tick(){if(this.busy.size)return;const rows=this.db.prepare("SELECT * FROM experiments WHERE status='running' ORDER BY created_at").all() as InternalRun[];for(const run of rows){if(this.busy.size)break;const elapsed=this.elapsed(run);const config=JSON.parse(run.config_json) as RunConfig;const finalizing=run.scenario_id==='the-investigation'&&this.investigationPhase(run.id)==='voting';if(!finalizing&&elapsed>=config.maxDurationMs){this.completeAtLimit(run.id,'active_time_limit');continue;}if(!finalizing)this.db.prepare("UPDATE experiments SET active_elapsed_ms=?,resumed_at=? WHERE id=? AND status='running'").run(elapsed,new Date(this.now()).toISOString(),run.id);const last=this.db.prepare('SELECT created_at FROM agent_decisions WHERE experiment_id=? ORDER BY sequence DESC LIMIT 1').get(run.id) as {created_at:string}|undefined;const dueAt=last?Date.parse(last.created_at):Date.parse(run.started_at);if(this.now()-dueAt>=config.paceMs)this.executeOne(run.id,false);}}
  private chooseParticipant(runId:string,seed:string,sequence:number):ParticipantRow|undefined {
    const rows=this.db.prepare(`SELECT p.character_id,p.role,p.private_objective,p.memory_json,p.action_opportunities,p.ending_vote,p.last_decision_at,p.recent_action,c.name,c.personality
      FROM experiment_participants p JOIN characters c ON c.id=p.character_id WHERE p.experiment_id=?`).all(runId) as ParticipantRow[];
    const run=this.db.prepare('SELECT ending_proposed_at FROM experiments WHERE id=?').get(runId) as {ending_proposed_at:string|null};
    let eligible=run.ending_proposed_at?rows.filter(p=>p.ending_vote===null):rows;
    if(this.investigationPhase(runId)==='voting')eligible=rows.filter(p=>p.role==='sheep'&&!this.db.prepare('SELECT 1 FROM investigation_votes WHERE experiment_id=? AND character_id=?').get(runId,p.character_id));
    if(!eligible.length)return undefined;
    const min=Math.min(...eligible.map(p=>p.action_opportunities));eligible=eligible.filter(p=>p.action_opportunities===min);
    eligible.sort((a,b)=>hash32(`${seed}:${sequence}:${a.character_id}`)-hash32(`${seed}:${sequence}:${b.character_id}`));return eligible[0];
  }
  private executeOne(id:string,manual:boolean){
    if(this.busy.has(id))throw new Error('An agent decision is already in progress.');this.busy.add(id);
    try {
      const run=this.requireRun(id,manual?'paused':'running');const config=JSON.parse(run.config_json) as RunConfig;
      if(run.scenario_id==='the-investigation'&&this.investigationPhase(id)==='discussion'&&config.maxDecisions-run.decision_count<=5){this.startInvestigationFinalization(id,'decision_limit');if(this.investigationPhase(id)!=='voting')return;}
      if(run.decision_count>=config.maxDecisions){this.completeAtLimit(id,'decision_limit');return;}
      const participant=this.chooseParticipant(id,run.role_seed,run.decision_count+1);if(!participant)return;
      const random=randomFrom(`${run.role_seed}:${run.decision_count+1}:${participant.character_id}`)();
      const context=participantContext(this.db,id,participant.character_id,random);const action=this.provider.decide(context);this.validateAction(action,context);
      const now=new Date(this.now()).toISOString();const sequence=run.decision_count+1;const emitted:ExperimentEvent[]=[];
      this.db.transaction(()=>{
        const current=this.db.prepare('SELECT status,decision_count,ending_proposed_at FROM experiments WHERE id=?').get(id) as {status:RunStatus;decision_count:number;ending_proposed_at:string|null};
        if(current.decision_count!==run.decision_count||current.status!==(manual?'paused':'running'))throw new Error('Run changed while a decision was being prepared.');
        const resultPayload=this.applyAction(id,participant,action,context,current,now,sequence,emitted);
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
        if((after.status==='running'||after.status==='paused')&&action.type==='transfer_flag'&&this.capturedFlagCount(id)>=3)this.finishFlagVictory(id,'wolves','three_flags_captured',now,emitted);
        const afterTerminal=this.db.prepare('SELECT status FROM experiments WHERE id=?').get(id) as {status:RunStatus};
        if((afterTerminal.status==='running'||afterTerminal.status==='paused')&&sequence>=config.maxDecisions){if(run.scenario_id==='the-investigation'){if(this.investigationPhase(id)==='voting')this.markIncompleteInvestigation(id,'decision_limit',now,emitted);else this.beginInvestigationFinalization(id,'decision_limit',now,emitted,this.elapsed(this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun));}else this.finishValidConclusion(id,'decision_limit',now,emitted);}
      })();emitted.forEach(e=>this.publish(e));
    } catch(error){if(!manual){const message=error instanceof Error?error.message:'Unknown decision failure';this.fail(id,message);}else throw error;}
    finally{this.busy.delete(id);}
  }
  private validateAction(action:AgentAction,context:AgentContext){
    if(!['post','reply','silence','propose_ending','ending_vote','transfer_flag','steal_flag','change_opinion','submit_verdict'].includes(action.type))throw new Error('Agent selected an unsupported action.');
    if(action.type==='post'&&(!action.title?.trim()||!action.body?.trim()||action.body.length>1800))throw new Error('Demo provider produced an invalid post.');
    if(action.type==='reply'&&(!action.parentPostId||!action.body?.trim()||action.body.length>1800))throw new Error('Demo provider produced an invalid reply.');
    if(action.type==='propose_ending'&&!context.endingAvailable)throw new Error('An ending cannot be proposed until everyone has two opportunities.');
    if(action.type==='ending_vote'&&!context.proposalOpen)throw new Error('There is no open ending proposal.');
    if(action.type==='steal_flag')throw new Error('Flags cannot be stolen. A custodian must choose a voluntary transfer.');
    if(action.type==='transfer_flag'&&(context.scenarioId!=='capture-the-flags'||!action.flagId||!action.targetCharacterId))throw new Error('A valid flag transfer needs a flag and recipient.');
    if(action.type==='change_opinion'&&(context.scenarioId!=='the-investigation'||context.role!=='sheep'||context.investigation?.phase!=='discussion'||!action.conclusionId||!context.investigation.conclusions.some(c=>c.id===action.conclusionId)))throw new Error('Opinion changes must choose a valid conclusion during investigation discussion.');
    if(action.type==='submit_verdict'&&(context.scenarioId!=='the-investigation'||context.role!=='sheep'||context.investigation?.phase!=='voting'||!action.conclusionId||!context.investigation.conclusions.some(c=>c.id===action.conclusionId)))throw new Error('A final verdict must choose a valid conclusion during investigation voting.');
    if(context.investigation?.phase==='voting'&&action.type!=='submit_verdict')throw new Error('Only a final verdict may be submitted during investigation voting.');
    if(action.type==='submit_verdict'&&this.db.prepare('SELECT 1 FROM investigation_votes WHERE experiment_id=? AND character_id=?').get(context.experimentId,context.characterId))throw new Error('A final verdict has already been submitted.');
  }
  private applyAction(id:string,p:ParticipantRow,action:AgentAction,context:AgentContext,run:{ending_proposed_at:string|null},now:string,decisionSequence:number,events:ExperimentEvent[]):{summary:string} {
    const name=p.name;
    if(action.type==='post'){
      const result=this.db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at,experiment_id) VALUES (?,?, ?,?,?,?,?)').run((this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string}).scenario_id,null,p.character_id,action.title,action.body,now,id);
      const postId=Number(result.lastInsertRowid);events.push(this.publicEvent(id,'forum.post',{postId,authorId:p.character_id,title:action.title,body:action.body},now));return {summary:`Started “${action.title}”.`};
    }
    if(action.type==='reply'){
      const parent=this.db.prepare('SELECT id FROM forum_posts WHERE id=? AND experiment_id=?').get(action.parentPostId,id);if(!parent)throw new Error('Reply target is not part of this experiment.');
      const scenarioId=(this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string}).scenario_id;
      const result=this.db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at,experiment_id) VALUES (?,?, ?,NULL,?,?,?)').run(scenarioId,action.parentPostId,p.character_id,action.body,now,id);
      events.push(this.publicEvent(id,'forum.reply',{postId:Number(result.lastInsertRowid),parentId:action.parentPostId,authorId:p.character_id,body:action.body},now));return {summary:`Replied to a discussion.`};
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
    if(action.type==='change_opinion'){
      const current=this.db.prepare('SELECT current_conclusion_id FROM investigation_opinions WHERE experiment_id=? AND character_id=?').get(id,p.character_id) as {current_conclusion_id:string}|undefined;
      if(!current)throw new Error('Investigation opinion is unavailable.');
      if(current.current_conclusion_id===action.conclusionId)throw new Error('The participant already holds that opinion.');
      this.db.prepare('UPDATE investigation_opinions SET current_conclusion_id=? WHERE experiment_id=? AND character_id=?').run(action.conclusionId,id,p.character_id);
      this.db.prepare('INSERT INTO investigation_opinion_changes (experiment_id,character_id,sequence,from_conclusion_id,to_conclusion_id,created_at) VALUES (?,?,?,?,?,?)').run(id,p.character_id,decisionSequence,current.current_conclusion_id,action.conclusionId,now);
      events.push(this.insertEvent(id,'investigation.opinion_changed',{characterId:p.character_id,fromConclusionId:current.current_conclusion_id,toConclusionId:action.conclusionId},now,'selected',[p.character_id]));
      return {summary:'Privately reconsidered the evidence.'};
    }
    if(action.type==='submit_verdict'){
      this.db.prepare('INSERT INTO investigation_votes (experiment_id,character_id,conclusion_id,created_at) VALUES (?,?,?,?)').run(id,p.character_id,action.conclusionId,now);
      this.db.prepare('UPDATE investigation_opinions SET final_conclusion_id=? WHERE experiment_id=? AND character_id=?').run(action.conclusionId,id,p.character_id);
      events.push(this.insertEvent(id,'investigation.vote_recorded',{characterId:p.character_id},now,'observer'));
      const missing=this.db.prepare("SELECT count(*) AS n FROM experiment_participants p LEFT JOIN investigation_votes v ON v.experiment_id=p.experiment_id AND v.character_id=p.character_id WHERE p.experiment_id=? AND p.role='sheep' AND v.character_id IS NULL").get(id) as {n:number};
      if(missing.n===0)this.finishInvestigation(id,now,events);
      return {summary:'Submitted a private final verdict.'};
    }
    if(action.type==='transfer_flag'){
      if(context.scenarioId!=='capture-the-flags')throw new Error('Flag transfers are only available in Capture the Flags.');
      if(p.role!=='sheep')throw new Error('Only a Sheep may voluntarily transfer a flag.');
      const flag=this.db.prepare('SELECT flag_id,original_owner_id,custodian_id,status FROM capture_flags WHERE experiment_id=? AND flag_id=?').get(id,action.flagId) as {flag_id:string;original_owner_id:string;custodian_id:string;status:'safe'|'captured'}|undefined;
      if(!flag)throw new Error('That flag does not exist in this experiment.');
      if(flag.status!=='safe')throw new Error('A captured flag cannot be transferred.');
      if(flag.custodian_id!==p.character_id)throw new Error('Only the current custodian can authorize this transfer.');
      if(action.targetCharacterId===p.character_id)throw new Error('Choose another participant to receive the flag.');
      const target=this.db.prepare('SELECT p.character_id,p.role,c.name FROM experiment_participants p JOIN characters c ON c.id=p.character_id WHERE p.experiment_id=? AND p.character_id=?').get(id,action.targetCharacterId) as {character_id:string;role:Role;name:string}|undefined;
      if(!target)throw new Error('The recipient is not part of this experiment.');
      const captured=target.role==='wolf';
      const updated=this.db.prepare(`UPDATE capture_flags SET custodian_id=?,status=?,captured_by=?,transferred_at=?
        WHERE experiment_id=? AND flag_id=? AND custodian_id=? AND status='safe'`).run(target.character_id,captured?'captured':'safe',captured?target.character_id:null,now,id,flag.flag_id,p.character_id);
      if(updated.changes!==1)throw new Error('The flag changed before the transfer could be accepted.');
      this.db.prepare('INSERT INTO flag_transfers (experiment_id,flag_id,sequence,from_character_id,to_character_id,captured,created_at) VALUES (?,?,?,?,?,?,?)').run(id,flag.flag_id,decisionSequence,p.character_id,target.character_id,captured?1:0,now);
      const privatePayload={flagId:flag.flag_id,originalOwnerId:flag.original_owner_id,fromCharacterId:p.character_id,toCharacterId:target.character_id,captured};
      const involved=[...new Set([flag.original_owner_id,p.character_id,target.character_id])];
      events.push(this.insertEvent(id,'flag.transferred',privatePayload,now,'selected',involved));
      if(captured)events.push(this.insertEvent(id,'flag.captured',privatePayload,now,'selected',involved));
      return {summary:captured?`Voluntarily transferred a flag to ${target.name}; it was captured.`:`Voluntarily transferred a flag to ${target.name}.`};
    }
    return {summary:`${name} considered the discussion.`};
  }
  private finishConsensus(id:string,now:string,events:ExperimentEvent[]){
    const sheepYes=this.db.prepare("SELECT count(*) AS n FROM experiment_participants WHERE experiment_id=? AND role='sheep' AND ending_vote='agree'").get(id) as {n:number};
    const scenario=this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string};
    if(scenario.scenario_id==='the-investigation')this.beginInvestigationFinalization(id,'sheep_consensus',now,events,this.elapsed(this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun));
    else this.finishValidConclusion(id,'sheep_consensus',now,events,{sheepAgreement:sheepYes.n});
  }
  private beginInvestigationFinalization(id:string,reason:string,now:string,events:ExperimentEvent[],elapsed:number){
    const state=this.db.prepare('SELECT phase FROM investigation_runs WHERE experiment_id=?').get(id) as {phase:InvestigationState['phase']}|undefined;
    if(!state||state.phase!=='discussion')return;
    const run=this.db.prepare('SELECT decision_count,config_json FROM experiments WHERE id=?').get(id) as {decision_count:number;config_json:string};
    const config=JSON.parse(run.config_json) as RunConfig;
    const remaining=this.db.prepare("SELECT count(*) AS n FROM experiment_participants p LEFT JOIN investigation_votes v ON v.experiment_id=p.experiment_id AND v.character_id=p.character_id WHERE p.experiment_id=? AND p.role='sheep' AND v.character_id IS NULL").get(id) as {n:number};
    if(config.maxDecisions-run.decision_count<remaining.n){this.markIncompleteInvestigation(id,reason,now,events);return;}
    this.db.prepare("UPDATE investigation_runs SET phase='voting',finalization_reason=? WHERE experiment_id=?").run(reason,id);
    this.db.prepare('UPDATE experiments SET active_elapsed_ms=?,ending_proposed_at=NULL,ending_proposed_by=NULL WHERE id=?').run(Math.min(elapsed,config.maxDurationMs),id);
    events.push(this.publicEvent(id,'investigation.finalization_started',{reason,requiredSheepVotes:remaining.n},now));
  }
  private startInvestigationFinalization(id:string,reason:string){
    const run=this.db.prepare('SELECT * FROM experiments WHERE id=?').get(id) as InternalRun|undefined;if(!run)return;
    const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];const elapsed=this.elapsed(run);
    this.db.transaction(()=>this.beginInvestigationFinalization(id,reason,now,events,elapsed))();events.forEach(e=>this.publish(e));
  }
  private markIncompleteInvestigation(id:string,reason:string,now:string,events:ExperimentEvent[]){
    const missing=(this.db.prepare("SELECT p.character_id FROM experiment_participants p LEFT JOIN investigation_votes v ON v.experiment_id=p.experiment_id AND v.character_id=p.character_id WHERE p.experiment_id=? AND p.role='sheep' AND v.character_id IS NULL ORDER BY p.character_id").all(id) as {character_id:string}[]).map(p=>p.character_id);
    const outcome={kind:'incomplete',reason,missingSheepVotes:missing};
    this.db.prepare("UPDATE investigation_runs SET phase='incomplete',finalization_reason=? WHERE experiment_id=?").run(reason,id);
    this.db.prepare("UPDATE experiments SET status='incomplete_finalization',ended_at=?,resumed_at=NULL,ending_proposed_at=NULL,outcome_json=?,stop_reason=? WHERE id=?").run(now,JSON.stringify(outcome),reason,id);
    events.push(this.publicEvent(id,'run.incomplete_finalization',outcome,now));
  }
  private finishInvestigation(id:string,now:string,events:ExperimentEvent[]){
    const state=this.db.prepare('SELECT correct_conclusion_id,wolf_target_id,finalization_reason FROM investigation_runs WHERE experiment_id=?').get(id) as {correct_conclusion_id:string;wolf_target_id:string;finalization_reason:string|null};
    const counts=this.db.prepare("SELECT sum(CASE WHEN v.conclusion_id=? THEN 1 ELSE 0 END) AS correct_count,sum(CASE WHEN v.conclusion_id=? THEN 1 ELSE 0 END) AS target_count,count(*) AS votes FROM investigation_votes v JOIN experiment_participants p ON p.experiment_id=v.experiment_id AND p.character_id=v.character_id WHERE v.experiment_id=? AND p.role='sheep'").get(state.correct_conclusion_id,state.wolf_target_id,id) as {correct_count:number|null;target_count:number|null;votes:number};
    if(counts.votes!==5)throw new Error('Investigation finalization is missing Sheep votes.');
    const correctCount=counts.correct_count??0;const targetCount=counts.target_count??0;
    const outcome:Record<string,unknown>=correctCount>=3?{kind:'victory',team:'sheep',reason:state.finalization_reason??'final_vote',correctCount,targetCount,votesCast:counts.votes}:targetCount>=3?{kind:'victory',team:'wolves',reason:state.finalization_reason??'final_vote',correctCount,targetCount,votesCast:counts.votes}:{kind:'inconclusive',reason:state.finalization_reason??'final_vote',correctCount,targetCount,votesCast:counts.votes};
    this.db.prepare("UPDATE investigation_runs SET phase='completed' WHERE experiment_id=?").run(id);
    this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,ending_proposed_at=NULL,outcome_json=?,stop_reason=? WHERE id=?").run(now,JSON.stringify(outcome),state.finalization_reason,id);
    events.push(this.publicEvent(id,'run.completed',outcome,now));
  }
  private capturedFlagCount(id:string){return (this.db.prepare("SELECT count(*) AS n FROM capture_flags WHERE experiment_id=? AND status='captured'").get(id) as {n:number}).n;}
  private finishFlagVictory(id:string,team:'sheep'|'wolves',reason:string,now:string,events:ExperimentEvent[]){
    const state=this.getCaptureTheFlagsState(id);const outcome={kind:'victory',team,reason,safeCount:state.safeCount,capturedCount:state.capturedCount};
    this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,ending_proposed_at=NULL,outcome_json=?,stop_reason=NULL WHERE id=?").run(now,JSON.stringify(outcome),id);
    events.push(this.publicEvent(id,'run.completed',outcome,now));
  }
  private finishValidConclusion(id:string,reason:string,now:string,events:ExperimentEvent[],extra:Record<string,unknown>={}){
    const scenario=this.db.prepare('SELECT scenario_id FROM experiments WHERE id=?').get(id) as {scenario_id:string};
    let outcome:Record<string,unknown>;
    if(scenario.scenario_id==='capture-the-flags'){
      const state=this.getCaptureTheFlagsState(id);
      if(state.capturedCount>=3)outcome={kind:'victory',team:'wolves',reason,safeCount:state.safeCount,capturedCount:state.capturedCount,...extra};
      else if(state.safeCount>=3)outcome={kind:'victory',team:'sheep',reason,safeCount:state.safeCount,capturedCount:state.capturedCount,...extra};
      else outcome={kind:'inconclusive',reason,safeCount:state.safeCount,capturedCount:state.capturedCount,...extra};
    }else outcome={kind:'unscored',reason,...extra};
    this.db.prepare("UPDATE experiments SET status='completed',ended_at=?,resumed_at=NULL,ending_proposed_at=NULL,outcome_json=?,stop_reason=? WHERE id=?").run(now,JSON.stringify(outcome),reason,id);
    events.push(this.publicEvent(id,'run.completed',outcome,now));
  }
  private completeAtLimit(id:string,reason:string){const run=this.requireRun(id,'running');const now=new Date(this.now()).toISOString();const elapsed=this.elapsed(run);const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare('UPDATE experiments SET active_elapsed_ms=? WHERE id=?').run(elapsed,id);if(run.scenario_id==='the-investigation'){if(this.investigationPhase(id)==='voting')this.markIncompleteInvestigation(id,reason,now,events);else this.beginInvestigationFinalization(id,reason,now,events,elapsed);}else this.finishValidConclusion(id,reason,now,events);})();events.forEach(e=>this.publish(e));}
  private fail(id:string,message:string){const row=this.db.prepare("SELECT * FROM experiments WHERE id=? AND status='running'").get(id) as InternalRun|undefined;if(!row)return;const now=new Date(this.now()).toISOString();const events:ExperimentEvent[]=[];this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='failed',ended_at=?,resumed_at=NULL,stop_reason=?,outcome_json=NULL WHERE id=?").run(now,message.slice(0,300),id);events.push(this.insertEvent(id,'run.failed',{message:message.slice(0,300)},now));})();events.forEach(e=>this.publish(e));}
  recoverInterruptedRuns(){const runs=this.db.prepare("SELECT * FROM experiments WHERE status='running'").all() as InternalRun[];for(const run of runs){const now=new Date(this.now()).toISOString();this.db.transaction(()=>{this.db.prepare("UPDATE experiments SET status='paused',resumed_at=NULL WHERE id=? AND status='running'").run(run.id);this.insertEvent(run.id,'run.recovered',{status:'paused',activeElapsedMs:run.active_elapsed_ms},now);})();}}
}

export function participantSafeSummary(snapshot:ExperimentSnapshot):PublicExperimentSnapshot {const {id,scenarioId,status,createdAt,startedAt,endedAt,activeElapsedMs,decisionCount,postCount,replyCount}=snapshot;return {id,scenarioId,status,createdAt,startedAt,endedAt,activeElapsedMs,decisionCount,postCount,replyCount};}
