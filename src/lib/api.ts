// Bridge to the Rust side. Outside Tauri (plain `npm run dev` in a browser)
// it falls back to sample data so the UI can be worked on without the app.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as mock from "./mock";
import type { MatchDetails, Settings, Snapshot, StatsResult, TeamChoice } from "./types";

const inApp = isTauri();

export const getSnapshot = (): Promise<Snapshot> =>
  inApp ? invoke("get_snapshot") : mock.getSnapshot();

export const getSettings = (): Promise<Settings> =>
  inApp ? invoke("get_settings") : mock.getSettings();

export const saveSettings = (settings: Settings): Promise<Settings> =>
  inApp ? invoke("save_settings", { settings }) : mock.saveSettings(settings);

export const refreshNow = (): Promise<void> => (inApp ? invoke("refresh_now") : mock.refreshNow());

/** Head-to-head etc. for one match; rejects with a readable message. */
export const getMatchDetails = (fixtureId: number): Promise<MatchDetails> =>
  inApp ? invoke("get_match_details", { fixtureId }) : mock.getMatchDetails(fixtureId);

/** [code, name] pairs for the team picker */
export const listLeagues = (): Promise<[string, string][]> =>
  inApp ? invoke("list_leagues") : mock.listLeagues();

export const listTeams = (league: string): Promise<TeamChoice[]> =>
  inApp ? invoke("list_teams", { league }) : mock.listTeams(league);

/** Goals, cards, stats, line-ups (Highlightly); rejects with a readable message. */
export const getMatchStats = (fixtureId: number): Promise<StatsResult> =>
  inApp ? invoke("get_match_stats", { fixtureId }) : mock.getMatchStats(fixtureId);

export const testNotification = (): Promise<void> =>
  inApp ? invoke("test_notification") : Promise.resolve(alert("Test notification"));

export const testGoalAlert = (): Promise<void> =>
  inApp ? invoke("test_goal_alert") : Promise.resolve(alert("⚽ GOAL! (test)"));

/** Calls back whenever the Rust side has new data. Returns an unsubscribe function. */
export function onSnapshot(callback: (s: Snapshot) => void): () => void {
  if (!inApp) return mock.onSnapshot(callback);
  const unlisten = listen<Snapshot>("state-updated", (e) => callback(e.payload));
  return () => void unlisten.then((stop) => stop());
}

export function onSettings(callback: (s: Settings) => void): () => void {
  if (!inApp) return mock.onSettings(callback);
  const unlisten = listen<Settings>("settings-updated", (e) => callback(e.payload));
  return () => void unlisten.then((stop) => stop());
}

export const openLink = (url: string): Promise<void> =>
  inApp ? openUrl(url) : Promise.resolve(void window.open(url, "_blank"));

export const hideWindow = () => (inApp ? getCurrentWindow().hide() : Promise.resolve());
export const minimizeWindow = () => (inApp ? getCurrentWindow().minimize() : Promise.resolve());
