# Arsenal Widget ⚽️

A small always-on-top desktop widget for Arsenal fans ❤️⚪️🔴: the next match with a live countdown, live scores on match day, results, the Premier League table, reminders before kick-off, and your streaming links in one click. It lives in the system tray.

Built with [Tauri 2](https://tauri.app) (Rust) and React + TypeScript. The installer is tiny (a few MB) because it uses Windows' built-in WebView2.

> Version 1 was a Java Swing app. It's preserved on the [`legacy-java`](../../tree/legacy-java) branch and the `v1-java` tag.

## Features ✨

- **Next match**: both crests, competition, home/away, local kick-off time and a live countdown
- **Live score**: on match day the card switches to the score with a pulsing LIVE / HT badge, refreshed every minute
- **Coming up**: every upcoming fixture, with search by opponent (partial names and nicknames like "spurs" work)
- **Results**: recent scores with W/D/L, a form guide and the season record
- **Table**: Premier League standings with Arsenal highlighted
- **Watch**: your own list of streaming links that open in your browser
- **Reminders**: Windows notifications before kick-off (1 day, 3 hours, 1 hour, 30/15 min, kick-off, as you choose) and the full-time result
- **Tray icon**: click to show/hide; the menu has Refresh, Always on top and Quit. Hover it to see the next match
- Remembers its size and position; works offline with the last data it loaded

## Getting an API key 🔑

Fixtures come from [football-data.org](https://www.football-data.org/client/register). The free tier is enough.

Either paste the key into **Settings → API key** in the widget, or put it in a file called `api_key.txt` next to `arsenal-widget.exe`. The Settings key wins if both are set. `api_key.txt` is git-ignored.

## Using it 🚀

Run the installer from `src-tauri/target/release/bundle/nsis/`, or just run `arsenal-widget.exe` directly. Closing the window hides it to the tray; quit from the tray menu.

Settings and cached data live in `%APPDATA%\com.awarsamejr.arsenalwidget\`.

## Development 🛠️

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) 20+, and the Visual Studio C++ build tools ([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev      # run the app with hot reload
npm run dev            # UI only, in a browser, with sample data (add ?live, ?nokey or ?error to the URL)
npm test               # frontend tests (Vitest)
cd src-tauri && cargo test   # Rust tests
npm run tauri build    # release exe + installer
```

In dev builds, `api_key.txt` in the project folder is picked up automatically.

### How it's put together

```plaintext
src-tauri/src/          Rust: owns the data, timers and notifications
  api.rs                football-data.org client (the key never leaves Rust)
  models.rs             API shapes → tidy fixtures / table rows for the UI
  scheduler.rs          when to refresh (faster around matches) and which reminders are due
  settings.rs           settings + cache stored in the app data folder
  state.rs              shared state; pushes "state-updated" events to the UI
  tray.rs, commands.rs  tray icon/menu; functions the UI can call
src/                    React UI
  App.tsx               title bar, tabs, status bar
  components/           NextMatchHero, FixtureRow, views (Next/Results/Table/Watch), SettingsView
  lib/                  api bridge, formatting helpers (+ tests), sample data for browser preview
```

The Rust side polls every 15 minutes (configurable), every minute from 15 minutes before kick-off until full time, and the table every 30 minutes. That stays well inside the free tier's 10 requests per minute. Free-tier live scores can lag by a few minutes.

## Ideas 💡

- Player stats and line-ups (needs a paid API tier)
- Start with Windows
- Support for other teams

## Acknowledgments 🙌

- [football-data.org](https://www.football-data.org/) for the data
- Arsenal FC for being an inspiration and the best team!
