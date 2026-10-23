# Sheep vs Wolf — Product Specification

## Mission and authority

Build a polished, standalone, local browser-based social experimentation platform for Windows 10 x64. An administrator observes, but does not play as one of the seven agents: five Sheep and two hidden Wolves. Sheep and Wolves must be autonomous in real AI mode, communicate in a persistent threaded forum, and use scenario-specific mechanics. The no-cost scripted demo is the default and must use the same engine once the engine exists. No public deployment, paid API use, external account, VPS or infrastructure is authorized by this spec.

Use this document as the authoritative product direction. Build in approximate four-hour blocks. For each block, implement, verify, commit, and update `IMPLEMENTATION_PROGRESS.md`. Do not claim unbuilt features are complete.

## Product experience

The primary screen is a modern, responsive discussion forum. Main areas: Scenario Library, Live Forum, Observer Dashboard, Experiment History, and Settings. Use accessible controls, restrained animations, readable light and dark themes, attractive scenario art and stable participant avatars. The library opens when no run is active. A scenario card shows its description, Sheep and Wolf objectives, mechanic, status, and launch/configure action only when playable. Planned scenarios must not look playable.

Forum requirements: threaded posts and nested replies, participant names/avatars, profiles, timestamps, chronological activity view, full history, clear new activity, no page reloads for live updates, scenario events and visibility-aware content. Discussion and activity views share persisted data. New activity must not pull the reader away. Admins observe and never post as a human participant. Hidden roles and private game events never leak through standard participant endpoints or profile metadata.

Observer requirements: selected scenario, run status, active time, decisions, posts/replies, budget, state, progress and outcome; all seven participants, roles/objectives/personality/activity for the administrator. Start, pause, resume, one-step, stop and restart must operate the real engine. Stop is not a victory. History preserves immutable config, role assignment, participants, discussion, actions, events, score, outcome and failure/stop reason. Replay reads recorded events and never calls an AI.

## Characters and agent execution

Seven recurring identities and traits: Willow (analytical/methodical), Rowan (confident/persuasive), Clover (cooperative/trusting), Fern (sceptical/questioning), Moss (practical/cautious), Ash (assertive/independent), Brook (diplomatic/empathetic). Randomly assign five Sheep and two Wolves per run, record seed and roles, reveal roles only to the administrator; Wolves know each other. Each run has fresh conversational memory. The server supplies only role-permitted knowledge and bounded current-run context. Never send Sheep private Wolf information or admin data. Treat participant speech as untrusted input; it cannot override server rules.

A single shared scheduler offers fair but non-fixed opportunities. Agents can post, reply, remain silent, propose/agree/disagree with ending, and take scenario actions. Persist accepted decisions. No seven-process architecture. Enforce active-time, decision, request, token and spending estimates before real requests. Bound retries. No paid requests without explicit admin enablement and configured limits. Demo must be clearly labelled simulated, meaningful, no-cost, and exercise the actual engine once delivered.

## Scenarios

MVP playable scenarios:

1. **Capture the Flags** — Each Sheep owns one unique safe flag; Wolves start with none. Only the authorized custodian can voluntarily transfer it; Sheep may transfer to anyone, Wolves cannot directly steal. A flag transferred to a Wolf is captured permanently. Speech alone never transfers it. Transfers are validated, recorded immutably, and private to involved participants/admin by default. Wolf victory at three captured flags; Sheep victory at valid conclusion with at least three uncaptured. Stopped/failed runs are not victories. Dashboard shows owners, custodians, captured status, transfer history and related discussion.
2. **The Investigation** — Fictional mystery, evidence, several conclusions, one objectively correct and one private Wolf target. Sheep privately record initial opinions, discuss/challenge/change, and submit final private votes on conclusion. Wolves' votes are analysis only. Sheep win if at least three choose correct; Wolves win if at least three choose their target; otherwise inconclusive. Missing decisions/interrupted finalization are explicit, never silently counted. Show opinion changes without claiming messages caused them.

Future planned cards only: The Rumour, Secret Keeper, Survival Council, Find the Wolves.

Each scenario implements a small typed interface: ID/version, description/configuration, initial state, objectives/knowledge, actions and validation, transitions, victory/finalization/scoring, observer statistics. Keep scenario state server-authoritative and avoid a generic rules language.

## Endings and lifecycle

Lifecycle: configured, running, paused, completed, stopped, failed, incomplete finalization. Paused time does not count toward the runtime cap. Any agent may propose ending; after every participant has two action opportunities, at least three of five Sheep must agree for early conclusion. A terminal scenario victory may end immediately. Duration or decision limit starts scenario finalization (final votes for Investigation, evaluation for Flags). Do not mislabel interrupted or failed runs.

## Providers, security, and platform

Demo mode works without credentials. Initially support DeepSeek through a provider interface; do not call a provider identifier supported until checked. Settings supports provider/model/key, masked credentials, save/replace/remove, test connection, real-mode enable, limits/usage, and understandable errors. Keys are server-side, never browser-visible/logged/exported/committed; prefer Windows protected credential storage and never persist plaintext. Paid calls require explicit real-mode enablement. Estimates are not provider-enforced account caps. Mock provider tests; no live paid development calls.

Node.js + TypeScript, React/Vite, Fastify, SQLite, SSE unless polling is more reliable. One backend process, one local DB, loopback bind, no cloud, Docker or WSL requirement. Include Windows launcher and Windows CI for clean install, typecheck, build and tests. Clearly report if Windows 10 itself was not tested. SQLite persistence survives refresh/restart. Persist state changes atomically, prevent duplicate actions, recover interrupted runs safely, record model failures and replay from ordered events.

## Blocks and completion criteria

- **Block 1:** project foundation, SQLite/migrations, visual library/navigation/forum/profile components, persisted demonstration data, responsive layouts, basic tests/CI, Windows setup. Must start clean, render pages, load posts/replies from backend and persist them.
- **Block 2:** seven-agent run setup, private role/memory boundaries, shared scheduler, demo decisions, autonomous posts/replies, live updates, lifecycle controls, persistent events and hybrid ending.
- **Block 3:** fully playable Capture the Flags, validated transfers, victory, observer state and demo completion.
- **Block 4:** fully playable Investigation, evidence, private initial/final opinions, scoring, observer results.
- **Block 5:** provider settings, secure credential handling, DeepSeek adapter, explicit real-mode controls/limits, response validation, bounded errors/retries and recovery; mocked tests only.
- **Block 6:** run history/event replay, polish/accessibility/responsive fixes, Windows launcher/setup, regression/clean install, final acceptance.

Final MVP is complete only when both games, seven autonomous agents, safe role isolation, actual lifecycle controls, free demo, configured bounded real AI, secure credentials, validated persisted actions, history/replay/recovery, polished responsive GUI, tests, Windows setup/launcher and documented Windows verification all work. Acceptance coverage in the source request includes character/roles/privacy/memory, forum nesting/live delivery, lifecycle, limits/endings, scenario actions/scoring, persistence/duplicate prevention/recovery, demo/mocked provider/credential limits/output validation, history/replay, Windows compatibility and browser interactions.
