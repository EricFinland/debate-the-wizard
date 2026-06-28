// list-rooms — active-room feed for the spectator lobby. Read-only.
//
// GET (or POST) -> { rooms: [{ id, topic, status, difficulty, rounds_total, created_at, scores:{A,B} }] }
// Returns the latest ~20 active rooms (status='active'), most recent first.
//
// Deploy: npx @insforge/cli functions deploy list-rooms --file backend/functions/list-rooms/index.ts --name "List rooms"

import { CORS, DEFAULT_BASE, env, json } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";

const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect } = makeDb(DATA, KEY);

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Use GET." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  try {
    const rooms = await dbSelect(
      "rooms",
      "status=eq.active&order=created_at.desc&limit=20&select=id,topic,status,difficulty,rounds_total,created_at",
    );
    if (!rooms.length) return json({ rooms: [] });

    const ids = rooms.map((r) => r.id).join(",");
    const players = await dbSelect("players", `room_id=in.(${ids})&select=room_id,side,score`);

    // scores per room: side A (human) vs side B (wizard)
    const scoresByRoom: Record<string, { A: number; B: number }> = {};
    for (const p of players) {
      const s = (scoresByRoom[p.room_id] ??= { A: 0, B: 0 });
      if (p.side === "A") s.A = p.score ?? 0;
      else if (p.side === "B") s.B = p.score ?? 0;
    }

    const out = rooms.map((r) => ({
      id: r.id,
      topic: r.topic ?? null,
      status: r.status,
      difficulty: r.difficulty ?? null,
      rounds_total: r.rounds_total ?? null,
      created_at: r.created_at ?? null,
      scores: scoresByRoom[r.id] ?? { A: 0, B: 0 },
    }));

    return json({ rooms: out });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
