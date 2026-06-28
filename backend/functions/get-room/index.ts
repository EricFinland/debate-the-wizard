// get-room — full room state for reconnect, spectating, and the end-game recap.
// Read-only.
//
// POST { "room_id": uuid }
// Returns { room, players, scores, claims (each with citations), winner }.
//
// Deploy: npx @insforge/cli functions deploy get-room --file backend/functions/get-room/index.ts --name "Get room"

import { CORS, DEFAULT_BASE, env, json } from "../_shared/config.ts";
import { makeDb } from "../_shared/db.ts";

const BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
const KEY = env("INSFORGE_API_KEY");

const { dbSelect } = makeDb(DATA, KEY);

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: { room_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const room_id = (body.room_id ?? "").trim();
  if (!room_id) return json({ error: "'room_id' is required." }, 400);

  try {
    const [room] = await dbSelect("rooms", `id=eq.${room_id}`);
    if (!room) return json({ error: "Room not found." }, 404);

    const players = await dbSelect("players", `room_id=eq.${room_id}&order=side.asc`);
    const claims = await dbSelect("claims", `room_id=eq.${room_id}&order=created_at.asc`);

    // attach citations for all claims in one query
    let citationsByClaim: Record<string, any[]> = {};
    if (claims.length) {
      const ids = claims.map((c) => c.id).join(",");
      const citations = await dbSelect("citations", `claim_id=in.(${ids})`);
      for (const cit of citations) {
        (citationsByClaim[cit.claim_id] ??= []).push(cit);
      }
    }
    const claimsWithCites = claims.map((c) => ({ ...c, citations: citationsByClaim[c.id] ?? [] }));

    const scores = {
      A: players.find((p) => p.side === "A")?.score ?? 0,
      B: players.find((p) => p.side === "B")?.score ?? 0,
    };
    let winner: "A" | "B" | "tie" | null = null;
    if (room.status === "finished") {
      winner = scores.A > scores.B ? "A" : scores.B > scores.A ? "B" : "tie";
    }

    return json({ room, players, scores, claims: claimsWithCites, winner });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
