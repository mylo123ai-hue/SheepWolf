# The Commons — browser demo preview

**This is an unhosted local preview. A live website has not been deployed.** The preview is an isolated static build and a reduced showcase of the Sheep vs Wolf application.

## Play the demo

You can play without Node.js:

1. Open [`preview.html`](preview.html) in this repository and use GitHub's **Download raw file** control, or take `demo/preview.html` from a repository ZIP.
2. Open the downloaded `preview.html` in a current Chromium browser.
3. Choose **Capture the Flags** or **The Investigation**, optionally enter a table seed, and start the simulated run.

The single HTML file contains its CSS and JavaScript. It runs under `file://` and makes no HTTP requests. It does not require Fastify, SQLite, Node.js, a model key, credentials, an account, a production server or an internet connection. **Refreshing clears the run; this preview does not save history.**

## What is in this preview

| Included | Simplified or not included |
| --- | --- |
| Seven familiar characters, freshly assigned five-Sheep/two-Wolf roles, threaded simulated discussion, observer display, start/pause/resume/one-step/stop, a bounded run and valid terminal outcomes. | Scripted decisions instead of genuine AI; no persistent memory or history; no full application settings, real AI controls, credentials, database, server API, authentication, shared users, event replay or complete parity with the local application. |
| Capture the Flags has five unique flags. Only a current Sheep custodian can voluntarily transfer a safe flag; three Wolf captures win. A valid conclusion awards Sheep only when at least three remain safe. | A single-browser showcase, not a protected multi-user experiment. Forum/profile views hide the roles, but the person using the browser can inspect its client-side state. |
| The Investigation presents the fictional Lantern Room Ledger case, supports private initial opinions, discussion/reconsideration and five private Sheep final conclusions. Outcomes use the full three-vote thresholds; Wolf ballots do not score. | Individual final votes remain hidden in the observer UI until all five Sheep submit. This is a presentation rule, not a cryptographic privacy boundary. |

The observer panel is the only screen that displays role badges and private scenario details. Do not use this preview for real secrets or adversarial research. Its purpose is to make the two scenario mechanics and forum experience reviewable without connecting to the full app.

## Build and serve the static files

The checked-in `preview.html` is generated from the source under `demo/src/`. From the repository root:

```sh
npm ci
npm run demo:build
```

This produces:

- `demo/preview.html` — one self-contained downloadable/offline file.
- `demo-dist/` — static files with relative assets for a domain root.
- `demo-dist-subpath/` — static files built for a `/SheepWolf/` base path.

To serve the root static build locally after building:

```sh
npm run demo:serve
```

Then open `http://127.0.0.1:4174/`. A small Node built-in static-file server reads only `demo-dist/`, binds to loopback and returns 404 for unknown paths such as `/api/health`; it does not start the full Fastify application or SQLite. The static output can later be copied to static hosting **only after separate owner approval**; no hosting or deployment is configured by this repository.

## Verification

The build audits output for server, database, provider, credential, browser-persistence and network-client code. To run the deterministic rule tests, the full application regression suite and the Chromium root/subpath/offline network walkthrough:

```sh
npm run demo:build
npx playwright install chromium
npm test
npm run demo:browser-test
```

The browser test serves only the emitted files at `/` and `/SheepWolf/`, intercepts and blocks non-static/external requests, and opens the single-file preview with HTTP egress blocked. It saves genuine browser screenshots in `docs/screenshots/`.
