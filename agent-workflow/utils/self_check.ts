import type { DebaterSynthesis } from "../types/debater.ts";
import type { Difficulty } from "../config/difficulty.ts";
import { getMinConfidence } from "../config/difficulty.ts";

export interface SelfCheckResult {
  passed: boolean;
  issues: string[];
}

const MAX_REBUTTAL_WORDS = 180;

export function selfCheckRebuttal(userArgument: string, synthesis: DebaterSynthesis, difficulty?: Difficulty): SelfCheckResult {
  const issues: string[] = [];
  const rebuttal = synthesis.ai_rebuttal?.trim() ?? "";

  if (!rebuttal) {
    issues.push("Rebuttal is empty.");
  }

  if (wordCount(rebuttal) > MAX_REBUTTAL_WORDS) {
    issues.push(`Rebuttal is too long; keep it under ${MAX_REBUTTAL_WORDS} words.`);
  }

  if (!addressesUserArgument(userArgument, rebuttal)) {
    issues.push("Rebuttal does not clearly address the user argument.");
  }

  if (!Array.isArray(synthesis.strongest_counterpoints) || synthesis.strongest_counterpoints.length === 0) {
    issues.push("Rebuttal has no clear counterpoint.");
  }

  if (!Number.isFinite(synthesis.confidence) || synthesis.confidence < getMinConfidence(difficulty)) {
    issues.push(`Confidence is too low; expected at least ${getMinConfidence(difficulty)}.`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function addressesUserArgument(userArgument: string, rebuttal: string): boolean {
  const userTerms = new Set(
    userArgument
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 4),
  );
  const rebuttalText = rebuttal.toLowerCase();
  let matches = 0;

  for (const term of userTerms) {
    if (rebuttalText.includes(term)) matches += 1;
    if (matches >= 2) return true;
  }

  return userTerms.size <= 1 ? rebuttal.trim().length > 0 : false;
}

