import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteCli = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const origin = 'http://127.0.0.1:4175';
const launchPreview = () => spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: repoRoot, stdio: 'ignore' });
let server = launchPreview();
let browser;

async function waitForPreview() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited before readiness (${server.exitCode}).`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Vite preview did not start within 10 seconds.');
}

function stopPreview() {
  if (!server || server.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    server.once('exit', resolve);
    server.kill();
  });
}

try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const unexpectedRequests = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      unexpectedRequests.push(url.href);
      await route.abort();
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const data = {
        '/api/scenarios': [],
        '/api/characters': [],
        '/api/experiments/current': null,
        '/api/settings/providers': {
          provider: 'deepseek', model: 'deepseek-flash', realModeEnabled: false,
          limits: { maxRequests: 20, maxInputTokens: 100_000, maxOutputTokens: 6_400, maxOutputTokensPerRequest: 256, maxEstimatedUsd: 0.25 },
          credential: { configured: false, storage: 'none', persistentAvailable: false, storageName: 'Unavailable' },
          supportedModels: [{ id: 'deepseek-flash', label: 'DeepSeek V4.1 Flash' }],
          pricing: { checkedAt: 'test', modelDocs: '', pricingDocs: '', estimateNote: 'mocked test data' },
        },
      }[url.pathname];
      await route.fulfill({ status: data === undefined ? 404 : 200, contentType: 'application/json', body: JSON.stringify(data === undefined ? { error: 'Unexpected API route in theme smoke test.' } : data) });
      return;
    }
    await route.continue();
  });

  await page.goto(origin, { waitUntil: 'networkidle' });
  const app = page.locator('.app');
  await app.waitFor();
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark') === false && localStorage.getItem('sheepwolf.theme') === 'light');
  assert.equal(await page.evaluate(() => localStorage.getItem('sheepwolf.theme')), 'light', 'new browser profile should select the light default');

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark'));
  assert.equal(await page.evaluate(() => localStorage.getItem('sheepwolf.theme')), 'dark', 'header selection should be saved');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark'));

  await stopPreview();
  server = launchPreview();
  await waitForPreview();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark'));

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Evening/ }).click();
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark') === false);
  assert.equal(await page.evaluate(() => localStorage.getItem('sheepwolf.theme')), 'light', 'Settings selection should be saved');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('dark') === false);
  assert.deepEqual(unexpectedRequests, [], `theme test attempted non-local network access: ${unexpectedRequests.join(', ')}`);
  console.log('Theme browser smoke passed: light default, header and Settings toggles, reload and preview-process restart persistence, local-only mocked API responses.');
} finally {
  await browser?.close();
  await stopPreview();
}
