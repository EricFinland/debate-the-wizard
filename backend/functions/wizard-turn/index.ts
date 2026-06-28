// wizard-turn — the wizard's brain (standalone, no DB).
//
// The wizard always argues the AGAINST side (side B) of the topic. This function:
//   1. Searches You.com from side B's angle (rebutting opponent_argument if present)
//      so the wizard's strongest point is GROUNDED in a real, citable snippet.
//   2. Asks Claude to write a PUNCHY 2-3 sentence rebuttal grounded in one snippet.
//   3. Self-judges through the SAME pipeline (imported from ../_shared/judge.ts)
//      so the wizard is held to the SAME standard as the human and can get caught.
//
// Returns the FULL judged shape so advance-wizard can trust it and skip re-judging:
//   { argument, key_claim, verdict, rationale, points, scores, fallacies, citations, citation_index }
//
// Pure (no DB, no realtime): takes inputs, calls You.com + Claude + judge pipeline, returns JSON.
//
// Deploy:
//   npx @insforge/cli functions deploy wizard-turn \
//     --file backend/functions/wizard-turn/index.ts \
//     --name "Wizard turn"
//
// Secrets it needs (npx @insforge/cli secrets add <KEY> <value>):
//   OPENROUTER_API_KEY - OpenRouter bearer token (model calls)
//   YOUCOM_API_KEY     - You.com Search API key (X-API-Key)
// Optional:
//   JUDGE_MODEL        - default anthropic/claude-sonnet-4.6 (rebuttal + judge)
//   EXTRACT_MODEL      - default anthropic/claude-haiku-4.5 (search query)
//   SEARCH_COUNT       - default 6

import { CORS, SCORE, ZERO_SCORES, env, json, type Citation, type Scores, type Verdict } from "../_shared/config.ts";
import { chat, judgePipeline, searchYouCom } from "../_shared/judge.ts";

// ---------- config ----------
const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");

// ---------- types ----------
interface WizardResult {
  argument: string;
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  points: number;
  scores: Scores;
  fallacies: string[];
  citations: Citation[];
  citation_index: number | null;
}

// ---------- wizard generation ----------

/** Build a tight web-search query that targets evidence AGAINST the topic. */
async function buildSearchQuery(topic: string, opponent_argument: string): Promise<string> {
  const sys =
    "You craft ONE concise web-search query (max 12 words) to find EVIDENCE AGAINST a debate topic " +
    "(arguing the 'against' / opposing side). If an OPPONENT ARGUMENT is given, target evidence that rebuts it. " +
    "Reply with ONLY the query text, no quotes.";
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opponent_argument ? `OPPONENT ARGUMENT (to rebut): ${opponent_argument}` : "OPPONENT ARGUMENT: (none yet)");
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
async function writeRebuttal(topic: string, opponent_argument: string, citations: Citation[]): Promise<string> {
  const snippetList = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const sys =
    "You are the Wizard, a sharp debate opponent who ALWAYS argues the AGAINST side of the topic. " +
    "Write a PUNCHY rebuttal of 2-3 sentences. Rules:\n" +
    "- Ground your strongest point in ONE of the provided SEARCH SNIPPETS and reference it naturally " +
    "(e.g. 'according to the source...' or by naming the finding). NEVER invent facts or statistics.\n" +
    "- If an OPPONENT ARGUMENT is given, directly rebut it.\n" +
    "- Be confident and rhetorically forceful, but every factual point must trace back to a snippet.\n" +
    "- Plain prose only. No markdown, no lists, no citations brackets, no preamble. Just the rebuttal.";
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opponent_argument ? `OPPONENT ARGUMENT (rebut this): ${opponent_argument}\n` : "") +
    `\nSEARCH SNIPPETS (ground your point in one of these):\n${snippetList || "(none found)"}`;
  const raw = await chat(JUDGE_MODEL, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ], 0.7);
  return raw.trim();
}

/** A minimal, always-valid local rebuttal if the gateway is unavailable. */
function fallbackArgument(topic: string, opponent_argument: string, citations: Citation[]): string {
  const cited = citations.find((c) => c.snippet);
  if (cited) {
    return `The case for "${topic || "this position"}" overlooks serious counter-evidence: ${cited.snippet.slice(0, 220)} ` +
      `That alone should give us pause before accepting the claim at face value.`;
  }
  if (opponent_argument) {
    return `That argument assumes the strongest case is settled, but it is not. The opposing position rests on contested premises that deserve far more scrutiny before we treat "${topic || "the claim"}" as proven.`;
  }
  return `"${topic || "This position"}" is far less settled than it sounds. The opposing side rests on contested premises and cherry-picked evidence, and the burden of proof has not been met.`;
}

