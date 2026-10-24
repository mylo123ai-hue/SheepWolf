import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { characters } from './catalog.js';

export function openDatabase(filename?: string) {
  const defaultDir = process.env.APPDATA ? join(process.env.APPDATA, 'SheepWolf') : join(homedir(), '.sheepwolf');
  const dbPath = filename ?? join(resolve(process.env.SHEEPWOLF_DATA_DIR ?? defaultDir), 'sheepwolf.sqlite');
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const initialMigration = db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get();
  if (!initialMigration) {
    const migrationSql = readFileSync(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
    db.transaction(() => {
      db.exec(migrationSql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(new Date().toISOString());
    })();
  }
  const applyMigration = (version: number, filename: string) => {
    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
    if (applied) return;
    const migrationSql = readFileSync(new URL(`./migrations/${filename}`, import.meta.url), 'utf8');
    db.transaction(() => {
      db.exec(migrationSql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
    })();
  };
  applyMigration(2, '002_experiments.sql');
  applyMigration(3, '003_capture_the_flags.sql');
  const insertCharacter = db.prepare('INSERT OR IGNORE INTO characters (id,name,personality,color,initials) VALUES (@id,@name,@personality,@color,@initials)');
  const seed = db.transaction(() => characters.forEach((character) => insertCharacter.run(character)));
  seed();
  const count = db.prepare('SELECT count(*) as total FROM forum_posts').get() as {total:number};
  if (count.total === 0) {
    const insert = db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,title,body,created_at) VALUES (?,?,?,?,?,?)');
    const now = Date.now();
    const starter = db.transaction(() => {
      const first = insert.run('capture-the-flags', null, 'willow', 'A thought before we begin', 'If a flag can only move when its keeper chooses, then the important question is what would make that choice feel safe.', new Date(now - 14 * 60_000).toISOString()).lastInsertRowid;
      insert.run('capture-the-flags', Number(first), 'fern', null, 'I agree, though I would want to know who benefits from a transfer before I called it safe.', new Date(now - 11 * 60_000).toISOString());
      insert.run('the-investigation', null, 'moss', 'The archive room', 'The window was latched from the inside, but there was a thin line of dust missing from the sill. I keep coming back to that detail.', new Date(now - 8 * 60_000).toISOString());
      insert.run('the-investigation', null, 'brook', 'What we know so far', 'Maybe we can separate what the evidence says from what each of us is imagining. That might help us stay kind to each other while we disagree.', new Date(now - 4 * 60_000).toISOString());
    });
    starter();
  }
  return db;
}
