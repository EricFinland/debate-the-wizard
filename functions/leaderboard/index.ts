// leaderboard — ranks VERIFIED profiles by lifetime wins across matches.
// Read-only. Returns the top 20 verified profiles ordered by wins desc, then total_score desc.
// Falls back to the legacy side-A players-by-score ranking if the profiles table is empty.
//
// GET (or POST) -> { leaderboard: [{ display_name, avatar_url, wins, losses, total_score }] }
//
// Deploy: npx @insforge/cli functions deploy leaderboard --file functions/leaderboard/index.ts --name "Leaderboard"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

// Fall back to the known project URL if INSFORGE_API_URL is not in the deployment env.
const DEFAULT_BASE = "https://atjgzcv9.us-east.insforge.app";
const BASE = ((Deno.env.get("INSFORGE_API_URL") ?? "") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = ((Deno.env.get("INSFORGE_DATA_URL") ?? "") || BASE).replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${DATA}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function dbSelect(table: string, query = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${query ? `?${query}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

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
    // Primary: rank VERIFIED profiles by lifetime wins, then total score. Only
    // profiles with verified=true are eligible for the public leaderboard. A read
    // failure (e.g. profiles table not yet migrated) must NOT 500 the leaderboard
    // — it falls through to the legacy players-by-score ranking below.
    let profiles: any[] = [];
    try {
      profiles = await dbSelect(
        "profiles",
        `verified=eq.true&order=wins.desc,total_score.desc&limit=${limit}&select=display_name,avatar_url,wins,losses,total_score`,
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
  } catch {
    // Leaderboard must NEVER hard-fail (the players fallback can gateway-timeout).
    // Return empty rather than a 500 so the UI never shows a gateway error.
    return json({ leaderboard: [] });
  }
}
