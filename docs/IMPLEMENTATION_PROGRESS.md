# Implementation progress

## Block 1 — Foundation and GUI

**Status:** Implemented and verified locally.

**Commit:** `83b5dfc` — Block 1 application foundation.

**Evidence:** `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` passed (2 tests). Vite/Fastify health, scenario catalog, seeded nested replies, HTTP post/reply persistence, built UI, and Windows Server 2022 / Node 22 CI configuration were verified. Windows 10 itself was not directly tested.

## Block 2 — Autonomous agents and live forum

**Status:** Implemented and verified locally; committed with this progress update.

**Implemented:** A shared SQLite-backed scheduler creates runs with exactly five Sheep and two Wolves from independently recorded per-run role seeds. Stable character identities are reused with fresh per-run memory. Agent context contains only that participant's objective and permitted knowledge; Wolves know their teammate, while Sheep do not. The simulated provider generates varied posts, replies, silence, ending proposals, and votes without external services. The engine persists decisions, memory updates, run-scoped forum messages, lifecycle changes, and ordered events transactionally. Round-robin fairness among participants with the fewest opportunities avoids a fixed character order. Duration and decision caps, two-opportunity minimum, three-Sheep ending agreement, pause-aware active time, and interruption recovery are enforced. Observer controls and role details, current-run refresh, forum discussion, activity stream, and SSE-driven UI updates use real experiment state. Empty lifecycle requests no longer carry an invalid JSON content type.

**Verification:** `npm ci` succeeded after moving `better-sqlite3` to `^12.11.1` to fix Node 24 native binding startup failures; `npm run typecheck` passed; `npm run build` passed; `npm test` passed (14 tests across 3 files). Browser checks through headless Chromium exercised Start, Pause, exactly-one Step, Resume, Stop, refresh persistence without duplicate decisions, and SSE-driven live forum posts/replies. HTTP checks confirmed public summaries omit participant roles and a full simulated run completed by three-Sheep consensus (22 decisions, 15 posts, 9 replies). A stopped run retained a null outcome. A separate process restart recovered a running experiment as paused with its run/participant data intact. No external or paid model calls were used. Automated checks cover role counts/seeds, private knowledge, fresh memory, varied fair ordering, post/reply persistence, controls, consensus thresholds, decision/time limits, interrupted-run recovery, and request headers.

**Known limits:** The two listed scenarios still use the shared Block 2 discussion/ending lifecycle only. Capture the Flags actions/scoring and The Investigation actions/scoring are not implemented in this block. Real model providers, history/replay, and direct Windows 10 runtime verification remain outstanding. CI is configured for Windows Server 2022 with Node 22; this environment did not provide Windows for direct testing.

**Commit:** To be recorded after the Block 2 commit is created.

**Next block:** Block 3 — playable Capture the Flags mechanics. Assignment: `docs/AI_HANDOFF.md`.
