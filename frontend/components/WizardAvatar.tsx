'use client'

import { motion, type Variants, type Transition } from 'framer-motion'

/**
 * WizardAvatar — the arcane opponent of the duel.
 *
 * Purely presentational. Renders a self-contained SVG wizard (pointed hat,
 * staff, glowing orb, hidden face with two ember eyes) and reacts to the
 * `state` prop with framer-motion choreography:
 *
 *  - idle     : gentle vertical float, slow breathing orb
 *  - thinking : the orb pulses brightly, runes orbit, the wizard tilts in thought
 *  - speaking : the staff flares, the mouth-glow flickers as if casting words
 *  - caught   : a red recoil shake — the wizard has been fact-checked and lost
 */

export type WizardState = 'idle' | 'thinking' | 'speaking' | 'caught'

export interface WizardAvatarProps {
  state: WizardState
  /** Rendered square size in px. Default 220. */
  size?: number
}

/* ------------------------------------------------------------------ *
 * Per-state color + glow language
 * ------------------------------------------------------------------ */

interface StateTheme {
  /** Core orb / accent color */
  orb: string
  /** Outer glow color */
  glow: string
  /** Robe primary */
  robe: string
  /** Robe shadow */
  robeShade: string
}

const THEMES: Record<WizardState, StateTheme> = {
  idle: {
    orb: '#a78bfa',
    glow: 'rgba(167,139,250,0.55)',
    robe: '#3b2a6b',
    robeShade: '#241646',
  },
  thinking: {
    orb: '#c4b5fd',
    glow: 'rgba(196,181,253,0.8)',
    robe: '#43308a',
    robeShade: '#281a55',
  },
  speaking: {
    orb: '#fcd34d',
    glow: 'rgba(252,211,77,0.75)',
    robe: '#4a3590',
    robeShade: '#2b1c5e',
  },
  caught: {
    orb: '#fb7185',
    glow: 'rgba(251,113,133,0.85)',
    robe: '#5b2440',
    robeShade: '#3a142a',
  },
}

/* ------------------------------------------------------------------ *
 * Motion variants for the whole avatar group
 * ------------------------------------------------------------------ */

