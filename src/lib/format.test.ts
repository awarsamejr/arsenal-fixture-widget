import { describe, expect, it } from "vitest";
import {
  competitionShort,
  countdown,
  dayLabel,
  formBefore,
  headlineFixture,
  stageLabel,
  matchesSearch,
  ourScoreText,
  recentResults,
  scoreText,
  updatedAgo,
} from "./format";
import type { Fixture } from "./types";

const base: Fixture = {
  id: 1,
  kickoff: "2026-10-24T14:00:00Z",
  timeTbd: false,
  status: "scheduled",
  competition: "Premier League",
  competitionCode: "PL",
  competitionEmblem: null,
  home: true,
  arsenal: { name: "Arsenal FC", shortName: "Arsenal", crest: null },
  opponent: { name: "Tottenham Hotspur FC", shortName: "Tottenham", crest: null },
  arsenalGoals: null,
  opponentGoals: null,
  outcome: null,
  halfTimeArsenal: null,
  halfTimeOpponent: null,
  matchday: null,
  stage: null,
  referee: null,
};

describe("countdown", () => {
  it("shows the two biggest units", () => {
    expect(countdown((2 * 86400 + 14 * 3600 + 5 * 60) * 1000)).toBe("2d 14h");
    expect(countdown((3 * 3600 + 5 * 60) * 1000)).toBe("3h 05m");
    expect(countdown((12 * 60 + 3) * 1000)).toBe("12m 03s");
  });
  it("says kicking off once the time has passed", () => {
    expect(countdown(0)).toBe("Kicking off");
    expect(countdown(-5000)).toBe("Kicking off");
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 9, 22, 12, 0); // local time, 22 Oct
  it("uses friendly words for nearby days", () => {
    expect(dayLabel(new Date(2026, 9, 22, 20, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 23, 9, 0).toISOString(), now)).toBe("Tomorrow");
    expect(dayLabel(new Date(2026, 9, 21, 9, 0).toISOString(), now)).toBe("Yesterday");
  });
  it("falls back to a short date", () => {
    expect(dayLabel(new Date(2026, 9, 24, 15, 0).toISOString(), now)).toBe("Sat 24 Oct");
  });
});

describe("scoreText", () => {
  it("puts the home side first", () => {
    expect(scoreText({ ...base, arsenalGoals: 2, opponentGoals: 1 })).toBe("2–1");
    expect(scoreText({ ...base, home: false, arsenalGoals: 2, opponentGoals: 1 })).toBe("1–2");
    expect(scoreText(base)).toBe("–");
  });
  it("can show Arsenal's goals first", () => {
    expect(ourScoreText({ ...base, home: false, arsenalGoals: 0, opponentGoals: 3 })).toBe("0–3");
  });
  it("shortens competition names", () => {
    expect(competitionShort({ competition: "UEFA Champions League", competitionCode: "CL" })).toBe("UCL");
    expect(competitionShort({ competition: "Premier League", competitionCode: "PL" })).toBe("PL");
  });
});

describe("fixture lists", () => {
  const played = { ...base, id: 1, status: "finished" as const, kickoff: "2026-10-01T14:00:00Z" };
  const live = { ...base, id: 2, status: "live" as const, kickoff: "2026-10-20T14:00:00Z" };
  const next = { ...base, id: 3, kickoff: "2026-10-30T14:00:00Z" };

  it("prefers a live match as the headline", () => {
    expect(headlineFixture([played, live, next])?.id).toBe(2);
    expect(headlineFixture([played, next])?.id).toBe(3);
  });
  it("lists results newest first", () => {
    const older = { ...played, id: 9, kickoff: "2026-09-01T14:00:00Z" };
    expect(recentResults([older, played, next]).map((f) => f.id)).toEqual([1, 9]);
  });
});

describe("matchesSearch", () => {
  it("matches partial names, nicknames and competitions", () => {
    expect(matchesSearch(base, "tott")).toBe(true);
    expect(matchesSearch(base, "Spurs")).toBe(true);
    expect(matchesSearch(base, "premier")).toBe(true);
    expect(matchesSearch(base, "chelsea")).toBe(false);
    expect(matchesSearch(base, "  ")).toBe(true);
  });
});

describe("stageLabel", () => {
  it("names the round and matchday", () => {
    expect(stageLabel({ stage: "REGULAR_SEASON", matchday: 8 })).toBe("Matchday 8");
    expect(stageLabel({ stage: "LEAGUE_STAGE", matchday: 3 })).toBe("League stage · Matchday 3");
    expect(stageLabel({ stage: "QUARTER_FINALS", matchday: null })).toBe("Quarter-finals");
    expect(stageLabel({ stage: "FINAL", matchday: null })).toBe("Final");
    expect(stageLabel({ stage: null, matchday: null })).toBe("");
  });
});

describe("formBefore", () => {
  it("takes only results before the match, oldest first", () => {
    const games = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ ...base, id: d, status: "finished" as const, kickoff: `2026-10-0${d}T14:00:00Z` }));
    expect(formBefore(games, "2026-10-06T14:00:00Z").map((f) => f.id)).toEqual([1, 2, 3, 4, 5]);
    expect(formBefore(games, "2026-10-03T14:00:00Z", 5).map((f) => f.id)).toEqual([1, 2]);
  });
});

describe("updatedAgo", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("describes how long ago", () => {
    expect(updatedAgo("2026-10-22T11:59:40Z", now)).toBe("just now");
    expect(updatedAgo("2026-10-22T11:55:00Z", now)).toBe("5 min ago");
    expect(updatedAgo("2026-10-22T09:00:00Z", now)).toBe("3 h ago");
    expect(updatedAgo(null, now)).toBe("never");
  });
});
