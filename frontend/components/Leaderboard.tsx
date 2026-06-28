'use client'

import { motion } from 'framer-motion'
import { type LeaderboardEntry } from '@/lib/debate-client'
import { cn } from '@/lib/ui'

export interface LeaderboardProps {
  entries: LeaderboardEntry[]
  loading?: boolean
}

/** Medal styling for the top three positions in the hall of fame. */
const RANK_STYLES: Record<number, { ring: string; glow: string; text: string; badge: string }> = {
  0: {
    ring: 'ring-amber-300/50',
    glow: 'shadow-[0_0_28px_-6px_rgba(252,211,77,0.55)]',
    text: 'text-amber-200',
    badge: 'from-amber-300/90 to-yellow-600/90 text-amber-950',
  },
  1: {
    ring: 'ring-zinc-300/40',
    glow: 'shadow-[0_0_22px_-8px_rgba(212,212,216,0.45)]',
    text: 'text-zinc-200',
    badge: 'from-zinc-200/90 to-zinc-500/90 text-zinc-900',
  },
  2: {
    ring: 'ring-orange-400/40',
    glow: 'shadow-[0_0_22px_-8px_rgba(251,146,60,0.45)]',
    text: 'text-orange-200',
    badge: 'from-orange-300/90 to-amber-700/90 text-orange-950',
  },
}

const MEDALS = ['🥇', '🥈', '🥉']

function scoreTone(score: number): string {
  if (score >= 30) return 'text-emerald-300'
  if (score > 0) return 'text-amber-200'
  if (score === 0) return 'text-zinc-300'
  return 'text-rose-300'
}

/** Best-effort display name for a champion row. */
function championName(entry: LeaderboardEntry): string {
  const n = entry.display_name?.trim()
  return n && n.length > 0 ? n : 'A nameless challenger'
}

/** Two-letter initials for the avatar fallback. */
function championInitials(entry: LeaderboardEntry): string {
  const n = championName(entry)
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return n.slice(0, 2).toUpperCase()
}

function HallShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-b from-[#16102b]/90 via-[#120c25]/90 to-[#0c081a]/90 p-5 shadow-2xl backdrop-blur-sm">
      {/* arcane rune glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl"
      />
      <header className="relative mb-4 flex items-center justify-between gap-3 border-b border-violet-400/15 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]" aria-hidden>
            🏆
          </span>
          <div>
            <h2
              className="text-lg font-semibold tracking-wide text-amber-100"
              style={{ fontFamily: 'Cinzel, Georgia, serif' }}
            >
              Hall of Champions
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/60">
              Mortals who bested the Wizard
            </p>
          </div>
        </div>
      </header>
      <div className="relative">{children}</div>
    </section>
  )
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div
      className="flex animate-pulse items-center gap-3 rounded-xl border border-violet-400/10 bg-white/[0.02] px-3 py-3"
      style={{ animationDelay: `${i * 90}ms` }}
    >
      <div className="h-7 w-7 rounded-full bg-violet-400/15" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/5 rounded bg-violet-400/15" />
        <div className="h-2 w-1/4 rounded bg-violet-400/10" />
      </div>
      <div className="h-5 w-10 rounded bg-amber-400/15" />
    </div>
  )
}

export function Leaderboard({ entries, loading = false }: LeaderboardProps) {
  if (loading) {
    return (
      <HallShell>
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} i={i} />
          ))}
        </div>
      </HallShell>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <HallShell>
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <span className="text-4xl opacity-70 drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]" aria-hidden>
            🪄
          </span>
          <p className="text-sm font-medium text-zinc-200" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            The hall stands empty
          </p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-violet-300/60">
            No challenger has yet etched their name in the runes. Win a duel to claim the first throne.
          </p>
        </div>
      </HallShell>
    )
  }

  // Rank by lifetime wins, then total score (mirrors the backend ordering).
  const ranked = [...entries].sort(
    (a, b) => b.wins - a.wins || b.total_score - a.total_score,
  )
  const topScore = Math.max(1, ranked[0]?.total_score ?? 1)

  return (
    <HallShell>
      <ol className="space-y-2">
        {ranked.map((entry, idx) => {
          const medalStyle = RANK_STYLES[idx]
          const name = championName(entry)
          const pct = Math.max(
            6,
            Math.min(100, (Math.max(entry.total_score, 0) / topScore) * 100),
          )

          return (
            <motion.li
              key={`${entry.display_name ?? 'anon'}-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.4), ease: 'easeOut' }}
              className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-colors',
                medalStyle
                  ? cn('border-transparent bg-white/[0.04] ring-1', medalStyle.ring, medalStyle.glow)
                  : 'border-violet-400/10 bg-white/[0.02] hover:border-violet-400/25 hover:bg-white/[0.04]',
              )}
            >
              {/* score-proportional rune bar behind the row */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 -z-0 bg-gradient-to-r from-violet-500/10 to-transparent transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />

              {/* rank badge */}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                {medalStyle ? (
                  <span className="text-xl drop-shadow-[0_0_6px_rgba(0,0,0,0.5)]" aria-hidden>
                    {MEDALS[idx]}
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/20 bg-violet-950/40 text-xs font-semibold tabular-nums text-violet-200/80">
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* avatar */}
              <div className="relative z-10 shrink-0">
                {entry.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-violet-400/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500/40 to-amber-400/40 text-[11px] font-bold text-zinc-50 ring-1 ring-violet-400/30">
                    {championInitials(entry)}
                  </span>
                )}
              </div>

              {/* name + W-L record */}
              <div className="relative z-10 min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-medium leading-snug',
                    medalStyle ? medalStyle.text : 'text-zinc-100',
                  )}
                  title={name}
                >
                  {name}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px] tabular-nums">
                  <span className="text-emerald-300/80">{entry.wins}W</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-rose-300/80">{entry.losses}L</span>
                </div>
              </div>

              {/* score */}
              <div className="relative z-10 flex shrink-0 flex-col items-end">
                <span
                  className={cn(
                    'text-base font-bold tabular-nums leading-none',
                    scoreTone(entry.total_score),
                  )}
                  style={{ fontFamily: 'Cinzel, Georgia, serif' }}
                >
                  {entry.total_score > 0 ? `+${entry.total_score}` : entry.total_score}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-violet-300/40">
                  pts
                </span>
              </div>
            </motion.li>
          )
        })}
      </ol>

      <p className="relative mt-4 border-t border-violet-400/10 pt-3 text-center text-[10px] uppercase tracking-[0.2em] text-violet-300/40">
        Grounded by live You.com evidence
      </p>
    </HallShell>
  )
}

export default Leaderboard
