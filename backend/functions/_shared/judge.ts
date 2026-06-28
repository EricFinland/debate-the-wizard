// _shared/judge.ts — the canonical judge pipeline shared across edge functions.
//
// Import with:
//   import { chat, searchYouCom, extractSearchQuery, judgeVerdict, judgePipeline }
//     from "../_shared/judge.ts";
//
// Why inlined here instead of calling the judge-claim HTTP endpoint?
// InsForge deploys all functions as ONE Deno deployment. A function fetching
// another function's URL at the same host trips Deno Deploy's 508 loop detector.
// Relative imports are bundled together and execute in-process — no HTTP call.

import { env, SCORE, ZERO_SCORES, Citation, Scores, Verdict } from "./config.ts";

// ---------- model config (read at import time, same as each function does) ----------
const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");
const SEARCH_COUNT = Number(env("SEARCH_COUNT", "6")) || 6;

// ---------- private helpers ----------

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/** Best-effort JSON parse out of an LLM reply that may include markdown fences. */
function parseJson<T>(text: string): T | null {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

/** Clamp an LLM-provided dimension score into [0, 10]. */
function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

// ---------- public API ----------

/**
 * Call the OpenRouter-compatible model gateway.
 * Uses OPENROUTER_API_KEY; response shape: choices[0].message.content.
 */
export async function chat(
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0,
): Promise<string> {
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

/** Fetch You.com Search results and normalize them to the Citation shape. */
export async function searchYouCom(query: string): Promise<Citation[]> {
  const key = env("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY not set.");

  const url = new URL("https://api.you.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(SEARCH_COUNT));

  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`You.com ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();

  const results: any[] = data?.results?.web ?? data?.web ?? data?.hits ?? data?.results ?? [];
  const newsResults: any[] = data?.results?.news ?? data?.news ?? [];
  const all = [...results, ...newsResults];

  const out: Citation[] = [];
  for (const r of all) {
    const snippetParts: string[] = Array.isArray(r?.snippets)
      ? r.snippets
      : [r?.snippet, r?.description].filter(Boolean);
    const snippet = snippetParts
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join(" ")
      .trim();
    const urlStr = String(r?.url ?? r?.link ?? "").trim();
    if (!urlStr || !snippet) continue;
    out.push({ title: String(r?.title ?? "").trim(), url: urlStr, snippet });
    if (out.length >= SEARCH_COUNT) break;
  }
  return out;
}

/**
 * Step 1: turn the raw argument into a tight, searchable factual claim.
 * Falls back to slicing the raw argument if the LLM call fails.
 */
export async function extractSearchQuery(argument: string, topic: string): Promise<string> {
  const sys =
    "You turn a debate argument into ONE concise web-search query (max 12 words) " +
    "targeting its single most important factual claim. Reply with ONLY the query text, no quotes.";
  const user = `TOPIC: ${topic || "(unspecified)"}\nARGUMENT: ${argument}`;
  try {
    const q = (await chat(EXTRACT_MODEL, [
      { role: "system", content: sys },
      { role: "user", content: user },
    ])).trim().replace(/^["']|["']$/g, "");
    return q || argument.slice(0, 200);
  } catch {
    return argument.slice(0, 200);
  }
}

/**
 * Step 2: extract the key claim, rule on it, and score every dimension — all in ONE LLM call.
 */
export async function judgeVerdict(
  argument: string,
  citations: Citation[],
): Promise<{
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  scores: Scores;
  fallacies: string[];
  citation_index: number | null;
}> {
  const snippetList = citations
    .map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`)
    .join("\n\n");

  const sys =
    "You are a debate fact-checker and scorer. Given an ARGUMENT and a list of SEARCH SNIPPETS:\n" +
    "1. Extract the single most important factual claim from the argument.\n" +
    "2. Rule on whether the snippets support that claim.\n" +
    "3. Score the argument on four dimensions (0-10 each).\n" +
    "4. Name any logical fallacies present.\n" +
    "Return ONLY JSON in exactly this shape:\n" +
    "{\n" +
    '  "key_claim": "...",\n' +
    '  "verdict": "supported" | "unsupported" | "misleading",\n' +
    '  "rationale": "<= 20 words",\n' +
    '  "citation_index": <int or null>,\n' +
    '  "scores": { "factual_accuracy": 0-10, "logic": 0-10, "evidence": 0-10, "persuasiveness": 0-10 },\n' +
    '  "fallacies": ["..."]\n' +
    "}\n" +
    "- supported: a snippet clearly backs the claim. - unsupported: no snippet addresses it. " +
    "- misleading: a snippet contradicts or undercuts it.\n" +
    "- factual_accuracy: how well the claim matches the snippets. evidence: strength/relevance of " +
    "the snippets cited. logic: soundness of reasoning. persuasiveness: rhetorical force.\n" +
    "- citation_index is the index of the snippet you relied on, or null. fallacies is [] if none.";

  const user = `ARGUMENT:\n${argument}\n\nSEARCH SNIPPETS:\n${snippetList || "(none found)"}`;

  const raw = await chat(JUDGE_MODEL, [
    { role: "system", content: sys },
    { role: "user", content: user },
  ]);

  const parsed = parseJson<{
    key_claim: string;
    verdict: string;
    rationale: string;
    citation_index: number | null;
    scores?: Partial<Scores>;
    fallacies?: string[];
  }>(raw);

  if (!parsed) {
    return {
      key_claim: argument.slice(0, 200),
      verdict: "unsupported",
      rationale: "Judge response could not be parsed.",
      scores: ZERO_SCORES,
      fallacies: [],
      citation_index: null,
    };
  }

  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(
    parsed.verdict as Verdict,
  )
    ? (parsed.verdict as Verdict)
    : "unsupported";

  const ci =
    typeof parsed.citation_index === "number" &&
    parsed.citation_index >= 0 &&
    parsed.citation_index < citations.length
      ? parsed.citation_index
      : null;

  const scores: Scores = {
    factual_accuracy: clampScore(parsed.scores?.factual_accuracy),
    logic: clampScore(parsed.scores?.logic),
    evidence: clampScore(parsed.scores?.evidence),
    persuasiveness: clampScore(parsed.scores?.persuasiveness),
  };

  const fallacies = Array.isArray(parsed.fallacies)
    ? parsed.fallacies.filter((f) => typeof f === "string" && f.trim()).slice(0, 5)
    : [];

  return {
    key_claim: parsed.key_claim || argument.slice(0, 200),
    verdict,
    rationale: parsed.rationale || "",
    scores,
    fallacies,
    citation_index: ci,
  };
}

/**
 * Full judge pipeline: search → extract → judge.
 * Returns the same shape as the judge-claim HTTP endpoint.
 */
export async function judgePipeline(argument: string, topic: string) {
  const search_query = await extractSearchQuery(argument, topic);

  let citations: Citation[] = [];
  try {
    citations = await searchYouCom(search_query);
  } catch {
    citations = [];
  }

  if (!citations.length) {
    return {
      key_claim: search_query,
      verdict: "unsupported" as Verdict,
      rationale: "No sources found to support this claim.",
      points: SCORE.unsupported,
      scores: ZERO_SCORES,
      fallacies: [] as string[],
      citations: [] as Citation[],
      citation_index: null as number | null,
      search_query,
    };
  }

  const r = await judgeVerdict(argument, citations);
  return {
    key_claim: r.key_claim,
    verdict: r.verdict,
    rationale: r.rationale,
    points: SCORE[r.verdict],
    scores: r.scores,
    fallacies: r.fallacies,
    citations,
    citation_index: r.citation_index,
    search_query,
  };
}
