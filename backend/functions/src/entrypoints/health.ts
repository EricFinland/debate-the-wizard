import { env } from "../shared/env";
import { options, withMethods } from "../shared/http";

export default function (req: Request): Response {
  if (req.method === "OPTIONS") return options(["GET"]);
  const body = {
    ok: true,
    service: "debate-the-wizard",
    time: new Date().toISOString(),
    config: {
      gateway: Boolean(env("OPENROUTER_API_KEY") || env("INSFORGE_API_URL")),
      db: Boolean(env("INSFORGE_API_KEY")),
      youcom: Boolean(env("YOUCOM_API_KEY")),
    },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: withMethods(["GET"]) });
}
