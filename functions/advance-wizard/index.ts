// advance-wizard — the wizard's turn orchestration ("the rest" track).
//
// Generates a grounded rebuttal (You.com search from the AGAINST angle + Claude)
// and judges it through the SAME pipeline (so the wizard can get caught), then
// persists the claim + citations, recomputes the wizard's score, and on the final
// round flips the room to 'finished'.
//
// The wizard + judge pipeline is INLINED (not HTTP calls to wizard-turn / judge-claim)
// because InsForge deploys all functions as ONE Deno deployment, so cross-function
// fetches trip Deno Deploy's 508 loop detection.
//
// POST { "room_id": uuid, "round_no": number, "opponent_argument"?: string }
// Returns { claim, citations, score, citation_index, room }.
//
// Deploy: npx @insforge/cli functions deploy advance-wizard --file functions/advance-wizard/index.ts --name "advance-wizard"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

// ---------- config ----------
const env = (k: string, fb = "") => Deno.env.get(k) ?? fb;
const SCORE = { supported: 10, unsupported: 0, misleading: -5 } as const;
type Verdict = keyof typeof SCORE;
type Difficulty = "novice" | "adept" | "archmage";
const DIFFICULTIES: readonly Difficulty[] = ["novice", "adept", "archmage"] as const;
const normalizeDifficulty = (d: unknown): Difficulty =>
  DIFFICULTIES.includes(String(d).toLowerCase() as Difficulty) ? (String(d).toLowerCase() as Difficulty) : "adept";
const JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
const SEARCH_COUNT = Number(env("SEARCH_COUNT", "6")) || 6;

