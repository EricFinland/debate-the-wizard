// submit-argument — handles an entire debate round.
//
// Flow: load room -> load history -> run agent-workflow (evaluates player & generates wizard)
// -> persist BOTH claims -> recompute scores -> return full turn data.
//
// Deploy: npx @insforge/cli functions deploy submit-argument --file backend/functions/submit-argument/index.ts --name "submit-argument"

import { CORS, DEFAULT_BASE, env, json } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";
import { runAgentWorkflow } from "../../agent-workflow/index.ts";
import type { DebateHistoryEntry } from "../../agent-workflow/types/common.ts";

const MAX_ARG = 4000;
const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect, dbInsert, dbUpdate } = makeDb(DATA, KEY);

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

// Convert 0-25 scale to 0-10 format for db (e.g. 25 -> 10)
function scaleScore(total25: number): number {
  return Math.max(0, Math.min(10, Math.round((total25 / 25) * 10)));
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
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total,difficulty`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);

    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409);

    // Fetch history up to the previous round
    const claims = await dbSelect("claims", `room_id=eq.${room_id}&round_no=lt.${round_no}&order=round_no.asc,author.asc&select=round_no,author,argument`);
    const history: DebateHistoryEntry[] = claims.map((c: any) => ({
      round_no: c.round_no,
      author: c.author as "player" | "wizard",
      argument: c.argument,
    }));

    const result = await runAgentWorkflow({
      user_argument: argument,
      difficulty: room.difficulty || "adept",
      history,
    });

    const playerPoints = scaleScore(result.judge_result.user_score.total);
    const wizardPoints = scaleScore(result.judge_result.ai_score.total);

    const [playerClaim] = await dbInsert("claims", [{
      room_id, round_no, author: "player", argument,
      key_claim: result.user_claim_report.main_claim,
      verdict: result.judge_result.winner,
      rationale: result.judge_result.explanation,
      points: playerPoints,
      scores: result.judge_result.user_score,
      fallacies: result.fallacy_report.fallacies,
      search_query: result.search_evidence.query,
    }]);

    const [wizardClaim] = await dbInsert("claims", [{
      room_id, round_no, author: "wizard", argument: result.ai_rebuttal,
      key_claim: "AI Rebuttal",
      verdict: null,
      rationale: result.debater_result.strategy,
      points: wizardPoints,
      scores: result.judge_result.ai_score,
      fallacies: [],
      taunt: null, // Removed taunt logic for brevity or we can add it back later if needed
      search_query: null,
    }]);

    const cites = result.search_evidence.citations ?? [];
    const insertedPlayerCitations = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: playerClaim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    const playerScore = await recomputeScore(room_id, "A", "player");
    const wizardScore = await recomputeScore(room_id, "B", "wizard");

    let roomOut = room;
    if (round_no >= room.rounds_total) {
      const [u] = await dbUpdate("rooms", `id=eq.${room_id}`, { status: "finished" });
      roomOut = u ?? { ...room, status: "finished" };
    }

    return json({
      player_claim: playerClaim,
      wizard_claim: wizardClaim,
      player_citations: insertedPlayerCitations,
      player_score: playerScore,
      wizard_score: wizardScore,
      room: roomOut,
      winner: result.judge_result.winner,
      explanation: result.judge_result.explanation
    });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
