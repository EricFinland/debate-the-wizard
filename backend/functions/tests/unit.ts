import assert from "node:assert/strict";
import { test } from "node:test";
import { clampScore, normalizeDifficulty } from "../src/domain/scoring";
import { normalizeWizardJudgment, shapeWizardFallback } from "../src/pipelines/wizard";
import { normalizeYouComResults } from "../src/shared/search";
import { parseModelJson } from "../src/utils/json";

test("normalizeYouComResults accepts common You.com response shapes", () => {
  const citations = normalizeYouComResults({
    results: {
      web: [
        { title: "A", url: "https://example.com/a", snippets: [" first ", "second"] },
        { title: "No snippet", url: "https://example.com/skip" },
      ],
      news: [{ title: "B", link: "https://example.com/b", description: "news snippet" }],
    },
  }, 5);

  assert.deepEqual(citations, [
    { title: "A", url: "https://example.com/a", snippet: "first  second" },
    { title: "B", url: "https://example.com/b", snippet: "news snippet" },
  ]);
});

test("parseModelJson tolerates fenced and prefixed model JSON", () => {
  assert.deepEqual(parseModelJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```"), { ok: true });
  assert.deepEqual(parseModelJson<{ ok: boolean }>("Result:\n{\"ok\":false}\nthanks"), { ok: false });
});

test("score and difficulty normalization are bounded", () => {
  assert.equal(clampScore(12.7), 10);
  assert.equal(clampScore(-2), 0);
  assert.equal(clampScore("7.2"), 7);
  assert.equal(normalizeDifficulty("ARCHMAGE"), "archmage");
  assert.equal(normalizeDifficulty("unknown"), "adept");
});

test("wizard fallback is conservative and citation-safe", () => {
  const fallback = shapeWizardFallback("A rebuttal", [{ title: "T", url: "https://e.test", snippet: "S" }]);
  assert.equal(fallback.verdict, "unsupported");
  assert.equal(fallback.points, 0);
  assert.equal(fallback.citation_index, 0);
});

test("wizard judgment re-anchors citation index when falling back to grounding citations", () => {
  const result = normalizeWizardJudgment(
    "A rebuttal",
    { verdict: "supported", points: 10, citation_index: 4, citations: [] },
    [{ title: "Grounding", url: "https://e.test", snippet: "Snippet" }],
    "A taunt",
  );

  assert.equal(result.citation_index, 0);
  assert.equal(result.taunt, "A taunt");
});
