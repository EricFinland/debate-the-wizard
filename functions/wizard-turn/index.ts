// wizard-turn — the wizard's brain.
//
// The wizard always argues the AGAINST side (side B) of the topic. This function:
//   1. Searches You.com from side B's angle (rebutting opponent_argument if present)
//      so the wizard's strongest point is GROUNDED in a real, citable snippet.
//   2. Asks Claude (via the InsForge Model Gateway) to write a PUNCHY 2-3 sentence
//      rebuttal that must lean on one of those snippets and never invent facts.
//   3. Self-judges by calling the deployed judge-claim function over HTTP, so the
//      wizard is held to the SAME standard as the human and can get caught.
//
// Returns the FULL judged shape so advance-wizard can trust it and skip re-judging:
//   { argument, key_claim, verdict, rationale, points, scores, fallacies, citations, citation_index }
//
// Pure (no DB, no realtime): take inputs, call You.com + Claude + judge-claim, return JSON.
//
// Deploy:
//   npx @insforge/cli functions deploy wizard-turn \
//     --file functions/wizard-turn/index.ts \
//     --name "Wizard turn"
//
// Secrets it needs (npx @insforge/cli secrets add <KEY> <value>):
//   YOUCOM_API_KEY    - You.com Search API key (X-API-Key)
//   INSFORGE_API_URL  - e.g. https://<project>.insforge.dev (model gateway + functions host)
//   INSFORGE_API_KEY  - project key (gateway bearer token + judge-claim auth)
// Optional:
//   JUDGE_MODEL       - default anthropic/claude-3.5-sonnet (used to WRITE the rebuttal)
//   EXTRACT_MODEL     - default anthropic/claude-3.5-haiku (used to build the search query)
//   SEARCH_COUNT      - default 6

// ---------- config ----------
const SCORE = { supported: 10, unsupported: 0, misleading: -5 } as const;
type Verdict = keyof typeof SCORE;

const env = (k: string, fallback = "") => Deno.env.get(k) ?? fallback;

const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");
const SEARCH_COUNT = Number(env("SEARCH_COUNT", "6")) || 6;

const BASE = env("INSFORGE_API_URL").replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// ---------- types ----------
interface Citation {
  title: string;
  url: string;
  snippet: string;
}
interface Scores {
  factual_accuracy: number;
  logic: number;
  evidence: number;
  persuasiveness: number;
}
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

const ZERO_SCORES: Scores = { factual_accuracy: 0, logic: 0, evidence: 0, persuasiveness: 0 };

/** Clamp an LLM-provided dimension score into 0-10 (same rule as judge-claim). */
function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

// ---------- helpers ----------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/** Best-effort JSON parse out of an LLM reply. */
function parseJson<T>(text: string): T | null {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch { /* fall through */ }
    }
    return null;
  }
}

