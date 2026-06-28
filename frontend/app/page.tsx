"use client";

// =============================================================================
// Debate the Wizard — top-level experience composer.
//
// This file owns the view orchestration only. All real logic lives in the
// extended useDebate() hook; every visual piece is a dedicated component under
// @/components. We rely on the SAFE motion system (CSS keyframes for all
// looping/idle/entrance motion + a couple of framer-motion AnimatePresence
// presets for overlay mount/unmount and view transitions). There is NO
// MotionGlobalConfig.skipAnimations crutch anymore, and no content is gated
// behind framer-only opacity reveals — everything is visible by default.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useDebate } from "@/hooks/useDebate";
import { fadeInUp, modalPanel } from "@/lib/motion";
import { cn } from "@/lib/ui";
import {
  createDebateClient,
  type GetRoomResponse,
  type RoomSummary,
} from "@/lib/debate-client";

// --- Picker / lobby ---------------------------------------------------------
import AuthBar from "@/components/AuthBar";
import DifficultyPicker from "@/components/DifficultyPicker";
import TopicPicker from "@/components/TopicPicker";
import Leaderboard from "@/components/Leaderboard";
import SpectatorLobby, {
  type SpectatorRoom,
} from "@/components/SpectatorLobby";

// --- Arena ------------------------------------------------------------------
import Scoreboard from "@/components/Scoreboard";
import WizardAvatar from "@/components/WizardAvatar";
import ArgumentInput from "@/components/ArgumentInput";
import ClaimCard from "@/components/ClaimCard";
import TurnTheater from "@/components/TurnTheater";
import SearchQueryBadge from "@/components/SearchQueryBadge";
import WizardTaunt from "@/components/WizardTaunt";
import CitationInspector from "@/components/CitationInspector";

// --- Verdict + recap --------------------------------------------------------
import VerdictReveal from "@/components/VerdictReveal";
import RecapScreen from "@/components/RecapScreen";
import ShareCard from "@/components/ShareCard";

// --- Spectator watch --------------------------------------------------------
import SpectatorArena from "@/components/SpectatorArena";

const POLL_MS = 2000;

/** Map a RoomSummary from list-rooms into the lobby card shape. */
function toSpectatorRoom(r: RoomSummary): SpectatorRoom {
  const anyR = r as RoomSummary & {
    difficulty?: string;
    scores?: { A: number; B: number };
  };
  return {
    id: r.id,
    topic: r.topic,
    status: r.status,
    difficulty: anyR.difficulty ?? "adept",
    scores: anyR.scores ?? { A: 0, B: 0 },
    created_at: r.created_at,
  };
}

