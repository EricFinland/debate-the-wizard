"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDebateClient,
  DebateApiError,
  type Claim,
  type Difficulty,
  type GetRoomResponse,
  type LeaderboardEntry,
  type RawLeaderboardEntry,
  type ListRoomsResponse,
  type Profile,
  type Room,
  type RoomStatus,
  type Verdict,
} from "@/lib/debate-client";
import {
  getUser,
  signIn as authSignIn,
  signOut as authSignOut,
  type AuthUser,
  type OAuthProvider,
} from "@/lib/insforge-auth";

export type DebateView = "picker" | "arena" | "recap";

/**
 * Stage of the currently-running turn, used by TurnTheater to animate the
 * "wizard does research then rules" sequence:
 *   idle      — nothing running
 *   searching — query fired, fetching sources
 *   reading   — sources in, judge is reading them
 *   ruling    — verdict being computed / about to resolve
 */
export type TurnStage = "idle" | "searching" | "reading" | "ruling";

/** Who the active turn belongs to while turnStage !== 'idle'. */
export type TurnActor = "you" | "wizard" | null;

/** Payload that fires the verdict reveal overlay after each judged claim. */
export interface VerdictReveal {
  author: "player" | "wizard";
  verdict: Verdict | null;
  points: number;
  keyClaim: string | null;
  rationale: string | null;
  claimId: string;
}

export interface StartInput {
  topic?: string;
  topic_id?: string;
  rounds_total?: number;
  difficulty?: Difficulty;
}

export interface UseDebate {
  view: DebateView;
  room: Room | null;
  claims: Claim[];
  scores: { you: number; wizard: number };
  round: number;
  roundsTotal: number;
  status: RoomStatus | null;
  busy: boolean;
  /** True specifically while the wizard is taking its turn (lock the input). */
  wizardThinking: boolean;
  error: string | null;
  verdict: VerdictReveal | null;
  recap: GetRoomResponse | null;
  leaderboard: LeaderboardEntry[];

  // --- difficulty ---
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;

  // --- turn theater ---
  turnStage: TurnStage;
  turnActor: TurnActor;
  searchQuery: string | null;
  sourceCount: number;

  // --- auth / profile ---
  user: AuthUser | null;
  /** Persistent win/loss/score stats for the logged-in player (null if anon). */
  profile: Profile | null;

  // --- wizard flavor ---
  taunt: string | null;
  wizardCaught: boolean;

  actions: {
    start: (input: StartInput) => Promise<void>;
    submitArgument: (text: string) => Promise<void>;
    playAgain: () => void;
    loadLeaderboard: () => Promise<void>;
    /** Spectator lobby: list recent/open rooms. */
    listRooms: () => Promise<ListRoomsResponse>;
    /** Spectator watch: fetch a room snapshot. */
    getRoom: (input: { room_id: string }) => Promise<GetRoomResponse>;
    signIn: (provider?: OAuthProvider) => Promise<void>;
    signOut: () => Promise<void>;
    dismissVerdict: () => void;
    clearError: () => void;
  };
}

