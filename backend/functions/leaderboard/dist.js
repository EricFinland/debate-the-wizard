// backend/functions/_shared/config.ts
var env = (k, fallback = "") => Deno.env.get(k) ?? fallback;
var DEFAULT_BASE = "https://4eychqk3.us-east.insforge.app";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// backend/functions/_shared/db.ts
function makeDb(base, key) {
  const db = `${base}/api/database/records`;
  const H = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  async function dbSelect2(table, query = "") {
    const res = await fetch(`${db}/${table}${query ? `?${query}` : ""}`, { headers: H });
    if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbInsert(table, rows) {
    const res = await fetch(`${db}/${table}`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(rows)
    });
    if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbUpdate(table, query, patch) {
    const res = await fetch(`${db}/${table}?${query}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`update ${table} ${query} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  return { dbSelect: dbSelect2, dbInsert, dbUpdate };
}

// backend/functions/leaderboard/index.ts
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbSelect } = makeDb(DATA, KEY);
async function legacyLeaderboard(limit) {
  const players = await dbSelect("players", `side=eq.A&order=score.desc&limit=${limit}&select=room_id,score`);
  if (!players.length) return [];
  const ids = players.map((p) => p.room_id).join(",");
  const rooms = await dbSelect("rooms", `id=in.(${ids})&select=id,topic,status,created_at`);
  const roomById = {};
  for (const r of rooms) roomById[r.id] = r;
  return players.map((p) => ({
    room_id: p.room_id,
    score: p.score,
    topic: roomById[p.room_id]?.topic ?? null,
    status: roomById[p.room_id]?.status ?? null,
    created_at: roomById[p.room_id]?.created_at ?? null
  }));
}
async function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);
  const limit = 20;
  try {
    let profiles = [];
    try {
      profiles = await dbSelect(
        "profiles",
        `order=wins.desc,total_score.desc&limit=${limit}&select=display_name,avatar_url,wins,losses,total_score`
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
        total_score: p.total_score ?? 0
      }));
      return json({ leaderboard });
    }
    return json({ leaderboard: await legacyLeaderboard(limit) });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
