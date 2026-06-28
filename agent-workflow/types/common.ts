export type Reliability = "high" | "medium" | "low";

export type Severity = "low" | "medium" | "high";

export type LogicQuality = "strong" | "okay" | "weak";

export type Winner = "user" | "ai" | "tie";

export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchEvidence {
  query: string;
  citations: Citation[];
}

export interface UserClaimReport {
  main_claim: string;
  supporting_claims: string[];
  user_provided_evidence_claims: string[];
  search_query: string;
  context_summary: string;
  possible_weak_points: string[];
  useful_evidence: string[];
}

export interface ClaimResearchResult {
  user_claim_report: UserClaimReport;
  search_evidence: SearchEvidence;
}

export interface FactCheckReport {
  checked_claims: {
    claim: string;
    verdict: "true" | "false" | "mixed" | "unsupported";
    explanation: string;
  }[];
  overall_reliability: Reliability;
  citations: Citation[];
}

export interface FallacyReport {
  fallacies: {
    type: string;
    quote_or_summary: string;
    explanation: string;
    severity: Severity;
  }[];
  overall_logic_quality: LogicQuality;
}

export interface AgentWorkflowInput {
  user_argument: string;
}
