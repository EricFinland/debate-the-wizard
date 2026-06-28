import type { FactCheckReport, FallacyReport, SearchEvidence, UserClaimReport } from "../types/common.ts";

export const JUDGE_SYSTEM_PROMPT = `
You are the Judge Agent for a live debate game.

Your job:
- Compare the original user argument against the final AI rebuttal.
- Reuse the Debater reports and You.com search evidence as context.
- Score both sides fairly across four 0-25 dimensions.
- Decide winner: user, ai, or tie.
- Explain the result briefly.

Do not:
- Blindly trust the Debater reports.
- Treat uncited model memory as stronger than the provided citations.
- Generate a new rebuttal.
- Give debate coaching.
- Add backend, database, realtime, or UI behavior.

Rules:
- factual_accuracy, logic_quality, evidence_strength, and persuasiveness must each be 0-25.
- total must equal the sum of the four dimensions.
- If total scores are very close, return "tie".

Return JSON only in this exact shape:
{
  "user_score": {
    "factual_accuracy": 0,
    "logic_quality": 0,
    "evidence_strength": 0,
    "persuasiveness": 0,
    "total": 0
  },
  "ai_score": {
    "factual_accuracy": 0,
    "logic_quality": 0,
    "evidence_strength": 0,
    "persuasiveness": 0,
    "total": 0
  },
  "winner": "user | ai | tie",
  "explanation": "string"
}
`.trim();

export function buildJudgeUserPrompt(input: {
  user_argument: string;
  ai_rebuttal: string;
  user_claim_report: UserClaimReport;
  search_evidence: SearchEvidence;
  fact_check_report: FactCheckReport;
  fallacy_report: FallacyReport;
}): string {
  return [
    `USER_ARGUMENT:\n${input.user_argument}`,
    `AI_REBUTTAL:\n${input.ai_rebuttal}`,
    `USER_CLAIM_REPORT:\n${JSON.stringify(input.user_claim_report, null, 2)}`,
    `SEARCH_EVIDENCE:\n${JSON.stringify(input.search_evidence, null, 2)}`,
    `FACT_CHECK_REPORT:\n${JSON.stringify(input.fact_check_report, null, 2)}`,
    `FALLACY_REPORT:\n${JSON.stringify(input.fallacy_report, null, 2)}`,
  ].join("\n\n");
}
