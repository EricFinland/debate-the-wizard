import type { AgentWorkflowInput, FactCheckReport, FallacyReport, UserClaimReport } from "./common.ts";

export type DebaterInput = AgentWorkflowInput;

export interface DebaterSynthesis {
  ai_rebuttal: string;
  strategy: string;
  strongest_counterpoints: string[];
  confidence: number;
}

export interface DebaterReports {
  user_claim_report: UserClaimReport;
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

