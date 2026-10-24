# SW-B06 — Block 6 results

**Status: PARTIAL** — implementation, Windows Server CI, and the deferred Windows protected-credential browser journey are verified. The product target is Windows 10 x64, but this work block ran its Windows checks on Windows Server 2022, not on a Windows 10 desktop.

## Repository and handback

- Repository: `mylo123ai-hue/SheepWolf`
- Task: `SW-B06`
- Starting point: accepted `main` commit `585e28141f8c8d6e8c6e01726c6e8aa7c2546e4a`
- Handoff: `handoff/sw-b06-final-mvp-20261024` at `6a3a39a35df0c174c6d2f91e59a3fde4d83b3a55`
- Implementation branch: `codex/sw-b06-mvp-polish`
- Implementation commits: `8e4136c2562329e07bd32b7f91c0046b2dc8e005`, `e3f66099796066198604fd8d75116def003b9c42`, `e2ce17a8a147eebb48099f53f73d2345a08410cc`, `c17d9eeb8881011198d9a7b2a53d5d037a398111`, `55371e5c7a743e871c65047a131c21e41cf875fa`, `0e23310d561f100fb606b9c94f9f3ceab10babdd`
- PR: [#3](https://github.com/mylo123ai-hue/SheepWolf/pull/3), targeting `main`, open and not merged
- CI for final implementation commit: [Windows checks, run 40058778363](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40058778363); [PR checks, run 40058786838](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40058786838)
- Results publication commit: this report is published with the final progress/README corrections on the implementation branch.

## Implementation and changed files

Added persistent History and read-only event replay, including historical scenario/profile snapshots, administrator-only details, ordered forum/events/state/results, terminal event ordering, and read-only replay controls. Updated the existing Windows batch launcher and documentation. Expanded Windows CI to exercise a clean launcher install/restart and the protected-credential Settings browser journey using disposable credentials. Added responsive History styling, accessibility/contrast refinements, regression tests, and genuine application screenshots. Blocks 1–5 and the two playable scenarios remain in place. No live provider calls were made.

Files changed from the accepted base:

- `.github/workflows/windows.yml`, `Start SheepWolf.bat`, `package.json`, `package-lock.json`, `README.md`, `AGENTS.md`
- `docs/AI_HANDOFF.md`, `docs/IMPLEMENTATION_PROGRESS.md`
- `docs/screenshots/block6-scenario-library.png`, `block6-live-forum.png`, `block6-live-forum-running.png`, `block6-observer-dashboard.png`, `block6-observer-running.png`, `block6-history-list.png`, `block6-history-detail.png`, `block6-history-discussion.png`, `block6-history-replay.png`, `block6-mobile-replay.png`, `block6-settings.png`
- `src/client/api.ts`, `src/client/ui/App.tsx`, `src/client/ui/history.css`
- `src/server/app.ts`, `src/server/db.ts`, `src/server/db.test.ts`, `src/server/experiment-engine.ts`, `src/server/experiment-engine.test.ts`, `src/server/history.test.ts`, `src/server/migrations/006_history_snapshots.sql`, `src/server/test-support/windows-credential-browser-server.ts`, `src/server/windows-credential-ui.test.ts`
- `src/shared/types.ts`
- `codex/results/SW-B06.md`

## Acceptance evidence

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | History survives restart and represents runs in both scenarios, including settings, administrator roles, forum, events, state, usage, outcomes, and stop/failure/finalization status. | **VERIFIED** | History integration tests cover empty, completed, stopped, failed, and incomplete records and snapshots. In a real local browser flow, completed Capture the Flags and Investigation runs remained viewable after stopping and restarting the production backend against the same SQLite directory. The CTF run showed five safe flags and a Sheep win; the Investigation run showed five Sheep ballots, 12 decisions, seven messages, 33 events, and its recorded outcome. Both retained role counts of five Sheep/two Wolves and correct replay endings. |
| 2 | Replay navigates persisted events without model calls or mutations and preserves privacy. | **VERIFIED** | History tests compare database rows before and after replay reads and assert no provider calls; public API tests verify hidden-role separation. Actual Investigation replay left its 12-decision count unchanged and showed the persisted `run.completed` as the last event. The final ballot event-order regression has a focused assertion. |
| 3 | Existing gameplay, demo, mocked provider, privacy, controls, budgets, scoring, idempotency, and recovery remain functional. | **VERIFIED** | Full Linux and Windows test suites passed. Actual local browser runs completed both demo scenarios; Windows launcher recovery also verified a stopped run after restart. Provider traffic was forbidden in the Windows Settings harness and no paid/live provider calls were made. |
| 4 | Windows launcher clean startup, paths with spaces, readiness, loopback, persistence, recovery, and duplicate launch behavior. | **PARTIAL** | Windows Server 2022 CI copied the app to a clean path with spaces and no `node_modules`, ran `Start SheepWolf.bat` through first-install, verified Node 22, both loopback ports, configured SQLite data under a spaced path, repeated-launch listener reuse, stop persistence, and process-restart recovery. The launcher has friendly failure guidance and README setup/backup/recovery instructions. Direct Windows 10 desktop execution was not available. |
| 5 | Actual Windows browser + protected OS credential storage: save/status/replace/remove/refresh/restart, no leaks, no provider traffic. | **VERIFIED** | Windows Server 2022 CI used headless Chromium and a unique disposable Windows Credential Manager service/account and random fake keys. The actual Settings UI saved and masked the credential, refreshed, replaced it, persisted across a separate app-server process restart, removed it, and confirmed it stayed cleared through refresh and another process restart. Leak scans covered API responses, rendered UI, browser storage, history responses, SQLite/WAL/SHM, and logs. Provider transport rejects outbound provider calls; Test Connection was not invoked. OS/browser versions and screenshots/logs are in artifact `sw-b06-windows-browser-evidence` attached to [run 40058778363](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40058778363). Windows 10 itself remains untested. |
| 6 | Responsive, readable, keyboard-usable Library/Forum/Observer/History/Replay/Settings screens with genuine screenshots and stable live updates. | **VERIFIED** | Actual local Chromium exercised each named screen. Screenshots listed below are from the running app. A live feed grew from 8 to 9 posts while scroll position remained at 250 px; mobile document/body widths stayed at 390 px in a 390 px viewport; keyboard Tab showed a visible 3 px focus outline and visible Library controls had accessible names. Sampled primary text contrast measured 5.01–5.59:1 in light mode and 6.52–7.29:1 in dark mode. This is a focused check, not a complete screen-reader or assistive-technology audit. |
| 7 | Clean-install checks, typecheck, build, tests, passing Windows CI, exact counts, Windows 10 limitation, and no paid API calls. | **VERIFIED** | Exact local and CI commands/results are recorded below. Final Windows CI passed on the implementation commit; no paid or live model requests were made. Windows 10 limitation is explicitly reported. |
| 8 | Reviewable branch/PR, updated docs/progress, pushed results handoff; no merge/deploy. | **VERIFIED** | This report and progress/README updates are committed and pushed on the PR branch; PR #3 targets `main` and remains open/unmerged. No deployment or public release occurred. |

## Commands and verification

Local, from a clean dependency install on Linux:

- `npm ci` — passed; 263 packages installed. npm emitted transitive dependency deprecation notices for `prebuild-install` and `glob`.
- `npm run typecheck` — passed.
- `npm run build` — passed (includes typecheck; Vite production build succeeded).
- `npm test` — passed: 10 files, 69 passed, 2 skipped, 71 total. The skipped checks are Windows-only credential-store/browser checks.

Windows GitHub Actions, final implementation commit `0e23310d561f100fb606b9c94f9f3ceab10babdd`:

- Workflow commands: `npm ci`, `npm run typecheck`, `npm run build`, `npx playwright install chromium`, `npm test`, followed by the PowerShell Windows launcher smoke test.
- Result: all steps passed; 10 test files and 71/71 tests passed, including the protected credential Settings browser flow.
- Environment: Windows Server 2022 Datacenter build `10.0.20348`, Node `v22.23.4`, headless Chromium `156.0.8078.4`.
- Launcher smoke confirmed clean dependency installation, local loopback listeners only on 3000/5173, path-with-spaces handling, no extra listener on repeat launch, and persisted stopped history after process restart.

The CI run retains artifact `sw-b06-windows-browser-evidence`, containing Settings screenshots and `verification.txt`. Direct artifact download from this executor returned `Forbidden`; the artifact remains attached to the linked GitHub Actions run for review.

## Genuine application screenshots

These are captured from the running local application, not generated mockups:

- Library: `docs/screenshots/block6-scenario-library.png`
- Live Forum: `docs/screenshots/block6-live-forum.png`, `docs/screenshots/block6-live-forum-running.png`
- Observer: `docs/screenshots/block6-observer-dashboard.png`, `docs/screenshots/block6-observer-running.png`
- History: `docs/screenshots/block6-history-list.png`, `docs/screenshots/block6-history-detail.png`, `docs/screenshots/block6-history-discussion.png`
- Replay and mobile: `docs/screenshots/block6-history-replay.png`, `docs/screenshots/block6-mobile-replay.png`
- Settings: `docs/screenshots/block6-settings.png`; Windows credential UI screenshots are in the CI artifact.

## Risks, limitations, security, and rollback

- **Windows target:** Windows Server 2022 CI and browser automation passed, but the application was not directly run on Windows 10. Windows 10 x64 compatibility is not claimed as directly verified.
- **Accessibility scope:** focused keyboard, visible-label, mobile-layout, live-feed, and contrast checks passed; no full screen-reader or assistive-technology audit was performed.
- **Provider scope:** tests use mocked transport. No live DeepSeek request or paid provider call was made, so live provider availability and billing behavior were not tested here.
- Windows credential test values were disposable random fakes in an isolated CI runner. The existing user's credentials or security settings were not touched.
- The workflow's browser artifact could not be downloaded from this executor, though it is attached to the linked run.
- **Rollback:** PR #3 is unmerged and `main` is unchanged. To discard the change, close PR #3; if branch cleanup is wanted, delete `codex/sw-b06-mvp-polish`. To back out after any later merge, revert the PR commits rather than rewriting history. No external data store or deployment was modified.

Evidence labels: test counts, runner versions, commits and screenshots above are Codex-reported from commands and workflow output and are independently checkable through the linked GitHub Actions run, PR, commit history, tracked screenshots, and source tests.
