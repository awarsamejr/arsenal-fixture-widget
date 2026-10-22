import type { Fixture, MatchStatus } from "./types";

/** "2d 14h", "3h 05m", "12m 30s"; the two most significant units. */
export function countdown(ms: number): string {
  if (ms <= 0) return "Kicking off";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s)}s`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Tomorrow", "Yesterday", or "Sat 24 Oct" in the viewer's time zone. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return shortDate(iso, now);
}

/** "Sat 24 Oct", or "14 Mar 2025" for other years (head-to-head goes back seasons). */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "15:00", or "TBC" while only the date is confirmed. */
export function kickoffTime(f: Pick<Fixture, "kickoff" | "timeTbd">): string {
  if (f.timeTbd) return "TBC";
  return new Date(f.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Score with the home side first, e.g. "2–1". */
export function scoreText(f: Fixture): string {
  if (f.arsenalGoals == null || f.opponentGoals == null) return "–";
  return f.home ? `${f.arsenalGoals}–${f.opponentGoals}` : `${f.opponentGoals}–${f.arsenalGoals}`;
}

/** Score from Arsenal's side, e.g. "0–3" for a 3–0 away defeat. */
export function ourScoreText(f: Fixture): string {
  if (f.arsenalGoals == null || f.opponentGoals == null) return "–";
  return `${f.arsenalGoals}–${f.opponentGoals}`;
}

/** Short label for a competition: "PL", "UCL", "FA Cup"... */
export function competitionShort(f: Pick<Fixture, "competition" | "competitionCode">): string {
  const known: Record<string, string> = { PL: "PL", CL: "UCL", EL: "UEL", FAC: "FA Cup", ELC: "EFL Cup", CLI: "UECL" };
  if (f.competitionCode && known[f.competitionCode]) return known[f.competitionCode];
  return f.competitionCode ?? f.competition.split(" ").map((w) => w[0]).join("");
}

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "live": return "LIVE";
    case "halftime": return "HT";
    case "finished": return "FT";
    case "postponed": return "Postponed";
    case "cancelled": return "Cancelled";
    default: return "";
  }
}

export const isLive = (f: Fixture) => f.status === "live" || f.status === "halftime";

/** The live match if there is one, otherwise the next one still to be played. */
export function headlineFixture(fixtures: Fixture[]): Fixture | undefined {
  return fixtures.find(isLive) ?? fixtures.find((f) => f.status === "scheduled");
}

/** Matches still to come, excluding the headline one. */
export function upcomingFixtures(fixtures: Fixture[], headline?: Fixture): Fixture[] {
  return fixtures.filter((f) => (f.status === "scheduled" || f.status === "postponed") && f.id !== headline?.id);
}

/** Played matches, most recent first. */
export function recentResults(fixtures: Fixture[], limit = 15): Fixture[] {
  return fixtures.filter((f) => f.status === "finished").reverse().slice(0, limit);
}

/** Case-insensitive match on opponent or competition: "spurs", "city", "champions". */
export function matchesSearch(f: Fixture, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const aliases: Record<string, string> = { spurs: "tottenham", villa: "aston villa", toon: "newcastle", "man u": "manchester united", "man utd": "manchester united" };
  const term = aliases[q] ?? q;
  return [f.opponent.name, f.opponent.shortName, f.competition].some((s) => s.toLowerCase().includes(term));
}

/** "Matchday 8", "League stage · Matchday 3", "Quarter-finals" */
const STAGES: Record<string, string> = {
  LEAGUE_STAGE: "League stage",
  GROUP_STAGE: "Group stage",
  PLAYOFFS: "Play-offs",
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
};

export function stageLabel(f: Pick<Fixture, "stage" | "matchday">): string {
  const stage =
    f.stage && f.stage !== "REGULAR_SEASON"
      ? STAGES[f.stage] ?? f.stage.charAt(0) + f.stage.slice(1).toLowerCase().replace(/_/g, " ")
      : null;
  const day = f.matchday ? `Matchday ${f.matchday}` : null;
  return [stage, day].filter(Boolean).join(" · ");
}

/** Arsenal's last few results before a given kick-off, oldest first. */
export function formBefore(fixtures: Fixture[], kickoff: string, count = 5): Fixture[] {
  const before = fixtures.filter((f) => f.status === "finished" && f.kickoff < kickoff);
  return before.slice(-count);
}

/** "just now", "5 min ago", "2 h ago" */
export function updatedAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} h ago`;
}
