// Same saved API responses as the Rust tests (src-tauri/testdata), so the
// website and the desktop widget are checked against identical data.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFixtures, parseMatchDetails, parseTable, parseTeams } from "./footballData";
import { cleanTeamName, fixText, parseLineups, parseMatch, parseMatchId, rankTeamCandidates, teamNameVariants } from "./highlightly";

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../src-tauri/testdata/${name}`, import.meta.url), "utf-8"));
const ARSENAL = 57;
const EVERTON = 62;
const HL_ARSENAL = 36526;
const HL_BAYERN = 134391;

describe("football-data", () => {
  const matches = load("matches.json");

  it("builds every fixture from the team's side, oldest first", () => {
    const fixtures = parseFixtures(matches, ARSENAL);
    expect(fixtures).toHaveLength(46);
    expect(fixtures.every((f, i) => i === 0 || fixtures[i - 1].kickoff <= f.kickoff)).toBe(true);
    const first = fixtures[0];
    expect([first.home, first.opponent.shortName, first.teamGoals, first.opponentGoals, first.outcome]).toEqual([true, "Coventry City", 3, 0, "win"]);
    expect([first.halfTimeTeam, first.halfTimeOpponent, first.referee, first.matchday]).toEqual([2, 0, "Thomas Bramall", 1]);
    const brighton = fixtures.find((f) => f.opponent.shortName === "Brighton Hove")!;
    expect([brighton.home, brighton.teamGoals, brighton.opponentGoals, brighton.outcome]).toEqual([false, 0, 3, "loss"]);
    expect(fixtures.filter((f) => f.status === "scheduled")).toHaveLength(36);
  });

  it("reads the same data from another team's side", () => {
    const everton = parseFixtures(matches, EVERTON);
    expect(everton.length).toBeGreaterThan(0);
    expect(everton.every((f) => f.team.shortName === "Everton" && f.opponent.shortName === "Arsenal")).toBe(true);
    expect(parseTable(load("standings.json"), EVERTON).find((r) => r.isTeam)?.team.shortName).toBe("Everton");
  });

  it("parses the table and team list", () => {
    const table = parseTable(load("standings.json"), ARSENAL);
    expect(table).toHaveLength(20);
    expect(table.filter((r) => r.isTeam)).toHaveLength(1);
    const teams = parseTeams(load("teams_pl.json"), "PL");
    expect(teams).toHaveLength(20);
    expect(teams.find((t) => t.id === 61)).toMatchObject({ shortName: "Chelsea", colors: "Royal Blue / White", venue: "Stamford Bridge", league: "PL" });
  });

  it("builds head-to-head newest first", () => {
    const d = parseMatchDetails(load("head2head.json"), 560616, ARSENAL);
    expect(d.headToHead.played).toBe(d.meetings.length);
    expect(d.headToHead.wins + d.headToHead.draws + d.headToHead.losses).toBe(d.headToHead.played);
    expect(d.meetings.every((m) => m.id !== 560616)).toBe(true);
    expect(d.meetings.every((m, i) => i === 0 || d.meetings[i - 1].kickoff >= m.kickoff)).toBe(true);
    const awayWin = d.meetings.find((m) => m.kickoff.startsWith("2025-12-20"))!;
    expect([awayWin.teamGoals, awayWin.opponentGoals, awayWin.outcome]).toEqual([1, 0, "win"]);
  });
});

describe("Highlightly", () => {
  const match = load("hl_match.json");

  it("reads events from the team's side", () => {
    const s = parseMatch(match, HL_ARSENAL);
    const goals = s.events.filter((e) => e.kind === "goal" || e.kind === "penaltyGoal");
    expect(goals).toHaveLength(4);
    expect(goals.filter((g) => g.team)).toHaveLength(2);
    expect(goals[0]).toMatchObject({ minute: "25", player: "Eberechi Eze", detail: "Martin Odegaard" });
    expect(s.events.some((e) => e.kind === "var")).toBe(false);
    expect(s.events.find((e) => e.kind === "substitution")).toMatchObject({ player: "Bukayo Saka", detail: "Eberechi Eze" });
    expect(s.events.some((e) => e.player === "Ezri Konsa")).toBe(true);
  });

  it("flips sides for the other team", () => {
    const ours = parseMatch(match, HL_ARSENAL);
    const theirs = parseMatch(match, HL_BAYERN);
    expect(ours.events.every((e, i) => e.team !== theirs.events[i].team)).toBe(true);
    expect([ours.stats[0].team, ours.stats[0].opponent]).toEqual([theirs.stats[0].opponent, theirs.stats[0].team]);
  });

  it("builds stat lines, venue, weather and prediction", () => {
    const s = parseMatch(match, HL_ARSENAL);
    const get = (label: string) => s.stats.find((l) => l.label === label)!;
    expect([get("Possession").team, get("Possession").opponent]).toEqual([0.54, 0.46]);
    expect(get("Shots").team).toBe(14);
    expect(get("Pass accuracy").team).toBeCloseTo(436 / 502);
    expect(s.venue).toBe("Allianz Arena, Munich");
    expect(s.weather).toBe("Rain, 9°C");
    expect(s.prediction?.live).toBe(true);
    expect(s.prediction!.teamWin + s.prediction!.draw + s.prediction!.opponentWin).toBeCloseTo(100, 0);
  });

  it("reads line-ups with the team first", () => {
    const l = parseLineups(load("hl_lineups.json"), HL_ARSENAL)!;
    expect(l.team.formation).toBe("4-3-3");
    expect(l.team.rows[0][0].name).toBe("David Raya");
    expect(l.team.rows.flat()).toHaveLength(11);
    expect(l.opponent.substitutes.some((p) => p.name === "L. Díaz")).toBe(true);
  });

  it("finds teams and matches", () => {
    expect(rankTeamCandidates(load("hl_teams.json"), [cleanTeamName("Arsenal FC"), "Arsenal"])).toEqual([36526, 8016353]);
    expect(cleanTeamName("FC Bayern München")).toBe("Bayern München");
    expect(teamNameVariants("FC Bayern München", "Bayern")).toEqual(["Bayern München", "Bayern Munich", "Bayern"]);
    expect(teamNameVariants("1. FC Köln", "1. FC Köln")).toEqual(["Köln", "Cologne", "1. FC Köln"]);
    expect(teamNameVariants("Arsenal FC", "Arsenal")).toEqual(["Arsenal"]);
    expect(parseMatchId(load("hl_matches.json"), "2026-10-21T19:00:00Z")).not.toBeNull();
    expect(parseMatchId({ data: [] }, "2026-10-21T19:00:00Z")).toBeNull();
  });

  it("repairs double-encoded text only", () => {
    expect(fixText("L. DÃ­az")).toBe("L. Díaz");
    expect(fixText("9.24Â°C")).toBe("9.24°C");
    expect(fixText("Ødegaard")).toBe("Ødegaard");
  });
});
