import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoRoot = path.join(repoRoot, 'demo');
const configFile = path.join(demoRoot, 'vite.config.ts');

async function buildStaticDemo({ base, outDir }) {
  await build({
    configFile,
    root: demoRoot,
    base,
    build: { outDir: path.relative(demoRoot, outDir), emptyOutDir: true },
  });
  const files = await readdir(path.join(outDir, 'assets'));
  const scripts = files.filter((file) => file.endsWith('.js'));
  const styles = files.filter((file) => file.endsWith('.css'));
  if (scripts.length !== 1 || styles.length !== 1) {
    throw new Error(`Expected one bundled JavaScript and one CSS file; found ${scripts.length} and ${styles.length}.`);
  }
  const builtHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const builtCode = await Promise.all([...scripts, ...styles].map((file) => readFile(path.join(outDir, 'assets', file), 'utf8')));
  const bundle = `${builtHtml}\n${builtCode.join('\n')}`;
  const forbidden = [
    [/fetch\s*\(/i, 'network fetch'],
    [/\bXMLHttpRequest\b/i, 'XHR'],
    [/\bWebSocket\b/i, 'WebSocket'],
    [/\bEventSource\b/i, 'SSE client'],
    [/\/api\//i, 'application API path'],
    [/deepseek/i, 'provider identifier'],
    [/\bfastify\b/i, 'Fastify'],
    [/better-sqlite3/i, 'SQLite runtime'],
    [/apiKey|credentialStore|CredentialManager/i, 'credential control'],
    [/localStorage|sessionStorage|indexedDB/i, 'browser persistence'],
  ];
  const found = forbidden.filter(([pattern]) => pattern.test(bundle)).map(([, label]) => label);
  if (found.length) throw new Error(`Static demo bundle contains forbidden runtime references: ${found.join(', ')}.`);
  return { scripts, styles };
}

async function makeOfflinePreview({ scripts, styles }) {
  const outputPath = path.join(repoRoot, 'demo-dist', 'index.html');
  let html = await readFile(outputPath, 'utf8');
  const css = await readFile(path.join(repoRoot, 'demo-dist', 'assets', styles[0]), 'utf8');
  const js = await readFile(path.join(repoRoot, 'demo-dist', 'assets', scripts[0]), 'utf8');
  const stylesheet = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
  const script = html.match(/<script([^>]*)src="([^"]+\.js)"([^>]*)><\/script>/);
  if (!stylesheet || !script) throw new Error('Built demo HTML did not contain the expected local CSS and JavaScript bundles.');
  html = html.replace(stylesheet[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
  await mkdir(path.join(repoRoot, 'demo'), { recursive: true });
  await writeFile(path.join(repoRoot, 'demo', 'preview.html'), html);
  return Buffer.byteLength(html);
}

const rootOutput = path.join(repoRoot, 'demo-dist');
const subpathOutput = path.join(repoRoot, 'demo-dist-subpath');
const rootBuild = await buildStaticDemo({ base: './', outDir: rootOutput });
const previewBytes = await makeOfflinePreview(rootBuild);
await buildStaticDemo({ base: '/SheepWolf/', outDir: subpathOutput });
console.log(`Static demo builds passed: root (${rootOutput}), subpath /SheepWolf/ (${subpathOutput}); offline preview demo/preview.html (${previewBytes} bytes).`);
