// record-match — upsert a player's lifetime stats into `profiles` after a match.
//
// POST { user_id, display_name?, avatar_url?, won: boolean|null (null = tie), score: number }
//   -> if a profile with this user_id exists: increment wins/losses/ties, add `score`
//      to total_score, refresh display_name/avatar_url/updated_at.
//      else: insert a new profile row seeded from this match.
//   -> { profile }
//
// Self-contained: no calls to other edge functions (InsForge runs all functions as one
// Deno deployment, so cross-function fetch returns 508 Loop Detected). Uses the data API directly.
//
// Deploy: npx @insforge/cli functions deploy record-match --file functions/record-match/index.ts --name "Record Match"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: CORS });

// Fall back to the known project URL if INSFORGE_API_URL is not in the deployment env.
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

async function dbInsert(table: string, rows: any[]): Promise<any[]> {
  const res = await fetch(`${DB}/${table}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function dbUpdate(table: string, query: string, patch: any): Promise<any[]> {
  const res = await fetch(`${DB}/${table}?${query}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const user_id = typeof body?.user_id === "string" ? body.user_id.trim() : "";
  if (!user_id) return json({ error: "user_id is required." }, 400);

  // won: true = win, false = loss, null/undefined = tie
  const won: boolean | null = body?.won === true ? true : body?.won === false ? false : null;

  const rawScore = Number(body?.score);
  const score = Number.isFinite(rawScore) ? Math.trunc(rawScore) : 0;

  const display_name =
    typeof body?.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim().slice(0, 120)
      : null;
  const avatar_url =
    typeof body?.avatar_url === "string" && body.avatar_url.trim() ? body.avatar_url.trim() : null;

  // email_verified: only ever flips `verified` from false -> true, never back.
  const email_verified = body?.email_verified === true;

  const wInc = won === true ? 1 : 0;
  const lInc = won === false ? 1 : 0;
  const tInc = won === null ? 1 : 0;

  try {
    const existing = await dbSelect(
      "profiles",
      `user_id=eq.${encodeURIComponent(user_id)}&limit=1`,
    );

    let profile: any;
    if (existing.length) {
      const cur = existing[0];
      const patch: any = {
        wins: (Number(cur.wins) || 0) + wInc,
        losses: (Number(cur.losses) || 0) + lInc,
        ties: (Number(cur.ties) || 0) + tInc,
        total_score: (Number(cur.total_score) || 0) + score,
        // never overwrite an existing true with false: verified = existing OR email_verified
        verified: Boolean(cur.verified) || email_verified,
        updated_at: new Date().toISOString(),
      };
      if (display_name !== null) patch.display_name = display_name;
      if (avatar_url !== null) patch.avatar_url = avatar_url;

      const updated = await dbUpdate(
        "profiles",
        `user_id=eq.${encodeURIComponent(user_id)}`,
        patch,
      );
      profile = updated[0] ?? { ...cur, ...patch };
    } else {
      // NOTE: the profiles table has no created_at column (see migration), only
      // updated_at. Inserting an unknown column makes PostgREST reject the row.
      try {
        const inserted = await dbInsert("profiles", [
          {
            user_id,
            display_name,
            avatar_url,
            wins: wInc,
            losses: lInc,
            ties: tInc,
            total_score: score,
            verified: email_verified,
            updated_at: new Date().toISOString(),
          },
        ]);
        profile = inserted[0] ?? null;
      } catch {
        // Lost an insert race (user_id is the PK): another concurrent call created
        // the row first. Re-read and apply this match as an increment instead so
        // the upsert math stays correct under concurrency.
        const [cur] = await dbSelect(
          "profiles",
          `user_id=eq.${encodeURIComponent(user_id)}&limit=1`,
        );
        if (!cur) throw new Error("profile insert failed and no existing row found.");
        const patch: any = {
          wins: (Number(cur.wins) || 0) + wInc,
          losses: (Number(cur.losses) || 0) + lInc,
          ties: (Number(cur.ties) || 0) + tInc,
          total_score: (Number(cur.total_score) || 0) + score,
          // never overwrite an existing true with false: verified = existing OR email_verified
          verified: Boolean(cur.verified) || email_verified,
          updated_at: new Date().toISOString(),
        };
        if (display_name !== null) patch.display_name = display_name;
        if (avatar_url !== null) patch.avatar_url = avatar_url;
        const updated = await dbUpdate(
          "profiles",
          `user_id=eq.${encodeURIComponent(user_id)}`,
          patch,
        );
        profile = updated[0] ?? { ...cur, ...patch };
      }
    }

    return json({ profile });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