// Fall back to the known project URL if INSFORGE_API_URL is not in the deployment env.
const DEFAULT_BASE = "https://atjgzcv9.us-east.insforge.app";
const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");
const DB = `${DATA}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

interface Citation { title: string; url: string; snippet: string; }
interface Scores { factual_accuracy: number; logic: number; evidence: number; persuasiveness: number; }
const ZERO_SCORES: Scores = { factual_accuracy: 0, logic: 0, evidence: 0, persuasiveness: 0 };

// ---------- judge pipeline (inlined) ----------
function stripFences(s: string) { return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(); }
function parseJson<T>(text: string): T | null {
  const c = stripFences(text);
  try { return JSON.parse(c) as T; } catch {
    const m = c.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) as T; } catch { /* */ } } return null;
  }
}
function clampScore(n: unknown) { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0; }

async function chat(model: string, messages: { role: string; content: string }[], temperature = 0): Promise<string> {
  const key = env("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not configured.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
async function searchYouCom(query: string): Promise<Citation[]> {
  const key = env("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY not set.");
  const url = new URL("https://api.you.com/v1/search"); url.searchParams.set("query", query);
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) throw new Error(`You.com ${res.status}`);
  const data = await res.json();
  const web: any[] = data?.results?.web ?? data?.web ?? data?.hits ?? data?.results ?? [];
  const out: Citation[] = [];
  for (const r of web) {
    const snips: string[] = r?.snippets ?? (r?.snippet ? [r.snippet] : (r?.description ? [r.description] : []));
    const snippet = snips.filter(Boolean).join(" ").trim(); if (!snippet) continue;
    out.push({ title: String(r?.title ?? "").trim(), url: String(r?.url ?? r?.link ?? "").trim(), snippet });
    if (out.length >= SEARCH_COUNT) break;
  }
  return out;
}
async function judgeVerdict(argument: string, citations: Citation[]) {
  const list = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const sys = 'You are a debate fact-checker and scorer. Given an ARGUMENT and SEARCH SNIPPETS: 1) extract the single most important factual claim; 2) rule supported/unsupported/misleading; 3) score 0-10 on factual_accuracy, logic, evidence, persuasiveness; 4) name any fallacies. Return ONLY JSON: {"key_claim":"...","verdict":"supported|unsupported|misleading","rationale":"<=20 words","citation_index":<int or null>,"scores":{"factual_accuracy":0,"logic":0,"evidence":0,"persuasiveness":0},"fallacies":[]}. supported = a snippet clearly backs the claim; unsupported = none addresses it; misleading = a snippet contradicts it. citation_index is the snippet you relied on, or null.';
  const raw = await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: `ARGUMENT:\n${argument}\n\nSEARCH SNIPPETS:\n${list || "(none found)"}` }]);
  const p = parseJson<any>(raw);
  if (!p) return { key_claim: argument.slice(0, 200), verdict: "unsupported" as Verdict, rationale: "Judge response could not be parsed.", scores: ZERO_SCORES, fallacies: [] as string[], citation_index: null as number | null };
  const verdict: Verdict = (["supported", "unsupported", "misleading"] as const).includes(p.verdict) ? p.verdict : "unsupported";
  const ci = typeof p.citation_index === "number" && p.citation_index >= 0 && p.citation_index < citations.length ? p.citation_index : null;
  return {
    key_claim: p.key_claim || argument.slice(0, 200), verdict, rationale: p.rationale || "",
    scores: { factual_accuracy: clampScore(p.scores?.factual_accuracy), logic: clampScore(p.scores?.logic), evidence: clampScore(p.scores?.evidence), persuasiveness: clampScore(p.scores?.persuasiveness) },
    fallacies: Array.isArray(p.fallacies) ? p.fallacies.filter((f: unknown) => typeof f === "string" && (f as string).trim()).slice(0, 5) : [],
    citation_index: ci,
  };
}
async function judgePipeline(argument: string, _topic: string) {
  // Search You.com directly with the wizard's argument (no LLM query-extraction call).
  const query = argument.trim().slice(0, 160);
  let citations: Citation[] = [];
  try { citations = await searchYouCom(query); } catch { citations = []; }
  if (!citations.length) return { key_claim: query, verdict: "unsupported" as Verdict, rationale: "No sources found to support this claim.", points: SCORE.unsupported, scores: ZERO_SCORES, fallacies: [] as string[], citations: [] as Citation[], citation_index: null as number | null, search_query: query };
  const r = await judgeVerdict(argument, citations);
  return { key_claim: r.key_claim, verdict: r.verdict, rationale: r.rationale, points: SCORE[r.verdict], scores: r.scores, fallacies: r.fallacies, citations, citation_index: r.citation_index, search_query: query };
}

// ---------- wizard generation (inlined) ----------
// Build the AGAINST-side grounding query with a plain string (no LLM call) to cut latency.
function buildAgainstQuery(topic: string): string {
  const t = (topic || "this position").trim();
  return `${t} strongest counterarguments and evidence against`.trim().slice(0, 160);
}
// Difficulty tunes the wizard's rhetorical strength and how disciplined it is about
// grounding. The judge still judges fairly, so a weaker wizard genuinely loses more.
const DIFFICULTY_STYLE: Record<Difficulty, { persona: string; temp: number }> = {
  novice: {
    persona:
      "You are a NOVICE apprentice wizard, still unsure of your craft. Argue the AGAINST side but be tentative and HEDGED: use softeners like \"I think\", \"maybe\", \"it could be\". You are prone to WEAK or OVER-REACHING points and you often lean on a snippet loosely rather than nailing it. Keep it to 2-3 plain sentences.",
    temp: 0.95,
  },
  adept: {
    persona:
      "You are an ADEPT wizard, a solid and competent debater. Argue the AGAINST side with a clear, well-structured rebuttal grounded firmly in ONE snippet. Confident but not flashy. Keep it to 2-3 plain sentences.",
    temp: 0.7,
  },
  archmage: {
    persona:
      "You are the ARCHMAGE, a master debater of devastating precision. Argue the AGAINST side with a SHARP, rhetorically FORCEFUL rebuttal that is TIGHTLY grounded in ONE snippet you cite with surgical accuracy. Every word lands. Keep it to 2-3 plain sentences.",
    temp: 0.55,
  },
};
async function writeRebuttal(topic: string, opp: string, citations: Citation[], difficulty: Difficulty): Promise<string> {
  const list = citations.map((c, i) => `[${i}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n");
  const style = DIFFICULTY_STYLE[difficulty];
  const sys = `${style.persona} ALWAYS argue the AGAINST side of the topic. NEVER invent facts; only use what the SEARCH SNIPPETS provide. If an OPPONENT ARGUMENT is given, directly rebut it. Plain prose only, no markdown or preamble. Just the rebuttal.`;
  const user = `TOPIC: ${topic || "(unspecified)"}\n` + (opp ? `OPPONENT ARGUMENT (rebut this): ${opp}\n` : "") + `\nSEARCH SNIPPETS (ground your point in one):\n${list || "(none found)"}`;
  return (await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: user }], style.temp)).trim();
}
// Short, in-character wizard taunt themed to the topic. Best-effort; never throws.
async function writeTaunt(topic: string, argument: string, difficulty: Difficulty): Promise<string> {
  const tone = difficulty === "novice" ? "a little unsure of yourself" : difficulty === "archmage" ? "supremely arrogant" : "smug and confident";
  const sys = `You are a debate Wizard who just delivered a rebuttal. Write ONE short in-character taunt sentence (max 18 words), themed to the debate TOPIC with wizard/arcane flavor. Be ${tone}. No profanity, no markdown, no quotes. Output ONLY the taunt.`;
  try {
    const t = (await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: `TOPIC: ${topic || "(unspecified)"}\nMY REBUTTAL: ${argument}` }], 0.9)).trim().replace(/^["']|["']$/g, "");
    return t.split("\n")[0].slice(0, 200);
  } catch { return ""; }
}
function fallbackArgument(topic: string, citations: Citation[]): string {
  const cited = citations.find((c) => c.snippet);
  if (cited) return `The case for "${topic || "this position"}" overlooks serious counter-evidence: ${cited.snippet.slice(0, 220)} That alone should give us pause.`;
  return `"${topic || "This position"}" is far less settled than it sounds. The opposing side rests on contested premises, and the burden of proof has not been met.`;
}
/** Generate + judge the wizard's turn, fully self-contained. */
async function runWizard(topic: string, opp: string, difficulty: Difficulty) {
  let grounding: Citation[] = [];
  try { grounding = await searchYouCom(buildAgainstQuery(topic)); } catch { grounding = []; }
  let argument: string;
  try { argument = (await writeRebuttal(topic, opp, grounding, difficulty)) || fallbackArgument(topic, grounding); }
  catch { argument = fallbackArgument(topic, grounding); }
  const taunt = await writeTaunt(topic, argument, difficulty);
  const judged = await judgePipeline(argument, topic); // judge runs its OWN fresh search -> authoritative citations
  return { argument, taunt, ...judged };
}

