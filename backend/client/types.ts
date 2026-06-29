// Shared types for Debate the Wizard — the contract between the backend edge
// functions and the frontend. Import these instead of redefining shapes.

export type Verdict = "supported" | "unsupported" | "misleading";
export type Side = "A" | "B"; // A = human, B = wizard
export type Author = "player" | "wizard";
export type RoomStatus = "lobby" | "active" | "finished";

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
}

export interface GetRoomResponse {
  room: Room;
  players: Player[];
  scores: { A: number; B: number };
  claims: Claim[];
  winner: Side | "tie" | null;
}

export interface LeaderboardEntry {
  room_id: string;
  score: number;
  topic: string | null;
  status: RoomStatus | null;
  created_at: string | null;
}
export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
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
