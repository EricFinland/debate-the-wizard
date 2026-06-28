'use client'

/**
 * WizardAvatar — the arcane opponent of the duel.
 *
 * Purely presentational. Renders a self-contained SVG wizard (pointed hat,
 * staff, glowing orb, hidden face with two ember eyes) and reacts to the
 * `state` prop:
 *
 *  - idle     : gentle vertical float, slow breathing orb
 *  - thinking : the orb pulses brightly, runes orbit, the wizard tilts in thought
 *  - speaking : the staff flares, the mouth-glow flickers as if casting words
 *  - caught   : a red recoil shake — the wizard has been fact-checked and lost
 *
 * MOTION: all of it is pure CSS keyframes (scoped <style> below), per the
 * project ANIMATION RULE — looping/idle/decorative motion must NEVER use
 * framer-motion on this setup (WAAPI crash). The `state` prop selects a root
 * class (`wa--idle|thinking|speaking|caught`) and every child animates via CSS.
 * `caught` is a one-shot keyframe (forwards) so it settles after the recoil.
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
  /** Ember eye fill */
  eye: string
}

const THEMES: Record<WizardState, StateTheme> = {
  idle: {
    orb: '#a78bfa',
    glow: 'rgba(167,139,250,0.55)',
    robe: '#3b2a6b',
    robeShade: '#241646',
    eye: '#fef08a',
  },
  thinking: {
    orb: '#c4b5fd',
    glow: 'rgba(196,181,253,0.8)',
    robe: '#43308a',
    robeShade: '#281a55',
    eye: '#fef08a',
  },
  speaking: {
    orb: '#fcd34d',
    glow: 'rgba(252,211,77,0.75)',
    robe: '#4a3590',
    robeShade: '#2b1c5e',
    eye: '#fef08a',
  },
  caught: {
    orb: '#fb7185',
    glow: 'rgba(251,113,133,0.85)',
    robe: '#5b2440',
    robeShade: '#3a142a',
    eye: '#fca5a5',
  },
}

export function WizardAvatar({ state, size = 220 }: WizardAvatarProps) {
  const theme = THEMES[state]
  const showRunes = state === 'thinking'

  return (
    <div
      role="img"
      aria-label={`Wizard, ${state}`}
      style={{ width: size, height: size }}
      className={`wa-root wa--${state} relative select-none`}
    >
      <style>{WA_STYLES}</style>

      <svg
        viewBox="0 0 200 220"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className="wa-body overflow-visible"
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
        <ellipse
          className="wa-shadow"
          cx="100"
          cy="208"
          rx="46"
          ry="8"
          fill="rgba(0,0,0,0.35)"
          style={{ transformOrigin: '100px 208px' }}
        />

        {/* ====================== STAFF ====================== */}
        <g>
          {/* staff pole */}
          <rect x="150" y="70" width="6" height="120" rx="3" fill="#7c5a2e" />
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
          <circle
            className="wa-staff-glow"
            cx="153"
            cy="62"
            r="20"
            fill={theme.glow}
            filter="url(#wa-blur)"
            style={{ transformOrigin: '153px 62px' }}
          />
          {/* staff orb */}
          <circle
            className="wa-staff-orb"
            cx="153"
            cy="62"
            r="9"
            fill="url(#wa-staff-orb)"
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
          <circle
            className="wa-eye"
            cx="92"
            cy="84"
            r="3.4"
            fill={theme.eye}
            style={{ transformOrigin: '92px 84px' }}
          />
          <circle
            className="wa-eye"
            cx="108"
            cy="84"
            r="3.4"
            fill={theme.eye}
            style={{ transformOrigin: '108px 84px' }}
          />
          {/* speaking mouth-glow */}
          <ellipse
            className="wa-mouth"
            cx="100"
            cy="95"
            rx="6"
            ry="3"
            fill={theme.orb}
            filter="url(#wa-blur-sm)"
            style={{ transformOrigin: '100px 95px' }}
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
          <path
            className="wa-star"
            d="M100 34 l2.6 6 6.4 .6 -4.8 4.4 1.4 6.4 -5.6 -3.4 -5.6 3.4 1.4 -6.4 -4.8 -4.4 6.4 -.6 Z"
            fill={theme.orb}
            style={{ transformOrigin: '100px 41px' }}
          />
        </g>

        {/* ====================== ORBITING RUNES (thinking only) ====================== */}
        {showRunes && (
          <g
            className="wa-runes"
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
                <text
                  key={i}
                  className="wa-rune"
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fontSize="13"
                  fill={theme.orb}
                  style={{ animationDelay: `${i * 0.25}s` }}
                >
                  {glyphs[i]}
                </text>
              )
            })}
          </g>
        )}
      </svg>

      {/* ---- Ambient aura behind the avatar (HTML layer for soft bloom) ---- */}
      <div
        aria-hidden
        className="wa-aura pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${theme.glow}, transparent 65%)`,
        }}
      />
    </div>
  )
}

export default WizardAvatar

/* ------------------------------------------------------------------ *
 * Scoped CSS keyframes. Kept local (like WizardTaunt) so this honors
 * strict file ownership while obeying the ANIMATION RULE: every loop is
 * pure CSS, never framer-motion. Class names are namespaced `wa-`.
 * ------------------------------------------------------------------ */
