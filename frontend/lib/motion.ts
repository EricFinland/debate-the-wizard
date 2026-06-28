// =============================================================================
// MOTION SYSTEM — the SAFE animation contract for Debate the Wizard.
//
// WHY THIS FILE EXISTS
//   This setup has a known framer-motion WAAPI crash. To avoid it forever we
//   split motion into two lanes and NEVER cross them:
//
//   1. LOOPING / DECORATIVE / IDLE / ENTRANCE  ->  pure CSS keyframes.
//        Use the Tailwind `animate-*` classes or the `.anim-*` utilities defined
//        in globals.css (float, pulse-glow, shimmer, sparkle, fade-in-up,
//        fade-in, scale-in). These can loop forever safely because no WAAPI /
//        framer-motion is involved. See the CSS_ANIM map below for the canonical
//        class names so components don't hardcode strings.
//
//   2. OVERLAY / MODAL MOUNT+UNMOUNT  and  THE VERDICT REVEAL  ->  framer-motion.
//        ONLY here do we use <motion.* /> + <AnimatePresence>, because those
//        elements must animate on the way OUT (CSS can't unmount).
//        Every preset below obeys the rules:
//          - explicit POSITIVE durations (never 0, never omitted)
//          - NO `repeat: Infinity` anywhere (loops belong to CSS)
//          - content is visible by default; variants enhance, never hide it
//            permanently (an unmounted element is gone, not invisible).
//
// IMPORT
//   import { overlayBackdrop, modalPanel, verdictReveal, listStagger,
//            listItem, EASE, DUR } from "@/lib/motion"
//
// All variants are plain objects typed as framer-motion `Variants`, safe to
// spread into <motion.div variants=... initial="hidden" animate="visible"
// exit="hidden">.
// =============================================================================

import type { Variants, Transition } from "framer-motion";
import type { Verdict } from "@/lib/debate-client";

// -----------------------------------------------------------------------------
// Shared tokens — keep timing/easing consistent across every reveal.
// -----------------------------------------------------------------------------

/** Named easings (cubic-bezier tuples). Use instead of magic arrays. */
export const EASE = {
  /** Standard ease-out — most enter transitions. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Gentle ease-in-out — symmetric enter/exit. */
  inOut: [0.45, 0, 0.2, 1] as const,
  /** A touch of overshoot for the verdict "thunk". */
  pop: [0.34, 1.56, 0.64, 1] as const,
} as const;

/** Named durations in SECONDS (framer-motion unit). All strictly positive. */
export const DUR = {
  fast: 0.18,
  base: 0.28,
  slow: 0.42,
  reveal: 0.55,
} as const;

const tBase: Transition = { duration: DUR.base, ease: EASE.out };

// -----------------------------------------------------------------------------
// OVERLAY BACKDROP — dim/blur layer behind a modal. Mount + unmount via opacity.
// -----------------------------------------------------------------------------
export const overlayBackdrop: Variants = {
  hidden: { opacity: 0, transition: { duration: DUR.fast, ease: EASE.inOut } },
  visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE.inOut } },
};

// -----------------------------------------------------------------------------
// MODAL / DIALOG PANEL — scales + lifts in, drops back out. Use for any overlay
// card (join modal, settings, share sheet) inside <AnimatePresence>.
// -----------------------------------------------------------------------------
export const modalPanel: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: DUR.fast, ease: EASE.inOut },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE.out },
  },
};

// -----------------------------------------------------------------------------
// SLIDE-OVER PANEL — drawer that enters from the right (e.g. citations panel).
// -----------------------------------------------------------------------------
export const slideOverRight: Variants = {
  hidden: {
    opacity: 0,
    x: 32,
    transition: { duration: DUR.base, ease: EASE.inOut },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DUR.slow, ease: EASE.out },
  },
};

// -----------------------------------------------------------------------------
// VERDICT REVEAL — the marquee moment. The judge's ruling drops in with a
// little overshoot. One-shot only; the looping aura around it is CSS
// (.anim-pulse-glow). Pair with verdictRevealTransition for the overshoot.
// -----------------------------------------------------------------------------
export const verdictReveal: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DUR.reveal, ease: EASE.pop },
  },
  // Exit (if the card can be dismissed/replaced) — quick, no overshoot.
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: DUR.fast, ease: EASE.inOut },
  },
};