/** Call the model gateway — OpenRouter, using the InsForge-provisioned key. */
async function chat(model: string, messages: { role: string; content: string }[], temperature = 0.6): Promise<string> {
  const key = env("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not configured.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Hit You.com Search (GET) and normalize to citations (same shape/handling as judge-claim). */
async function searchYouCom(query: string): Promise<Citation[]> {
  const key = env("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY not set.");

  const url = new URL("https://api.you.com/v1/search");
  url.searchParams.set("query", query);
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`You.com ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();

  const web: any[] = data?.results?.web ?? data?.web ?? data?.hits ?? data?.results ?? [];
  const out: Citation[] = [];
  for (const r of web) {
    const snippets: string[] = r?.snippets ?? (r?.snippet ? [r.snippet] : (r?.description ? [r.description] : []));
    const snippet = snippets.filter(Boolean).join(" ").trim();
    if (!snippet) continue;
    out.push({
      title: String(r?.title ?? "").trim(),
      url: String(r?.url ?? r?.link ?? "").trim(),
      snippet,
    });
    if (out.length >= SEARCH_COUNT) break;
  }
  return out;
}

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

/** Build a search query targeting the argument's key factual claim. */
async function extractSearchQuery(argument: string, topic: string): Promise<string> {
  const sys = "You turn a debate argument into ONE concise web-search query (max 12 words) targeting its single most important factual claim. Reply with ONLY the query text, no quotes.";
  try {
    const q = (await chat(EXTRACT_MODEL, [{ role: "system", content: sys }, { role: "user", content: `TOPIC: ${topic || "(unspecified)"}\nARGUMENT: ${argument}` }], 0.2)).trim().replace(/^["']|["']$/g, "");
    return q || argument.slice(0, 200);
  } catch { return argument.slice(0, 200); }
}

/** The judge call: extract claim + rule + score against the snippets. */
async function judgeVerdict(argument: string, citations: Citation[]) {
  const list = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const sys = 'You are a debate fact-checker and scorer. Given an ARGUMENT and SEARCH SNIPPETS: 1) extract the single most important factual claim; 2) rule supported/unsupported/misleading; 3) score 0-10 on factual_accuracy, logic, evidence, persuasiveness; 4) name any fallacies. Return ONLY JSON: {"key_claim":"...","verdict":"supported|unsupported|misleading","rationale":"<=20 words","citation_index":<int or null>,"scores":{"factual_accuracy":0,"logic":0,"evidence":0,"persuasiveness":0},"fallacies":[]}. supported = a snippet clearly backs the claim; unsupported = none addresses it; misleading = a snippet contradicts it.';
  const raw = await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: `ARGUMENT:\n${argument}\n\nSEARCH SNIPPETS:\n${list || "(none found)"}` }], 0);
  const p = parseJson<any>(raw);
  if (!p) return { key_claim: argument.slice(0, 200), verdict: "unsupported" as Verdict, rationale: "Judge response could not be parsed.", scores: ZERO_SCORES, fallacies: [] as string[], citation_index: null as number | null };
  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(p.verdict) ? p.verdict : "unsupported";
  const ci = typeof p.citation_index === "number" && p.citation_index >= 0 && p.citation_index < citations.length ? p.citation_index : null;
  return {
    key_claim: p.key_claim || argument.slice(0, 200), verdict, rationale: p.rationale || "",
    scores: { factual_accuracy: clampScore(p.scores?.factual_accuracy), logic: clampScore(p.scores?.logic), evidence: clampScore(p.scores?.evidence), persuasiveness: clampScore(p.scores?.persuasiveness) },
    fallacies: Array.isArray(p.fallacies) ? p.fallacies.filter((f: unknown) => typeof f === "string" && (f as string).trim()).slice(0, 5) : [],
    citation_index: ci,
  };
}

/** Self-judge INLINE (no function-to-function call — InsForge runs all funcs as one deployment). */
async function selfJudge(argument: string, topic: string): Promise<any | null> {
  try {
    const query = await extractSearchQuery(argument, topic);
    let citations: Citation[] = [];
    try { citations = await searchYouCom(query); } catch { citations = []; }
    if (!citations.length) return { key_claim: query, verdict: "unsupported", rationale: "No sources found to support this claim.", points: SCORE.unsupported, scores: ZERO_SCORES, fallacies: [], citations: [], citation_index: null };
    const r = await judgeVerdict(argument, citations);
    return { key_claim: r.key_claim, verdict: r.verdict, rationale: r.rationale, points: SCORE[r.verdict], scores: r.scores, fallacies: r.fallacies, citations, citation_index: r.citation_index };
  } catch {
    return null;
  }
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

/** Normalize a judge-claim response into the full wizard result shape. */
function shapeFromJudged(argument: string, judged: any, fallbackCitations: Citation[]): WizardResult {
  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(judged?.verdict)
    ? judged.verdict
    : "unsupported";

  // Prefer the judge's own (authoritative) citations; only fall back to the
  // wizard's search results if the judge returned none, so the screen always
  // shows You.com citations.
  const judgeCitations: Citation[] = Array.isArray(judged?.citations) ? judged.citations : [];
  const usedJudgeCitations = judgeCitations.length > 0;
  const citations: Citation[] = usedJudgeCitations ? judgeCitations : fallbackCitations;

  const scores: Scores = judged?.scores && typeof judged.scores === "object"
    ? {
        factual_accuracy: clampScore(judged.scores.factual_accuracy),
        logic: clampScore(judged.scores.logic),
        evidence: clampScore(judged.scores.evidence),
        persuasiveness: clampScore(judged.scores.persuasiveness),
      }
    : ZERO_SCORES;

  // Re-anchor citation_index so it ALWAYS points into the `citations` array we
  // actually return. The judge's index is only valid against the judge's own
  // citations; if we swapped in fallback citations it is meaningless. Keep the
  // citation link prominent: when valid, use it; when we fell back to wizard
  // search results, point at the first one so the UI still highlights a source.
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
    fallacies: Array.isArray(judged?.fallacies) ? judged.fallacies.filter((f: unknown) => typeof f === "string" && (f as string).trim()).slice(0, 5) : [],
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

  // 3. Self-judge through the SAME judge-claim pipeline so the wizard can get caught.
  //    judge-claim runs its own fresh You.com search, so its citations are authoritative.
  const judged = await selfJudge(argument, topic);

  if (judged && !judged.error) {
    return json(shapeFromJudged(argument, judged, citations));
  }

  // Judge unavailable: still return a valid, grounded shape. advance-wizard will
  // see verdict is a string and trust it; if it preferred to re-judge it still can.
  // We rule conservatively (unsupported, 0 pts) so the wizard never gets free points.
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
