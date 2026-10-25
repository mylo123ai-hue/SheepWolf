# SW-SEC-001 — npm dependency security repair

**Status: COMPLETED** for the authorized dependency-repair scope. The repair is on an isolated, unmerged PR. Windows Server CI passed; direct Windows 10 testing was not available.

## Repository and delivery

- Repository: `mylo123ai-hue/SheepWolf`
- Task: `SW-SEC-001`
- Handoff branch and exact revision: `handoff/sw-sec-001-dependency-audit-20261025` at `72bf795b7ffd3225e49d96f73206e7b1268d5d23`
- Verified handoff parent / `main` baseline: `36855a49ac73f5a612d24416d0a77b0ed44d21b5`
- Implementation branch: `codex/sw-sec-001-npm-security`
- Dependency implementation commit: `9170ffb1fe42f4e4462d9087853827c75b784849`
- PR: [#6 — Repair npm dependency advisories](https://github.com/mylo123ai-hue/SheepWolf/pull/6), targeting `main`; open and unmerged
- Windows CI for implementation commit: [run 40227797637](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40227797637), passed on Windows Server 2022 / Node 22.23.4
- No source-code, CI workflow, credential, security-setting, or scenario files were changed. PR #4 was not modified.

## Baseline findings

The audit was run against the pinned handoff tree in a detached worktree using npm 11.9.0 and Node 24.19.0. npm's audit `total` counts affected package records; those five records contained **nine distinct GHSA identifiers**.

| Affected package/path | Baseline version and exposure | Advisory IDs, affected range and severity | Fixed state |
|---|---|---|---|
| `@fastify/static` (direct production dependency) | 8.3.0. Used by `src/server/app.ts` to serve the built `dist` directory and SPA fallback when present. The app binds to `127.0.0.1`; no directory-listing option is enabled. The path handling is reachable by local clients, but a remote exploit was not demonstrated. | GHSA-pr96-94w5-mx2h (moderate; `>=8.0.0 <=9.1.0`); GHSA-x428-ghpx-8j92 (moderate; `>=8.0.0 <=9.1.0`); GHSA-8pvw-jcv7-9cmj (moderate; `<=10.1.1`); GHSA-83w8-p2f5-377r (high; `<=10.1.0`). | Updated to 10.1.7; absent from both final audits. |
| `zod` (direct production dependency) | 3.25.76. Used for bounded Fastify request validation and DeepSeek response parsing. Fastify applies its default request body cap; the provider completion schema has a `choices` array with a minimum but no maximum, so an oversized upstream response was a plausible memory-pressure surface. No exploit was reproduced. | GHSA-mrhx-c7xc-m3w5 (high; `<4.6.6`). | Updated to 4.6.7; absent from both final audits. |
| `vitest` → `@vitest/mocker` (development only) | 3.2.7 → 3.2.7. Test runner/mock registration; not included in production runtime. Risk is limited to developer/CI test execution with untrusted test code. | GHSA-82fw-gwwq-j7x9 (moderate; Vitest and mocker `<4.1.11`); GHSA-qxg6-89mg-rqv8 (moderate; mocker `<4.1.12`). | Updated to Vitest 4.1.12 and mocker 4.1.12; absent from final full audit. |
| `vitest` → `tinypool` (development only) | 3.2.7 → 1.1.1. Worker-pool dependency; not shipped with the application. | GHSA-5gmw-xhrv-c9v3 (critical; `<=2.1.0`); GHSA-85c8-ppgw-ccpr (critical; `<2.1.2`). | Vitest 4.1.12 no longer resolves `tinypool`; absent from the lockfile dependency tree and final full audit. |

The npm audit feed supplied GHSA IDs but no CVE IDs. The production-only audit contained only `@fastify/static` and `zod`; all Vitest-related findings were development-only. Finding presence does not establish that each reported exploit is reachable in this application's default local-only configuration.

## Changes

| File | Change |
|---|---|
| `package.json` | Raised only the three direct packages with no fixed release in their current major lines: `@fastify/static` `^8.1.1` → `^10.1.7`, `zod` `^3.24.1` → `^4.6.7`, and `vitest` `^3.0.5` → `^4.1.12`. |
| `package-lock.json` | Regenerated reproducibly from those declared versions; removed the vulnerable worker dependency and updated transitive packages. |
| `docs/IMPLEMENTATION_PROGRESS.md` | Added verified SW-SEC-001 findings, outcome, CI evidence and remaining platform caveat. |
| `codex/results/SW-SEC-001.md` | Published this acceptance and audit report. |

These are SemVer major upgrades. The fresh audit showed no fixed release in the pinned major lines; the smallest available compatible fixed lines were selected. The app's existing Fastify static registration, Zod schemas, Vitest configuration and tests passed unchanged. This is consumer compatibility evidence, not a claim that the major releases have no API changes generally.

## Criterion-by-criterion evidence

| Criterion | Status | Evidence |
|---|---|---|
| Exact repository, handoff branch and SHA verified; isolated branch created from that SHA. | **VERIFIED** | Fetched `handoff/sw-sec-001-dependency-audit-20261025`; its tip equaled `72bf795b7ffd3225e49d96f73206e7b1268d5d23`. Branch was created at that commit. The parent `36855a4` later refreshed as current `origin/main`, so the PR comparison contains only this task's changes. |
| Fresh full and production-only baseline audits; names, paths, ranges, severities and exposure assessed. | **VERIFIED** | At the pinned baseline, `npm audit --json` exited 1 and reported 5 package records: 1 moderate, 2 high, 2 critical. `npm audit --omit=dev --json` exited 1 with 2 high records. The nine distinct GHSA IDs and dependency paths are listed above. Static serving is production-reachable on loopback; Zod handles bounded user requests and provider responses; Vitest is dev-only. No exploitability beyond these code paths is asserted. |
| Minimal dependency remediation and reproducible lockfile. | **VERIFIED WITH MAJOR-UPGRADE CAVEAT** | Only the three direct packages from the audit changed. All require a major-version increase to reach patched lines; no same-major fixed versions were available. Typecheck, build, all regression tests, browser smoke and Windows CI passed without application source changes. The major-version compatibility risk is disclosed above. |
| Full and production-only audits are clear after remediation. | **VERIFIED** | After the update, `npm audit` and `npm audit --omit=dev` each exited 0 and reported `found 0 vulnerabilities`. The same was observed during clean `npm ci` and in Windows CI. |
| Clean install, typecheck, production build and full regression suite. | **VERIFIED** | Linux: `npm ci` passed (245 packages; one existing `prebuild-install@7.1.3` deprecation warning), `npm run typecheck` passed, `npm run build` passed, and `npm test` passed with 84 passed / 2 Windows-only skipped (86 total across 11 files). Windows CI: all 86 tests passed across 11 files. |
| Browser and production Fastify static integration checks. | **VERIFIED** | `npx playwright install chromium` and `npm run test:theme-browser` passed. The theme smoke checked light default, header and Settings controls, reload/process-restart persistence, mocked local API responses and no external requests. A separate Chromium walkthrough against the built app served by the real Fastify process checked `/api/health`, `/api/scenarios`, built `index.html` and JavaScript asset delivery, API 404 behavior, Scenario Library rendering and loopback-only requests. No provider connection was initiated. |
| Supported Windows CI and launcher/data recovery checks. | **VERIFIED** | [Run 40227797637](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40227797637) passed `npm ci`, typecheck, build, Chromium install, all 86 tests, theme browser smoke, and the Windows launcher smoke. The runner was Windows Server 2022 with Node v22.23.4; the launcher test checked clean install in a path with spaces, loopback ports 3000/5173, repeat-launch listener reuse, and stopped-run SQLite persistence after restart. Direct Windows 10 execution was unavailable and is **not verified**. |
| Preserve existing application behavior, credentials, scenarios, demo default and provider boundaries. | **VERIFIED** | Only dependency manifests/lockfile changed in the implementation commit; the full two-scenario, demo, mocked-provider, persistence, history, credentials and privacy regression suite passed. No live/paid provider call, credential change, external service, deployment or public exposure occurred. |
| Publish report and open unmerged PR to `main`. | **VERIFIED** | This report and the progress update are committed on `codex/sw-sec-001-npm-security`; PR #6 is open, targets `main`, and is unmerged. PR #4 was left untouched. |

## Exact commands and results

Pinned baseline (Node 24.19.0, npm 11.9.0):

```text
npm audit --json              exit 1 — 5 package records (1 moderate, 2 high, 2 critical)
npm audit --omit=dev --json   exit 1 — 2 high production package records
```

Implementation branch, clean install on Linux (Node 24.19.0, npm 11.9.0):

```text
npm ci                         PASS — 245 packages installed
npm audit                      PASS — 0 vulnerabilities
npm audit --omit=dev           PASS — 0 vulnerabilities
npm run typecheck              PASS
npm run build                  PASS — Vite production build
npm test                       PASS — 84 passed, 2 Windows-only skipped; 11 files, 86 total
npx playwright install chromium PASS
npm run test:theme-browser     PASS — persistent theme flow; local fixture API only
production Fastify + Chromium smoke PASS — actual built assets and UI rendered on loopback
```

Windows CI (Windows Server 2022 / Node v22.23.4), [run 40227797637](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40227797637): `npm ci` passed and reported 0 vulnerabilities; typecheck, build, Playwright installation, `npm test` (**86/86 across 11 files**), theme browser test and Windows launcher/data recovery smoke all passed. GitHub emitted a non-failing platform warning that current `actions/*@v4` steps target Node 20 and are being forced to Node 24; workflow dependency updates are outside this task.

## Risks, limitations and rollback

- The three required updates are SemVer major changes. The actual app's current usage passed typecheck, production build, all tests and Windows CI, but Windows 10 itself and every possible external integration were not exercised.
- No direct Windows 10 desktop test was available; Windows Server 2022 is the verified platform evidence.
- `npm ci` still emits the unrelated `prebuild-install@7.1.3` deprecation warning. It is not an npm security advisory; no audit findings remain at the time recorded.
- npm audit databases change over time; rerun `npm audit` and `npm audit --omit=dev` before release.
- **Rollback before merge:** close PR #6 or revert commit `9170ffb1fe42f4e4462d9087853827c75b784849` on this branch. This restores the previous manifests and lockfile without rewriting history. `main` remains unchanged by this PR.
- **After any later merge:** use a normal revert commit; do not rewrite shared history.

No paid model request, credential modification, security-setting change, public deployment, merge, PR #4 modification, external infrastructure access or owner-PC access occurred.
