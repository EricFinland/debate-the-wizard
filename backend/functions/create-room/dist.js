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
  async function dbSelect(table, query = "") {
    const res = await fetch(`${db}/${table}${query ? `?${query}` : ""}`, { headers: H });
    if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbInsert2(table, rows) {
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
  return { dbSelect, dbInsert: dbInsert2, dbUpdate };
}

// backend/functions/create-room/index.ts
var SEED_TOPICS = {
  "nuclear-climate": {
    topic: "Nuclear energy is the best tool we have for fighting climate change.",
    human_side_label: "FOR \u2014 nuclear is essential",
    wizard_side_label: "AGAINST \u2014 renewables are the better bet"
  },
  "cars-transit": {
    topic: "Cities should replace private cars with free public transit.",
    human_side_label: "FOR \u2014 ban cars, fund transit",
    wizard_side_label: "AGAINST \u2014 cars still matter"
  }
};
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbInsert } = makeDb(DATA, KEY);
async function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const seed = body.topic_id ? SEED_TOPICS[body.topic_id] : void 0;
  const topic = (seed?.topic ?? body.topic ?? "").trim();
  if (!topic) return json({ error: "Provide 'topic' or a valid 'topic_id'." }, 400);
  const rounds_total = Math.max(1, Math.min(10, Number(body.rounds_total) || 5));
  const DIFFICULTIES = ["novice", "adept", "archmage", "impossible"];
  const difficulty = DIFFICULTIES.includes(String(body.difficulty)) ? String(body.difficulty) : "adept";
  const host_user_id = typeof body.host_user_id === "string" && body.host_user_id.trim() ? body.host_user_id.trim() : null;
  try {
    const [room] = await dbInsert("rooms", [{ topic, status: "active", rounds_total, difficulty, host_user_id }]);
    const players = await dbInsert("players", [
      { room_id: room.id, side: "A", score: 0 },
      { room_id: room.id, side: "B", score: 0 }
    ]);
    return json({
      room,
      players,
      topic_meta: seed ? { id: body.topic_id, ...seed } : { topic }
    });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