const WA_STYLES = `
/* ---- body float / tilt ---- */
@keyframes wa-float-idle {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
@keyframes wa-float-think {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-3px) rotate(2deg); }
}
@keyframes wa-float-speak {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
@keyframes wa-caught-shake {
  0%   { transform: translate(0, 0) rotate(0deg); }
  20%  { transform: translate(-10px, 4px) rotate(-5deg); }
  40%  { transform: translate(9px, 2px) rotate(4deg); }
  60%  { transform: translate(-7px, 3px) rotate(-3deg); }
  80%  { transform: translate(5px, 1px) rotate(2deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

/* ---- orb / glow / aura breathing ---- */
@keyframes wa-aura-idle {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50%      { opacity: 0.7;  transform: scale(1.08); }
}
@keyframes wa-aura-think {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.35); }
}
@keyframes wa-aura-speak {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.2); }
}
@keyframes wa-aura-caught {
  0%   { opacity: 1;   transform: scale(1.3); }
  100% { opacity: 0.8; transform: scale(1.15); }
}

/* ---- shadow ---- */
@keyframes wa-shadow-idle {
  0%, 100% { opacity: 0.35; transform: scaleX(1); }
  50%      { opacity: 0.22; transform: scaleX(0.92); }
}

/* ---- staff orb / staff glow ---- */
@keyframes wa-staff-orb-idle {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}
@keyframes wa-staff-orb-speak {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.25); }
}
@keyframes wa-staff-glow-speak {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.4); }
}

/* ---- hat star ---- */
@keyframes wa-star {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.1); }
}

/* ---- eyes ---- */
@keyframes wa-eye-think {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
@keyframes wa-eye-caught {
  0%   { transform: scaleY(1); }
  25%  { transform: scaleY(0.2); }
  50%  { transform: scaleY(1); }
  75%  { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
}

/* ---- mouth glow (speaking) ---- */
@keyframes wa-mouth-speak {
  0%, 100% { opacity: 0.2; transform: scaleY(0.66); }
  50%      { opacity: 0.9; transform: scaleY(1.33); }
}

/* ---- orbiting runes ---- */
@keyframes wa-runes-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes wa-rune-twinkle {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.9; }
}

/* =================== state wiring =================== */

/* Body float (whole SVG). */
.wa--idle .wa-body     { animation: wa-float-idle 4s ease-in-out infinite; }
.wa--thinking .wa-body { animation: wa-float-think 5s ease-in-out infinite; }
.wa--speaking .wa-body { animation: wa-float-speak 1.6s ease-in-out infinite; }
.wa--caught .wa-body   { animation: wa-caught-shake 0.6s ease-out 1 both; }

/* Aura. */
.wa-aura { opacity: 0.55; }
.wa--idle .wa-aura     { animation: wa-aura-idle 4s ease-in-out infinite; }
.wa--thinking .wa-aura { animation: wa-aura-think 1.4s ease-in-out infinite; }
.wa--speaking .wa-aura { animation: wa-aura-speak 0.9s ease-in-out infinite; }
.wa--caught .wa-aura   { animation: wa-aura-caught 0.6s ease-out 1 both; }

/* Floating shadow (idle bob only). */
.wa--idle .wa-shadow { animation: wa-shadow-idle 4s ease-in-out infinite; }

/* Staff orb. (transform-origin comes from the inline SVG-space coords) */
.wa--idle .wa-staff-orb,
.wa--thinking .wa-staff-orb { animation: wa-staff-orb-idle 3s ease-in-out infinite; }
.wa--speaking .wa-staff-orb { animation: wa-staff-orb-speak 0.7s ease-in-out infinite; }

/* Staff head glow (flares when speaking). */
.wa-staff-glow { opacity: 0.35; }
.wa--thinking .wa-staff-glow { opacity: 0.5; }
.wa--speaking .wa-staff-glow { animation: wa-staff-glow-speak 0.7s ease-in-out infinite; }
.wa--caught .wa-staff-glow { opacity: 0.25; }

/* Hat star. */
.wa--idle .wa-star,
.wa--thinking .wa-star,
.wa--speaking .wa-star { animation: wa-star 3s ease-in-out infinite; }
.wa--caught .wa-star { opacity: 0.4; }

/* Eyes. */
.wa-eye { opacity: 0.9; }
.wa--speaking .wa-eye { opacity: 1; }
.wa--thinking .wa-eye { animation: wa-eye-think 1.4s ease-in-out infinite; }
.wa--caught .wa-eye { animation: wa-eye-caught 0.6s ease-out 1 both; }

/* Mouth glow — only visible while speaking. */
.wa-mouth { opacity: 0; }
.wa--speaking .wa-mouth { animation: wa-mouth-speak 0.55s ease-in-out infinite; }

/* Orbiting runes (thinking only). */
.wa-runes { animation: wa-runes-spin 9s linear infinite; }
.wa-rune { animation: wa-rune-twinkle 1.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .wa-body, .wa-aura, .wa-shadow, .wa-staff-orb, .wa-staff-glow,
  .wa-star, .wa-eye, .wa-mouth, .wa-runes, .wa-rune {
    animation: none !important;
  }
}
`
