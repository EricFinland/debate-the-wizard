import {
  buildClaimResearchUserPrompt,
  CLAIM_RESEARCH_SYSTEM_PROMPT,
} from "../prompts/claim_research_prompt.ts";
import type { ClaimResearchResult, UserClaimReport } from "../types/common.ts";
import { callModelJson } from "../utils/model_gateway.ts";
import { searchYouCom } from "../utils/you_search.ts";

export async function runClaimResearchSubAgent(input: {
  user_argument: string;
}): Promise<ClaimResearchResult> {
  const userClaimReport = normalizeUserClaimReport(await callModelJson<UserClaimReport>({
    systemPrompt: CLAIM_RESEARCH_SYSTEM_PROMPT,
    userPrompt: buildClaimResearchUserPrompt(input),
    temperature: 0.1,
  }), input.user_argument);
  const citations = await searchYouCom(userClaimReport.search_query);

  return {
    user_claim_report: userClaimReport,
    search_evidence: {
      query: userClaimReport.search_query,
      citations,
    },
  };
}

function normalizeUserClaimReport(report: UserClaimReport, fallbackArgument: string): UserClaimReport {
  const mainClaim = textOrFallback(report.main_claim, fallbackArgument.slice(0, 200));
  const searchQuery = textOrFallback(report.search_query, mainClaim);

  return {
    main_claim: mainClaim,
    supporting_claims: arrayOfStrings(report.supporting_claims),
    user_provided_evidence_claims: arrayOfStrings(report.user_provided_evidence_claims),
    search_query: searchQuery,
    context_summary: textOrFallback(report.context_summary, ""),
    possible_weak_points: arrayOfStrings(report.possible_weak_points),
    useful_evidence: arrayOfStrings(report.useful_evidence),
  };
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function textOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
