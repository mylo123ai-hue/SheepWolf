# AI handoff — Sheep vs Wolf Block 3

Copy the assignment below into the next Codex session.

---

## Assignment: Block 3 — Capture the Flags

Continue work in the existing `mylo123ai-hue/SheepWolf` repository. Begin with `git status`, then read `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/IMPLEMENTATION_PROGRESS.md`, and inspect the current code. Block 1 and Block 2 are complete; preserve them. Implement **Block 3 only**. Do not build The Investigation, real AI providers, history/replay, or unrelated features.

Work autonomously on routine engineering decisions. Use the existing React/TypeScript, Fastify, SQLite and shared experiment engine. Do not stop at a plan, mock screen, or documentation. Do not make external or paid model requests.

### Goal

Make Capture the Flags a complete playable scenario on top of the shared autonomous engine. Sheep try to protect their flags. The two Wolves persuade Sheep to voluntarily transfer flags; they cannot steal flags directly. The game ends with a valid scenario victory or a non-victory stop/failure.

### Rules to implement

- Create one unique flag for each of the five Sheep at run initialization. Wolves start with none; all flags start safe.
- A flag has a stable ID, original Sheep owner, current custodian, and safe/captured status.
- Only the current custodian can authorize transfer. Sheep may transfer to any participant, including a Wolf. Wolves may transfer a flag they hold only if the scenario rules permit it; a flag received by a Wolf becomes captured immediately and cannot be recovered or transferred again.
- Speech never changes ownership. Transfer is an explicit scenario action selected by the agent and validated by the server.
- Reject unknown flags, non-custodian transfers, self-transfers if they have no meaningful game effect, and any action against an already captured flag.
- Wolves cannot use a direct steal action. The demo provider should be capable of choosing a voluntary transfer action occasionally, based on its role/context and discussion, without a hardcoded guaranteed result or a universal Sheep refusal.
- Wolf victory occurs when three unique flags have been captured. It may finalize immediately once the third capture is persisted.
- Sheep victory occurs only when the game validly concludes with at least three uncaptured flags. Administrator stop, provider failure, or interrupted finalization must never be scored as a victory.
- Preserve the Block 2 ending consensus, duration and decision limits. On a valid end or limit finalization, evaluate flags and assign the correct outcome or explicit inconclusive/unscored result.

### Privacy and persistence

- Persist the flag state and each accepted transfer atomically with its immutable ordered game event and agent decision.
- Keep private transfers visible to the involved participants and administrator by default. Other participant contexts and ordinary public endpoints must not reveal hidden identities, private transfer metadata, or administrator-only state.
- Make the full current flag state, original owners, capturing Wolf, and transfer history visible in the local Observer Desk.
- Add run-scoped typed actions to the existing scenario boundary. Do not add a generic rules language or separate agent processes.
- Keep all accepted state valid across browser refresh and process restart. Replay/reconstruction is not a Block 3 requirement, but the event record must be sufficient to review transfer history.

### UI and API

- Connect Capture the Flags setup, forum activity and observer progress to actual persisted scenario state.
- Present successful transfers as readable scenario events in the activity timeline, respecting their privacy settings.
- Keep all ownership and victory validation on the backend. Do not trust client-supplied roles or custodians.
- Preserve the public participant API's information boundary and the existing local-only loopback setup.

### Tests and verification

Add focused automated unit/integration tests covering initial inventory, uniqueness, valid Sheep-to-Sheep transfer, valid Sheep-to-Wolf capture, inability to steal, custody validation, captured flag immutability, duplicate/atomic persistence, event privacy, the three-flag Wolf victory, Sheep victory with at least three safe flags, non-victory stop/failure, and persistence/recovery. Mock the decision provider; do not spend API credits.

Run and record exact results for:

```sh
npm ci
npm run typecheck
npm run build
npm test
```

Run a complete no-cost Capture the Flags game through the real application and verify controls, flag display, activity events, valid victory evaluation, restart safety, and public/private information boundaries. Keep the Windows GitHub Actions checks working. State clearly whether Windows 10 itself was directly tested.

Update `docs/IMPLEMENTATION_PROGRESS.md` with verified features, exact test and application evidence, commit, limitations, and Block 4 as next. Replace this file with the next Block 4 assignment when Block 3 is complete. Commit the finished work and push to the existing `main` branch without rewriting history, following the repository's authorization.

### Real UI evidence and screenshots

The owner specifically wants to see the real application, not a generated design mockup. As part of Block 3 verification, launch the application and capture real browser screenshots from the running app (Playwright/headless Chromium is suitable). Show meaningful persisted simulated data rather than static placeholder screens.

Save reviewable images under `docs/screenshots/`:
- `scenario-library.png` — available and planned scenarios.
- `capture-flags-forum.png` — Capture the Flags live forum with actual simulated discussion and readable scenario activity.
- `capture-flags-observer.png` — administrator-only full flag state, five initial flags, current custodians, captured count and valid experiment controls.
- `capture-flags-result.png` — an authentic final scenario outcome, clearly distinguished from stopped/failed.
- `capture-flags-mobile.png` — usable mobile viewport of the running scenario.

Do not fabricate screenshots, paste artwork over the UI, or claim a screenshot was captured if browser execution failed. If screenshots cannot be captured in the environment, record the blocker and the exact runnable evidence instead. Images must not expose credentials or other unrelated private data. Link the screenshots in the completion report.

### Acceptance and return evidence

Verify the application through actual UI and HTTP controls, not only isolated tests. At least one demo run must exercise a valid flag transfer and a real terminal state. Use deterministic fixtures or focused tests to cover *both* victory paths without forcing every organic simulated run to the same scripted winner. Verify invalid/duplicate transfer requests do not change custody or append false success events, and verify visibility by acting as uninvolved participants where the API supports that distinction.

Return: user-visible behaviour; commit and CI link; exact test counts and commands; evidence of no-cost simulated gameplay; direct screenshot links; privacy and restart test results; unresolved limitations; and a ready-to-run Block 4 handoff. A successful local build or a Codex-reported DONE alone is not sufficient evidence.

### Block 3 done when

A real demo experiment can create and display five safe flags, accept and persist only valid voluntary transfers, immediately record irreversible Wolf captures, correctly conclude a Wolf victory at three captures, correctly evaluate Sheep success or non-victory at valid finalization, and preserve accurate observer/event history through reload and backend restart. All automated checks pass and verification evidence is documented.

---

## Current verified state

- Block 1 foundation and GUI: commit `83b5dfc`.
- Block 2 autonomous engine, persistence, live forum, observer controls and recovery: see latest commit and the evidence in `docs/IMPLEMENTATION_PROGRESS.md`.
- Runtime: local Node.js app, Fastify, SQLite, React/Vite; Windows CI uses Windows Server 2022 and Node 22.
- Demo mode makes no paid or external model calls. Current runs are explicitly simulated and end with an unscored conclusion until scenario mechanics are implemented.
