// Reminders, results and goal alerts for the website (the desktop widget
// does the same in src-tauri/src/scheduler.rs). Pure functions, so tested.

import type { Fixture, Settings } from "./types";

export interface Notice {
  /** Stops the same notification being shown twice */
  key: string;
  title: string;
  body: string;
}

const MINUTE = 60_000;
const REMINDER_GRACE = 30 * MINUTE;
const RESULT_MAX_AGE = 6 * 60 * MINUTE;
const live = (f: Fixture) => f.status === "live" || f.status === "halftime";

export function title(f: Fixture): string {
  return f.home ? `${f.team.shortName} v ${f.opponent.shortName}` : `${f.opponent.shortName} v ${f.team.shortName}`;
}

export function scoreLine(f: Fixture): string | null {
  if (f.teamGoals == null || f.opponentGoals == null) return null;
  return f.home
    ? `${f.team.shortName} ${f.teamGoals}–${f.opponentGoals} ${f.opponent.shortName}`
    : `${f.opponent.shortName} ${f.opponentGoals}–${f.teamGoals} ${f.team.shortName}`;
}

/** "in 1 hour", "tomorrow", "in 30 minutes" */
export function leadLabel(minutes: number): string {
  if (minutes === 1440) return "tomorrow";
  const [n, unit] = minutes % 1440 === 0 ? [minutes / 1440, "day"] : minutes % 60 === 0 ? [minutes / 60, "hour"] : [minutes, "minute"];
  return `in ${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Reminders and full-time results due now that haven't been shown yet. */
export function dueNotices(fixtures: Fixture[], now: Date, settings: Settings, sent: Set<string>): Notice[] {
  const out: Notice[] = [];
  const t = now.getTime();
  for (const f of fixtures) {
    const kickoff = new Date(f.kickoff).getTime();
    if (f.status === "scheduled" && !f.timeTbd) {
      for (const lead of settings.reminderMinutes) {
        const at = kickoff - lead * MINUTE;
        const key = `${f.id}:r${lead}`;
        if (t >= at && t < at + REMINDER_GRACE && !sent.has(key)) {
          const when = new Date(f.kickoff).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
          out.push({ key, title: lead === 0 ? `Kick-off: ${title(f)}` : `${title(f)} ${leadLabel(lead)}`, body: `${f.competition} · ${when}` });
        }
      }
    } else if (f.status === "finished" && settings.resultNotifications) {
      const key = `${f.id}:ft`;
      const score = scoreLine(f);
      if (score && t - kickoff < RESULT_MAX_AGE && !sent.has(key)) {
        const verdict = f.outcome === "win" ? `${f.team.shortName} win!` : f.outcome === "draw" ? "It's a draw" : `${f.team.shortName} lose`;
        out.push({ key, title: `Full time: ${verdict}`, body: `${score} · ${f.competition}` });
      }
    }
  }
  return out;
}

/** Goals (and disallowed goals) between two fetches. */
export function goalNotices(before: Fixture[], after: Fixture[], sent: Set<string>): Notice[] {
  const out: Notice[] = [];
  for (const now of after) {
    if (!live(now) && now.status !== "finished") continue;
    const old = before.find((f) => f.id === now.id);
    if (!old || !(live(old) || old.status === "scheduled")) continue;
    const [oldUs, oldThem] = [old.teamGoals ?? 0, old.opponentGoals ?? 0];
    const [us, them] = [now.teamGoals ?? 0, now.opponentGoals ?? 0];
    if (us === oldUs && them === oldThem) continue;
    const key = `${now.id}:g${us}-${them}`;
    if (sent.has(key)) continue;
    const heading =
      us < oldUs || them < oldThem ? "Goal disallowed" : us > oldUs ? `⚽ GOAL! ${now.team.shortName}` : `${now.opponent.shortName} score`;
    out.push({ key, title: heading, body: scoreLine(now) ?? title(now) });
  }
  return out;
}

/** How long to wait before fetching again: every minute around matches. */
export function nextFetchDelay(fixtures: Fixture[], now: Date, refreshMinutes: number): number {
  const normal = Math.max(1, refreshMinutes) * MINUTE;
  const t = now.getTime();
  for (const f of fixtures) {
    if (live(f)) return MINUTE;
    if (f.status !== "scheduled" || f.timeTbd) continue;
    const fastFrom = new Date(f.kickoff).getTime() - 15 * MINUTE;
    if (t < fastFrom) return Math.max(MINUTE, Math.min(normal, fastFrom - t));
    if (t < fastFrom + 15 * MINUTE + 3 * 60 * MINUTE) return MINUTE; // started but not marked live yet
  }
  return normal;
}
