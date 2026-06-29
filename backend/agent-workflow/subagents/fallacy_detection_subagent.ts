import {
  buildFallacyDetectionUserPrompt,
  FALLACY_DETECTION_SYSTEM_PROMPT,
} from "../prompts/fallacy_detection_prompt.ts";
import type { FallacyReport, UserClaimReport } from "../types/common.ts";
import { callModelJson } from "../utils/model_gateway.ts";

export async function runFallacyDetectionSubAgent(input: {
  user_argument: string;
  user_claim_report: UserClaimReport;
}): Promise<FallacyReport> {
  return callModelJson<FallacyReport>({
    systemPrompt: FALLACY_DETECTION_SYSTEM_PROMPT,
    userPrompt: buildFallacyDetectionUserPrompt(input.user_argument, input.user_claim_report),
    temperature: 0,
  });
}

