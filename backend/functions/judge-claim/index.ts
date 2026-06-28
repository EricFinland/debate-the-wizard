// judge-claim — the heart of Debate the Wizard.
//
// Takes an argument, grounds it in fresh You.com search results, and asks Claude
// (via OpenRouter) to extract the single key factual claim and rule on whether
// the sources support it.
//
// This is the SAME pipeline used for both the player and the wizard — defined
// once in ../_shared/judge.ts and imported here and by submit-argument /
// advance-wizard.
//
// Deploy:
//   npx @insforge/cli functions deploy judge-claim \
//     --file backend/functions/judge-claim/index.ts \
//     --name "Judge a claim"
//
// Secrets it needs (npx @insforge/cli secrets add <KEY> <value>):
//   OPENROUTER_API_KEY - OpenRouter bearer token
//   YOUCOM_API_KEY     - You.com Search API key (X-API-Key)
// Optional:
//   JUDGE_MODEL        - default anthropic/claude-sonnet-4.6
//   EXTRACT_MODEL      - default anthropic/claude-haiku-4.5
//   SEARCH_COUNT       - default 6

import { CORS, SCORE, ZERO_SCORES, json, type Citation, type Scores, type Verdict } from "../_shared/config.ts";
import { extractSearchQuery, judgeVerdict, searchYouCom } from "../_shared/judge.ts";

// ---------- types ----------
interface JudgeResult {
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  points: number;
  scores: Scores;
  fallacies: string[];
  citations: Citation[];
  citation_index: number | null;
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
    const search_query = await extractSearchQuery(argument, topic);
    const citations = await searchYouCom(search_query);

    // Fallback verdict path: no sources => rule unsupported gracefully, never error on stage.
    if (citations.length === 0) {
      const result: JudgeResult = {
        key_claim: search_query,
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

    const ruling = await judgeVerdict(argument, citations);
    const result: JudgeResult = {
      key_claim: ruling.key_claim,
      verdict: ruling.verdict,
      rationale: ruling.rationale,
      points: SCORE[ruling.verdict],
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
