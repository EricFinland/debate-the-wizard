import {
  buildClaimResearchUserPrompt,
  CLAIM_RESEARCH_SYSTEM_PROMPT,
} from "../prompts/claim_research_prompt.ts";
import type { UserClaimReport } from "../types/common.ts";
import { callModelJson } from "../utils/model_gateway.ts";

export async function runClaimResearchSubAgent(input: {
  user_argument: string;
}): Promise<UserClaimReport> {
  return callModelJson<UserClaimReport>({
    systemPrompt: CLAIM_RESEARCH_SYSTEM_PROMPT,
    userPrompt: buildClaimResearchUserPrompt(input.user_argument),
    temperature: 0.1,
  });
}

