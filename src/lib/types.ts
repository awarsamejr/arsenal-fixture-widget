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
  arsenal: TeamInfo;
  opponent: TeamInfo;
  arsenalGoals: number | null;
  opponentGoals: number | null;
  outcome: Outcome | null;
  halfTimeArsenal: number | null;
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
  isArsenal: boolean;
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

export interface Settings {
  apiKey: string;
  reminderMinutes: number[];
  resultNotifications: boolean;
  refreshMinutes: number;
  alwaysOnTop: boolean;
  streamLinks: StreamLink[];
}
