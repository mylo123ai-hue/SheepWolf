# Sheep vs Wolf

Sheep vs Wolf is a local-first browser simulation with seven recurring AI participants. The Scenario Library includes two playable games: Capture the Flags and The Investigation. The shared engine, threaded forum, observer controls and SQLite persistence power both a free simulated demo and an opt-in DeepSeek mode.

## Run locally

Requirements: 64-bit Windows 10 (or a recent macOS/Linux development machine), Node.js 20.18–24.x, npm and a current browser. Install 64-bit Node.js once from [nodejs.org](https://nodejs.org/). On Windows, **Start SheepWolf.bat** checks the Node version, installs the locked dependencies on first launch, starts the development servers, waits for both local services, then opens the default browser. It detects an already-running copy to avoid starting a duplicate. The server window stays open; press **Ctrl+C** there to stop the app. The app binds its API and Vite server to loopback addresses only. The launcher requires Node.js and is not a standalone Windows executable.

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

The SQLite database is stored under `%APPDATA%\SheepWolf\sheepwolf.sqlite` on Windows and `~/.sheepwolf/sheepwolf.sqlite` on macOS/Linux. Set `SHEEPWOLF_DATA_DIR` to choose another directory. In PowerShell, set it for the current session with `$env:SHEEPWOLF_DATA_DIR = 'D:\SheepWolf Data'` before starting the launcher from that PowerShell window, or set a persistent user value with `[Environment]::SetEnvironmentVariable('SHEEPWOLF_DATA_DIR', 'D:\SheepWolf Data', 'User')` and restart the launcher. Paths containing spaces are supported. Existing application data is not used for provider credentials.

### Backup and recovery

Stop Sheep vs Wolf with **Ctrl+C** in its server window before copying or restoring its database. Copy the complete app-data directory (the default Windows directory is `%APPDATA%\SheepWolf`) to a separate backup location. To restore, stop the app and copy the saved directory back to the configured data directory. Keep the SQLite database and its same-directory files together; do not copy a database while the server is writing it. If startup reports that only one local service is ready, close the existing server window and retry. If a port is in use, stop the other local SheepWolf process before starting again. The launcher does not kill arbitrary processes.

## Demo and real AI modes

Demo is the default and makes no external requests. It uses the same persisted engine and both scenario rule sets.

To configure DeepSeek, open **Settings** and choose one of the currently documented model IDs (`deepseek-flash` or `deepseek-v4-pro`). Enter a key, then choose protected OS storage where available or explicitly select session-only memory. The application never writes the key to SQLite, browser storage, run snapshots or logs. Windows protected storage uses the Windows Credential Manager through the OS keyring API. If protected storage cannot be used, the app offers session-only memory instead of a plaintext file.

Saving a key does not enable model requests. Enable **Real AI for runs** in Settings, save the settings, and then explicitly choose **DeepSeek real AI** when launching a run. The Observer Desk shows that run's request, token and locally estimated spend totals. Request/token/spend reservations are enforced before each model call and are saved in SQLite. The spending ceiling is a local estimate based on current published peak rates with a 20% margin; it is not a DeepSeek account-level cap and does not guarantee the provider's charges. Current models and pricing were checked on 24 October 2026 in the [DeepSeek chat completion docs](https://api-docs.deepseek.com/api/create-chat-completion) and [models and pricing](https://api-docs.deepseek.com/quick_start/pricing).

**Test Connection** sends one direct, non-generation request to DeepSeek's models endpoint only after the administrator clicks and confirms it. Real run decisions use the chat-completions endpoint. No provider call is made automatically when the application starts, when a key is saved, or when demo mode runs. Automated provider tests use mocked HTTP responses; no paid DeepSeek request was made during development.

## Current implementation status

- Capture the Flags and The Investigation run through the shared autonomous engine, with scenario-specific validation and observer state.
- Real DeepSeek requests are opt-in and bounded; roles, objectives and scenario details are assembled from each participant's server-filtered context.
- Experiment History preserves run configuration, role and profile snapshots, discussion, ordered events, scenario state, model usage, outcomes and stop/failure reasons. Its replay view walks saved events without calling a provider or changing the run.
- The Windows launcher checks the supported Node.js range, waits for loopback API/frontend readiness, opens the app only when available, and reports startup failures without killing unrelated services.
- GitHub Actions checks on Windows Server 2022 / Node 22 verify clean installation, typecheck, build, tests and the OS credential-store adapter. This is not direct Windows 10 verification. The current Cloud Codex environment is Linux, so Windows 10 itself was not directly run here.
- Live provider behavior has not been verified because development and CI use mocked transport only. A live connection test requires a configured key and an administrator's direct action.
