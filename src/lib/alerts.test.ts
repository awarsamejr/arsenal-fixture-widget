import { describe, expect, it } from "vitest";
import { dueNotices, goalNotices, leadLabel, nextFetchDelay } from "./alerts";
import type { Fixture, Settings } from "./types";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 24, h, m));
const MIN = 60_000;

function fixture(id: number, kickoff: Date, status: Fixture["status"], goals?: [number, number]): Fixture {
  return {
    id,
    kickoff: kickoff.toISOString(),
    timeTbd: false,
    status,
    competition: "Premier League",
    competitionCode: "PL",
    competitionEmblem: null,
    home: true,
    team: { name: "Arsenal FC", shortName: "Arsenal", crest: null },
    opponent: { name: "Everton FC", shortName: "Everton", crest: null },
    teamGoals: goals?.[0] ?? null,
    opponentGoals: goals?.[1] ?? null,
    outcome: goals ? (goals[0] > goals[1] ? "win" : goals[0] < goals[1] ? "loss" : "draw") : null,
    halfTimeTeam: null,
    halfTimeOpponent: null,
    matchday: null,
    stage: null,
    referee: null,
  };
}

const settings = { reminderMinutes: [1440, 60, 0], resultNotifications: true } as Settings;

describe("dueNotices", () => {
  it("sends each reminder once, inside its window", () => {
    const f = [fixture(7, at(14), "scheduled")];
    expect(dueNotices(f, at(12), settings, new Set())).toEqual([]);
    const due = dueNotices(f, at(13, 5), settings, new Set());
    expect(due.map((n) => [n.key, n.title])).toEqual([["7:r60", "Arsenal v Everton in 1 hour"]]);
    expect(dueNotices(f, at(13, 10), settings, new Set(["7:r60"]))).toEqual([]);
    expect(dueNotices(f, at(13, 45), settings, new Set())).toEqual([]); // too late
    expect(dueNotices(f, at(14), settings, new Set(["7:r60"]))[0].title).toBe("Kick-off: Arsenal v Everton");
  });

  it("announces recent results", () => {
    const f = [fixture(3, at(14), "finished", [2, 1])];
    expect(dueNotices(f, at(16), settings, new Set())[0]).toMatchObject({ title: "Full time: Arsenal win!", body: "Arsenal 2–1 Everton · Premier League" });
    expect(dueNotices(f, at(23), settings, new Set())).toEqual([]);
  });
});

describe("goalNotices", () => {
  const before = [fixture(1, at(14), "live", [1, 0])];
  it("tells goals for, against and disallowed apart", () => {
    expect(goalNotices(before, [fixture(1, at(14), "live", [2, 0])], new Set())[0]).toMatchObject({ key: "1:g2-0", title: "⚽ GOAL! Arsenal" });
    expect(goalNotices(before, [fixture(1, at(14), "live", [1, 1])], new Set())[0].title).toBe("Everton score");
    expect(goalNotices(before, [fixture(1, at(14), "live", [0, 0])], new Set())[0].title).toBe("Goal disallowed");
  });
  it("never repeats and ignores finished matches", () => {
    const after = [fixture(1, at(14), "live", [2, 0])];
    expect(goalNotices(before, after, new Set(["1:g2-0"]))).toEqual([]);
    const done = [fixture(1, at(14), "finished", [2, 0])];
    expect(goalNotices(done, done, new Set())).toEqual([]);
  });
});

describe("nextFetchDelay", () => {
  it("polls every minute around a match", () => {
    const f = [fixture(1, at(14), "scheduled")];
    expect(nextFetchDelay(f, at(9), 15)).toBe(15 * MIN);
    expect(nextFetchDelay(f, at(13, 40), 15)).toBe(5 * MIN);
    expect(nextFetchDelay(f, at(14, 5), 15)).toBe(MIN);
    expect(nextFetchDelay([fixture(1, at(14), "live")], at(14, 30), 15)).toBe(MIN);
  });
});

it("labels lead times", () => {
  expect([leadLabel(1440), leadLabel(2880), leadLabel(60), leadLabel(30)]).toEqual(["tomorrow", "in 2 days", "in 1 hour", "in 30 minutes"]);
});
