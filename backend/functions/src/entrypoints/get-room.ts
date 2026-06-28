import { dbConfigError, dbSelect } from "../shared/db";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("Use POST.", ["POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["POST"]);

  const body = await readJson<{ room_id?: string }>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);
  const roomId = (body.room_id ?? "").trim();
  if (!roomId) return json({ error: "'room_id' is required." }, 400, ["POST"]);

  try {
    const [room] = await dbSelect<any>("rooms", `id=eq.${roomId}`);
    if (!room) return json({ error: "Room not found." }, 404, ["POST"]);

    const players = await dbSelect<any>("players", `room_id=eq.${roomId}&order=side.asc`);
    const claims = await dbSelect<any>("claims", `room_id=eq.${roomId}&order=created_at.asc`);

    const citationsByClaim: Record<string, any[]> = {};
    if (claims.length) {
      const ids = claims.map((claim) => claim.id).join(",");
      const citations = await dbSelect<any>("citations", `claim_id=in.(${ids})`);
      for (const citation of citations) {
        (citationsByClaim[citation.claim_id] ??= []).push(citation);
      }
    }

    const scores = {
      A: players.find((player) => player.side === "A")?.score ?? 0,
      B: players.find((player) => player.side === "B")?.score ?? 0,
    };
    const winner = room.status === "finished" ? (scores.A > scores.B ? "A" : scores.B > scores.A ? "B" : "tie") : null;

    return json({
      room,
      players,
      scores,
      claims: claims.map((claim) => ({ ...claim, citations: citationsByClaim[claim.id] ?? [] })),
      winner,
    }, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
