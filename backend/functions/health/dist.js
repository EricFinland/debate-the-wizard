// backend/functions/health/index.ts
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
function index_default(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = {
    ok: true,
    service: "debate-the-wizard",
    time: (/* @__PURE__ */ new Date()).toISOString(),
    // booleans only — never leak secret values
    config: {
      gateway: Boolean(Deno.env.get("INSFORGE_API_URL")),
      db: Boolean(Deno.env.get("INSFORGE_API_KEY")),
      youcom: Boolean(Deno.env.get("YOUCOM_API_KEY"))
    }
  };
  return new Response(JSON.stringify(body), { status: 200, headers: CORS });
}
export {
  index_default as default
};
