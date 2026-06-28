import { judgePipeline } from "../pipelines/judge";
import { dbConfigError, dbInsert, dbSelect, recomputeScore } from "../shared/db";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

const MAX_ARGUMENT_LENGTH = 4000;

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["POST"]);

  const body = await readJson<{ room_id?: string; round_no?: number; argument?: string }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const roomId = (body.room_id ?? "").trim();
  const argument = (body.argument ?? "").trim();
  const roundNo = Number(body.round_no);
  if (!roomId) return json({ error: "'room_id' is required." }, 400, ["POST"]);
  if (!argument) return json({ error: "'argument' is required." }, 400, ["POST"]);
  if (argument.length > MAX_ARGUMENT_LENGTH) return json({ error: `'argument' too long (max ${MAX_ARGUMENT_LENGTH} chars).` }, 400, ["POST"]);
  if (!Number.isFinite(roundNo) || roundNo < 1) return json({ error: "'round_no' must be >= 1." }, 400, ["POST"]);

  try {
    const [room] = await dbSelect<any>("rooms", `id=eq.${roomId}&select=id,topic,status,rounds_total`);
    if (!room) return json({ error: "Room not found." }, 404, ["POST"]);
    if (room.status === "finished") return json({ error: "This match is already finished." }, 409, ["POST"]);
    if (roundNo > room.rounds_total) return json({ error: `round_no exceeds rounds_total (${room.rounds_total}).` }, 400, ["POST"]);

    const dupe = await dbSelect("claims", `room_id=eq.${roomId}&round_no=eq.${roundNo}&author=eq.player&select=id`);
    if (dupe.length) return json({ error: "You already argued this round." }, 409, ["POST"]);

    const ruling = await judgePipeline(argument, room.topic);
    const [claim] = await dbInsert("claims", [{
      room_id: roomId,
      round_no: roundNo,
      author: "player",
      argument,
      key_claim: ruling.key_claim ?? null,
      verdict: ruling.verdict ?? null,
      rationale: ruling.rationale ?? null,
      points: ruling.points ?? 0,
      scores: ruling.scores ?? null,
      fallacies: ruling.fallacies ?? [],
      search_query: ruling.search_query ?? null,
    }]);

    const citations = ruling.citations ?? [];
    const inserted = citations.length
      ? await dbInsert("citations", citations.map((citation) => ({
          claim_id: claim.id,
          title: citation.title ?? null,
          url: citation.url ?? null,
          snippet: citation.snippet ?? null,
        })))
      : [];

    const score = await recomputeScore(roomId, "A", "player");
    return json({
      claim,
      citations: inserted,
      score,
      citation_index: ruling.citation_index ?? null,
      search_query: ruling.search_query ?? null,
    }, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
