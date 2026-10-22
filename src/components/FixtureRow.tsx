import { competitionShort, dayLabel, kickoffTime, ourScoreText, shortDate } from "../lib/format";
import type { Fixture } from "../lib/types";
import { Crest } from "./Crest";

function CompetitionTag({ fixture: f }: { fixture: Fixture }) {
  const label = competitionShort(f);
  const europe = label.startsWith("UE") || label === "UCL";
  return (
    <span
      title={f.competition}
      className={`w-11 shrink-0 text-right text-[10.5px] font-semibold tracking-wide ${europe ? "text-sky-400" : "text-muted"}`}
    >
      {label}
    </span>
  );
}

export function VenueChip({ home }: { home: boolean }) {
  return (
    <span
      className={`rounded px-1 py-px text-[10px] font-semibold tracking-wide ${home ? "bg-white/10 text-white" : "bg-transparent text-muted ring-1 ring-line"}`}
      title={home ? "Home" : "Away"}
    >
      {home ? "H" : "A"}
    </span>
  );
}

const outcomeStyles = {
  win: "bg-win/15 text-win",
  draw: "bg-draw/15 text-draw",
  loss: "bg-loss/15 text-loss",
};

export function OutcomeChip({ outcome, large = false }: { outcome: Fixture["outcome"]; large?: boolean }) {
  if (!outcome) return null;
  return (
    <span
      className={`grid place-items-center rounded font-bold ${outcomeStyles[outcome]} ${large ? "h-7 w-7 text-sm" : "h-5 w-5 text-[11px]"}`}
      title={outcome[0].toUpperCase() + outcome.slice(1)}
    >
      {outcome[0].toUpperCase()}
    </span>
  );
}

/** One line in the upcoming or results list. */
export function FixtureRow({ fixture: f, now }: { fixture: Fixture; now: Date }) {
  const played = f.status === "finished";
  return (
    <li className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-panel-2">
      <div className="w-[68px] shrink-0 leading-tight">
        <div className="text-[11px] text-muted">{played ? shortDate(f.kickoff) : dayLabel(f.kickoff, now)}</div>
        <div className="text-[13px] font-semibold tabular-nums">
          {f.status === "postponed" ? <span className="text-loss">PP</span> : played ? ourScoreText(f) : kickoffTime(f)}
        </div>
      </div>
      <Crest team={f.opponent} size={22} />
      <div className="min-w-0 flex-1 truncate text-[13.5px]" title={f.opponent.name}>
        {f.opponent.shortName}
      </div>
      <VenueChip home={f.home} />
      {played ? <OutcomeChip outcome={f.outcome} /> : <CompetitionTag fixture={f} />}
    </li>
  );
}