/** Normalize a judged result into the full WizardResult shape. */
function shapeFromJudged(argument: string, judged: any, fallbackCitations: Citation[]): WizardResult {
  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(judged?.verdict)
    ? judged.verdict
    : "unsupported";

  // Prefer the judge's own (authoritative) citations; only fall back to the
  // wizard's search results if the judge returned none.
  const judgeCitations: Citation[] = Array.isArray(judged?.citations) ? judged.citations : [];
  const usedJudgeCitations = judgeCitations.length > 0;
  const citations: Citation[] = usedJudgeCitations ? judgeCitations : fallbackCitations;

  const scores: Scores = judged?.scores && typeof judged.scores === "object"
    ? {
        factual_accuracy: Math.max(0, Math.min(10, Math.round(Number(judged.scores.factual_accuracy)) || 0)),
        logic: Math.max(0, Math.min(10, Math.round(Number(judged.scores.logic)) || 0)),
        evidence: Math.max(0, Math.min(10, Math.round(Number(judged.scores.evidence)) || 0)),
        persuasiveness: Math.max(0, Math.min(10, Math.round(Number(judged.scores.persuasiveness)) || 0)),
      }
    : ZERO_SCORES;

  // Re-anchor citation_index so it always points into the citations array we actually return.
  let citation_index: number | null = null;
  const rawIdx = judged?.citation_index;
  if (usedJudgeCitations && typeof rawIdx === "number" && rawIdx >= 0 && rawIdx < citations.length) {
    citation_index = rawIdx;
  } else if (citations.length > 0) {
    citation_index = 0;
  }

  return {
    argument,
    key_claim: judged?.key_claim || argument.slice(0, 200),
    verdict,
    rationale: judged?.rationale || "",
    points: typeof judged?.points === "number" ? judged.points : SCORE[verdict],
    scores,
    fallacies: Array.isArray(judged?.fallacies)
      ? judged.fallacies.filter((f: unknown) => typeof f === "string" && (f as string).trim()).slice(0, 5)
      : [],
    citations,
    citation_index,
  };
}

// ---------- handler ----------
export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { room_id?: string; topic?: string; side_label?: string; round_no?: number; opponent_argument?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const topic = (body.topic ?? "").trim();
  const opponent_argument = (body.opponent_argument ?? "").trim();
  if (!topic) return json({ error: "Field 'topic' is required." }, 400);

  // 1. Search You.com from side B's angle (graceful: empty list if it fails).
  let citations: Citation[] = [];
  try {
    const query = await buildSearchQuery(topic, opponent_argument);
    citations = await searchYouCom(query);
  } catch {
    citations = [];
  }

  // 2. Write the rebuttal (graceful: local fallback if the gateway fails).
  let argument: string;
  try {
    argument = await writeRebuttal(topic, opponent_argument, citations);
    if (!argument) argument = fallbackArgument(topic, opponent_argument, citations);
  } catch {
    argument = fallbackArgument(topic, opponent_argument, citations);
  }

  // 3. Self-judge through the SAME judge pipeline so the wizard can get caught.
  //    judgePipeline runs its own fresh You.com search, so its citations are authoritative.
  try {
    const judged = await judgePipeline(argument, topic);
    if (judged && !("error" in judged)) {
      return json(shapeFromJudged(argument, judged, citations));
    }
  } catch { /* fall through to conservative default */ }

  // Judge unavailable: still return a valid, grounded shape. Rule conservatively
  // (unsupported, 0 pts) so the wizard never gets free points.
  const fallbackVerdict: Verdict = "unsupported";
  const result: WizardResult = {
    argument,
    key_claim: argument.slice(0, 200),
    verdict: fallbackVerdict,
    rationale: "Self-judge unavailable; ruled conservatively.",
    points: SCORE[fallbackVerdict],
    scores: ZERO_SCORES,
    fallacies: [],
    citations,
    citation_index: citations.length ? 0 : null,
  };
  return json(result);
}
