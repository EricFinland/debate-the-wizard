// create-room — start a match. Creates a room + two players (A=human, B=wizard).
// Owned by the orchestration/infra track ("the rest").
//
// POST { "topic"?: string, "topic_id"?: string, "rounds_total"?: number,
//        "difficulty"?: "novice"|"adept"|"archmage"|"impossible", "host_user_id"?: string }
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

/** Count matching rows (best-effort; returns 0 on any read failure so limits never hard-break creation). */
async function dbCount(table: string, query: string): Promise<number> {
  try {
    const res = await fetch(`${DB}/${table}?${query}`, { headers: H });
    if (!res.ok) return 0;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
}

// ---- abuse protection / rate-limit knobs (env-overridable) ----
const num = (k: string, d: number) => Number(Deno.env.get(k) ?? "") || d;
const GUEST_FIGHT_LIMIT = num("GUEST_FIGHT_LIMIT", 1);      // new/guest accounts: 1 free fight
const VERIFIED_FIGHT_LIMIT = num("VERIFIED_FIGHT_LIMIT", 25); // OAuth-verified accounts
const GLOBAL_DAILY_LIMIT = num("GLOBAL_DAILY_LIMIT", 300);  // hard token safety net across everyone / 24h
const COOLDOWN_SECONDS = num("COOLDOWN_SECONDS", 12);       // min gap between a player's duels

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { topic?: string; topic_id?: string; rounds_total?: number; difficulty?: string; host_user_id?: string; email_verified?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const seed = body.topic_id ? SEED_TOPICS[body.topic_id] : undefined;
  const topic = (seed?.topic ?? body.topic ?? "").trim();
  if (!topic) return json({ error: "Provide 'topic' or a valid 'topic_id'." }, 400);

  const rounds_total = Math.max(1, Math.min(10, Number(body.rounds_total) || 5));

  const DIFFICULTIES = ["novice", "adept", "archmage", "impossible"];
  const difficulty = DIFFICULTIES.includes(String(body.difficulty)) ? String(body.difficulty) : "adept";
  const host_user_id = typeof body.host_user_id === "string" && body.host_user_id.trim() ? body.host_user_id.trim() : null;
  const verified = body.email_verified === true;

  // ---- rate limiting / abuse protection (protect API tokens) ----
  // 1. Global daily cap: identity-independent hard ceiling so no amount of fake
  //    accounts can drain the API budget.
  const since24 = new Date(Date.now() - 86400000).toISOString();
  const globalRecent = await dbCount("rooms", `created_at=gte.${since24}&select=id&limit=${GLOBAL_DAILY_LIMIT + 1}`);
  if (globalRecent >= GLOBAL_DAILY_LIMIT) {
    return json({ error: "The wizard is resting. The daily duel limit was reached. Please try again later.", code: "global_limit" }, 503);
  }

  // 2. Per-account limits (keyed on host_user_id).
  if (host_user_id) {
    const id = encodeURIComponent(host_user_id);
    // brief cooldown to stop rapid-fire spam
    const sinceCd = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
    const burst = await dbCount("rooms", `host_user_id=eq.${id}&created_at=gte.${sinceCd}&select=id&limit=1`);
    if (burst > 0) {
      return json({ error: "Slow down, mage. Wait a few seconds before starting another duel.", code: "cooldown" }, 429);
    }
    // total fight cap: new/guest accounts get 1 free fight; verified accounts get more
    const cap = verified ? VERIFIED_FIGHT_LIMIT : GUEST_FIGHT_LIMIT;
    const mine = await dbCount("rooms", `host_user_id=eq.${id}&select=id&limit=${cap + 1}`);
    if (mine >= cap) {
      return json({
        error: verified
          ? "You have reached your duel limit. The wizard needs to rest."
          : "You have used your free duel. Sign in with Google or GitHub to challenge the wizard again.",
        code: verified ? "limit" : "guest_limit",
      }, 429);
    }
  }

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
