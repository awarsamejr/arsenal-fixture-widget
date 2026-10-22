// football-data.org → the shapes the UI uses. Mirrors src-tauri/src/models.rs
// and api.rs, so the website and the desktop widget show the same thing.

import type { Fixture, MatchDetails, MatchStatus, Outcome, TableRow, TeamChoice, TeamInfo } from "../../src/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- raw API JSON */
type Raw = any;

export function statusFromApi(status: string): MatchStatus {
  switch (status) {
    case "IN_PLAY":
    case "LIVE":
      return "live";
    case "PAUSED":
      return "halftime";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled"; // SCHEDULED, TIMED
  }
}

function teamInfo(t: Raw): TeamInfo {
  const name = t?.name ?? "TBD";
  return { name, shortName: t?.shortName ?? name, crest: t?.crest ?? null };
}

/** A match from the followed team's side; null if they aren't playing in it. */
export function toFixture(m: Raw, teamId: number): Fixture | null {
  let home: boolean;
  if (m.homeTeam?.id === teamId) home = true;
  else if (m.awayTeam?.id === teamId) home = false;
  else return null;

  const ours = (g: Raw): [number | null, number | null] =>
    home ? [g?.home ?? null, g?.away ?? null] : [g?.away ?? null, g?.home ?? null];
  const [teamGoals, opponentGoals] = ours(m.score?.fullTime);
  const [halfTimeTeam, halfTimeOpponent] = ours(m.score?.halfTime);
  const status = statusFromApi(m.status);
  let outcome: Outcome | null = null;
  if (status === "finished" && teamGoals != null && opponentGoals != null) {
    outcome = teamGoals > opponentGoals ? "win" : teamGoals < opponentGoals ? "loss" : "draw";
  }
  const referee = (m.referees ?? []).find((r: Raw) => !r.type || r.type === "REFEREE")?.name ?? null;

  return {
    id: m.id,
    kickoff: m.utcDate,
    // TIMED means the kick-off time is confirmed; SCHEDULED means only the date is
    timeTbd: m.status === "SCHEDULED",
    status,
    competition: m.competition.name,
    competitionCode: m.competition.code ?? null,
    competitionEmblem: m.competition.emblem ?? null,
    home,
    team: teamInfo(home ? m.homeTeam : m.awayTeam),
    opponent: teamInfo(home ? m.awayTeam : m.homeTeam),
    teamGoals,
    opponentGoals,
    outcome,
    halfTimeTeam,
    halfTimeOpponent,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    referee,
  };
}

export function parseFixtures(body: Raw, teamId: number): Fixture[] {
  return (body.matches as Raw[])
    .map((m) => toFixture(m, teamId))
    .filter((f): f is Fixture => f !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function parseTable(body: Raw, teamId: number): TableRow[] {
  const total = (body.standings as Raw[]).find((g) => g.type === "TOTAL");
  if (!total) throw new Error("no league table");
  return (total.table as Raw[]).map((r) => ({
    position: r.position,
    team: teamInfo(r.team),
    played: r.playedGames,
    won: r.won,
    draw: r.draw,
    lost: r.lost,
    goalDifference: r.goalDifference,
    points: r.points,
    isTeam: r.team?.id === teamId,
  }));
}

export function parseTeams(body: Raw, league: string): TeamChoice[] {
  return (body.teams as Raw[])
    .map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName ?? t.name,
      crest: t.crest ?? null,
      league,
      venue: t.venue ?? null,
      colors: t.clubColors ?? null,
    }))
    .sort((a, b) => (a.shortName < b.shortName ? -1 : a.shortName > b.shortName ? 1 : 0));
}

/** Head-to-head from the team's side: previous meetings newest first, plus the record. */
export function parseMatchDetails(body: Raw, matchId: number, teamId: number): MatchDetails {
  const meetings = parseFixtures(body, teamId)
    .filter((f) => f.id !== matchId && f.status === "finished")
    .reverse();
  const h = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const f of meetings) {
    h.played++;
    h.goalsFor += f.teamGoals ?? 0;
    h.goalsAgainst += f.opponentGoals ?? 0;
    if (f.outcome === "win") h.wins++;
    else if (f.outcome === "draw") h.draws++;
    else if (f.outcome === "loss") h.losses++;
  }
  return { fixtureId: matchId, headToHead: h, meetings };
}
