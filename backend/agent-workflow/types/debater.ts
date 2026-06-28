import type { AgentWorkflowInput, FactCheckReport, FallacyReport, SearchEvidence, UserClaimReport } from "./common.ts";

export interface DebaterInput extends AgentWorkflowInput {
  user_argument: string;
  difficulty?: import("../config/difficulty.ts").Difficulty;
  history?: import("./common.ts").DebateHistoryEntry[];
}

export interface DebaterSynthesis {
  ai_rebuttal: string;
  strategy: string;
  strongest_counterpoints: string[];
  confidence: number;
}

export interface DebaterReports {
  user_claim_report: UserClaimReport;
  search_evidence: SearchEvidence;
  fact_check_report: FactCheckReport;
  fallacy_report: FallacyReport;
}

export interface DebaterResult extends DebaterReports {
  ai_rebuttal: string;
  strategy: string;
  strongest_counterpoints: string[];
  confidence: number;
  self_check: {
    passed: boolean;
    issues: string[];
    retried: boolean;
  };
}
