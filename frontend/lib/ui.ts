// Shared UI helpers used by every presentational component.
// Keep the API stable — components import these by exact name.

import type { Verdict } from "@/lib/debate-client";

export type VerdictKey = Verdict | "pending";

export interface VerdictStyle {
  label: string;
  emoji: string;
  text: string; // text color class
  bg: string; // background class
  border: string; // border class
  glow: string; // box-shadow class
}

/**
 * Tailwind class strings for each verdict state. Components read these to style
 * claim cards, verdict reveals, badges, etc. "pending" is the in-flight state
 * before a verdict comes back from the judge.
 */
export const verdictStyles: Record<VerdictKey, VerdictStyle> = {
  supported: {
    label: "Supported",
    emoji: "✅",
    text: "text-verdict-supported",
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/40",
    glow: "shadow-glow-supported",
  },
  unsupported: {
    label: "Unsupported",
    emoji: "🤷",
    text: "text-verdict-unsupported",
    bg: "bg-zinc-500/10",
    border: "border-zinc-400/30",
    glow: "shadow-none",
  },
  misleading: {
    label: "Misleading",
    emoji: "⚠️",
    text: "text-verdict-misleading",
    bg: "bg-rose-500/10",
    border: "border-rose-400/40",
    glow: "shadow-glow-misleading",
  },
  pending: {
    label: "Judging…",
    emoji: "🔮",
    text: "text-verdict-pending",
    bg: "bg-arcane/10",
    border: "border-arcane/30",
    glow: "shadow-glow-arcane",
  },
};

/** Join class names, dropping falsy values. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Hostname from a URL, gracefully degrading on bad input. */
export function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    // Best-effort fallback for non-absolute or malformed urls.
    const m = String(url).match(/^(?:https?:\/\/)?([^/?#]+)/i);
    return m ? m[1].replace(/^www\./, "") : String(url);
  }
}
