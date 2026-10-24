# Implementation progress

## Block 1 — Foundation and GUI

**Status:** Implemented and verified locally. **Commit:** `83b5dfc` — Block 1 application foundation.

The React/TypeScript, Fastify, SQLite and Vite application provides the responsive local-first interface, scenario library, forum foundation, migrations and Windows Server 2022 / Node 22 CI. `npm ci`, typecheck, build and tests passed at completion. Windows 10 itself was not directly tested.

## Block 2 — Autonomous agents and live forum

**Status:** Implemented and verified locally. **Commit:** `7100e3e` — Implement autonomous demo engine and live forum.

The shared engine assigns five Sheep and two Wolves per run, maintains fresh participant memory and server-side knowledge boundaries, schedules simulated actions, persists forum activity and decisions, supports lifecycle controls and ending consensus, streams activity, and pauses interrupted runs for recovery. Verification and Block 2 test evidence are retained in the previous commit history; no external model calls were used.

## Block 3 — Capture the Flags

**Status:** Implemented and verified locally. **Commit:** `f27e68c` — Implement Capture the Flags scenario.

Five stable per-run flags begin with the five Sheep. The server validates explicit custodian-authorized transfers, persists accepted transfers atomically with ordered events and decisions, prevents duplicate/repeated captures, and permanently captures a flag received by a Wolf. Three distinct captures immediately win for Wolves. A valid consensus or execution-limit conclusion scores Sheep only when at least three flags remain safe; stop/failure remains unscored. Transfer events are observer-visible and selectively participant-visible, while participant views and public events omit privileged flag/role state. Restart recovery preserves flag and transfer state.

The Observer Desk displays live ownership, safe/captured totals, transfer history, and captured-flag victory progress. Capture the Flags is selectable; The Investigation was marked planned at the end of Block 3. The no-cost simulation uses the same engine and persisted forum/action records. Browser screenshots: `docs/screenshots/scenario-library.png`, `docs/screenshots/capture-the-flags-live-forum.png`, `docs/screenshots/observer-flags.png`, `docs/screenshots/completed-game-outcome.png`, and `docs/screenshots/mobile-live-forum.png`.

**Verification:** `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` passed (22 tests across 3 test files). Automated coverage includes inventory, role and context privacy, safe and Wolf transfers, invalid custody/target cases, captured flag immutability, Wolf victory, valid Sheep outcomes, stopped runs, persistence/recovery, and provider-driven demo behavior. A headless Chromium walkthrough used the actual UI and HTTP API: started a Capture the Flags run, observed live forum and Observer Desk updates, completed 43 persisted decisions and 40 forum rows, and verified the completed Sheep victory displayed five safe flags. The SQLite database contained five flags, one persisted voluntary transfer (Clover → Ash), 43 decisions, and 88 ordered experiment events. Public events excluded private transfer details; observer events included them. Screenshots are saved under `docs/screenshots/`.

No paid or external model calls were made. Windows CI remains configured for Windows Server 2022 / Node 22; this environment did not provide Windows, so direct Windows 10 execution was not verified.

**Known limits:** Real model providers, experiment history/replay, and Windows 10 runtime verification remain future work. Demo conversations are simulated, not evidence of genuine model reasoning.

## Block 4 — The Investigation

**Status:** Implemented and verified locally. **Commit:** `1f91f14` — Implement The Investigation scenario.

The Investigation is playable from the Scenario Library and Observer Desk. A versioned fictional archive case, five evidence items, four possible conclusions, the correct answer, and the Wolf target are stored as a per-run snapshot. Every run assigns fresh private initial opinions. Participants receive only their own opinion, the case, allowed evidence, role objective, and normal run context; Sheep do not receive the answer or Wolf target. Wolves receive the target through their private objective.

The no-cost agents make case-specific discussion posts and replies, may change Sheep opinions privately, participate in the shared ending consensus, and submit one private Sheep verdict each during finalization. The engine reserves five decisions for votes at the decision cap, freezes active-time accounting while final votes are collected after a time cap, and marks missing votes `incomplete_finalization` instead of scoring partial ballots. Server validation and SQLite constraints reject invalid or duplicate votes. Votes, opinions, changes, events, and outcomes persist transactionally. Sheep win with three correct votes, Wolves win with three votes for their designated target, and other complete ballots are inconclusive. Stop and provider failure remain unscored.

The Observer Desk shows the answer key, Wolf target, evidence, vote totals, initial/current/final Sheep opinions, opinion changes, missing votes, and outcome. The forum presents the case and evidence to participants. Public summaries and public event streams do not expose administrator state or private votes. The UI labels the final-vote phase and distinguishes incomplete finalization.

