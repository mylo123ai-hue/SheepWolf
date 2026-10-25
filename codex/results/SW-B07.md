# SW-B07 — Dark Theme Persistence and DeepSeek Incomplete-Decision Reliability

**Overall status: COMPLETED** for the authorized scope.

| Field | Evidence |
| --- | --- |
| Repository / task | `mylo123ai-hue/SheepWolf` / `SW-B07` |
| Exact starting point | `handoff/sw-b07-dark-theme-deepseek-20261025` at `ae753575a3f2bb02cee00eb46eb82cb56cc7978f` (branch verified at this SHA before checkout) |
| Implementation branch | `codex/sw-b07-dark-theme-deepseek`, created at the exact handoff SHA and pushed to origin |
| Implementation commit | `1254f7deb2fd7f1951fc2dbf36ff86b628e1a1a9` |
| Windows CI | [Run 40211631896](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40211631896), successful on Windows Server 2022 / Node 22 |
| PR #4 | Verified still open, unmerged, and unchanged at `4c1f01cdf3ebd8f83c7a37c451bee179d56f61ca` |

## Acceptance evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| Persist the user's light/dark choice across reload and app restart; safely default and handle invalid/unavailable browser storage. | **VERIFIED** | `src/client/ui/theme-preference.ts` reads/writes only the browser-local `sheepwolf.theme` value. The current header and Settings appearance control share that state. Five unit tests cover absent/default, saved dark read by a new app state, explicit light, invalid value, and unavailable/throwing storage. `npm run test:theme-browser` toggles both controls in the built app, checks reload, stops/restarts the frontend preview process, and confirms the dark selection remains in the same browser profile. Storage exceptions are caught; UI remains usable and defaults to light. |
| Reproduce incomplete DeepSeek decisions with mocked responses; never accept partial/invalid output. | **VERIFIED** | `src/server/deepseek-provider.test.ts` covers a truncated `length` result followed by a complete action, two repeated truncations, `content_filter`, missing `finish_reason`, malformed JSON, and empty output. Only `finish_reason: "stop"` can proceed to action parsing. `src/server/real-ai-engine.test.ts` verifies the engine applies only the complete second response, not the first partial output. |
| Bound/account retries using saved request, token and cost limits; retain truthful failure if a retry cannot fit. | **VERIFIED** | Only `finish_reason: "length"` retries, and only while `attempt < MAX_ATTEMPTS` (two attempts total). Every try calls the existing `reserve` and every received response settles usage before retry. Engine integration tests verify request-cap exhaustion blocks the next transport call in both Capture the Flags and The Investigation, an output-token overrun blocks retry, and a partial response's reported spend prevents another reservation under the saved $0.01 ceiling. Rejected retries remain recorded as `budget_rejected`; no action or scenario state is committed. Failure reasons remain the saved usage-limit or incomplete-output messages. Defaults, maxima, reservations, and Real AI opt-in were not raised or weakened. |
| Preserve scenarios, no-cost demo default, credentials/privacy and local-first behavior; run full regression and supported Windows CI. | **VERIFIED** | The diff is limited to the app's theme preference, DeepSeek provider failure handling, targeted tests, and the Windows CI invocation for the browser persistence test. Full existing tests passed locally and on Windows CI. All model transport tests inject mocked `fetch`; the browser smoke mocks local API responses and rejects non-local requests. No live API/provider request, credential change, deployment, merge, public exposure, or PR #4 edit occurred. |

## Implementation details and changed files

- `src/client/ui/App.tsx` initializes the existing theme from browser preference and persists changes from either existing theme control.
- `src/client/ui/theme-preference.ts` safely reads/writes the validated `light`/`dark` preference; unavailable storage falls back without throwing.
- `src/client/ui/theme-preference.test.ts` covers default, selection/reload, explicit light, invalid and unavailable storage cases.
- `src/server/deepseek-provider.ts` retries only a truncated `length` completion once, after settling actual usage and checking that the settlement remains inside saved limits. Unknown, non-stop, empty and malformed outputs remain rejected.
- `src/server/deepseek-provider.test.ts` and `src/server/real-ai-engine.test.ts` cover adapter behavior, engine persistence, both scenarios, bounded retries, budget exhaustion and action integrity.
- `scripts/theme-browser-smoke.mjs`, `package.json`, `.github/workflows/windows.yml` run the actual browser theme control/reload/process-restart check in local and Windows CI.
- `docs/IMPLEMENTATION_PROGRESS.md` records the verified status and platform limitation; this report records criterion-by-criterion evidence.

## Exact local verification

From a clean dependency install on Linux:

```text
npm ci                         PASS — 263 packages installed
npm run typecheck              PASS
npm run build                  PASS — Vite production build
npm test                       PASS — 84 passed, 2 Windows-only skipped; 11 files, 86 total
npx playwright install chromium PASS — command completed successfully
npm run test:theme-browser     PASS — default, header and Settings toggles, reload and frontend process restart persistence
git diff --check               PASS
```

The theme browser test served the built application on loopback. Its API responses were local test fixtures; non-local requests were blocked and none were attempted. No model/provider connection was used.

GitHub [Windows run 40211631896](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40211631896), on implementation commit `1254f7deb2fd7f1951fc2dbf36ff86b628e1a1a9`, passed all workflow steps on Windows Server 2022 / Node 22: `npm ci`, typecheck, build, Playwright Chromium installation, `npm test` (**86 passed across 11 files**), `npm run test:theme-browser`, and the existing Windows launcher/data-recovery smoke. It verified launcher loopback ports, data persistence and restart behavior. This is Windows Server evidence; direct Windows 10 verification is **NOT VERIFIED**.

## Limits, risks and rollback

- A repeatedly truncated DeepSeek response still fails after one retry. No retry is attempted for other non-stop reasons. Partial output is always discarded. Live provider behavior was deliberately not exercised; all provider responses were mocked.
- If browser storage is unavailable or cleared, the app safely starts in light mode; persistence cannot be guaranteed by the browser in that case.
- Windows 10 itself was not available for direct testing. Windows Server 2022 CI passed.
- `npm ci` printed existing deprecation warnings for transitive `prebuild-install` and `glob`; this scope did not change dependencies.
- Rollback is isolated: `main` and PR #4 are unchanged. To revert the implementation on this branch, revert `1254f7deb2fd7f1951fc2dbf36ff86b628e1a1a9` without rewriting history. The pushed branch remains available for review; no PR was opened for SW-B07.

No live DeepSeek calls, paid services, merge, deployment, public hosting, credential changes, OpenClaw Lab access, or owner-PC access occurred.
