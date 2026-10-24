# SW-B06 — Sheep vs Wolf: Block 6, MVP Polish and Windows Acceptance

**Authorization:** Owner approved **Submit work** on 24 October 2026. This authorizes Codex Cloud to implement **Block 6 only** within the boundaries below after the owner launches Codex. The handoff commit alone does not launch Codex, authorize a merge, or authorize a release.

**Repository:** `mylo123ai-hue/SheepWolf` (no other repository)  
**Accepted, merged starting point:** `main` at `585e28141f8c8d6e8c6e01726c6e8aa7c2546e4a` (Block 5 merged; [post-merge Windows CI passed, 68 tests](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40055548869))  
**Handoff branch:** `handoff/sw-b06-final-mvp-20261024`  
**Task ID:** `SW-B06`  
**Handoff path:** `codex/handoffs/SW-B06.md`  
**Required results path:** `codex/results/SW-B06.md`

## GOAL

Finish the planned **Block 6 — Product Polish and Release** *implementation and verification*, making the existing local-first Sheep vs Wolf MVP reviewable for Windows use: persisted **Experiment History**, immutable **read-only replay**, polished accessible/responsive screens, reliable existing **Windows launcher and setup**, and complete regression/Windows acceptance evidence. Preserve the Block 1–5 product and carry forward the precise Windows protected-credential browser-test exception accepted at Block 5.

The phrase "Release" names the product-spec phase; it **does not authorize a public release, deployment or automatic merge**.

## SCOPE — where Codex has engineering autonomy

- First inspect `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/AI_HANDOFF.md`, `docs/IMPLEMENTATION_PROGRESS.md`, `codex/results/BLOCK_05_REAL_AI_SETTINGS.md`, the current code, tests and branch state. Preserve the seven recurring characters, hidden 5-Sheep/2-Wolf assignments, both playable scenarios, role/observer privacy, the shared demo/optional DeepSeek engine, run controls, server-side rules, local storage and current interfaces.
- Work autonomously within this scope, diagnose failures, repair regressions and use minimal changes compatible with **React/TypeScript/Vite, Fastify, SQLite, SSE, and loopback-only local servers**. Prefer repairing existing components over rebuilding. Choose implementation details yourself.

**History and replay**
- Deliver a usable Experiment History screen and saved-run detail view for existing and new persisted runs. Present what was actually stored: immutable run configuration/seed, scenario version, character/role assignment in administrator-only views, participant posts and nested replies, ordered events and scenario actions, provider usage, outcomes and explicit stopped/failed/incomplete-finalization reasons.
- Make history robust across browser refresh and application/server restart; handle absent/older data gracefully rather than fabricating outcomes. Provide clear navigation, empty/loading/error states, understandable times and run summaries.
- Replay chronological persisted events in a **read-only** view with control over progress through the recording. It must never invoke a demo/real model, advance or modify an experiment, create new votes/transfers/decisions, or rewrite any original rows. Preserve visibility boundaries on public/participant data and keep administrator-only details confined to administrator surfaces.

**Windows startup and local reliability**
- Inspect and improve the **existing** `Start SheepWolf.bat` rather than replacing it without cause. Verify compatible Node.js requirements, clean first-run installation/startup, working paths (including spaces), readiness/browser opening, understandable failure/retry messages, no unwanted duplicate launches, loopback binding and a practical way to stop the application. Document precisely that the launcher may depend on Node.js; do not claim a self-contained `.exe` unless one actually exists.
- Preserve SQLite data across restart and user-selectable app-data directory (`SHEEPWOLF_DATA_DIR`), and provide concise setup, troubleshooting, recovery and backup/restore guidance without changing real user data in tests.

**Accessibility and interface**
- Polish the existing Scenario Library, Live Forum, Observer Dashboard, History and Settings using responsive/mobile layouts, readable light/dark presentation, keyboard and focus behavior, labels, contrast, sensible status/feedback and a stable live forum (new updates must not forcibly scroll the reader). Keep the visual identity and working features intact.
- Use genuine running-application screenshots/screens or recordings for important new History/Replay, Windows/Settings and responsive views when execution environment allows; do not present mocks as screenshots from the app.

**MANDATORY deferred Block 5 Windows browser acceptance**
- **On a Windows browser, exercise the actual Settings UI against OS-protected Windows credential storage** using only disposable/fake credentials and loopback local test data. Verify the full flow: **save → configured/masked status → replace → remove → confirm cleared**, plus browser refresh and application/process restart persistence, and confirm no key leaks to client responses, local DB, logs or exported history. Do not invoke Test Connection or any external DeepSeek API.
- Existing evidence establishes **Windows Server 2022 Credential Manager round-trip in CI and Linux Chromium Settings UI independently**, *not* the combined Windows-browser UI journey. Treat this as a real acceptance gap, not an assumed functional defect. Arrange appropriate isolated **Windows CI/browser automation** if feasible using existing/reasonable tooling, without touching the owner's PC or expanding infrastructure access. Record OS/browser versions, actual commands, screenshots/logs and whether the full end-to-end journey ran.
- If a Windows browser runner is truly unavailable or the flow cannot be verified safely, **report the specific unmet acceptance criterion as PARTIAL/BLOCKED** with reproducible instructions and evidence already checked. **Never label the flow VERIFIED solely because Windows Node CI or a Linux browser passed.** Direct Windows 10 verification is preferable when genuinely available; otherwise explicitly say **not tested on Windows 10** rather than claiming compatibility.

## DO NOT — controlled authority boundary