export default function Page() {
  const {
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
    // --- extended surface (provided by the updated useDebate) ---
    difficulty,
    setDifficulty,
    turnStage,
    turnActor,
    searchQuery,
    sourceCount,
    user,
    profile,
    authError,
    taunt,
    wizardCaught,
    actions,
  } = useDebate();

  // Spectator flow needs list-rooms + get-room, which the hook doesn't expose;
  // spin up a read-only client just for browsing/watching other people's duels.
  const specClient = useRef(
    createDebateClient(process.env.NEXT_PUBLIC_INSFORGE_URL ?? ""),
  ).current;

  // ---- Local UI-only state ------------------------------------------------
  // "play" = pick a topic & duel; "spectate" = browse/watch live duels.
  const [pickerMode, setPickerMode] = useState<"play" | "spectate">("play");
  // Spectator flow: null = lobby list; string = watching that room id.
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const [spectateState, setSpectateState] = useState<GetRoomResponse | null>(
    null,
  );
  const [lobbyRooms, setLobbyRooms] = useState<SpectatorRoom[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // The user's opening argument — auto-submitted as Round 1 when arena mounts.
  const [openingArg, setOpeningArg] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Picker-side data loads ---------------------------------------------
  useEffect(() => {
    if (view === "picker") void actions.loadLeaderboard();
  }, [view, actions]);

  // ---- Auto-submit Round 1 with the user's opening argument ---------------
  useEffect(() => {
    if (
      view === "arena" &&
      openingArg &&
      round === 1 &&
      claims.length === 0 &&
      !busy &&
      !wizardThinking
    ) {
      const arg = openingArg;
      setOpeningArg(null);
      void actions.submitArgument(arg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, openingArg, round, claims.length, busy, wizardThinking]);

  // ---- Spectator lobby loading --------------------------------------------
  const loadLobby = useCallback(async () => {
    setLobbyLoading(true);
    try {
      const res = await specClient.listRooms();
      const rows = (res?.rooms ?? []).map(toSpectatorRoom);
      setLobbyRooms(rows);
    } catch {
      setLobbyRooms([]);
    } finally {
      setLobbyLoading(false);
    }
  }, [specClient]);

  // ---- Spectator watch polling --------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startWatching = useCallback(
    async (roomId: string) => {
      stopPolling();
      setSpectateState(null);
      // Validate the room exists BEFORE taking over the screen. A stale or bad
      // ?spectate=/?recap= link would otherwise strand the user on a near-empty
      // page — instead we just fall back to the picker.
      let first: GetRoomResponse | null = null;
      try {
        first = await specClient.getRoom({ room_id: roomId });
      } catch {
        first = null;
      }
      if (!first || !first.room) {
        setWatchingId(null);
        setPickerMode("play");
        return;
      }
      setSpectateState(first);
      setWatchingId(roomId);
      setPickerMode("spectate");
      if (first.room.status === "finished") return; // finished: nothing left to poll
      const tick = async () => {
        try {
          const data = await specClient.getRoom({ room_id: roomId });
          setSpectateState(data);
          if (data.room?.status === "finished") stopPolling();
        } catch {
          /* keep last good snapshot on a transient failure */
        }
      };
      pollRef.current = setInterval(tick, POLL_MS);
    },
    [specClient, stopPolling],
  );

  const leaveWatching = useCallback(() => {
    stopPolling();
    setWatchingId(null);
    setSpectateState(null);
    void loadLobby();
  }, [stopPolling, loadLobby]);

  // Tear the poller down on unmount.
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ---- Deep links: ?spectate=<id> / ?recap=<id> ---------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const spectate = params.get("spectate");
    const recapId = params.get("recap");
    const target = spectate ?? recapId;
    if (target) {
      void startWatching(target);
      // Clean the URL so a reload doesn't re-trigger watch mode (and never
      // strands the user on a blank watch page).
      window.history.replaceState({}, "", window.location.pathname);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the lobby list whenever we open the spectate tab on the picker.
  useEffect(() => {
    if (view === "picker" && pickerMode === "spectate" && !watchingId) {
      void loadLobby();
    }
  }, [view, pickerMode, watchingId, loadLobby]);

  // ---- Derived arena state -------------------------------------------------
  const latestClaim = claims.length ? claims[claims.length - 1] : null;
  const latestCitations = latestClaim?.citations ?? [];
  // Prefer the live turn query (from the hook) and fall back to the claim's.
  const liveQuery = searchQuery ?? latestClaim?.search_query ?? null;
  const liveSourceCount =
    typeof sourceCount === "number"
      ? sourceCount
      : latestCitations.length;

  const turnActive = busy || wizardThinking;

  const wizardState = wizardThinking
    ? "thinking"
    : verdict?.author === "wizard"
      ? "speaking"
      : "idle";

  // Are we watching a duel (spectator), regardless of which "view" we're in?
  const isWatching = !!watchingId;

  // AuthBar wants win/loss/score stats. The hook exposes the auth user as
  // `profile`; surface any stat fields it carries, else null (the chip then
  // shows zeros). Kept defensive so a richer profile shape just works.
  const authProfile = (() => {
    const p = profile as
      | { wins?: number; losses?: number; total_score?: number }
      | null
      | undefined;
    if (p && (p.wins != null || p.losses != null || p.total_score != null)) {
      return {
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        total_score: p.total_score ?? 0,
      };
    }
    return null;
  })();

  // TurnTheater speaks in "you" | "wizard"; the hook's actor is
  // "player" | "wizard" | null.
  const theaterActor: "you" | "wizard" =
    turnActor === "wizard" || wizardThinking ? "wizard" : "you";

  // Plain-language "who's winning" + "what's happening" for the arena header.
  const lead = scores.you - scores.wizard;
  const leaderText =
    lead > 0
      ? `You're winning ${scores.you}–${scores.wizard}`
      : lead < 0
        ? `The Wizard leads ${scores.wizard}–${scores.you}`
        : `Tied ${scores.you}–${scores.wizard}`;
  const leaderClass =
    lead > 0 ? "text-emerald-300" : lead < 0 ? "text-rose-300" : "text-zinc-300";
  const turnStatus = wizardThinking
    ? "🧙 The Wizard is responding…"
    : busy
      ? "⚖️ Fact-checking your claim against You.com…"
      : "Your turn — make your claim below";

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* ---- Title banner + account chip ---- */}
      <header className="relative z-20 px-6 pt-8 pb-6">
        <div className="mx-auto flex w-full max-w-6xl items-start justify-end">
          <AuthBar
            user={user ?? null}
            profile={authProfile}
            onSignIn={actions.signIn}
            onEmailSignIn={actions.signInEmail}
            onEmailSignUp={actions.signUpEmail}
            onSignOut={actions.signOut}
            authError={authError}
          />
        </div>

        <div className="mt-2 text-center anim-fade-in-up">
          <h1 className="text-4xl font-extrabold tracking-wide sm:text-5xl text-arcane-shimmer">
            Debate the Wizard
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Out-argue an arcane AI in a live, fact-checked duel. Every claim is
            grounded in real-time{" "}
            <span className="font-semibold text-rune">You.com</span> search — and
            the wizard can lose a round too.
          </p>
          <div className="rune-divider mx-auto mt-6 max-w-3xl" />
        </div>
      </header>

      {/* ---- Global error toast ---- */}
      <AnimatePresence>
        {error && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
          >
            <button
              onClick={actions.clearError}
              className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-100 shadow-glow-misleading backdrop-blur-md"
            >
              {error} <span className="ml-2 opacity-60">(dismiss)</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        {/* =====================================================================
            SPECTATOR WATCH — takes over the whole stage when watching a duel,
            no matter what `view` the hook reports (deep-link friendly).
           ===================================================================== */}
        {isWatching ? (
          <div className="anim-fade-in">
            <SpectatorArena state={spectateState} onLeave={leaveWatching} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ---------------- PICKER ---------------- */}
            {view === "picker" && (
              <motion.div
                key="picker"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex flex-col gap-8"
              >
                {/* Mode toggle: duel vs. spectate */}
                <div className="flex justify-center">
                  <div
                    role="tablist"
                    aria-label="Choose a mode"
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur"
                  >
                    <ModeTab
                      active={pickerMode === "play"}
                      onClick={() => setPickerMode("play")}
                      icon="⚔️"
                      label="Duel the Wizard"
                    />
                    <ModeTab
                      active={pickerMode === "spectate"}
                      onClick={() => setPickerMode("spectate")}
                      icon="🔭"
                      label="Watch live duels"
                    />
                  </div>
                </div>

                {pickerMode === "play" ? (
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
                    <div className="flex flex-col gap-6">
                      {/* Difficulty selection sits above the topic scrolls */}
                      <section className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-arcane-200/70">
                            Choose your foe
                          </span>
                          <span className="h-px flex-1 bg-gradient-to-r from-arcane/30 to-transparent" />
                        </div>
                        <DifficultyPicker
                          value={difficulty ?? "adept"}
                          onChange={setDifficulty}
                        />
                      </section>

                      <TopicPicker
                        onStart={(input) => {
                          // Save the argument text so we can auto-submit it as Round 1
                          if (input.topic) setOpeningArg(input.topic)
                          actions.start({ ...input, difficulty })
                        }}
                        loading={busy}
                        user={user ?? null}
                        onSignIn={actions.signIn}
                      />
                    </div>

                    <Leaderboard entries={leaderboard} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
                    <SpectatorLobby
                      rooms={lobbyRooms}
                      loading={lobbyLoading}
                      onWatch={startWatching}
                      onRefresh={loadLobby}
                    />
                    <Leaderboard entries={leaderboard} />
                  </div>
                )}
              </motion.div>
            )}

            {/* ---------------- ARENA ---------------- */}
            {view === "arena" && (
              <motion.div
                key="arena"
                variants={modalPanel}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex flex-col gap-6"
              >
                {/* At-a-glance: the motion, the round, who's winning, whose turn */}
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-arcane-200/70">
                    The Motion · Round {round} of {roundsTotal}
                  </p>
                  <h2 className="font-display text-lg leading-snug text-zinc-100 sm:text-xl">
                    {room?.topic ?? "The duel"}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    You argue <span className="font-semibold text-rune">FOR</span>
                    {" · "}the Wizard argues{" "}
                    <span className="font-semibold text-arcane-200">AGAINST</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                    <span className={cn("font-bold", leaderClass)}>{leaderText}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-300">{turnStatus}</span>
                  </div>
                </div>

                <Scoreboard
                  you={scores.you}
                  wizard={scores.wizard}
                  round={round}
                  roundsTotal={roundsTotal}
                  status={status ?? "active"}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
                  {/* Left: the duel */}
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-center">
                      <WizardAvatar state={wizardState} />
                    </div>

                    {/* The wizard's taunt floats out when he speaks */}
                    {taunt && (
                      <div className="-mt-1">
                        <WizardTaunt
                          key={taunt}
                          taunt={taunt}
                          mood={wizardCaught ? "caught" : "confident"}
                        />
                      </div>
                    )}

                    {/* Live search behind the current/last turn */}
                    {liveQuery && (
                      <div className="flex justify-center">
                        <SearchQueryBadge
                          query={liveQuery}
                          sourceCount={liveSourceCount}
                        />
                      </div>
                    )}

                    {/* Claim feed */}
                    <div className="flex max-h-[52vh] flex-col gap-4 overflow-y-auto rounded-2xl p-1">
                      {claims.length === 0 && (
                        <div className="glass rounded-2xl px-6 py-10 text-center text-zinc-400">
                          {busy || wizardThinking
                            ? 'Your opening argument is being fact-checked…'
                            : 'The duel is about to begin. Brace yourself.'}
                        </div>
                      )}

                      {claims.map((claim) => (
                        <div
                          key={claim.id}
                          className="flex flex-col gap-2 anim-fade-in-up"
                        >
                          {claim.search_query && (
                            <SearchQueryBadge
                              query={claim.search_query}
                              sourceCount={claim.citations?.length ?? 0}
                            />
                          )}
                          <ClaimCard claim={claim} />
                        </div>
                      ))}
                    </div>

                    <ArgumentInput
                      onSubmit={actions.submitArgument}
                      disabled={busy || wizardThinking}
                      loading={busy || wizardThinking}
                    />
                  </div>

                  {/* Right: latest sources + inspector entry */}
                  <aside className="lg:sticky lg:top-6 lg:self-start">
                    <div className="glass flex flex-col gap-4 rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-sm uppercase tracking-[0.18em] text-arcane-200/80">
                          {room?.topic ? "Live Sources" : "Sources"}
                        </h3>
                        <span className="rounded-full border border-arcane/25 bg-arcane/10 px-2 py-0.5 text-[11px] font-semibold text-arcane-100/90">
                          {latestCitations.length}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400">
                        The Judge grounded the latest claim in{" "}
                        <span className="font-semibold text-emerald-300">
                          {latestCitations.length}
                        </span>{" "}
                        live web result
                        {latestCitations.length === 1 ? "" : "s"} from You.com.
                      </p>

                      <button
                        type="button"
                        onClick={() => setInspectorOpen(true)}
                        disabled={latestCitations.length === 0}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                          latestCitations.length > 0
                            ? "border-arcane-300/40 bg-arcane/10 text-arcane-100 hover:border-arcane-300/70 hover:bg-arcane/20 hover:shadow-glow-arcane active:scale-[0.97]"
                            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-600",
                        )}
                      >
                        <span aria-hidden>🔍</span>
                        Inspect the evidence
                      </button>
                    </div>
                  </aside>
                </div>
              </motion.div>
            )}

            {/* ---------------- RECAP ---------------- */}
            {view === "recap" && recap && (
              <motion.div
                key="recap"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex flex-col gap-8"
              >
                <RecapScreen state={recap} onPlayAgain={actions.playAgain} />

                <div className="mx-auto w-full max-w-md">
                  <ShareCard
                    roomId={recap.room.id}
                    topic={recap.room.topic}
                    winner={recap.winner}
                    scores={recap.scores}
                    citationCount={recap.claims.reduce(
                      (n, c) => n + (c.citations?.length ?? 0),
                      0,
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ---- Turn theater (search → read → rule suspense) ---- */}
      <TurnTheater
        active={turnActive}
        actor={theaterActor}
        stage={turnStage ?? (turnActive ? "searching" : "idle")}
        query={liveQuery ?? undefined}
        sourceCount={liveSourceCount}
      />

      {/* ---- Citation inspector drawer for the latest claim ---- */}
      <CitationInspector
        citations={latestCitations}
        reliedIndex={latestCitations.length ? 0 : null}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />

      {/* ---- Verdict reveal overlay (above everything) ---- */}
      <VerdictReveal
        show={!!verdict}
        verdict={verdict?.verdict ?? null}
        rationale={verdict?.rationale ?? undefined}
        points={verdict?.points}
        author={verdict?.author}
        onDone={actions.dismissVerdict}
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small local atom: the picker mode tab.                                     */
/* -------------------------------------------------------------------------- */

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
        active
          ? "bg-gradient-to-r from-arcane/30 to-rune/20 text-white shadow-glow-arcane"
          : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
