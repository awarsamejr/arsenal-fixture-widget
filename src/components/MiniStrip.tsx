import { hideWindow, setMiniMode } from "../lib/api";
import { countdown, headlineFixture, isLive, kickoffTime, recentResults, statusLabel } from "../lib/format";
import { useNow } from "../lib/hooks";
import type { Fixture, Snapshot } from "../lib/types";
import { Crest } from "./Crest";
import { CloseIcon, ExpandIcon } from "./icons";
import { OutcomeChip } from "./FixtureRow";

/** The whole widget squeezed into one draggable line. */
export function MiniStrip({ snapshot }: { snapshot: Snapshot }) {
  const now = useNow(1000);
  const next = headlineFixture(snapshot.fixtures);
  const last = recentResults(snapshot.fixtures, 1)[0];
  // Between matches, a result from the last day beats a countdown to next week
  const recent = last && now.getTime() - new Date(last.kickoff).getTime() < 24 * 3600_000;
  const f: Fixture | undefined = next && (isLive(next) || !recent) ? next : last ?? next;
  const button = "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-white";

  return (
    <div data-tauri-drag-region className="flex h-full items-center gap-2.5 border-l-4 border-accent bg-ink pl-3 pr-1.5">
      {f ? (
        <>
          <span className="pointer-events-none flex shrink-0 items-center gap-1.5">
            <Crest team={f.home ? f.team : f.opponent} size={22} />
            <span className="text-[11px] text-muted">v</span>
            <Crest team={f.home ? f.opponent : f.team} size={22} />
          </span>
          <div data-tauri-drag-region className="pointer-events-none min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">
              {f.home ? `${f.team.shortName} v ${f.opponent.shortName}` : `${f.opponent.shortName} v ${f.team.shortName}`}
            </div>
            <div className="truncate text-[11.5px] text-muted">{subtitle(f, now)}</div>
          </div>
          <Status fixture={f} />
        </>
      ) : (
        <div data-tauri-drag-region className="flex-1 truncate text-[12.5px] text-muted">
          {snapshot.hasApiKey ? "No matches loaded yet" : "Add an API key to get started"}
        </div>
      )}
      <button className={button} onClick={() => setMiniMode(false)} title="Back to full size">
        <ExpandIcon size={14} />
      </button>
      <button className={`${button} hover:!bg-accent`} onClick={() => hideWindow()} title="Hide to tray">
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

function subtitle(f: Fixture, now: Date): string {
  if (isLive(f)) return f.competition;
  if (f.status === "finished") return `Full time · ${f.competition}`;
  const ms = new Date(f.kickoff).getTime() - now.getTime();
  return f.timeTbd ? `Kick-off TBC · ${f.competition}` : `${kickoffTime(f)} · in ${countdown(ms)}`;
}

/** Right-hand side: live score, final score, or nothing before kick-off. */
function Status({ fixture: f }: { fixture: Fixture }) {
  const [left, right] = f.home ? [f.teamGoals, f.opponentGoals] : [f.opponentGoals, f.teamGoals];
  if (isLive(f)) {
    return (
      <span className="pointer-events-none flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
          {statusLabel(f.status)}
        </span>
        <span className="font-display text-lg font-bold tabular-nums">{left ?? 0}–{right ?? 0}</span>
      </span>
    );
  }
  if (f.status === "finished") {
    return (
      <span className="pointer-events-none flex shrink-0 items-center gap-2">
        <span className="font-display text-lg font-bold tabular-nums">{left}–{right}</span>
        <OutcomeChip outcome={f.outcome} />
      </span>
    );
  }
  return null;
}
