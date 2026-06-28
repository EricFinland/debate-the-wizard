// leaderboard — ranks VERIFIED profiles by lifetime wins, then total score.
// Only profiles with verified=true (OAuth-verified players) are eligible.
// Returns an empty list when there are no verified champions yet — it does NOT
// fall back to listing nameless one-off players (that produced "unknown users").
//
// GET (or POST) -> { leaderboard: [{ display_name, avatar_url, wins, losses, total_score }] }
//
// Deploy: npx @insforge/cli functions deploy leaderboard --file functions/leaderboard/index.ts --name "Leaderboard"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

const DEFAULT_BASE = "https://atjgzcv9.us-east.insforge.app";
const BASE = ((Deno.env.get("INSFORGE_API_URL") ?? "") || DEFAULT_BASE).replace(/\/+$/, "");
const DATA = ((Deno.env.get("INSFORGE_DATA_URL") ?? "") || BASE).replace(/\/+$/, "");
const KEY = Deno.env.get("INSFORGE_API_KEY") ?? "";
const DB = `${DATA}/api/database/records`;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function dbSelect(table: string, query = ""): Promise<any[]> {
  const res = await fetch(`${DB}/${table}${query ? `?${query}` : ""}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  const limit = 20;
  try {
    const profiles = await dbSelect(
      "profiles",
      `verified=eq.true&order=wins.desc,total_score.desc&limit=${limit}&select=display_name,avatar_url,wins,losses,total_score`,
    );
    const leaderboard = profiles.map((p) => ({
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      total_score: p.total_score ?? 0,
    }));
    return json({ leaderboard });
  } catch {
    // Never hard-fail — an empty leaderboard is fine; we never list nameless players.
    return json({ leaderboard: [] });
  }
}
