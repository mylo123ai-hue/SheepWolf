# AI handoff — Sheep vs Wolf Block 2

Copy the prompt below into the next Codex session.

---

## Prompt for the next engineering session

Continue work in the existing `mylo123ai-hue/SheepWolf` repository. The current `main` branch contains Block 1. Start by checking `git status`, reading `AGENTS.md`, `docs/PRODUCT_SPEC.md`, and `docs/IMPLEMENTATION_PROGRESS.md`, then inspect the current implementation before changing it. The last verified foundation commit is `83b5dfc`; the progress-log commit is `9d093c8`.

Complete **Block 2 only: Autonomous Agents and Live Forum** from the product spec. Work autonomously on routine engineering decisions. Do not stop at a design or mock screen: implement the shared engine, connect the UI and API to it, and verify the working demo. Do not advance into the two scenario implementations assigned to Blocks 3 and 4.

### Required Block 2 result

A local administrator can start a no-cost simulated run with the seven recurring characters. The shared engine assigns five Sheep and two Wolves for that run, runs eligible agents without a fixed speaking order, persists decisions and discussion, streams new activity to the browser, and responds correctly to start, pause, resume, single-step, and stop. The same run survives a browser refresh; after a backend restart, an interrupted run is recovered safely rather than silently continuing or being lost.

### Implementation scope

- Preserve the existing React/TypeScript, Vite, Fastify, SQLite, loopback-only architecture. Add versioned migrations for new run data.
- Create per-run experiment and participant records, an immutable settings snapshot, role seed/assignment, decisions, events and run-scoped forum posts/replies. Preserve the existing preview content; do not relabel those sample posts as AI-generated.
- Keep all seven stable character identities and profiles. Assign roles afresh per run and record the assignment. The observer may retrieve roles and private objectives from administrator endpoints. Participant-facing data and model context must not expose hidden Wolf identities, other agents’ private instructions, or admin data. Wolves may know their fellow Wolf. Give every run fresh conversation memory.
- Implement one shared scheduler in the backend. Select among eligible agents with reasonable fairness and without a fixed Sheep-then-Wolf sequence. Agents may post, reply, remain silent, propose an ending, or respond to a proposal. Use one simulated decision provider; do not call external model services or present the demo as real AI.
- Persist accepted decisions and their effects safely. Prevent overlapping decisions, make step execute exactly one eligible decision while paused, respect pause/stop promptly, and recover an interrupted `running` status as paused or an explicitly recorded incomplete run.
- Enforce adjustable limits from the run snapshot, with defaults of 20 active minutes and 100 decisions. Paused time must not count. Each participant needs two decision opportunities before early ending is available. Early conclusion requires agreement from at least three of the five Sheep. The engine must expose a typed scenario lifecycle boundary for terminal checks/finalization, but do not implement Capture the Flags or Investigation mechanics in this block. If no scenario score can yet be produced, store an unscored/neutral conclusion; never invent a victory.
- Add server-sent events (or a similarly reliable local live-update path) for posts, decisions, status and scenario events. Keep historical refresh separate from producing new decisions; reconnecting a browser must not duplicate actions.
- Wire the Observer Desk with real participant roles, recent decisions, counters and lifecycle controls. Wire the forum to the selected run and retain readable discussion/activity views. Make run status and simulated-demo labeling clear. The administrator does not speak as a participant.
- Use server-side validation and ensure ordinary participant API responses never include administrator-only fields. Do not expose credentials; none are needed in this block.

### Verify before finishing

Add focused unit/integration tests for role counts and role privacy, fresh per-run memory, fairness/eligibility, post/reply persistence, one-step behavior, pause/resume/stop, ending thresholds, action/runtime limits, idempotency and interrupted-run recovery. Mock the decision provider. Do not use paid API calls.

Run from a clean dependency state where practical:

```sh
npm ci
npm run typecheck
npm run build
npm test
```

Also run the app and demonstrate a complete simulated run through actual HTTP/UI controls, including pause, one step, resume or stop, refresh persistence and live forum updates. Record what was observed; a successful build alone is not evidence of a functioning engine. Keep the Windows CI workflow passing. A Windows 10 machine may not be available, so state that limit accurately.

Update `docs/IMPLEMENTATION_PROGRESS.md` with implemented behavior, exact verification evidence, known limitations, commit hash and Block 3 as the next step. Update docs if implementation assumptions change. Commit the completed Block 2 work and push the commit to the existing `main` branch without rewriting history. Do not claim real AI, playable scenario mechanics, scenario scoring, history replay, or Windows 10 runtime verification unless they have actually been implemented and tested.

---

## Current repository state

- Block 1 foundation is on `main` and pushed to GitHub.
- Main app files: `src/client/ui/App.tsx`, `src/client/ui/styles.css`, `src/client/api.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/catalog.ts`, and `src/server/migrations/001_initial.sql`.
- Demo forum examples are persistent SQLite seed data and explicitly not autonomous output.
- `Start SheepWolf.bat` is provided. Windows CI uses `windows-2022` and Node 22. Windows 10 itself was not directly tested.
- Latest progress and verification evidence are in `docs/IMPLEMENTATION_PROGRESS.md`.
