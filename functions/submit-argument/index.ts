// submit-argument — the player's turn orchestration ("the rest" track).
//
// Flow: load room -> run the SAME judge pipeline (HTTP to judge-claim) ->
// persist the claim + citations -> bump the player's score. The DB writes are
// what drive the UI: clients subscribed to realtime DB-changes on `claims` /
// `players` for this room get the verdict + score pushed automatically.
//
// POST { "room_id": uuid, "round_no": number, "argument": string }
// Returns { claim, citations, score } (verdict fields live on `claim`).
//
// Deploy: npx @insforge/cli functions deploy submit-argument --file functions/submit-argument/index.ts --name "Submit argument"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

const BASE = (Deno.env.get("INSFORGE_API_URL") ?? "").replace(/\/+$/, "");
const DATA = (Deno.env.get("INSFORGE_DATA_URL") ?? BASE).replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${DATA}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const MAX_ARG = 4000; // guard against oversized payloads / prompt abuse

/** Recompute a player's running total from the source of truth (their claims). Idempotent. */
async function recomputeScore(room_id: string, side: "A" | "B", author: "player" | "wizard"): Promise<number> {
  const claims = await dbSelect("claims", `room_id=eq.${room_id}&author=eq.${author}&select=points`);
  const total = claims.reduce((s, c) => s + (Number(c.points) || 0), 0);
  const [player] = await dbSelect("players", `room_id=eq.${room_id}&side=eq.${side}&select=id`);
  if (player) {
    const [updated] = await dbUpdate("players", `id=eq.${player.id}`, { score: total });
    return updated?.score ?? total;
  }
  return total;
}

async function dbSelect(table: string, query = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${query ? `?${query}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function dbInsert(table: string, rows: unknown[]): Promise<any[]> {
  const res = await fetch(`${DB}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function dbUpdate(table: string, query: string, patch: unknown): Promise<any[]> {
  const res = await fetch(`${DB}/${table}?${query}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Run the shared judge pipeline (owned by the agent-pipeline track). */
async function runJudge(argument: string, topic: string): Promise<any> {
  const res = await fetch(`${BASE}/functions/judge-claim`, { method: "POST", headers: H, body: JSON.stringify({ argument, topic }) });
  if (!res.ok) throw new Error(`judge-claim ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { room_id?: string; round_no?: number; argument?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const room_id = (body.room_id ?? "").trim();
  const argument = (body.argument ?? "").trim();
  const round_no = Number(body.round_no);
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  if (!argument) return json({ error: "'argument' is required." }, 400);
  if (argument.length > MAX_ARG) return json({ error: `'argument' too long (max ${MAX_ARG} chars).` }, 400);
  if (!Number.isFinite(round_no) || round_no < 1) return json({ error: "'round_no' must be >= 1." }, 400);

  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);

    // one argument per player per round
    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409);

    const ruling = await runJudge(argument, room.topic);

    const [claim] = await dbInsert("claims", [{
      room_id,
      round_no,
      author: "player",
      argument,
      key_claim: ruling.key_claim ?? null,
      verdict: ruling.verdict ?? null,
      rationale: ruling.rationale ?? null,
      points: ruling.points ?? 0,
      scores: ruling.scores ?? null,
      fallacies: ruling.fallacies ?? [],
    }]);

    const cites: any[] = Array.isArray(ruling.citations) ? ruling.citations : [];
    const inserted = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    // recompute the human player's (side A) total from their claims — idempotent
    const score = await recomputeScore(room_id, "A", "player");

    return json({ claim, citations: inserted, score, citation_index: ruling.citation_index ?? null });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
