// get-room — full room state for reconnect, spectating, and the end-game recap.
// ("the rest" track). Read-only.
//
// POST { "room_id": uuid }
// Returns { room, players, scores, claims (each with citations), winner }.
//
// Deploy: npx @insforge/cli functions deploy get-room --file functions/get-room/index.ts --name "Get room"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

const BASE = (Deno.env.get("INSFORGE_API_URL") ?? "").replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${BASE}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function dbSelect(table: string, query = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${query ? `?${query}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

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
