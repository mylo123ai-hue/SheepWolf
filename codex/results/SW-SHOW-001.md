# SW-SHOW-001 — README Showcase and Isolated Browser Demo

**Overall status: COMPLETED** for the authorized bounded scope.

| Field | Evidence |
| --- | --- |
| Repository | `mylo123ai-hue/SheepWolf` |
| Task | `SW-SHOW-001` |
| Exact handoff | `handoff/sw-showcase-001-20261024` at `50508b6b493763e45fc8da41b9d0717f08de302d`; file `codex/handoffs/SW-SHOW-001.md` |
| Accepted base | `main` at `8197681cceb9773161518d5193654c0fdfc4a5bc` |
| Implementation branch | `codex/sw-showcase-001-static-demo` |
| Source commits | `8162f6e0a436cb23a16ec6d8bcf0d835850192f3`; `71a8677373aa491b0c61cf46ac3349cc6c4dcc3a` |
| Pull request | [PR #4](https://github.com/mylo123ai-hue/SheepWolf/pull/4), targets `main`, open and unmerged |
| Windows CI | [Run 40063979614](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40063979614), success on Windows Server 2022 / Node 22, source commit `71a8677373aa491b0c61cf46ac3349cc6c4dcc3a` |

## Acceptance evidence

| Criterion | Status | Verification |
| --- | --- | --- |
| 1. Polished README | **VERIFIED** | `README.md` was redesigned around The Commons with a concise hook, real relative screenshots from the accepted application and new running demo, scenario/personality descriptions, Windows instructions, local data/backup guidance, full-app versus preview comparison, provider/spending boundaries, status and evidence links. `npm run check:readme` passed and verified all relative image/document targets. Windows instructions retain the intended Windows 10 target, no direct Windows 10 claim, Node 20.18–24.x, launcher, loopback URLs, data directory and non-`.exe` status. |
| 2. Prominent demo link | **VERIFIED** | The README top callout links to [`demo/README.md#play-the-demo`](../../demo/README.md#play-the-demo). The guide provides a downloadable `demo/preview.html` path and local build/serve commands. Playwright opened the checked-in file directly under `file://` and played a turn with HTTP egress blocked. Both README and guide label the demo as unhosted; the README says **Live hosted demo: not deployed**. No speculative public URL or deployment was added. |
| 3. Playable showcase | **VERIFIED** | The separate static app offers Capture the Flags and The Investigation, seven recurring participants (5 Sheep / 2 Wolves), scripted forum discussion, observer display, bounded decisions, Start/Pause/Resume/one-step/Stop, and scenario-valid final results. `demo/src/game.test.ts` adds 14 focused game tests for role assignment/privacy, flags and transfers, captures and victory, voting and all outcome classes, lifecycle, scheduler fairness, ending eligibility and limits. Chromium completed both scenarios; screenshots show genuine completed runs. It also verified that a stopped run remains unscored and that investigation partial ballots do not expose the tally. |
| 4. Static-only proof | **VERIFIED** | `npm run demo:build` creates domain-root and `/SheepWolf/` static outputs plus the single-file preview. Its emitted-code audit rejects `fetch`, XHR, WebSocket, EventSource, `/api/`, provider identifiers, Fastify, SQLite, credential controls and browser persistence. Browser walkthrough served both builds and blocked all non-static or external requests: nine same-origin static resource requests, zero blocked/external/API/provider requests. The file preview made zero HTTP requests. `npm run demo:serve` manual smoke check returned `/` **200**, `/api/health` **404**, and an encoded traversal probe **403**; the server binds only to `127.0.0.1` and serves only `demo-dist/`. The preview has no connection to the full Fastify/SQLite application or paid services. |
| 5. Regression and UX | **VERIFIED** | Linux: `npm ci`, typecheck, full build and test passed; Vitest reported **83 passed, 2 Windows-only skipped (85 total; 11 files)**. Demo Chromium checks verified focus visibility/retention, no horizontal overflow at 390 px, refreshed library state without duplicate persistence, both root/subpath builds and offline file mode. Windows CI run 40063979614 passed `npm ci`, typecheck, build, demo build/audit, README link check, `npm test` (**85 passed across 11 files**), Chromium demo walkthrough, and the existing Windows launcher/data-recovery smoke test. Full Blocks 1–6 source behavior was preserved; full-app regression suite and launcher test passed. Windows Server 2022 evidence is not a direct Windows 10 test. |
| 6. Evidence and handback | **VERIFIED** | Changes are on the isolated branch, PR #4 is open against `main` and has not been merged, screenshots and this report are committed to the PR branch, and the Windows CI result is successful. No public release, hosting, deployment or paid call was made. |

## Implementation summary and changed files

The preview is a standalone static React/Vite bundle authored under `demo/`, with a small standalone game model in `demo/src/game.ts`, UI in `demo/src/main.ts`, styling in `demo/src/style.css`, and Vite configuration. It does not import application backend modules. The generated `demo/preview.html` inlines the bundled CSS and JavaScript so it can be downloaded and opened offline. `demo/README.md` documents the reduced scope and exact use/build steps. The `demo:serve` helper is a Node built-in loopback static-file server; it neither starts the full app nor provides API fallback routes.

Files changed relative to the accepted baseline:

- `.github/workflows/windows.yml`, `.gitignore`, `package.json`, `tsconfig.json`, `vitest.config.ts` — build/test wiring and ephemeral CI screenshot artifact.
- `README.md`, `demo/README.md` — product showcase and honest preview instructions.
- `demo/index.html`, `demo/preview.html`, `demo/vite.config.ts`, `demo/src/game.ts`, `demo/src/game.test.ts`, `demo/src/main.ts`, `demo/src/style.css` — isolated static playable demo.
- `scripts/build-demo.mjs`, `scripts/check-readme-links.mjs`, `scripts/demo-browser-smoke.mjs`, `scripts/serve-demo.mjs` — static builds/audit, link checks, browser verification and local static server.
- `docs/screenshots/showcase-demo-library.png`, `docs/screenshots/showcase-demo-capture-completed.png`, `docs/screenshots/showcase-demo-investigation-completed.png`, `docs/screenshots/showcase-demo-mobile.png` — genuine Chromium captures from the running demo.
- `docs/IMPLEMENTATION_PROGRESS.md`, `codex/results/SW-SHOW-001.md` — progress and this acceptance record.

Implementation commit `8162f6e0a436cb23a16ec6d8bcf0d835850192f3` contains the showcase, UI, tests, workflow, README and screenshots. Follow-up `71a8677373aa491b0c61cf46ac3349cc6c4dcc3a` replaces the Vite SPA preview server with the explicit static-only loopback server so unknown API routes return 404.

## Exact verification results

Local checks on the implementation branch:

```text
npm ci                         PASS (clean lockfile install; existing dependency notices noted below)
npm run typecheck              PASS
npm run build                  PASS
npm test                       PASS — 83 passed, 2 skipped (Windows-only), 85 total; 11 files
npm run demo:build              PASS — root, /SheepWolf/ subpath, and generated offline preview; emitted bundle audit passed
npm run check:readme            PASS — prominent preview link and all relative image/document targets resolve
npm run demo:browser-test       PASS — both completed scenarios, control/privacy checks, root/subpath and offline file walkthrough
git diff --check               PASS
```

The browser walkthrough produced the committed screenshots listed above. It observed the scripted free-running order `ash → rowan → willow → fern → clover → brook → moss`, with all seven participants receiving an early opportunity and no fixed character-list order. It verified the actual browser controls and result panels; this is evidence of the deterministic showcase mechanics, not evidence of model reasoning.

Manual static server check after `npm run demo:build`:

```text
npm run demo:serve                                  PASS — bound to 127.0.0.1:4174
GET http://127.0.0.1:4174/                         200
GET http://127.0.0.1:4174/api/health               404
GET /..%2fpackage.json (path traversal probe)       403
```

GitHub Windows CI run [40063979614](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40063979614) ran on Windows Server 2022 with Node 22 and passed all workflow steps: `npm ci`, typecheck, build, static demo build, README checks, `npx playwright install chromium`, **85 tests across 11 files**, actual Chromium showcase browser walkthrough, screenshot artifact upload, and Windows launcher/data persistence/restart smoke test. This confirms the current Windows runner, not Windows 10 itself. The workflow generated ephemeral artifact `sw-showcase-demo-browser-evidence`; the committed screenshots remain available even after artifact retention expires.

## Screenshot evidence

- [Scenario library](../../docs/screenshots/showcase-demo-library.png)
- [Completed Capture the Flags run](../../docs/screenshots/showcase-demo-capture-completed.png)
- [Completed Investigation run](../../docs/screenshots/showcase-demo-investigation-completed.png)
- [Mobile-width Investigation preview](../../docs/screenshots/showcase-demo-mobile.png)
- [Accepted full application screenshots](../../docs/screenshots/block6-scenario-library.png), [live forum](../../docs/screenshots/block6-live-forum-running.png), [observer dashboard](../../docs/screenshots/block6-observer-running.png), [history replay](../../docs/screenshots/block6-history-replay.png), [settings](../../docs/screenshots/block6-settings.png), and [mobile replay](../../docs/screenshots/block6-mobile-replay.png).

These are browser captures of the running application/demo, not generated mockups. The full-app images are from the accepted Block 6 work; the new preview captures were generated by Playwright against the built static application.

## Risks, limitations and authority boundaries

- The browser preview is a scripted demonstration, not actual AI reasoning, and stores no data; refresh clears the run.
- It is a single-browser showcase, not a secure multi-user game. Role details are hidden from ordinary preview panels but can be inspected by the user through browser state. Do not use it for secrets or adversarial research.
- The preview is not hosted. The README link is a repository preview guide/download entry point; there is no live website URL.
- Windows 10 was not directly tested. The available evidence is a successful Windows Server 2022 / Node 22 CI run.
- No DeepSeek/API calls, external inference, telemetry, credentials, public deployment or paid services were used.
- Windows CI's `npm ci` printed an npm audit summary of **5 dependency findings (1 moderate, 2 high, 2 critical)**, plus deprecation warnings for transitive `prebuild-install` and `glob`. This bounded UI/showcase change did not run `npm audit fix` or upgrade unrelated dependency trees. Review/update those dependencies separately.
- Focus, keyboard navigation and 390 px layout were checked; no full screen-reader or exhaustive accessibility audit is claimed.

## Rollback

The accepted `main` branch was not modified. To discard this work, close PR #4 without merging. The branch can be retained for evidence and review. If a rollback commit is desired on the isolated branch, revert `71a8677373aa491b0c61cf46ac3349cc6c4dcc3a` and then `8162f6e0a436cb23a16ec6d8bcf0d835850192f3`; do not rewrite shared history. There are no deployed services, external data or credentials to roll back.

**Owner-only future decision:** hosting remains outside this task; the owner may separately authorize deployment later. No action is needed to use the downloaded `demo/preview.html` locally.
