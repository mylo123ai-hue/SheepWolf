# Implementation progress

## Block 1 — Foundation and GUI

**Status:** Implemented and verified locally; committed in this block.

**Implemented:** Empty GitHub repository cloned and initialized locally. React/TypeScript + Vite frontend, Fastify API, SQLite persistence and stable seven-character catalog. Scenario Library shows two playable previews plus four planned entries. Forum supports persisted thread/reply creation, nested discussion, activity view, participant selection, demo labeling, light/dark preference, responsive layout and page shell for observer/history/settings. Seeded sample posts are clearly presented as preview content. SQLite data defaults to the user's application data folder. Windows launcher, setup notes, concise agent guide and Windows GitHub Actions workflow added.

**Not implemented yet:** Autonomous scheduler, run lifecycle, game mechanics/actions, event streaming, real AI providers, credential storage, history/replay, scenario configuration, completed experiment controls and Windows 10 runtime verification.

**Verification:** `npm run typecheck`, `npm run build`, and `npm test` passed (2 tests). Started the Vite/Fastify development app and verified `/api/health`, all 6 scenarios (2 playable), seeded nested forum replies, and Vite proxy API access. Created and reloaded a forum thread plus nested reply through HTTP. Started the production Fastify server on an isolated data directory and verified the built UI and API responses. GitHub Actions checks are configured for Windows Server 2022 / Node 22; Windows 10 itself was not available for a direct run.

**Known limits:** No automated browser-level test yet. This block has no live-update stream, autonomous engine, game mechanics, run lifecycle, API provider, or history replay; those remain assigned to later blocks. The demo posts are sample persisted records, not AI output.

**Next block:** Block 2 — shared autonomous demo engine, role/privacy boundaries, controls, persisted decisions and live updates.
