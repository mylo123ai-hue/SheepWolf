import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documents = ['README.md', 'demo/README.md'];
for (const relativeDocument of documents) {
  const documentPath = path.join(repoRoot, relativeDocument);
  const contents = await readFile(documentPath, 'utf8');
  const matches = [...contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)];
  for (const [, rawTarget] of matches) {
    const target = rawTarget.trim().split(/[?#]/, 1)[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    await access(path.resolve(path.dirname(documentPath), decodeURIComponent(target)));
  }
}

const readme = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
const guide = await readFile(path.join(repoRoot, 'demo/README.md'), 'utf8');
assert.match(readme.slice(0, 500), /\[Try the free browser demo[^\]]*\]\(demo\/README\.md#play-the-demo\)/i, 'README top section must link prominently to the preview instructions');
assert.match(readme, /Live hosted demo: not deployed/i, 'README must clearly say no live hosted demo exists');
assert.match(guide, /## Play the demo/i, 'the README target must have the linked preview instructions section');
assert.match(guide, /\[[^\]]*preview\.html[^\]]*\]\(preview\.html\)/i, 'the preview guide must link to the checked-in single-file demo');
assert.doesNotMatch(readme + guide, /github\.io|pages\.dev|play online/i, 'README must not imply an unverified hosted demo');
console.log(`README asset/link check passed: ${documents.join(', ')}; prominent downloadable-demo link and all relative image/document targets resolve.`);
