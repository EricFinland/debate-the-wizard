import { normalizeDifficulty } from "../domain/scoring";
import { SEED_TOPICS } from "../domain/topics";
import { dbConfigError, dbInsert } from "../shared/db";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["POST"]);

  const body = await readJson<{
    topic?: string;
    topic_id?: string;
    rounds_total?: number;
    difficulty?: string;
    host_user_id?: string;
  }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const seed = body.topic_id ? SEED_TOPICS[body.topic_id] : undefined;
  const topic = (seed?.topic ?? body.topic ?? "").trim();
  if (!topic) return json({ error: "Provide 'topic' or a valid 'topic_id'." }, 400, ["POST"]);

  const roundsTotal = Math.max(1, Math.min(10, Number(body.rounds_total) || 5));
  const difficulty = normalizeDifficulty(body.difficulty);
  const hostUserId = typeof body.host_user_id === "string" && body.host_user_id.trim() ? body.host_user_id.trim() : null;

  try {
    const [room] = await dbInsert("rooms", [{ topic, status: "active", rounds_total: roundsTotal, difficulty, host_user_id: hostUserId }]);
    const players = await dbInsert("players", [
      { room_id: room.id, side: "A", score: 0 },
      { room_id: room.id, side: "B", score: 0 },
    ]);
    return json({
      room,
      players,
      topic_meta: seed ? { id: body.topic_id, ...seed } : { topic },
    }, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
