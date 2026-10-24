import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scenarios, characters } from './catalog.js';
import { openDatabase } from './db.js';
import { ExperimentEngine, participantSafeSummary, type EngineOptions } from './experiment-engine.js';

export async function buildApp(db = openDatabase(), engineOptions:EngineOptions={}) {
const engine=new ExperimentEngine(db,engineOptions);
const app = Fastify({ logger: process.env.NODE_ENV === 'development' });
await app.register(cors, { origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] });
app.addHook('onClose',async()=>engine.close());

app.get('/api/health', async () => ({ status: 'ok', app: 'SheepWolf' }));
app.get('/api/scenarios', async () => scenarios);
app.get('/api/characters', async () => characters);

app.get('/api/experiments/current',async()=>engine.getCurrent());
const runInput=z.object({scenarioId:z.string(),seed:z.string().min(1).max(100).optional(),paceMs:z.number().int().min(100).max(30_000).optional(),maxDurationMs:z.number().int().min(1_000).max(86_400_000).optional(),maxDecisions:z.number().int().min(1).max(10_000).optional()});
app.post('/api/experiments',async(request,reply)=>{
  const parsed=runInput.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'Check the scenario and run limits.'});
  try{return reply.code(201).send(engine.createExperiment(parsed.data));}catch(error){return reply.code(400).send({error:error instanceof Error?error.message:'Could not start the experiment.'});}
});
app.get<{Params:{id:string}}>('/api/experiments/:id/public',async(request,reply)=>{try{return participantSafeSummary(engine.getExperiment(request.params.id));}catch{return reply.code(404).send({error:'Experiment not found.'});}});
app.get<{Params:{id:string}}>('/api/experiments/:id',async(request,reply)=>{try{return engine.getExperiment(request.params.id);}catch{return reply.code(404).send({error:'Experiment not found.'});}});
for(const control of ['pause','resume','step','stop'] as const){
  app.post<{Params:{id:string}}>(`/api/experiments/:id/${control}`,async(request,reply)=>{
    try{const result=control==='pause'?engine.pause(request.params.id):control==='resume'?engine.resume(request.params.id):control==='step'?engine.step(request.params.id):engine.stop(request.params.id);return result;}
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
app.get<{Params:{id:string}} & {Querystring:{after?:string}}>('/api/experiments/:id/events',(request,reply)=>{
  try{engine.getPublicExperiment(request.params.id);}catch{return reply.code(404).send({error:'Experiment not found.'});}
  const raw=reply.raw;reply.hijack();raw.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
  const header=Number(request.headers['last-event-id']);let cursor=Number.isSafeInteger(header)&&header>0?header:Number(request.query.after??0);if(!Number.isSafeInteger(cursor)||cursor<0)cursor=0;
  const pump=()=>{try{for(const event of engine.getEvents(request.params.id,cursor)){raw.write(`id: ${event.id}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`);cursor=event.id;}}catch{raw.end();}};
  const unsubscribe=engine.subscribe(event=>{if(event.experimentId===request.params.id)pump();});
  pump();const heartbeat=setInterval(()=>raw.write(': keep-alive\n\n'),15_000);
  raw.on('close',()=>{clearInterval(heartbeat);unsubscribe();});return reply;
});

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

