"use client";

// ShareCard — a shareable recap of a finished duel. Summarizes who won, the
// final scores, and how many citations were marshalled, with a one-click
// "Copy share link" button that copies a spectate URL to the clipboard.
//
// Animation rule: all idle/decorative motion is pure CSS (Tailwind keyframes).
// No framer-motion here.

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";

export interface ShareCardProps {
  roomId: string;
  topic: string;
  winner: "A" | "B" | "tie" | null;
  scores: { A: number; B: number };
  citationCount: number;
}

type Outcome = {
  /** Headline shown at the top of the result band. */
  headline: string;
  /** One-line flavor describing what happened. */
  flavor: string;
  /** Emoji sigil for the result. */
  sigil: string;
  /** Accent classes for the result band. */
  text: string;
  border: string;
  bg: string;
  glow: string;
};

function outcomeFor(
  winner: ShareCardProps["winner"],
  scores: { A: number; B: number },
): Outcome {
  switch (winner) {
    case "A":
      return {
        headline: "Challenger Prevails",
        flavor: "The mortal out-argued the wizard.",
        sigil: "🗡️",
        text: "text-rune-200",
        border: "border-rune-300/40",
        bg: "bg-rune-sheen",
        glow: "shadow-glow-rune",
      };
    case "B":
      return {
        headline: "The Wizard Wins",
        flavor: "Arcane sophistry carried the day.",
        sigil: "🧙",
        text: "text-arcane-200",
        border: "border-arcane-300/40",
        bg: "bg-arcane-sheen",
        glow: "shadow-glow-arcane",
      };
    case "tie":
      return {
        headline: "A Stalemate",
        flavor: "Mortal and wizard fought to a draw.",
        sigil: "⚖️",
        text: "text-verdict-pending",
        border: "border-arcane/30",
        bg: "bg-arcane/10",
        glow: "shadow-glow-arcane",
      };
    default:
      return {
        headline: "Duel In Progress",
        flavor: "No verdict has been sealed yet.",
        sigil: "🔮",
        text: "text-verdict-pending",
        border: "border-arcane/25",
        bg: "bg-arcane/5",
        glow: "shadow-none",
      };
  }
}

export function ShareCard({
  roomId,
  topic,
  winner,
  scores,
  citationCount,
}: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outcome = outcomeFor(winner, scores);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?spectate=${encodeURIComponent(roomId)}`
      : `/?spectate=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  const flash = useCallback((ok: boolean) => {
    setCopied(ok);
    setError(!ok);
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => {
      setCopied(false);
      setError(false);
    }, 1800);
  }, []);

  const onCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        flash(true);
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      // Legacy fallback for browsers without the async clipboard API.
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        flash(ok);
      } catch {
        flash(false);
      }
    }
  }, [shareUrl, flash]);

  const aLead = scores.A > scores.B;
  const bLead = scores.B > scores.A;

  return (
    <section
      aria-label="Shareable duel recap"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-arena-900/70 p-5 backdrop-blur",
        "animate-scale-in",
        outcome.border,
        outcome.glow,
      )}
    >
      {/* Decorative arcane wash — pure CSS, sits behind content. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 opacity-70",
          outcome.bg,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 -z-10 h-40 w-40 rounded-full bg-arcane/20 blur-3xl animate-pulse-glow"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[0.7rem] uppercase tracking-[0.25em] text-arcane-200/70">
            Duel Recap
          </p>
          <h3
            className={cn(
              "mt-1 flex items-center gap-2 font-display text-xl leading-tight",
              outcome.text,
            )}
          >
            <span className="text-2xl animate-float" aria-hidden>
              {outcome.sigil}
            </span>
            {outcome.headline}
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-arcane/25 bg-arena-800/60 px-3 py-1 font-display text-[0.7rem] uppercase tracking-widest text-arcane-200/80">
          {citationCount} {citationCount === 1 ? "source" : "sources"}
        </span>
      </div>

      {/* Topic */}
      <p className="mt-3 text-sm italic text-zinc-300/90">
        &ldquo;{topic}&rdquo;
      </p>
      <p className={cn("mt-1 text-xs", outcome.text, "opacity-80")}>
        {outcome.flavor}
      </p>

      {/* Score line */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ScorePill
          label="Challenger"
          score={scores.A}
          leading={aLead}
          tone="rune"
        />
        <ScorePill
          label="Wizard"
          score={scores.B}
          leading={bLead}
          tone="arcane"
        />
      </div>

      {/* Share action */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onCopy}
          aria-live="polite"
          className={cn(
            "group relative inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5",
            "font-display text-sm tracking-wide transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-arcane-300/60",
            copied
              ? "border-emerald-400/50 bg-emerald-500/15 text-verdict-supported"
              : error
                ? "border-rose-400/50 bg-rose-500/15 text-verdict-misleading"
                : "border-arcane-300/40 bg-arcane/10 text-arcane-100 hover:border-arcane-300/70 hover:bg-arcane/20 hover:shadow-glow-arcane",
          )}
        >
          <span aria-hidden className="text-base">
            {copied ? "✨" : error ? "⚠️" : "🔗"}
          </span>
          {copied ? "Copied!" : error ? "Copy failed" : "Copy share link"}
        </button>
      </div>

      <p className="mt-2 truncate text-center text-[0.7rem] text-zinc-400/70">
        {shareUrl}
      </p>
    </section>
  );
}

function ScorePill({
  label,
  score,
  leading,
  tone,
}: {
  label: string;
  score: number;
  leading: boolean;
  tone: "rune" | "arcane";
}) {
  const toneText = tone === "rune" ? "text-rune-200" : "text-arcane-200";
  const toneBorder =
    tone === "rune" ? "border-rune-300/40" : "border-arcane-300/40";
  const toneGlow =
    tone === "rune" ? "shadow-glow-rune" : "shadow-glow-arcane";

  return (
    <div
      className={cn(
        "rounded-xl border bg-arena-800/50 px-3 py-2.5 transition-shadow",
        toneBorder,
        leading ? toneGlow : "shadow-none",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[0.7rem] uppercase tracking-widest text-zinc-300/80">
          {label}
        </span>
        {leading && (
          <span
            className={cn("text-[0.65rem] uppercase tracking-wider", toneText)}
          >
            lead
          </span>
        )}
      </div>
      <div className={cn("mt-0.5 font-display text-2xl", toneText)}>
        {score}
      </div>
    </div>
  );
}

export default ShareCard;
