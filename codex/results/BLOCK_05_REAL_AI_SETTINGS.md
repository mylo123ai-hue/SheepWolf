# Block 5 — Real AI, Settings and Recovery: Results

**Evidence snapshot:** 24 October 2026. **Status: PARTIAL** — one required mocked failure-path assertion and one platform UI flow were not directly verified.

- **Repository:** `mylo123ai-hue/SheepWolf`
- **Branch:** `codex/block-05-real-ai-settings`
- **Base:** `e4ac8b8f64acab1087365a9d412ac590a5a2fa43`
- **PR:** [#2 — Implement opt-in DeepSeek AI settings and recovery](https://github.com/mylo123ai-hue/SheepWolf/pull/2), targeting `main`; open, not merged.
- **Implementation commit:** `1069ef1c03a9313d2c8d97b0418ae92903ff0fad`
- **Progress/Windows evidence commit:** `2327fa1c50946b688c561b39f151eec5400e9517`

## Acceptance criteria

Criteria below are from `docs/handoffs/BLOCK_05_REAL_AI_SETTINGS.md`. “Partial” means the feature is implemented but the specified evidence has a gap; it is not a claim that the untested path is broken.

| # | Status | Acceptance evidence |
|---|---|---|
| 1. Clean install, typecheck, build, tests, and green Windows workflow | **COMPLETED** | Local `npm ci`, `npm run typecheck`, `npm run build`, and `npm test` passed. Linux had 61 passing and 1 Windows-only skipped test. Windows Server 2022 / Node 22 CI passed all four commands with 62/62 tests, including the Credential Manager test. Runs: [40051341586](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051341586) and [40051345167](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051345167). |
| 2. GUI model/key configuration, protected storage, masked status, removal, explicit opt-in, no plaintext or accidental calls | **PARTIAL** | The local Chromium Settings walkthrough saved and removed a fake session-only key; the UI showed only masked/configured status and allowed enabling Real AI without starting a real run. Fastify tests verified secrets are absent from responses and SQLite. Credential vault tests reject plaintext fallback. The OS Credential Manager round trip passed on Windows CI. The protected-storage button-to-Windows-credential UI flow was not exercised in a browser on Windows. No provider request was sent by the walkthrough. |
| 3. Mocked model drives real engine decisions in both scenarios without private-data leakage | **COMPLETED** | Injected mock transport drove a persisted Capture the Flags post through the shared engine (`real-ai-engine.test.ts`) and an Investigation decision through the Fastify start/pause/Step path (`app.test.ts`). Prompt tests verified a Sheep context omits the answer and Wolf target and includes only role-permitted context. Both scenarios still pass their existing engine regression tests. |
| 4. Negative cases, bounded limits, no partial actions, and non-secret request metadata | **PARTIAL** | Tests cover malformed JSON/actions, echoed keys, credential errors, timeout, 429, retry bounds, budget rejection/overrun, invalid scenario actions, no partial posts/flags/votes, and non-secret request/usage rows. The adapter handles HTTP 5xx as retryable with a two-attempt bound, but no focused mocked 5xx assertion was present in the verified suite. This is the remaining acceptance-test gap. |
| 5. Pause, stop, Step, restart, and concurrent calls cannot duplicate or apply late decisions | **COMPLETED** | Tests cover exact-one Step, overlapping Step rejection, pause/stop/disable cancellation, graceful in-flight restart, orphaned reservation recovery, and conservative budget retention. The local browser walkthrough verified Pause, one Step increment, unscored Stop, and unchanged persisted state after refresh. Existing Capture the Flags and Investigation regression tests passed. |
| 6. Demo and mocked-provider UI/API verification, no paid call, Windows distinction | **COMPLETED** | Actual local Chromium screens exercised Settings, Live Forum, Observer Desk and demo controls. The mocked-provider API/engine path is covered by tests. No live `/models` or generation request was made. Windows Server CI is reported separately from direct Windows 10 testing. |
| 7. Reviewable branch/PR, progress/security docs, Block 6 handoff prepared but not started | **COMPLETED** | Branch is pushed and PR #2 is open against `main`; this results report and corrected progress entry are being added to that branch. `README.md` documents configuration, privacy, opt-in and estimated-cost limits. `docs/AI_HANDOFF.md` contains the Block 6 assignment; no Block 6 implementation started. |

## Implementation summary

- Added a typed asynchronous provider boundary and DeepSeek adapter for the documented `deepseek-flash` and `deepseek-v4-pro` model identifiers.
- Added provider Settings for model, masked credential status, save/replace/remove, protected OS storage or session-only memory, explicit Real AI enablement, request/token/spend limits, and confirmed Test Connection behavior.
- Kept demo as the default. The only provider test operation is an explicit, confirmed `/models` request; generation requests are only available to an explicitly enabled and explicitly selected real-mode run.
- Added SQLite provider settings and request ledger migrations; reserves requests, tokens and estimated cost before transport and records non-secret request, usage, timing and error metadata.
- Added output/schema validation, scenario validation, bounded timeout/retry behavior, run-control version checks, cancellation, safe restart recovery, and refusal to score provider failures.
- Preserved both scenarios and added regression coverage for the async provider path.

## Exact verification

Local Linux commands, on implementation commit `1069ef1c03a9313d2c8d97b0418ae92903ff0fad`:

```text
npm ci               PASS — 261 packages installed
npm run typecheck    PASS
npm run build        PASS — Vite 6.4.5
npm test             PASS — 61 passed, 1 skipped; 8 test files (7 passed, 1 skipped)
```

The single skip was `credential-store.windows.test.ts`, gated to Windows. The passing test suites were:

- `experiment-engine.test.ts` — 31 tests
- `real-ai-engine.test.ts` — 11 tests
- `deepseek-provider.test.ts` — 7 tests
- `app.test.ts` — 4 tests
- `credential-vault.test.ts` — 4 tests
- `db.test.ts` — 2 tests
- `client/api.test.ts` — 2 tests
- `credential-store.windows.test.ts` — 1 skipped on Linux; **passed on Windows CI**

Windows Server 2022 / Node 22 CI on the PR branch passed `npm ci`, typecheck, build and `npm test`: 8 test files passed, 62 tests passed. Both runs [40051341586](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051341586) and [40051345167](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40051345167) are green. This does not establish direct Windows 10 behavior.

## Application walkthrough and screenshots

Actual local Chromium and HTTP walkthrough, using a disposable fake key and a temporary local SQLite data directory:

1. Opened Settings, stored the fake key as session-only, enabled Real AI and saved settings without launching a real run.
2. Removed the key, then started a simulated Capture the Flags run from the Observer Desk.
3. Observed 3 persisted decisions and forum rows; paused, stepped exactly once, stopped without an outcome, refreshed, and confirmed the stopped state and decision count persisted.
4. Confirmed the fake key was removed and Real AI was disabled after the walkthrough.

Screenshots are committed from the running application:

- Desktop Settings: [`docs/screenshots/block5-real-ai-settings.png`](../../docs/screenshots/block5-real-ai-settings.png)
- Mobile Settings: [`docs/screenshots/block5-real-ai-settings-mobile.png`](../../docs/screenshots/block5-real-ai-settings-mobile.png)
- Live Forum: [`docs/screenshots/block5-demo-live-forum.png`](../../docs/screenshots/block5-demo-live-forum.png)
- Observer Desk: [`docs/screenshots/block5-demo-observer.png`](../../docs/screenshots/block5-demo-observer.png)

The screenshots show masked status only. The API/engine mocked tests cover the real-mode path; no live provider request was made.

## Changed files

Implementation and prior progress commit `1069ef1c03a9313d2c8d97b0418ae92903ff0fad`:

- `AGENTS.md`
- `README.md`
- `docs/AI_HANDOFF.md`
- `docs/IMPLEMENTATION_PROGRESS.md`
- `docs/screenshots/block5-demo-live-forum.png`
- `docs/screenshots/block5-demo-observer.png`
- `docs/screenshots/block5-real-ai-settings-mobile.png`
- `docs/screenshots/block5-real-ai-settings.png`
- `package.json`
- `package-lock.json`
- `src/client/api.test.ts`
- `src/client/api.ts`
- `src/client/ui/App.tsx`
- `src/client/ui/styles.css`
- `src/server/app.test.ts`
- `src/server/app.ts`
- `src/server/credential-store.windows.test.ts`
- `src/server/credential-vault.test.ts`
- `src/server/credential-vault.ts`
- `src/server/db.test.ts`
- `src/server/db.ts`
- `src/server/deepseek-provider.test.ts`
- `src/server/deepseek-provider.ts`
- `src/server/experiment-engine.test.ts`
- `src/server/experiment-engine.ts`
- `src/server/migrations/005_real_ai.sql`
- `src/server/provider-catalog.ts`
- `src/server/real-ai-engine.test.ts`
- `src/shared/types.ts`

This follow-up adds `docs/IMPLEMENTATION_PROGRESS.md` corrections and this report at `codex/results/BLOCK_05_REAL_AI_SETTINGS.md`.

## Risks and limitations

- No live DeepSeek connection check or generation request was made. Live compatibility remains unverified beyond the current official documentation and mocked transport.
- The mocked HTTP 5xx retry path lacks a focused regression assertion; acceptance criterion 4 is therefore partial.
- The protected credential storage operation passed an OS-store round-trip test on Windows Server CI, and the Settings/API paths were covered separately. The full protected-key UI flow and Windows 10 itself were not directly exercised.
- Local cost ceilings are conservative estimates from checked pricing; they are not provider-enforced billing caps.
- Session-only key handling was browser-tested with a fake key. No owner key or credential was accessed or stored.
- GitHub emitted a non-blocking notice that `actions/checkout@v4` and `actions/setup-node@v4` target Node 20 while the hosted runner forces Node 24; all workflow steps passed.

## Rollback

PR #2 is open and unmerged, and `main` has not been changed. Before merge, close PR #2 to abandon these changes; no rollback commit is needed. If the current commits are later merged and must be reverted, revert the progress-evidence follow-up commit `2327fa1c50946b688c561b39f151eec5400e9517` and then implementation commit `1069ef1c03a9313d2c8d97b0418ae92903ff0fad`. If the PR is squash-merged, revert the resulting squash commit instead.

## Follow-up

The assigned Block 5 implementation remains in PR review. Resolve the missing mocked HTTP 5xx assertion and the protected-storage UI verification only if requested as Block 5 follow-up. Block 6 remains unstarted and requires separate authorization after PR #2 is integrated.
