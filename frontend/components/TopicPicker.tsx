'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SEED_TOPICS } from '@/lib/seed-topics'
import { cn } from '@/lib/ui'

type RoundsOption = 3 | 5 | 7

export interface TopicPickerProps {
  onStart: (input: { topic_id?: string; topic?: string; rounds_total: number }) => void
  loading?: boolean
}

const ROUNDS_OPTIONS: RoundsOption[] = [3, 5, 7]
const MIN_ARG_LENGTH = 20
const MAX_ARG_LENGTH = 600

const MODIFIER_HINT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl'

export function TopicPicker({ onStart, loading = false }: TopicPickerProps) {
  const [argument, setArgument] = useState('')
  const [rounds, setRounds] = useState<RoundsOption>(5)
  const [inspirationOpen, setInspirationOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = argument.trim()
  const charCount = argument.length
  const remaining = MAX_ARG_LENGTH - charCount
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_ARG_LENGTH
  const atLimit = remaining <= 0
  const nearLimit = remaining <= 80
  const valid = trimmed.length >= MIN_ARG_LENGTH && !atLimit
  const canStart = !loading && valid

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setArgument(next.length > MAX_ARG_LENGTH ? next.slice(0, MAX_ARG_LENGTH) : next)
  }, [])

  const handleStart = useCallback(() => {
    if (!canStart) return
    onStart({ topic: trimmed, rounds_total: rounds })
  }, [canStart, trimmed, rounds, onStart])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleStart()
      }
    },
    [handleStart],
  )

  const fillFromSeed = useCallback((topic: string) => {
    setArgument(topic)
    setInspirationOpen(false)
    textareaRef.current?.focus()
  }, [])

  const counterTone = atLimit
    ? 'text-rose-300'
    : nearLimit
      ? 'text-amber-300'
      : 'text-zinc-500'

  const ratio = Math.min(charCount / MAX_ARG_LENGTH, 1)

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0717]/60 text-zinc-100 backdrop-blur-sm">
      {/* arcane background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,57,196,0.28),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(180,140,40,0.12),_transparent_50%)]" />
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
              State Your Claim
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-sm leading-relaxed text-zinc-400 sm:text-base">
            Write your opening argument. The wizard will oppose you — and every
            claim gets fact-checked against live{' '}
            <span className="font-semibold text-zinc-300">You.com</span> search.
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
            You argue{' '}
            <strong className="font-semibold text-amber-200">FOR</strong> your
            claim. The{' '}
            <strong className="font-semibold text-violet-300">wizard</strong>{' '}
            argues against you.
          </span>
        </motion.div>

        {/* ---- Main argument input ---- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="w-full"
        >
          <motion.div
            animate={
              focused
                ? { boxShadow: '0 0 42px -6px rgba(251,191,36,0.35)' }
                : { boxShadow: '0 0 28px -12px rgba(139,92,246,0.4)' }
            }
            transition={{ duration: 0.3 }}
            className={cn(
              'relative w-full overflow-hidden rounded-2xl border bg-zinc-950/60 backdrop-blur-sm transition-colors duration-300',
              focused
                ? 'border-amber-400/50'
                : 'border-violet-500/20',
            )}
          >
            {/* gold seam */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-300',
                'bg-gradient-to-r from-transparent via-amber-300/70 to-transparent',
                focused ? 'opacity-100' : 'opacity-40',
              )}
            />

            <div className="flex items-center gap-2 px-4 pt-3">
              <span
                aria-hidden
                className="text-sm leading-none text-amber-300/80 transition-transform duration-300 group-focus-within:rotate-12"
              >
                ✦
              </span>
              <label
                htmlFor="opening-argument"
                className="select-none font-serif text-xs uppercase tracking-[0.22em] text-amber-200/70"
              >
                Your opening argument
              </label>
            </div>

            <textarea
              ref={textareaRef}
              id="opening-argument"
              value={argument}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={loading}
              spellCheck
              rows={5}
              aria-label="Your opening argument"
              placeholder="e.g. Nuclear energy is far safer than coal per kWh and essential for decarbonisation — the data clearly supports this."
              className={cn(
                'w-full resize-none bg-transparent px-4 pb-3 pt-3 font-sans text-[15px] leading-relaxed text-zinc-100',
                'placeholder:text-zinc-500/70 focus:outline-none',
                'disabled:cursor-not-allowed disabled:text-zinc-500',
                'min-h-[130px] max-h-[280px]',
              )}
            />

            {/* char fill meter */}
            <div aria-hidden className="px-4">
              <div className="h-px w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    atLimit
                      ? 'bg-rose-400'
                      : nearLimit
                        ? 'bg-amber-300'
                        : 'bg-gradient-to-r from-violet-500 to-amber-300',
                  )}
                  initial={false}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span
                className={cn('tabular-nums font-mono text-xs transition-colors duration-200', counterTone)}
                aria-live="polite"
              >
                {charCount.toLocaleString()}
                <span className="text-zinc-600">/{MAX_ARG_LENGTH.toLocaleString()}</span>
              </span>
              <span className="hidden text-xs text-zinc-600 sm:inline">
                {MODIFIER_HINT}
                <span className="px-0.5 text-zinc-700">+</span>
                Enter to begin
              </span>
            </div>
          </motion.div>

          {/* validation hint */}
          <AnimatePresence>
            {tooShort && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 text-xs text-rose-300/80"
              >
                Give the wizard something to chew on — make a real claim.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ---- Inspiration accordion ---- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-5 w-full"
        >
          <button
            type="button"
            onClick={() => setInspirationOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-violet-400/30 hover:text-zinc-200"
          >
            <span aria-hidden className="text-base">📜</span>
            <span className="font-medium">Need inspiration? Browse example claims</span>
            <motion.span
              animate={{ rotate: inspirationOpen ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="ml-auto text-xs text-zinc-600"
              aria-hidden
            >
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {inspirationOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {SEED_TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => fillFromSeed(t.topic)}
                      className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 text-left backdrop-blur transition-colors duration-200 hover:border-violet-400/40 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xl" aria-hidden>📜</span>
                        <span className="text-sm font-medium leading-snug text-zinc-200 group-hover:text-white">
                          {t.topic}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                        <div className="rounded-lg border border-amber-300/20 bg-amber-400/[0.06] px-2.5 py-1.5">
                          <div className="mb-0.5 font-semibold uppercase tracking-wider text-amber-300/70">You</div>
                          <div className="text-zinc-400">{t.human_side_label}</div>
                        </div>
                        <div className="text-center font-bold text-zinc-600">vs</div>
                        <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.06] px-2.5 py-1.5">
                          <div className="mb-0.5 font-semibold uppercase tracking-wider text-violet-300/70">Wizard</div>
                          <div className="text-zinc-400">{t.wizard_side_label}</div>
                        </div>
                      </div>
                      <span className="mt-1 text-xs text-violet-300/60 group-hover:text-violet-300/90 transition-colors">
                        ↗ Use this claim
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ---- Rounds selector ---- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
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
                    active ? 'text-[#0a0717]' : 'text-zinc-400 hover:text-zinc-200',
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

        {/* ---- CTA ---- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
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
                : 'cursor-not-allowed bg-white/5 text-zinc-600',
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
  return (
    <span className="inline-block text-xl leading-none animate-spin" aria-hidden>
      ✶
    </span>
  )
}

export default TopicPicker
