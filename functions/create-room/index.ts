// create-room — start a match. Creates a room + two players (A=human, B=wizard).
// Owned by the orchestration/infra track ("the rest").
//
// POST { "topic"?: string, "topic_id"?: string, "rounds_total"?: number,
//        "difficulty"?: "novice"|"adept"|"archmage", "host_user_id"?: string }
//   - pass topic_id to use a pre-vetted demo topic (see SEED_TOPICS), or
//   - pass a freeform topic string.
//   - difficulty defaults to 'adept'; host_user_id is optional.
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

// The data/records API is served from the project origin. Prefer the configured
// env var, but fall back to the known project URL so the function still works if
// INSFORGE_API_URL is not injected into the deployment env.
const DEFAULT_BASE = "https://atjgzcv9.us-east.insforge.app";
const BASE = ((Deno.env.get("INSFORGE_API_URL") ?? "") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = ((Deno.env.get("INSFORGE_DATA_URL") ?? "") || BASE).replace(/\/+$/, ""); // records API may live on a different host
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${DATA}/api/database/records`;
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

  let body: { topic?: string; topic_id?: string; rounds_total?: number; difficulty?: string; host_user_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const seed = body.topic_id ? SEED_TOPICS[body.topic_id] : undefined;
  const topic = (seed?.topic ?? body.topic ?? "").trim();
  if (!topic) return json({ error: "Provide 'topic' or a valid 'topic_id'." }, 400);

  const rounds_total = Math.max(1, Math.min(10, Number(body.rounds_total) || 5));

  const DIFFICULTIES = ["novice", "adept", "archmage"];
  const difficulty = DIFFICULTIES.includes(String(body.difficulty)) ? String(body.difficulty) : "adept";
  const host_user_id = typeof body.host_user_id === "string" && body.host_user_id.trim() ? body.host_user_id.trim() : null;

  try {
    const [room] = await dbInsert("rooms", [{ topic, status: "active", rounds_total, difficulty, host_user_id }]);
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
