import { buildDebaterUserPrompt, DEBATER_SYSTEM_PROMPT } from "../prompts/debater_prompt.ts";
import { runClaimResearchSubAgent } from "../subagents/claim_research_subagent.ts";
import { runFactCheckSubAgent } from "../subagents/fact_check_subagent.ts";
import { runFallacyDetectionSubAgent } from "../subagents/fallacy_detection_subagent.ts";
import type { DebaterInput, DebaterResult, DebaterSynthesis } from "../types/debater.ts";
import { callModelJson } from "../utils/model_gateway.ts";
import { selfCheckRebuttal } from "../utils/self_check.ts";

export async function runDebaterAgent(input: DebaterInput): Promise<DebaterResult> {
  const { user_claim_report: userClaimReport, search_evidence: searchEvidence } = await runClaimResearchSubAgent({
    user_argument: input.user_argument,
  });
  const { difficulty } = input;

  const [factCheckReport, fallacyReport] = await Promise.all([
    runFactCheckSubAgent({
      user_argument: input.user_argument,
      user_claim_report: userClaimReport,
      search_evidence: searchEvidence,
    }),
    runFallacyDetectionSubAgent({
      user_argument: input.user_argument,
      user_claim_report: userClaimReport,
    }),
  ]);

  const promptInputs = {
    user_argument: input.user_argument,
    user_claim_report: userClaimReport,
    search_evidence: searchEvidence,
    fact_check_report: factCheckReport,
    fallacy_report: fallacyReport,
    history: input.history,
  };

  let synthesis = await synthesizeDebateRebuttal(promptInputs);

  let selfCheck = selfCheckRebuttal(input.user_argument, synthesis, difficulty);
  let retried = false;

  if (!selfCheck.passed) {
    retried = true;
    synthesis = await synthesizeDebateRebuttal({
      user_argument: input.user_argument,
      user_claim_report: userClaimReport,
      search_evidence: searchEvidence,
      fact_check_report: factCheckReport,
      fallacy_report: fallacyReport,
      previous_issues: selfCheck.issues,
      history: input.history,
    });
    selfCheck = selfCheckRebuttal(input.user_argument, synthesis, difficulty);
  }

  return {
    ai_rebuttal: synthesis.ai_rebuttal,
    strategy: synthesis.strategy,
    strongest_counterpoints: synthesis.strongest_counterpoints,
    confidence: synthesis.confidence,
    user_claim_report: userClaimReport,
    search_evidence: searchEvidence,
    fact_check_report: factCheckReport,
    fallacy_report: fallacyReport,
    self_check: {
      passed: selfCheck.passed,
      issues: selfCheck.issues,
      retried,
    },
  };
}

function synthesizeDebateRebuttal(input: Parameters<typeof buildDebaterUserPrompt>[0]): Promise<DebaterSynthesis> {
  return callModelJson<DebaterSynthesis>({
    systemPrompt: DEBATER_SYSTEM_PROMPT,
    userPrompt: buildDebaterUserPrompt(input),
    temperature: 0.35,
  });
}
