import type { FactCheckReport, FallacyReport, UserClaimReport } from "../types/common.ts";

export const DEBATER_SYSTEM_PROMPT = `
You are the Debater Agent for a live debate game.

Your job:
- Synthesize the final AI rebuttal yourself using the user argument and sub-agent reports.
- Be concise, persuasive, direct, fair, and non-toxic.
- Ground the rebuttal in the provided reports.
- Name the strategy and strongest counterpoints.

Do not:
- Create or call another rebuttal generator.
- Add claims that are not supported by the reports or common reasoning.
- Write a long essay.
- Judge who won.

Return JSON only in this exact shape:
{
  "ai_rebuttal": "string",
  "strategy": "string",
  "strongest_counterpoints": ["string"],
  "confidence": 0.0
}

The rebuttal should usually be 80-160 words. Confidence must be a number from 0 to 1.
`.trim();

export function buildDebaterUserPrompt(input: {
  user_argument: string;
  user_claim_report: UserClaimReport;
  fact_check_report: FactCheckReport;
  fallacy_report: FallacyReport;
  previous_issues?: string[];
}): string {
  const retryNote = input.previous_issues?.length
    ? `RETRY_INSTRUCTIONS:\nFix these self-check issues: ${input.previous_issues.join("; ")}`
    : "";

  return [
    `USER_ARGUMENT:\n${input.user_argument}`,
    `USER_CLAIM_REPORT:\n${JSON.stringify(input.user_claim_report, null, 2)}`,
    `FACT_CHECK_REPORT:\n${JSON.stringify(input.fact_check_report, null, 2)}`,
    `FALLACY_REPORT:\n${JSON.stringify(input.fallacy_report, null, 2)}`,
    retryNote,
  ].filter(Boolean).join("\n\n");
}

