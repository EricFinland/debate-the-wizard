import type { Difficulty, Scores, Verdict } from "../../../../shared/contracts/debate";

export const SCORE: Record<Verdict, number> = {
  supported: 10,
  unsupported: 0,
  misleading: -5,
};

export const ZERO_SCORES: Scores = {
  factual_accuracy: 0,
  logic: 0,
  evidence: 0,
  persuasiveness: 0,
};

export const DIFFICULTIES: readonly Difficulty[] = ["novice", "adept", "archmage"] as const;

export function normalizeDifficulty(value: unknown): Difficulty {
  const normalized = String(value ?? "").toLowerCase();
  return DIFFICULTIES.includes(normalized as Difficulty) ? (normalized as Difficulty) : "adept";
}

export function clampScore(value: unknown): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return 0;
  return Math.max(0, Math.min(10, rounded));
}

export function normalizeVerdict(value: unknown): Verdict {
  return value === "supported" || value === "misleading" || value === "unsupported" ? value : "unsupported";
}
