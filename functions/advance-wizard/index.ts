// advance-wizard — the wizard's turn orchestration ("the rest" track).
//
// Calls wizard-turn (agent-pipeline track) to GENERATE a grounded rebuttal, then
// runs it through the SAME judge pipeline (so the wizard can also get caught),
// persists the claim + citations, bumps the wizard's score, and on the final
// round flips the room to 'finished'.
//
// Contract expected from wizard-turn (POST):
//   { room_id, topic, side_label, round_no, opponent_argument? }
//   -> MUST return at least { argument: string }. MAY also return the full
//      judged shape (verdict, points, scores, fallacies, citations); if it does,
//      we trust it and skip re-judging.
//
// POST { "room_id": uuid, "round_no": number, "opponent_argument"?: string }
// Returns { claim, citations, score, room } (room.status flips to 'finished' on the last round).
//
// Deploy: npx @insforge/cli functions deploy advance-wizard --file functions/advance-wizard/index.ts --name "Advance wizard"

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
async function runJudge(argument: string, topic: string): Promise<any> {
  const res = await fetch(`${BASE}/functions/judge-claim`, { method: "POST", headers: H, body: JSON.stringify({ argument, topic }) });
  if (!res.ok) throw new Error(`judge-claim ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { room_id?: string; round_no?: number; opponent_argument?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const room_id = (body.room_id ?? "").trim();
  const round_no = Number(body.round_no);
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  if (!Number.isFinite(round_no) || round_no < 1) return json({ error: "'round_no' must be >= 1." }, 400);

  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total`);
    if (!room) return json({ error: "Room not found." }, 404);

    // 1. ask the wizard (agent-pipeline track) for a grounded rebuttal
    let wiz: any;
    try {
      const res = await fetch(`${BASE}/functions/wizard-turn`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ room_id, topic: room.topic, side_label: "B", round_no, opponent_argument: body.opponent_argument ?? "" }),
      });
      if (res.status === 404) {
        return json({ error: "wizard-turn is not deployed yet (owned by the agent-pipeline branch). Deploy it, then retry." }, 503);
      }
      if (!res.ok) throw new Error(`wizard-turn ${res.status}: ${(await res.text()).slice(0, 300)}`);
      wiz = await res.json();
    } catch (e) {
      return json({ error: `wizard-turn call failed: ${String(e instanceof Error ? e.message : e)}` }, 502);
    }

    const argument = (wiz?.argument ?? "").trim();
    if (!argument) return json({ error: "wizard-turn did not return an 'argument'." }, 502);

    // 2. if wizard-turn already judged itself, trust it; otherwise run the judge
    const judged = typeof wiz?.verdict === "string" ? wiz : await runJudge(argument, room.topic);

    // 3. persist the wizard's claim + citations
    const [claim] = await dbInsert("claims", [{
      room_id,
      round_no,
      author: "wizard",
      argument,
      key_claim: judged.key_claim ?? null,
      verdict: judged.verdict ?? null,
      rationale: judged.rationale ?? null,
      points: judged.points ?? 0,
      scores: judged.scores ?? null,
      fallacies: judged.fallacies ?? [],
    }]);
    const cites: any[] = Array.isArray(judged.citations) ? judged.citations : [];
    const inserted = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    // 4. bump the wizard player's (side B) score
    const [player] = await dbSelect("players", `room_id=eq.${room_id}&side=eq.B&select=id,score`);
    let score = player?.score ?? 0;
    if (player) {
      const [updated] = await dbUpdate("players", `id=eq.${player.id}`, { score: score + (judged.points ?? 0) });
      score = updated?.score ?? score;
    }

    // 5. close the match after the wizard finishes the final round
    let roomOut = room;
    if (round_no >= room.rounds_total) {
      const [updatedRoom] = await dbUpdate("rooms", `id=eq.${room_id}`, { status: "finished" });
      roomOut = updatedRoom ?? { ...room, status: "finished" };
    }

    return json({ claim, citations: inserted, score, citation_index: judged.citation_index ?? null, room: roomOut });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
