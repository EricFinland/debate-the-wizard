import { config } from "./env";

export function dbConfigError(): string | null {
  if (!config.insforgeDataUrl() || !config.insforgeApiKey()) {
    return "INSFORGE_API_URL / INSFORGE_API_KEY not configured.";
  }
  return null;
}

function dbBase(): string {
  return `${config.insforgeDataUrl()}/api/database/records`;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.insforgeApiKey()}`,
    "Content-Type": "application/json",
  };
}

export async function dbSelect<T = any>(table: string, query = ""): Promise<T[]> {
  const res = await fetch(`${dbBase()}/${table}${query ? `?${query}` : ""}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

export async function dbInsert<T = any>(table: string, rows: unknown[]): Promise<T[]> {
  const res = await fetch(`${dbBase()}/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

export async function dbUpdate<T = any>(table: string, query: string, patch: unknown): Promise<T[]> {
  const res = await fetch(`${dbBase()}/${table}?${query}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

export async function recomputeScore(roomId: string, side: "A" | "B", author: "player" | "wizard"): Promise<number> {
  const claims = await dbSelect<{ points: number }>(
    "claims",
    `room_id=eq.${roomId}&author=eq.${author}&select=points`,
  );
  const total = claims.reduce((sum, claim) => sum + (Number(claim.points) || 0), 0);
  const [player] = await dbSelect<{ id: string }>("players", `room_id=eq.${roomId}&side=eq.${side}&select=id`);
  if (!player) return total;

  const [updated] = await dbUpdate<{ score: number }>("players", `id=eq.${player.id}`, { score: total });
  return updated?.score ?? total;
}
