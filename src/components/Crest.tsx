import { useState } from "react";
import type { TeamInfo } from "../lib/types";

/** Team crest, falling back to initials if the image can't load (e.g. offline). */
export function Crest({ team, size = 24 }: { team: TeamInfo; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!team.crest || failed) {
    const initials = team.shortName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
    return (
      <span
        style={{ ...style, fontSize: size * 0.34 }}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-panel-2 font-semibold text-muted"
        aria-label={team.name}
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={team.crest}
      alt={team.name}
      style={style}
      className="shrink-0 object-contain"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Small competition badge, e.g. the Premier League lion. */
export function CompetitionBadge({ emblem, name, size = 16 }: { emblem: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!emblem || failed) return null;
  return (
    <img
      src={emblem}
      alt={name}
      title={name}
      style={{ width: size, height: size }}
      className="shrink-0 object-contain opacity-80"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
