# AI handoff — Sheep vs Wolf Block 5

Copy this assignment into the next Codex session.

---

## Assignment: Block 5 — Real AI, Settings and Recovery

Continue in `mylo123ai-hue/SheepWolf`. Inspect `git status`, `AGENTS.md`, `docs/PRODUCT_SPEC.md`, this handoff, `docs/IMPLEMENTATION_PROGRESS.md`, recent commits, provider code, current UI and tests. Blocks 1–4 are implemented and must be preserved. Implement **Block 5 only**. Do not build History/replay, the Windows launcher, Block 6 polish, or unrelated features.

Work autonomously on routine engineering decisions. Keep React/TypeScript, Fastify and SQLite. Use no paid model calls during development and do not deploy or access external infrastructure. You may use provider documentation to verify supported API paths and model identifiers, but do not send live requests unless the owner separately authorizes a connection test.

### Goal

Add administrator-configurable, server-side real AI using DeepSeek as the first supported provider. Keep the no-cost simulated provider as the default. Let an administrator save and test credentials, explicitly enable real mode, choose a model identifier, set execution/spending limits, and use the provider for participant decisions through the existing shared engine.

### Provider and execution

- Introduce/complete a typed provider interface that supports asynchronous provider requests without creating per-agent processes. Update the shared scheduler and `Step` control so only one experiment decision is in flight and `Step` still awaits exactly one accepted agent decision.
- Preserve all seven character identities, scenario-specific knowledge boundaries, no-fixed-turn fairness, persisted decisions, scenario validation, lifecycle controls, and Capture the Flags / Investigation behavior for both providers.
- Implement a DeepSeek adapter only after checking its current documented API format and model IDs. Store provider/model metadata, request IDs when supplied, elapsed time, usage totals, and non-secret errors. Never log prompts containing privileged data or API credentials unnecessarily.
- Validate model output against the existing typed action schema and scenario validators. Malformed output, timeout, HTTP error, rate limit, or provider rejection must not create partial posts, votes, transfers, or game state. Retry only transient errors, with a small bounded retry count and backoff. Mark terminal provider failure clearly and never manufacture a scenario victory.
- Automated tests must mock provider transport. Do not make real provider requests as part of tests or routine development.

### Settings and credential security

- Build a usable Settings screen for provider, configurable model ID, masked key entry, save/replace/remove, Test Connection, connection status/errors, and a visible Real AI enable control. DeepSeek alone may appear supported until another adapter is implemented and tested.
- Demo mode remains the default. An API key alone must not activate real requests. Paid requests are permitted only when the administrator explicitly enables real AI and starts a run in that mode.
- Store secrets only on the server. Never return, export, commit, or log credentials. Use Windows OS-protected credential storage (Credential Manager/DPAPI-backed) for persistent Windows credentials. Where a secure persistent backend is unavailable, allow temporary in-memory configuration or refuse persistent save; never silently fall back to plaintext storage.
- Provide a server endpoint/status response that reveals only whether a credential is configured, not the key or a reversible form of it. Ensure browser request/response bodies and error messages do not echo secrets.

### Local limits and recovery

- Enforce maximum model requests, configured token limits where supported, experiment duration, agent decisions, and local estimated spending ceiling before each provider request.
- Track requests and input/output usage per run. Reserve estimated cost before sending; reconcile with returned usage afterward. Where exact pricing/usage is unknown, use a conservative estimate and reject a request that exceeds the configured local ceiling. Explain that a local estimate is not a provider-enforced account cap.
- Ensure pause/stop/restart during an outstanding request cannot apply an action twice or commit after a run has changed state. Persist enough non-secret metadata to review provider usage and failures after restart.
- Keep bounded request timeouts and retries. Do not retry indefinitely.

### Verification

Add automated tests for mocked success, model-specific configuration, explicit enablement, secrets omitted from API/log/errors, secure storage failure behavior, usage accounting, pre-request budget rejection, timeout/rate-limit/malformed output, bounded retries, no partial action persistence, pause/stop races, one-decision scheduling, and restart recovery. Keep all Capture the Flags and Investigation tests passing.

Run and record exact results:

```sh
npm ci
npm run typecheck
npm run build
npm test
```

Verify the UI/API with demo mode and mocked real-provider responses. Do not call a paid provider during development. Keep Windows CI green and state clearly that Windows Server CI is not direct Windows 10 testing. Windows Credential Manager behavior should be tested on Windows CI where feasible; report any secure-store behavior that is still unverified on Windows 10 itself.

### Completion

- Commit and push to existing `main` without rewriting history, following repository authorization.
- Update `docs/IMPLEMENTATION_PROGRESS.md` with implemented and verified features, exact checks, CI result, commit, limits, and Block 6 next.
- Replace this file with the Block 6 assignment.
- Do not start Block 6.
- Do not claim DeepSeek production-ready if only mocked behavior was tested; report that no live provider request was made.

---

## Current verified state

- Block 1 foundation/UI: `83b5dfc`.
- Block 2 autonomous simulated engine/live forum/recovery: `7100e3e`.
- Block 3 Capture the Flags: `f27e68c`.
- Block 4 The Investigation: see the latest commit and evidence in `docs/IMPLEMENTATION_PROGRESS.md`.
- Runtime: local Node.js, Fastify, SQLite, React/Vite; existing Windows workflow uses Windows Server 2022 and Node 22. Windows 10 was not directly verified in the prior blocks.
- Both games run through the shared no-cost simulated engine. The Investigation uses a server-side scenario snapshot, private opinions, and final Sheep verdicts. The next task is provider configuration and bounded real AI execution; no paid calls have been made.
