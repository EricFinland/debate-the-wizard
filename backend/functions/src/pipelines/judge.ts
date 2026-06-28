import type { Citation, JudgeResult, Scores, Verdict } from "../../../../shared/contracts/debate";
import { clampScore, SCORE, ZERO_SCORES, normalizeVerdict } from "../domain/scoring";
import { config } from "../shared/env";
import { chat } from "../shared/model";
import { searchYouCom } from "../shared/search";
import { parseModelJson } from "../utils/json";

export interface JudgedClaim extends JudgeResult {
  search_query: string;
}

export async function extractSearchQuery(argument: string, topic: string): Promise<string> {
  const system =
    "You turn a debate argument into ONE concise web-search query (max 12 words) targeting its single most important factual claim. Reply with ONLY the query text, no quotes.";
  try {
    const query = (
      await chat(config.extractModel(), [
        { role: "system", content: system },
        { role: "user", content: `TOPIC: ${topic || "(unspecified)"}\nARGUMENT: ${argument}` },
      ])
    )
      .trim()
      .replace(/^["']|["']$/g, "");
    return query || argument.slice(0, 200);
  } catch {
    return argument.slice(0, 200);
  }
}

export function normalizeScores(scores?: Partial<Scores>): Scores {
  return {
    factual_accuracy: clampScore(scores?.factual_accuracy),
    logic: clampScore(scores?.logic),
    evidence: clampScore(scores?.evidence),
    persuasiveness: clampScore(scores?.persuasiveness),
  };
}

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
  const snippets = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const system =
    'You are a debate fact-checker and scorer. Given an ARGUMENT and SEARCH SNIPPETS: 1) extract the single most important factual claim; 2) rule supported/unsupported/misleading; 3) score 0-10 on factual_accuracy, logic, evidence, persuasiveness; 4) name any fallacies. Return ONLY JSON: {"key_claim":"...","verdict":"supported|unsupported|misleading","rationale":"<=20 words","citation_index":<int or null>,"scores":{"factual_accuracy":0,"logic":0,"evidence":0,"persuasiveness":0},"fallacies":[]}. supported = a snippet clearly backs the claim; unsupported = none addresses it; misleading = a snippet contradicts it. citation_index is the snippet you relied on, or null.';

  const raw = await chat(config.judgeModel(), [
    { role: "system", content: system },
    { role: "user", content: `ARGUMENT:\n${argument}\n\nSEARCH SNIPPETS:\n${snippets || "(none found)"}` },
  ]);
  const parsed = parseModelJson<{
    key_claim?: string;
    verdict?: string;
    rationale?: string;
    citation_index?: number | null;
    scores?: Partial<Scores>;
    fallacies?: unknown[];
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

  const citationIndex =
    typeof parsed.citation_index === "number" &&
    parsed.citation_index >= 0 &&
    parsed.citation_index < citations.length
      ? parsed.citation_index
      : null;

  return {
    key_claim: parsed.key_claim || argument.slice(0, 200),
    verdict: normalizeVerdict(parsed.verdict),
    rationale: parsed.rationale || "",
    scores: normalizeScores(parsed.scores),
    fallacies: Array.isArray(parsed.fallacies)
      ? parsed.fallacies.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 5)
      : [],
    citation_index: citationIndex,
  };
}

export async function judgePipeline(argument: string, topic: string): Promise<JudgedClaim> {
  const query = await extractSearchQuery(argument, topic);
  let citations: Citation[] = [];
  try {
    citations = await searchYouCom(query);
  } catch {
    citations = [];
  }

  if (!citations.length) {
    return {
      key_claim: query,
      verdict: "unsupported",
      rationale: "No sources found to support this claim.",
      points: SCORE.unsupported,
      scores: ZERO_SCORES,
      fallacies: [],
      citations: [],
      citation_index: null,
      search_query: query,
    };
  }

  const ruling = await judgeVerdict(argument, citations);
  return {
    key_claim: ruling.key_claim,
    verdict: ruling.verdict,
    rationale: ruling.rationale,
    points: SCORE[ruling.verdict],
    scores: ruling.scores,
    fallacies: ruling.fallacies,
    citations,
    citation_index: ruling.citation_index,
    search_query: query,
  };
}
