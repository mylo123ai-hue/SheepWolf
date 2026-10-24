# AI handoff — Sheep vs Wolf Block 6

## Assignment: Product Polish and Release

This is the next engineering assignment. **Do not begin Block 6 until the owner explicitly authorizes it.** At the start of that block, inspect the current branch and PR/review state, `AGENTS.md`, `docs/PRODUCT_SPEC.md`, this handoff, and `docs/IMPLEMENTATION_PROGRESS.md`. Preserve Blocks 1–5 and continue from their latest verified merged state.

### Goal

Finish the authorized Windows-compatible MVP release work and close the verified acceptance gaps without expanding the product scope.

### Scope

- Complete the Experiment History screen and saved-run detail view. Retain each run's immutable configuration, character/role assignment, posts/replies, scenario events/actions, provider usage metadata, outcome and stop/failure reason.
- Implement read-only replay from persisted events. Replay must not call a model or mutate the original run.
- Add the Windows launcher named `Start SheepWolf.bat`, local setup and recovery instructions, and a configurable application data directory. Keep server binding on loopback.
- Polish and verify responsive/mobile behavior, keyboard navigation, labels, focus states, contrast, loading/error/empty states, and Observer details for both playable scenarios.
- Verify first-run installation and runtime instructions on the existing Windows CI runner. Keep the supported Windows workflow green. Clearly distinguish Windows Server CI from direct Windows 10 verification.
- Run regression checks for both scenarios, demo and mocked Real AI paths, recovery, credential safety, and history/replay. Capture genuine local application screenshots when UI changes.
- Update the progress record and this handoff only with verified outcomes and remaining gaps.

### Boundaries

- No merge, public deployment, paid provider call, production account or external infrastructure action without separate authorization.
- Keep no-cost demo as the default. Do not make a real model request in CI or routine verification.
- Do not add scenarios or major features outside the product specification.
- Do not claim standalone Windows executable support unless the runtime no longer requires Node.js; the launcher may require Node.js to be installed.

### Verification and completion

Run `npm ci`, `npm run typecheck`, `npm run build`, and `npm test`, plus browser checks for history/replay and Windows launcher behavior where the available environment permits. Verify replay leaves the database unchanged and never invokes the provider. Record exact CI status, test counts, screenshots, and any Windows 10 limitation in `docs/IMPLEMENTATION_PROGRESS.md`.

Prepare a reviewable branch/PR if requested by the owner. Do not merge, deploy, make paid calls, or declare the product complete without evidence for each applicable acceptance criterion in `docs/PRODUCT_SPEC.md`.

### Current verified continuity

- Blocks 1–4: see `docs/IMPLEMENTATION_PROGRESS.md` and Git history.
- Block 5 implementation: PR and commit references are recorded there after submission.
- The Block 5 signed-off scope remains unchanged at `docs/handoffs/BLOCK_05_REAL_AI_SETTINGS.md`.
- No real DeepSeek request has been made. Real provider behavior has only been exercised using mocked transport.
