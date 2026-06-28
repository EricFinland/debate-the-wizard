'use client'

import { motion } from 'framer-motion'
import {
  type Claim,
  type Citation,
  type GetRoomResponse,
} from '@/lib/debate-client'
import { verdictStyles, cn, domainOf } from '@/lib/ui'
import ClaimCard from '@/components/ClaimCard'

type Winner = GetRoomResponse['winner']

interface RecapScreenProps {
  state: GetRoomResponse
  onPlayAgain: () => void
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const SIDE = {
  player: {
    label: 'You',
    accent: 'text-amber-200',
    ring: 'ring-amber-400/40',
    glow: 'shadow-[0_0_60px_-12px_rgba(251,191,36,0.55)]',
    bar: 'from-amber-300 via-amber-400 to-yellow-500',
    chip: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  },
  wizard: {
    label: 'The Wizard',
    accent: 'text-violet-200',
    ring: 'ring-violet-400/40',
    glow: 'shadow-[0_0_60px_-12px_rgba(167,139,250,0.55)]',
    bar: 'from-violet-300 via-violet-400 to-fuchsia-500',
    chip: 'bg-violet-400/10 text-violet-200 border-violet-400/30',
  },
} as const

function winnerCopy(winner: Winner): {
  title: string
  sub: string
  accent: string
  glow: string
  ribbon: string
} {
  switch (winner) {
    case 'A':
      return {
        title: 'Victory',
        sub: 'You out-argued the Wizard. The grimoire bows to evidence.',
        accent: 'from-amber-200 via-yellow-300 to-amber-400',
        glow: 'shadow-[0_0_120px_-20px_rgba(251,191,36,0.7)]',
        ribbon: 'The Champion of Facts',
      }
    case 'B':
      return {
        title: 'The Wizard Prevails',
        sub: 'The arcane arguments held. Sharpen your citations and duel again.',
        accent: 'from-violet-200 via-fuchsia-300 to-violet-400',
        glow: 'shadow-[0_0_120px_-20px_rgba(167,139,250,0.7)]',
        ribbon: 'Bested by the Arcane',
      }
    case 'tie':
      return {
        title: 'A Stalemate',
        sub: 'Two minds, evenly matched. The ledger of truth calls it even.',
        accent: 'from-zinc-200 via-slate-300 to-zinc-400',
        glow: 'shadow-[0_0_120px_-20px_rgba(148,163,184,0.55)]',
        ribbon: 'Evenly Matched',
      }
    default:
      return {
        title: 'Duel Complete',
        sub: 'The match has ended. Review the cited trail below.',
        accent: 'from-zinc-200 via-slate-300 to-zinc-400',
        glow: 'shadow-[0_0_120px_-20px_rgba(148,163,184,0.5)]',
        ribbon: 'Final Tally',
      }
  }
}

function countSourcing(claims: Claim[]): number {
  return claims.reduce(
    (acc, c) => acc + (c.citations ? c.citations.length : 0),
    0,
  )
}

/* -------------------------------------------------------------------------- */
/*  Small presentational atoms                                                 */
/* -------------------------------------------------------------------------- */

function ScorePillar({
  side,
  name,
  score,
  max,
  winning,
}: {
  side: 'player' | 'wizard'
  name: string
  score: number
  max: number
  winning: boolean
}) {
  const s = SIDE[side]
  const pct = max > 0 ? Math.max(6, Math.round((Math.max(score, 0) / max) * 100)) : 6
  return (
    <div
      className={cn(
        'relative flex-1 rounded-2xl border bg-black/30 p-5 backdrop-blur-sm transition-all',
        winning ? cn('ring-2', s.ring, s.glow) : 'border-white/10',
        winning ? 'border-transparent' : '',
      )}
    >
      {winning && (
        <span
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
            s.chip,
          )}
        >
          Winner
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'font-serif text-lg font-semibold tracking-wide',
            s.accent,
          )}
          style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
        >
          {name}
        </span>
        <span
          className={cn('font-serif text-4xl font-bold tabular-nums', s.accent)}
          style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
        >
          {score}
        </span>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', s.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.25 }}
        />
      </div>
    </div>
  )
}

function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
      <span className="font-serif text-2xl font-bold text-zinc-100 tabular-nums">
        {value}
      </span>
      <span className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </span>
    </div>
  )
}

/**
 * Fallback timeline card used only if the shared <ClaimCard> is unavailable.
 * The spec asks us to reuse <ClaimCard>; this remains as a defensive renderer
 * but the primary path renders ClaimCard.
 */
