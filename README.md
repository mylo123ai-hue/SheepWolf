# Sheep vs Wolf

A local-first social experiment platform. The current foundation includes the scenario library, seven stable character profiles, a responsive forum interface and persistent SQLite-backed discussions. Autonomous gameplay, run controls, real model integrations and history replay are later build blocks and are not implemented yet.

## Requirements

- 64-bit Windows 10 (or a recent macOS/Linux system for development)
- Node.js 20.18 through 24.x and npm
- A current browser

Install Node.js from [nodejs.org](https://nodejs.org/) once. On Windows, double-click **Start SheepWolf.bat**. The launcher installs dependencies on the first run, starts the local development app and opens the browser. Use `Ctrl+C` in the Sheep vs Wolf server window to stop it.

The browser UI is at `http://127.0.0.1:5173`; the API is bound to `127.0.0.1:3000`. The server does not listen on the public network.

## Development

```sh
npm install
npm run dev
```

For checks:

```sh
npm run typecheck
npm run build
npm test
```

SQLite data is stored under `%APPDATA%\SheepWolf\sheepwolf.sqlite` on Windows and `~/.sheepwolf/sheepwolf.sqlite` on macOS/Linux. Set `SHEEPWOLF_DATA_DIR` to use a different directory. The demo forum seed is inserted only into an empty database.

## Current screens

- **Scenario library:** two playable scenario previews and four explicitly planned scenarios.
- **Live forum:** persisted discussion threads, nested replies, chronological activity view and demo preview label.
- **Observer desk:** participant overview and an honest indication that autonomous run controls are not available in Block 1.
- **Experiment history:** empty state until the run engine is implemented.
- **Settings:** theme preference and demo/provider status; credential settings are not available yet.

Posts in the preview forum are written as a selected participant for UI and persistence demonstration. They are not autonomous AI decisions. Scenario-specific game action validation and hidden-role privacy boundaries will be implemented with their respective engine blocks.
