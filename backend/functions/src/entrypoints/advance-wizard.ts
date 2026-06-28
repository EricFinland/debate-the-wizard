import { normalizeDifficulty } from "../domain/scoring";
import { wizardPipeline } from "../pipelines/wizard";
import { dbConfigError, dbInsert, dbSelect, dbUpdate, recomputeScore } from "../shared/db";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["POST"]);

  const body = await readJson<{ room_id?: string; round_no?: number; opponent_argument?: string }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const roomId = (body.room_id ?? "").trim();
  const roundNo = Number(body.round_no);
  if (!roomId) return json({ error: "'room_id' is required." }, 400, ["POST"]);
  if (!Number.isFinite(roundNo) || roundNo < 1) return json({ error: "'round_no' must be >= 1." }, 400, ["POST"]);

  try {
    const [room] = await dbSelect<any>("rooms", `id=eq.${roomId}&select=id,topic,status,rounds_total,difficulty`);
    if (!room) return json({ error: "Room not found." }, 404, ["POST"]);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409, ["POST"]);
    if (roundNo > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400, ["POST"]);

    const dupe = await dbSelect("claims", `room_id=eq.${roomId}&round_no=eq.${roundNo}&author=eq.wizard&select=id`);
    if (dupe.length) return json({ error: "The wizard already argued this round." }, 409, ["POST"]);

    const judged = await wizardPipeline(room.topic, (body.opponent_argument ?? "").trim(), normalizeDifficulty(room.difficulty));
    const [claim] = await dbInsert("claims", [{
      room_id: roomId,
      round_no: roundNo,
      author: "wizard",
      argument: judged.argument,
      key_claim: judged.key_claim ?? null,
      verdict: judged.verdict ?? null,
      rationale: judged.rationale ?? null,
      points: judged.points ?? 0,
      scores: judged.scores ?? null,
      fallacies: judged.fallacies ?? [],
      taunt: judged.taunt || null,
      search_query: judged.search_query ?? null,
    }]);

    const citations = judged.citations ?? [];
    const inserted = citations.length
      ? await dbInsert("citations", citations.map((citation) => ({
          claim_id: claim.id,
          title: citation.title ?? null,
          url: citation.url ?? null,
          snippet: citation.snippet ?? null,
        })))
      : [];

    const score = await recomputeScore(roomId, "B", "wizard");
    let roomOut = room;
    if (roundNo >= room.rounds_total) {
      const [updated] = await dbUpdate("rooms", `id=eq.${roomId}`, { status: "finished" });
      roomOut = updated ?? { ...room, status: "finished" };
    }

    return json({
      claim,
      citations: inserted,
      score,
      citation_index: judged.citation_index ?? null,
      taunt: judged.taunt || null,
      search_query: judged.search_query ?? null,
      room: roomOut,
    }, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
