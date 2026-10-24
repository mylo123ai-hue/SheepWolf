import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scenarios, characters } from './catalog.js';
import { openDatabase } from './db.js';
import { ExperimentEngine, participantSafeSummary, type EngineOptions } from './experiment-engine.js';
import { CredentialVault, type CredentialPersistence } from './credential-vault.js';
import { DeepSeekDecisionProvider } from './deepseek-provider.js';
import { DEEPSEEK_MODELS, DEEPSEEK_MODEL_DOCS, DEEPSEEK_PRICING_CHECKED, DEEPSEEK_PRICING_DOCS, getProviderSettings, saveProviderSettings } from './provider-catalog.js';

export interface AppOptions {credentialVault?:CredentialVault;providerFetch?:typeof fetch;}
export async function buildApp(db = openDatabase(), engineOptions:EngineOptions={},appOptions:AppOptions={}) {
const vault=appOptions.credentialVault??new CredentialVault();
const realProvider=engineOptions.realProvider??new DeepSeekDecisionProvider({vault,settings:{realModeEnabled:()=>getProviderSettings(db).realModeEnabled},fetcher:appOptions.providerFetch});
const engine=new ExperimentEngine(db,{...engineOptions,realProvider});
const app = Fastify({ logger: process.env.NODE_ENV === 'development' });
await app.register(cors, { origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] });
app.addHook('onClose',async()=>engine.close());

app.get('/api/health', async () => ({ status: 'ok', app: 'SheepWolf' }));
app.get('/api/scenarios', async () => scenarios);
app.get('/api/characters', async () => characters);

const publicProviderSettings=async()=>{
  const settings=getProviderSettings(db);const credential=await vault.status();
  return {provider:settings.provider,model:settings.model,realModeEnabled:settings.realModeEnabled,limits:settings.limits,
    credential:{configured:credential.configured,storage:credential.storage,persistentAvailable:credential.persistentAvailable,storageName:credential.storageName},
    supportedModels:DEEPSEEK_MODELS,pricing:{checkedAt:DEEPSEEK_PRICING_CHECKED,modelDocs:DEEPSEEK_MODEL_DOCS,pricingDocs:DEEPSEEK_PRICING_DOCS,estimateNote:'Local estimate uses the highest published peak rate across listed DeepSeek models, with a 20% margin. It is not a provider-enforced spending cap.'}};
};
app.get('/api/settings/providers',publicProviderSettings);
const settingsInput=z.object({provider:z.literal('deepseek'),model:z.enum(['deepseek-flash','deepseek-v4-pro']),realModeEnabled:z.boolean(),limits:z.object({maxRequests:z.number().int().min(1).max(500),maxInputTokens:z.number().int().min(1).max(10_000_000),maxOutputTokens:z.number().int().min(1).max(1_000_000),maxOutputTokensPerRequest:z.number().int().min(1).max(8192),maxEstimatedUsd:z.number().finite().positive().max(100)}).strict().refine(value=>value.maxOutputTokensPerRequest<=value.maxOutputTokens)}).strict();
app.put('/api/settings/providers',async(request,reply)=>{
  const parsed=settingsInput.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Check the DeepSeek model and execution limits.'});
  const credential=await vault.status();if(parsed.data.realModeEnabled&&!credential.configured)return reply.code(409).send({error:'Save a DeepSeek API key before enabling Real AI.'});
  saveProviderSettings(db,{...parsed.data,updatedAt:new Date().toISOString()});if(!parsed.data.realModeEnabled)engine.disableRealRuns();return publicProviderSettings();
});
const credentialInput=z.object({key:z.string().trim().min(12).max(500),persistence:z.enum(['protected','session'])}).strict();
app.post('/api/settings/providers/credential',async(request,reply)=>{
  const parsed=credentialInput.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Enter a valid DeepSeek API key and choose protected or session-only storage.'});
  try{await vault.save(parsed.data.key,parsed.data.persistence as Exclude<CredentialPersistence,'none'>);return publicProviderSettings();}
  catch(error){const message=error instanceof Error?error.message:'Credential storage failed.';return reply.code(409).send({error:message.includes('session-only')?message:'The API key could not be saved securely. No plaintext copy was retained.'});}
});
app.delete('/api/settings/providers/credential',async(_request,reply)=>{
  db.prepare("UPDATE provider_settings SET real_mode_enabled=0,updated_at=? WHERE id='default'").run(new Date().toISOString());
  engine.disableRealRuns();
  try{await vault.remove();return publicProviderSettings();}
  catch{return reply.code(409).send({error:'Real AI was disabled, but the operating system could not remove its protected credential.'});}
});
let lastConnectionTest=0;
app.post('/api/settings/providers/test',async(request,reply)=>{
  const parsed=z.object({confirm:z.literal(true)}).strict().safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Confirm the direct DeepSeek connection check.'});
  if(Date.now()-lastConnectionTest<5_000)return reply.code(429).send({error:'Wait a few seconds before testing the connection again.'});
  const settings=getProviderSettings(db);lastConnectionTest=Date.now();
  const testProvider=realProvider as DeepSeekDecisionProvider;
  if(typeof testProvider.testConnection!=='function')return reply.code(501).send({error:'Connection testing is unavailable for the configured provider adapter.'});
  try{return await testProvider.testConnection(settings.model);}
  catch(error){const safe=(error as {safeMessage?:unknown})?.safeMessage;return reply.code(502).send({error:typeof safe==='string'?safe:'The DeepSeek connection check failed.'});}
});

