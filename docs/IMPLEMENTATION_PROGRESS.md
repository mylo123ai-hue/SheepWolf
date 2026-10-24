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

**Next block:** Block 5 — Real AI, Settings and Recovery. Assignment: `docs/AI_HANDOFF.md`.
