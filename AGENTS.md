# Working guide

- Read `docs/PRODUCT_SPEC.md` and `docs/IMPLEMENTATION_PROGRESS.md` before making changes.
- Treat the product spec as authoritative; inspect the current code, progress log, and the active assignment in `docs/AI_HANDOFF.md` before changing files. Run the checks relevant to the work before claiming completion.
- Keep the app local-first and bind server services to loopback. Never commit credentials or make paid model calls during development.
- Use the existing React/TypeScript, Fastify and SQLite architecture unless a verified limitation requires a change.
- Keep scenario behavior server-authoritative. Preserve run configuration and accepted actions once the engine is added.
- Update implementation progress with verified status and the next work block.
- Continue from the latest verified commit and preserve working functionality. The next assignment is Block 5 as described in `docs/AI_HANDOFF.md`; do not repeat Blocks 1–4 or start later blocks early.
