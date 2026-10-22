import { hideWindow, minimizeWindow, setMiniMode } from "../lib/api";
import type { TeamChoice } from "../lib/types";
import { Crest } from "./Crest";
import { CloseIcon, MinusIcon, PinIcon, ShrinkIcon } from "./icons";

interface Props {
  team: TeamChoice;
  pinned: boolean;
  onTogglePin: () => void;
}

/** Custom draggable title bar (the window has no Windows frame). */
export function TitleBar({ team, pinned, onTogglePin }: Props) {
  const button = "grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-panel-2 hover:text-white";
  return (
    <header data-tauri-drag-region className="flex h-11 shrink-0 items-center gap-2 pl-3 pr-1.5">
      <span className="pointer-events-none" title={team.name}>
        <Crest team={team} size={22} />
      </span>
      <h1 data-tauri-drag-region className="font-display text-[15px] font-semibold tracking-tight">
        Matchnight
      </h1>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      <button
        className={`${button} ${pinned ? "text-accent hover:text-accent" : ""}`}
        onClick={onTogglePin}
        title={pinned ? "Stop keeping on top" : "Keep on top of other windows"}
        aria-pressed={pinned}
      >
        <PinIcon size={15} fill={pinned ? "currentColor" : "none"} />
      </button>
      <button className={button} onClick={() => setMiniMode(true)} title="Mini mode: shrink to one line">
        <ShrinkIcon size={14} />
      </button>
      <button className={button} onClick={() => minimizeWindow()} title="Minimise">
        <MinusIcon size={16} />
      </button>
      <button
        className={`${button} hover:!bg-accent hover:!text-white`}
        onClick={() => hideWindow()}
        title="Hide to tray (quit from the tray icon)"
      >
        <CloseIcon size={16} />
      </button>
    </header>
  );
}
