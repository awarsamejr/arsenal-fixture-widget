import { useEffect, useMemo, useRef, useState } from "react";
import { openLink } from "../lib/api";
import { countdown, headlineFixture, isLive, matchesSearch, recentResults, upcomingFixtures } from "../lib/format";
import { useNow } from "../lib/hooks";
import type { Fixture, Settings, Snapshot } from "../lib/types";
import { Crest } from "./Crest";
import { FixtureRow, OutcomeChip } from "./FixtureRow";
import { ExternalIcon, SearchIcon, TvIcon } from "./icons";
import { NextMatchHero } from "./NextMatchHero";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[14px] font-semibold">{title}</p>
      {children && <div className="text-[12.5px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>;
}

// ---------- Next ----------

type OpenMatch = (f: Fixture) => void;

export function NextView({ snapshot, onOpen }: { snapshot: Snapshot; onOpen: OpenMatch }) {
  const now = useNow(1000);
  const [query, setQuery] = useState("");
  const headline = headlineFixture(snapshot.fixtures);
  const upcoming = useMemo(
    () => upcomingFixtures(snapshot.fixtures, headline).filter((f) => matchesSearch(f, query)),
    [snapshot.fixtures, headline, query],
  );

  if (!snapshot.fixtures.length) {
    return <EmptyState title="No fixtures yet">They'll appear here as soon as they load.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {headline ? (
        <NextMatchHero fixture={headline} now={now} onOpen={() => onOpen(headline)} />
      ) : (
        <EmptyState title="No upcoming matches" />
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Coming up</SectionTitle>
          <label className="relative mb-1.5 flex w-40 items-center">
            <SearchIcon size={13} className="pointer-events-none absolute left-2.5 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search opponent"
              className="h-7 w-full rounded-md border border-line bg-panel pl-7 pr-2 text-[12px] outline-none placeholder:text-muted focus:border-accent/70"
            />
          </label>
        </div>
        {upcoming.length ? (
          <ul className="-mx-1">{upcoming.map((f) => <FixtureRow key={f.id} fixture={f} now={now} onOpen={onOpen} />)}</ul>
        ) : (
          <EmptyState title={query ? `No matches against "${query}"` : "Nothing else scheduled yet"} />
        )}
      </div>
    </div>
  );
}

// ---------- Results ----------

export function ResultsView({ snapshot, onOpen }: { snapshot: Snapshot; onOpen: OpenMatch }) {
  const now = useNow(60_000);
  const results = recentResults(snapshot.fixtures);
  if (!results.length) return <EmptyState title="No results yet this season" />;
  const form = results.slice(0, 5).reverse(); // oldest → newest, like a form guide
  const record = results.reduce(
    (acc, f) => ({ ...acc, [f.outcome ?? "draw"]: acc[f.outcome ?? "draw"] + 1 }),
    { win: 0, draw: 0, loss: 0 },
  );

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between rounded-xl bg-panel p-3.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Form · last 5</div>
          <div className="mt-2 flex gap-1.5">{form.map((f) => <OutcomeChip key={f.id} outcome={f.outcome} large />)}</div>
        </div>
        <div className="text-right text-[12px] leading-5 text-muted">
          <div><span className="font-semibold text-win">{record.win}</span> won</div>
          <div><span className="font-semibold text-draw">{record.draw}</span> drawn</div>
          <div><span className="font-semibold text-loss">{record.loss}</span> lost</div>
        </div>
      </section>
      <div>
        <SectionTitle>Recent results</SectionTitle>
        <ul className="-mx-1">{results.map((f) => <FixtureRow key={f.id} fixture={f} now={now} onOpen={onOpen} />)}</ul>
      </div>
    </div>
  );
}

// ---------- Table ----------

export function TableView({ snapshot }: { snapshot: Snapshot }) {
  const teamRow = useRef<HTMLTableRowElement>(null);
  // Bring the team's row to the middle of the scroll area
  useEffect(() => {
    const row = teamRow.current;
    const scroller = row?.closest("main");
    if (!row || !scroller) return;
    const offset = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += offset - scroller.clientHeight / 2;
  }, [snapshot.table.length]);

  if (!snapshot.table.length) return <EmptyState title="League table not loaded yet" />;

  return (
    <div>
      <SectionTitle>Premier League</SectionTitle>
      <table className="w-full border-separate border-spacing-0 text-[12.5px] tabular-nums">
        <thead className="sticky top-0 z-10 bg-ink text-[11px] text-muted">
          <tr>
            <th className="w-7 py-1.5 text-left font-medium">#</th>
            <th className="py-1.5 text-left font-medium">Team</th>
            <th className="w-7 py-1.5 text-right font-medium">P</th>
            <th className="w-9 py-1.5 text-right font-medium">GD</th>
            <th className="w-10 py-1.5 pr-2 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.table.map((row) => {
            const zone = row.position <= 4 ? "border-l-sky-500" : row.position >= 18 ? "border-l-loss" : "border-l-transparent";
            return (
              <tr
                key={row.position}
                ref={row.isTeam ? teamRow : undefined}
                className={row.isTeam ? "bg-accent/20 font-semibold" : "odd:bg-panel/60"}
              >
                <td className={`border-l-2 py-1.5 pl-1.5 ${zone} ${row.isTeam ? "rounded-l-md" : ""}`}>{row.position}</td>
                <td className="py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Crest team={row.team} size={16} />
                    <span className="truncate">{row.team.shortName}</span>
                  </span>
                </td>
                <td className="py-1.5 text-right text-muted">{row.played}</td>
                <td className="py-1.5 text-right text-muted">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className={`py-1.5 pr-2 text-right font-semibold ${row.isTeam ? "rounded-r-md" : ""}`}>{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 flex gap-4 px-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-sky-500" /> Champions League</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-loss" /> Relegation</span>
      </p>
    </div>
  );
}

// ---------- Watch ----------

export function WatchView({ snapshot, settings, onOpenSettings }: { snapshot: Snapshot; settings: Settings; onOpenSettings: () => void }) {
  const now = useNow(1000);
  const headline = headlineFixture(snapshot.fixtures);
  const ms = headline ? new Date(headline.kickoff).getTime() - now.getTime() : 0;

  return (
    <div className="space-y-4">
      {headline && (
        <section className="flex items-center gap-3 rounded-xl bg-panel p-3">
          <Crest team={headline.opponent} size={28} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">
              {headline.home ? `${headline.team.shortName} v ${headline.opponent.shortName}` : `${headline.opponent.shortName} v ${headline.team.shortName}`}
            </div>
            <div className="text-[12px] text-muted">
              {isLive(headline) ? <span className="font-semibold text-accent">On now</span> : headline.timeTbd ? "Kick-off time TBC" : `Starts in ${countdown(ms)}`}
              {" · "}{headline.competition}
            </div>
          </div>
        </section>
      )}

      <div>
        <SectionTitle>Where to watch</SectionTitle>
        {settings.streamLinks.length ? (
          <ul className="space-y-1.5">
            {settings.streamLinks.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <button
                  onClick={() => openLink(link.url)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:border-accent/60 hover:bg-panel-2"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
                    <TvIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{link.name}</span>
                    <span className="block truncate text-[11.5px] text-muted">{link.url.replace(/^https?:\/\//, "")}</span>
                  </span>
                  <ExternalIcon size={14} className="text-muted group-hover:text-white" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No streaming links yet">
            Add the sites you watch on and they'll be one click away here.
            <div className="mt-3">
              <button onClick={onOpenSettings} className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-dark">
                Add links in Settings
              </button>
            </div>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
