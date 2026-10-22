// Highlightly → match stats for the UI. Mirrors src-tauri/src/highlightly.rs.

import type { EventKind, LineupPlayer, MatchEvent, MatchStats, StatLine, TeamLineup } from "../../src/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- raw API JSON */
type Raw = any;

/** Repairs UTF-8 text that was decoded as Latin-1 upstream: "DÃ­az" → "Díaz". */
export function fixText(s: string): string {
  if (!/[ÃÂÅÄ]/.test(s)) return s;
  const bytes = [...s].map((c) => c.charCodeAt(0));
  if (bytes.some((b) => b > 255)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

export function eventKind(kind: string): EventKind | null {
  const k = kind.toLowerCase();
  if (k.includes("var")) return k.includes("confirmed") ? null : "var"; // "VAR Goal Confirmed" repeats the goal
  if (k.includes("own goal")) return "ownGoal";
  if (k.includes("penalty") && k.includes("miss")) return "missedPenalty";
  if (k === "penalty" || k.includes("penalty goal")) return "penaltyGoal";
  if (k.includes("goal")) return "goal";
  if (k.includes("red")) return "redCard"; // also "Yellow-Red Card"
  if (k.includes("yellow")) return "yellowCard";
  if (k.includes("substitution")) return "substitution";
  return null;
}

/** Shown on the match screen in this order: [API name, label, format] */
const STAT_LINES: [string, string, StatLine["format"]][] = [
  ["Possession", "Possession", "percent"],
  ["Expected Goals", "Expected goals (xG)", "decimal"],
  ["Total shots", "Shots", "count"],
  ["Shots on target", "Shots on target", "count"],
  ["Big Chances Created", "Big chances", "count"],
  ["Pass accuracy", "Pass accuracy", "percent"],
  ["Corners", "Corners", "count"],
  ["Goalkeeper saves", "Saves", "count"],
  ["Fouls", "Fouls", "count"],
  ["Offsides", "Offsides", "count"],
  ["Yellow cards", "Yellow cards", "count"],
  ["Red cards", "Red cards", "count"],
];

function statLines(teams: Raw[], teamId: number): StatLine[] {
  const find = (ours: boolean, name: string): number | null => {
    const team = teams.find((t) => (t.team.id === teamId) === ours);
    if (!team) return null;
    const get = (n: string): number | null =>
      team.statistics.find((s: Raw) => s.displayName.toLowerCase() === n.toLowerCase())?.value ?? null;
    if (name === "Total shots") {
      const on = get("Shots on target");
      const off = get("Shots off target");
      return on == null || off == null ? null : on + off + (get("Blocked shots") ?? 0);
    }
    if (name === "Pass accuracy") {
      const total = get("Total passes");
      return total ? (get("Successful passes") ?? 0) / total : null;
    }
    return get(name);
  };
  const lines: StatLine[] = [];
  for (const [name, label, format] of STAT_LINES) {
    const team = find(true, name);
    const opponent = find(false, name);
    if (team != null && opponent != null) lines.push({ label, team, opponent, format });
  }
  return lines;
}

export function parseMatch(body: Raw, teamId: number): MatchStats {
  const m = Array.isArray(body) ? body[body.length - 1] : body;
  if (!m) throw new Error("match not found");
  const teamHome = m.homeTeam.id === teamId;

  const events: MatchEvent[] = [];
  for (const e of m.events ?? []) {
    const kind = eventKind(e.type);
    if (!kind) continue;
    const detail = kind === "substitution" ? e.substituted : kind === "goal" || kind === "penaltyGoal" ? e.assist : null;
    events.push({
      minute: String(e.time ?? "").replace(/'$/, ""),
      kind,
      team: e.team.id === teamId,
      player: fixText(e.player ?? "Unknown").trim(),
      detail: detail ? fixText(detail).trim() : null,
    });
  }

  let venue: string | null = null;
  if (m.venue?.name) venue = m.venue.city ? `${fixText(m.venue.name)}, ${fixText(m.venue.city)}` : fixText(m.venue.name);

  let weather: string | null = null;
  if (m.forecast) {
    const raw = m.forecast.status ? fixText(m.forecast.status) : "";
    const status = raw ? raw[0].toUpperCase() + raw.slice(1) : null;
    const t = parseFloat(fixText(m.forecast.temperature ?? "").replace("°C", ""));
    const temp = Number.isFinite(t) ? `${Math.round(t)}°C` : null;
    weather = [status, temp].filter(Boolean).join(", ") || null;
  }

  // Latest in-match prediction, else the latest pre-match one
  const latest = (list: Raw[] = []) => [...list].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt)).pop();
  const live = latest(m.predictions?.live);
  const pick = live ?? latest(m.predictions?.prematch);
  let prediction: MatchStats["prediction"] = null;
  if (pick) {
    const pct = (s: string) => parseFloat(s.replace("%", ""));
    const [home, draw, away] = [pct(pick.probabilities.home), pct(pick.probabilities.draw), pct(pick.probabilities.away)];
    if ([home, draw, away].every(Number.isFinite)) {
      prediction = { teamWin: teamHome ? home : away, draw, opponentWin: teamHome ? away : home, live: !!live };
    }
  }

  return { events, stats: statLines(m.statistics ?? [], teamId), lineups: null, venue, weather, prediction };
}

const player = (p: Raw): LineupPlayer => ({ name: fixText(p.name).trim(), number: p.number ?? null });

export function parseLineups(body: Raw, teamId: number): MatchStats["lineups"] {
  const convert = (l: Raw): TeamLineup => ({
    formation: l.formation ?? null,
    rows: (l.initialLineup ?? []).map((row: Raw[]) => row.map(player)),
    substitutes: (l.substitutes ?? []).map(player),
  });
  const [ours, theirs] = body.homeTeam.id === teamId ? [body.homeTeam, body.awayTeam] : [body.awayTeam, body.homeTeam];
  if (!ours.initialLineup?.length) return null; // not announced yet
  return { team: convert(ours), opponent: convert(theirs) };
}

/** "FC Bayern München" → "Bayern München", "Arsenal FC" → "Arsenal" */
export function cleanTeamName(name: string): string {
  const noise = new Set(["FC", "AFC", "CF", "SC", "SV", "AC", "SSC", "1.", "&"]);
  return name.split(/\s+/).filter((w) => w && !noise.has(w)).join(" ");
}

const ENGLISH: Record<string, string> = {
  München: "Munich",
  Köln: "Cologne",
  Milano: "Milan",
  Lisboa: "Lisbon",
  Praha: "Prague",
  Wien: "Vienna",
  Torino: "Turin",
  Sevilla: "Seville",
  Firenze: "Florence",
  Genova: "Genoa",
};

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Highlightly's team search only finds exact (case-insensitive) names, so try
 * a few spellings: "FC Bayern München" → "Bayern München", "Bayern Munich", "Bayern".
 */
export function teamNameVariants(name: string, shortName: string): string[] {
  const clean = cleanTeamName(name);
  const english = clean.split(" ").map((w) => ENGLISH[w] ?? w).join(" ");
  return [...new Set([clean, english, shortName, stripAccents(english)].map((s) => s.trim()).filter(Boolean))];
}

/** Clubs (not national teams) whose name matches, exact matches first; at most 3. */
export function rankTeamCandidates(body: Raw, names: string[]): number[] {
  const wanted = names.map((n) => n.toLowerCase()).filter(Boolean);
  const clubs: Raw[] = (body.data ?? []).filter((t: Raw) => t.type !== "national");
  const exact = clubs.filter((t) => wanted.includes(t.name.toLowerCase()));
  const partial = clubs.filter((t) => {
    const n = t.name.toLowerCase();
    return !wanted.includes(n) && wanted.some((w) => n.includes(w) || w.includes(n));
  });
  return [...new Set([...exact, ...partial].map((t) => t.id as number))].slice(0, 3);
}

/** Highlightly's id for the match on that day closest to the kick-off. */
export function parseMatchId(body: Raw, kickoff: string): number | null {
  const target = new Date(kickoff).getTime();
  const list: Raw[] = body.data ?? [];
  if (!list.length) return null;
  return list.reduce((best, m) =>
    Math.abs(new Date(m.date).getTime() - target) < Math.abs(new Date(best.date).getTime() - target) ? m : best,
  ).id;
}
