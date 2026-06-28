// advance-wizard — the wizard's turn orchestration.
//
// Generates a grounded rebuttal (You.com search from the AGAINST angle + Claude)
// and judges it through the SAME pipeline (so the wizard can get caught), then
// persists the claim + citations, recomputes the wizard's score, and on the final
// round flips the room to 'finished'.
//
// The judge pipeline is imported from ../_shared/judge.ts (not fetched over HTTP)
// because InsForge deploys all functions as ONE Deno deployment; cross-function
// fetches trip Deno Deploy's 508 loop detection.
//
// POST { "room_id": uuid, "round_no": number, "opponent_argument"?: string }
// Returns { claim, citations, score, citation_index, taunt, search_query, room }.
//
// Deploy: npx @insforge/cli functions deploy advance-wizard --file backend/functions/advance-wizard/index.ts --name "advance-wizard"

import { CORS, DEFAULT_BASE, SCORE, ZERO_SCORES, env, json, type Citation, type Scores, type Verdict } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";
import { chat, judgePipeline, searchYouCom } from "../_shared/judge.ts";

// ---------- config ----------
const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");

const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect, dbInsert, dbUpdate } = makeDb(DATA, KEY);

// ---------- difficulty ----------
type Difficulty = "novice" | "adept" | "archmage" | "impossible";
const DIFFICULTIES: readonly Difficulty[] = ["novice", "adept", "archmage", "impossible"] as const;
const normalizeDifficulty = (d: unknown): Difficulty =>
  DIFFICULTIES.includes(String(d).toLowerCase() as Difficulty) ? (String(d).toLowerCase() as Difficulty) : "adept";

const DIFFICULTY_STYLE: Record<Difficulty, { persona: string; temp: number }> = {
  novice: {
    persona:
      "You are a NOVICE apprentice wizard, still unsure of your craft. Argue the AGAINST side but be tentative and HEDGED: use softeners like \"I think\", \"maybe\", \"it could be\". You are prone to WEAK or OVER-REACHING points and you often lean on a snippet loosely rather than nailing it. Keep it to 2-3 plain sentences.",
    temp: 0.95,
  },
  adept: {
    persona:
      "You are an ADEPT wizard, a solid and competent debater. Argue the AGAINST side with a clear, well-structured rebuttal grounded firmly in ONE snippet. Confident but not flashy. Keep it to 2-3 plain sentences.",
    temp: 0.7,
  },
  archmage: {
    persona:
      "You are the ARCHMAGE, a master debater of devastating precision. Argue the AGAINST side with a SHARP, rhetorically FORCEFUL rebuttal that is TIGHTLY grounded in ONE snippet you cite with surgical accuracy. Every word lands. Keep it to 2-3 plain sentences.",
    temp: 0.55,
  },
  impossible: {
    persona:
      "You are the LICH KING, an undying force of pure argumentation beyond mortal reckoning. Argue the AGAINST side with ABSOLUTE precision: your rebuttal must be IRREFUTABLY grounded in ONE snippet, devastatingly concise, rhetorically airtight, and leave no opening for counterattack. Every word is chosen with lethal intent. Keep it to 2-3 plain sentences.",
    temp: 0.3,
  },
};

// ---------- wizard generation ----------

/** Build a tight web-search query that targets evidence AGAINST the topic. */
async function buildAgainstQuery(topic: string, opp: string): Promise<string> {
  const sys =
    "You craft ONE concise web-search query (max 12 words) to find EVIDENCE AGAINST a debate topic " +
    "(the opposing side). If an OPPONENT ARGUMENT is given, target evidence that rebuts it. " +
    "Reply with ONLY the query text, no quotes.";
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opp ? `OPPONENT ARGUMENT (to rebut): ${opp}` : "OPPONENT ARGUMENT: (none yet)");
  const fallback = (topic ? `${topic} criticism counterargument evidence` : "counterargument evidence").slice(0, 200);
  try {
    const q = (await chat(EXTRACT_MODEL, [
      { role: "system", content: sys },
      { role: "user", content: user },
    ], 0.3)).trim().replace(/^["']|["']$/g, "");
    return q || fallback;
  } catch {
    return fallback;
  }
}

/** Ask Claude to write a punchy, grounded rebuttal arguing side B (against). */
async function writeRebuttal(topic: string, opp: string, citations: Citation[], difficulty: Difficulty): Promise<string> {
  const list = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const style = DIFFICULTY_STYLE[difficulty];
  const sys =
    `${style.persona} ALWAYS argue the AGAINST side of the topic. NEVER invent facts; only use ` +
    "what the SEARCH SNIPPETS provide. If an OPPONENT ARGUMENT is given, directly rebut it. " +
    "Plain prose only, no markdown or preamble. Just the rebuttal.";
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opp ? `OPPONENT ARGUMENT (rebut this): ${opp}\n` : "") +
    `\nSEARCH SNIPPETS (ground your point in one):\n${list || "(none found)"}`;
  return (await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: user }], style.temp)).trim();
}

