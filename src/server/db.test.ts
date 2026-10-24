import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './db.js';
import type Database from 'better-sqlite3';
const databases: Database.Database[] = [];
const directories: string[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); for (const dir of directories.splice(0)) rmSync(dir,{recursive:true,force:true}); });
describe('SQLite foundation', () => {
  it('migrates the schema and seeds seven characters and sample forum content once', () => {
    const db = openDatabase(':memory:'); databases.push(db);
    expect((db.prepare('SELECT count(*) as n FROM schema_migrations').get() as {n:number}).n).toBe(2);
    expect((db.prepare('SELECT count(*) as n FROM characters').get() as {n:number}).n).toBe(7);
    expect((db.prepare('SELECT count(*) as n FROM forum_posts').get() as {n:number}).n).toBe(4);
  });
  it('persists nested replies across a database restart', () => {
    const dir=mkdtempSync(join(tmpdir(),'sheepwolf-'));directories.push(dir);const path=join(dir,'test.sqlite');
    const db=openDatabase(path); databases.push(db);
    const parent = db.prepare("SELECT id FROM forum_posts WHERE title='A thought before we begin'").get() as {id:number};
    db.prepare('INSERT INTO forum_posts (scenario_id,parent_id,author_id,body,created_at) VALUES (?,?,?,?,?)').run('capture-the-flags',parent.id,'ash','A reply','2026-01-01T00:00:00.000Z');
    db.close(); databases.pop();
    const reopened=openDatabase(path);databases.push(reopened);
    expect((reopened.prepare('SELECT parent_id FROM forum_posts WHERE body=?').get('A reply') as {parent_id:number}).parent_id).toBe(parent.id);
  });
});
