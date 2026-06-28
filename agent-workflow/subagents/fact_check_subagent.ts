import {
  buildFactCheckUserPrompt,
  FACT_CHECK_SYSTEM_PROMPT,
} from "../prompts/fact_check_prompt.ts";
import type { FactCheckReport, SearchEvidence, UserClaimReport } from "../types/common.ts";
import { callModelJson } from "../utils/model_gateway.ts";

export async function runFactCheckSubAgent(input: {
  user_argument: string;
  user_claim_report: UserClaimReport;
  search_evidence: SearchEvidence;
}): Promise<FactCheckReport> {
  const report = await callModelJson<FactCheckReport>({
    systemPrompt: FACT_CHECK_SYSTEM_PROMPT,
    userPrompt: buildFactCheckUserPrompt(input.user_argument, input.user_claim_report, input.search_evidence),
    temperature: 0,
  });

  return {
    ...report,
    citations: input.search_evidence.citations,
  };
}
