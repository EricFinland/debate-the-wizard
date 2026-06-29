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

// backend/functions/get-room/index.ts
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbSelect } = makeDb(DATA, KEY);
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
  const room_id = (body.room_id ?? "").trim();
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}`);
    if (!room) return json({ error: "Room not found." }, 404);
    const players = await dbSelect("players", `room_id=eq.${room_id}&order=side.asc`);
    const claims = await dbSelect("claims", `room_id=eq.${room_id}&order=created_at.asc`);
    let citationsByClaim = {};
    if (claims.length) {
      const ids = claims.map((c) => c.id).join(",");
      const citations = await dbSelect("citations", `claim_id=in.(${ids})`);
      for (const cit of citations) {
        (citationsByClaim[cit.claim_id] ??= []).push(cit);
      }
    }
    const claimsWithCites = claims.map((c) => ({ ...c, citations: citationsByClaim[c.id] ?? [] }));
    const scores = {
      A: players.find((p) => p.side === "A")?.score ?? 0,
      B: players.find((p) => p.side === "B")?.score ?? 0
    };
    let winner = null;
    if (room.status === "finished") {
      winner = scores.A > scores.B ? "A" : scores.B > scores.A ? "B" : "tie";
    }
    return json({ room, players, scores, claims: claimsWithCites, winner });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
