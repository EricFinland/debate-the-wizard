# The Judge pipeline — how a claim gets scored

The Judge is the heart of the game. It takes any debate argument, grounds it in fresh
**You.com** search, and returns a single verdict plus a four-dimension scorecard, fallacy
list, and the exact citation it relied on, all in one edge function.

Source of truth: [`functions/judge-claim/index.ts`](../functions/judge-claim/index.ts).
It is a **pure** function: inputs in, JSON out. No database, no realtime. That's why the
same pipeline can be built once and called twice (player and wizard) by the orchestration
layer.

## Contract

```
POST /functions/judge-claim
{ "argument": "...", "topic": "..." }   // topic is optional context
->
{
  "key_claim": "the single testable claim the Judge extracted",
  "verdict": "supported" | "unsupported" | "misleading",
  "rationale": "<= 20 words",
  "points": 10,                          // derived from verdict
  "scores": { "factual_accuracy": 8, "logic": 7, "evidence": 9, "persuasiveness": 6 },
  "fallacies": [],                       // e.g. ["straw man", "ad hominem"]
  "citations": [{ "title": "...", "url": "...", "snippet": "..." }],
  "citation_index": 0                    // which citation the verdict relied on, or null
}
```

## The pipeline, step by step

### 1. Extract a searchable query (Claude, fast model)
The raw argument is rhetorical, not searchable. A first model call
(`EXTRACT_MODEL`, default `anthropic/claude-3.5-haiku`, via the InsForge model gateway)
compresses the argument into **one concise web-search query (max ~12 words)** targeting
its single most important factual claim.
- Reached through the gateway's OpenAI-compatible endpoint:
  `POST {INSFORGE_API_URL}/v1/chat/completions` with a bearer token.
- **Fallback:** if extraction fails, the pipeline searches the first 200 chars of the raw
  argument directly. It never aborts here.

### 2. Ground it in You.com (the win condition)
The query goes to the **You.com Search API**
(`POST https://api.you.com/v1/search`, `X-API-Key` from the `YOUCOM_API_KEY` secret,
`count` = `SEARCH_COUNT`, default 6). Results are normalized defensively (the code accepts
several possible response shapes) into a clean `Citation[]` of `{ title, url, snippet }`,
dropping any result without a usable snippet.

This is the grounding step that makes scoring possible. **No search means no grounding,
which means no verdict, which means no game.** The citations returned here are exactly what
the UI shows on screen and what the recap citation trail is built from.

### 3. Judge + score in ONE Claude call
The argument and the numbered list of You.com snippets go to the Judge model
(`JUDGE_MODEL`, default `anthropic/claude-3.5-sonnet`, via the gateway). A single call
returns everything:
- **`key_claim`** — the one testable factual claim extracted from the argument.
- **`verdict`** — ruled strictly against the snippets:
  - `supported` — a snippet clearly backs the claim.
  - `unsupported` — no snippet addresses it.
  - `misleading` — a snippet contradicts or undercuts it. (This is the money-shot verdict.)
- **`scores`** — four dimensions, 0-10 each: `factual_accuracy` (claim vs snippets),
  `evidence` (strength/relevance of the cited snippets), `logic` (soundness of reasoning),
  `persuasiveness` (rhetorical force).
- **`fallacies`** — named logical fallacies present (`[]` if none, capped at 5).
- **`citation_index`** — the index of the snippet the verdict relied on, or `null`.

Doing this in one call keeps the per-turn latency to two model hops plus one search, fast
enough for a live arena, and keeps the verdict, scorecard, and fallacies internally
consistent (they're reasoned together, not stitched from separate calls).

### 4. Scoring (game points from the verdict)
The game score is a pure function of the verdict, not the scorecard:

| Verdict | `points` |
|---|---|
| `supported` | **+10** |
| `unsupported` | **0** |
| `misleading` | **-5** |

`scores` and `fallacies` are for the on-screen scorecard and tiebreaks; they do **not**
change `points`. This keeps the core scoring legible and impossible to game with flowery
language: only a sourced, true claim earns points.

## Robustness (why it won't crash on stage)

The Judge is built to degrade gracefully, never to error mid-demo:

- **No sources found** -> returns a clean `unsupported` verdict (+0) with a clear
  rationale, instead of throwing. The match keeps moving.
- **Extraction failure** -> falls back to searching the raw argument.
- **LLM returns non-JSON** -> a tolerant parser strips code fences and pulls the first
  `{...}` block; if it still can't parse, it returns a safe `unsupported` default.
- **Invalid verdict / out-of-range citation index** -> coerced to `unsupported` / `null`.
- **Dimension scores** -> clamped to integers in 0-10 (`clampScore`), so a malformed
  scorecard can't poison the UI.
- **Gateway or You.com HTTP error** -> surfaces a `500` with a short, truncated detail
  message (no secret leakage), so failures are diagnosable but not noisy.
- **CORS + OPTIONS** handled, and non-POST methods rejected with `405`.

## Configuration (env / secrets)

| Key | Purpose | Default |
|---|---|---|
| `YOUCOM_API_KEY` | You.com Search API key (`X-API-Key`) | required |
| `INSFORGE_API_URL` | model gateway base (`/v1/chat/completions`) | required |
| `INSFORGE_API_KEY` | bearer for the gateway | required |
| `JUDGE_MODEL` | judging + scoring model | `anthropic/claude-3.5-sonnet` |
| `EXTRACT_MODEL` | query-extraction model | `anthropic/claude-3.5-haiku` |
| `SEARCH_COUNT` | You.com results to fetch | `6` |

## Where it sits in the system

The Judge is called over HTTP by the orchestration functions, never directly by the
client:
- `submit-argument` runs it for the **player** (side A).
- `advance-wizard` runs it for the **wizard** (side B), unless `wizard-turn` already
  returned a full judged shape (see [debater-pipeline.md](debater-pipeline.md)).

Because both sides go through the identical Judge, the wizard can also be ruled
`misleading` and lose a round, which is the demo's strongest moment.
