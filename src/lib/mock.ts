// Sample data for previewing the UI in a browser (`npm run dev`).
// Add ?live, ?nokey or ?error to the URL to see those states.

import type { Fixture, MatchDetails, MatchStats, Settings, Snapshot, StatsResult, TableRow, TeamInfo } from "./types";

const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
const crest = (id: number) => `https://crests.football-data.org/${id}.png`;
const team = (id: number, name: string, shortName: string): TeamInfo => ({ name, shortName, crest: crest(id) });

const arsenal = team(57, "Arsenal FC", "Arsenal");
const teams = {
  everton: team(62, "Everton FC", "Everton"),
  liverpool: team(64, "Liverpool FC", "Liverpool"),
  slavia: team(930, "SK Slavia Praha", "Slavia Praha"),
  spurs: team(73, "Tottenham Hotspur FC", "Tottenham"),
  chelsea: team(61, "Chelsea FC", "Chelsea"),
  villa: team(58, "Aston Villa FC", "Aston Villa"),
  bayern: team(5, "FC Bayern München", "Bayern"),
  brighton: team(397, "Brighton & Hove Albion FC", "Brighton Hove"),
  coventry: team(1076, "Coventry City FC", "Coventry City"),
  city: team(65, "Manchester City FC", "Man City"),
  newcastle: team(67, "Newcastle United FC", "Newcastle"),
};

const PL = { competition: "Premier League", competitionCode: "PL", competitionEmblem: "https://crests.football-data.org/PL.png" };
const CL = { competition: "UEFA Champions League", competitionCode: "CL", competitionEmblem: "https://crests.football-data.org/CL.png" };

const HOUR = 3600_000;
const DAY = 24 * HOUR;
let nextId = 1;

function fixture(offsetMs: number, opponent: TeamInfo, home: boolean, comp: typeof PL, score?: [number, number]): Fixture {
  const kickoff = new Date(Math.round((Date.now() + offsetMs) / (15 * 60_000)) * 15 * 60_000).toISOString();
  const [a, o] = score ?? [null, null];
  return {
    id: nextId++,
    kickoff,
    timeTbd: false,
    status: score ? "finished" : "scheduled",
    ...comp,
    home,
    arsenal,
    opponent,
    arsenalGoals: a,
    opponentGoals: o,
    outcome: score ? (score[0] > score[1] ? "win" : score[0] < score[1] ? "loss" : "draw") : null,
    halfTimeArsenal: score ? Math.min(score[0], 1) : null,
    halfTimeOpponent: score ? Math.min(score[1], 1) : null,
    matchday: comp.competitionCode === "PL" ? 8 : 3,
    stage: comp.competitionCode === "PL" ? "REGULAR_SEASON" : "LEAGUE_STAGE",
    referee: score ? "Michael Oliver" : null,
  };
}

function buildFixtures(): Fixture[] {
  const list = [
    fixture(-40 * DAY, teams.coventry, true, PL, [3, 0]),
    fixture(-33 * DAY, teams.brighton, false, PL, [0, 3]),
    fixture(-19 * DAY, teams.newcastle, true, PL, [2, 1]),
    fixture(-12 * DAY, teams.chelsea, false, PL, [1, 1]),
    fixture(-9 * DAY, teams.bayern, true, CL, [3, 0]),
    fixture(-1 * DAY, teams.bayern, false, CL, [2, 2]),
    fixture(2 * DAY + 3 * HOUR, teams.everton, true, PL),
    fixture(10 * DAY, teams.liverpool, false, PL),
    fixture(13 * DAY, teams.slavia, false, CL),
    fixture(17 * DAY, teams.spurs, true, PL),
    { ...fixture(24 * DAY, teams.villa, false, PL), timeTbd: true },
    { ...fixture(31 * DAY, teams.city, true, PL), timeTbd: true },
  ];
  if (params.has("live")) {
    const i = list.findIndex((f) => f.status === "scheduled");
    list[i] = { ...list[i], kickoff: new Date(Date.now() - 52 * 60_000).toISOString(), status: "live", arsenalGoals: 2, opponentGoals: 1 };
  }
  return list;
}

const tableTeams: [TeamInfo, number, number][] = [
  [teams.city, 21, 12], [arsenal, 19, 10], [teams.liverpool, 17, 8], [teams.chelsea, 15, 5],
  [teams.villa, 14, 4], [teams.newcastle, 13, 3], [teams.spurs, 12, 2], [teams.brighton, 11, 1],
  [team(66, "Manchester United FC", "Man United"), 10, 0], [team(354, "Crystal Palace FC", "Crystal Palace"), 10, -1],
  [team(563, "West Ham United FC", "West Ham"), 9, -2], [team(351, "Nottingham Forest FC", "Nottingham"), 9, -2],
  [team(402, "Brentford FC", "Brentford"), 8, -3], [team(63, "Fulham FC", "Fulham"), 8, -4],
  [team(1044, "AFC Bournemouth", "Bournemouth"), 7, -4], [teams.everton, 6, -5],
  [team(76, "Wolverhampton Wanderers FC", "Wolverhampton"), 5, -6], [teams.coventry, 4, -7],
  [team(341, "Leeds United FC", "Leeds United"), 3, -8], [team(328, "Burnley FC", "Burnley"), 2, -10],
];

function buildTable(): TableRow[] {
  return tableTeams.map(([t, points, gd], i) => ({
    position: i + 1,
    team: t,
    played: 8,
    won: Math.floor(points / 3),
    draw: points % 3,
    lost: 8 - Math.floor(points / 3) - (points % 3),
    goalDifference: gd,
    points,
    isArsenal: t === arsenal,
  }));
}

