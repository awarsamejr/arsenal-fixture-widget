// Matchnight's web backend (Cloudflare Pages Function). Handles /api/*,
// keeps the API keys server-side and caches responses to save quota.
//
// Secrets (Cloudflare dashboard → Settings → Variables and Secrets, or .dev.vars locally):
//   FOOTBALL_DATA_KEY  required
//   HIGHLIGHTLY_KEY    optional, for goals/cards/line-ups/stats
//   ACCESS_CODE        optional, makes the site ask for this code first

import type { StatsResult } from "../../src/lib/types";
import { parseFixtures, parseMatchDetails, parseTable, parseTeams } from "../_lib/footballData";
import { parseLineups, parseMatch, parseMatchId, rankTeamCandidates, teamNameVariants } from "../_lib/highlightly";

interface Env {
  FOOTBALL_DATA_KEY?: string;
  HIGHLIGHTLY_KEY?: string;
  ACCESS_CODE?: string;
}

interface Context {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function onRequestGet(ctx: Context): Promise<Response> {
  const url = new URL(ctx.request.url);
  const { env } = ctx;

  if (env.ACCESS_CODE && ctx.request.headers.get("x-access-code") !== env.ACCESS_CODE) {
    return json({ error: "access" }, 401);
  }
  if (!env.FOOTBALL_DATA_KEY) {
    return json({ error: "The site isn't set up yet: add the FOOTBALL_DATA_KEY secret in Cloudflare." }, 500);
  }

  const q = (name: string) => {
    const v = url.searchParams.get(name);
    if (v == null || v === "") throw new HttpError(400, `Missing ${name}`);
    return v;
  };
  const route = url.pathname.replace(/^\/api\//, "");

  try {
    switch (route) {
      case "fixtures": {
        const team = Number(q("team"));
        // One upstream request a minute at most, however often the page asks
        const body = await footballData(ctx, `/teams/${team}/matches`, MINUTE);
        return json(parseFixtures(body, team));
      }
      case "table": {
        const body = await footballData(ctx, `/competitions/${q("league")}/standings`, 30 * MINUTE);
        return json(parseTable(body, Number(q("team"))));
      }
      case "teams": {
        const league = q("league");
        return json(parseTeams(await footballData(ctx, `/competitions/${league}/teams`, DAY), league));
      }
      case "details": {
        const match = Number(q("match"));
        const body = await footballData(ctx, `/matches/${match}/head2head?limit=10`, 6 * HOUR);
        return json(parseMatchDetails(body, match, Number(q("team"))));
      }
      case "stats":
        return json(await stats(ctx, url.searchParams));
      default:
        return json({ error: "Not found" }, 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: `Couldn't load data (${(e as Error).message}).` }, 502);
  }
}

// ---------- Upstream APIs ----------

async function footballData(ctx: Context, path: string, ttl: number) {
  return cached(ctx, `fd:${path}`, ttl, () =>
    upstream(`https://api.football-data.org/v4${path}`, { "X-Auth-Token": ctx.env.FOOTBALL_DATA_KEY! }, "football-data.org"),
  );
}

async function highlightly(ctx: Context, path: string, ttl: number) {
  return cached(ctx, `hl:${path}`, ttl, () =>
    upstream(`https://soccer.highlightly.net${path}`, { "x-rapidapi-key": ctx.env.HIGHLIGHTLY_KEY! }, "Highlightly"),
  );
}

async function upstream(url: string, headers: Record<string, string>, name: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new HttpError(502, `Can't reach ${name}.`);
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new HttpError(502, `The ${name} key was rejected.`);
  if (res.status === 429) throw new HttpError(503, `Too many requests to ${name}. Try again shortly.`);
  if (!res.ok) throw new HttpError(502, `${name} returned HTTP ${res.status}.`);
  return res.json();
}

/** Cloudflare's edge cache: reuses a response for `ttl` seconds (best effort). */
async function cached<T>(ctx: Context, key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const request = new Request(`https://cache.matchnight/${encodeURIComponent(key)}`);
  const hit = cache && (await cache.match(request));
  if (hit) return hit.json() as Promise<T>;
  const value = await load();
  if (cache && ttl > 0) {
    const response = new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttl}` },
    });
    ctx.waitUntil(cache.put(request, response));
  }
  return value;
}

// ---------- Match stats (Highlightly) ----------

/** The web client remembers Highlightly ids and passes them back, saving lookups. */
type WebStatsResult = StatsResult & { highlightlyTeam?: number[]; highlightlyMatch?: number };

async function stats(ctx: Context, params: URLSearchParams): Promise<WebStatsResult> {
  if (!ctx.env.HIGHLIGHTLY_KEY) return { status: "noKey" };
  const get = (n: string) => params.get(n) ?? "";
  const team = get("team");
  const kickoff = get("kickoff");
  const home = get("home") === "1";
  const status = get("status");
  if (!team || !kickoff) throw new HttpError(400, "Missing match information");

  // Highlightly's id(s) for the team: several clubs can share a name
  let candidates = get("hlTeam").split(",").filter(Boolean).map(Number);
  if (!candidates.length) {
    const names = teamNameVariants(get("name"), get("short"));
    for (const query of names) {
      const body = await highlightly(ctx, `/teams?name=${encodeURIComponent(query)}`, 30 * DAY);
      candidates = rankTeamCandidates(body, names);
      if (candidates.length) break;
    }
  }

  // Find the match; the candidate that has it is the right team
  let matchId = Number(get("hlMatch")) || null;
  let confirmed = candidates.length === 1 ? candidates[0] : null;
  if (!matchId) {
    const side = home ? "homeTeamId" : "awayTeamId";
    for (const candidate of candidates) {
      const body = await highlightly(ctx, `/matches?${side}=${candidate}&date=${kickoff.slice(0, 10)}&timezone=UTC`, 30 * DAY);
      matchId = parseMatchId(body, kickoff);
      if (matchId) {
        confirmed = candidate;
        break;
      }
    }
  }
  const teamId = confirmed ?? candidates[0];
  if (!matchId || !teamId) return { status: "notFound", highlightlyTeam: candidates };

  // Finished matches never change; live ones do every minute
  const msToKickoff = new Date(kickoff).getTime() - Date.now();
  const ttl =
    status === "finished" ? 30 * DAY
    : status === "live" || status === "halftime" ? MINUTE
    : msToKickoff < 3 * HOUR * 1000 ? 15 * MINUTE
    : 6 * HOUR;
  const result = parseMatch(await highlightly(ctx, `/matches/${matchId}`, ttl), teamId);

  // Line-ups cost a request, so only ask when they could exist
  if (status !== "scheduled" || msToKickoff < 2 * HOUR * 1000) {
    try {
      result.lineups = parseLineups(await highlightly(ctx, `/lineups/${matchId}`, ttl), teamId);
    } catch {
      // optional; the rest of the stats still show
    }
  }
  return { status: "ready", stats: result, requestsLeft: null, highlightlyTeam: [teamId], highlightlyMatch: matchId };
}
