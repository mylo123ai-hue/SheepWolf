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
