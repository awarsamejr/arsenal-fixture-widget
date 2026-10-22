// Mirrors the Rust types in src-tauri/src/models.rs and settings.rs

export type MatchStatus = "scheduled" | "live" | "halftime" | "finished" | "postponed" | "cancelled";
export type Outcome = "win" | "draw" | "loss";

export interface TeamInfo {
  name: string;
  shortName: string;
  crest: string | null;
}

export interface Fixture {
  id: number;
  /** ISO timestamp in UTC */
  kickoff: string;
  timeTbd: boolean;
  status: MatchStatus;
  competition: string;
  competitionCode: string | null;
  competitionEmblem: string | null;
  home: boolean;
  team: TeamInfo;
  opponent: TeamInfo;
  teamGoals: number | null;
  opponentGoals: number | null;
  outcome: Outcome | null;
  halfTimeTeam: number | null;
  halfTimeOpponent: number | null;
  matchday: number | null;
  /** e.g. "REGULAR_SEASON", "LEAGUE_STAGE", "QUARTER_FINALS" */
  stage: string | null;
  referee: string | null;
}

export interface HeadToHead {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MatchDetails {
  fixtureId: number;
  headToHead: HeadToHead;
  /** Previous meetings, newest first */
  meetings: Fixture[];
}

export interface TableRow {
  position: number;
  team: TeamInfo;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalDifference: number;
  points: number;
  isTeam: boolean;
}

export interface Snapshot {
  fixtures: Fixture[];
  table: TableRow[];
  lastUpdated: string | null;
  error: string | null;
  hasApiKey: boolean;
  refreshing: boolean;
}

export interface StreamLink {
  name: string;
  url: string;
}

// ---------- Highlightly match stats (src-tauri/src/highlightly.rs) ----------

export type EventKind = "goal" | "penaltyGoal" | "ownGoal" | "missedPenalty" | "yellowCard" | "redCard" | "substitution" | "var";

export interface MatchEvent {
  minute: string;
  kind: EventKind;
  team: boolean;
  player: string;
  /** Assist for goals, player coming on for subs */
  detail: string | null;
}

export interface StatLine {
  label: string;
  team: number;
  opponent: number;
  format: "percent" | "decimal" | "count";
}

export interface LineupPlayer {
  name: string;
  number: number | null;
}

export interface TeamLineup {
  formation: string | null;
  /** Goalkeeper first, then each line further forward, left to right */
  rows: LineupPlayer[][];
  substitutes: LineupPlayer[];
}

export interface Prediction {
  teamWin: number;
  draw: number;
  opponentWin: number;
  live: boolean;
}

export interface MatchStats {
  events: MatchEvent[];
  stats: StatLine[];
  lineups: { team: TeamLineup; opponent: TeamLineup } | null;
  venue: string | null;
  weather: string | null;
  prediction: Prediction | null;
}

export type StatsResult =
  | { status: "noKey" }
  | { status: "notFound" }
  | { status: "ready"; stats: MatchStats; requestsLeft: number | null };

/** The team the app follows (src-tauri/src/models.rs TeamChoice) */
export interface TeamChoice {
  id: number;
  name: string;
  shortName: string;
  crest: string | null;
  /** League code for the table, e.g. "PL" */
  league: string;
  venue: string | null;
  /** e.g. "Red / White" */
  colors: string | null;
}

export interface Settings {
  team: TeamChoice;
  apiKey: string;
  statsApiKey: string;
  goalAlerts: boolean;
  miniMode: boolean;
  reminderMinutes: number[];
  resultNotifications: boolean;
  refreshMinutes: number;
  alwaysOnTop: boolean;
  streamLinks: StreamLink[];
}
