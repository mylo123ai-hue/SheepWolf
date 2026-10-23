import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scenarios, characters } from './catalog.js';
import { openDatabase } from './db.js';

export async function buildApp(db = openDatabase()) {
const app = Fastify({ logger: process.env.NODE_ENV === 'development' });
await app.register(cors, { origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] });

app.get('/api/health', async () => ({ status: 'ok', app: 'SheepWolf' }));
app.get('/api/scenarios', async () => scenarios);
app.get('/api/characters', async () => characters);

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

const submission = z.object({ authorId: z.string().min(1), body: z.string().trim().min(1).max(5000), title: z.string().trim().max(160).optional() });
const createPost = db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at) VALUES (@scenarioId,@parentId,@authorId,@title,@body,@createdAt)');
app.post<{Params:{scenarioId:string}}>('/api/forum/:scenarioId/posts', async (request, reply) => {
  const parsed = submission.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({error:'Check the post title and message, then try again.'});
  if (!scenarios.some((s) => s.id === request.params.scenarioId && s.status === 'playable')) return reply.code(404).send({error:'This scenario is not available for discussion yet.'});
  if (!characters.some((c) => c.id === parsed.data.authorId)) return reply.code(400).send({error:'Choose a participant from the list.'});
  if (!parsed.data.title) return reply.code(400).send({error:'A discussion title is required.'});
  const createdAt = new Date().toISOString();
  const result = createPost.run({ scenarioId:request.params.scenarioId, parentId:null, authorId:parsed.data.authorId, title:parsed.data.title, body:parsed.data.body, createdAt });
  return reply.code(201).send({id:Number(result.lastInsertRowid),scenarioId:request.params.scenarioId,parentId:null,authorId:parsed.data.authorId,title:parsed.data.title,body:parsed.data.body,createdAt,children:[]});
});
app.post<{Params:{scenarioId:string;postId:string}}>('/api/forum/:scenarioId/posts/:postId/replies', async (request, reply) => {
  const parsed = submission.omit({title:true}).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({error:'A reply must contain between 1 and 5000 characters.'});
  if (!scenarios.some((s) => s.id === request.params.scenarioId && s.status === 'playable')) return reply.code(404).send({error:'This scenario is not available for discussion yet.'});
  if (!characters.some((c) => c.id === parsed.data.authorId)) return reply.code(400).send({error:'Choose a participant from the list.'});
  const parentId = Number(request.params.postId);
  const parent = db.prepare('SELECT id FROM forum_posts WHERE id=? AND scenario_id=?').get(parentId, request.params.scenarioId);
  if (!parent) return reply.code(404).send({error:'Discussion not found.'});
  const createdAt = new Date().toISOString();
  const result = createPost.run({scenarioId:request.params.scenarioId,parentId,authorId:parsed.data.authorId,title:null,body:parsed.data.body,createdAt});
  return reply.code(201).send({id:Number(result.lastInsertRowid),scenarioId:request.params.scenarioId,parentId,authorId:parsed.data.authorId,title:null,body:parsed.data.body,createdAt,children:[]});
});

const staticDir = join(process.cwd(), 'dist');
if (existsSync(join(staticDir, 'index.html'))) {
  await app.register(fastifyStatic, { root: staticDir });
  app.setNotFoundHandler((request, reply) => request.raw.url?.startsWith('/api/') ? reply.code(404).send({error:'Not found'}) : reply.sendFile('index.html'));
}

return app;
}

