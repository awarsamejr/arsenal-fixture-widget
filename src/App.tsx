import { useState } from "react";
import { openLink, refreshNow, saveSettings } from "./lib/api";
import { updatedAgo } from "./lib/format";
import { useAppData, useNow } from "./lib/hooks";
import type { Snapshot } from "./lib/types";
import { AlertIcon, RefreshIcon, SettingsIcon } from "./components/icons";
import { SettingsView } from "./components/SettingsView";
import { TitleBar } from "./components/TitleBar";
import { NextView, ResultsView, TableView, WatchView } from "./components/views";

type Tab = "next" | "results" | "table" | "watch" | "settings";

const TABS: { id: Exclude<Tab, "settings">; label: string }[] = [
  { id: "next", label: "Next" },
  { id: "results", label: "Results" },
  { id: "table", label: "Table" },
  { id: "watch", label: "Watch" },
];

export default function App() {
  const { snapshot, settings } = useAppData();
  const [tab, setTab] = useState<Tab>("next");

  if (!snapshot || !settings) {
    return <div className="grid h-full place-items-center text-muted">Loading…</div>;
  }

  const needsKey = !snapshot.hasApiKey && tab !== "settings";

  return (
    <div className="flex h-full flex-col">
      <TitleBar pinned={settings.alwaysOnTop} onTogglePin={() => saveSettings({ ...settings, alwaysOnTop: !settings.alwaysOnTop })} />

      <nav className="flex shrink-0 items-center gap-1 px-3 pb-2">
        <div className="flex flex-1 gap-0.5 rounded-lg bg-panel p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium ${tab === t.id ? "bg-gunner text-white shadow-sm" : "text-muted hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTab("settings")}
          title="Settings"
          className={`grid h-8 w-8 place-items-center rounded-lg ${tab === "settings" ? "bg-gunner text-white" : "bg-panel text-muted hover:text-white"}`}
        >
          <SettingsIcon size={15} />
        </button>
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 pt-1">
        {needsKey ? (
          <Welcome onOpenSettings={() => setTab("settings")} />
        ) : (
          <>
            {tab === "next" && <NextView snapshot={snapshot} />}
            {tab === "results" && <ResultsView snapshot={snapshot} />}
            {tab === "table" && <TableView snapshot={snapshot} />}
            {tab === "watch" && <WatchView snapshot={snapshot} settings={settings} onOpenSettings={() => setTab("settings")} />}
            {tab === "settings" && <SettingsView settings={settings} hasApiKey={snapshot.hasApiKey} />}
          </>
        )}
        <div className="h-3" />
      </main>

      {tab !== "settings" && <StatusBar snapshot={snapshot} />}
    </div>
  );
}

function StatusBar({ snapshot }: { snapshot: Snapshot }) {
  const now = useNow(30_000);
  return (
    <footer className="shrink-0 border-t border-line px-3 py-1.5">
      {snapshot.error && (
        <div className="mb-1.5 flex items-start gap-2 rounded-md bg-loss/10 px-2.5 py-1.5 text-[12px] text-loss">
          <AlertIcon size={14} className="mt-px shrink-0" />
          <span>{snapshot.error}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-[11.5px] text-muted">
        <span>{snapshot.refreshing ? "Updating…" : `Updated ${updatedAgo(snapshot.lastUpdated, now)}`}</span>
        <button
          onClick={() => refreshNow()}
          disabled={snapshot.refreshing || !snapshot.hasApiKey}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-white disabled:opacity-50"
          title="Refresh now"
        >
          <RefreshIcon size={12} className={snapshot.refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    </footer>
  );
}

function Welcome({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <img src="/cannon.png" alt="" className="h-14 w-14" />
      <h2 className="mt-4 font-display text-lg font-semibold">Welcome, Gooner</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        This widget gets its fixtures from football-data.org. Sign up for a free API key, then paste it in Settings.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={() => openLink("https://www.football-data.org/client/register")}
          className="rounded-md border border-line px-4 py-2 text-[13px] hover:bg-panel-2"
        >
          Get a free key
        </button>
        <button onClick={onOpenSettings} className="rounded-md bg-gunner px-4 py-2 text-[13px] font-semibold text-white hover:bg-gunner-dark">
          Enter key in Settings
        </button>
      </div>
    </div>
  );
}
