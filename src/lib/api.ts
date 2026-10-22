// One API for the UI, three backends:
// - the desktop app: the Rust side, via Tauri
// - the website: Cloudflare functions in /functions (web.ts)
// - `npm run dev`: sample data (mock.ts), so the UI can be worked on offline

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as mock from "./mock";
import * as web from "./web";
import type { MatchDetails, Settings, Snapshot, StatsResult, TeamChoice } from "./types";

const inApp = isTauri();
/** The website in production (or `npm run dev:web` against the real functions) */
export const onWebsite = !inApp && (!import.meta.env.DEV || import.meta.env.VITE_WEB_API === "1");
const browser = onWebsite ? web : mock;

export const getSnapshot = (): Promise<Snapshot> =>
  inApp ? invoke("get_snapshot") : browser.getSnapshot();

export const getSettings = (): Promise<Settings> =>
  inApp ? invoke("get_settings") : browser.getSettings();

export const saveSettings = (settings: Settings): Promise<Settings> =>
  inApp ? invoke("save_settings", { settings }) : browser.saveSettings(settings);

export const refreshNow = (): Promise<void> => (inApp ? invoke("refresh_now") : browser.refreshNow());

/** Head-to-head etc. for one match; rejects with a readable message. */
export const getMatchDetails = (fixtureId: number): Promise<MatchDetails> =>
  inApp ? invoke("get_match_details", { fixtureId }) : browser.getMatchDetails(fixtureId);

/** [code, name] pairs for the team picker */
export const listLeagues = (): Promise<[string, string][]> =>
  inApp ? invoke("list_leagues") : browser.listLeagues();

export const listTeams = (league: string): Promise<TeamChoice[]> =>
  inApp ? invoke("list_teams", { league }) : browser.listTeams(league);

/** Goals, cards, stats, line-ups (Highlightly); rejects with a readable message. */
export const getMatchStats = (fixtureId: number): Promise<StatsResult> =>
  inApp ? invoke("get_match_stats", { fixtureId }) : browser.getMatchStats(fixtureId);

export const testNotification = (): Promise<void> =>
  inApp ? invoke("test_notification") : browser.testNotification();

export const testGoalAlert = (): Promise<void> =>
  inApp ? invoke("test_goal_alert") : browser.testGoalAlert();

/** Calls back whenever the Rust side has new data. Returns an unsubscribe function. */
export function onSnapshot(callback: (s: Snapshot) => void): () => void {
  if (!inApp) return browser.onSnapshot(callback);
  const unlisten = listen<Snapshot>("state-updated", (e) => callback(e.payload));
  return () => void unlisten.then((stop) => stop());
}

export function onSettings(callback: (s: Settings) => void): () => void {
  if (!inApp) return browser.onSettings(callback);
  const unlisten = listen<Settings>("settings-updated", (e) => callback(e.payload));
  return () => void unlisten.then((stop) => stop());
}

export const openLink = (url: string): Promise<void> =>
  inApp ? openUrl(url) : Promise.resolve(void window.open(url, "_blank"));

export const setMiniMode = (on: boolean): Promise<Settings> =>
  inApp ? invoke("set_mini_mode", { on }) : browser.setMiniMode(on);

export const hideWindow = () => (inApp ? getCurrentWindow().hide() : Promise.resolve());
export const minimizeWindow = () => (inApp ? getCurrentWindow().minimize() : Promise.resolve());
