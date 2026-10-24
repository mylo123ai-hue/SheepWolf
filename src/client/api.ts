import type { Character, ExperimentSnapshot, ForumPost, ProviderRunLimits, PublicExperimentSnapshot, ScenarioSummary } from '../shared/types';
export interface HistoryEvent {id:number;experimentId:string;sequence:number;type:string;payload:Record<string,unknown>;createdAt:string;audience:'public'|'observer'|'selected';visibleTo:string[];}
export interface HistorySummary {snapshot:ExperimentSnapshot;eventCount:number;}
export interface HistoryDetail extends HistorySummary {
  events:HistoryEvent[];forum:ForumPost[];
  decisions:{sequence:number;characterId:string;actionType:string;createdAt:string;result:unknown}[];
}
const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
};
export const api = {
  scenarios: () => request<ScenarioSummary[]>('/api/scenarios'),
  characters: () => request<Character[]>('/api/characters'),
  forum: (scenarioId: string) => request<ForumPost[]>(`/api/forum/${scenarioId}`),
  experimentForum: (id:string) => request<ForumPost[]>(`/api/experiments/${id}/forum`),
  currentExperiment: () => request<ExperimentSnapshot|null>('/api/experiments/current'),
  experiment: (id:string) => request<ExperimentSnapshot>(`/api/experiments/${id}`),
  history:()=>request<HistorySummary[]>('/api/history'),
  historyRun:(id:string)=>request<HistoryDetail>(`/api/history/${encodeURIComponent(id)}`),
  publicExperiment: (id:string) => request<PublicExperimentSnapshot>(`/api/experiments/${id}/public`),
  startExperiment: (input:{scenarioId:string;paceMs:number;maxDurationMs:number;maxDecisions:number;mode:'demo'|'real'}) => request<ExperimentSnapshot>('/api/experiments',{method:'POST',body:JSON.stringify(input)}),
  controlExperiment: (id:string,control:'pause'|'resume'|'step'|'stop') => request<ExperimentSnapshot>(`/api/experiments/${id}/${control}`,{method:'POST'}),
  providerSettings:()=>request<ProviderSettings>('/api/settings/providers'),
  updateProviderSettings:(input:Pick<ProviderSettings,'provider'|'model'|'realModeEnabled'|'limits'>)=>request<ProviderSettings>('/api/settings/providers',{method:'PUT',body:JSON.stringify(input)}),
  saveProviderCredential:(key:string,persistence:'protected'|'session')=>request<ProviderSettings>('/api/settings/providers/credential',{method:'POST',body:JSON.stringify({key,persistence})}),
  removeProviderCredential:()=>request<ProviderSettings>('/api/settings/providers/credential',{method:'DELETE'}),
  testProviderConnection:()=>request<{ok:true;model:string;message:string}>('/api/settings/providers/test',{method:'POST',body:JSON.stringify({confirm:true})}),
  eventStream: (id:string) => `/api/experiments/${id}/observer/events`
};

export interface ProviderSettings {
  provider:'deepseek';model:string;realModeEnabled:boolean;limits:ProviderRunLimits;
  credential:{configured:boolean;storage:'protected'|'session'|'none';persistentAvailable:boolean;storageName:string};
  supportedModels:{id:string;label:string}[];
  pricing:{checkedAt:string;modelDocs:string;pricingDocs:string;estimateNote:string};
}
