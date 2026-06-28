"use client";

// SearchQueryBadge — surfaces the live You.com search behind a judged claim.
// This is the visible "win condition" of the demo: it proves the verdict was
// grounded in a real-time web search, not the model's memory.
//
// Render rule: hidden entirely if there is no query (nothing to show).
//
// Animation: CSS-only (entrance + a gently pulsing search dot). Per the project
// ANIMATION RULE we never use framer-motion for looping/idle motion. Content is
// visible by default; the animation only enhances it.

import { cn } from "@/lib/ui";

export interface SearchQueryBadgeProps {
  /** The query string sent to You.com. Null/empty hides the badge. */
  query: string | null;
  /** Number of web sources returned for that query. */
  sourceCount: number;
}

export function SearchQueryBadge({ query, sourceCount }: SearchQueryBadgeProps) {
  const trimmed = query?.trim();
  if (!trimmed) return null;

  const sources = Math.max(0, Math.floor(sourceCount || 0));
  const sourceLabel = `${sources} source${sources === 1 ? "" : "s"}`;

  return (
    <div
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-full",
        "border border-arcane/30 bg-arcane/10 px-3 py-1.5",
        "text-xs font-medium text-arcane-100/90 shadow-glow-arcane",
        "animate-fade-in-up",
      )}
      title={`You.com searched: ${trimmed} · ${sourceLabel}`}
    >
      {/* live search indicator — pulsing dot reads as "real-time" */}
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arcane/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-arcane" />
      </span>

      <span aria-hidden="true" className="shrink-0 text-sm leading-none">
        🔍
      </span>

      <span className="shrink-0 text-arcane-200/70">
        You.com searched:
      </span>

      <span className="min-w-0 truncate font-semibold text-white" title={trimmed}>
        {trimmed}
      </span>

      <span aria-hidden="true" className="shrink-0 text-arcane-200/40">
        ·
      </span>

      <span className="shrink-0 whitespace-nowrap tabular-nums text-arcane-100/90">
        {sourceLabel}
      </span>
    </div>
  );
}

export default SearchQueryBadge;
