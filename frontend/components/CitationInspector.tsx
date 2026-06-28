"use client";

// CitationInspector — a You.com live-search showcase drawer.
// Lists every source the Judge looked at for a claim, highlights the one the
// Judge actually relied on, and links each out to the live web.
//
// Animation policy (per project rule): framer-motion is used ONLY for the
// AnimatePresence mount/unmount of the overlay + panel, with explicit positive
// durations and no infinite repeats. All decorative/idle motion is CSS.

import { AnimatePresence, motion } from "framer-motion";
import type { Citation } from "@/lib/debate-client";
import { cn, domainOf } from "@/lib/ui";

export interface CitationInspectorProps {
  citations: Citation[];
  /** Index into `citations` of the source the Judge relied on, if any. */
  reliedIndex?: number | null;
  open: boolean;
  onClose: () => void;
}

function faviconFor(url: string | null | undefined): string | null {
  const host = domainOf(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    host,
  )}&sz=64`;
}

export function CitationInspector({
  citations,
  reliedIndex,
  open,
  onClose,
}: CitationInspectorProps) {
  const sources = Array.isArray(citations) ? citations : [];
  const relied =
    typeof reliedIndex === "number" &&
    reliedIndex >= 0 &&
    reliedIndex < sources.length
      ? reliedIndex
      : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="citation-inspector"
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden={!open}
        >
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close source inspector"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Citation inspector"
            className="relative flex h-full w-full max-w-md flex-col border-l border-arcane/30 bg-[#0b0820]/95 shadow-2xl shadow-black/60"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Decorative arcane top glow (CSS only) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-arcane/20 to-transparent animate-pulse-glow"
            />

            {/* Header */}
            <header className="relative flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-arcane/80">
                  Evidence Inspector
                </p>
                <h2 className="mt-0.5 truncate text-lg font-semibold text-zinc-100">
                  Sources the Judge weighed
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {sources.length === 0
                    ? "No sources found"
                    : `${sources.length} live result${
                        sources.length === 1 ? "" : "s"
                      } retrieved`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-arcane/60"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            {/* Body */}
            <div className="relative flex-1 overflow-y-auto px-5 py-4">
              {sources.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="flex flex-col gap-3">
                  {sources.map((c, i) => (
                    <SourceCard
                      key={c.id ?? `${c.url ?? "src"}-${i}`}
                      citation={c}
                      index={i}
                      isRelied={relied === i}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <footer className="relative border-t border-white/10 px-5 py-3">
              <a
                href="https://you.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow"
                />
                Powered by{" "}
                <span className="font-semibold text-zinc-200 group-hover:text-white">
                  You.com
                </span>{" "}
                live search
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SourceCard({
  citation,
  index,
  isRelied,
}: {
  citation: Citation;
  index: number;
  isRelied: boolean;
}) {
  const { title, url, snippet } = citation;
  const domain = domainOf(url);
  const favicon = faviconFor(url);
  const displayTitle = title?.trim() || domain || "Untitled source";

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 transition",
        isRelied
          ? "border-rune/50 bg-rune/10 shadow-glow-rune"
          : "border-white/10 bg-white/[0.03] hover:border-arcane/40 hover:bg-white/[0.05]",
      )}
    >
      {isRelied && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-rune animate-pulse-glow"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-rune">
            The source the Judge used
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Favicon / index chip */}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30 text-[11px] font-semibold text-zinc-400">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={favicon}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span>{index + 1}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-start gap-1 text-sm font-semibold leading-snug transition focus:outline-none focus-visible:underline",
                isRelied
                  ? "text-rune hover:text-rune/80"
                  : "text-zinc-100 hover:text-arcane",
              )}
            >
              <span className="line-clamp-2">{displayTitle}</span>
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-3 w-3 shrink-0 opacity-50"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          ) : (
            <span className="text-sm font-semibold leading-snug text-zinc-200">
              {displayTitle}
            </span>
          )}

          {domain && (
            <p className="mt-1 truncate text-xs text-zinc-500">{domain}</p>
          )}
        </div>
      </div>

      {snippet?.trim() ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300/90">
          {snippet}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-zinc-500">
          No snippet available for this source.
        </p>
      )}

      {url && (
        <div className="mt-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-arcane/90 transition hover:text-arcane"
          >
            Opens in new tab
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-arcane/20 blur-2xl animate-pulse-glow"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-3xl">
          🔎
        </div>
      </div>
      <div>
        <p className="text-base font-semibold text-zinc-200">
          No sources for this claim
        </p>
        <p className="mt-1 max-w-xs text-sm text-zinc-400">
          The Judge did not retrieve any live web results for this argument, or
          the claim was judged on reasoning alone.
        </p>
      </div>
    </div>
  );
}

export default CitationInspector;
