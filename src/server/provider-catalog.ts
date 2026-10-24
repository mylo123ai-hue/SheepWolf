import type Database from 'better-sqlite3';
import type { ProviderRunLimits } from '../shared/types.js';

export const DEEPSEEK_MODELS=[
  {id:'deepseek-flash',label:'DeepSeek V4.1 Flash'},
  {id:'deepseek-v4-pro',label:'DeepSeek V4 Pro'}
] as const;
export type DeepSeekModel=typeof DEEPSEEK_MODELS[number]['id'];
export const DEEPSEEK_MODEL_DOCS='https://api-docs.deepseek.com/api/create-chat-completion';
export const DEEPSEEK_PRICING_DOCS='https://api-docs.deepseek.com/quick_start/pricing';
export const DEEPSEEK_PRICING_CHECKED='2026-10-24';

// Peak published prices are used for every request, with a 20% estimation margin.
// The most expensive model currently listed is the basis for both configured models.
const MAX_INPUT_USD_PER_MILLION=1.32;
const MAX_OUTPUT_USD_PER_MILLION=3.96;
const COST_MARGIN=1.2;
export function estimateDeepSeekCostUsd(inputTokens:number,outputTokens:number){
  return ((inputTokens*MAX_INPUT_USD_PER_MILLION+outputTokens*MAX_OUTPUT_USD_PER_MILLION)/1_000_000)*COST_MARGIN;
}

export interface ProviderSettingsRecord {
  provider:'deepseek';model:string;realModeEnabled:boolean;limits:ProviderRunLimits;updatedAt:string;
}
export const DEFAULT_PROVIDER_SETTINGS:ProviderSettingsRecord={
  provider:'deepseek',model:'deepseek-flash',realModeEnabled:false,
  limits:{maxRequests:20,maxInputTokens:100_000,maxOutputTokens:6_400,maxOutputTokensPerRequest:256,maxEstimatedUsd:0.25},
  updatedAt:''
};
export function getProviderSettings(db:Database.Database):ProviderSettingsRecord {
  const row=db.prepare('SELECT provider,model_id,real_mode_enabled,max_requests,max_input_tokens,max_output_tokens,max_output_tokens_per_request,max_estimated_usd,updated_at FROM provider_settings WHERE id=\'default\'').get() as {provider:'deepseek';model_id:string;real_mode_enabled:number;max_requests:number;max_input_tokens:number;max_output_tokens:number;max_output_tokens_per_request:number;max_estimated_usd:number;updated_at:string};
  return {provider:row.provider,model:row.model_id,realModeEnabled:Boolean(row.real_mode_enabled),limits:{maxRequests:row.max_requests,maxInputTokens:row.max_input_tokens,maxOutputTokens:row.max_output_tokens,maxOutputTokensPerRequest:row.max_output_tokens_per_request,maxEstimatedUsd:row.max_estimated_usd},updatedAt:row.updated_at};
}
export function saveProviderSettings(db:Database.Database,input:ProviderSettingsRecord){
  db.prepare(`UPDATE provider_settings SET provider=?,model_id=?,real_mode_enabled=?,max_requests=?,max_input_tokens=?,max_output_tokens=?,max_output_tokens_per_request=?,max_estimated_usd=?,updated_at=? WHERE id='default'`)
    .run(input.provider,input.model,input.realModeEnabled?1:0,input.limits.maxRequests,input.limits.maxInputTokens,input.limits.maxOutputTokens,input.limits.maxOutputTokensPerRequest,input.limits.maxEstimatedUsd,new Date().toISOString());
}
