"use client";

// TurnTheater — the turn-suspense piece.
// While a turn computes, this plays an animated, on-brand sequence:
//   "Searching You.com…" (with the query) → "Reading N sources…" → "The Judge is ruling…"
// All looping/idle motion is pure CSS (Tailwind keyframes + classes) per the
// project ANIMATION RULE. framer-motion is used ONLY for the mount/unmount of the
// whole overlay via AnimatePresence, with an explicit positive duration and no
// infinite repeats.

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui";

export type TurnStage = "searching" | "reading" | "ruling" | "idle";
export type TurnActor = "you" | "wizard";

export interface TurnTheaterProps {
  active: boolean;
  actor: TurnActor;
  stage: TurnStage;
  query?: string;
  sourceCount?: number;
}

interface ActorTheme {
  label: string;
  accentText: string;
  accentBorder: string;
  accentGlow: string;
  ringFrom: string;
  sigil: string;
}

const ACTOR_THEME: Record<TurnActor, ActorTheme> = {
  you: {
    label: "Your turn",
    accentText: "text-rune-300",
    accentBorder: "border-rune-300/40",
    accentGlow: "shadow-glow-rune",
    ringFrom: "from-rune-300/60",
    sigil: "⚜",
  },
  wizard: {
    label: "The Wizard's turn",
    accentText: "text-arcane-300",
    accentBorder: "border-arcane-400/40",
    accentGlow: "shadow-glow-arcane",
    ringFrom: "from-arcane-400/70",
    sigil: "✶",
  },
};

const STAGE_ORDER: Exclude<TurnStage, "idle">[] = [
  "searching",
  "reading",
  "ruling",
];

const STAGE_INDEX: Record<TurnStage, number> = {
  idle: -1,
  searching: 0,
  reading: 1,
  ruling: 2,
};

function stageHeadline(
  stage: TurnStage,
  sourceCount?: number,
): { title: string; sub: ReactNode } {
  switch (stage) {
    case "searching":
      return {
        title: "Searching the web…",
        sub: (
          <span>
            Casting a query through{" "}
            <span className="font-semibold text-sky-300">You.com</span> search
          </span>
        ),
      };
    case "reading": {
      const n = typeof sourceCount === "number" && sourceCount > 0
        ? sourceCount
        : null;
      return {
        title: n ? `Reading ${n} source${n === 1 ? "" : "s"}…` : "Reading sources…",
        sub: <span>Weighing the evidence the search returned</span>,
      };
    }
    case "ruling":
      return {
        title: "The Judge is ruling…",
        sub: <span>Verdict incantation in progress</span>,
      };
    default:
      return { title: "", sub: null };
  }
}

/** Three-dot animated ellipsis, staggered purely with CSS. */
function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-glow"
          style={{ animationDelay: `${i * 220}ms` }}
        />
      ))}
    </span>
  );
}

function StageStep({
  index,
  current,
  label,
  accentText,
}: {
  index: number;
  current: number;
  label: string;
  accentText: string;
}) {
  const state =
    index < current ? "done" : index === current ? "active" : "todo";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "relative grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold transition-colors duration-500",
          state === "done" &&
            "border-emerald-400/50 bg-emerald-400/15 text-emerald-300",
          state === "active" &&
            cn("border-current bg-white/5", accentText),
          state === "todo" && "border-white/10 bg-white/[0.02] text-white/30",
        )}
      >
        {state === "done" ? (
          "✓"
        ) : state === "active" ? (
          <>
            <span className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
            <span className="relative">{index + 1}</span>
          </>
        ) : (
          index + 1
        )}
      </span>
      <span
        className={cn(
          "text-xs font-medium tracking-wide transition-colors duration-500",
          state === "done" && "text-white/60",
          state === "active" && cn(accentText),
          state === "todo" && "text-white/30",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function TurnTheater({
  active,
  actor,
  stage,
  query,
  sourceCount,
}: TurnTheaterProps) {
  const theme = ACTOR_THEME[actor];
  const visible = active && stage !== "idle";
  const current = STAGE_INDEX[stage];
  const { title, sub } = stageHeadline(stage, sourceCount);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="turn-theater"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed inset-0 z-50 grid place-items-center bg-arena-950/70 p-4 backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ opacity: 1, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "relative w-full max-w-md overflow-hidden rounded-2xl border bg-arena-900/90 p-7 text-center",
              theme.accentBorder,
              theme.accentGlow,
            )}
          >
            {/* Decorative animated aura behind the orb — pure CSS loops. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-gradient-to-b blur-3xl",
                theme.ringFrom,
                "to-transparent animate-pulse-glow",
              )}
            />

            {/* Actor badge */}
            <div className="relative mb-5 flex items-center justify-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                  theme.accentBorder,
                  theme.accentText,
                )}
              >
                {theme.label}
              </span>
            </div>

            {/* The conjuring orb */}
            <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center">
              {/* spinning rune ring */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-full border-2 border-dashed",
                  theme.accentBorder,
                )}
                style={{ animation: "spin 9s linear infinite" }}
              />
              {/* counter-spinning inner ring */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-3 rounded-full border border-white/10",
                )}
                style={{ animation: "spin 6s linear infinite reverse" }}
              />
              {/* floating sigil */}
              <span
                className={cn(
                  "relative select-none text-3xl animate-float",
                  theme.accentText,
                )}
                aria-hidden
              >
                {theme.sigil}
              </span>
            </div>

            {/* Headline */}
            <h2
              className={cn(
                "font-display text-2xl font-semibold leading-tight text-white",
              )}
            >
              <span className="inline-flex items-center gap-2">
                {title}
                <LoadingDots className={theme.accentText} />
              </span>
            </h2>
            <p className="mt-2 text-sm text-white/60">{sub}</p>

            {/* Query reveal during the searching stage */}
            {stage === "searching" && query && (
              <div
                className={cn(
                  "mx-auto mt-4 max-w-sm rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2",
                )}
              >
                <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/90">
                  <span aria-hidden>🔎</span>
                  Powered by You.com
                </div>
                <p className="truncate text-sm italic text-sky-100/90" title={query}>
                  &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {/* Animated progress bar — shimmer is a CSS keyframe. */}
            <div className="relative mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-white/30 via-white/70 to-white/30 bg-[length:200%_100%] animate-shimmer transition-all duration-700 ease-out",
                  current === 0 && "w-1/3",
                  current === 1 && "w-2/3",
                  current >= 2 && "w-full",
                )}
              />
            </div>

            {/* Stage stepper */}
            <div className="mt-6 flex items-center justify-between gap-2">
              {STAGE_ORDER.map((s, i) => (
                <StageStep
                  key={s}
                  index={i}
                  current={current}
                  accentText={theme.accentText}
                  label={
                    s === "searching"
                      ? "Search"
                      : s === "reading"
                        ? "Read"
                        : "Rule"
                  }
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { TurnTheater };
export default TurnTheater;
