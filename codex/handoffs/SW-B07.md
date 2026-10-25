# SW-B07 — Dark theme persistence and DeepSeek incomplete-decision reliability

## Assignment

Owner-authorized bounded implementation task for the Sheep vs Wolf app. Starting repository state: `main` at `8197681cceb9773161518d5193654c0fdfc4a5bc`. This handoff is submitted on isolated branch `handoff/sw-b07-dark-theme-deepseek-20261025`; the verified handoff revision is the commit that adds this file.

## User-reported issues

- The user wants a dark theme and reports that both scenarios can run for about ten requests before ending with: “Deep Seek did not finish a complete decision.” These reports are not independently reproduced yet.

## Main-branch inspection

- `src/client/ui/App.tsx`: `dark` is initialized with `useState(false)`; the header and Settings appearance controls toggle it, but the state is not loaded from or saved to persistent storage.
- `src/client/ui/styles.css`: light and dark styles already exist under `.dark`; the root uses light palette defaults.
- `src/server/deepseek-provider.ts`: each attempt is reserved through the existing run-budget callback and output is capped by `maxOutputTokensPerRequest`. `MAX_ATTEMPTS` is 2 for retryable transport/provider failures. A response with a non-`stop` `finish_reason` is settled as failed and raises `incomplete_output` (“DeepSeek did not finish a complete decision.”); it is not retried. Malformed or empty decisions are also rejected.
- `src/server/experiment-engine.ts`: provider decision errors fail the run, retain a safe stop reason, and do not score a victory.
- `src/server/deepseek-provider.test.ts`: adapter tests use mocked transport. No live provider generation or paid API request was made during this inspection.
- Repository instructions in `AGENTS.md` require reading the product spec, progress record, AI handoff and Block 6 results; those were inspected. The product spec requires accessible light/dark themes, bounded paid requests and no real provider calls in routine verification.

## Scope

1. Persist the user's appearance preference so selecting dark remains dark after reload and app restart. Keep the existing toggle and both palettes. Use a client-side preference only; do not put appearance state in provider settings or credentials.
2. Diagnose the incomplete-decision path with mocked provider responses. Implement the smallest safe reliability improvement for the observed non-complete response. Never parse or apply a partial/invalid decision as an action. Any retry must be explicitly bounded, reserve and settle each request through the existing budget controls, and remain within the saved per-run request, token and estimated-cost limits. Do not raise defaults or maxima, weaken real-mode opt-in, or increase spending limits. If a safe retry cannot fit the existing budget, preserve a clear, truthful failure reason.
3. Preserve existing scenarios, server-authoritative rules, action validation, privacy boundaries, settings, credential protection, local-first behavior and demo default. Update relevant tests and implementation progress with verified evidence.

## Acceptance checks

- Automated coverage proves dark preference selection, reload persistence, default behavior when no preference exists, and safe handling of unavailable or invalid stored preference.
- Mocked tests cover a complete valid decision, the relevant incomplete finish reason(s), malformed/empty output, retry bounds, and budget exhaustion. Prove every attempt is accounted for and no incomplete decision is accepted.
- Existing typecheck, build, full test suite, and supported Windows CI pass. Any unavailable platform verification is reported as NOT VERIFIED; Windows Server results are not described as direct Windows 10 validation.
- No paid DeepSeek calls, deployment, merge, public exposure, or changes to PR #4.
- Record the implementation commit/branch and evidence in the normal project progress/result records. Keep changes on a new isolated implementation branch based on this verified handoff revision or its verified `main` ancestor; do not modify the showcase branch.

## Boundaries

Do not launch additional agents or Codex tasks from this assignment. Do not merge, deploy, alter repository visibility, change credentials, contact OpenClaw Lab, or access the owner's PC. Do not run a real provider call. Do not modify or supersede the existing README/demo PR #4: it must remain open and unmerged.

## References

- Repository: https://github.com/mylo123ai-hue/SheepWolf
- Main baseline: https://github.com/mylo123ai-hue/SheepWolf/tree/8197681cceb9773161518d5193654c0fdfc4a5bc
- Showcase PR #4 (must stay open/unmerged): https://github.com/mylo123ai-hue/SheepWolf/pull/4
- Product spec: https://github.com/mylo123ai-hue/SheepWolf/blob/8197681cceb9773161518d5193654c0fdfc4a5bc/docs/PRODUCT_SPEC.md
