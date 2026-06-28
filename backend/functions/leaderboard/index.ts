// leaderboard — ranks profiles by lifetime wins across matches.
// Read-only. Returns the top 20 profiles ordered by wins desc, then total_score desc.
// Falls back to the legacy side-A players-by-score ranking if the profiles table is empty.
//
// GET (or POST) -> { leaderboard: [{ display_name, avatar_url, wins, losses, total_score }] }
//
// Deploy: npx @insforge/cli functions deploy leaderboard --file backend/functions/leaderboard/index.ts --name "Leaderboard"

import { CORS, DEFAULT_BASE, env, json } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";

const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect } = makeDb(DATA, KEY);

// Legacy fallback: rank one-off side-A (human) players by score.
async function legacyLeaderboard(limit: number) {
  const players = await dbSelect("players", `side=eq.A&order=score.desc&limit=${limit}&select=room_id,score`);
  if (!players.length) return [];

  const ids = players.map((p) => p.room_id).join(",");
  const rooms = await dbSelect("rooms", `id=in.(${ids})&select=id,topic,status,created_at`);
  const roomById: Record<string, any> = {};
  for (const r of rooms) roomById[r.id] = r;

  return players.map((p) => ({
    room_id: p.room_id,
    score: p.score,
    topic: roomById[p.room_id]?.topic ?? null,
    status: roomById[p.room_id]?.status ?? null,
    created_at: roomById[p.room_id]?.created_at ?? null,
  }));
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  const limit = 20;
  try {
    // Primary: rank profiles by lifetime wins, then total score. A read failure
    // (e.g. profiles table not yet migrated) must NOT 500 the leaderboard — it
    // falls through to the legacy players-by-score ranking below.
    let profiles: any[] = [];
    try {
      profiles = await dbSelect(
        "profiles",
        `order=wins.desc,total_score.desc&limit=${limit}&select=display_name,avatar_url,wins,losses,total_score`,
      );
    } catch {
      profiles = [];
    }

    if (profiles.length) {
      const leaderboard = profiles.map((p) => ({
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        total_score: p.total_score ?? 0,
      }));
      return json({ leaderboard });
    }

    // Fallback: profiles empty or unavailable -> legacy players-by-score behavior.
    return json({ leaderboard: await legacyLeaderboard(limit) });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
