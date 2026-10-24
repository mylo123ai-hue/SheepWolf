# Sheep vs Wolf

Sheep vs Wolf is a local-first browser simulation with seven recurring AI participants. The Scenario Library includes two playable games: Capture the Flags and The Investigation. The shared engine, threaded forum, observer controls and SQLite persistence power both a free simulated demo and an opt-in DeepSeek mode.

## Run locally

Requirements: 64-bit Windows 10 (or a recent macOS/Linux development machine), Node.js 20.18–24.x, npm and a current browser. Install Node.js once from [nodejs.org](https://nodejs.org/). On Windows, **Start SheepWolf.bat** starts the local development app and opens the browser. The app binds its API and Vite server to loopback addresses only.

For a terminal start:

```sh
npm ci
npm run dev
```

The UI is at `http://127.0.0.1:5173`; the API is at `http://127.0.0.1:3000`. Stop the development servers with `Ctrl+C`.

Run verification with:

```sh
npm run typecheck
npm run build
npm test
```

The SQLite database is stored under `%APPDATA%\SheepWolf\sheepwolf.sqlite` on Windows and `~/.sheepwolf/sheepwolf.sqlite` on macOS/Linux. Set `SHEEPWOLF_DATA_DIR` to choose another directory. Existing application data is not used for provider credentials.

## Demo and real AI modes

Demo is the default and makes no external requests. It uses the same persisted engine and both scenario rule sets.

To configure DeepSeek, open **Settings** and choose one of the currently documented model IDs (`deepseek-flash` or `deepseek-v4-pro`). Enter a key, then choose protected OS storage where available or explicitly select session-only memory. The application never writes the key to SQLite, browser storage, run snapshots or logs. Windows protected storage uses the Windows Credential Manager through the OS keyring API. If protected storage cannot be used, the app offers session-only memory instead of a plaintext file.

Saving a key does not enable model requests. Enable **Real AI for runs** in Settings, save the settings, and then explicitly choose **DeepSeek real AI** when launching a run. The Observer Desk shows that run's request, token and locally estimated spend totals. Request/token/spend reservations are enforced before each model call and are saved in SQLite. The spending ceiling is a local estimate based on current published peak rates with a 20% margin; it is not a DeepSeek account-level cap and does not guarantee the provider's charges. Current models and pricing were checked on 24 October 2026 in the [DeepSeek chat completion docs](https://api-docs.deepseek.com/api/create-chat-completion) and [models and pricing](https://api-docs.deepseek.com/quick_start/pricing).

**Test Connection** sends one direct, non-generation request to DeepSeek's models endpoint only after the administrator clicks and confirms it. Real run decisions use the chat-completions endpoint. No provider call is made automatically when the application starts, when a key is saved, or when demo mode runs. Automated provider tests use mocked HTTP responses; no paid DeepSeek request was made during development.

## Current implementation status

- Capture the Flags and The Investigation run through the shared autonomous engine, with scenario-specific validation and observer state.
- Real DeepSeek requests are opt-in and bounded; roles, objectives and scenario details are assembled from each participant's server-filtered context.
- Experiment history/replay and final release polish remain Block 6 work.
- GitHub Actions checks on Windows Server 2022 / Node 22 verify clean installation, typecheck, build, tests and the OS credential-store adapter. This is not direct Windows 10 verification. The current Cloud Codex environment is Linux, so Windows 10 itself was not directly run here.
- Live provider behavior has not been verified because development and CI use mocked transport only. A live connection test requires a configured key and an administrator's direct action.
