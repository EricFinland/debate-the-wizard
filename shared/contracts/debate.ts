export type Verdict = "supported" | "unsupported" | "misleading";
export type Side = "A" | "B";
export type Author = "player" | "wizard";
export type RoomStatus = "lobby" | "active" | "finished";
export type Difficulty = "novice" | "adept" | "archmage";

export interface Scores {
  factual_accuracy: number;
  logic: number;
  evidence: number;
  persuasiveness: number;
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
  difficulty?: Difficulty | null;
  host_user_id?: string | null;
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
  taunt?: string | null;
  search_query?: string | null;
}

export interface JudgeResult {
  key_claim: string;
  verdict: Verdict;
  rationale: string;
  points: number;
  scores: Scores;
  fallacies: string[];
  citations: Citation[];
  citation_index: number | null;
  search_query?: string | null;
}

export interface WizardResult extends JudgeResult {
  argument: string;
  taunt?: string | null;
}

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
  room?: Room;
  search_query?: string | null;
  taunt?: string | null;
}

export interface GetRoomResponse {
  room: Room;
  players: Player[];
  scores: { A: number; B: number };
  claims: Claim[];
  winner: Side | "tie" | null;
}

export interface ProfileLeaderboardEntry {
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  total_score: number;
}

export interface LegacyLeaderboardEntry {
  room_id: string;
  score: number;
  topic: string | null;
  status: RoomStatus | null;
  created_at: string | null;
}

export type LeaderboardEntry = ProfileLeaderboardEntry;
export type RawLeaderboardEntry = ProfileLeaderboardEntry | LegacyLeaderboardEntry;

export interface LeaderboardResponse {
  leaderboard: RawLeaderboardEntry[];
}

export interface RoomSummary {
  id: string;
  topic: string;
  status: RoomStatus;
  difficulty?: Difficulty | null;
  rounds_total: number | null;
  created_at: string;
  scores?: { A: number; B: number };
}

export interface ListRoomsResponse {
  rooms: RoomSummary[];
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  ties?: number;
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
