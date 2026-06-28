'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SEED_TOPICS } from '@/lib/seed-topics'
import { cn } from '@/lib/ui'

type RoundsOption = 3 | 5 | 7

export interface TopicPickerProps {
  onStart: (input: { topic_id?: string; topic?: string; rounds_total: number }) => void
  loading?: boolean
}

const ROUNDS_OPTIONS: RoundsOption[] = [3, 5, 7]

const cardVariants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -6, scale: 1.015 },
}

export function TopicPicker({ onStart, loading = false }: TopicPickerProps) {
  // selection state: a seed topic id, or the sentinel 'custom' for the freeform field
  const [selectedId, setSelectedId] = useState<string | null>(SEED_TOPICS[0]?.id ?? null)
  const [customTopic, setCustomTopic] = useState('')
  const [rounds, setRounds] = useState<RoundsOption>(5)

  const usingCustom = selectedId === 'custom'
  const customValid = customTopic.trim().length >= 8
  const canStart = !loading && (usingCustom ? customValid : Boolean(selectedId))

  function handleStart() {
    if (!canStart) return
    if (usingCustom) {
      onStart({ topic: customTopic.trim(), rounds_total: rounds })
    } else if (selectedId) {
      onStart({ topic_id: selectedId, rounds_total: rounds })
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0717]/60 text-zinc-100 backdrop-blur-sm">
      {/* arcane background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,57,196,0.28),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(180,140,40,0.12),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,_rgba(56,189,248,0.07),_transparent_40%)]" />
        <StarField />
      </div>

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-10 sm:py-12">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-8 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.25em] text-violet-200/90 backdrop-blur">
            <span className="text-base leading-none">✦</span>
            Grounded in live You.com search
            <span className="text-base leading-none">✦</span>
          </div>
          <h2
            className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--font-display, Cinzel), Georgia, serif' }}
          >
            <span className="bg-gradient-to-b from-amber-200 via-amber-100 to-amber-300/70 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(217,180,74,0.25)]">
              Choose Your Battleground
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-sm leading-relaxed text-zinc-400 sm:text-base">
            Every claim you and the wizard make is fact-checked against live
            citations. Argue well, or be exposed.
          </p>
        </motion.div>

        {/* side declaration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] px-5 py-3 text-sm shadow-[0_0_30px_-12px_rgba(217,180,74,0.5)]"
        >
          <span className="text-xl">🛡️</span>
          <span className="text-zinc-300">
            You wield the human banner and argue{' '}
            <strong className="font-semibold text-amber-200">FOR</strong> the
            motion. The{' '}
            <strong className="font-semibold text-violet-300">wizard</strong>{' '}
            argues against you.
          </span>
        </motion.div>

        {/* topic scroll cards */}
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
          {SEED_TOPICS.map((t, i) => {
            const active = selectedId === t.id
            return (
              <motion.button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: 'easeOut' }}
                variants={cardVariants}
                whileHover="hover"
                whileTap={{ scale: 0.985 }}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl border p-6 text-left transition-colors duration-300',
                  'bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur',
                  active
                    ? 'border-violet-400/70 shadow-[0_0_45px_-8px_rgba(139,92,246,0.55)]'
                    : 'border-white/10 hover:border-violet-400/40'
                )}
              >
                {/* selected glow ring */}
                {active && (
                  <motion.div
                    layoutId="topic-glow"
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_70%)]"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                <div className="relative flex items-start justify-between gap-3">
                  <span className="text-2xl" aria-hidden>
                    📜
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs transition-all',
                      active
                        ? 'border-violet-300 bg-violet-400 text-[#0a0717]'
                        : 'border-white/20 text-transparent group-hover:border-violet-300/60'
                    )}
                  >
                    ✓
                  </span>
                </div>

                <h3
                  className="relative mt-4 text-lg font-semibold leading-snug text-zinc-100"
                  style={{ fontFamily: 'var(--font-display, Cinzel), Georgia, serif' }}
                >
                  {t.topic}
                </h3>

                <div className="relative mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 text-xs">
                  <div className="rounded-lg border border-amber-300/25 bg-amber-400/[0.07] px-3 py-2">
                    <div className="mb-0.5 font-semibold uppercase tracking-wider text-amber-300/80">
                      You
                    </div>
                    <div className="text-zinc-300">{t.human_side_label}</div>
                  </div>
                  <div className="flex items-center justify-center text-base font-bold text-zinc-500">
                    vs
                  </div>
                  <div className="rounded-lg border border-violet-300/25 bg-violet-400/[0.07] px-3 py-2">
                    <div className="mb-0.5 font-semibold uppercase tracking-wider text-violet-300/80">
                      Wizard
                    </div>
                    <div className="text-zinc-300">{t.wizard_side_label}</div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* custom topic scroll */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-5 w-full"
        >
          <motion.div
            variants={cardVariants}
            initial="rest"
            animate="rest"
            whileHover="hover"
            onClick={() => setSelectedId('custom')}
            className={cn(
              'group relative cursor-text overflow-hidden rounded-2xl border p-6 transition-colors duration-300',
              'bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur',
              usingCustom
                ? 'border-violet-400/70 shadow-[0_0_45px_-8px_rgba(139,92,246,0.55)]'
                : 'border-white/10 hover:border-violet-400/40'
            )}
          >
            <div className="relative flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                ✍️
              </span>
              <span
                className="text-lg font-semibold text-zinc-100"
                style={{ fontFamily: 'var(--font-display, Cinzel), Georgia, serif' }}
              >
                Inscribe your own motion
              </span>
            </div>
            <p className="relative mt-1 text-xs text-zinc-500">
              You will argue <span className="text-amber-300">FOR</span> whatever
              you write. The wizard takes the opposing stance.
            </p>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onFocus={() => setSelectedId('custom')}
              placeholder="e.g. Remote work makes companies more productive."
              className={cn(
                'relative mt-4 w-full rounded-xl border bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600',
                usingCustom
                  ? 'border-violet-400/50 ring-2 ring-violet-500/20'
                  : 'border-white/10 focus:border-violet-400/50'
              )}
            />
            <AnimatePresence>
              {usingCustom && customTopic.length > 0 && !customValid && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative mt-2 text-xs text-rose-300/80"
                >
                  Give the wizard something to chew on (at least a few words).
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* rounds selector */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-10 flex flex-col items-center"
        >
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
            Rounds in the duel
          </div>
          <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur">
            {ROUNDS_OPTIONS.map((r) => {
              const active = rounds === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRounds(r)}
                  className={cn(
                    'relative z-10 h-11 w-16 rounded-full text-sm font-semibold transition-colors',
                    active ? 'text-[#0a0717]' : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="rounds-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_0_20px_-4px_rgba(217,180,74,0.7)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  {r}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="mt-12 w-full max-w-md"
        >
          <motion.button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            whileHover={canStart ? { scale: 1.025 } : undefined}
            whileTap={canStart ? { scale: 0.97 } : undefined}
            className={cn(
              'group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-8 py-5 text-lg font-bold tracking-wide transition-all',
              canStart
                ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 text-white shadow-[0_0_50px_-8px_rgba(168,85,247,0.7)]'
                : 'cursor-not-allowed bg-white/5 text-zinc-600'
            )}
            style={{ fontFamily: 'var(--font-display, Cinzel), Georgia, serif' }}
          >
            {/* shimmer sweep */}
            {canStart && (
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            )}
            {loading ? (
              <>
                <SpinnerRune />
                <span>Summoning the arena…</span>
              </>
            ) : (
              <>
                <span className="text-2xl leading-none" aria-hidden>
                  ⚔️
                </span>
                <span>Begin the Duel</span>
              </>
            )}
          </motion.button>
          <p className="mt-4 text-center text-xs text-zinc-600">
            Citations powered by{' '}
            <span className="font-semibold text-zinc-400">You.com</span> live
            search.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function SpinnerRune() {
  // CSS-only spin (Tailwind's built-in `animate-spin` keyframe) per the
  // ANIMATION RULE — looping motion must never use framer-motion.
  return (
    <span className="inline-block text-xl leading-none animate-spin" aria-hidden>
      ✶
    </span>
  )
}

function StarField() {
  // deterministic scatter so SSR and client markup match (no hydration drift)
  const stars = Array.from({ length: 36 }, (_, i) => {
    const seed = (i * 2654435761) >>> 0
    const left = (seed % 1000) / 10
    const top = ((seed >> 10) % 1000) / 10
    const size = ((seed >> 5) % 3) + 1
    const delay = ((seed >> 7) % 40) / 10
    const dur = 2.5 + ((seed >> 3) % 30) / 10
    return { left, top, size, delay, dur, id: i }
  })
  // Twinkle is a pure-CSS keyframe loop (`animate-sparkle`) per the ANIMATION
  // RULE — per-star timing is carried via inline animationDuration/Delay so the
  // scatter still feels organic without any framer-motion infinite loops.
  return (
    <div className="absolute inset-0">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-violet-200 animate-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default TopicPicker
