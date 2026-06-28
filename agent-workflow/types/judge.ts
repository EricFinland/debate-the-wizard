import type {
  AgentWorkflowInput,
  FactCheckReport,
  FallacyReport,
  SearchEvidence,
  UserClaimReport,
  Winner,
} from "./common.ts";
import type { DebaterReports } from "./debater.ts";

export interface DebateScore {
  factual_accuracy: number;
  logic_quality: number;
  evidence_strength: number;
  persuasiveness: number;
  total: number;
}

export interface JudgeInput extends DebaterReports {
  user_argument: string;
  ai_rebuttal: string;
  search_evidence: SearchEvidence;
}

export interface JudgeResult {
  user_score: DebateScore;
  ai_score: DebateScore;
  winner: Winner;
  explanation: string;
}

export interface AgentWorkflowResult extends AgentWorkflowInput, DebaterReports {
  ai_rebuttal: string;
  debater_result: {
    strategy: string;
    strongest_counterpoints: string[];
    confidence: number;
    self_check: {
      passed: boolean;
      issues: string[];
      retried: boolean;
    };
  };
  judge_result: JudgeResult;
}
