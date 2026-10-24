import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootBuild = path.join(repoRoot, 'demo-dist');
const subpathBuild = path.join(repoRoot, 'demo-dist-subpath');
const screenshotDir = path.join(repoRoot, 'docs', 'screenshots');
await mkdir(screenshotDir, { recursive: true });
await stat(path.join(repoRoot, 'demo', 'preview.html'));

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const mappings = [
  { prefix: '/SheepWolf/', directory: subpathBuild },
  { prefix: '/', directory: rootBuild },
];

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const mapping = mappings.find((item) => item.prefix !== '/' && pathname.startsWith(item.prefix)) ?? mappings[1];
    let relative = mapping.prefix === '/'
      ? pathname.slice(1)
      : pathname.slice(mapping.prefix.length);
    if (!relative || relative.endsWith('/')) relative = `${relative}index.html`;
    const target = path.resolve(mapping.directory, relative);
    if (target !== mapping.directory && !target.startsWith(`${mapping.directory}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const content = await readFile(target);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(target)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Static demo test server did not bind a TCP port.');
const origin = `http://127.0.0.1:${address.port}`;
const observedRequests = [];
const blockedRequests = [];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const localHttp = requestUrl.origin === origin;
    if (localHttp && !requestUrl.pathname.startsWith('/api/')) {
      observedRequests.push(requestUrl.href);
      await route.continue();
      return;
    }
    blockedRequests.push(requestUrl.href);
    await route.abort();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const firstResponse = await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  assert.equal(firstResponse?.status(), 200, 'root static build should load');
  assert.equal(await page.getByRole('button', { name: /Open this table/ }).count(), 2, 'both playable tables should be available');
  await page.screenshot({ path: path.join(screenshotDir, 'showcase-demo-library.png'), fullPage: true });
  await page.keyboard.press('Tab');
  const focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
  assert.notEqual(focusOutline, '0px', 'keyboard focus should be visible');

  // Exercise Start, Pause, one-step, Resume and Stop without a backend.
  await page.locator('#seed-input').fill('browser-controls');
  await page.locator('#pace-select').selectOption('250');
  await page.locator('[data-scenario="capture-the-flags"]').click();
  await page.getByRole('button', { name: /Start experiment/ }).click();
  await page.getByRole('button', { name: /^Pause/ }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-action')), 'resume', 'keyboard focus should move to the corresponding Resume control');
  assert.equal(await page.getByTestId('run-status').getAttribute('class').then((value) => value?.includes('paused')), true);
  const pausedCount = Number(await page.getByTestId('decision-count').innerText());
  await page.waitForTimeout(500);
  assert.equal(Number(await page.getByTestId('decision-count').innerText()), pausedCount, 'pause must hold the decision count');
  await page.getByRole('button', { name: /Advance one turn/ }).click();
  assert.equal(Number(await page.getByTestId('decision-count').innerText()), pausedCount + 1, 'Step must execute one eligible decision');
  await page.getByRole('button', { name: /^Resume/ }).click();
  await page.waitForFunction((previous) => Number(document.querySelector('[data-testid="decision-count"]')?.textContent) > previous, pausedCount + 1, { timeout: 3000 });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-action')), 'pause', 'focus should stay on the Pause control during live refreshes');
  await page.getByRole('button', { name: /^Stop/ }).click();
  assert.equal(await page.locator('[data-testid="demo-run"]').getAttribute('data-status'), 'stopped');
  assert.equal(await page.locator('.stopped-outcome').count(), 1, 'stopping must not claim a winner');

  // Complete Capture the Flags and retain the first non-fixed scheduler order.
  await page.locator('.run-topline [data-action="library"]').click();
  await page.locator('#seed-input').fill('showcase-capture-completed');
  await page.locator('#pace-select').selectOption('250');
  await page.locator('[data-scenario="capture-the-flags"]').click();
  await page.evaluate(() => {
    (window).__seenShowcaseDecisions = [];
    const remember = () => {
      const target = (window).__seenShowcaseDecisions;
      for (const row of document.querySelectorAll('[data-sequence][data-agent-id]')) {
        const sequence = Number(row.getAttribute('data-sequence'));
        if (!target.some((item) => item.sequence === sequence)) target.push({ sequence, id: row.getAttribute('data-agent-id') });
      }
    };
    new MutationObserver(remember).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: /Start experiment/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="demo-run"]')?.getAttribute('data-status') === 'completed', undefined, { timeout: 25000 });
  assert.equal(await page.locator('.observer-participant').count(), 7, 'observer should list seven participants');
  assert.equal(await page.locator('.observer-participant .role-badge.sheep').count(), 5, 'observer should see five Sheep');
  assert.equal(await page.locator('.observer-participant .role-badge.wolf').count(), 2, 'observer should see two Wolves');
  assert.equal(await page.locator('.public-roster .role-badge, .conversation-scroll .role-badge').count(), 0, 'forum and public roster must not display hidden role badges');
  assert.equal(await page.locator('.custody-list li').count(), 5, 'observer should see all five flags');
  assert.ok(await page.locator('.outcome').count(), 'completed Capture the Flags run should display a valid outcome');
  const decisionOrder = await page.evaluate(() => (window).__seenShowcaseDecisions.sort((a, b) => a.sequence - b.sequence).slice(0, 7).map((item) => item.id));
  assert.equal(new Set(decisionOrder).size, 7, 'scheduler should give each participant an opportunity before repeating early');
  assert.notDeepEqual(decisionOrder, ['willow', 'rowan', 'clover', 'fern', 'moss', 'ash', 'brook'], 'scheduler should not use the character-list speaking order');
  await page.screenshot({ path: path.join(screenshotDir, 'showcase-demo-capture-completed.png'), fullPage: true });

  // The /SheepWolf/ build must work when served beneath a static subpath.
  await page.goto(`${origin}/SheepWolf/`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: /Seven voices/ }).count(), 1);
  await page.locator('#seed-input').fill('showcase-investigation-completed');
  await page.locator('#pace-select').selectOption('250');
  await page.locator('[data-scenario="the-investigation"]').click();
  await page.getByRole('button', { name: /Start experiment/ }).click();
  await page.getByRole('button', { name: /^Pause/ }).click();
  for (let index = 0; index < 40 && await page.locator('[data-testid="demo-run"]').getAttribute('data-phase') !== 'voting'; index += 1) {
    await page.getByRole('button', { name: /Advance one turn/ }).click();
    if (await page.locator('[data-testid="demo-run"]').getAttribute('data-status') === 'completed') break;
  }
  assert.equal(await page.locator('[data-testid="demo-run"]').getAttribute('data-phase'), 'voting', 'Investigation must enter private final voting');
  assert.equal(await page.locator('.final-tally').count(), 0, 'individual Sheep conclusions must remain hidden before the complete ballot');
  await page.getByRole('button', { name: /Advance one turn/ }).click();
  assert.equal(await page.locator('.vote-progress').innerText().then((text) => text.includes('1/5 submitted')), true);
  assert.equal(await page.locator('.final-tally').count(), 0, 'a partial ballot must not expose a tally');
  await page.getByRole('button', { name: /^Resume/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="demo-run"]')?.getAttribute('data-status') === 'completed', undefined, { timeout: 15000 });
  assert.equal(await page.locator('.observer-participant').count(), 7);
  assert.equal(await page.locator('.observer-participant .role-badge.sheep').count(), 5);
  assert.equal(await page.locator('.observer-participant .role-badge.wolf').count(), 2);
  assert.equal(await page.locator('.vote-progress').innerText().then((text) => text.includes('5/5 submitted')), true);
  assert.equal(await page.locator('.final-tally').count(), 1, 'final vote tally should appear only after all five Sheep vote');
  assert.equal(await page.locator('.public-roster .role-badge, .conversation-scroll .role-badge').count(), 0);
  assert.ok(await page.locator('.outcome').count(), 'completed Investigation run should display a valid outcome');
  await page.screenshot({ path: path.join(screenshotDir, 'showcase-demo-investigation-completed.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
  assert.ok(widths.body <= widths.viewport && widths.document <= widths.viewport, `mobile layout should not overflow horizontally (${JSON.stringify(widths)})`);
  await page.screenshot({ path: path.join(screenshotDir, 'showcase-demo-mobile.png'), fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: /Seven voices/ }).count(), 1, 'reload should return to the non-persistent library');
  assert.equal(blockedRequests.length, 0, `browser attempted forbidden requests: ${blockedRequests.join(', ')}`);
  assert.ok(observedRequests.length > 4, 'browser should load the static document, CSS and bundled JavaScript');
  assert.equal(pageErrors.length, 0, `browser errors: ${pageErrors.join('; ')}`);
  await context.close();

  // Exercise the generated offline single-file preview with network egress blocked.
  const offlineContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const offlineNetwork = [];
  await offlineContext.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('file:')) await route.continue();
    else {
      offlineNetwork.push(url);
      await route.abort();
    }
  });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(pathToFileURL(path.join(repoRoot, 'demo', 'preview.html')).href, { waitUntil: 'load' });
  assert.equal(await offlinePage.getByRole('button', { name: /Open this table/ }).count(), 2, 'single-file offline preview should render both games');
  await offlinePage.locator('#seed-input').fill('offline-file-check');
  await offlinePage.locator('[data-scenario="capture-the-flags"]').click();
  await offlinePage.getByRole('button', { name: /Start experiment/ }).click();
  await offlinePage.getByRole('button', { name: /^Pause/ }).click();
  await offlinePage.getByRole('button', { name: /Advance one turn/ }).click();
  assert.equal(Number(await offlinePage.getByTestId('decision-count').innerText()), 1, 'offline file preview should accept a local simulated turn');
  assert.equal(offlineNetwork.length, 0, `offline preview attempted HTTP egress: ${offlineNetwork.join(', ')}`);
  await offlineContext.close();

  console.log(`Browser showcase passed: static root + /SheepWolf/ + offline file preview, both completed scenarios, scheduler order ${decisionOrder.join(' → ')}, lifecycle/partial-ballot/privacy checks, ${observedRequests.length} same-origin static resource requests, zero blocked/external requests.`);
  console.log(`Screenshots: ${path.relative(repoRoot, screenshotDir)}/showcase-demo-library.png, showcase-demo-capture-completed.png, showcase-demo-investigation-completed.png, showcase-demo-mobile.png`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
