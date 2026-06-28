import type { Citation, Difficulty, Scores, Verdict, WizardResult } from "../../../../shared/contracts/debate";
import { clampScore, SCORE, ZERO_SCORES } from "../domain/scoring";
import { config } from "../shared/env";
import { chat } from "../shared/model";
import { searchYouCom } from "../shared/search";
import { judgePipeline } from "./judge";

const DIFFICULTY_STYLE: Record<Difficulty, { persona: string; temp: number }> = {
  novice: {
    persona:
      'You are a NOVICE apprentice wizard, still unsure of your craft. Argue the AGAINST side but be tentative and HEDGED: use softeners like "I think", "maybe", "it could be". You are prone to WEAK or OVER-REACHING points and you often lean on a snippet loosely rather than nailing it. Keep it to 2-3 plain sentences.',
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
};

export async function buildAgainstQuery(topic: string, opponentArgument: string): Promise<string> {
  const system =
    "You craft ONE concise web-search query (max 12 words) to find EVIDENCE AGAINST a debate topic (the opposing side). If an OPPONENT ARGUMENT is given, target evidence that rebuts it. Reply with ONLY the query text, no quotes.";
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opponentArgument ? `OPPONENT ARGUMENT (to rebut): ${opponentArgument}` : "OPPONENT ARGUMENT: (none yet)");
  const fallback = (topic ? `${topic} criticism counterargument evidence` : "counterargument evidence").slice(0, 200);

  try {
    const query = (
      await chat(config.extractModel(), [
        { role: "system", content: system },
        { role: "user", content: user },
      ], 0.3)
    )
      .trim()
      .replace(/^["']|["']$/g, "");
    return query || fallback;
  } catch {
    return fallback;
  }
}

export async function writeRebuttal(
  topic: string,
  opponentArgument: string,
  citations: Citation[],
  difficulty: Difficulty,
): Promise<string> {
  const snippets = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const style = DIFFICULTY_STYLE[difficulty];
  const system = `${style.persona} ALWAYS argue the AGAINST side of the topic. NEVER invent facts; only use what the SEARCH SNIPPETS provide. If an OPPONENT ARGUMENT is given, directly rebut it. Plain prose only, no markdown or preamble. Just the rebuttal.`;
  const user =
    `TOPIC: ${topic || "(unspecified)"}\n` +
    (opponentArgument ? `OPPONENT ARGUMENT (rebut this): ${opponentArgument}\n` : "") +
    `\nSEARCH SNIPPETS (ground your point in one):\n${snippets || "(none found)"}`;

  return (
    await chat(config.judgeModel(), [
      { role: "system", content: system },
      { role: "user", content: user },
    ], style.temp)
  ).trim();
}

export async function writeTaunt(topic: string, argument: string, difficulty: Difficulty): Promise<string> {
  const tone = difficulty === "novice" ? "a little unsure of yourself" : difficulty === "archmage" ? "supremely arrogant" : "smug and confident";
  const system = `You are a debate Wizard who just delivered a rebuttal. Write ONE short in-character taunt sentence (max 18 words), themed to the debate TOPIC with wizard/arcane flavor. Be ${tone}. No profanity, no markdown, no quotes. Output ONLY the taunt.`;
  try {
    return (
      await chat(config.judgeModel(), [
        { role: "system", content: system },
        { role: "user", content: `TOPIC: ${topic || "(unspecified)"}\nMY REBUTTAL: ${argument}` },
      ], 0.9)
    )
      .trim()
      .replace(/^["']|["']$/g, "")
      .split("\n")[0]
      .slice(0, 200);
  } catch {
    return "";
  }
}

export function fallbackArgument(topic: string, citations: Citation[]): string {
  const cited = citations.find((citation) => citation.snippet);
  if (cited?.snippet) {
    return `The case for "${topic || "this position"}" overlooks serious counter-evidence: ${cited.snippet.slice(0, 220)} That alone should give us pause.`;
  }
  return `"${topic || "This position"}" is far less settled than it sounds. The opposing side rests on contested premises, and the burden of proof has not been met.`;
}

export function shapeWizardFallback(argument: string, citations: Citation[]): WizardResult {
  return {
    argument,
    key_claim: argument.slice(0, 200),
    verdict: "unsupported",
    rationale: "Self-judge unavailable; ruled conservatively.",
    points: SCORE.unsupported,
    scores: ZERO_SCORES,
    fallacies: [],
    citations,
    citation_index: citations.length ? 0 : null,
    search_query: null,
    taunt: null,
  };
}

export function normalizeWizardJudgment(argument: string, judged: Partial<WizardResult>, fallbackCitations: Citation[], taunt: string): WizardResult {
  const judgeCitations = Array.isArray(judged.citations) ? judged.citations : [];
  const usedJudgeCitations = judgeCitations.length > 0;
  const citations = usedJudgeCitations ? judgeCitations : fallbackCitations;
  const verdict: Verdict =
    judged.verdict === "supported" || judged.verdict === "misleading" || judged.verdict === "unsupported"
      ? judged.verdict
      : "unsupported";
  const scores: Scores = judged.scores
    ? {
        factual_accuracy: clampScore(judged.scores.factual_accuracy),
        logic: clampScore(judged.scores.logic),
        evidence: clampScore(judged.scores.evidence),
        persuasiveness: clampScore(judged.scores.persuasiveness),
      }
    : ZERO_SCORES;

  let citationIndex: number | null = null;
  if (
    usedJudgeCitations &&
    typeof judged.citation_index === "number" &&
    judged.citation_index >= 0 &&
    judged.citation_index < citations.length
  ) {
    citationIndex = judged.citation_index;
  } else if (citations.length) {
    citationIndex = 0;
  }

  return {
    argument,
    key_claim: judged.key_claim || argument.slice(0, 200),
    verdict,
    rationale: judged.rationale || "",
    points: typeof judged.points === "number" ? judged.points : SCORE[verdict],
    scores,
    fallacies: Array.isArray(judged.fallacies)
      ? judged.fallacies.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 5)
      : [],
    citations,
    citation_index: citationIndex,
    search_query: judged.search_query ?? null,
    taunt: taunt || null,
  };
}

export async function wizardPipeline(topic: string, opponentArgument: string, difficulty: Difficulty): Promise<WizardResult> {
  let grounding: Citation[] = [];
  try {
    grounding = await searchYouCom(await buildAgainstQuery(topic, opponentArgument));
  } catch {
    grounding = [];
  }

  let argument: string;
  try {
    argument = (await writeRebuttal(topic, opponentArgument, grounding, difficulty)) || fallbackArgument(topic, grounding);
  } catch {
    argument = fallbackArgument(topic, grounding);
  }

  const taunt = await writeTaunt(topic, argument, difficulty);
  try {
    const judged = await judgePipeline(argument, topic);
    return normalizeWizardJudgment(argument, judged, grounding, taunt);
  } catch {
    return { ...shapeWizardFallback(argument, grounding), taunt: taunt || null };
  }
}