function CitationRow({ citation }: { citation: Citation }) {
  const domain = citation.url ? domainOf(citation.url) : ''
  return (
    <a
      href={citation.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/[0.08]"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
          You.com
        </span>
        <span className="truncate text-xs text-cyan-300/70">{domain}</span>
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-cyan-50 group-hover:text-white">
        {citation.title}
      </p>
      {citation.snippet && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
          {citation.snippet}
        </p>
      )}
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function RecapScreen({ state, onPlayAgain }: RecapScreenProps) {
  const { room, scores, winner } = state
  const claims = [...(state.claims ?? [])].sort((a, b) => {
    if (a.round_no !== b.round_no) return a.round_no - b.round_no
    // player before wizard within the same round
    return a.author === b.author ? 0 : a.author === 'player' ? -1 : 1
  })

  const copy = winnerCopy(winner)
  const playerScore = scores?.A ?? 0
  const wizardScore = scores?.B ?? 0
  const maxScore = Math.max(playerScore, wizardScore, 10)
  const totalCitations = countSourcing(claims)
  const supportedCount = claims.filter((c) => c.verdict === 'supported').length

  const playerWins = winner === 'A'
  const wizardWins = winner === 'B'

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* Ambient backdrop glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-violet-600/15 via-indigo-700/5 to-transparent blur-2xl"
      />

      {/* ---------------------------- Winner banner --------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          'relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-8 text-center backdrop-blur-md sm:p-12',
          copy.glow,
        )}
      >
        {/* rune sigil */}
        <motion.div
          initial={{ rotate: -8, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl"
        >
          {winner === 'A' ? '🏆' : winner === 'B' ? '🧙' : '⚖️'}
        </motion.div>

        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-zinc-400">
          {copy.ribbon}
        </p>
        <h1
          className={cn(
            'mt-3 bg-gradient-to-r bg-clip-text font-serif text-5xl font-bold text-transparent sm:text-6xl',
            copy.accent,
          )}
          style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
        >
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-300 sm:text-base">
          {copy.sub}
        </p>

        {room?.topic && (
          <p className="mx-auto mt-5 max-w-lg rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs italic text-zinc-300">
            “{room.topic}”
          </p>
        )}
      </motion.div>

      {/* ----------------------------- Scoreboard ----------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 flex flex-col gap-4 sm:flex-row"
      >
        <ScorePillar
          side="player"
          name={SIDE.player.label}
          score={playerScore}
          max={maxScore}
          winning={playerWins}
        />
        <div className="flex items-center justify-center">
          <span
            className="font-serif text-2xl font-bold text-zinc-500"
            style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
          >
            vs
          </span>
        </div>
        <ScorePillar
          side="wizard"
          name={SIDE.wizard.label}
          score={wizardScore}
          max={maxScore}
          winning={wizardWins}
        />
      </motion.div>

      {/* ------------------------------ Stat row ------------------------------ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <StatChip value={room?.rounds_total ?? '—'} label="Rounds" />
        <StatChip value={claims.length} label="Claims" />
        <StatChip value={supportedCount} label="Supported" />
        <StatChip value={totalCitations} label="Sources cited" />
      </motion.div>

      {/* --------------------------- Citation trail --------------------------- */}
      <div className="mt-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <h2
            className="font-serif text-xl font-semibold tracking-wide text-zinc-200"
            style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
          >
            The Cited Trail
          </h2>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        <p className="mb-8 text-center text-xs text-zinc-400">
          Every claim, fact-checked and grounded in live{' '}
          <span className="font-semibold text-cyan-300">You.com</span> search.
        </p>

        {claims.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-400">
            No claims were recorded in this duel.
          </div>
        ) : (
          <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-amber-400/30 before:via-violet-400/30 before:to-transparent sm:before:left-[9px]">
            {claims.map((claim, i) => {
              const isPlayer = claim.author === 'player'
              const v = claim.verdict ?? 'pending'
              const vs = verdictStyles[v]
              return (
                <motion.li
                  key={claim.id ?? `${claim.round_no}-${claim.author}-${i}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(0.5 + i * 0.06, 1.4),
                  }}
                  className="relative pl-8 sm:pl-10"
                >
                  {/* timeline node */}
                  <span
                    className={cn(
                      'absolute left-0 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 sm:h-5 sm:w-5',
                      isPlayer
                        ? 'border-amber-400 bg-amber-400/20'
                        : 'border-violet-400 bg-violet-400/20',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isPlayer ? 'bg-amber-300' : 'bg-violet-300',
                      )}
                    />
                  </span>

                  {/* round / side meta */}
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                    <span className="text-zinc-500">Round {claim.round_no}</span>
                    <span className="text-zinc-600">·</span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 font-semibold',
                        isPlayer ? SIDE.player.chip : SIDE.wizard.chip,
                      )}
                    >
                      {isPlayer ? SIDE.player.label : SIDE.wizard.label}
                    </span>
                    <span
                      className={cn(
                        'ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        vs.text,
                        vs.bg,
                        vs.border,
                      )}
                    >
                      <span>{vs.emoji}</span>
                      <span>{vs.label}</span>
                    </span>
                  </div>

                  {/* Shared ClaimCard renders the full grounded claim + sources */}
                  <ClaimCard claim={claim} />
                </motion.li>
              )
            })}
          </ol>
        )}
      </div>

      {/* ------------------------------- CTA ---------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-14 flex flex-col items-center"
      >
        <button
          type="button"
          onClick={onPlayAgain}
          className={cn(
            'group relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-violet-500/20 to-fuchsia-500/20 px-10 py-4',
            'font-serif text-lg font-semibold tracking-wide text-amber-50',
            'shadow-[0_0_40px_-10px_rgba(167,139,250,0.6)] transition-all',
            'hover:scale-[1.03] hover:border-amber-300/70 hover:shadow-[0_0_60px_-8px_rgba(251,191,36,0.7)]',
            'active:scale-95',
          )}
          style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
        >
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          <span className="relative flex items-center gap-2">
            <span>⚔️</span>
            Duel Again
          </span>
        </button>
        <p className="mt-4 text-xs text-zinc-500">
          Choose a new topic and challenge the Wizard once more.
        </p>
      </motion.div>
    </div>
  )
}

export default RecapScreen
