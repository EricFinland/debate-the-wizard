// backend/functions/_shared/config.ts
var env = (k, fallback = "") => Deno.env.get(k) ?? fallback;
var DEFAULT_BASE = "https://4eychqk3.us-east.insforge.app";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// backend/functions/_shared/db.ts
function makeDb(base, key) {
  const db = `${base}/api/database/records`;
  const H = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  async function dbSelect2(table, query = "") {
    const res = await fetch(`${db}/${table}${query ? `?${query}` : ""}`, { headers: H });
    if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbInsert2(table, rows) {
    const res = await fetch(`${db}/${table}`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(rows)
    });
    if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbUpdate2(table, query, patch) {
    const res = await fetch(`${db}/${table}?${query}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`update ${table} ${query} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  return { dbSelect: dbSelect2, dbInsert: dbInsert2, dbUpdate: dbUpdate2 };
}

// backend/agent-workflow/prompts/debater_prompt.ts
var DEBATER_SYSTEM_PROMPT = `
You are the Debater Agent for a live debate game.

Your job:
- Synthesize the final AI rebuttal yourself using the user argument and sub-agent reports.
- Be concise, persuasive, direct, fair, and non-toxic.
- Ground the rebuttal in the provided reports and You.com search evidence.
- Name the strategy and strongest counterpoints.

Do not:
- Create or call another rebuttal generator.
- Add claims that are not supported by the reports, citations, or clear reasoning.
- Write a long essay.
- Judge who won.

Return JSON only in this exact shape:
{
  "ai_rebuttal": "string",
  "strategy": "string",
  "strongest_counterpoints": ["string"],
  "confidence": 0.0
}

The rebuttal should usually be 80-160 words. Confidence must be a number from 0 to 1.
`.trim();
function buildDebaterUserPrompt(input) {
  const retryNote = input.previous_issues?.length ? `RETRY_INSTRUCTIONS:
Fix these self-check issues: ${input.previous_issues.join("; ")}` : "";
  const historyStr = input.history?.length ? `DEBATE HISTORY:
${JSON.stringify(input.history, null, 2)}` : "";
  return [
    historyStr,
    `USER_ARGUMENT:
${input.user_argument}`,
    `USER_CLAIM_REPORT:
${JSON.stringify(input.user_claim_report, null, 2)}`,
    `SEARCH_EVIDENCE:
${JSON.stringify(input.search_evidence, null, 2)}`,
    `FACT_CHECK_REPORT:
${JSON.stringify(input.fact_check_report, null, 2)}`,
    `FALLACY_REPORT:
${JSON.stringify(input.fallacy_report, null, 2)}`,
    retryNote
  ].filter(Boolean).join("\n\n");
}

// backend/agent-workflow/prompts/claim_research_prompt.ts
var CLAIM_RESEARCH_SYSTEM_PROMPT = `
You are the Claim + Research Sub-Agent for a live debate game.

Your job:
- Extract the user's main claim.
- Identify concise supporting claims.
- Identify any evidence claims the user provides, such as alleged quotes, studies, admissions, statistics, or sources.
- Create one concise You.com search query to verify the main claim and the user's evidence claims.
- Summarize lightweight context that helps the debater respond.
- Identify weak points and useful evidence directions.

Do not:
- Perform deep research.
- Invent citations or pretend to have browsed the web.
- Fact-check the claims yourself.
- Write a rebuttal.
- Judge the winner.

Return JSON only in this exact shape:
{
  "main_claim": "string",
  "supporting_claims": ["string"],
  "user_provided_evidence_claims": ["string"],
  "search_query": "string",
  "context_summary": "string",
  "possible_weak_points": ["string"],
  "useful_evidence": ["string"]
}

Keep every field concise for a fast live demo. The search_query should be no more than 14 words.
`.trim();
function buildClaimResearchUserPrompt(input) {
  return `USER_ARGUMENT:
${input.user_argument}`;
}

// backend/agent-workflow/utils/json_parser.ts
function parseModelJson(text) {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error("Model response did not contain parseable JSON.");
  }
}
function stripJsonFences(text) {
  return text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

// backend/agent-workflow/utils/model_gateway.ts
async function callModelJson({
  systemPrompt,
  userPrompt,
  temperature = 0.2
}) {
  const baseUrl = readEnv("INSFORGE_API_URL").replace(/\/+$/, "");
  const apiKey = readEnv("INSFORGE_API_KEY");
  const model = readEnv("AGENT_WORKFLOW_MODEL", readEnv("JUDGE_MODEL", "gpt-5.4-mini"));
  if (!baseUrl || !apiKey) {
    throw new Error("InsForge Model Gateway is not configured. Set INSFORGE_API_URL and INSFORGE_API_KEY.");
  }
  const response = await fetch(`${baseUrl}/api/ai/chat/completion`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`InsForge Model Gateway ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data.text;
  if (!content) {
    throw new Error("InsForge Model Gateway returned an empty response.");
  }
  return parseModelJson(content);
}
function readEnv(key, fallback = "") {
  const denoEnv = globalThis;
  const nodeProcess = globalThis;
  return denoEnv.Deno?.env?.get?.(key) ?? nodeProcess.process?.env?.[key] ?? fallback;
}

// backend/agent-workflow/utils/you_search.ts
var DEFAULT_YOUCOM_SEARCH_URL = "https://ydc-index.io/v1/search";
async function searchYouCom(query) {
  const key = readEnv2("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY is required for evidence-grounded agent workflow.");
  const count = Number(readEnv2("SEARCH_COUNT", "6")) || 6;
  const searchUrl = readEnv2("YOUCOM_SEARCH_URL", DEFAULT_YOUCOM_SEARCH_URL);
  const url = new URL(searchUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(count));
  const response = await fetch(url, {
    method: "GET",
    headers: { "X-API-Key": key }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`You.com ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  return normalizeYouComResults(data, count);
}
function normalizeYouComResults(data, limit) {
  const results = Array.isArray(data?.results?.web) ? [...data.results.web, ...Array.isArray(data.results.news) ? data.results.news : []] : [
    ...Array.isArray(data?.web) ? data.web : [],
    ...Array.isArray(data?.news) ? data.news : [],
    ...Array.isArray(data?.hits) ? data.hits : []
  ];
  const citations = [];
  for (const result of results) {
    const snippetParts = Array.isArray(result?.snippets) ? result.snippets : [result?.snippet, result?.description];
    const snippet = snippetParts.filter((value) => typeof value === "string" && value.trim().length > 0).join(" ").trim();
    const url = String(result?.url ?? result?.link ?? "").trim();
    if (!url || !snippet) continue;
    citations.push({
      title: String(result?.title ?? "").trim(),
      url,
      snippet
    });
    if (citations.length >= limit) break;
  }
  return citations;
}
function readEnv2(key, fallback = "") {
  const denoEnv = globalThis;
  const nodeProcess = globalThis;
  return denoEnv.Deno?.env?.get?.(key) ?? nodeProcess.process?.env?.[key] ?? fallback;
}

// backend/agent-workflow/subagents/claim_research_subagent.ts
async function runClaimResearchSubAgent(input) {
  const userClaimReport = normalizeUserClaimReport(await callModelJson({
    systemPrompt: CLAIM_RESEARCH_SYSTEM_PROMPT,
    userPrompt: buildClaimResearchUserPrompt(input),
    temperature: 0.1
  }), input.user_argument);
  const citations = await searchYouCom(userClaimReport.search_query);
  return {
    user_claim_report: userClaimReport,
    search_evidence: {
      query: userClaimReport.search_query,
      citations
    }
  };
}
function normalizeUserClaimReport(report, fallbackArgument) {
  const mainClaim = textOrFallback(report.main_claim, fallbackArgument.slice(0, 200));
  const searchQuery = textOrFallback(report.search_query, mainClaim);
  return {
    main_claim: mainClaim,
    supporting_claims: arrayOfStrings(report.supporting_claims),
    user_provided_evidence_claims: arrayOfStrings(report.user_provided_evidence_claims),
    search_query: searchQuery,
    context_summary: textOrFallback(report.context_summary, ""),
    possible_weak_points: arrayOfStrings(report.possible_weak_points),
    useful_evidence: arrayOfStrings(report.useful_evidence)
  };
}
function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
}
function textOrFallback(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

// backend/agent-workflow/prompts/fact_check_prompt.ts
var FACT_CHECK_SYSTEM_PROMPT = `
You are the Fact Check Sub-Agent for a live debate game.

Your job:
- Check the original user argument using the claim report as a map.
- Check the user's main claim, supporting claims, and user-provided evidence claims against the provided independent You.com citations.
- Mark each checked claim as true, false, mixed, or unsupported.
- Explain each verdict briefly.
- Estimate overall reliability.

Do not:
- Use model memory as the final source of truth when citations are provided.
- Invent citations.
- Write a rebuttal.
- Detect fallacies except where needed to explain factual reliability.
- Judge the overall debate winner.

Return JSON only in this exact shape:
{
  "checked_claims": [
    {
      "claim": "string",
      "verdict": "true | false | mixed | unsupported",
      "explanation": "string"
    }
  ],
  "overall_reliability": "high | medium | low",
  "citations": [
    {
      "title": "string",
      "url": "string",
      "snippet": "string"
    }
  ]
}

Use only the provided citations. If the citations do not address a claim, mark it unsupported.
Keep the report concise and useful for rebuttal synthesis.
`.trim();
function buildFactCheckUserPrompt(userArgument, userClaimReport, searchEvidence) {
  return [
    `USER_ARGUMENT:
${userArgument}`,
    `USER_CLAIM_REPORT:
${JSON.stringify(userClaimReport, null, 2)}`,
    `SEARCH_EVIDENCE:
${JSON.stringify(searchEvidence, null, 2)}`
  ].join("\n\n");
}

// backend/agent-workflow/subagents/fact_check_subagent.ts
async function runFactCheckSubAgent(input) {
  const report = await callModelJson({
    systemPrompt: FACT_CHECK_SYSTEM_PROMPT,
    userPrompt: buildFactCheckUserPrompt(input.user_argument, input.user_claim_report, input.search_evidence),
    temperature: 0
  });
  return {
    ...report,
    citations: input.search_evidence.citations
  };
}

// backend/agent-workflow/prompts/fallacy_detection_prompt.ts
var FALLACY_DETECTION_SYSTEM_PROMPT = `
You are the Fallacy Detection Sub-Agent for a live debate game.

Your job:
- Identify likely logical fallacies or reasoning weaknesses in the user's argument.
- Quote or summarize the relevant part.
- Explain each issue briefly.
- Rate severity.
- Estimate overall logic quality.

Do not:
- Fact-check every factual claim.
- Write a rebuttal.
- Judge the overall debate winner.
- Over-label normal disagreement as a fallacy.

Return JSON only in this exact shape:
{
  "fallacies": [
    {
      "type": "string",
      "quote_or_summary": "string",
      "explanation": "string",
      "severity": "low | medium | high"
    }
  ],
  "overall_logic_quality": "strong | okay | weak"
}

Use an empty fallacies array when no clear fallacy is present.
Keep the report concise for a fast live demo.
`.trim();
function buildFallacyDetectionUserPrompt(userArgument, userClaimReport) {
  return [
    `USER_ARGUMENT:
${userArgument}`,
    `USER_CLAIM_REPORT:
${JSON.stringify(userClaimReport, null, 2)}`
  ].join("\n\n");
}

// backend/agent-workflow/subagents/fallacy_detection_subagent.ts
async function runFallacyDetectionSubAgent(input) {
  return callModelJson({
    systemPrompt: FALLACY_DETECTION_SYSTEM_PROMPT,
    userPrompt: buildFallacyDetectionUserPrompt(input.user_argument, input.user_claim_report),
    temperature: 0
  });
}

// backend/agent-workflow/config/difficulty.ts
var DIFFICULTY_CONFIDENCE = {
  novice: 0.6,
  adept: 0.7,
  archmage: 0.8,
  impossible: 0.9
};
function getMinConfidence(difficulty) {
  return DIFFICULTY_CONFIDENCE[difficulty ?? "adept"];
}

// backend/agent-workflow/utils/self_check.ts
var MAX_REBUTTAL_WORDS = 180;
function selfCheckRebuttal(userArgument, synthesis, difficulty) {
  const issues = [];
  const rebuttal = synthesis.ai_rebuttal?.trim() ?? "";
  if (!rebuttal) {
    issues.push("Rebuttal is empty.");
  }
  if (wordCount(rebuttal) > MAX_REBUTTAL_WORDS) {
    issues.push(`Rebuttal is too long; keep it under ${MAX_REBUTTAL_WORDS} words.`);
  }
  if (!addressesUserArgument(userArgument, rebuttal)) {
    issues.push("Rebuttal does not clearly address the user argument.");
  }
  if (!Array.isArray(synthesis.strongest_counterpoints) || synthesis.strongest_counterpoints.length === 0) {
    issues.push("Rebuttal has no clear counterpoint.");
  }
  if (!Number.isFinite(synthesis.confidence) || synthesis.confidence < getMinConfidence(difficulty)) {
    issues.push(`Confidence is too low; expected at least ${getMinConfidence(difficulty)}.`);
  }
  return {
    passed: issues.length === 0,
    issues
  };
}
function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
function addressesUserArgument(userArgument, rebuttal) {
  const userTerms = new Set(
    userArgument.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((term) => term.length > 4)
  );
  const rebuttalText = rebuttal.toLowerCase();
  let matches = 0;
  for (const term of userTerms) {
    if (rebuttalText.includes(term)) matches += 1;
    if (matches >= 2) return true;
  }
  return userTerms.size <= 1 ? rebuttal.trim().length > 0 : false;
}

// backend/agent-workflow/agents/debater_agent.ts
async function runDebaterAgent(input) {
  const { user_claim_report: userClaimReport, search_evidence: searchEvidence } = await runClaimResearchSubAgent({
    user_argument: input.user_argument
  });
  const { difficulty } = input;
  const [factCheckReport, fallacyReport] = await Promise.all([
    runFactCheckSubAgent({
      user_argument: input.user_argument,
      user_claim_report: userClaimReport,
      search_evidence: searchEvidence
    }),
    runFallacyDetectionSubAgent({
      user_argument: input.user_argument,
      user_claim_report: userClaimReport
    })
  ]);
  const promptInputs = {
    user_argument: input.user_argument,
    user_claim_report: userClaimReport,
    search_evidence: searchEvidence,
    fact_check_report: factCheckReport,
    fallacy_report: fallacyReport,
    history: input.history
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
      history: input.history
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
      retried
    }
  };
}
function synthesizeDebateRebuttal(input) {
  return callModelJson({
    systemPrompt: DEBATER_SYSTEM_PROMPT,
    userPrompt: buildDebaterUserPrompt(input),
    temperature: 0.35
  });
}

// backend/agent-workflow/prompts/judge_prompt.ts
var JUDGE_SYSTEM_PROMPT = `
You are the Judge Agent for a live debate game.

Your job:
- Compare the original user argument against the final AI rebuttal.
- Reuse the Debater reports and You.com search evidence as context.
- Score both sides fairly across four 0-25 dimensions.
- Decide winner: user, ai, or tie.
- Explain the result briefly.

Do not:
- Blindly trust the Debater reports.
- Treat uncited model memory as stronger than the provided citations.
- Generate a new rebuttal.
- Give debate coaching.
- Add backend, database, realtime, or UI behavior.

Rules:
- factual_accuracy, logic_quality, evidence_strength, and persuasiveness must each be 0-25.
- total must equal the sum of the four dimensions.
- If total scores are very close, return "tie".

Return JSON only in this exact shape:
{
  "user_score": {
    "factual_accuracy": 0,
    "logic_quality": 0,
    "evidence_strength": 0,
    "persuasiveness": 0,
    "total": 0
  },
  "ai_score": {
    "factual_accuracy": 0,
    "logic_quality": 0,
    "evidence_strength": 0,
    "persuasiveness": 0,
    "total": 0
  },
  "winner": "user | ai | tie",
  "explanation": "string"
}
`.trim();
function buildJudgeUserPrompt(input) {
  return [
    `USER_ARGUMENT:
${input.user_argument}`,
    `AI_REBUTTAL:
${input.ai_rebuttal}`,
    `USER_CLAIM_REPORT:
${JSON.stringify(input.user_claim_report, null, 2)}`,
    `SEARCH_EVIDENCE:
${JSON.stringify(input.search_evidence, null, 2)}`,
    `FACT_CHECK_REPORT:
${JSON.stringify(input.fact_check_report, null, 2)}`,
    `FALLACY_REPORT:
${JSON.stringify(input.fallacy_report, null, 2)}`
  ].join("\n\n");
}

// backend/agent-workflow/agents/judge_agent.ts
async function runJudgeAgent(input) {
  const result = await callModelJson({
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt: buildJudgeUserPrompt(input),
    temperature: 0
  });
  return normalizeJudgeResult(result);
}
function normalizeJudgeResult(result) {
  const userScore = normalizeScore(result.user_score);
  const aiScore = normalizeScore(result.ai_score);
  const scoreDelta = Math.abs(userScore.total - aiScore.total);
  const winner = scoreDelta <= 3 ? "tie" : userScore.total > aiScore.total ? "user" : "ai";
  return {
    user_score: userScore,
    ai_score: aiScore,
    winner,
    explanation: result.explanation
  };
}
function normalizeScore(score) {
  const factualAccuracy = clampDimension(score.factual_accuracy);
  const logicQuality = clampDimension(score.logic_quality);
  const evidenceStrength = clampDimension(score.evidence_strength);
  const persuasiveness = clampDimension(score.persuasiveness);
  return {
    factual_accuracy: factualAccuracy,
    logic_quality: logicQuality,
    evidence_strength: evidenceStrength,
    persuasiveness,
    total: factualAccuracy + logicQuality + evidenceStrength + persuasiveness
  };
}
function clampDimension(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(25, numeric));
}

// backend/agent-workflow/index.ts
async function runAgentWorkflow(input) {
  const debaterResult = await runDebaterAgent({
    user_argument: input.user_argument,
    difficulty: input.difficulty,
    history: input.history
  });
  const judgeResult = await runJudgeAgent({
    user_argument: input.user_argument,
    ai_rebuttal: debaterResult.ai_rebuttal,
    user_claim_report: debaterResult.user_claim_report,
    search_evidence: debaterResult.search_evidence,
    fact_check_report: debaterResult.fact_check_report,
    fallacy_report: debaterResult.fallacy_report
  });
  return {
    user_argument: input.user_argument,
    difficulty: input.difficulty,
    history: input.history,
    ai_rebuttal: debaterResult.ai_rebuttal,
    user_claim_report: debaterResult.user_claim_report,
    search_evidence: debaterResult.search_evidence,
    fact_check_report: debaterResult.fact_check_report,
    fallacy_report: debaterResult.fallacy_report,
    debater_result: {
      strategy: debaterResult.strategy,
      strongest_counterpoints: debaterResult.strongest_counterpoints,
      confidence: debaterResult.confidence,
      self_check: debaterResult.self_check
    },
    judge_result: judgeResult
  };
}

// backend/functions/submit-argument/index.ts
var MAX_ARG = 4e3;
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbSelect, dbInsert, dbUpdate } = makeDb(DATA, KEY);
async function recomputeScore(room_id, side, author) {
  const claims = await dbSelect("claims", `room_id=eq.${room_id}&author=eq.${author}&select=points`);
  const total = claims.reduce((s, c) => s + (Number(c.points) || 0), 0);
  const [player] = await dbSelect("players", `room_id=eq.${room_id}&side=eq.${side}&select=id`);
  if (player) {
    const [u] = await dbUpdate("players", `id=eq.${player.id}`, { score: total });
    return u?.score ?? total;
  }
  return total;
}
function scaleScore(total25) {
  return Math.max(0, Math.min(10, Math.round(total25 / 25 * 10)));
}
async function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const room_id = (body.room_id ?? "").trim();
  const argument = (body.argument ?? "").trim();
  const round_no = Number(body.round_no);
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  if (!argument) return json({ error: "'argument' is required." }, 400);
  if (argument.length > MAX_ARG) return json({ error: `'argument' too long (max ${MAX_ARG} chars).` }, 400);
  if (!Number.isFinite(round_no) || round_no < 1) return json({ error: "'round_no' must be >= 1." }, 400);
  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total,difficulty`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);
    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409);
    const claims = await dbSelect("claims", `room_id=eq.${room_id}&round_no=lt.${round_no}&order=round_no.asc,author.asc&select=round_no,author,argument`);
    const history = claims.map((c) => ({
      round_no: c.round_no,
      author: c.author,
      argument: c.argument
    }));
    const result = await runAgentWorkflow({
      user_argument: argument,
      difficulty: room.difficulty || "adept",
      history
    });
    const playerPoints = scaleScore(result.judge_result.user_score.total);
    const wizardPoints = scaleScore(result.judge_result.ai_score.total);
    const [playerClaim] = await dbInsert("claims", [{
      room_id,
      round_no,
      author: "player",
      argument,
      key_claim: result.user_claim_report.main_claim,
      verdict: result.judge_result.winner,
      rationale: result.judge_result.explanation,
      points: playerPoints,
      scores: result.judge_result.user_score,
      fallacies: result.fallacy_report.fallacies,
      search_query: result.search_evidence.query
    }]);
    const [wizardClaim] = await dbInsert("claims", [{
      room_id,
      round_no,
      author: "wizard",
      argument: result.ai_rebuttal,
      key_claim: "AI Rebuttal",
      verdict: null,
      rationale: result.debater_result.strategy,
      points: wizardPoints,
      scores: result.judge_result.ai_score,
      fallacies: [],
      taunt: null,
      // Removed taunt logic for brevity or we can add it back later if needed
      search_query: null
    }]);
    const cites = result.search_evidence.citations ?? [];
    const insertedPlayerCitations = cites.length ? await dbInsert("citations", cites.map((c) => ({ claim_id: playerClaim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null }))) : [];
    const playerScore = await recomputeScore(room_id, "A", "player");
    const wizardScore = await recomputeScore(room_id, "B", "wizard");
    let roomOut = room;
    if (round_no >= room.rounds_total) {
      const [u] = await dbUpdate("rooms", `id=eq.${room_id}`, { status: "finished" });
      roomOut = u ?? { ...room, status: "finished" };
    }
    return json({
      player_claim: playerClaim,
      wizard_claim: wizardClaim,
      player_citations: insertedPlayerCitations,
      player_score: playerScore,
      wizard_score: wizardScore,
      room: roomOut,
      winner: result.judge_result.winner,
      explanation: result.judge_result.explanation
    });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
