import { useCallback, useEffect, useState } from "react";
import { getMatchDetails, getMatchStats } from "../lib/api";
import { formBefore, isLive, stageLabel } from "../lib/format";
import { useNow } from "../lib/hooks";
import type { Fixture, MatchDetails, Snapshot, StatsResult, TeamChoice } from "../lib/types";
import { Crest } from "./Crest";
import { FixtureRow, OutcomeChip } from "./FixtureRow";
import { LineupView, PredictionBar, StatBars, Timeline } from "./MatchStats";
import { NextMatchHero } from "./NextMatchHero";
import { SectionTitle } from "./views";

interface Props {
  fixture: Fixture;
  /** The followed team, for its venue and league */
  team: TeamChoice;
  snapshot: Snapshot;
  onBack: () => void;
}

/** Everything we know about one match: score, info, form, league positions, head-to-head. */
export function MatchDetailView({ fixture: f, team, snapshot, onBack }: Props) {
  const now = useNow(1000);
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getMatchDetails(f.id)
      .then(setDetails)
      .catch((e) => setError(String(e)));
  }, [f.id]);

  const loadStats = useCallback(() => {
    setStatsError(null);
    getMatchStats(f.id)
      .then(setStats)
      .catch((e) => setStatsError(String(e)));
  }, [f.id]);

  useEffect(() => {
    setDetails(null);
    load();
  }, [load]);

  // Stats reload with the match status, so a live match keeps updating
  useEffect(() => {
    loadStats();
  }, [loadStats, f.status, f.teamGoals, f.opponentGoals]);
  useEffect(() => {
    if (!isLive(f)) return;
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, [loadStats, f.status]);

  const ready = stats?.status === "ready" ? stats.stats : null;

  // Esc goes back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const form = formBefore(snapshot.fixtures, f.kickoff);
  const teamRow = snapshot.table.find((r) => r.isTeam);
  const opponentRow = snapshot.table.find((r) => r.team.name === f.opponent.name);
  const kickoff = new Date(f.kickoff);
  const info: [string, string][] = [
    ["Competition", [f.competition, stageLabel(f)].filter(Boolean).join(" · ")],
    [
      "Kick-off",
      kickoff.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
        (f.timeTbd ? " · time TBC" : ` · ${kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`),
    ],
    ["Venue", ready?.venue ?? (f.home ? team.venue ?? "Home" : `Away at ${f.opponent.shortName}`)],
  ];
  if (f.referee) info.push(["Referee", f.referee]);
  if (ready?.weather) info.push([f.status === "scheduled" ? "Forecast" : "Weather", ready.weather]);
  const played = f.status === "finished" || isLive(f);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 text-[12.5px] text-muted hover:text-white">
        <span aria-hidden="true">←</span> Back
      </button>

      <NextMatchHero fixture={f} now={now} />

      {ready && played && <Timeline events={ready.events} fixture={f} />}
      {ready?.prediction && f.status !== "finished" && <PredictionBar prediction={ready.prediction} fixture={f} />}

      <section>
        <SectionTitle>Match info</SectionTitle>
        <dl className="divide-y divide-line rounded-xl bg-panel px-3.5">
          {info.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2 text-[12.5px]">
              <dt className="shrink-0 text-muted">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {teamRow && opponentRow && f.competitionCode === team.league && (
        <section>
          <SectionTitle>League position {f.status === "finished" ? "now" : ""}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[teamRow, opponentRow].map((row) => (
              <div key={row.team.name} className={`rounded-xl p-3 ${row.isTeam ? "bg-accent/15 ring-1 ring-accent/40" : "bg-panel"}`}>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <Crest team={row.team} size={18} />
                  <span className="truncate font-medium">{row.team.shortName}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold">{ordinal(row.position)}</span>
                  <span className="text-[12px] text-muted">{row.points} pts</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {form.length > 0 && (
        <section>
          <SectionTitle>{f.team.shortName} form going in</SectionTitle>
          <div className="flex items-center gap-1.5 rounded-xl bg-panel p-3">
            {form.map((g) => (
              <span key={g.id} title={`${g.opponent.shortName} ${g.teamGoals}–${g.opponentGoals}`}>
                <OutcomeChip outcome={g.outcome} large />
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted">oldest → latest</span>
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Head to head</SectionTitle>
        {error ? (
          <div className="rounded-xl bg-panel p-3.5 text-[12.5px]">
            <p className="text-loss">{error}</p>
            <button onClick={load} className="mt-2 text-muted underline underline-offset-2 hover:text-white">
              Try again
            </button>
          </div>
        ) : !details ? (
          <div className="h-24 animate-pulse rounded-xl bg-panel" aria-label="Loading head to head" />
        ) : details.headToHead.played === 0 ? (
          <p className="rounded-xl bg-panel p-3.5 text-[12.5px] text-muted">No previous meetings on record.</p>
        ) : (
          <HeadToHeadCard details={details} teamName={f.team.shortName} opponent={f.opponent.shortName} now={now} />
        )}
      </section>

      {ready && played && <StatBars stats={ready.stats} fixture={f} />}
      {ready?.lineups && <LineupView lineups={ready.lineups} fixture={f} />}

      <StatsStatus result={stats} error={statsError} played={played} onRetry={loadStats} />
    </div>
  );
}

/** Loading / missing-key / not-found / error messages for the stats part, plus the daily quota. */
function StatsStatus({ result, error, played, onRetry }: { result: StatsResult | null; error: string | null; played: boolean; onRetry: () => void }) {
  const box = "rounded-xl border border-dashed border-line p-3.5 text-[12px] leading-relaxed text-muted";
  if (error) {
    return (
      <div className={box}>
        <p className="text-loss">{error}</p>
        <button onClick={onRetry} className="mt-1 underline underline-offset-2 hover:text-white">Try again</button>
      </div>
    );
  }
  if (!result) {
    return played ? <div className="h-40 animate-pulse rounded-xl bg-panel" aria-label="Loading match stats" /> : null;
  }
  if (result.status === "noKey") {
    return (
      <p className={box}>
        Add a free Highlightly key in Settings to see goals, cards, line-ups and match stats.
      </p>
    );
  }
  if (result.status === "notFound") {
    return <p className={box}>No detailed stats available for this match.</p>;
  }
  if (!played && !result.stats.lineups) {
    return <p className={box}>Line-ups usually appear about an hour before kick-off.</p>;
  }
  return result.requestsLeft != null ? (
    <p className="px-1 text-center text-[11px] text-muted">Stats by Highlightly · {result.requestsLeft} requests left today</p>
  ) : null;
}

function HeadToHeadCard({ details, teamName, opponent, now }: { details: MatchDetails; teamName: string; opponent: string; now: Date }) {
  const h = details.headToHead;
  const pct = (n: number) => `${(n / h.played) * 100}%`;
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-panel p-3.5">
        <div className="flex justify-between text-center">
          <Stat value={h.wins} label={`${teamName} wins`} className="text-win" />
          <Stat value={h.draws} label="Draws" className="text-draw" />
          <Stat value={h.losses} label={`${opponent} wins`} className="text-loss" />
        </div>
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <span className="bg-win" style={{ width: pct(h.wins) }} />
          <span className="bg-draw" style={{ width: pct(h.draws) }} />
          <span className="bg-loss" style={{ width: pct(h.losses) }} />
        </div>
        <p className="mt-2.5 text-center text-[11.5px] text-muted">
          Last {h.played} meetings · goals {h.goalsFor}–{h.goalsAgainst}
        </p>
      </div>
      <ul className="-mx-1">
        {details.meetings.map((m) => (
          <FixtureRow key={m.id} fixture={m} now={now} />
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={`font-display text-2xl font-bold ${className}`}>{value}</div>
      <div className="truncate text-[11px] text-muted">{label}</div>
    </div>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
