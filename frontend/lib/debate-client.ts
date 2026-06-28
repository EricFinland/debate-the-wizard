// Typed client for the Debate the Wizard edge functions.
// Source of truth for API shapes lives in shared/contracts/debate.ts.
//
// Frontend usage:
//   import { createDebateClient } from "@/lib/debate-client";
//   const api = createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL!);
//   const { room } = await api.createRoom({ topic_id: "nuclear-climate" });
//   const turn = await api.submitArgument({ room_id: room.id, round_no: 1, argument });

import type {
  CreateRoomResponse,
  Difficulty,
  GetRoomResponse,
  HealthResponse,
  JudgeResult,
  LeaderboardResponse,
  ListRoomsResponse,
  RecordMatchResponse,
  TurnResponse,
} from "../../shared/contracts/debate";

export type {
  ApiError,
  Author,
  Citation,
  Claim,
  CreateRoomResponse,
  Difficulty,
  GetRoomResponse,
  HealthResponse,
  JudgeResult,
  LeaderboardEntry,
  LeaderboardResponse,
  LegacyLeaderboardEntry,
  ListRoomsResponse,
  Player,
  Profile,
  ProfileLeaderboardEntry,
  RawLeaderboardEntry,
  RecordMatchResponse,
  Room,
  RoomStatus,
  RoomSummary,
  Scores,
  Side,
  TurnResponse,
  Verdict,
  WizardResult,
} from "../../shared/contracts/debate";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

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

export function createDebateClient(
  baseUrl: string,
  opts: DebateClientOptions = {},
) {
  const base = (baseUrl ?? "").replace(/\/+$/, "");
  const doFetch = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  async function call<T>(
    slug: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<T> {
    if (!base) {
      throw new DebateApiError(
        0,
        "Missing NEXT_PUBLIC_INSFORGE_URL. Copy .env.local.example to .env.local and set your project URL and anon key.",
      );
    }
    const res = await doFetch(`${base}/functions/${slug}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      const msg =
        (data as { error?: string })?.error ?? `Request failed (${res.status})`;
      throw new DebateApiError(res.status, msg);
    }
    return data as T;
  }

  return {
    health: () => call<HealthResponse>("health", "GET"),

    createRoom: (input: {
      topic?: string;
      topic_id?: string;
      rounds_total?: number;
      difficulty?: Difficulty;
      host_user_id?: string;
    }) => call<CreateRoomResponse>("create-room", "POST", input),

    submitArgument: (input: {
      room_id: string;
      round_no: number;
      argument: string;
    }) => call<TurnResponse>("submit-argument", "POST", input),

    advanceWizard: (input: {
      room_id: string;
      round_no: number;
      opponent_argument?: string;
    }) => call<TurnResponse>("advance-wizard", "POST", input),

    getRoom: (input: { room_id: string }) =>
      call<GetRoomResponse>("get-room", "POST", input),

    leaderboard: () => call<LeaderboardResponse>("leaderboard", "GET"),

    /** List recent/open rooms for a lobby browser. */
    listRooms: () => call<ListRoomsResponse>("list-rooms", "GET"),

    /**
     * Record a finished match for a logged-in player, updating their
     * persistent win/loss/score profile.
     */
    recordMatch: (input: {
      user_id: string;
      display_name?: string | null;
      avatar_url?: string | null;
      won: boolean | null;
      score: number;
    }) => call<RecordMatchResponse>("record-match", "POST", input),

    /** Direct access to the pure judge pipeline (rarely needed from the UI). */
    judgeClaim: (input: { argument: string; topic?: string }) =>
      call<JudgeResult>("judge-claim", "POST", input),
  };
}

export type DebateClient = ReturnType<typeof createDebateClient>;
