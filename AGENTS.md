# Working guide

- Read `docs/PRODUCT_SPEC.md`, `docs/IMPLEMENTATION_PROGRESS.md`, `docs/AI_HANDOFF.md`, and `codex/results/SW-B06.md` before future work.
- Treat the product spec as authoritative; inspect current code, progress, results, and any newly authorized assignment before changing files. Run the checks relevant to the work before claiming completion.
- Keep the app local-first and bind server services to loopback. Never commit credentials or make paid model calls during development.
- Use the existing React/TypeScript, Fastify and SQLite architecture unless a verified limitation requires a change.
- Keep scenario behavior server-authoritative. Preserve run configuration and accepted actions once the engine is added.
- Update implementation progress with verified status and remaining acceptance criteria. Do not assume another engineering block is authorized.
- Continue from the latest verified commit and preserve working functionality. Blocks 1–6 are implemented on their respective histories; do not repeat them or start a new feature block without an explicit owner assignment.