app.get('/api/experiments/current',async()=>engine.getCurrent());
const runInput=z.object({scenarioId:z.string(),seed:z.string().min(1).max(100).optional(),paceMs:z.number().int().min(100).max(30_000).optional(),maxDurationMs:z.number().int().min(1_000).max(86_400_000).optional(),maxDecisions:z.number().int().min(1).max(10_000).optional(),mode:z.enum(['demo','real']).default('demo')}).strict();
app.post('/api/experiments',async(request,reply)=>{
  const parsed=runInput.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Check the scenario and run limits.'});
  try{
    const providerSettings=getProviderSettings(db);
    if(parsed.data.mode==='real'){
      if(!providerSettings.realModeEnabled)return reply.code(409).send({error:'Enable Real AI in Settings before selecting it for a run.'});
      const credential=await vault.status();if(!credential.configured)return reply.code(409).send({error:'Save a DeepSeek API key before starting a real AI run.'});
    }
    return reply.code(201).send(engine.createExperiment({...parsed.data,provider:parsed.data.mode==='real'?{provider:'deepseek',model:providerSettings.model,limits:providerSettings.limits}:undefined}));
  }catch(error){return reply.code(400).send({error:error instanceof Error?error.message:'Could not start the experiment.'});}
});
app.get<{Params:{id:string}}>('/api/experiments/:id/public',async(request,reply)=>{try{return participantSafeSummary(engine.getExperiment(request.params.id));}catch{return reply.code(404).send({error:'Experiment not found.'});}});
app.get<{Params:{id:string}}>('/api/experiments/:id',async(request,reply)=>{try{return engine.getExperiment(request.params.id);}catch{return reply.code(404).send({error:'Experiment not found.'});}});
for(const control of ['pause','resume','step','stop'] as const){
  app.post<{Params:{id:string}}>(`/api/experiments/:id/${control}`,async(request,reply)=>{
    try{
      if(control==='resume'||control==='step'){
        const run=engine.getExperiment(request.params.id);if(run.config.mode==='real'&&!getProviderSettings(db).realModeEnabled)return reply.code(409).send({error:'Enable Real AI in Settings before resuming or stepping this run.'});
      }
      const result=control==='pause'?engine.pause(request.params.id):control==='resume'?engine.resume(request.params.id):control==='step'?engine.step(request.params.id):engine.stop(request.params.id);return result;
    }
    catch(error){const message=error instanceof Error?error.message:'Experiment control failed.';return reply.code(message==='Experiment not found.'?404:409).send({error:message});}
  });
}
const treePosts=(rows:ReturnType<ExperimentEngine['getForumRows']>)=>{
  const flat=rows.map(row=>({id:row.id,scenarioId:row.scenario_id,parentId:row.parent_id,authorId:row.author_id,title:row.title,body:row.body,createdAt:row.created_at,children:[] as any[]}));
  const map=new Map(flat.map(post=>[post.id,post]));const roots:any[]=[];
  for(const post of flat){if(post.parentId&&map.has(post.parentId))map.get(post.parentId)!.children.push(post);else roots.push(post);}
  return roots;
};
app.get<{Params:{id:string}}>('/api/experiments/:id/forum',async(request,reply)=>{try{return treePosts(engine.getForumRows(request.params.id));}catch{return reply.code(404).send({error:'Experiment not found.'});}});
const eventStream=(observer:boolean)=>(request:Fastify.FastifyRequest<{Params:{id:string};Querystring:{after?:string}}>,reply:Fastify.FastifyReply)=>{
  try{engine.getPublicExperiment(request.params.id);}catch{return reply.code(404).send({error:'Experiment not found.'});}
  const raw=reply.raw;reply.hijack();raw.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
  const header=Number(request.headers['last-event-id']);let cursor=Number.isSafeInteger(header)&&header>0?header:Number(request.query.after??0);if(!Number.isSafeInteger(cursor)||cursor<0)cursor=0;
  const pump=()=>{try{for(const event of engine.getEvents(request.params.id,cursor,observer)){raw.write(`id: ${event.id}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`);cursor=event.id;}}catch{raw.end();}};
  const unsubscribe=engine.subscribe(event=>{if(event.experimentId===request.params.id)pump();});
  pump();const heartbeat=setInterval(()=>raw.write(': keep-alive\n\n'),15_000);
  raw.on('close',()=>{clearInterval(heartbeat);unsubscribe();});return reply;
};
app.get<{Params:{id:string};Querystring:{after?:string}}>('/api/experiments/:id/events',eventStream(false));
app.get<{Params:{id:string};Querystring:{after?:string}}>('/api/experiments/:id/observer/events',eventStream(true));

