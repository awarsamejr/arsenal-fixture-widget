// Highlightly-powered parts of the match screen. Everything is laid out with
// the home team on the left, matching the score card above.

import { useState } from "react";
import type { EventKind, Fixture, MatchEvent, MatchStats, Prediction, StatLine, TeamLineup } from "../lib/types";
import { Crest } from "./Crest";
import { SectionTitle } from "./views";

export function formatStat(value: number, format: StatLine["format"]): string {
  if (format === "percent") return `${Math.round(value * 100)}%`;
  if (format === "decimal") return value.toFixed(2);
  return String(Math.round(value));
}

// ---------- Win probability ----------

export function PredictionBar({ prediction: p, fixture: f }: { prediction: Prediction; fixture: Fixture }) {
  // Home on the left
  const parts = f.home
    ? [{ label: f.team.shortName, pct: p.teamWin, color: "bg-accent" }, { label: "Draw", pct: p.draw, color: "bg-draw" }, { label: f.opponent.shortName, pct: p.opponentWin, color: "bg-slate-400" }]
    : [{ label: f.opponent.shortName, pct: p.opponentWin, color: "bg-slate-400" }, { label: "Draw", pct: p.draw, color: "bg-draw" }, { label: f.team.shortName, pct: p.teamWin, color: "bg-accent" }];
  return (
    <section>
      <SectionTitle>{p.live ? "Win probability (live)" : "Win probability"}</SectionTitle>
      <div className="rounded-xl bg-panel p-3.5">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {parts.map((x) => <span key={x.label} className={x.color} style={{ width: `${x.pct}%` }} />)}
        </div>
        <div className="mt-2 grid grid-cols-3 text-[12px]">
          {parts.map((x, i) => (
            <div key={x.label} className={i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"}>
              <div className="font-semibold tabular-nums">{Math.round(x.pct)}%</div>
              <div className="truncate text-[11px] text-muted">{x.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Timeline ----------

function EventIcon({ kind }: { kind: EventKind }) {
  switch (kind) {
    case "goal":
    case "penaltyGoal":
    case "ownGoal":
      return <span className="text-[13px] leading-none" aria-hidden="true">⚽</span>;
    case "missedPenalty":
      return <span className="text-[11px] font-bold text-loss">✕</span>;
    case "yellowCard":
      return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />;
    case "redCard":
      return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-loss" />;
    case "substitution":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M7 4v14m0 0-3-3m3 3 3-3" stroke="#22c55e" />
          <path d="M17 20V6m0 0-3 3m3-3 3 3" stroke="#ef4444" />
        </svg>
      );
    default:
      return <span className="text-[10px] font-bold text-muted">VAR</span>;
  }
}

function eventText(e: MatchEvent): { main: string; sub: string | null } {
  switch (e.kind) {
    case "penaltyGoal": return { main: `${e.player} (pen)`, sub: null };
    case "ownGoal": return { main: `${e.player} (OG)`, sub: null };
    case "missedPenalty": return { main: e.player, sub: "Missed penalty" };
    case "substitution": return { main: e.detail ?? "Sub", sub: `for ${e.player}` };
    case "goal": return { main: e.player, sub: e.detail ? `Assist: ${e.detail}` : null };
    default: return { main: e.player, sub: null };
  }
}

export function Timeline({ events, fixture: f }: { events: MatchEvent[]; fixture: Fixture }) {
  const [showSubs, setShowSubs] = useState(false);
  const shown = events.filter((e) => showSubs || e.kind !== "substitution");
  const subCount = events.length - events.filter((e) => e.kind !== "substitution").length;
  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionTitle>Timeline</SectionTitle>
        {subCount > 0 && (
          <button onClick={() => setShowSubs((s) => !s)} className="mb-1.5 text-[11.5px] text-muted hover:text-white">
            {showSubs ? "Hide subs" : `Show subs (${subCount})`}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl bg-panel p-3.5 text-[12.5px] text-muted">No goals or cards yet.</p>
      ) : (
        <ol className="space-y-px overflow-hidden rounded-xl bg-panel">
          {shown.map((e, i) => {
            // Home team's events on the left
            const left = e.team === f.home;
            const { main, sub } = eventText(e);
            const isGoal = e.kind === "goal" || e.kind === "penaltyGoal" || e.kind === "ownGoal";
            return (
              <li key={i} className={`grid grid-cols-[1fr_40px_1fr] items-center gap-2 px-3 py-2 ${isGoal ? "bg-white/[0.03]" : ""}`}>
                <div className="min-w-0 text-right">{left && <EventLabel main={main} sub={sub} icon={e.kind} bold={isGoal} align="right" />}</div>
                <div className="text-center text-[11.5px] font-semibold tabular-nums text-muted">{e.minute}'</div>
                <div className="min-w-0">{!left && <EventLabel main={main} sub={sub} icon={e.kind} bold={isGoal} align="left" />}</div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function EventLabel({ main, sub, icon, bold, align }: { main: string; sub: string | null; icon: EventKind; bold: boolean; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <span className="grid w-4 shrink-0 place-items-center"><EventIcon kind={icon} /></span>
      <span className="min-w-0">
        <span className={`block truncate text-[12.5px] ${bold ? "font-semibold" : ""}`}>{main}</span>
        {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
      </span>
    </div>
  );
}

// ---------- Team stats ----------

export function StatBars({ stats, fixture: f }: { stats: StatLine[]; fixture: Fixture }) {
  if (!stats.length) return null;
  const [leftTeam, rightTeam] = f.home ? [f.team, f.opponent] : [f.opponent, f.team];
  return (
    <section>
      <SectionTitle>Match stats</SectionTitle>
      <div className="rounded-xl bg-panel p-3.5">
        <div className="mb-3 flex justify-between">
          <Crest team={leftTeam} size={20} />
          <Crest team={rightTeam} size={20} />
        </div>
        <div className="space-y-3">
          {stats.map((s) => {
            const [left, right] = f.home ? [s.team, s.opponent] : [s.opponent, s.team];
            const total = left + right;
            const leftShare = total > 0 ? (left / total) * 100 : 50;
            const teamLeft = f.home;
            const leftBetter = left > right;
            const rightBetter = right > left;
            return (
              <div key={s.label}>
                <div className="flex items-baseline justify-between text-[12.5px] tabular-nums">
                  <span className={leftBetter ? "font-semibold" : "text-muted"}>{formatStat(left, s.format)}</span>
                  <span className="text-[11.5px] text-muted">{s.label}</span>
                  <span className={rightBetter ? "font-semibold" : "text-muted"}>{formatStat(right, s.format)}</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-0.5">
                  <span className={`rounded-l-full ${teamLeft ? "bg-accent" : "bg-slate-400"} ${leftBetter ? "" : "opacity-50"}`} style={{ width: `${leftShare}%` }} />
                  <span className={`rounded-r-full ${teamLeft ? "bg-slate-400" : "bg-accent"} ${rightBetter ? "" : "opacity-50"}`} style={{ width: `${100 - leftShare}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- Line-ups ----------

/** "Gabriel Magalhães" → "Magalhães", "M. Ødegaard" → "Ødegaard" */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function LineupView({ lineups, fixture: f }: { lineups: NonNullable<MatchStats["lineups"]>; fixture: Fixture }) {
  const [side, setSide] = useState<"team" | "opponent">("team");
  const lineup: TeamLineup = lineups[side];
  const team = side === "team" ? f.team : f.opponent;
  // Draw from the attack down to the goalkeeper
  const rows = [...lineup.rows].reverse();

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionTitle>Line-ups</SectionTitle>
        <div className="mb-1.5 flex gap-0.5 rounded-md bg-panel p-0.5 text-[11.5px]">
          {(["team", "opponent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`rounded px-2 py-0.5 ${side === s ? "bg-accent text-white" : "text-muted hover:text-white"}`}
            >
              {s === "team" ? f.team.shortName : f.opponent.shortName}
            </button>
          ))}
        </div>
      </div>
      <div
        className="relative overflow-hidden rounded-xl px-2 py-3"
        style={{ background: "repeating-linear-gradient(180deg, #14532d 0 36px, #166534 36px 72px)" }}
      >
        {/* Pitch markings */}
        <div className="pointer-events-none absolute inset-2 rounded-md border border-white/20" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-10 w-28 -translate-x-1/2 border border-b-0 border-white/20" />
        <div className="relative mb-2 flex items-center justify-between px-2 text-[11px] text-white/80">
          <span className="flex items-center gap-1.5"><Crest team={team} size={14} /> {team.shortName}</span>
          {lineup.formation && <span className="font-semibold">{lineup.formation}</span>}
        </div>
        <div className="relative flex flex-col gap-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-around">
              {row.map((p) => (
                <div key={`${p.name}-${p.number}`} className="flex w-16 flex-col items-center gap-0.5 text-center" title={p.name}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold shadow ${side === "team" ? "bg-accent text-white" : "bg-white text-ink"}`}>
                    {p.number ?? ""}
                  </span>
                  <span className="w-full truncate text-[10.5px] font-medium text-white drop-shadow">{surname(p.name)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {lineup.substitutes.length > 0 && (
        <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted">
          <span className="font-semibold text-white/80">Subs: </span>
          {lineup.substitutes.map((p) => p.name).join(", ")}
        </p>
      )}
    </section>
  );
}
