// _shared/db.ts — InsForge data-API helpers shared across all edge functions.
//
// Import with:
//   import { makeDb } from "../_shared/db.ts";
//   const { dbSelect, dbInsert, dbUpdate } = makeDb(BASE, KEY);

/** Build the three database helper functions bound to a project base URL and API key. */
export function makeDb(base: string, key: string) {
  const db = `${base}/api/database/records`;
  const H: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  async function dbSelect(table: string, query = ""): Promise<any[]> {
    const res = await fetch(`${db}/${table}${query ? `?${query}` : ""}`, { headers: H });
    if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  async function dbInsert(table: string, rows: unknown[]): Promise<any[]> {
    const res = await fetch(`${db}/${table}`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  async function dbUpdate(table: string, query: string, patch: unknown): Promise<any[]> {
    const res = await fetch(`${db}/${table}?${query}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`update ${table} ${query} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  return { dbSelect, dbInsert, dbUpdate };
}
