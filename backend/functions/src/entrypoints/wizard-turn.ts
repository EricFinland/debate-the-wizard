import { normalizeDifficulty } from "../domain/scoring";
import { wizardPipeline } from "../pipelines/wizard";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);

  const body = await readJson<{
    room_id?: string;
    topic?: string;
    side_label?: string;
    round_no?: number;
    opponent_argument?: string;
    difficulty?: string;
  }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const topic = (body.topic ?? "").trim();
  if (!topic) return json({ error: "Field 'topic' is required." }, 400, ["POST"]);

  try {
    const result = await wizardPipeline(
      topic,
      (body.opponent_argument ?? "").trim(),
      normalizeDifficulty(body.difficulty),
    );
    return json(result, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
