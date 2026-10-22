import { countdown, dayLabel, isLive, kickoffTime, statusLabel } from "../lib/format";
import type { Fixture } from "../lib/types";
import { CompetitionBadge, Crest } from "./Crest";

/** Big card for the next match, or the live score while it's being played. */
export function NextMatchHero({ fixture: f, now }: { fixture: Fixture; now: Date }) {
  const live = isLive(f);
  const [left, right] = f.home ? [f.arsenal, f.opponent] : [f.opponent, f.arsenal];
  const [leftGoals, rightGoals] = f.home ? [f.arsenalGoals, f.opponentGoals] : [f.opponentGoals, f.arsenalGoals];
  const msToKickoff = new Date(f.kickoff).getTime() - now.getTime();

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg shadow-black/30"
      style={{ background: "linear-gradient(145deg, #ef0107 0%, #b00005 55%, #6e0003 100%)" }}
    >
      {/* Soft highlight in the corner for depth */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-center gap-2 text-[12px] font-medium text-white/85">
        <span className="grid h-5 w-5 place-items-center rounded bg-white p-0.5">
          <CompetitionBadge emblem={f.competitionEmblem} name={f.competition} size={14} />
        </span>
        <span className="truncate">{f.competition}</span>
        <span className="ml-auto shrink-0">
          {live ? (
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold tracking-wider">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
              {statusLabel(f.status)}
            </span>
          ) : (
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px]">{f.home ? "Home" : "Away"}</span>
          )}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamBlock team={left} />
        <div className="px-1 text-center">
          {live ? (
            <div className="font-display text-4xl font-bold tabular-nums tracking-tight">
              {leftGoals ?? 0}<span className="mx-1 text-white/60">–</span>{rightGoals ?? 0}
            </div>
          ) : (
            <div className="font-display text-lg font-semibold text-white/70">vs</div>
          )}
        </div>
        <TeamBlock team={right} />
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/15 pt-3 text-[12.5px]">
        <span className="text-white/85">
          {dayLabel(f.kickoff, now)} · {kickoffTime(f)}
        </span>
        {!live && f.status === "scheduled" && !f.timeTbd && (
          <span className="rounded-md bg-black/25 px-2 py-0.5 font-semibold tabular-nums">
            {msToKickoff > 0 ? `in ${countdown(msToKickoff)}` : "Kicking off"}
          </span>
        )}
        {f.timeTbd && <span className="text-white/70">Kick-off time to be confirmed</span>}
      </div>
    </section>
  );
}

function TeamBlock({ team }: { team: Fixture["arsenal"] }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 p-2.5 shadow-md shadow-black/20">
        <Crest team={team} size={44} />
      </span>
      <span className="w-full truncate text-[13.5px] font-semibold" title={team.name}>
        {team.shortName}
      </span>
    </div>
  );
}
