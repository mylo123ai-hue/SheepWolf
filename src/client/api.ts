import type { Character, ForumPost, ScenarioSummary } from '../shared/types';
const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: { 'content-type':'application/json', ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
};
export const api = {
  scenarios: () => request<ScenarioSummary[]>('/api/scenarios'),
  characters: () => request<Character[]>('/api/characters'),
  forum: (scenarioId: string) => request<ForumPost[]>(`/api/forum/${scenarioId}`),
  post: (scenarioId:string, body:{authorId:string;title:string;body:string}) => request<ForumPost>(`/api/forum/${scenarioId}/posts`, {method:'POST',body:JSON.stringify(body)}),
  reply: (scenarioId:string, postId:number, body:{authorId:string;body:string}) => request<ForumPost>(`/api/forum/${scenarioId}/posts/${postId}/replies`, {method:'POST',body:JSON.stringify(body)})
};
