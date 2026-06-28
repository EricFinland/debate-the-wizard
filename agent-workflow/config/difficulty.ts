/** Single source of truth for difficulty tiers and their self-check thresholds. */

export type Difficulty = "novice" | "adept" | "archmage" | "impossible";

export const DIFFICULTIES: readonly Difficulty[] = [
  "novice",
  "adept",
  "archmage",
  "impossible",
] as const;

/**
 * Minimum confidence score the model must report for the self-check to pass.
 * Higher difficulty = higher bar = the wizard must produce a sharper rebuttal.
 */
export const DIFFICULTY_CONFIDENCE: Record<Difficulty, number> = {
  novice: 0.6,
  adept: 0.7,
  archmage: 0.8,
  impossible: 0.9,
};

/** Returns the MIN_CONFIDENCE threshold for the given difficulty (defaults to adept). */
export function getMinConfidence(difficulty?: Difficulty): number {
  return DIFFICULTY_CONFIDENCE[difficulty ?? "adept"];
}
