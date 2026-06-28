import { dbConfigError, dbSelect } from "../shared/db";
import { json, options } from "../shared/http";

async function legacyLeaderboard(limit: number) {
  const players = await dbSelect<any>("players", `side=eq.A&order=score.desc&limit=${limit}&select=room_id,score`);
  if (!players.length) return [];

  const ids = players.map((player) => player.room_id).join(",");
  const rooms = await dbSelect<any>("rooms", `id=in.(${ids})&select=id,topic,status,created_at`);
  const roomById: Record<string, any> = {};
  for (const room of rooms) roomById[room.id] = room;

  return players.map((player) => ({
    room_id: player.room_id,
    score: player.score,
    topic: roomById[player.room_id]?.topic ?? null,
    status: roomById[player.room_id]?.status ?? null,
    created_at: roomById[player.room_id]?.created_at ?? null,
  }));
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["GET", "POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["GET", "POST"]);

  const limit = 20;
  try {
    let profiles: any[] = [];
    try {
      profiles = await dbSelect(
        "profiles",
        `order=wins.desc,total_score.desc&limit=${limit}&select=display_name,avatar_url,wins,losses,total_score`,
      );
    } catch {
      profiles = [];
    }

    if (profiles.length) {
      return json({
        leaderboard: profiles.map((profile) => ({
          display_name: profile.display_name ?? null,
          avatar_url: profile.avatar_url ?? null,
          wins: profile.wins ?? 0,
          losses: profile.losses ?? 0,
          total_score: profile.total_score ?? 0,
        })),
      }, 200, ["GET", "POST"]);
    }

    return json({ leaderboard: await legacyLeaderboard(limit) }, 200, ["GET", "POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["GET", "POST"]);
  }
}