const bodyVariants: Variants = {
  idle: {
    y: [0, -6, 0],
    rotate: 0,
    x: 0,
    transition: {
      y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  thinking: {
    y: [0, -3, 0],
    rotate: [-2, 2, -2],
    x: 0,
    transition: {
      y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  speaking: {
    y: [0, -4, 0],
    rotate: 0,
    x: 0,
    transition: {
      y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  caught: {
    x: [0, -10, 9, -7, 5, -3, 0],
    rotate: [0, -5, 4, -3, 2, 0],
    y: [0, 4, 2, 3, 1, 0],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const orbVariants: Variants = {
  idle: {
    scale: [1, 1.06, 1],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  thinking: {
    scale: [1, 1.28, 0.95, 1.28, 1],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
  speaking: {
    scale: [1, 1.12, 1],
    transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
  },
  caught: {
    scale: [1, 0.7, 1.1, 0.9, 1],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const glowVariants: Variants = {
  idle: {
    opacity: [0.45, 0.7, 0.45],
    scale: [1, 1.08, 1],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  thinking: {
    opacity: [0.6, 1, 0.6],
    scale: [1, 1.35, 1],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
  speaking: {
    opacity: [0.7, 1, 0.7],
    scale: [1, 1.2, 1],
    transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
  },
  caught: {
    opacity: [1, 0.4, 0.9, 0.5, 0.8],
    scale: [1.3, 1, 1.2, 1, 1.15],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

/** Staff head glow — flares when speaking. */
const staffGlowVariants: Variants = {
  idle: { opacity: 0.35, scale: 1 },
  thinking: { opacity: 0.5, scale: 1.05 },
  speaking: {
    opacity: [0.5, 1, 0.5],
    scale: [1, 1.4, 1],
    transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' },
  },
  caught: { opacity: 0.25, scale: 0.9 },
}

/** Ember eyes — narrow + flicker on caught. */
const eyeVariants: Variants = {
  idle: { scaleY: 1, opacity: 0.9 },
  thinking: {
    opacity: [0.7, 1, 0.7],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
  speaking: { scaleY: 1, opacity: 1 },
  caught: {
    scaleY: [1, 0.2, 1, 0.4, 1],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const runeTransition: Transition = {
  duration: 9,
  repeat: Infinity,
  ease: 'linear',
}

export function WizardAvatar({ state, size = 220 }: WizardAvatarProps) {
  const theme = THEMES[state]
  const showRunes = state === 'thinking'

  return (
    <motion.div
      role="img"
      aria-label={`Wizard, ${state}`}
      style={{ width: size, height: size }}
      className="relative select-none"
      initial={false}
    >
      <motion.svg
        viewBox="0 0 200 220"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        variants={bodyVariants}
        animate={state}
      >
        <defs>
          {/* Robe gradient */}
          <linearGradient id="wa-robe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.robe} />
            <stop offset="100%" stopColor={theme.robeShade} />
          </linearGradient>

          {/* Hat gradient */}
          <linearGradient id="wa-hat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5b3fae" />
            <stop offset="100%" stopColor="#2a1a52" />
          </linearGradient>

          {/* Orb radial */}
          <radialGradient id="wa-orb" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor={theme.orb} />
            <stop offset="100%" stopColor={theme.robeShade} />
          </radialGradient>

          {/* Staff orb radial */}
          <radialGradient id="wa-staff-orb" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff7e0" />
            <stop offset="45%" stopColor={theme.orb} />
            <stop offset="100%" stopColor={theme.robeShade} />
          </radialGradient>

          {/* Soft blur for glows */}
          <filter id="wa-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="wa-blur-sm" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ---- Ground / floating shadow ---- */}
        <motion.ellipse
          cx="100"
          cy="208"
          rx="46"
          ry="8"
          fill="rgba(0,0,0,0.35)"
          variants={{
            idle: { opacity: [0.35, 0.22, 0.35], scaleX: [1, 0.92, 1] },
            thinking: { opacity: 0.3, scaleX: 1 },
            speaking: { opacity: [0.35, 0.25, 0.35], scaleX: [1, 0.95, 1] },
            caught: { opacity: 0.25, scaleX: 1.05 },
          }}
          animate={state}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '100px 208px' }}
        />

        {/* ====================== STAFF ====================== */}
        <g>
          {/* staff pole */}
          <rect
            x="150"
            y="70"
            width="6"
            height="120"
            rx="3"
            fill="#7c5a2e"
          />
          <rect
            x="150"
            y="70"
            width="3"
            height="120"
            rx="1.5"
            fill="#a87a3c"
            opacity="0.8"
          />
          {/* staff head ring */}
          <circle
            cx="153"
            cy="62"
            r="16"
            fill="none"
            stroke="#caa45a"
            strokeWidth="3"
          />
          {/* staff orb glow */}
          <motion.circle
            cx="153"
            cy="62"
            r="20"
            fill={theme.glow}
            filter="url(#wa-blur)"
            variants={staffGlowVariants}
            animate={state}
            style={{ transformOrigin: '153px 62px' }}
          />
          {/* staff orb */}
          <motion.circle
            cx="153"
            cy="62"
            r="9"
            fill="url(#wa-staff-orb)"
            variants={{
              idle: { scale: [1, 1.05, 1] },
              thinking: { scale: [1, 1.1, 1] },
              speaking: { scale: [1, 1.25, 1] },
              caught: { scale: [1, 0.85, 1] },
            }}
            animate={state}
            transition={{
              duration: state === 'speaking' ? 0.7 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '153px 62px' }}
          />
        </g>

        {/* ====================== BODY / ROBE ====================== */}
        <g>
          {/* robe */}
          <path
            d="M100 96
               C 78 96, 64 116, 58 152
               C 52 184, 50 196, 46 200
               L 154 200
               C 150 196, 148 184, 142 152
               C 136 116, 122 96, 100 96 Z"
            fill="url(#wa-robe)"
          />
          {/* robe center fold */}
          <path
            d="M100 100 L100 200"
            stroke={theme.robeShade}
            strokeWidth="2.5"
            opacity="0.6"
          />
          {/* robe rune trim */}
          <path
            d="M62 196 L138 196"
            stroke={theme.orb}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* collar */}
          <path
            d="M84 100 Q100 112 116 100 L110 122 Q100 128 90 122 Z"
            fill={theme.robeShade}
          />

          {/* sleeve / arm holding staff */}
          <path
            d="M128 122
               C 142 120, 150 110, 154 96
               L 150 90
               C 144 104, 136 110, 124 112 Z"
            fill="url(#wa-robe)"
          />
        </g>

        {/* ====================== FACE (shadowed under hat) ====================== */}
        <g>
          {/* face shadow */}
          <ellipse cx="100" cy="84" rx="20" ry="18" fill="#1a1030" />
          {/* ember eyes */}
          <motion.circle
            cx="92"
            cy="84"
            r="3.4"
            fill={state === 'caught' ? '#fca5a5' : '#fef08a'}
            variants={eyeVariants}
            animate={state}
            style={{ transformOrigin: '92px 84px' }}
          />
          <motion.circle
            cx="108"
            cy="84"
            r="3.4"
            fill={state === 'caught' ? '#fca5a5' : '#fef08a'}
            variants={eyeVariants}
            animate={state}
            style={{ transformOrigin: '108px 84px' }}
          />
          {/* speaking mouth-glow */}
          <motion.ellipse
            cx="100"
            cy="95"
            rx="6"
            ry="3"
            fill={theme.orb}
            filter="url(#wa-blur-sm)"
            variants={{
              idle: { opacity: 0 },
              thinking: { opacity: 0 },
              speaking: {
                opacity: [0.2, 0.9, 0.2],
                ry: [2, 4, 2],
                transition: {
                  duration: 0.55,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              },
              caught: { opacity: 0 },
            }}
            animate={state}
          />
          {/* beard */}
          <path
            d="M84 92 Q100 140 116 92 Q108 104 100 104 Q92 104 84 92 Z"
            fill="#e8e6f5"
          />
          <path
            d="M88 96 Q100 128 112 96"
            stroke="#c8c5e0"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
        </g>

        {/* ====================== HAT ====================== */}
        <g>
          {/* hat cone */}
          <path
            d="M100 8
               C 96 8, 94 12, 92 20
               L 70 70
               C 84 64, 116 64, 130 70
               L 108 20
               C 106 12, 104 8, 100 8 Z"
            fill="url(#wa-hat)"
          />
          {/* hat brim */}
          <path
            d="M64 70
               Q 100 56 136 70
               Q 100 84 64 70 Z"
            fill="url(#wa-hat)"
          />
          <path
            d="M64 70 Q100 60 136 70"
            stroke={theme.orb}
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />
          {/* hat star accent */}
          <motion.path
            d="M100 34 l2.6 6 6.4 .6 -4.8 4.4 1.4 6.4 -5.6 -3.4 -5.6 3.4 1.4 -6.4 -4.8 -4.4 6.4 -.6 Z"
            fill={theme.orb}
            variants={{
              idle: { opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] },
              thinking: { opacity: [0.7, 1, 0.7], scale: [1, 1.12, 1] },
              speaking: { opacity: [0.7, 1, 0.7], scale: [1, 1.1, 1] },
              caught: { opacity: 0.4, scale: 0.9 },
            }}
            animate={state}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '100px 41px' }}
          />
        </g>

        {/* ====================== ORBITING RUNES (thinking only) ====================== */}
        {showRunes && (
          <motion.g
            animate={{ rotate: 360 }}
            transition={runeTransition}
            style={{ transformOrigin: '100px 110px' }}
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const angle = (i / 5) * Math.PI * 2
              const rx = 78
              const ry = 70
              const cx = 100 + Math.cos(angle) * rx
              const cy = 110 + Math.sin(angle) * ry
              const glyphs = ['✦', '✧', '⟡', '✶', '◇']
              return (
                <motion.text
                  key={i}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fontSize="13"
                  fill={theme.orb}
                  opacity={0.85}
                  animate={{ opacity: [0.3, 0.9, 0.3] }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    delay: i * 0.25,
                    ease: 'easeInOut',
                  }}
                >
                  {glyphs[i]}
                </motion.text>
              )
            })}
          </motion.g>
        )}
      </motion.svg>

      {/* ---- Ambient aura behind the avatar (HTML layer for soft bloom) ---- */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle at 50% 45%, ${theme.glow}, transparent 65%)` }}
        variants={glowVariants}
        animate={state}
      />
    </motion.div>
  )
}

export default WizardAvatar
