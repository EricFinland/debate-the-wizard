'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'

import { type Verdict } from '@/lib/debate-client'
import { verdictStyles, cn, type VerdictKey } from '@/lib/ui'

export interface VerdictRevealProps {
  show: boolean
  verdict: Verdict | null
  rationale?: string
  points?: number
  author?: 'player' | 'wizard'
  onDone?: () => void
}

const AUTO_DISMISS_MS = 2200

/** Map points to a signed display string. */
function formatPoints(points?: number): string {
  if (points === undefined || points === null || Number.isNaN(points)) return ''
  if (points > 0) return `+${points}`
  return `${points}`
}

/**
 * Build the headline shown on the banner. When the wizard is caught lying
 * (misleading), we make it extra satisfying.
 */
function headlineFor(verdict: Verdict, author?: 'player' | 'wizard'): string {
  const isWizard = author === 'wizard'
  switch (verdict) {
    case 'supported':
      return isWizard ? 'The Wizard Holds Firm' : 'Your Claim Stands'
    case 'misleading':
      return isWizard ? 'The Wizard Is Caught Lying!' : 'Caught Misleading'
    case 'unsupported':
      return isWizard ? 'The Wizard Falters' : 'Unsupported Claim'
    default:
      return 'Consulting the Oracle…'
  }
}

export function VerdictReveal({
  show,
  verdict,
  rationale,
  points,
  author,
  onDone,
}: VerdictRevealProps) {
  const reduceMotion = useReducedMotion()

  // Auto-dismiss after the dramatic beat.
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onDone?.(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [show, onDone])

  // Nothing to reveal without a verdict.
  const active = show && !!verdict
  const v: VerdictKey = verdict ?? 'pending'
  const style = verdictStyles[v]

  const isWizardCaught = v === 'misleading' && author === 'wizard'
  const pointsText = formatPoints(points)
  const headline = verdict ? headlineFor(verdict, author) : ''

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="verdict-reveal"
          className="fixed inset-0 z-[120] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          aria-live="assertive"
          role="status"
        >
          {/* Scrim */}
          <motion.div
            className="absolute inset-0 bg-[#0a0613]/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />

          {/* Radial verdict-colored glow burst behind the banner */}
          <motion.div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0',
              style.glow,
            )}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.55, scale: 1.1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              maskImage:
                'radial-gradient(circle at center, black 0%, transparent 60%)',
              WebkitMaskImage:
                'radial-gradient(circle at center, black 0%, transparent 60%)',
            }}
          />

          {/* The banner */}
          <motion.div
            className={cn(
              'relative w-full max-w-2xl overflow-hidden rounded-2xl border-2 px-7 py-7 sm:px-10 sm:py-9 text-center shadow-2xl',
              style.bg,
              style.border,
              style.glow,
            )}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 36, scale: 0.86, rotateX: -18 }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    rotateX: 0,
                    ...(isWizardCaught
                      ? { x: [0, -10, 9, -7, 5, -3, 0] }
                      : {}),
                  }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -24, scale: 0.92 }
            }
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : {
                    type: 'spring',
                    stiffness: 320,
                    damping: 22,
                    mass: 0.8,
                    ...(isWizardCaught
                      ? { x: { duration: 0.55, ease: 'easeInOut', delay: 0.12 } }
                      : {}),
                  }
            }
            style={{ transformPerspective: 900 }}
          >
            {/* Sweeping shimmer across the banner */}
            {!reduceMotion && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/15 blur-md"
                initial={{ x: '-60%', opacity: 0 }}
                animate={{ x: '420%', opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.18 }}
              />
            )}

            {/* Emoji medallion */}
            <motion.div
              className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-black/25 text-5xl ring-1 ring-white/15 sm:h-24 sm:w-24 sm:text-6xl"
              initial={reduceMotion ? { opacity: 0 } : { scale: 0, rotate: -90 }}
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : {
                      scale: 1,
                      rotate: 0,
                      ...(isWizardCaught
                        ? { rotate: [0, -12, 12, -8, 0] }
                        : {}),
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0.2 }
                  : {
                      type: 'spring',
                      stiffness: 380,
                      damping: 14,
                      delay: 0.08,
                      ...(isWizardCaught
                        ? { rotate: { duration: 0.6, delay: 0.2 } }
                        : {}),
                    }
              }
            >
              <span role="img" aria-hidden>
                {style.emoji}
              </span>
            </motion.div>

            {/* Author tag */}
            {author && (
              <motion.div
                className={cn(
                  'mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.28em]',
                  style.text,
                  'opacity-80',
                )}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 0.8, y: 0 }}
                transition={{ delay: 0.16, duration: 0.3 }}
              >
                {author === 'wizard' ? 'The Wizard' : 'You'}
              </motion.div>
            )}

            {/* Headline */}
            <motion.h2
              className={cn(
                'font-serif text-2xl font-bold leading-tight tracking-tight sm:text-4xl',
                style.text,
              )}
              style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
            >
              {headline}
            </motion.h2>

            {/* Verdict label */}
            <motion.div
              className={cn(
                'mt-1 text-sm font-semibold uppercase tracking-[0.35em]',
                style.text,
                'opacity-70',
              )}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.26, duration: 0.3 }}
            >
              {style.label}
            </motion.div>

            {/* Points */}
            {pointsText && (
              <motion.div
                className={cn(
                  'mt-4 inline-flex items-baseline gap-1 rounded-xl bg-black/25 px-5 py-2 ring-1 ring-white/10',
                )}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: [0.6, 1.18, 1] }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : { delay: 0.3, duration: 0.5, ease: 'easeOut' }
                }
              >
                <span
                  className={cn(
                    'font-serif text-3xl font-extrabold tabular-nums sm:text-4xl',
                    style.text,
                  )}
                  style={{
                    fontFamily: 'var(--font-display, Cinzel, Georgia, serif)',
                  }}
                >
                  {pointsText}
                </span>
                <span className={cn('text-xs uppercase tracking-widest', style.text, 'opacity-60')}>
                  pts
                </span>
              </motion.div>
            )}

            {/* Rationale */}
            {rationale && (
              <motion.p
                className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-zinc-200/90 sm:text-base"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, duration: 0.35 }}
              >
                {rationale}
              </motion.p>
            )}

            {/* Bottom progress sliver that drains over the auto-dismiss window */}
            {!reduceMotion && (
              <motion.div
                aria-hidden
                className={cn(
                  'absolute inset-x-0 bottom-0 h-1 origin-left',
                  style.text.replace('text-', 'bg-'),
                  'opacity-60',
                )}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default VerdictReveal
