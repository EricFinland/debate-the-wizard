import { runDebaterAgent } from "./agents/debater_agent.ts";
import { runJudgeAgent } from "./agents/judge_agent.ts";
import type { AgentWorkflowInput } from "./types/common.ts";
import type { AgentWorkflowResult } from "./types/judge.ts";

export { runDebaterAgent } from "./agents/debater_agent.ts";
export { runJudgeAgent } from "./agents/judge_agent.ts";
export type {
  AgentWorkflowInput,
  FactCheckReport,
  FallacyReport,
  LogicQuality,
  Reliability,
  Severity,
  UserClaimReport,
  Winner,
} from "./types/common.ts";
export type {
  DebaterInput,
  DebaterReports,
  DebaterResult,
  DebaterSynthesis,
} from "./types/debater.ts";
export type {
  AgentWorkflowResult,
  DebateScore,
  JudgeInput,
  JudgeResult,
} from "./types/judge.ts";

export async function runAgentWorkflow(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  const debaterResult = await runDebaterAgent(input);
  const judgeResult = await runJudgeAgent({
    user_argument: input.user_argument,
    ai_rebuttal: debaterResult.ai_rebuttal,
    user_claim_report: debaterResult.user_claim_report,
    fact_check_report: debaterResult.fact_check_report,
    fallacy_report: debaterResult.fallacy_report,
  });

  return {
    user_argument: input.user_argument,
    ai_rebuttal: debaterResult.ai_rebuttal,
    user_claim_report: debaterResult.user_claim_report,
    fact_check_report: debaterResult.fact_check_report,
    fallacy_report: debaterResult.fallacy_report,
    debater_result: {
      strategy: debaterResult.strategy,
      strongest_counterpoints: debaterResult.strongest_counterpoints,
      confidence: debaterResult.confidence,
      self_check: debaterResult.self_check,
    },
    judge_result: judgeResult,
  };
}

