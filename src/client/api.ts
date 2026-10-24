import type { Character, ExperimentSnapshot, ForumPost, PublicExperimentSnapshot, ScenarioSummary } from '../shared/types';
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
  publicExperiment: (id:string) => request<PublicExperimentSnapshot>(`/api/experiments/${id}/public`),
  startExperiment: (input:{scenarioId:string;paceMs:number;maxDurationMs:number;maxDecisions:number}) => request<ExperimentSnapshot>('/api/experiments',{method:'POST',body:JSON.stringify(input)}),
  controlExperiment: (id:string,control:'pause'|'resume'|'step'|'stop') => request<ExperimentSnapshot>(`/api/experiments/${id}/${control}`,{method:'POST'}),
  eventStream: (id:string) => `/api/experiments/${id}/events`
};
