// Self-contained typed client for the Debate the Wizard edge functions.
// This file embeds both the shared types and the client implementation so the
// frontend has zero cross-root imports. Source of truth is the backend's
// client/types.ts + client/index.ts — keep this in sync if those change.
//
// Frontend usage:
//   import { createDebateClient } from "@/lib/debate-client";
//   const api = createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL!);
//   const { room } = await api.createRoom({ topic_id: "nuclear-climate" });
//   const turn = await api.submitArgument({ room_id: room.id, round_no: 1, argument });

// ---------------------------------------------------------------------------
// Types — the contract between backend edge functions and the frontend.
// ---------------------------------------------------------------------------

export type Verdict = "supported" | "unsupported" | "misleading";
export type Side = "A" | "B"; // A = human, B = wizard
export type Author = "player" | "wizard";
export type RoomStatus = "lobby" | "active" | "finished";
export type Difficulty = "novice" | "adept" | "archmage";

export interface Scores {
  factual_accuracy: number; // 0-10
  logic: number; // 0-10
  evidence: number; // 0-10
  persuasiveness: number; // 0-10
}

export interface Citation {
  id?: string;
  claim_id?: string;
  title: string | null;
  url: string | null;
  snippet: string | null;
}

export interface Room {
  id: string;
  topic: string;
  status: RoomStatus;
  rounds_total: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  side: Side;
  score: number;
}

export interface Claim {
  id: string;
  room_id: string;
  round_no: number;
  author: Author;
  argument: string;
  key_claim: string | null;
  verdict: Verdict | null;
  rationale: string | null;
  points: number;
  scores: Scores | null;
  fallacies: string[];
  created_at: string;
  citations?: Citation[];
  /** Wizard-only jab returned by advance-wizard. */
  taunt?: string | null;
  /** The web-search query the judge/wizard ran for this turn. */
  search_query?: string | null;
}

/** Raw output of the pure judge-claim function. */
export interface JudgeResult {
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  points: number;
  scores: Scores;
  fallacies: string[];
  citations: Citation[];
  citation_index: number | null;
}

// --- edge function responses ---

export interface CreateRoomResponse {
  room: Room;
  players: Player[];
  topic_meta: Record<string, unknown>;
}

export interface TurnResponse {
  claim: Claim;
  citations: Citation[];
  score: number;
  citation_index: number | null;
  room?: Room; // advance-wizard includes the (possibly finished) room
  /** The web-search query this turn ran (mirrors claim.search_query). */
  search_query?: string | null;
  /** Wizard-only jab (advance-wizard only; mirrors claim.taunt). */
  taunt?: string | null;
}

export interface GetRoomResponse {
  room: Room;
  players: Player[];
  scores: { A: number; B: number };
  claims: Claim[];
  winner: Side | "tie" | null;
}

export interface LeaderboardEntry {
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_score: number;
}
export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

/** Lightweight room summary returned by list-rooms. */
export interface RoomSummary {
  id: string;
  topic: string;
  status: RoomStatus;
  rounds_total: number;
  created_at: string;
}
export interface ListRoomsResponse {
  rooms: RoomSummary[];
}

/** Persistent player profile aggregated across matches. */
export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_score: number;
}
export interface RecordMatchResponse {
  profile: Profile;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  time: string;
  config: { gateway: boolean; db: boolean; youcom: boolean };
}

export interface ApiError {
  error: string;
}

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
        "Missing NEXT_PUBLIC_INSFORGE_URL. Copy .env.local.example to .env.local and set your project URL.",
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