function messageFromError(e: unknown): string {
  if (e instanceof DebateApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}

function normalizeLeaderboardEntry(entry: RawLeaderboardEntry): LeaderboardEntry {
  if ("wins" in entry) return entry;
  return {
    display_name: entry.topic ?? "Anonymous challenger",
    avatar_url: null,
    wins: entry.score > 0 ? 1 : 0,
    losses: entry.score <= 0 ? 1 : 0,
    total_score: entry.score,
  };
}

// Realistic-feeling pacing for the turn theater (ms).
const SEARCH_TO_READ_MS = 700;
const READ_HOLD_MS = 600;

export function useDebate(): UseDebate {
  const client = useMemo(
    () => createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL ?? ""),
    [],
  );

  const [view, setView] = useState<DebateView>("picker");
  const [room, setRoom] = useState<Room | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [scores, setScores] = useState<{ you: number; wizard: number }>({
    you: 0,
    wizard: 0,
  });
  const [round, setRound] = useState(1);
  const [roundsTotal, setRoundsTotal] = useState(3);
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizardThinking, setWizardThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictReveal | null>(null);
  const [recap, setRecap] = useState<GetRoomResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [difficulty, setDifficulty] = useState<Difficulty>("adept");

  const [turnStage, setTurnStage] = useState<TurnStage>("idle");
  const [turnActor, setTurnActor] = useState<TurnActor>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [sourceCount, setSourceCount] = useState(0);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taunt, setTaunt] = useState<string | null>(null);
  const [wizardCaught, setWizardCaught] = useState(false);

  // Latest topic input, so playAgain can restart the same debate.
  const lastStartRef = useRef<StartInput | null>(null);
  // Pending timers for the turn theater, cleared on unmount / completion.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(t);
  }, []);

  // Load the auth user once on mount.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const u = await getUser();
        if (!cancelled && mountedRef.current) setUser(u);
      } catch {
        // Signed out / SDK unavailable — stay anonymous.
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const clearError = useCallback(() => setError(null), []);
  const dismissVerdict = useCallback(() => setVerdict(null), []);

  const resetTurnStage = useCallback(() => {
    setTurnStage("idle");
    setTurnActor(null);
  }, []);

  const addScore = useCallback((who: "you" | "wizard", points: number) => {
    setScores((prev) => ({ ...prev, [who]: prev[who] + (points || 0) }));
  }, []);

  const fireVerdict = useCallback((author: "player" | "wizard", claim: Claim) => {
    setVerdict({
      author,
      verdict: claim.verdict,
      points: claim.points,
      keyClaim: claim.key_claim,
      rationale: claim.rationale,
      claimId: claim.id,
    });
  }, []);

  /**
   * Drive the turn theater around an async turn call. Sets 'searching'
   * immediately, eases into 'reading', flips to 'ruling' just before resolve,
   * and never leaves the stage stuck (caller resets to 'idle' on completion).
   */
  const runTurnStaged = useCallback(
    async <T extends { search_query?: string | null; citations?: unknown[] }>(
      actor: Exclude<TurnActor, null>,
      fn: () => Promise<T>,
    ): Promise<T> => {
      setTurnActor(actor);
      setSearchQuery(null);
      setSourceCount(0);
      setTurnStage("searching");
      schedule(() => setTurnStage("reading"), SEARCH_TO_READ_MS);

      const result = await fn();

      // Reflect what the turn actually searched / found.
      const q = result?.search_query ?? null;
      const n = Array.isArray(result?.citations) ? result.citations.length : 0;
      if (mountedRef.current) {
        setSearchQuery(q);
        setSourceCount(n);
        // Ensure we at least pass through 'reading' before ruling for legibility.
        setTurnStage("reading");
        schedule(() => setTurnStage("ruling"), READ_HOLD_MS);
      }
      return result;
    },
    [schedule],
  );

  const loadRecap = useCallback(
    async (roomId: string, finalScores?: { you: number; wizard: number }) => {
      try {
        const data = await client.getRoom({ room_id: roomId });
        setRecap(data);
        // Reconcile scores with the authoritative server tally.
        const you = data.scores.A;
        const wizard = data.scores.B;
        setScores({ you, wizard });
        setStatus(data.room.status);
        setView("recap");

        // Record the match for a logged-in player (idempotent server-side).
        if (user?.id) {
          const won =
            data.winner === "A" ? true : data.winner === "B" ? false : null;
          try {
            const res = await client.recordMatch({
              user_id: user.id,
              display_name: user.name ?? user.email ?? null,
              avatar_url: user.avatar_url ?? null,
              won,
              score: you,
            });
            if (res?.profile && mountedRef.current) setProfile(res.profile);
          } catch {
            // Non-fatal — recap still shows.
          }
        }
      } catch (e) {
        // Fall back to whatever local scores we have so recap still renders.
        if (finalScores) setScores(finalScores);
        setError(messageFromError(e));
      }
    },
    [client, user],
  );

  const start = useCallback(
    async (input: StartInput) => {
      setBusy(true);
      setError(null);
      try {
        const effectiveDifficulty = input.difficulty ?? difficulty;
        const res = await client.createRoom({
          topic: input.topic,
          topic_id: input.topic_id,
          rounds_total: input.rounds_total,
          difficulty: effectiveDifficulty,
          host_user_id: user?.id,
        });
        lastStartRef.current = { ...input, difficulty: effectiveDifficulty };
        setDifficulty(effectiveDifficulty);
        setRoom(res.room);
        setStatus(res.room.status);
        setRoundsTotal(res.room.rounds_total || input.rounds_total || 3);
        setRound(1);
        setClaims([]);
        setScores({ you: 0, wizard: 0 });
        setRecap(null);
        setVerdict(null);
        setTaunt(null);
        setWizardCaught(false);
        resetTurnStage();
        setView("arena");
      } catch (e) {
        setError(messageFromError(e));
      } finally {
        setBusy(false);
      }
    },
    [client, difficulty, user, resetTurnStage],
  );

  const submitArgument = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !room || busy || wizardThinking) return;

      const currentRound = round;
      setBusy(true);
      setError(null);

      try {
        // 1) Player turn (staged theater).
        const playerTurn = await runTurnStaged("you", () =>
          client.submitArgument({
            room_id: room.id,
            round_no: currentRound,
            argument: trimmed,
          }),
        );
        const playerClaim: Claim = {
          ...playerTurn.claim,
          citations: playerTurn.claim.citations ?? playerTurn.citations,
          search_query:
            playerTurn.claim.search_query ?? playerTurn.search_query ?? null,
        };
        setClaims((prev) => [...prev, playerClaim]);
        addScore("you", playerClaim.points);
        fireVerdict("player", playerClaim);

        // 2) Wizard's rebuttal — same round (staged theater).
        setWizardThinking(true);
        const wizardTurn = await runTurnStaged("wizard", () =>
          client.advanceWizard({
            room_id: room.id,
            round_no: currentRound,
            opponent_argument: trimmed,
          }),
        );
        const wizardClaim: Claim = {
          ...wizardTurn.claim,
          citations: wizardTurn.claim.citations ?? wizardTurn.citations,
          search_query:
            wizardTurn.claim.search_query ?? wizardTurn.search_query ?? null,
          taunt: wizardTurn.claim.taunt ?? wizardTurn.taunt ?? null,
        };
        setClaims((prev) => [...prev, wizardClaim]);
        addScore("wizard", wizardClaim.points);
        fireVerdict("wizard", wizardClaim);

        // Wizard flavor for WizardTaunt.
        setTaunt(wizardClaim.taunt ?? null);
        setWizardCaught(wizardClaim.verdict === "misleading");

        if (wizardTurn.room) {
          setRoom(wizardTurn.room);
          setStatus(wizardTurn.room.status);
        }

        // 3) Advance the round / detect end of match.
        const finished =
          wizardTurn.room?.status === "finished" || currentRound >= roundsTotal;

        if (finished) {
          await loadRecap(room.id, {
            you: scores.you + playerClaim.points,
            wizard: scores.wizard + wizardClaim.points,
          });
        } else {
          setRound(currentRound + 1);
        }
      } catch (e) {
        setError(messageFromError(e));
      } finally {
        setWizardThinking(false);
        setBusy(false);
        resetTurnStage();
      }
    },
    [
      room,
      busy,
      wizardThinking,
      round,
      roundsTotal,
      scores,
      client,
      addScore,
      fireVerdict,
      loadRecap,
      runTurnStaged,
      resetTurnStage,
    ],
  );

  const playAgain = useCallback(() => {
    clearTimers();
    setView("picker");
    setRoom(null);
    setClaims([]);
    setScores({ you: 0, wizard: 0 });
    setRound(1);
    setStatus(null);
    setVerdict(null);
    setRecap(null);
    setError(null);
    setTaunt(null);
    setWizardCaught(false);
    resetTurnStage();
    setSearchQuery(null);
    setSourceCount(0);
  }, [clearTimers, resetTurnStage]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await client.leaderboard();
      const rows = res.leaderboard.map(normalizeLeaderboardEntry);
      setLeaderboard(rows);
      // Best-effort: hydrate the logged-in player's profile from their row.
      if (user && !profile) {
        const me = user.name ?? user.email ?? "";
        const row = rows.find(
          (e) => (e.display_name ?? "") === me && me !== "",
        );
        if (row && mountedRef.current) {
          setProfile({
            user_id: user.id,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            wins: row.wins,
            losses: row.losses,
            total_score: row.total_score,
          });
        }
      }
    } catch (e) {
      setError(messageFromError(e));
    }
  }, [client, user, profile]);

  const listRooms = useCallback(
    () => client.listRooms(),
    [client],
  );

  const getRoom = useCallback(
    (input: { room_id: string }) => client.getRoom(input),
    [client],
  );

  const signIn = useCallback(async (provider: OAuthProvider = "google") => {
    try {
      await authSignIn(provider);
      // OAuth redirects away; user is picked up on the next mount.
    } catch (e) {
      setError(messageFromError(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authSignOut();
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
      }
    } catch (e) {
      setError(messageFromError(e));
    }
  }, []);

  return {
    view,
    room,
    claims,
    scores,
    round,
    roundsTotal,
    status,
    busy,
    wizardThinking,
    error,
    verdict,
    recap,
    leaderboard,

    difficulty,
    setDifficulty,

    turnStage,
    turnActor,
    searchQuery,
    sourceCount,

    user,
    profile,

    taunt,
    wizardCaught,

    actions: {
      start,
      submitArgument,
      playAgain,
      loadLeaderboard,
      listRooms,
      getRoom,
      signIn,
      signOut,
      dismissVerdict,
      clearError,
    },
  };
}
