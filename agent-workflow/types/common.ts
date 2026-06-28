export type Reliability = "high" | "medium" | "low";

export type Severity = "low" | "medium" | "high";

export type LogicQuality = "strong" | "okay" | "weak";

export type Winner = "user" | "ai" | "tie";

export interface UserClaimReport {
  main_claim: string;
  supporting_claims: string[];
  context_summary: string;
  possible_weak_points: string[];
  useful_evidence: string[];
}

export interface FactCheckReport {
  checked_claims: {
    claim: string;
    verdict: "true" | "false" | "mixed" | "unsupported";
    explanation: string;
  }[];
  overall_reliability: Reliability;
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