- **Do not** merge PRs or push to protected/default `main`, publish a release, deploy, enable public hosting, create paid API traffic, connect real provider keys, change credentials/security settings for real accounts, spend money or access production/user data.
- **Do not** access the owner's computer, OpenClaw Lab, VPS, HAL, CODE3, Neural, PROJECT SYNC, Discord, Lab networks/endpoints/secrets/tools or unrelated repositories. Use isolated Codex Cloud/GitHub runners only and disposable test materials.
- Do not start future blocks, add the four planned-but-unplayable scenarios, introduce new products, expand AI provider scope, replace the framework, invent a self-contained executable, or relax existing permissions/privacy checks.
- Do not change documented Block 5 acceptance history to pretend the previously untested Windows browser workflow passed. New verification is additive, evidence-backed and attributed to Block 6.

## DONE WHEN — measurable acceptance criteria

1. **History:** After completing/stopping runs in both scenarios and restarting the server, the History list and selected run display saved configuration, role assignments (observer only), timeline, forum content, scenario actions, usage and correct completion/stop/failure reasons. Automated tests cover empty, complete, stopped, failed and incomplete data.
2. **Replay integrity:** Replay loads ordered persisted events and supports navigation without *any* provider invocation or new/modifed experiment/forum/scenario/decision/usage records. Tests compare saved database state before and after replay and verify privacy filtering.
3. **Preserved gameplay:** Capture the Flags and The Investigation remain playable in no-cost demo; mocked DeepSeek, hidden-role boundaries, lifecycle/pause/resume/Step/stop, outcome scoring, event filtering, idempotency, budget accounting and restart recovery regressions pass.
4. **Windows launcher/data:** Demonstrate a clean, documented Windows first launch with Node version and working-path handling, loopback-only startup and local persistence/data-directory behavior, useful failure recovery and no unintended duplicate app starts. Log what was actually executed on Windows vs merely inspected. Ensure `Start SheepWolf.bat` and README accurately describe runtime requirements.
5. **Deferred Windows credential flow:** Produce actual Windows **browser + protected OS storage** evidence for disposable-key save/status/replace/remove/refresh/restart with no secret exposure and no live provider traffic. If this cannot run, mark this criterion **PARTIAL/BLOCKED** and identify exactly what remains unverified; do not conceal or substitute the earlier split tests.
6. **Usable UI:** Inspect actual desktop and mobile browser flows for Library, Forum, Observer, History, Replay and Settings, including keyboard navigation/focus, contrast/labels and no disruptive live-update scrolling; provide genuine screenshots and concrete findings. Clearly identify any untested operating-system interaction.
7. **Repeatable verification:** From a clean checkout run and record `npm ci`, `npm run typecheck`, `npm run build`, `npm test`; maintain passing GitHub Windows Server CI and report its run URL, exact test counts and any Windows 10 limitation. Use injected mocks for provider tests; **zero live paid API calls**.
8. **Handback:** Publish a reviewable Codex implementation branch, commits and PR against `main`, update progress and user docs with measured outcomes, and push `codex/results/SW-B06.md` **on a GitHub branch the Designer can retrieve (prefer the PR branch)**. No merge or deployment.

## RETURN — required GitHub results handoff

In `codex/results/SW-B06.md`, include:
- Task/repository, starting and implementation branch, PR, commit SHAs and changed-file summary.
- Brief implemented changes with references to code/tests, and **criterion-by-criterion VERIFIED / PARTIAL / BLOCKED** evidence versus each of the eight DONE WHEN items. Never convert an untested path into success.
- Exact commands, local/Windows CI outcomes, test counts, browser/Windows details, relevant genuine screenshot paths, and database/read-only replay verification results.
- Explicit account of **Windows protected-key UI** test: what ran in a real Windows browser, how fake credentials were handled, evidence of save/replace/remove/refresh/restart, and any remaining Windows 10 gap.
- Security/privacy observations, absence of paid/live API calls, outstanding issues, risks and simple rollback plan; label Codex-reported, inferred and independently checkable evidence.
- Final status **COMPLETED / PARTIAL / BLOCKED**, and return **result path, results commit SHA, implementation branch and PR URL** in chat. If the results report cannot be pushed, return **BLOCKED**, not DONE.

Use retries/repair/rollback inside scope without seeking routine approvals. Escalate only genuine new authority needs or substantive product decisions. End after pushing the results and reporting references; **do not merge, deploy, or start anything beyond Block 6**.

## Starting state — documented, not an instruction to repeat past work

- Blocks 1–4 verified and merged as described in the progress log.
- Block 5 merged through PR #2 at `585e28141f8c8d6e8c6e01726c6e8aa7c2546e4a`; [main CI passed 68/68 tests](https://github.com/mylo123ai-hue/SheepWolf/actions/runs/40055548869).
- Block 5 owner **accepted with an explicit Windows browser credential-flow exception**, documented in the [PR discussion](https://github.com/mylo123ai-hue/SheepWolf/pull/2#issuecomment-6378884104). Original results at `codex/results/BLOCK_05_REAL_AI_SETTINGS.md` truthfully say PARTIAL; preserve that historical evidence.
- Existing `Start SheepWolf.bat` and `SHEEPWOLF_DATA_DIR` guidance are present; verify and improve, do not assume missing.
- No real DeepSeek call was made during Blocks 1–5 development and verification.

**Owner action following this submission:** manually launch Codex Cloud with the exact handoff branch/revision supplied by Designer. Submitting this file does not itself start an executor.
