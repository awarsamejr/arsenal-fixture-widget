# Arsenal Widget ⚽️

A small always-on-top desktop widget for Arsenal fans ❤️⚪️🔴: the next match with a live countdown, live scores on match day, results, the Premier League table, reminders before kick-off, and your streaming links in one click. It lives in the system tray.

Built with [Tauri 2](https://tauri.app) (Rust) and React + TypeScript. The installer is tiny (a few MB) because it uses Windows' built-in WebView2.

> Version 1 was a Java Swing app. It's preserved on the [`legacy-java`](../../tree/legacy-java) branch and the `v1-java` tag.

## Features ✨

- **Next match**: both crests, competition, home/away, local kick-off time and a live countdown
- **Live score**: on match day the card switches to the score with a pulsing LIVE / HT badge, refreshed every minute
- **Coming up**: every upcoming fixture, with search by opponent (partial names and nicknames like "spurs" work)
- **Results**: recent scores with W/D/L, a form guide and the season record
- **Match screen**: click any match for the timeline (goals with assists, cards, subs), team stats (possession, xG, shots, passing…), line-ups on a pitch, win probability, venue and weather, league positions, form going in, and head-to-head with the last 10 meetings
- **Table**: Premier League standings with Arsenal highlighted
- **Watch**: your own list of streaming links that open in your browser
- **Reminders**: Windows notifications before kick-off (1 day, 3 hours, 1 hour, 30/15 min, kick-off, as you choose) and the full-time result
- **Tray icon**: click to show/hide; the menu has Refresh, Always on top and Quit. Hover it to see the next match
- Remembers its size and position; works offline with the last data it loaded

## Getting API keys 🔑

The widget uses two free APIs:

| What | Where | Settings field | Or a file next to the exe |
|---|---|---|---|
| Fixtures, results, table, head-to-head | [football-data.org](https://www.football-data.org/client/register) | API key | `api_key.txt` |
| Goals, cards, line-ups, match stats (optional) | [Highlightly](https://highlightly.net) | Match stats key | `highlightly_key.txt` |

A key typed into Settings wins over the file. Both files are git-ignored. Highlightly's free plan allows 100 requests a day; finished matches are cached for good, so you'll rarely get near it.

## Using it 🚀

Run the installer from `src-tauri/target/release/bundle/nsis/`, or just run `arsenal-widget.exe` directly. Closing the window hides it to the tray; quit from the tray menu.

Settings and cached data live in `%APPDATA%\com.awarsamejr.arsenalwidget\`.

## Development 🛠️

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) 20+, and the Visual Studio C++ build tools ([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev      # run the app with hot reload
npm run dev            # UI only, in a browser, with sample data (add ?live, ?nokey, ?nostats or ?error to the URL)
npm test               # frontend tests (Vitest)
cd src-tauri && cargo test   # Rust tests
npm run tauri build    # release exe + installer
```

In dev builds, `api_key.txt` in the project folder is picked up automatically.

### How it's put together

```plaintext
src-tauri/src/          Rust: owns the data, timers and notifications
  api.rs                football-data.org client (the key never leaves Rust)
  highlightly.rs        Highlightly client: events, stats, line-ups, predictions
  stats.rs              on-demand match stats with a disk cache (finished matches never refetched)
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

- Player ratings and shot maps (Highlightly has the data)
- Start with Windows
- Support for other teams

## Acknowledgments 🙌

- [football-data.org](https://www.football-data.org/) for the data
- Arsenal FC for being an inspiration and the best team!
