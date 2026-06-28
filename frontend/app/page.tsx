"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, MotionGlobalConfig } from "framer-motion";
import { useDebate } from "@/hooks/useDebate";
import { cn } from "@/lib/ui";

// framer-motion's hardware-accelerated (WAAPI) path throws "duration must be
// non-negative" on this Next 14 / React 18 setup, which left animated elements
// stuck at their initial opacity:0 (invisible content). Render final states
// instead — everything stays visible and interactive; we lose the slide-ins.
MotionGlobalConfig.skipAnimations = true;

import TopicPicker from "@/components/TopicPicker";
import Leaderboard from "@/components/Leaderboard";
import Scoreboard from "@/components/Scoreboard";
import WizardAvatar from "@/components/WizardAvatar";
import ArgumentInput from "@/components/ArgumentInput";
import ClaimCard from "@/components/ClaimCard";
import CitationPanel from "@/components/CitationPanel";
import VerdictReveal from "@/components/VerdictReveal";
import RecapScreen from "@/components/RecapScreen";

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
    actions,
  } = useDebate();

  // Pull the leaderboard up-front on the picker, and again whenever we land
  // back there (e.g. after Play Again).
  useEffect(() => {
    if (view === "picker") void actions.loadLeaderboard();
  }, [view, actions]);

  const latestClaim = claims.length ? claims[claims.length - 1] : null;
  const latestCitations = latestClaim?.citations ?? [];

  // Translate the hook's status string + wizard flag into the WizardAvatar state.
  const wizardState = wizardThinking
    ? "thinking"
    : verdict?.author === "wizard"
      ? "speaking"
      : "idle";

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Title banner */}
      <header className="relative z-10 px-6 pt-10 pb-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-extrabold tracking-wide sm:text-5xl text-arcane-shimmer"
        >
          Debate the Wizard
        </motion.h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Out-argue an arcane AI in a live, fact-checked duel. Every claim is
          grounded in real-time{" "}
          <span className="font-semibold text-rune">You.com</span> search — and
          the wizard can lose a round too.
        </p>
        <div className="rune-divider mx-auto mt-6 max-w-3xl" />
      </header>

      {/* Global error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
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
        <AnimatePresence mode="wait">
          {/* ---------------- PICKER ---------------- */}
          {view === "picker" && (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]"
            >
              <TopicPicker onStart={actions.start} loading={busy} />
              <Leaderboard entries={leaderboard} />
            </motion.div>
          )}

          {/* ---------------- ARENA ---------------- */}
          {view === "arena" && (
            <motion.div
              key="arena"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-6"
            >
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

                  {/* Claim feed */}
                  <div
                    className={cn(
                      "flex max-h-[52vh] flex-col gap-4 overflow-y-auto rounded-2xl p-1",
                    )}
                  >
                    {claims.length === 0 && (
                      <div className="glass rounded-2xl px-6 py-10 text-center text-zinc-400">
                        Make your opening argument. The wizard will respond — and
                        both of you get fact-checked.
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {claims.map((claim) => (
                        <motion.div
                          key={claim.id}
                          layout
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ClaimCard claim={claim} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <ArgumentInput
                    onSubmit={actions.submitArgument}
                    disabled={busy || wizardThinking}
                    loading={busy || wizardThinking}
                  />
                </div>

                {/* Right: live citations (You.com — sponsor spotlight) */}
                <aside className="lg:sticky lg:top-6 lg:self-start">
                  <CitationPanel
                    citations={latestCitations}
                    highlightUrl={latestCitations[0]?.url ?? null}
                    title={room?.topic ? "Live Sources" : "Sources"}
                  />
                </aside>
              </div>
            </motion.div>
          )}

          {/* ---------------- RECAP ---------------- */}
          {view === "recap" && recap && (
            <motion.div
              key="recap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
            >
              <RecapScreen state={recap} onPlayAgain={actions.playAgain} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Verdict reveal overlay (sits above everything) */}
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
