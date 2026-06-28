'use client'

import { motion } from 'framer-motion'
import { type Scores } from '@/lib/debate-client'
import { cn } from '@/lib/ui'

interface ScoreBarsProps {
  scores: Scores | null
}

/** A single scored dimension: its label, color theme, and a short flavor word. */
type Dimension = {
  key: keyof Scores
  label: string
  /** gradient (from -> to) used for the filled portion of the bar */
  from: string
  to: string
  /** glow color used behind the bar fill */
  glow: string
}

const DIMENSIONS: Dimension[] = [
  {
    key: 'factual_accuracy',
    label: 'Factual Accuracy',
    from: 'from-emerald-400',
    to: 'to-emerald-600',
    glow: 'shadow-[0_0_14px_-2px_rgba(52,211,153,0.7)]',
  },
  {
    key: 'logic',
    label: 'Logic',
    from: 'from-sky-400',
    to: 'to-sky-600',
    glow: 'shadow-[0_0_14px_-2px_rgba(56,189,248,0.7)]',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    from: 'from-violet-400',
    to: 'to-fuchsia-600',
    glow: 'shadow-[0_0_14px_-2px_rgba(192,132,252,0.7)]',
  },
  {
    key: 'persuasiveness',
    label: 'Persuasiveness',
    from: 'from-amber-300',
    to: 'to-amber-500',
    glow: 'shadow-[0_0_14px_-2px_rgba(251,191,36,0.7)]',
  },
]

/** Clamp any incoming value into the 0-10 display range. */
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, n))
}

/** Color the numeric readout by quality tier so values read at a glance. */
function valueTone(value: number): string {
  if (value >= 8) return 'text-emerald-300'
  if (value >= 5) return 'text-amber-200'
  if (value > 0) return 'text-rose-300'
  return 'text-zinc-500'
}

export function ScoreBars({ scores }: ScoreBarsProps) {
  if (!scores) {
    return (
      <div
        className={cn(
          'rounded-xl border border-violet-500/15 bg-violet-950/20 px-4 py-5',
          'backdrop-blur-sm'
        )}
        aria-hidden="true"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Scorecard
          </span>
        </div>
        <div className="space-y-3">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-zinc-600">{dim.label}</span>
              <div className="h-2.5 flex-1 rounded-full bg-zinc-800/60" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs italic text-zinc-600">
          No scorecard yet — the runes are still being read.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-950/40 to-indigo-950/30',
        'px-4 py-5 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200/80">
          Scorecard
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">/ 10</span>
      </div>

      <div className="space-y-3.5">
        {DIMENSIONS.map((dim, i) => {
          const value = clampScore(scores[dim.key] as number)
          const pct = (value / 10) * 100
          return (
            <div key={dim.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs font-medium text-zinc-300">
                {dim.label}
              </span>

              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800/70 ring-1 ring-inset ring-white/5">
                <motion.div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
                    dim.from,
                    dim.to,
                    dim.glow
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.9,
                    delay: 0.08 * i,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {/* subtle sheen running along the filled bar */}
                  <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
                </motion.div>
              </div>

              <motion.span
                className={cn(
                  'w-9 shrink-0 text-right font-mono text-sm font-semibold tabular-nums',
                  valueTone(value)
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.08 * i + 0.5 }}
              >
                {value.toFixed(1)}
              </motion.span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ScoreBars
