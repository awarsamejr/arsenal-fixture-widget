import { useEffect, useState } from "react";
import { openLink, saveSettings, testNotification } from "../lib/api";
import type { Settings, StreamLink } from "../lib/types";
import { DownIcon, EyeIcon, PlusIcon, TrashIcon, UpIcon } from "./icons";
import { SectionTitle } from "./views";

const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1440, label: "1 day" },
  { minutes: 180, label: "3 hours" },
  { minutes: 60, label: "1 hour" },
  { minutes: 30, label: "30 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 0, label: "Kick-off" },
];

const REFRESH_OPTIONS = [5, 10, 15, 30, 60];

const input =
  "h-8 w-full rounded-md border border-line bg-ink px-2.5 text-[12.5px] outline-none placeholder:text-muted/70 focus:border-gunner/70";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3 rounded-xl bg-panel p-3.5">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-[13px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-muted">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-gunner" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function SettingsView({ settings, hasApiKey }: { settings: Settings; hasApiKey: boolean }) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pick up changes made elsewhere (e.g. the tray's Always on top) unless mid-edit
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  useEffect(() => {
    setDraft((d) => (JSON.stringify(d) === JSON.stringify(settings) ? d : { ...d, alwaysOnTop: settings.alwaysOnTop }));
  }, [settings]);

  const update = (patch: Partial<Settings>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const toggleReminder = (minutes: number) => {
    const has = draft.reminderMinutes.includes(minutes);
    update({ reminderMinutes: has ? draft.reminderMinutes.filter((m) => m !== minutes) : [...draft.reminderMinutes, minutes] });
  };

  const setLink = (i: number, patch: Partial<StreamLink>) =>
    update({ streamLinks: draft.streamLinks.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const moveLink = (i: number, by: number) => {
    const links = [...draft.streamLinks];
    const [item] = links.splice(i, 1);
    links.splice(i + by, 0, item);
    update({ streamLinks: links });
  };

  const save = async () => {
    const result = await saveSettings(draft);
    setDraft(result);
    setSaved(true);
  };

  return (
    <div className="space-y-4">
      <Card title="API key">
        <p className="text-[12px] leading-relaxed text-muted">
          A free key from{" "}
          <button className="text-white underline decoration-gunner underline-offset-2" onClick={() => openLink("https://www.football-data.org/client/register")}>
            football-data.org
          </button>
          . Leave blank to use <code className="text-white/80">api_key.txt</code>.
        </p>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={draft.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder={hasApiKey ? "Using api_key.txt" : "Paste your key"}
            className={`${input} pr-9 font-mono`}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-1 top-1 grid h-6 w-7 place-items-center rounded text-muted hover:text-white"
            title={showKey ? "Hide key" : "Show key"}
          >
            <EyeIcon size={14} />
          </button>
        </div>
      </Card>

      <Card title="Match stats key">
        <p className="text-[12px] leading-relaxed text-muted">
          Goals, cards, line-ups and stats come from{" "}
          <button className="text-white underline decoration-gunner underline-offset-2" onClick={() => openLink("https://highlightly.net")}>
            Highlightly
          </button>{" "}
          (free, 100 requests a day). Leave blank to use <code className="text-white/80">highlightly_key.txt</code>.
        </p>
        <input
          type={showKey ? "text" : "password"}
          value={draft.statsApiKey}
          onChange={(e) => update({ statsApiKey: e.target.value })}
          placeholder="Paste your Highlightly key"
          className={`${input} font-mono`}
          spellCheck={false}
          autoComplete="off"
        />
      </Card>

      <Card title="Reminders">
        <div>
          <div className="mb-2 text-[13px]">Notify me before kick-off</div>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map(({ minutes, label }) => {
              const on = draft.reminderMinutes.includes(minutes);
              return (
                <button
                  key={minutes}
                  onClick={() => toggleReminder(minutes)}
                  aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-gunner bg-gunner/20 text-white" : "border-line text-muted hover:text-white"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Toggle checked={draft.resultNotifications} onChange={(v) => update({ resultNotifications: v })} label="Full-time results" hint="A notification with the final score" />
        <button onClick={() => testNotification()} className="text-[12px] text-muted underline underline-offset-2 hover:text-white">
          Send a test notification
        </button>
      </Card>

      <Card title="Widget">
        <Toggle checked={draft.alwaysOnTop} onChange={(v) => update({ alwaysOnTop: v })} label="Always on top" />
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[13px]">Check for updates every</span>
            <span className="block text-[11.5px] text-muted">Every minute during a match</span>
          </span>
          <select
            value={draft.refreshMinutes}
            onChange={(e) => update({ refreshMinutes: Number(e.target.value) })}
            className="h-8 rounded-md border border-line bg-ink px-2 text-[12.5px] outline-none focus:border-gunner/70"
          >
            {REFRESH_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </Card>

      <Card title="Streaming links">
        {draft.streamLinks.length === 0 && <p className="text-[12px] text-muted">Add the sites you watch matches on. They show up in the Watch tab.</p>}
        {draft.streamLinks.map((link, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <div className="flex-1 space-y-1.5">
              <input value={link.name} onChange={(e) => setLink(i, { name: e.target.value })} placeholder="Name" className={input} />
              <input value={link.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://…" className={input} spellCheck={false} />
            </div>
            <div className="flex flex-col">
              <button disabled={i === 0} onClick={() => moveLink(i, -1)} className="grid h-6 w-7 place-items-center rounded text-muted hover:text-white disabled:opacity-30" title="Move up"><UpIcon size={14} /></button>
              <button disabled={i === draft.streamLinks.length - 1} onClick={() => moveLink(i, 1)} className="grid h-6 w-7 place-items-center rounded text-muted hover:text-white disabled:opacity-30" title="Move down"><DownIcon size={14} /></button>
              <button onClick={() => update({ streamLinks: draft.streamLinks.filter((_, j) => j !== i) })} className="grid h-6 w-7 place-items-center rounded text-muted hover:text-loss" title="Remove"><TrashIcon size={13} /></button>
            </div>
          </div>
        ))}
        <button
          onClick={() => update({ streamLinks: [...draft.streamLinks, { name: "", url: "" }] })}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-gunner hover:text-white"
        >
          <PlusIcon size={14} /> Add link
        </button>
      </Card>

      {/* Save bar sticks to the bottom of the scroll area */}
      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-3 border-t border-line bg-ink/95 px-3 py-2.5 backdrop-blur">
        {saved && !dirty && <span className="text-[12px] text-win">Saved</span>}
        {dirty && (
          <button onClick={() => setDraft(settings)} className="text-[12.5px] text-muted hover:text-white">
            Discard
          </button>
        )}
        <button
          onClick={save}
          disabled={!dirty}
          className="rounded-md bg-gunner px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-gunner-dark disabled:bg-panel-2 disabled:text-muted"
        >
          Save
        </button>
      </div>
    </div>
  );
}