const rowToPost = (row: any) => ({ id: row.id as number, scenarioId: row.scenario_id as string, parentId: row.parent_id as number | null, authorId: row.author_id as string, title: row.title as string | null, body: row.body as string, createdAt: row.created_at as string });
const fetchPosts = db.prepare('SELECT id, scenario_id, parent_id, author_id, title, body, created_at FROM forum_posts WHERE scenario_id = ? ORDER BY created_at ASC, id ASC');
app.get<{Params:{scenarioId:string}}>('/api/forum/:scenarioId', async (request, reply) => {
  if (!scenarios.some((s) => s.id === request.params.scenarioId)) return reply.code(404).send({ error: 'Scenario not found' });
  const rows = fetchPosts.all(request.params.scenarioId) as any[];
  const flat = rows.map(rowToPost);
  const map = new Map<number, typeof flat[number] & {children: typeof flat}>();
  flat.forEach((post) => map.set(post.id, {...post, children:[]}));
  const roots: (typeof flat[number] & {children: typeof flat})[] = [];
  for (const post of flat) {
    const item = map.get(post.id)!;
    if (post.parentId && map.has(post.parentId)) map.get(post.parentId)!.children.push(item);
    else roots.push(item);
  }
  return roots;
});

const staticDir = join(process.cwd(), 'dist');
if (existsSync(join(staticDir, 'index.html'))) {
  await app.register(fastifyStatic, { root: staticDir });
  app.setNotFoundHandler((request, reply) => request.raw.url?.startsWith('/api/') ? reply.code(404).send({error:'Not found'}) : reply.sendFile('index.html'));
}

return app;
}

