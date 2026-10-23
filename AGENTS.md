# Working guide

- Read `docs/PRODUCT_SPEC.md` and `docs/IMPLEMENTATION_PROGRESS.md` before making changes.
- Treat the product spec as authoritative; inspect the current code and run the checks relevant to the work before claiming completion.
- Keep the app local-first and bind server services to loopback. Never commit credentials or make paid model calls during development.
- Use the existing React/TypeScript, Fastify and SQLite architecture unless a verified limitation requires a change.
- Keep scenario behavior server-authoritative. Preserve run configuration and accepted actions once the engine is added.
- Update implementation progress with verified status and the next work block.
