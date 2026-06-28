'use client'

import { type GetRoomResponse, type Side } from '@/lib/debate-client'
import { cn } from '@/lib/ui'
import ClaimCard from '@/components/ClaimCard'

/* ------------------------------------------------------------------ */
/*  SpectatorArena — read-only "watching live" view of a duel.         */
/*  Pure presentation: the PARENT polls get-room and passes fresh      */
/*  `state`. No input, no fetching, no local debate logic here.        */
/* ------------------------------------------------------------------ */

export interface SpectatorArenaProps {
  /** Latest get-room snapshot (parent polls). `null` while loading. */
  state: GetRoomResponse | null
  /** Leave the spectator view (back to lobby / list). */
  onLeave: () => void
}

export function SpectatorArena({ state, onLeave }: SpectatorArenaProps) {
  const room = state?.room ?? null
  const scoreA = state?.scores.A ?? 0
  const scoreB = state?.scores.B ?? 0
  const claims = state?.claims ?? []
  const winner = state?.winner ?? null
  const finished = room?.status === 'finished'

  // newest-first feed reads like a live ticker
  const feed = [...claims].sort((a, b) => {
    if (a.round_no !== b.round_no) return b.round_no - a.round_no
    // within a round, wizard (rebuttal) usually lands after the player
    if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
    return 0
  })

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      {/* ---- ambient arena backdrop ---- */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-arena-radial"
      />

      {/* ---- top bar: leave + live indicator ---- */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03]
                     px-3.5 py-1.5 text-sm font-medium text-slate-300 transition-colors
                     hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        >
          <span aria-hidden>←</span>
          Leave
        </button>

        <LiveBadge finished={finished} />
      </div>

      {/* ---- topic banner ---- */}
      <header
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/10',
          'bg-gradient-to-br from-arena-800/70 via-arena-850/60 to-arena-950/80 backdrop-blur-xl',
          'px-5 py-5 sm:px-7 sm:py-6 animate-fade-in-up',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen
                     bg-[radial-gradient(120%_90%_at_50%_-10%,white_0%,transparent_55%)]"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-arcane-200/70">
            <span aria-hidden className="animate-pulse-glow">⚔️</span>
            Arcane Duel · Spectating
          </div>
          <h1
            className="mt-2 text-balance text-xl font-bold leading-snug text-white sm:text-2xl"
            style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}
          >
            {room?.topic ?? 'Loading the duel…'}
          </h1>
          {room ? (
            <p className="mt-1.5 text-xs text-slate-400">
              {finished
                ? `Duel complete · ${room.rounds_total} round${room.rounds_total === 1 ? '' : 's'}`
                : `Round ${currentRound(feed)} of ${room.rounds_total} · in progress`}
            </p>
          ) : null}
        </div>
      </header>

      {/* ---- live scoreboard ---- */}
      <section className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 sm:gap-4">
        <ScorePanel
          side="A"
          name="You"
          emoji="🛡️"
          score={scoreA}
          leading={scoreA > scoreB}
          winner={winner}
          finished={finished}
        />

        <div className="flex flex-col items-center justify-center gap-1 px-1">
          <span
            className="text-lg font-black tracking-widest text-white/30 sm:text-xl"
            style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}
            aria-hidden
          >
            VS
          </span>
          <span className="h-10 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" aria-hidden />
        </div>

        <ScorePanel
          side="B"
          name="The Wizard"
          emoji="🧙"
          score={scoreB}
          leading={scoreB > scoreA}
          winner={winner}
          finished={finished}
        />
      </section>

      {/* ---- finished banner ---- */}
      {finished && winner ? (
        <div
          className={cn(
            'mt-5 rounded-2xl border px-5 py-4 text-center animate-scale-in',
            winner === 'A' && 'border-rune-300/40 bg-rune-300/10 text-rune-100 shadow-glow-rune',
            winner === 'B' && 'border-arcane-400/40 bg-arcane-400/10 text-arcane-100 shadow-glow-arcane',
            winner === 'tie' && 'border-white/15 bg-white/[0.04] text-slate-200',
          )}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">
            Final
          </div>
          <div
            className="mt-1 text-lg font-bold"
            style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}
          >
            {winner === 'tie'
              ? 'A draw — neither side could break the other.'
              : winner === 'A'
                ? '🛡️ The challenger prevails!'
                : '🧙 The Wizard holds the field!'}
          </div>
        </div>
      ) : null}

      {/* ---- claims feed ---- */}
      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <span aria-hidden>📜</span>
          The Exchange
        </div>

        {!state ? (
          <FeedSkeleton />
        ) : feed.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {feed.map((claim, i) => (
              <div
                key={claim.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
              >
                <ClaimCard claim={claim} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Live "watching" pill                                               */
/* ------------------------------------------------------------------ */

function LiveBadge({ finished }: { finished: boolean }) {
  if (finished) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
        Ended
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10
                 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-200"
      title="Watching this duel in real time"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-rose-400/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
      </span>
      Watching Live
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Score panel (one combatant)                                        */
/* ------------------------------------------------------------------ */

function ScorePanel({
  side,
  name,
  emoji,
  score,
  leading,
  winner,
  finished,
}: {
  side: Side
  name: string
  emoji: string
  score: number
  leading: boolean
  winner: Side | 'tie' | null
  finished: boolean
}) {
  const isHuman = side === 'A'
  const isWinner = finished && winner === side
  const theme = isHuman
    ? {
        ring: 'ring-rune-300/30',
        border: leading ? 'border-rune-300/50' : 'border-white/10',
        bg: 'from-rune-500/10 via-amber-500/[0.04] to-transparent',
        accent: 'text-rune-100',
        sub: 'text-rune-200/60',
        glow: leading ? 'shadow-glow-rune' : '',
        num: 'text-rune-100',
      }
    : {
        ring: 'ring-arcane-400/30',
        border: leading ? 'border-arcane-400/50' : 'border-white/10',
        bg: 'from-arcane-500/12 via-fuchsia-500/[0.04] to-transparent',
        accent: 'text-arcane-100',
        sub: 'text-arcane-200/60',
        glow: leading ? 'shadow-glow-arcane' : '',
        num: 'text-arcane-100',
      }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-xl',
        'px-4 py-4 ring-1 ring-inset transition-all duration-500 sm:px-5 sm:py-5',
        theme.border,
        theme.bg,
        theme.ring,
        theme.glow,
        isWinner && 'animate-pulse-glow',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0">
          <div
            className={cn('truncate text-sm font-semibold', theme.accent)}
            style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}
          >
            {name}
          </div>
          <div className={cn('text-[10px] font-medium uppercase tracking-[0.16em]', theme.sub)}>
            {isWinner ? 'Victor' : leading && !finished ? 'Leading' : isHuman ? 'Challenger' : 'Defender'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cn('text-3xl font-black tabular-nums sm:text-4xl', theme.num)}>
          {score}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-white/35">
          pts
        </span>
      </div>

      {isWinner ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 text-base animate-sparkle"
        >
          ✦
        </span>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty + loading states                                             */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="text-3xl animate-float" aria-hidden>
        🔮
      </div>
      <p className="mt-3 text-sm font-medium text-slate-300">No arguments cast yet.</p>
      <p className="mt-1 text-xs text-slate-500">
        The duel is about to begin — claims will appear here as they happen.
      </p>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-40 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] via-white/[0.07] to-white/[0.04]
                     bg-[length:200%_100%] animate-shimmer"
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Highest round number seen in the (newest-first) feed, min 1. */
function currentRound(feed: GetRoomResponse['claims']): number {
  let max = 1
  for (const c of feed) if (c.round_no > max) max = c.round_no
  return max
}

export default SpectatorArena