let snapshot: Snapshot = {
  fixtures: params.has("nokey") ? [] : buildFixtures(),
  table: params.has("nokey") ? [] : buildTable(),
  lastUpdated: new Date(Date.now() - 4 * 60_000).toISOString(),
  error: params.has("error") ? "Can't reach football-data.org. Check your connection." : null,
  hasApiKey: !params.has("nokey"),
  refreshing: false,
};

let settings: Settings = {
  apiKey: "",
  statsApiKey: "",
  reminderMinutes: [1440, 60, 0],
  resultNotifications: true,
  refreshMinutes: 15,
  alwaysOnTop: true,
  streamLinks: [],
};

const snapshotListeners = new Set<(s: Snapshot) => void>();
const settingsListeners = new Set<(s: Settings) => void>();

export async function getMatchDetails(fixtureId: number): Promise<MatchDetails> {
  await new Promise((r) => setTimeout(r, 600)); // feel the loading state
  const f = snapshot.fixtures.find((x) => x.id === fixtureId);
  if (!f) throw "Match not found";
  const scores: [number, number][] = [[2, 0], [1, 1], [0, 1], [3, 1], [2, 2], [1, 0]];
  const meetings = scores.map(([a, o], i) => ({
    ...fixture(-(200 + i * 180) * DAY, f.opponent, i % 2 === 0, PL, [a, o]),
    status: "finished" as const,
  }));
  const wins = scores.filter(([a, o]) => a > o).length;
  const draws = scores.filter(([a, o]) => a === o).length;
  return {
    fixtureId,
    headToHead: {
      played: scores.length,
      wins,
      draws,
      losses: scores.length - wins - draws,
      goalsFor: scores.reduce((n, [a]) => n + a, 0),
      goalsAgainst: scores.reduce((n, [, o]) => n + o, 0),
    },
    meetings,
  };
}

/** Sample stats; ?nostats pretends there's no Highlightly key. */
export async function getMatchStats(fixtureId: number): Promise<StatsResult> {
  await new Promise((r) => setTimeout(r, 700));
  if (params.has("nostats")) return { status: "noKey" };
  const f = snapshot.fixtures.find((x) => x.id === fixtureId);
  if (!f) throw "Match not found";
  const played = f.status !== "scheduled";
  const row = (...names: string[]) => names.map((name, i) => ({ name, number: i + 2 }));
  const stats: MatchStats = {
    venue: f.home ? "Emirates Stadium, London" : `${f.opponent.shortName} Stadium`,
    weather: "Cloudy, 12°C",
    prediction: { arsenalWin: 52.4, draw: 25.1, opponentWin: 22.5, live: played },
    events: played
      ? [
          { minute: "12", kind: "goal", arsenal: true, player: "Bukayo Saka", detail: "Martin Ødegaard" },
          { minute: "34", kind: "yellowCard", arsenal: false, player: "Opposition No. 6", detail: null },
          { minute: "45+2", kind: "penaltyGoal", arsenal: false, player: "Opposition No. 9", detail: null },
          { minute: "61", kind: "substitution", arsenal: true, player: "Kai Havertz", detail: "Viktor Gyökeres" },
          { minute: "78", kind: "goal", arsenal: true, player: "Declan Rice", detail: "Viktor Gyökeres" },
          { minute: "88", kind: "redCard", arsenal: false, player: "Opposition No. 4", detail: null },
        ]
      : [],
    stats: played
      ? [
          { label: "Possession", arsenal: 0.61, opponent: 0.39, format: "percent" },
          { label: "Expected goals (xG)", arsenal: 2.14, opponent: 0.87, format: "decimal" },
          { label: "Shots", arsenal: 17, opponent: 8, format: "count" },
          { label: "Shots on target", arsenal: 7, opponent: 3, format: "count" },
          { label: "Pass accuracy", arsenal: 0.89, opponent: 0.78, format: "percent" },
          { label: "Corners", arsenal: 8, opponent: 2, format: "count" },
          { label: "Fouls", arsenal: 9, opponent: 14, format: "count" },
        ]
      : [],
    lineups: played
      ? {
          arsenal: {
            formation: "4-3-3",
            rows: [row("David Raya"), row("R. Calafiori", "Gabriel", "W. Saliba", "J. Timber"), row("M. Ødegaard", "D. Rice", "M. Merino"), row("G. Martinelli", "K. Havertz", "B. Saka")],
            substitutes: row("V. Gyökeres", "E. Eze", "M. Lewis-Skelly"),
          },
          opponent: {
            formation: "4-2-3-1",
            rows: [row("Keeper"), row("LB", "CB", "CB", "RB"), row("CM", "CM"), row("LW", "AM", "RW"), row("ST")],
            substitutes: row("Sub One", "Sub Two"),
          },
        }
      : null,
  };
  return { status: "ready", stats, requestsLeft: 93 };
}

export const getSnapshot = async () => snapshot;
export const getSettings = async () => settings;

export async function saveSettings(next: Settings) {
  settings = next;
  settingsListeners.forEach((l) => l(settings));
  return settings;
}

export async function refreshNow() {
  snapshot = { ...snapshot, refreshing: true };
  snapshotListeners.forEach((l) => l(snapshot));
  setTimeout(() => {
    snapshot = { ...snapshot, refreshing: false, lastUpdated: new Date().toISOString() };
    snapshotListeners.forEach((l) => l(snapshot));
  }, 800);
}

export function onSnapshot(cb: (s: Snapshot) => void) {
  snapshotListeners.add(cb);
  return () => void snapshotListeners.delete(cb);
}

export function onSettings(cb: (s: Settings) => void) {
  settingsListeners.add(cb);
  return () => void settingsListeners.delete(cb);
}
