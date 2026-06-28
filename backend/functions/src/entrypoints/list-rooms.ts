import { dbConfigError, dbSelect } from "../shared/db";
import { json, methodNotAllowed, options } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["GET", "POST"]);
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed("Use GET.", ["GET", "POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["GET", "POST"]);

  try {
    const rooms = await dbSelect<any>(
      "rooms",
      "status=eq.active&order=created_at.desc&limit=20&select=id,topic,status,difficulty,rounds_total,created_at",
    );
    if (!rooms.length) return json({ rooms: [] }, 200, ["GET", "POST"]);

    const ids = rooms.map((room) => room.id).join(",");
    const players = await dbSelect<any>("players", `room_id=in.(${ids})&select=room_id,side,score`);
    const scoresByRoom: Record<string, { A: number; B: number }> = {};
    for (const player of players) {
      const score = (scoresByRoom[player.room_id] ??= { A: 0, B: 0 });
      if (player.side === "A") score.A = player.score ?? 0;
      if (player.side === "B") score.B = player.score ?? 0;
    }

    return json({
      rooms: rooms.map((room) => ({
        id: room.id,
        topic: room.topic ?? null,
        status: room.status,
        difficulty: room.difficulty ?? null,
        rounds_total: room.rounds_total ?? null,
        created_at: room.created_at ?? null,
        scores: scoresByRoom[room.id] ?? { A: 0, B: 0 },
      })),
    }, 200, ["GET", "POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["GET", "POST"]);
  }
}
