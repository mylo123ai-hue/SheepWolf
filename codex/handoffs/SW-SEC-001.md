# SW-SEC-001 — Bounded npm dependency security repair

## GOAL

Identify and remediate the npm dependency advisories reported during native Windows 10 Sheep vs Wolf QA, using the smallest compatible changes and retaining the application's verified behaviour, privacy boundaries, and test coverage. Publish the actual repair to GitHub for owner review as an **unmerged pull request**, not directly to `main`.

**Authorized repository:** `mylo123ai-hue/SheepWolf`  
**Task ID:** `SW-SEC-001`  
**Verified starting `main` SHA:** `36855a49ac73f5a612d24416d0a77b0ed44d21b5`  
**Handoff branch:** `handoff/sw-sec-001-dependency-audit-20261025`  
**Handoff path:** `codex/handoffs/SW-SEC-001.md`

### Evidence and uncertainty

On 2026-10-25 native Windows 10 QA reported `npm ci` succeeding but npm printing **five vulnerability advisories: 1 moderate, 2 high, 2 critical**. GitHub Windows CI also printed this count. The source reports **do not establish specific vulnerable package names, CVE/GHSA IDs, real application exposure, or exploitability**. Determine those from a fresh audit; do not assert that all five are exploitable or already fixed. Baseline dependency manifests are `package.json` and `package-lock.json`. `main` contains the accepted SW-B07 repairs; PR #4 is separately held open/unmerged.

## SCOPE

1. Read `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/IMPLEMENTATION_PROGRESS.md`, `docs/AI_HANDOFF.md`, `codex/results/SW-B06.md`, and the relevant SW-B07 results and existing workflow before changes. Verify the exact handoff revision and create a **new isolated implementation branch** for this task.
2. On the pinned baseline run a reproducible dependency audit, including complete `npm audit` results and a **production-only** audit (`npm audit --omit=dev` or equivalent). Record names, dependency chains, advisory/GHSA/CVE IDs where supplied, severities, affected ranges, fixed versions, direct versus transitive and runtime versus dev-only reachability. Capture accurate before/after counts and distinguish npm advisory presence from demonstrable app exploitability.
3. Implement the smallest safe compatible dependency or lockfile updates needed to remediate actionable findings. Prefer supported patch/minor updates and targeted transitive resolution when appropriate, within existing architectural and Node.js compatibility requirements (`>=20.18 <25`). Codex chooses the safe concrete method. Do not silently introduce breaking major upgrades; if a significant upgrade, security configuration change, or material redesign is required, document the blocker and request new owner authority instead.
4. Preserve the existing Windows launcher, React/TypeScript/Fastify/SQLite local-first application, both scenarios, free simulated default, protected/session credential handling, DeepSeek real-AI opt-in and request/token/estimated-spend controls, history/replay, theme preference and existing data migrations. Changes should be focused on dependency remediation and directly relevant verification. Leave the independently confirmed **live DeepSeek malformed-output issue** for a separately authorized reliability task.
5. Validate clean `npm ci`, typecheck, production build, full automated suite (baseline **86 Windows tests**), persistent-theme browser smoke, Windows launcher/data-recovery checks and supported GitHub Windows CI. Include security audit checks and relevant regression tests where justified. Use **mocked** provider calls only. Make repairs within scope if checks fail; provide evidence, not just a `COMPLETED` assertion.
6. Update `docs/IMPLEMENTATION_PROGRESS.md` and publish a precise results record at `codex/results/SW-SEC-001.md` with findings, exact changed files and commits, verified test outputs, residual risks and rollback instructions.

## DO NOT

- Do **not** merge into `main`, deploy, publish, change repository visibility, modify production, change API keys/credentials, weaken security controls, make paid/provider calls, contact the owner's PC or access OpenClaw Lab or unrelated repositories.
- Do **not** modify or retarget the existing README/demo showcase **PR #4**, including its branch (`codex/sw-showcase-001-static-demo`, previously at `4c1f01cdf3ebd8f83c7a37c451bee179d56f61ca`). Treat any merge conflicts with it as outside this task.
- Do **not** use `npm audit fix --force`, suppress advisories, downgrade security, delete meaningful tests, erase lockfile reproducibility, or make broad upgrades unrelated to the reported security findings merely to obtain a green audit.
- Do **not** start further Codex tasks, run a live DeepSeek diagnostic, create a paid service, or expand scope without owner approval.
- Do **not** change the app's source logic unless the minimal dependency update demands a directly related compatibility adjustment within existing behavior; otherwise report the required expansion for separate authorization.

## DONE WHEN

- Exact npm advisory identities and dependency paths are identified and the **before/after** total and `--omit=dev` audit outcomes are recorded; state `0` only if actually demonstrated by a fresh audit.
- Actionable findings are fixed using minimal compatible dependency changes; each unresolved issue is explicitly named, risk-qualified, and accompanied by the reason it could not be safely fixed within scope. If safe remediation is impossible, return `PARTIAL` or `BLOCKED`, not a misleading pass.
- `npm ci`, typecheck, build, full suite, relevant browser/Windows workflow checks pass on the actual implementation head, with evidence for Windows Server versus any direct Windows 10 limits.
- Existing paid-provider guardrails, credentials, local-only service bindings, data persistence, gameplay and appearance remain intact; no live paid calls occur.
- GitHub contains an **isolated implementation branch**, reproducible changes, `codex/results/SW-SEC-001.md`, and an **open, unmerged PR targeting `main`**. The owner can review the real repair in GitHub; the Designer/owner will verify results before separately authorizing any future merge.

## RETURN

Report **COMPLETED / PARTIAL / BLOCKED** with:

- exact repository, task ID, pinned handoff commit SHA, implementation branch and head commit SHA;
- unmerged PR number/link and results file **path, branch, commit SHA** (the result MUST be pushed to an accessible branch, preferably the PR branch; inability to publish is **BLOCKED**);
- complete advisory table: package, direct/transitive path, advisory ID, original/fixed versions, severity, runtime/dev exposure, before/after status and any remaining risks;
- changed files and why each was needed; commands/results for `npm audit`, `npm audit --omit=dev`, `npm ci`, typecheck, build, full tests, browser smoke, Windows CI URL and any platform limits;
- a criterion-by-criterion evidence table, important caveats, rollback path and exact next owner action.

**Workflow:** Owner authorizes handoff here; Designer commits and verifies this file; **owner launches Codex Cloud** using the pinned revision. Codex autonomously implements/tests/repairs only within these boundaries, commits to an isolated branch, publishes result and opens/updates an **unmerged PR**. A green CI is not the owner's acceptance. The future GitHub merge requires a fresh explicit owner authorization.

## References

- Repository: https://github.com/mylo123ai-hue/SheepWolf
- Merged SW-B07: https://github.com/mylo123ai-hue/SheepWolf/pull/5
- Protected showcase PR #4: https://github.com/mylo123ai-hue/SheepWolf/pull/4
