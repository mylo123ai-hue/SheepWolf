# Sheep vs Wolf — Block 05: Real AI, Settings & Recovery

**Status:** OWNER-AUTHORIZED LGM handoff (24 October 2026). This file authorizes *bounded implementation by Cloud Codex*, not automatic launch, merge, deployment or paid usage.

**Authorized repository:** `mylo123ai-hue/SheepWolf` only  
**Exact accepted baseline:** `04339527028b308a7ee30ac7514ed39290a1c529` (`main`, Block 4 completed; Windows Server 2022 CI passed)  
**Handoff branch:** `handoff/block-05-real-ai-settings-20261024`  
**Authoritative references:** `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/IMPLEMENTATION_PROGRESS.md`, and the existing Block 5 scope in `docs/AI_HANDOFF.md`, as they existed at the accepted baseline. Resolve ambiguities in favor of this bounded authorization; do not silently expand the scope.

## GOAL

Make Sheep vs Wolf capable of running its existing two scenarios with *real, opt-in DeepSeek-backed AI decisions*, using administrator-configurable server-side settings, protected local credentials, enforceable request/token/estimated-spend limits, and safe failure/restart behavior. Keep the free simulated mode as the default. Preserve Blocks 1–4.

## SCOPE — authorized engineering

- Work in the authorized GitHub repository and Codex Cloud environment. Start from this handoff branch/commit, create an isolated implementation branch and open a PR targeting `main`. Do **not** bypass review by pushing implementation directly to `main`.
- Inspect existing scheduler, agent decision schema, scenario validators, privacy filters, settings UI, SQLite migrations and tests. Reuse the React/TypeScript + Fastify + SQLite architecture. No additional service/process architecture.
- Implement an asynchronous, typed decision-provider boundary and a documented DeepSeek adapter, with provider/model selection. Check current official provider API/model documentation before assuming model identifiers or response shapes.
- Wire the existing seven-character autonomous engine and both playable scenarios to the provider. Preserve role-specific information separation, scenario server authority, fair scheduling, exactly-one-decision `Step` behavior, start/pause/resume/stop and valid finalization.
- Build usable local administrator Settings: provider and model, masked key entry, save/replace/remove, configured/not-configured status, explicit real-mode enablement, clear Test Connection behavior and errors, per-run limits/usage. Do not claim an unimplemented provider is supported.
- Keep API keys server-side after submission. Use Windows Credential Manager/DPAPI-backed persistent storage on Windows; if safe persistence is not available, use memory-only credentials or fail securely, never plaintext fallback. No key echo in status endpoints, client persistence, logs, error messages, commits or exported data. The initial browser form may necessarily transmit the entered key to the loopback backend; protect it there and discard it from UI state after submission.
- Demo stays free and selected by default; supplying a key alone must not activate paid usage. In deployed app use, a real provider call requires explicit admin selection/enablement and bounded run configuration. The Test Connection control must clearly signal when it could issue an actual provider request and require a direct user action.
- Enforce pre-request caps for provider calls, model token usage where supported, active-time/decision count and a conservatively estimated local spending ceiling; reserve budget before sending and reconcile usage afterward. Clearly label spending limits as locally estimated, not guaranteed provider account caps. Track per-run non-secret usage and failure metadata in SQLite.
- Validate all model outputs against typed actions and scenario rules before committing; use atomic persistence and idempotent decisions. Bound timeout, retries and backoff; treat malformed output, 429/5xx, credentials error and exhaustion safely. No partially accepted forum posts, flag transfers or votes when the provider decision fails.
- Ensure stop/pause/restart during in-flight HTTP work cannot commit an unauthorized late response or duplicate an action. Recover interrupted runs safely.
- Implement mocked transport tests, regression checks for both scenarios, and relevant real browser/HTTP tests using simulated and mocked-provider paths. Where possible verify Windows protected secret storage on Windows CI; state precise residual gaps for Windows 10.

## DO NOT — authority boundaries

- **No real DeepSeek or other provider API calls during implementation, CI or demo verification.** No API-key retrieval from the owner's infrastructure. A genuine paid live connection test requires separate owner authorization.
- No spend, provider account changes, purchase, credentials in repo, public production deployment, VPS access, external app integrations or networked experiment infrastructure.
- Do not access or connect to OpenClaw Lab, HAL, CODE3, Neural, PROJECT SYNC, the Lab Forum, Discord, private networks or the owner's machines. This project remains independent.
- No work on Block 6 (experiment history/replay, release/polish) or unrelated scenario expansion. Do not break or replace the existing free demo.
- No automatic merge, deploy, history rewrite, force-push, new repo access, or irreversible external action. No claims of live-model readiness beyond the actual tested evidence.

## DONE WHEN — observable acceptance

1. From a clean checkout, `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` pass; GitHub Windows workflow is green.
2. The administrator can configure a DeepSeek model and protected key through the local UI, view only masked/configured status, remove the key and opt in/out of real AI explicitly; no insecure plaintext persistence or accidental request.
3. A mocked DeepSeek response drives an actual agent decision through the *existing* engine and each playable scenario without leaking the Wolf roles, private votes, answers or key.
4. Verified negative tests demonstrate malformed response/timeout/429/5xx/limits/credential-store failure leave persistent game state valid and no invalid partial action. Model requests, usage and error records are non-secret and bounded.
5. Pause, stop, one-step, restart and concurrent browser activity cannot duplicate actions or permit late action commits. Prior Capture the Flags and Investigation tests and real-demo flows still pass.
6. Verify real application settings and at least one simulated and one mocked-provider UI/API path with recorded observations. **No paid call is made.** Explicitly distinguish CI/Windows Server verification from direct Windows 10 verification.
7. Produce a reviewable implementation branch/PR, update progress and usage/security instructions, and prepare the Block 6 handoff **without starting Block 6**.

## RETURN — required evidence and handback

- Repository, task branch, PR URL, implementation commit SHA and base SHA; full changed-file list.
- Exact commands and test counts/results, GitHub CI run link, API/UI walkthrough observations, secure-storage tests and real screenshots when UI meaningfully changed.
- Concrete negative test results for secret exposure, limits, invalid outputs, late responses and restart races. State whether any test was mocked vs directly executed.
- Any blocking issue, security/Windows limitations, limitations of local cost estimation and a recovery/rollback reference. Never report unverified tests as passed.
- Updated `docs/IMPLEMENTATION_PROGRESS.md` and next Block 6 handoff path; **leave this signed-off Block 5 handoff unchanged** as historical scope evidence.
- End task after reporting; no automatic merge, deploy, paid smoke test or Block 6 start.

**Execution note:** One approximate four-hour-sized engineering work package, not a guarantee of uninterrupted four-hour Cloud Codex runtime. Codex autonomously handles ordinary implementation, test and recovery within this scope.
