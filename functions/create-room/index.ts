// create-room — start a match. Creates a room + two players (A=human, B=wizard).
// Owned by the orchestration/infra track ("the rest").
//
// POST { "topic"?: string, "topic_id"?: string, "rounds_total"?: number }
//   - pass topic_id to use a pre-vetted demo topic (see SEED_TOPICS), or
//   - pass a freeform topic string.
// Returns { room, players, topic_meta }.
//
// Deploy: npx @insforge/cli functions deploy create-room --file functions/create-room/index.ts --name "Create room"

// --- pre-vetted demo topics (kept in sync with seed/topics.json) ---
const SEED_TOPICS: Record<string, { topic: string; human_side_label: string; wizard_side_label: string }> = {
  "nuclear-climate": {
    topic: "Nuclear energy is the best tool we have for fighting climate change.",
    human_side_label: "FOR — nuclear is essential",
    wizard_side_label: "AGAINST — renewables are the better bet",
  },
  "cars-transit": {
    topic: "Cities should replace private cars with free public transit.",
    human_side_label: "FOR — ban cars, fund transit",
    wizard_side_label: "AGAINST — cars still matter",
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

const BASE = (Deno.env.get("INSFORGE_API_URL") ?? "").replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${BASE}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function dbInsert(table: string, rows: unknown[]): Promise<any[]> {
  const res = await fetch(`${DB}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { topic?: string; topic_id?: string; rounds_total?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const seed = body.topic_id ? SEED_TOPICS[body.topic_id] : undefined;
  const topic = (seed?.topic ?? body.topic ?? "").trim();
  if (!topic) return json({ error: "Provide 'topic' or a valid 'topic_id'." }, 400);

  const rounds_total = Math.max(1, Math.min(10, Number(body.rounds_total) || 5));

  try {
    const [room] = await dbInsert("rooms", [{ topic, status: "active", rounds_total }]);
    const players = await dbInsert("players", [
      { room_id: room.id, side: "A", score: 0 },
      { room_id: room.id, side: "B", score: 0 },
    ]);
    return json({
      room,
      players,
      topic_meta: seed ? { id: body.topic_id, ...seed } : { topic },
    });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
