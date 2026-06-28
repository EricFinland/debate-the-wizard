// leaderboard — top human performances across finished matches ("the rest" track).
// Read-only. Ranks side-A (human) players by score.
//
// GET (or POST) -> { leaderboard: [{ room_id, topic, score, status, ... }] }
//
// Deploy: npx @insforge/cli functions deploy leaderboard --file functions/leaderboard/index.ts --name "Leaderboard"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

const BASE = (Deno.env.get("INSFORGE_API_URL") ?? "").replace(/\/+$/, "");
const DATA = (Deno.env.get("INSFORGE_DATA_URL") ?? BASE).replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${DATA}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function dbSelect(table: string, query = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${query ? `?${query}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  const limit = 20;
  try {
    const players = await dbSelect("players", `side=eq.A&order=score.desc&limit=${limit}&select=room_id,score`);
    if (!players.length) return json({ leaderboard: [] });

    const ids = players.map((p) => p.room_id).join(",");
    const rooms = await dbSelect("rooms", `id=in.(${ids})&select=id,topic,status,created_at`);
    const roomById: Record<string, any> = {};
    for (const r of rooms) roomById[r.id] = r;

    const leaderboard = players.map((p) => ({
      room_id: p.room_id,
      score: p.score,
      topic: roomById[p.room_id]?.topic ?? null,
      status: roomById[p.room_id]?.status ?? null,
      created_at: roomById[p.room_id]?.created_at ?? null,
    }));
    return json({ leaderboard });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
