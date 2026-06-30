// Typed client for the Debate the Wizard edge functions.
// Frontend usage:
//
//   import { createDebateClient } from "../client";
//   const api = createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL!);
//   const { room } = await api.createRoom({ topic_id: "nuclear-climate" });
//   const turn = await api.submitArgument({ room_id: room.id, round_no: 1, argument });
//
// Realtime: subscribe to DB-change events on `claims` / `players` filtered by
// room_id (see docs/backend-architecture.md). The HTTP responses below also carry
// the verdict/score, so the UI works even without a socket.

import type {
  CreateRoomResponse,
  GetRoomResponse,
  HealthResponse,
  LeaderboardResponse,
  TurnResponse,
} from "./types";

export * from "./types";

export class DebateApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "DebateApiError";
  }
}

export interface DebateClientOptions {
  /** Optional bearer token (anon key) if your functions require auth. */
  token?: string;
  /** Override fetch (e.g. for SSR). Defaults to global fetch. */
  fetch?: typeof fetch;
}

export function createDebateClient(baseUrl: string, opts: DebateClientOptions = {}) {
  const base = baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  async function call<T>(slug: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const res = await doFetch(`${base}/functions/${slug}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? `Request failed (${res.status})`;
      throw new DebateApiError(res.status, msg);
    }
    return data as T;
  }

  return {
    health: () => call<HealthResponse>("health", "GET"),

    createRoom: (input: { topic?: string; topic_id?: string; rounds_total?: number }) =>
      call<CreateRoomResponse>("create-room", "POST", input),

    submitArgument: (input: { room_id: string; round_no: number; argument: string }) =>
      call<TurnResponse>("submit-argument", "POST", input),

    getRoom: (input: { room_id: string }) =>
      call<GetRoomResponse>("get-room", "POST", input),

    leaderboard: () => call<LeaderboardResponse>("leaderboard", "GET"),
  };
}

export type DebateClient = ReturnType<typeof createDebateClient>;
