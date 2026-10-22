# Matchnight 🌙⚽

Your team's fixtures, live scores, stats and reminders: a small Windows widget, plus a website for your phone.

Pick any club from nine leagues and Matchnight follows it, styled in the club's colours. You get the next match with a live countdown, the live score on match day with **goal alerts**, results, the league table, a full match screen (timeline, stats, line-ups, head-to-head) and reminders before kick-off. On desktop it lives in the system tray and shrinks to a one-line **mini mode**.

Built with [Tauri 2](https://tauri.app) (Rust) and React + TypeScript. The Windows installer is about 2 MB because it uses the built-in WebView2.

> Matchnight started life as the *Arsenal Fixture Widget*, a Java Swing app. That version is on the [`legacy-java`](../../tree/legacy-java) branch and the `v1-java` tag.

## Features ✨

- **Any team**: choose from the Premier League, Championship, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga and Brasileirão. The theme follows the club's colours.
- **Next match**: crests, competition, home/away, local kick-off time and a live countdown.
- **Live**: the score with a LIVE / HT badge, refreshed every minute during a match.
- **Goal alerts**: a notification for every goal (yours or theirs), with the scorer and minute when available, plus disallowed goals.
- **Coming up**: upcoming fixtures, searchable by opponent (nicknames like "spurs" work).
- **Results**: scores with W/D/L, a form guide and the season record.
- **Table**: your league with your team highlighted.
- **Match screen**: click any match for:
  - the timeline (goals with assists, cards, subs),
  - team stats (possession, xG, shots, passing…),
  - line-ups on a pitch,
  - win probability, venue and weather,
  - league positions, form going in, and head-to-head.
- **Watch**: your own list of streaming links.
- **Reminders**: before kick-off (1 day, 3 h, 1 h, 30/15 min, kick-off, as you choose) and at full time.
- **Desktop extras**: tray icon (Show/Hide, Refresh, Always on top, Mini mode, Quit), mini mode, always on top, and it remembers its size and position.

## API keys 🔑

| What | Where | Desktop: Settings field | Desktop: or a file next to the exe |
|---|---|---|---|
| Fixtures, results, table, head-to-head | [football-data.org](https://www.football-data.org/client/register) (free) | API key | `api_key.txt` |
| Goals, cards, line-ups, match stats (optional) | [Highlightly](https://highlightly.net) (free, 100 requests/day) | Match stats key | `highlightly_key.txt` |

On desktop, a key typed into Settings wins over the file; both files are git-ignored. The website keeps the keys as Cloudflare secrets instead (see below). Finished matches' stats are cached for good, so the Highlightly limit is rarely an issue.

## Desktop (Windows) 🖥️

Run the installer from `src-tauri/target/release/bundle/nsis/`, or run `matchnight.exe` directly. Closing the window hides it to the tray; quit from the tray menu. Settings and cached data live in `%APPDATA%\com.awarsamejr.matchnight\` (copied automatically from the old Arsenal Widget folder on first run).

## Website 🌐 (phones and any browser)

The same app runs as a website on [Cloudflare Pages](https://pages.cloudflare.com), free. Small server functions in `functions/` hold your API keys, so they never appear in the page, and cache responses to save quota. On a phone, use **Add to Home Screen** (Safari on iPhone, Chrome on Android) and it opens full screen like an app.

Settings (team, reminders, links) are saved in each browser. Notifications work while the site is open in a tab; there are no alerts when it's closed.

### Put it online

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. Deploy it, either way:
   - **From GitHub (recommended):** Workers & Pages → Create → Pages → *Connect to Git*, then pick this repo. Build command `npm run build`, output folder `dist`. Every push to `main` then redeploys automatically.
   - **From this PC:** `npx wrangler login`, then `npm run deploy:web`.
3. Add the keys under the project's **Settings → Variables and Secrets** (type *Secret*), then redeploy:

   | Name | Value |
   |---|---|
   | `FOOTBALL_DATA_KEY` | your football-data.org key (required) |
   | `HIGHLIGHTLY_KEY` | your Highlightly key (optional; for goals, line-ups and stats) |
   | `ACCESS_CODE` | any code you like (recommended: the site asks for it once per browser, so strangers can't use up your API quota) |

Your site is at `https://matchnight.pages.dev` (or whatever name Cloudflare gives it).

### Try it locally

Put the keys in a `.dev.vars` file (git-ignored) as `FOOTBALL_DATA_KEY=...` lines, then:

```bash
npm run dev:web        # builds the site and serves it with the real functions on http://localhost:8788
```

## Development 🛠️

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) 20+, and the Visual Studio C++ build tools ([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
npm run dev            # UI only, in a browser, with sample data (?live, ?nokey, ?nostats, ?error)
npm run dev:web        # the website with the real server functions (needs .dev.vars)
npm test               # frontend + website server tests (Vitest)
cd src-tauri && cargo test   # Rust tests
npm run tauri build    # desktop release exe + installer
```

In dev builds, key files in the project folder are picked up automatically.

### How it's put together

```plaintext
src-tauri/src/          Rust: owns the data, timers and notifications
  api.rs                football-data.org client (keys never leave Rust)
  highlightly.rs        Highlightly client: events, stats, line-ups, predictions
  models.rs             API shapes → fixtures / table rows from your team's side
  scheduler.rs          refresh timing (faster around matches), reminders, goal alerts
  stats.rs              on-demand match stats with a disk cache
  settings.rs           settings + caches in the app data folder
  state.rs              shared state; pushes "state-updated" events to the UI
  commands.rs           functions the UI calls
  tray.rs               desktop tray icon and menu
functions/              Website backend (Cloudflare Pages Functions)
  api/[[route]].ts      /api/* endpoints: keys, caching, Highlightly lookups
  _lib/                 football-data and Highlightly parsing (+ tests, same data as Rust)
src/                    React UI (shared by the desktop app and the website)
  App.tsx               layout, tabs, desktop title bar or web header
  components/           match card, lists, match screen, stats, mini strip, settings
  lib/                  API bridge (desktop / website / sample data), web.ts, alerts, formatting, team colours (+ tests)
```

## Ideas 💡

- Player ratings and shot maps (Highlightly has the data)
- Start with Windows
- Follow several teams at once

## Acknowledgments 🙌

- [football-data.org](https://www.football-data.org/) and [Highlightly](https://highlightly.net) for the data
