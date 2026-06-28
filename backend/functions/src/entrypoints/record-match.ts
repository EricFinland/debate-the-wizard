import { dbConfigError, dbInsert, dbSelect, dbUpdate } from "../shared/db";
import { json, methodNotAllowed, options, readJson } from "../shared/http";

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return options(["POST"]);
  if (req.method !== "POST") return methodNotAllowed("POST only.", ["POST"]);
  const configError = dbConfigError();
  if (configError) return json({ error: configError }, 500, ["POST"]);

  const body = await readJson<any>(req);
  if (!body) return json({ error: "Invalid JSON body." }, 400, ["POST"]);

  const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) return json({ error: "user_id is required." }, 400, ["POST"]);

  const won: boolean | null = body?.won === true ? true : body?.won === false ? false : null;
  const score = Number.isFinite(Number(body?.score)) ? Math.trunc(Number(body.score)) : 0;
  const displayName = typeof body?.display_name === "string" && body.display_name.trim() ? body.display_name.trim().slice(0, 120) : null;
  const avatarUrl = typeof body?.avatar_url === "string" && body.avatar_url.trim() ? body.avatar_url.trim() : null;
  const increments = {
    wins: won === true ? 1 : 0,
    losses: won === false ? 1 : 0,
    ties: won === null ? 1 : 0,
  };

  async function incrementExisting(current: any) {
    const patch: any = {
      wins: (Number(current.wins) || 0) + increments.wins,
      losses: (Number(current.losses) || 0) + increments.losses,
      ties: (Number(current.ties) || 0) + increments.ties,
      total_score: (Number(current.total_score) || 0) + score,
      updated_at: new Date().toISOString(),
    };
    if (displayName !== null) patch.display_name = displayName;
    if (avatarUrl !== null) patch.avatar_url = avatarUrl;
    const [updated] = await dbUpdate("profiles", `user_id=eq.${encodeURIComponent(userId)}`, patch);
    return updated ?? { ...current, ...patch };
  }

  try {
    const existing = await dbSelect<any>("profiles", `user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    const profile = existing.length
      ? await incrementExisting(existing[0])
      : await (async () => {
          try {
            const [inserted] = await dbInsert("profiles", [{
              user_id: userId,
              display_name: displayName,
              avatar_url: avatarUrl,
              wins: increments.wins,
              losses: increments.losses,
              ties: increments.ties,
              total_score: score,
              updated_at: new Date().toISOString(),
            }]);
            return inserted;
          } catch {
            const [current] = await dbSelect<any>("profiles", `user_id=eq.${encodeURIComponent(userId)}&limit=1`);
            if (!current) throw new Error("profile insert failed and no existing row found.");
            return incrementExisting(current);
          }
        })();

    return json({ profile }, 200, ["POST"]);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500, ["POST"]);
  }
}
