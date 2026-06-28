'use client'

import { motion } from 'framer-motion'
import {
  type Claim,
  type Citation,
} from '@/lib/debate-client'
import { verdictStyles, cn, domainOf } from '@/lib/ui'
import ScoreBars from '@/components/ScoreBars'

/* ------------------------------------------------------------------ */
/*  ClaimCard — the hero component. One debate turn, fully rendered.    */
/*  Presentational only: everything comes from props.                  */
/* ------------------------------------------------------------------ */

export interface ClaimCardProps {
  claim: Claim
  /** index into claim.citations that the verdict actually relied on */
  highlightCitationIndex?: number | null
}

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 220,
      damping: 26,
      mass: 0.9,
      when: 'beforeChildren',
      staggerChildren: 0.06,
    },
  },
} as const

const childVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
} as const

export function ClaimCard({ claim, highlightCitationIndex }: ClaimCardProps) {
  const isWizard = claim.author === 'wizard'
  const verdict = verdictStyles[claim.verdict ?? 'pending']
  const citations: Citation[] = claim.citations ?? []
  const hasScores = !!claim.scores

  // author-side theming: rune-gold for the human, arcane-violet for the wizard
  const side = isWizard
    ? {
        name: 'The Wizard',
        emoji: '🧙',
        accentText: 'text-violet-200',
        accentRing: 'ring-violet-400/40',
        badgeBg: 'bg-violet-500/15',
        badgeBorder: 'border-violet-400/40',
        badgeText: 'text-violet-200',
        edge: 'before:from-violet-500/70 before:via-fuchsia-400/40 before:to-transparent',
        glow: 'shadow-[0_0_60px_-15px_rgba(139,92,246,0.55)]',
        rail: 'from-violet-400 via-fuchsia-400 to-indigo-400',
      }
    : {
        name: 'You',
        emoji: '🛡️',
        accentText: 'text-amber-200',
        accentRing: 'ring-amber-300/40',
        badgeBg: 'bg-amber-400/15',
        badgeBorder: 'border-amber-300/40',
        badgeText: 'text-amber-200',
        edge: 'before:from-amber-400/70 before:via-yellow-300/40 before:to-transparent',
        glow: 'shadow-[0_0_60px_-15px_rgba(251,191,36,0.5)]',
        rail: 'from-amber-300 via-yellow-300 to-orange-300',
      }

  return (
    <motion.article
      variants={cardVariants}
      initial="hidden"
      animate="show"
      layout
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10',
        'bg-gradient-to-br from-slate-900/80 via-indigo-950/60 to-slate-950/80',
        'backdrop-blur-xl',
        'px-5 py-5 sm:px-7 sm:py-6',
        side.glow,
        // left accent rail painted via ::before
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        'before:bg-gradient-to-b',
        side.edge,
      )}
    >
      {/* faint arcane texture / vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen
                   bg-[radial-gradient(120%_80%_at_0%_0%,white_0%,transparent_55%)]"
      />

      {/* ---- header: author badge + verdict pill ---- */}
      <motion.header
        variants={childVariants}
        className="relative flex items-start justify-between gap-4"
      >
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
            'text-sm font-semibold tracking-wide ring-1 ring-inset',
            side.badgeBg,
            side.badgeBorder,
            side.badgeText,
            side.accentRing,
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {side.emoji}
          </span>
          <span style={{ fontFamily: 'var(--font-display, Cinzel, Georgia, serif)' }}>
            {side.name}
          </span>
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/60">
            Round {claim.round_no}
          </span>
        </div>

        <VerdictPill verdict={verdict} points={claim.points} />
      </motion.header>

      {/* ---- argument text ---- */}
      <motion.p
        variants={childVariants}
        className="relative mt-4 text-[15px] leading-relaxed text-slate-200/90"
      >
        {claim.argument}
      </motion.p>

      {/* ---- key claim callout ---- */}
      {claim.key_claim ? (
        <motion.div
          variants={childVariants}
          className={cn(
            'relative mt-4 rounded-xl border-l-2 px-4 py-3',
            'bg-white/[0.035] backdrop-blur-sm',
            isWizard ? 'border-violet-400/60' : 'border-amber-300/60',
          )}
        >
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <span aria-hidden>✦</span> Key Claim
          </div>
          <p className={cn('text-sm font-medium leading-snug', side.accentText)}>
            “{claim.key_claim}”
          </p>
        </motion.div>
      ) : null}

      {/* ---- rationale ---- */}
      {claim.rationale ? (
        <motion.div variants={childVariants} className="relative mt-4">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <span aria-hidden>⚖️</span> Judge&apos;s Rationale
          </div>
          <p className="text-sm leading-relaxed text-slate-300/85">{claim.rationale}</p>
        </motion.div>
      ) : null}

      {/* ---- score bars ---- */}
      {hasScores ? (
        <motion.div variants={childVariants} className="relative mt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Scorecard
          </div>
          <ScoreBars scores={claim.scores} />
        </motion.div>
      ) : null}

      {/* ---- fallacy chips ---- */}
      {claim.fallacies && claim.fallacies.length > 0 ? (
        <motion.div variants={childVariants} className="relative mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/70">
            Fallacies
          </span>
          {claim.fallacies.map((f, i) => (
            <span
              key={`${f}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10
                         px-2.5 py-1 text-xs font-medium text-rose-200"
            >
              <span aria-hidden>⚠</span>
              {f}
            </span>
          ))}
        </motion.div>
      ) : null}

      {/* ---- citations (You.com — sponsor-prominent) ---- */}
      {citations.length > 0 ? (
        <motion.section variants={childVariants} className="relative mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
              <span aria-hidden>🔎</span>
              Live Sources
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30
                         bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200"
              title="Citations retrieved live from You.com search"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" aria-hidden />
              Grounded by You.com
            </span>
          </div>

          <ul className="space-y-2.5">
            {citations.map((c, i) => {
              const relied = highlightCitationIndex === i
              return (
                <CitationRow key={c.id ?? `${c.url}-${i}`} citation={c} relied={relied} index={i} />
              )
            })}
          </ul>
        </motion.section>
      ) : null}
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */
/*  Verdict pill                                                        */
/* ------------------------------------------------------------------ */

function VerdictPill({
  verdict,
  points,
}: {
  verdict: (typeof verdictStyles)[keyof typeof verdictStyles]
  points: number | null | undefined
}) {
  const showPoints = typeof points === 'number'
  const sign = showPoints ? (points! > 0 ? '+' : '') : ''
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.12 }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-xs font-bold uppercase tracking-wider',
        verdict.text,
        verdict.bg,
        verdict.border,
        verdict.glow,
      )}
    >
      <span className="text-sm leading-none" aria-hidden>
        {verdict.emoji}
      </span>
      <span>{verdict.label}</span>
      {showPoints ? (
        <span className="ml-0.5 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] tabular-nums">
          {sign}
          {points}
        </span>
      ) : null}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Citation row                                                        */
/* ------------------------------------------------------------------ */

function CitationRow({
  citation,
  relied,
  index,
}: {
  citation: Citation
  relied: boolean
  index: number
}) {
  const domain = citation.url ? domainOf(citation.url) : ''
  return (
    <motion.li
      whileHover={{ x: 2 }}
      className={cn(
        'group/cite relative overflow-hidden rounded-xl border px-3.5 py-3 transition-colors',
        relied
          ? 'border-cyan-300/60 bg-cyan-400/[0.08] shadow-[0_0_30px_-12px_rgba(34,211,238,0.7)]'
          : 'border-white/10 bg-white/[0.025] hover:border-cyan-300/30 hover:bg-cyan-400/[0.04]',
      )}
    >
      {relied ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-100">
          Relied on
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold tabular-nums',
            relied ? 'bg-cyan-400/30 text-cyan-50' : 'bg-white/10 text-white/55',
          )}
          aria-hidden
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <a
            href={citation.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'block truncate text-sm font-semibold underline-offset-2 hover:underline',
              relied ? 'text-cyan-50' : 'text-slate-100',
            )}
            title={citation.title ?? undefined}
          >
            {citation.title || domain || citation.url}
          </a>

          {domain ? (
            <a
              href={citation.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-cyan-300/80 hover:text-cyan-200"
            >
              <span aria-hidden>↗</span>
              {domain}
            </a>
          ) : null}

          {citation.snippet ? (
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400/90">
              {citation.snippet}
            </p>
          ) : null}
        </div>
      </div>
    </motion.li>
  )
}

export default ClaimCard
