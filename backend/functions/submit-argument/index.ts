// submit-argument — the player's turn orchestration.
//
// Flow: load room -> run the judge pipeline (search You.com + Claude verdict)
// -> persist the claim + citations -> recompute the player's score.
//
// The judge pipeline lives in ../_shared/judge.ts and is imported (not fetched
// over HTTP) because InsForge deploys all functions as ONE Deno deployment;
// cross-function fetches trip Deno Deploy's 508 loop detection.
//
// POST { "room_id": uuid, "round_no": number, "argument": string }
// Returns { claim, citations, score, citation_index, search_query }.
//
// Deploy: npx @insforge/cli functions deploy submit-argument --file backend/functions/submit-argument/index.ts --name "submit-argument"

import { CORS, DEFAULT_BASE, env, json } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";
import { judgePipeline } from "../_shared/judge.ts";

// ---------- config ----------
const MAX_ARG = 4000;

const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect, dbInsert, dbUpdate } = makeDb(DATA, KEY);

// ---------- score helper ----------
/** Recompute a player's total from their claims (idempotent). */
async function recomputeScore(room_id: string, side: "A" | "B", author: "player" | "wizard"): Promise<number> {
  const claims = await dbSelect("claims", `room_id=eq.${room_id}&author=eq.${author}&select=points`);
  const total = claims.reduce((s, c) => s + (Number(c.points) || 0), 0);
  const [player] = await dbSelect("players", `room_id=eq.${room_id}&side=eq.${side}&select=id`);
  if (player) {
    const [u] = await dbUpdate("players", `id=eq.${player.id}`, { score: total });
    return u?.score ?? total;
  }
  return total;
}

// ---------- handler ----------
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

    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409);

    const ruling = await judgePipeline(argument, room.topic);

    const [claim] = await dbInsert("claims", [{
      room_id, round_no, author: "player", argument,
      key_claim: ruling.key_claim ?? null, verdict: ruling.verdict ?? null, rationale: ruling.rationale ?? null,
      points: ruling.points ?? 0, scores: ruling.scores ?? null, fallacies: ruling.fallacies ?? [],
      search_query: ruling.search_query ?? null,
    }]);

    const cites = ruling.citations ?? [];
    const inserted = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    const score = await recomputeScore(room_id, "A", "player");
    return json({ claim, citations: inserted, score, citation_index: ruling.citation_index ?? null, search_query: ruling.search_query ?? null });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
