// backend/functions/_lib/index.ts
var env = (k, fb = "") => Deno.env.get(k) ?? fb;
var SCORE = { supported: 10, unsupported: 0, misleading: -5 };
var JUDGE_MODEL = env("JUDGE_MODEL", "anthropic/claude-sonnet-4.6");
var EXTRACT_MODEL = env("EXTRACT_MODEL", "anthropic/claude-haiku-4.5");
var SEARCH_COUNT = Number(env("SEARCH_COUNT", "6")) || 6;
var DEFAULT_BASE = "https://atjgzcv9.us-east.insforge.app";
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var DB = `${DATA}/api/database/records`;
var H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
var json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });
var ZERO_SCORES = { factual_accuracy: 0, logic: 0, evidence: 0, persuasiveness: 0 };
function stripFences(s) {
  return s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}
function parseJson(text) {
  const c = stripFences(text);
  try {
    return JSON.parse(c);
  } catch {
    const m = c.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
      }
    }
    return null;
  }
}
function clampScore(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
}
async function chat(model, messages, temperature = 0) {
  const key = env("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not configured.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature })
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
async function searchYouCom(query) {
  const key = env("YOUCOM_API_KEY");
  if (!key) throw new Error("YOUCOM_API_KEY not set.");
  const url = new URL("https://api.you.com/v1/search");
  url.searchParams.set("query", query);
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) throw new Error(`You.com ${res.status}`);
  const data = await res.json();
  const web = data?.results?.web ?? data?.web ?? data?.hits ?? data?.results ?? [];
  const out = [];
  for (const r of web) {
    const snips = r?.snippets ?? (r?.snippet ? [r.snippet] : r?.description ? [r.description] : []);
    const snippet = snips.filter(Boolean).join(" ").trim();
    if (!snippet) continue;
    out.push({ title: String(r?.title ?? "").trim(), url: String(r?.url ?? r?.link ?? "").trim(), snippet });
    if (out.length >= SEARCH_COUNT) break;
  }
  return out;
}
async function extractSearchQuery(argument, topic, temperature = 0) {
  const sys = "You turn a debate argument into ONE concise web-search query (max 12 words) targeting its single most important factual claim. Reply with ONLY the query text, no quotes.";
  try {
    const q = (await chat(EXTRACT_MODEL, [{ role: "system", content: sys }, {
      role: "user", content: `TOPIC: ${topic || "(unspecified)"}
ARGUMENT: ${argument}`
    }], temperature)).trim().replace(/^["']|["']$/g, "");
    return q || argument.slice(0, 200);
  } catch {
    return argument.slice(0, 200);
  }
}
async function judgeVerdict(argument, citations, temperature = 0) {
  const list = citations.map((c, i) => `[${i}] ${c.title} (${c.url})
${c.snippet}`).join("\n\n");
  const sys = 'You are a debate fact-checker and scorer. Given an ARGUMENT and SEARCH SNIPPETS: 1) extract the single most important factual claim; 2) rule supported/unsupported/misleading; 3) score 0-10 on factual_accuracy, logic, evidence, persuasiveness; 4) name any fallacies. Return ONLY JSON: {"key_claim":"...","verdict":"supported|unsupported|misleading","rationale":"<=20 words","citation_index":<int or null>,"scores":{"factual_accuracy":0,"logic":0,"evidence":0,"persuasiveness":0},"fallacies":[]}. supported = a snippet clearly backs the claim; unsupported = none addresses it; misleading = a snippet contradicts it. citation_index is the snippet you relied on, or null.';
  const raw = await chat(JUDGE_MODEL, [{ role: "system", content: sys }, {
    role: "user", content: `ARGUMENT:
${argument}

SEARCH SNIPPETS:
${list || "(none found)"}`
  }], temperature);
  const p = parseJson(raw);
  if (!p) return { key_claim: argument.slice(0, 200), verdict: "unsupported", rationale: "Judge response could not be parsed.", scores: ZERO_SCORES, fallacies: [], citation_index: null };
  const verdict = ["supported", "unsupported", "misleading"].includes(p.verdict) ? p.verdict : "unsupported";
  const ci = typeof p.citation_index === "number" && p.citation_index >= 0 && p.citation_index < citations.length ? p.citation_index : null;
  return {
    key_claim: p.key_claim || argument.slice(0, 200),
    verdict,
    rationale: p.rationale || "",
    scores: { factual_accuracy: clampScore(p.scores?.factual_accuracy), logic: clampScore(p.scores?.logic), evidence: clampScore(p.scores?.evidence), persuasiveness: clampScore(p.scores?.persuasiveness) },
    fallacies: Array.isArray(p.fallacies) ? p.fallacies.filter((f) => typeof f === "string" && f.trim()).slice(0, 5) : [],
    citation_index: ci
  };
}
async function judgePipeline(argument, topic) {
  const query = await extractSearchQuery(argument, topic);
  let citations = [];
  try {
    citations = await searchYouCom(query);
  } catch {
    citations = [];
  }
  if (!citations.length) return { key_claim: query, verdict: "unsupported", rationale: "No sources found to support this claim.", points: SCORE.unsupported, scores: ZERO_SCORES, fallacies: [], citations: [], citation_index: null, search_query: query };
  const r = await judgeVerdict(argument, citations);
  return { key_claim: r.key_claim, verdict: r.verdict, rationale: r.rationale, points: SCORE[r.verdict], scores: r.scores, fallacies: r.fallacies, citations, citation_index: r.citation_index, search_query: query };
}
async function dbSelect(table, q = "") {
  const res = await fetch(`${DB}/${table}${q ? `?${q}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function dbInsert(table, rows) {
  const res = await fetch(`${DB}/${table}`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function dbUpdate(table, q, patch) {
  const res = await fetch(`${DB}/${table}?${q}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
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

// backend/functions/submit-argument/index.ts
var MAX_ARG = 4e3;
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
    const [room] = await dbSelect("rooms", `id=eq.${room_id}&select=id,topic,status,rounds_total`);
    if (!room) return json({ error: "Room not found." }, 404);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409);
    if (round_no > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400);
    const dupe = await dbSelect("claims", `room_id=eq.${room_id}&round_no=eq.${round_no}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409);
    const ruling = await judgePipeline(argument, room.topic);
    const [claim] = await dbInsert("claims", [{
      room_id,
      round_no,
      author: "player",
      argument,
      key_claim: ruling.key_claim ?? null,
      verdict: ruling.verdict ?? null,
      rationale: ruling.rationale ?? null,
      points: ruling.points ?? 0,
      scores: ruling.scores ?? null,
      fallacies: ruling.fallacies ?? [],
      search_query: ruling.search_query ?? null
    }]);
    const cites = ruling.citations ?? [];
    const inserted = cites.length ? await dbInsert("citations", cites.map((c) => ({ claim_id: claim.id, title: c.title ?? null, url: c.url ?? null, snippet: c.snippet ?? null }))) : [];
    const score = await recomputeScore(room_id, "A", "player");
    return json({ claim, citations: inserted, score, citation_index: ruling.citation_index ?? null, search_query: ruling.search_query ?? null });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
