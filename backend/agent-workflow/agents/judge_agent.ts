import { buildJudgeUserPrompt, JUDGE_SYSTEM_PROMPT } from "../prompts/judge_prompt.ts";
import type { DebateScore, JudgeInput, JudgeResult } from "../types/judge.ts";
import { callModelJson } from "../utils/model_gateway.ts";

export async function runJudgeAgent(input: JudgeInput): Promise<JudgeResult> {
  const result = await callModelJson<JudgeResult>({
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt: buildJudgeUserPrompt(input),
    temperature: 0,
  });

  return normalizeJudgeResult(result);
}

function normalizeJudgeResult(result: JudgeResult): JudgeResult {
  const userScore = normalizeScore(result.user_score);
  const aiScore = normalizeScore(result.ai_score);
  const scoreDelta = Math.abs(userScore.total - aiScore.total);
  const winner = scoreDelta <= 3
    ? "tie"
    : userScore.total > aiScore.total
      ? "user"
      : "ai";

  return {
    user_score: userScore,
    ai_score: aiScore,
    winner,
    explanation: result.explanation,
  };
}

function normalizeScore(score: DebateScore): DebateScore {
  const factualAccuracy = clampDimension(score.factual_accuracy);
  const logicQuality = clampDimension(score.logic_quality);
  const evidenceStrength = clampDimension(score.evidence_strength);
  const persuasiveness = clampDimension(score.persuasiveness);

  return {
    factual_accuracy: factualAccuracy,
    logic_quality: logicQuality,
    evidence_strength: evidenceStrength,
    persuasiveness,
    total: factualAccuracy + logicQuality + evidenceStrength + persuasiveness,
  };
}

function clampDimension(value: unknown): number {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(25, numeric));
}

