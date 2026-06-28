"use client";

import { cn } from "@/lib/ui";

export interface WizardTauntProps {
  /** The wizard's line of trash talk. Hidden entirely when null/empty. */
  taunt: string | null;
  /**
   * 'confident' = the wizard is gloating (default arcane styling).
   * 'caught'    = the wizard's own claim was ruled misleading (rose styling).
   */
  mood: "confident" | "caught";
}

/**
 * A speech bubble emanating from the wizard, carrying his taunt.
 *
 * Motion follows the project ANIMATION RULE: the pop-in is a pure CSS keyframe
 * (scoped locally so it never depends on shared globals), no framer-motion.
 * The bubble is fully visible by default — the animation only enhances entry.
 *
 * Re-mounts (and thus re-plays the pop) whenever the taunt text changes, via a
 * `key` on the text content from the parent or naturally on conditional render.
 */
export function WizardTaunt({ taunt, mood }: WizardTauntProps) {
  // Nothing to say — render nothing.
  if (!taunt || !taunt.trim()) return null;

  const caught = mood === "caught";

  return (
    <div
      className="wt-root pointer-events-none flex w-full justify-end"
      role="status"
      aria-live="polite"
    >
      <style>{WT_STYLES}</style>

      <div
        className={cn(
          "wt-pop pointer-events-auto relative max-w-[34ch] sm:max-w-[42ch]",
          "rounded-2xl rounded-tr-sm px-4 py-3",
          "backdrop-blur-md shadow-lg",
          "font-display text-[0.98rem] leading-snug tracking-[0.01em]",
          caught
            ? "border border-rose-400/45 bg-rose-500/[0.10] text-rose-100 shadow-glow-misleading"
            : "border border-arcane-400/45 bg-arcane/[0.10] text-arcane-100 shadow-glow-arcane",
        )}
      >
        {/* Speaker label */}
        <div
          className={cn(
            "mb-1 flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em]",
            caught ? "text-rose-300/90" : "text-arcane-300/90",
          )}
        >
          <span
            aria-hidden
            className={cn("wt-orb text-sm leading-none", !caught && "wt-orb--glow")}
          >
            {caught ? "😤" : "🧙"}
          </span>
          <span>{caught ? "The Wizard, rattled" : "The Wizard"}</span>
        </div>

        {/* The taunt itself */}
        <p className="m-0 text-zinc-50/95">{taunt}</p>

        {/* Bubble tail pointing up-right toward the wizard */}
        <span
          aria-hidden
          className={cn(
            "absolute -top-2 right-4 h-4 w-4 rotate-45 rounded-[3px]",
            "backdrop-blur-md",
            caught
              ? "border-l border-t border-rose-400/45 bg-rose-500/[0.10]"
              : "border-l border-t border-arcane-400/45 bg-arcane/[0.10]",
          )}
        />
      </div>
    </div>
  );
}

export default WizardTaunt;

/**
 * Scoped keyframes. Kept local to honor strict file ownership (no edits to
 * globals.css / tailwind.config) while still using CSS-only motion per the
 * ANIMATION RULE. Class names are namespaced (`wt-`) to avoid collisions.
 */
const WT_STYLES = `
@keyframes wt-pop-in {
  0%   { opacity: 0; transform: translateY(8px) scale(0.92); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.015); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes wt-orb-glow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(168,85,247,0.55)); }
  50%      { filter: drop-shadow(0 0 10px rgba(168,85,247,0.95)); }
}
.wt-pop {
  /* Visible by default; the animation only enhances the entrance. */
  transform-origin: top right;
  animation: wt-pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.wt-orb--glow {
  display: inline-block;
  animation: wt-orb-glow 2.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .wt-pop { animation: none; }
  .wt-orb--glow { animation: none; }
}
`;
