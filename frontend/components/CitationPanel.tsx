'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Citation } from '@/lib/debate-client'
import { cn, domainOf } from '@/lib/ui'

export interface CitationPanelProps {
  citations: Citation[]
  highlightUrl?: string | null
  title?: string
}

/**
 * CitationPanel — the You.com "money shot".
 *
 * Renders the live-search sources that every claim in the duel is grounded in.
 * Each source is a card (favicon dot, title, linked domain, snippet). The
 * highlighted source (the one tied to the active claim) gets an emphasized
 * arcane glow. Powered-by-You.com badge sits at the top so the sponsor is
 * always visible. Scrollable when the source list runs long.
 */
export function CitationPanel({
  citations,
  highlightUrl = null,
  title = 'Sources',
}: CitationPanelProps) {
  const normalizedHighlight = useMemo(
    () => (highlightUrl ? highlightUrl.trim() : null),
    [highlightUrl],
  )

  // Sort so the highlighted source floats to the top — it's the proof for the
  // claim currently on screen.
  const ordered = useMemo(() => {
    if (!citations?.length) return []
    if (!normalizedHighlight) return citations
    const isHit = (c: Citation) => c.url === normalizedHighlight
    return [...citations].sort((a, b) => Number(isHit(b)) - Number(isHit(a)))
  }, [citations, normalizedHighlight])

  const count = ordered.length

  return (
    <section
      aria-label="Cited sources"
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl',
        'border border-violet-500/20 bg-gradient-to-b from-indigo-950/70 to-slate-950/80',
        'shadow-[0_0_40px_-12px_rgba(124,58,237,0.45)] backdrop-blur-sm',
      )}
    >
      {/* Arcane top edge glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/10 to-transparent"
      />

      {/* Header */}
      <header className="relative z-10 flex items-start justify-between gap-3 border-b border-violet-500/15 px-4 py-3.5">
        <div className="min-w-0">
          <h3
            className="truncate font-serif text-base font-semibold tracking-wide text-violet-50"
            style={{ fontFamily: 'var(--font-display, Georgia), serif' }}
          >
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300/60">
            {count > 0
              ? `${count} live source${count === 1 ? '' : 's'}`
              : 'Live web search'}
          </p>
        </div>

        {/* Powered by You.com badge */}
        <PoweredByYou />
      </header>

      {/* List */}
      <div
        className={cn(
          'relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-3',
          'scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent',
        )}
      >
        {count === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {ordered.map((c, i) => (
                <CitationCard
                  key={c.id ?? `${c.url}-${i}`}
                  citation={c}
                  highlighted={
                    !!normalizedHighlight && c.url === normalizedHighlight
                  }
                  index={i}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}

function CitationCard({
  citation,
  highlighted,
  index,
}: {
  citation: Citation
  highlighted: boolean
  index: number
}) {
  const domain = domainOf(citation.url)
  const initial = (citation.title?.trim()?.[0] ?? domain?.[0] ?? '•').toUpperCase()

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.2) }}
      className={cn(
        'group relative overflow-hidden rounded-xl border p-3 transition-colors duration-300',
        highlighted
          ? 'border-violet-400/60 bg-violet-500/10 shadow-[0_0_24px_-6px_rgba(167,139,250,0.6)]'
          : 'border-white/5 bg-white/[0.02] hover:border-violet-400/30 hover:bg-white/[0.04]',
      )}
    >
      {highlighted && (
        <motion.span
          aria-hidden
          layoutId="citation-highlight-rail"
          className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-violet-300 via-fuchsia-400 to-violet-500"
        />
      )}

      <div className="flex items-start gap-3">
        {/* Favicon-ish dot */}
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            highlighted
              ? 'bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-[0_0_12px_-2px_rgba(217,70,239,0.7)]'
              : 'bg-gradient-to-br from-violet-600/40 to-indigo-700/40 text-violet-100 ring-1 ring-inset ring-white/10',
          )}
        >
          {initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-violet-50">
              {citation.title?.trim() || domain || 'Untitled source'}
            </h4>
            {highlighted && (
              <span className="shrink-0 rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200 ring-1 ring-inset ring-violet-400/30">
                Cited
              </span>
            )}
          </div>

          {citation.url ? (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium',
                'text-violet-300/80 underline-offset-2 transition-colors hover:text-violet-200 hover:underline',
              )}
              title={citation.url}
            >
              <LinkGlyph />
              <span className="truncate">{domain || citation.url}</span>
            </a>
          ) : (
            <span className="mt-0.5 block truncate text-xs text-violet-300/40">
              {domain || 'no link'}
            </span>
          )}

          {citation.snippet?.trim() && (
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-zinc-300/85">
              {citation.snippet.trim()}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 px-6 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-300/50"
      >
        <SearchGlyph />
      </motion.div>
      <p className="text-sm font-medium text-violet-200/70">No sources found.</p>
      <p className="max-w-[200px] text-xs leading-relaxed text-violet-300/40">
        Claims get grounded in live web results the moment a debater speaks.
      </p>
    </div>
  )
}

function PoweredByYou() {
  return (
    <a
      href="https://you.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group shrink-0 select-none rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1',
        'text-[10px] font-semibold tracking-wide text-violet-200 transition-colors hover:border-violet-300/50 hover:bg-violet-500/20',
      )}
      title="Sources retrieved via You.com live search"
    >
      <span className="text-violet-300/70 group-hover:text-violet-200">
        Powered by
      </span>{' '}
      <span className="bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text font-bold text-transparent">
        You.com
      </span>
    </a>
  )
}

/* ---- inline glyphs (no extra deps) ---- */

function LinkGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function SearchGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export default CitationPanel