/** Convenience transition if you'd rather animate props inline than via variants. */
export const verdictRevealTransition: Transition = {
  duration: DUR.reveal,
  ease: EASE.pop,
};

// -----------------------------------------------------------------------------
// STAGGERED LIST — a parent that cascades its children in. Use for claim feeds
// and leaderboard rows that mount as a group. (For rows added one-at-a-time over
// time, prefer the CSS `.anim-fade-in-up` per row instead.)
// -----------------------------------------------------------------------------
export const listStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: tBase },
};

// -----------------------------------------------------------------------------
// SIMPLE ONE-SHOT REVEALS — for framer-managed elements that also need an exit.
// (If the element never unmounts with animation, use the CSS `.anim-*` classes
// instead — cheaper and crash-proof.)
// -----------------------------------------------------------------------------
export const fadeIn: Variants = {
  hidden: { opacity: 0, transition: { duration: DUR.fast, ease: EASE.inOut } },
  visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE.out } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14, transition: { duration: DUR.fast, ease: EASE.inOut } },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, transition: { duration: DUR.fast, ease: EASE.inOut } },
  visible: { opacity: 1, scale: 1, transition: { duration: DUR.base, ease: EASE.out } },
};

// -----------------------------------------------------------------------------
// CSS-CLASS MAP — canonical class names for the pure-CSS lane, so components
// reference these instead of typo-prone string literals. Each value is a
// className string (use directly or via cn() from "@/lib/ui").
//
//   import { CSS_ANIM } from "@/lib/motion"
//   <div className={CSS_ANIM.float}>🔮</div>
//   <li className={`${CSS_ANIM.fadeInUp} ${CSS_ANIM.delay(150)}`}>…</li>
// -----------------------------------------------------------------------------
export const CSS_ANIM = {
  // looping / decorative / idle
  float: "anim-float",
  pulseGlow: "anim-pulse-glow",
  shimmer: "anim-shimmer",
  sparkle: "anim-sparkle",
  // one-shot entrance
  fadeIn: "anim-fade-in",
  fadeInUp: "anim-fade-in-up",
  scaleIn: "anim-scale-in",
  /** Stagger delay helper -> "anim-delay-150". Falls back to inline-safe set. */
  delay(ms: 75 | 100 | 150 | 200 | 300 | 500): string {
    return `anim-delay-${ms}`;
  },
} as const;

// -----------------------------------------------------------------------------
// VERDICT-AWARE REVEAL PICKER — small helper so the verdict card can vary its
// entrance feel by ruling (supported pops, misleading shudders subtly). Returns
// framer `Variants`; still one-shot, still positive duration, no infinite loop.
// -----------------------------------------------------------------------------
export function verdictRevealFor(verdict: Verdict | "pending"): Variants {
  switch (verdict) {
    case "supported":
      return {
        hidden: { opacity: 0, scale: 0.78, y: -10 },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: DUR.reveal, ease: EASE.pop },
        },
        exit: { opacity: 0, scale: 0.9, transition: { duration: DUR.fast } },
      };
    case "misleading":
      return {
        hidden: { opacity: 0, scale: 0.9, x: -6 },
        visible: {
          opacity: 1,
          scale: 1,
          x: 0,
          transition: { duration: DUR.slow, ease: EASE.out },
        },
        exit: { opacity: 0, scale: 0.94, transition: { duration: DUR.fast } },
      };
    case "unsupported":
    case "pending":
    default:
      return verdictReveal;
  }
}

// -----------------------------------------------------------------------------
// Default export — the full preset toolkit as one object for ergonomic imports.
//   import motion from "@/lib/motion"; motion.modalPanel
// -----------------------------------------------------------------------------
const motionPresets = {
  EASE,
  DUR,
  overlayBackdrop,
  modalPanel,
  slideOverRight,
  verdictReveal,
  verdictRevealTransition,
  verdictRevealFor,
  listStagger,
  listItem,
  fadeIn,
  fadeInUp,
  scaleIn,
  CSS_ANIM,
};

export default motionPresets;
