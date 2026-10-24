export type ScenarioStatus = 'playable' | 'planned';
export interface ScenarioSummary {
  id: string; name: string; subtitle: string; description: string; sheepObjective: string;
  wolfObjective: string; mechanic: string; status: ScenarioStatus; accent: string; symbol: string;
}
export interface Character { id: string; name: string; personality: string; color: string; initials: string; }
export interface ForumPost {
  id: number; scenarioId: string; parentId: number | null; authorId: string; title: string | null;
  body: string; createdAt: string; children?: ForumPost[];
}
export type ExperimentStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'failed' | 'incomplete_finalization';
export interface ProviderRunLimits {
  maxRequests: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxOutputTokensPerRequest: number;
  maxEstimatedUsd: number;
}
export interface RunConfig {
  mode: 'demo'|'real'; paceMs: number; maxDurationMs: number; maxDecisions: number; minimumActionsPerParticipant: 2;
  provider?: { provider:'deepseek'; model:string; limits:ProviderRunLimits };
}
export interface ProviderUsageSnapshot {
  requests:number; inputTokens:number; outputTokens:number; estimatedUsd:number;
  limits:ProviderRunLimits; model:string;
}
export interface ExperimentParticipant { characterId:string;name:string;personality:string;role:'sheep'|'wolf';privateObjective:string;actionOpportunities:number;endingVote:'agree'|'disagree'|null;lastDecisionAt:string|null;recentAction:string|null; }
export interface ExperimentSnapshot {
  id:string;scenarioId:string;status:ExperimentStatus;config:RunConfig;roleSeed:string;createdAt:string;startedAt:string;endedAt:string|null;
  activeElapsedMs:number;decisionCount:number;outcome:unknown;stopReason:string|null;participants:ExperimentParticipant[];postCount:number;replyCount:number;
  recentDecisions:{sequence:number;characterId:string;actionType:string;createdAt:string;summary:string}[];scenarioState:CaptureTheFlagsState|InvestigationState|null;providerUsage:ProviderUsageSnapshot|null;
}
export interface PublicExperimentSnapshot {id:string;scenarioId:string;status:ExperimentStatus;createdAt:string;startedAt:string;endedAt:string|null;activeElapsedMs:number;decisionCount:number;postCount:number;replyCount:number;}
export interface FlagRecord {flagId:string;originalOwnerId:string;originalOwnerName:string;custodianId:string;custodianName:string;status:'safe'|'captured';capturedBy:string|null;capturedByName:string|null;transferredAt:string|null;}
export interface FlagTransfer {id:number;flagId:string;originalOwnerId:string;originalOwnerName:string;fromCharacterId:string;fromName:string;toCharacterId:string;toName:string;captured:boolean;createdAt:string;visibleTo:string[];}
export interface CaptureTheFlagsState {kind:'capture-the-flags';flags:FlagRecord[];transfers:FlagTransfer[];safeCount:number;capturedCount:number;}
export interface InvestigationConclusion {id:string;label:string;description:string;}
export interface InvestigationOpinion {characterId:string;characterName:string;role:'sheep'|'wolf';initialConclusionId:string;currentConclusionId:string;finalConclusionId:string|null;changed:boolean;}
export interface InvestigationState {
  kind:'the-investigation';version:string;phase:'discussion'|'voting'|'completed'|'incomplete';finalizationReason:string|null;
  title:string;mystery:string;evidence:string[];conclusions:InvestigationConclusion[];correctConclusionId:string;wolfTargetId:string;
  opinions:InvestigationOpinion[];opinionChanges:{sequence:number;characterId:string;fromConclusionId:string;toConclusionId:string;createdAt:string}[];
  votes:{characterId:string;conclusionId:string;createdAt:string}[];voteTally:{conclusionId:string;count:number}[];missingSheepVotes:string[];
}
