import { useEffect, useState } from "react";
import { getSettings, getSnapshot, onSettings, onSnapshot } from "./api";
import type { Settings, Snapshot } from "./types";

/** Latest data and settings from the Rust side, kept up to date via events. */
export function useAppData() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const stopSnapshot = onSnapshot(setSnapshot);
    const stopSettings = onSettings(setSettings);
    getSnapshot().then(setSnapshot);
    getSettings().then(setSettings);
    return () => {
      stopSnapshot();
      stopSettings();
    };
  }, []);

  return { snapshot, settings };
}

/** The current time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
