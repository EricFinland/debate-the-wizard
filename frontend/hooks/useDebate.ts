"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  createDebateClient,
  DebateApiError,
  type Claim,
  type GetRoomResponse,
  type LeaderboardEntry,
  type Room,
  type RoomStatus,
  type Verdict,
} from "@/lib/debate-client";

export type DebateView = "picker" | "arena" | "recap";

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
  actions: {
    start: (input: StartInput) => Promise<void>;
    submitArgument: (text: string) => Promise<void>;
    playAgain: () => void;
    loadLeaderboard: () => Promise<void>;
    dismissVerdict: () => void;
    clearError: () => void;
  };
}

function messageFromError(e: unknown): string {
  if (e instanceof DebateApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}

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

  // Latest topic input, so playAgain can restart the same debate.
  const lastStartRef = useRef<StartInput | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const dismissVerdict = useCallback(() => setVerdict(null), []);

  const addScore = useCallback(
    (who: "you" | "wizard", points: number) => {
      setScores((prev) => ({ ...prev, [who]: prev[who] + (points || 0) }));
    },
    [],
  );

  const fireVerdict = useCallback(
    (author: "player" | "wizard", claim: Claim) => {
      setVerdict({
        author,
        verdict: claim.verdict,
        points: claim.points,
        keyClaim: claim.key_claim,
        rationale: claim.rationale,
        claimId: claim.id,
      });
    },
    [],
  );

  const loadRecap = useCallback(
    async (roomId: string) => {
      try {
        const data = await client.getRoom({ room_id: roomId });
        setRecap(data);
        // Reconcile scores with the authoritative server tally.
        setScores({ you: data.scores.A, wizard: data.scores.B });
        setStatus(data.room.status);
        setView("recap");
      } catch (e) {
        setError(messageFromError(e));
      }
    },
    [client],
  );

  const start = useCallback(
    async (input: StartInput) => {
      setBusy(true);
      setError(null);
      try {
        const res = await client.createRoom(input);
        lastStartRef.current = input;
        setRoom(res.room);
        setStatus(res.room.status);
        setRoundsTotal(res.room.rounds_total || input.rounds_total || 3);
        setRound(1);
        setClaims([]);
        setScores({ you: 0, wizard: 0 });
        setRecap(null);
        setVerdict(null);
        setView("arena");
      } catch (e) {
        setError(messageFromError(e));
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const submitArgument = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !room || busy || wizardThinking) return;

      const currentRound = round;
      setBusy(true);
      setError(null);

      try {
        // 1) Player turn.
        const playerTurn = await client.submitArgument({
          room_id: room.id,
          round_no: currentRound,
          argument: trimmed,
        });
        const playerClaim: Claim = {
          ...playerTurn.claim,
          citations: playerTurn.claim.citations ?? playerTurn.citations,
        };
        setClaims((prev) => [...prev, playerClaim]);
        addScore("you", playerClaim.points);
        fireVerdict("player", playerClaim);

        // 2) Wizard's rebuttal — same round.
        setWizardThinking(true);
        const wizardTurn = await client.advanceWizard({
          room_id: room.id,
          round_no: currentRound,
          opponent_argument: trimmed,
        });
        const wizardClaim: Claim = {
          ...wizardTurn.claim,
          citations: wizardTurn.claim.citations ?? wizardTurn.citations,
        };
        setClaims((prev) => [...prev, wizardClaim]);
        addScore("wizard", wizardClaim.points);
        fireVerdict("wizard", wizardClaim);

        if (wizardTurn.room) {
          setRoom(wizardTurn.room);
          setStatus(wizardTurn.room.status);
        }

        // 3) Advance the round / detect end of match.
        const finished =
          wizardTurn.room?.status === "finished" ||
          currentRound >= roundsTotal;

        if (finished) {
          await loadRecap(room.id);
        } else {
          setRound(currentRound + 1);
        }
      } catch (e) {
        setError(messageFromError(e));
      } finally {
        setWizardThinking(false);
        setBusy(false);
      }
    },
    [
      room,
      busy,
      wizardThinking,
      round,
      roundsTotal,
      client,
      addScore,
      fireVerdict,
      loadRecap,
    ],
  );

  const playAgain = useCallback(() => {
    setView("picker");
    setRoom(null);
    setClaims([]);
    setScores({ you: 0, wizard: 0 });
    setRound(1);
    setStatus(null);
    setVerdict(null);
    setRecap(null);
    setError(null);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await client.leaderboard();
      setLeaderboard(res.leaderboard);
    } catch (e) {
      setError(messageFromError(e));
    }
  }, [client]);

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
    actions: {
      start,
      submitArgument,
      playAgain,
      loadLeaderboard,
      dismissVerdict,
      clearError,
    },
  };
}
