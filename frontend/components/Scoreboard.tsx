'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/ui'

export interface ScoreboardProps {
  you: number
  wizard: number
  round: number
  roundsTotal: number
  status: string
}

/** Smoothly animated integer that springs toward `value`. */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value)
  const spring = useSpring(mv, { stiffness: 140, damping: 18, mass: 0.6 })
  const rounded = useTransform(spring, (latest) => Math.round(latest).toString())
  const [display, setDisplay] = useState(value.toString())

  useEffect(() => {
    mv.set(value)
  }, [value, mv])

  useEffect(() => rounded.on('change', (v) => setDisplay(v)), [rounded])

  return <span className={className}>{display}</span>
}

interface SideConfig {
  name: string
  sigil: string
  score: number
  accent: string
  glow: string
  ring: string
  bar: string
  text: string
  chipBg: string
  align: 'left' | 'right'
}

function SideCard({
  side,
  leading,
}: {
  side: SideConfig
  leading: boolean
}) {
  return (
    <motion.div
      layout
      animate={{
        scale: leading ? 1.03 : 1,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'relative flex-1 overflow-hidden rounded-2xl border px-5 py-4 backdrop-blur-sm transition-colors duration-500',
        side.ring,
        leading ? cn(side.chipBg, side.glow) : 'bg-white/[0.02] shadow-none',
        side.align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {/* leading aura */}
      <AnimatePresence>
        {leading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-30 blur-2xl',
              side.bar,
            )}
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          'flex items-center gap-2',
          side.align === 'right' ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full border text-base shadow-inner',
            side.ring,
            side.chipBg,
          )}
          aria-hidden
        >
          {side.sigil}
        </span>
        <div className={cn(side.align === 'right' ? 'text-right' : 'text-left')}>
          <p
            className={cn(
              'font-serif text-sm font-semibold tracking-wide',
              side.text,
            )}
          >
            {side.name}
          </p>
          <AnimatePresence>
            {leading && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn('text-[10px] uppercase tracking-[0.2em]', side.text)}
              >
                Leading
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div
        className={cn(
          'mt-1 flex items-baseline gap-1 tabular-nums',
          side.align === 'right' ? 'justify-end' : 'justify-start',
        )}
      >
        <AnimatedNumber
          value={side.score}
          className={cn(
            'font-serif text-5xl font-bold leading-none drop-shadow',
            side.text,
          )}
        />
        <span className={cn('text-[11px] font-medium uppercase tracking-wider opacity-60', side.text)}>
          pts
        </span>
      </div>
    </motion.div>
  )
}

export function Scoreboard({ you, wizard, round, roundsTotal, status }: ScoreboardProps) {
  const youLeading = you > wizard
  const wizardLeading = wizard > you
  const prevRound = useRef(round)

  const youSide: SideConfig = {
    name: 'You',
    sigil: '✦', // ✦
    score: you,
    accent: 'amber',
    glow: 'shadow-[0_0_28px_-6px_rgba(251,191,36,0.55)]',
    ring: 'border-amber-400/40',
    bar: 'from-amber-300/50 to-amber-500/30',
    text: 'text-amber-200',
    chipBg: 'bg-amber-500/10',
    align: 'left',
  }

  const wizardSide: SideConfig = {
    name: 'The Wizard',
    sigil: '🧙', // 🧙
    score: wizard,
    accent: 'violet',
    glow: 'shadow-[0_0_28px_-6px_rgba(167,139,250,0.6)]',
    ring: 'border-violet-400/40',
    bar: 'from-violet-300/50 to-fuchsia-500/30',
    text: 'text-violet-200',
    chipBg: 'bg-violet-500/10',
    align: 'right',
  }

  const statusLabel = status
    ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
    : 'In progress'

  useEffect(() => {
    prevRound.current = round
  }, [round])

  return (
    <section
      aria-label="Live scoreboard"
      className="relative mx-auto w-full max-w-2xl"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-950/70 via-slate-950/80 to-violet-950/70 p-5 shadow-2xl shadow-violet-950/40">
        {/* faint rune grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden
        />

        <div className="relative flex items-stretch gap-3">
          <SideCard side={youSide} leading={youLeading} />

          {/* center: round + VS */}
          <div className="flex shrink-0 flex-col items-center justify-center px-1">
            <span className="font-serif text-xs uppercase tracking-[0.25em] text-violet-300/70">
              Round
            </span>
            <div className="flex items-baseline gap-1 tabular-nums">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={round}
                  initial={{ y: 14, opacity: 0, scale: 0.7 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -14, opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="font-serif text-3xl font-bold text-white drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]"
                >
                  {round}
                </motion.span>
              </AnimatePresence>
              <span className="font-serif text-lg text-white/40">/</span>
              <span className="font-serif text-lg text-white/60">{roundsTotal}</span>
            </div>
            <span
              className="mt-1 select-none font-serif text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300/80 animate-pulse-glow"
              aria-hidden
            >
              vs
            </span>
          </div>

          <SideCard side={wizardSide} leading={wizardLeading} />
        </div>

        {/* status footer */}
        <div className="relative mt-4 flex items-center justify-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'active' || status === 'in_progress'
                ? 'animate-pulse bg-emerald-400'
                : status === 'finished' || status === 'complete'
                  ? 'bg-amber-400'
                  : 'bg-violet-400/70',
            )}
            aria-hidden
          />
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/50">
            {statusLabel}
          </p>
        </div>
      </div>
    </section>
  )
}

export default Scoreboard
