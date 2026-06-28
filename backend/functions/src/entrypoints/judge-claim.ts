import { judgePipeline } from "../pipelines/judge";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);

  const body = await readJson<{ argument?: string; topic?: string }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const argument = (body.argument ?? "").trim();
  const topic = (body.topic ?? "").trim();
  if (!argument) return json({ error: "Field 'argument' is required." }, 400, ["POST"]);

  try {
    const result = await judgePipeline(argument, topic);
    return json(result, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
