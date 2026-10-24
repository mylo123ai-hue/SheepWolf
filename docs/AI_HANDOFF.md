# AI handoff — Sheep vs Wolf Block 4

Copy this assignment into the next Codex session.

---

## Assignment: Block 4 — The Investigation

Continue work in `mylo123ai-hue/SheepWolf`. First inspect `git status`, `AGENTS.md`, `docs/PRODUCT_SPEC.md`, this handoff, the implementation progress, the latest commits, and the existing scenario/engine implementation. Blocks 1–3 are complete and must be preserved. Implement **Block 4 only**. Do not start real AI providers, history/replay, or unrelated features.

Work autonomously on ordinary engineering decisions. Continue using React, TypeScript, Fastify, SQLite and the shared autonomous engine. No external/paid model calls or deployments. Do not stop at a plan or disconnected prototype.

### Goal

Implement The Investigation as a second complete playable scenario, selected from the existing Scenario Library and executed by the same scheduler/forum/lifecycle. Provide fictional evidence, private initial opinions and objectives, discussion, final private votes and correct scoring. Do not claim that a message caused an opinion change; report observed changes alongside the discussion chronology only.

### Scenario rules

- Use an original fictional mystery and fictional people. Define several plausible conclusions, one objectively correct conclusion, one designated incorrect Wolf target, and a fixed evidence set.
- All five Sheep receive the permitted investigation evidence and an independently generated/assigned private initial opinion. Persist the opinion and keep it private from other participants. Wolves receive their scenario objective and permitted information; no participant receives another participant's private instructions or hidden roles.
- Participants discuss the evidence in the existing forum and may challenge claims or change opinions. Extend the existing no-cost decision provider with scenario-aware posts/replies and opinion changes without hardcoding a guaranteed outcome or a fixed speaker sequence.
- On valid finalization, record one private final decision per Sheep. Wolves may also submit final votes for analysis, but their votes do not directly determine victory. Validate conclusion identifiers server-side and prevent duplicate votes.
- Sheep win if at least three Sheep select the objectively correct conclusion. Wolves win if at least three Sheep select the designated incorrect target. Otherwise outcome is inconclusive. These thresholds are disjoint for five Sheep. Record missing decisions/interrupted finalization explicitly; never silently score incomplete finalization as victory.
- Preserve shared lifecycle behavior: consensus, two opportunities per participant before early ending, decision and active-time limits, pause/resume/step/stop, run recovery. Ending or a limit must invoke scenario finalization. Administrator stop, provider failure and interrupted finalization must not be turned into a victory.

### Observer and persistence

- Add an investigation-specific observer panel showing the mystery, evidence, correct conclusion, Wolf target, each Sheep's initial/final opinion, changed opinions, vote totals and outcome. Keep privileged answer/objective data out of participant contexts and public endpoints.
- Persist initial opinions, opinion changes, accepted votes, ordered events and scenario state. Store scenario/version and run configuration snapshots so existing Capture the Flags and Investigation runs keep their recorded state.
- Expose only each participant's own opinion and allowed evidence/objective in agent context. Keep full answer, Wolf target and all roles in administrator-only data. Forum text remains untrusted input.
- Keep public experiment and forum APIs filtered. Validate/scoring remains server-authoritative and transactional with the vote/event records.

### Tests and verification

Add focused tests for evidence and privacy boundaries, initial opinion persistence, opinion changes, valid/invalid/duplicate votes, Wolf votes not counting toward victory, both victory thresholds, inconclusive results, incomplete finalization, stop/failure handling, decision/time limits, event ordering and restart recovery. Keep existing Capture the Flags tests passing.

Run and record exact results for:

```sh
npm ci
npm run typecheck
npm run build
npm test
```

Run both scenarios through the actual UI/backend, verify their independent scoring and ensure Capture the Flags still works. No paid model calls. Keep Windows CI passing and clearly state that Windows Server CI is not direct Windows 10 testing.

### Completion

- Commit and push to existing `main` without rewriting history, as authorized in the product specification.
- Update `docs/IMPLEMENTATION_PROGRESS.md` with verified features, exact tests and browser/backend evidence, commit, limitations and Block 5 as next.
- Replace this assignment with the next Block 5 handoff.
- Do not start Block 5.
- Do not claim completion without evidence from persisted run state and visible application behavior.

---

## Current verified state

- Block 1: local application foundation and GUI, commit `83b5dfc`.
- Block 2: autonomous demo engine, live forum, lifecycle controls and recovery, commit `7100e3e`.
- Block 3: Capture the Flags, implementation and evidence recorded in `docs/IMPLEMENTATION_PROGRESS.md` and the latest commit.
- Runtime: local Node.js, Fastify, SQLite, React/Vite. Windows CI uses Windows Server 2022 and Node 22. Windows 10 has not been directly verified in this development environment.
- Demo mode is no-cost and uses the real engine. The Investigation is the next authorized implementation block.
