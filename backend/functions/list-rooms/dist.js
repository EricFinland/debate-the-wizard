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

// backend/functions/list-rooms/index.ts
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbSelect } = makeDb(DATA, KEY);
async function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Use GET." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);
  try {
    const rooms = await dbSelect(
      "rooms",
      "status=eq.active&order=created_at.desc&limit=20&select=id,topic,status,difficulty,rounds_total,created_at"
    );
    if (!rooms.length) return json({ rooms: [] });
    const ids = rooms.map((r) => r.id).join(",");
    const players = await dbSelect("players", `room_id=in.(${ids})&select=room_id,side,score`);
    const scoresByRoom = {};
    for (const p of players) {
      const s = scoresByRoom[p.room_id] ??= { A: 0, B: 0 };
      if (p.side === "A") s.A = p.score ?? 0;
      else if (p.side === "B") s.B = p.score ?? 0;
    }
    const out = rooms.map((r) => ({
      id: r.id,
      topic: r.topic ?? null,
      status: r.status,
      difficulty: r.difficulty ?? null,
      rounds_total: r.rounds_total ?? null,
      created_at: r.created_at ?? null,
      scores: scoresByRoom[r.id] ?? { A: 0, B: 0 }
    }));
    return json({ rooms: out });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