/** Short, in-character wizard taunt themed to the topic. Best-effort; never throws. */
async function writeTaunt(topic: string, argument: string, difficulty: Difficulty): Promise<string> {
  const tone =
    difficulty === "novice" ? "a little unsure of yourself" :
    difficulty === "archmage" ? "supremely arrogant" :
    difficulty === "impossible" ? "coldly omniscient, as if you have already won" :
    "smug and confident";
  const sys =
    `You are a debate Wizard who just delivered a rebuttal. Write ONE short in-character taunt sentence ` +
    `(max 18 words), themed to the debate TOPIC with wizard/arcane flavor. Be ${tone}. ` +
    "No profanity, no markdown, no quotes. Output ONLY the taunt.";
  try {
    const t = (await chat(JUDGE_MODEL, [
      { role: "system", content: sys },
      { role: "user", content: `TOPIC: ${topic || "(unspecified)"}\nMY REBUTTAL: ${argument}` },
    ], 0.9)).trim().replace(/^["']|["']$/g, "");
    return t.split("\n")[0].slice(0, 200);
  } catch {
    return "";
  }
}

function fallbackArgument(topic: string, citations: Citation[]): string {
  const cited = citations.find((c) => c.snippet);
  if (cited) {
    return `The case for "${topic || "this position"}" overlooks serious counter-evidence: ${cited.snippet.slice(0, 220)} That alone should give us pause.`;
  }
  return `"${topic || "This position"}" is far less settled than it sounds. The opposing side rests on contested premises, and the burden of proof has not been met.`;
}

/** Generate + judge the wizard's turn, fully self-contained. */
async function runWizard(topic: string, opp: string, difficulty: Difficulty) {
  let grounding: Citation[] = [];
  try { grounding = await searchYouCom(await buildAgainstQuery(topic, opp)); } catch { grounding = []; }

  let argument: string;
  try {
    argument = (await writeRebuttal(topic, opp, grounding, difficulty)) || fallbackArgument(topic, grounding);
  } catch {
    argument = fallbackArgument(topic, grounding);
  }

  const taunt = await writeTaunt(topic, argument, difficulty);
  // judgePipeline runs its OWN fresh You.com search -> authoritative citations
  const judged = await judgePipeline(argument, topic);
  return { argument, taunt, ...judged };
}

// ---------- score helper ----------
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

  let body: { room_id?: string; round_no?: number; opponent_argument?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const room_id = (body.room_id ?? "").trim();
  const round_no = Number(body.round_no);
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  if (!Number.isFinite(round_no) || round_no < 1) return json({ error: "'round_no' must be >= 1." }, 400);

  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total,difficulty`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);

    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.wizard&select=id`);
    if (dupe.length) return json({ error: "The wizard already argued this round." }, 409);

    const difficulty = normalizeDifficulty(room.difficulty);
    const judged = await runWizard(room.topic, (body.opponent_argument ?? "").trim(), difficulty);

    const [claim] = await dbInsert("claims", [{
      room_id, round_no, author: "wizard", argument: judged.argument,
      key_claim: judged.key_claim ?? null, verdict: judged.verdict ?? null, rationale: judged.rationale ?? null,
      points: judged.points ?? 0, scores: judged.scores ?? null, fallacies: judged.fallacies ?? [],
      taunt: judged.taunt || null, search_query: judged.search_query ?? null,
    }]);

    const cites = judged.citations ?? [];
    const inserted = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    const score = await recomputeScore(room_id, "B", "wizard");

    let roomOut = room;
    if (round_no >= room.rounds_total) {
      const [u] = await dbUpdate("rooms", `id=eq.${room_id}`, { status: "finished" });
      roomOut = u ?? { ...room, status: "finished" };
    }

    return json({ claim, citations: inserted, score, citation_index: judged.citation_index ?? null, taunt: judged.taunt || null, search_query: judged.search_query ?? null, room: roomOut });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
