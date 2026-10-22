// The website's data layer: talks to the Cloudflare functions in /functions
// and does in the browser what the Rust side does for the desktop widget
// (polling, reminders, goal alerts). Settings live in this browser.

import { dueNotices, goalNotices, nextFetchDelay, type Notice } from "./alerts";
import type { Fixture, MatchDetails, Settings, Snapshot, StatsResult, TableRow, TeamChoice } from "./types";

const STORE = "matchnight";
const TABLE_MAX_AGE = 30 * 60_000;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORE}.${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`${STORE}.${key}`, JSON.stringify(value));
  } catch {
    // private browsing etc.; the app still works, it just forgets
  }
}

const DEFAULT_SETTINGS: Settings = {
  team: {
    id: 57,
    name: "Arsenal FC",
    shortName: "Arsenal",
    crest: "https://crests.football-data.org/57.png",
    league: "PL",
    venue: "Emirates Stadium",
    colors: "Red / White",
  },
  apiKey: "",
  statsApiKey: "",
  reminderMinutes: [1440, 60, 0],
  resultNotifications: true,
  goalAlerts: true,
  refreshMinutes: 15,
  alwaysOnTop: false,
  miniMode: false,
  streamLinks: [],
};

let settings: Settings = read("settings", DEFAULT_SETTINGS);
let snapshot: Snapshot = {
  ...read<Snapshot>("snapshot", { fixtures: [], table: [], lastUpdated: null, error: null, hasApiKey: true, refreshing: false }),
  hasApiKey: true, // the keys live on the server
  refreshing: false,
};
let tableFetchedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const sent = new Set<string>(read<{ keys: string[] }>("sent", { keys: [] }).keys);

const snapshotListeners = new Set<(s: Snapshot) => void>();
const settingsListeners = new Set<(s: Settings) => void>();

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  if (!snapshot.refreshing) write("snapshot", { ...snapshot, error: null });
  snapshotListeners.forEach((l) => l(snapshot));
}

// ---------- Talking to /api ----------

async function api<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api/${path}?${query}`, { headers: { "x-access-code": localStorage.getItem(`${STORE}.code`) ?? "" } });
  if (res.status === 401) {
    // The site owner set an access code; ask once and remember it
    const code = prompt("Enter the Matchnight access code");
    if (code) {
      localStorage.setItem(`${STORE}.code`, code.trim());
      return api(path, params);
    }
    throw "Access code needed.";
  }
  const body = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status}).` }));
  if (!res.ok) throw body.error ?? `Server error (HTTP ${res.status}).`;
  return body as T;
}

// ---------- Polling, reminders and goal alerts ----------

function notify(notices: Notice[]) {
  for (const n of notices) {
    sent.add(n.key);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(n.title, { body: n.body, icon: "/logo.svg", tag: n.key });
    }
  }
  if (notices.length) write("sent", { keys: [...sent].slice(-300) });
}

async function refresh() {
  clearTimeout(timer);
  publish({ refreshing: true });
  const team = settings.team;
  try {
    const fixtures = await api<Fixture[]>("fixtures", { team: team.id });
    if (settings.goalAlerts) notify(goalNotices(snapshot.fixtures, fixtures, sent));
    const justFinished = fixtures.some((f) => f.status === "finished" && snapshot.fixtures.some((o) => o.id === f.id && o.status !== "finished"));
    let table = snapshot.table;
    if (!table.length || justFinished || Date.now() - tableFetchedAt > TABLE_MAX_AGE) {
      table = await api<TableRow[]>("table", { league: team.league, team: team.id }).catch(() => table);
      tableFetchedAt = Date.now();
    }
    publish({ fixtures, table, lastUpdated: new Date().toISOString(), error: null, refreshing: false });
  } catch (e) {
    publish({ error: String(e), refreshing: false });
  }
  timer = setTimeout(refresh, snapshot.error ? 2 * 60_000 : nextFetchDelay(snapshot.fixtures, new Date(), settings.refreshMinutes));
}