// ---------- db helpers ----------
async function dbSelect(table: string, q = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${q ? `?${q}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function dbInsert(table: string, rows: unknown[]): Promise<any[]> {
  const res = await fetch(`${DB}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function dbUpdate(table: string, q: string, patch: unknown): Promise<any[]> {
  const res = await fetch(`${DB}/${table}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function recomputeScore(room_id: string, side: "A" | "B", author: "player" | "wizard"): Promise<number> {
  const claims = await dbSelect("claims", `room_id=eq.${room_id}&author=eq.${author}&select=points`);
  const total = claims.reduce((s, c) => s + (Number(c.points) || 0), 0);
  const [player] = await dbSelect("players", `room_id=eq.${room_id}&side=eq.${side}&select=id`);
  if (player) { const [u] = await dbUpdate("players", `id=eq.${player.id}`, { score: total }); return u?.score ?? total; }
  return total;
}

// ---------- handler ----------
export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { room_id?: string; round_no?: number; opponent_argument?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const room_id = (body.room_id ?? "").trim();
  const round_no = Number(body.round_no);
  if (!room_id) return json({ error: "'room_id' is required." }, 400);
  if (!Number.isFinite(round_no) || round_no < 1) return json({ error: "'round_no' must be >= 1." }, 400);

  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total,difficulty`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);

    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.wizard&select=id`);
    if (dupe.length) return json({ error: "The wizard already argued this round." }, 409);

    const difficulty = normalizeDifficulty(room.difficulty);
    const judged = await runWizard(room.topic, (body.opponent_argument ?? "").trim(), difficulty);

    const [claim] = await dbInsert("claims", [{
      room_id, round_no, author: "wizard", argument: judged.argument,
      key_claim: judged.key_claim ?? null, verdict: judged.verdict ?? null, rationale: judged.rationale ?? null,
      points: judged.points ?? 0, scores: judged.scores ?? null, fallacies: judged.fallacies ?? [],
      taunt: judged.taunt || null, search_query: judged.search_query ?? null,
    }]);

    const cites = judged.citations ?? [];
    const inserted = cites.length
      ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null })))
      : [];

    const score = await recomputeScore(room_id, "B", "wizard");

    let roomOut = room;
    if (round_no >= room.rounds_total) {
      const [u] = await dbUpdate("rooms", `id=eq.${room_id}`, { status: "finished" });
      roomOut = u ?? { ...room, status: "finished" };
    }

    return json({ claim, citations: inserted, score, citation_index: judged.citation_index ?? null, taunt: judged.taunt || null, search_query: judged.search_query ?? null, room: roomOut });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