**Verification:** `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` passed (35 tests across 3 files). Tests include privacy boundaries, initial opinions, changes, invalid and duplicate ballots, both victory paths, Wolf votes excluded from scoring, inconclusive outcomes, incomplete budgets, stop/failure, duration/decision limits, event ordering, persistence/recovery, and complete no-cost demos. Real browser and HTTP verification used the local application: an Investigation run completed 35 decisions, 22 posts, 9 replies, one opinion change, and five Sheep votes; it ended with a Wolf victory (three target votes and one correct vote). A refresh preserved the completed run. A separate browser-started Capture the Flags run completed 23 decisions with five safe flags, one voluntary transfer, and a Sheep victory. SQLite state matched the visible results. Public experiment summaries omitted participant roles and scenario state. No paid or external model calls were made. Actual UI screenshots: `docs/screenshots/investigation-library.png`, `docs/screenshots/investigation-live-forum.png`, `docs/screenshots/investigation-observer.png`, and `docs/screenshots/investigation-mobile-forum.png`.

The pushed Block 4 commit passed [Windows checks on Windows Server 2022 / Node 22](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40048692409), including `npm ci`, typecheck, build, and tests. Windows 10 itself was not directly tested. Demo decisions are scripted and do not demonstrate genuine model reasoning. Real providers, history/replay, and the Windows launcher remain future work.

## Block 5 — Real AI, Settings and Recovery

**Status:** Implemented and verified on `codex/block-05-real-ai-settings`, based on handoff commit `e4ac8b8f64acab1087365a9d412ac590a5a2fa43`. Implementation commit: `1069ef1c03a9313d2c8d97b0418ae92903ff0fad`. Open review: [PR #2](https://github.com/mylo123ai-hue/SheepWolf/pull/2), targeting `main`; not merged.

The shared asynchronous provider boundary now supports both the unchanged no-cost demo provider and the DeepSeek provider for Capture the Flags and The Investigation. Settings let the administrator choose the documented `deepseek-flash` or `deepseek-v4-pro` model, save/replace/remove a key, select OS-protected or session-only storage, test the connection with an explicit confirmation, enable Real AI, and set request/token/estimated-cost limits. Demo remains the run default; a key by itself cannot start model requests. DeepSeek generation calls use typed JSON actions, role-filtered run context and scenario validation. The only real provider operation available from Settings is the user-initiated `/models` connection check. No live provider call was made in development or verification.

Windows credentials use the OS Credential Manager integration; local credential settings never store the secret in SQLite and responses expose only configured/storage status. Session keys exist only in process memory. Request attempts reserve estimated cost and tokens before transport, then persist non-secret request metadata and reconcile reported usage. Requests and retries are bounded. Pause, stop, turning off Real AI and process restart invalidate outstanding decisions; accepted actions are applied transactionally only when run status/control version still matches. Provider failure leaves the game unscored and accepted state unchanged.

**Verification:** `npm ci` passed (261 packages installed; two transitive dependency deprecation notices). `npm run typecheck` passed. `npm run build` passed (Vite 6.4.5). On Linux, `npm test` passed: **61 passed, 1 skipped, 8 test files total**. The platform-gated Windows Credential Manager test was skipped on this runner. GitHub [Windows checks passed](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051159659): `npm ci`, typecheck, build and **62 tests passed**, including the Windows Credential Manager round trip on Windows Server 2022 / Node 22. The PR's second Windows run also passed [all checks](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051171618). These are Windows Server checks, not direct Windows 10 testing. Automated mocked tests cover both scenario engines, role-scoped prompts, settings and key privacy, no-plaintext credential failure, malformed/oversized/key-echoed provider content, timeout/rate limit retries, request/token/spend limits, no partial actions, exact-one Step, pause/stop/disable races and interrupted request recovery.

The local Chromium walkthrough used the actual Settings, Live Forum and Observer Desk screens with a disposable fake session key and a demo run. It enabled the setting without starting a real run, removed the fake key, observed 3 demo decisions and persisted forum activity, verified Pause, exactly-one Step, unscored Stop and refresh persistence. Screenshots: `docs/screenshots/block5-real-ai-settings.png`, `docs/screenshots/block5-real-ai-settings-mobile.png`, `docs/screenshots/block5-demo-live-forum.png`, and `docs/screenshots/block5-demo-observer.png`. The mocked HTTP provider path is exercised in tests, including a real engine step and The Investigation configuration; all transport responses are injected mocks. Windows 10 itself was not directly tested.

**Known limits:** No live DeepSeek connection or generation request was made, so provider compatibility beyond the documented contract and mocks remains unverified. Local spending estimates use the highest listed current price with margin; they are not provider-enforced caps. Windows Credential Manager is covered by the Windows CI test when that workflow succeeds; actual Windows 10 shell/UI behavior remains unverified. The Test Connection button makes one user-requested, non-generation request to `/models` after explicit confirmation.

**Next block:** Block 6 — Product Polish and Release, assigned in `docs/AI_HANDOFF.md`. Do not begin Block 6 until separately authorized.

**Next block:** Block 5 — Real AI, Settings and Recovery. Assignment: `docs/AI_HANDOFF.md`.
