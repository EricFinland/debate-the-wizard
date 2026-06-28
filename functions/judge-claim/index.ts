// judge-claim — the heart of Debate the Wizard.
//
// Takes an argument, grounds it in fresh You.com search results, and asks Claude
// (via the InsForge Model Gateway) to extract the single key factual claim and
// rule on whether the sources support it.
//
// This is the SAME pipeline used for both the player and the wizard — build it
// once, call it twice. Keep it self-contained: InsForge deploys a single source
// file per function (`functions deploy <slug> --file <path>`).
//
// Deploy:
//   npx @insforge/cli functions deploy judge-claim \
//     --file functions/judge-claim/index.ts \
//     --name "Judge a claim"
//
// Secrets it needs (npx @insforge/cli secrets add <KEY> <value>):
//   YOUCOM_API_KEY    - You.com Search API key (X-API-Key)
//   INSFORGE_API_URL  - e.g. https://<project>.insforge.dev  (model gateway base)
//   INSFORGE_API_KEY  - project key used as the gateway bearer token
// Optional:
//   JUDGE_MODEL       - default anthropic/claude-3.5-sonnet
//   EXTRACT_MODEL     - default anthropic/claude-3.5-haiku
//   SEARCH_COUNT      - default 6

// ---------- config ----------
const SCORE = { supported: 10, unsupported: 0, misleading: -5 } as const;
type Verdict = keyof typeof SCORE;

const env = (k: string, fallback = "") => Deno.env.get(k) ?? fallback;

const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");
const SEARCH_COUNT = Number(env("SEARCH_COUNT", "6")) || 6;

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
/** Per-claim scorecard (0-10 each) — multi-dimension judging in ONE call. */
interface Scores {
  factual_accuracy: number;
  logic: number;
  evidence: number;
  persuasiveness: number;
}
interface JudgeResult {
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  points: number;
  scores: Scores;
  fallacies: string[]; // e.g. ["straw man", "ad hominem"]; [] if none
  citations: Citation[];
  citation_index: number | null;
}

const ZERO_SCORES: Scores = { factual_accuracy: 0, logic: 0, evidence: 0, persuasiveness: 0 };

/** Clamp an LLM-provided dimension score into 0-10. */
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
async function chat(model: string, messages: { role: string; content: string }[], temperature = 0): Promise<string> {
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

/** Hit You.com Search (GET) and normalize to citations. */
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

  // Normalize defensively across possible response shapes.
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

/** Step 1: turn the raw argument into a tight, searchable factual claim. */
async function extractSearchQuery(argument: string, topic: string): Promise<string> {
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
    return argument.slice(0, 200); // fall back to searching the argument directly
  }
}

/** Step 2: the Judge — extract the key claim, rule, and score every dimension in ONE call. */
async function judge(
  argument: string,
  citations: Citation[],
): Promise<{ key_claim: string; verdict: Verdict; rationale: string; scores: Scores; fallacies: string[]; citation_index: number | null }> {
  const snippetList = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
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
    "- supported: a snippet clearly backs the claim. - unsupported: no snippet addresses it. - misleading: a snippet contradicts or undercuts it.\n" +
    "- factual_accuracy: how well the claim matches the snippets. evidence: strength/relevance of the snippets cited. logic: soundness of reasoning. persuasiveness: rhetorical force.\n" +
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
    return { key_claim: argument.slice(0, 200), verdict: "unsupported", rationale: "Judge response could not be parsed.", scores: ZERO_SCORES, fallacies: [], citation_index: null };
  }
  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(parsed.verdict as Verdict)
    ? (parsed.verdict as Verdict)
    : "unsupported";
  const ci = typeof parsed.citation_index === "number" && parsed.citation_index >= 0 && parsed.citation_index < citations.length
    ? parsed.citation_index
    : null;
  const scores: Scores = {
    factual_accuracy: clampScore(parsed.scores?.factual_accuracy),
    logic: clampScore(parsed.scores?.logic),
    evidence: clampScore(parsed.scores?.evidence),
    persuasiveness: clampScore(parsed.scores?.persuasiveness),
  };
  const fallacies = Array.isArray(parsed.fallacies) ? parsed.fallacies.filter((f) => typeof f === "string" && f.trim()).slice(0, 5) : [];
  return {
    key_claim: parsed.key_claim || argument.slice(0, 200),
    verdict,
    rationale: parsed.rationale || "",
    scores,
    fallacies,
    citation_index: ci,
  };
}

// ---------- handler ----------
export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { argument?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const argument = (body.argument ?? "").trim();
  const topic = (body.topic ?? "").trim();
  if (!argument) return json({ error: "Field 'argument' is required." }, 400);

  try {
    const query = await extractSearchQuery(argument, topic);
    const citations = await searchYouCom(query);

    // Fallback verdict path: no sources => rule unsupported gracefully, never error on stage.
    if (citations.length === 0) {
      const result: JudgeResult = {
        key_claim: query,
        verdict: "unsupported",
        rationale: "No sources found to support this claim.",
        points: SCORE.unsupported,
        scores: ZERO_SCORES,
        fallacies: [],
        citations: [],
        citation_index: null,
      };
      return json(result);
    }

    const ruling = await judge(argument, citations);
    const result: JudgeResult = {
      key_claim: ruling.key_claim,
      verdict: ruling.verdict,
      rationale: ruling.rationale,
      points: SCORE[ruling.verdict], // base game score comes from the verdict; the scorecard is for display/tiebreak
      scores: ruling.scores,
      fallacies: ruling.fallacies,
      citations,
      citation_index: ruling.citation_index,
    };
    return json(result);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
