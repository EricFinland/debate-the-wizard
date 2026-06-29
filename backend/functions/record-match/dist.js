// backend/functions/_shared/config.ts
var env = (k, fallback = "") => Deno.env.get(k) ?? fallback;
var DEFAULT_BASE = "https://4eychqk3.us-east.insforge.app";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// backend/functions/_shared/db.ts
function makeDb(base, key) {
  const db = `${base}/api/database/records`;
  const H = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  async function dbSelect2(table, query = "") {
    const res = await fetch(`${db}/${table}${query ? `?${query}` : ""}`, { headers: H });
    if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbInsert2(table, rows) {
    const res = await fetch(`${db}/${table}`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(rows)
    });
    if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  async function dbUpdate2(table, query, patch) {
    const res = await fetch(`${db}/${table}?${query}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`update ${table} ${query} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  return { dbSelect: dbSelect2, dbInsert: dbInsert2, dbUpdate: dbUpdate2 };
}

// backend/functions/record-match/index.ts
var BASE = (env("INSFORGE_API_URL") || DEFAULT_BASE).replace(/\/+$/, "");
var DATA = (env("INSFORGE_DATA_URL") || BASE).replace(/\/+$/, "");
var KEY = env("INSFORGE_API_KEY");
var { dbSelect, dbInsert, dbUpdate } = makeDb(DATA, KEY);
async function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  if (!BASE || !KEY) return json({ error: "INSFORGE_API_URL / INSFORGE_API_KEY not configured." }, 500);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const user_id = typeof body?.user_id === "string" ? body.user_id.trim() : "";
  if (!user_id) return json({ error: "user_id is required." }, 400);
  const won = body?.won === true ? true : body?.won === false ? false : null;
  const rawScore = Number(body?.score);
  const score = Number.isFinite(rawScore) ? Math.trunc(rawScore) : 0;
  const display_name = typeof body?.display_name === "string" && body.display_name.trim() ? body.display_name.trim().slice(0, 120) : null;
  const avatar_url = typeof body?.avatar_url === "string" && body.avatar_url.trim() ? body.avatar_url.trim() : null;
  const email_verified = body?.email_verified === true;
  const wInc = won === true ? 1 : 0;
  const lInc = won === false ? 1 : 0;
  const tInc = won === null ? 1 : 0;
  try {
    const existing = await dbSelect(
      "profiles",
      `user_id=eq.${encodeURIComponent(user_id)}&limit=1`
    );
    let profile;
    if (existing.length) {
      const cur = existing[0];
      const patch = {
        wins: (Number(cur.wins) || 0) + wInc,
        losses: (Number(cur.losses) || 0) + lInc,
        ties: (Number(cur.ties) || 0) + tInc,
        total_score: (Number(cur.total_score) || 0) + score,
        // never overwrite an existing true with false: verified = existing OR email_verified
        verified: Boolean(cur.verified) || email_verified,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (display_name !== null) patch.display_name = display_name;
      if (avatar_url !== null) patch.avatar_url = avatar_url;
      const updated = await dbUpdate(
        "profiles",
        `user_id=eq.${encodeURIComponent(user_id)}`,
        patch
      );
      profile = updated[0] ?? { ...cur, ...patch };
    } else {
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
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        ]);
        profile = inserted[0] ?? null;
      } catch {
        const [cur] = await dbSelect(
          "profiles",
          `user_id=eq.${encodeURIComponent(user_id)}&limit=1`
        );
        if (!cur) throw new Error("profile insert failed and no existing row found.");
        const patch = {
          wins: (Number(cur.wins) || 0) + wInc,
          losses: (Number(cur.losses) || 0) + lInc,
          ties: (Number(cur.ties) || 0) + tInc,
          total_score: (Number(cur.total_score) || 0) + score,
          // never overwrite an existing true with false: verified = existing OR email_verified
          verified: Boolean(cur.verified) || email_verified,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (display_name !== null) patch.display_name = display_name;
        if (avatar_url !== null) patch.avatar_url = avatar_url;
        const updated = await dbUpdate(
          "profiles",
          `user_id=eq.${encodeURIComponent(user_id)}`,
          patch
        );
        profile = updated[0] ?? { ...cur, ...patch };
      }
    }
    return json({ profile });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
export {
  index_default as default
};