let started = false;
function start() {
  if (started) return;
  started = true;
  void refresh();
  // Reminders and full-time results, checked while the page is open
  setInterval(() => notify(dueNotices(snapshot.fixtures, new Date(), settings, sent)), 30_000);
  // Catch up straight away when coming back to the tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && snapshot.lastUpdated && Date.now() - Date.parse(snapshot.lastUpdated) > 60_000) void refresh();
  });
}

// ---------- The same functions as mock.ts / the desktop app ----------

export async function getSnapshot() {
  start();
  return snapshot;
}

export const getSettings = async () => settings;

export async function saveSettings(next: Settings) {
  const teamChanged = next.team.id !== settings.team.id;
  settings = next;
  write("settings", settings);
  settingsListeners.forEach((l) => l(settings));
  if (teamChanged) {
    detailsCache.clear();
    tableFetchedAt = 0;
    publish({ fixtures: [], table: [], lastUpdated: null, error: null });
  }
  void refresh();
  return settings;
}

export const refreshNow = async () => void refresh();

export function onSnapshot(cb: (s: Snapshot) => void) {
  snapshotListeners.add(cb);
  return () => void snapshotListeners.delete(cb);
}

export function onSettings(cb: (s: Settings) => void) {
  settingsListeners.add(cb);
  return () => void settingsListeners.delete(cb);
}

const detailsCache = new Map<number, MatchDetails>();
export async function getMatchDetails(fixtureId: number): Promise<MatchDetails> {
  const hit = detailsCache.get(fixtureId);
  if (hit) return hit;
  const details = await api<MatchDetails>("details", { match: fixtureId, team: settings.team.id });
  detailsCache.set(fixtureId, details);
  return details;
}

export const listLeagues = async (): Promise<[string, string][]> => [
  ["PL", "Premier League"],
  ["ELC", "Championship"],
  ["PD", "La Liga"],
  ["BL1", "Bundesliga"],
  ["SA", "Serie A"],
  ["FL1", "Ligue 1"],
  ["DED", "Eredivisie"],
  ["PPL", "Primeira Liga"],
  ["BSA", "Brasileirão"],
];

export const listTeams = (league: string) => api<TeamChoice[]>("teams", { league });

/** Stats for finished matches never change, so they're kept in this browser. */
type StoredStats = { byMatch: Record<string, StatsResult>; teamIds: number[]; matchIds: Record<string, number> };

export async function getMatchStats(fixtureId: number): Promise<StatsResult> {
  const f = snapshot.fixtures.find((x) => x.id === fixtureId);
  if (!f) throw "Match not found.";
  const team = settings.team;
  const store = read<StoredStats>(`stats.${team.id}`, { byMatch: {}, teamIds: [], matchIds: {} });
  const saved = store.byMatch[fixtureId];
  if (saved && f.status === "finished") return saved;

  const result = await api<StatsResult & { highlightlyTeam?: number[]; highlightlyMatch?: number }>("stats", {
    match: fixtureId,
    team: team.id,
    name: team.name,
    short: team.shortName,
    kickoff: f.kickoff,
    home: f.home ? 1 : 0,
    status: f.status,
    hlTeam: store.teamIds.join(","),
    hlMatch: store.matchIds[fixtureId] ?? "",
  });
  if (result.highlightlyTeam?.length) store.teamIds = result.highlightlyTeam;
  if (result.highlightlyMatch) store.matchIds[fixtureId] = result.highlightlyMatch;
  if (result.status === "ready" && f.status === "finished") store.byMatch[fixtureId] = result;
  write(`stats.${team.id}`, store);
  return result;
}

async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === "undefined") {
    alert("This browser doesn't support notifications. On iPhone, add Matchnight to your Home Screen first.");
    return false;
  }
  if (Notification.permission === "default") await Notification.requestPermission();
  return Notification.permission === "granted";
}

export async function testNotification() {
  if (await ensurePermission()) new Notification("Matchnight", { body: "Notifications are working. Enjoy the match!", icon: "/logo.svg" });
}

export async function testGoalAlert() {
  if (await ensurePermission()) new Notification(`⚽ GOAL! ${settings.team.shortName}`, { body: "Test alert", icon: "/logo.svg" });
}

export const setMiniMode = async () => settings;
