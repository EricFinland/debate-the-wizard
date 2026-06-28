"use client";

// WizardAvatar — intentionally simple + cheap to render.
// The previous version was a large multi-layer animated SVG (the "3D" wizard),
// a big source of render jank. This is a flat badge with one optional pulse when
// thinking. Same props/contract so nothing else changes.

export type WizardState = "idle" | "thinking" | "speaking" | "caught";

export interface WizardAvatarProps {
  state: WizardState;
  size?: number;
}

const STATE_STYLE: Record<WizardState, { ring: string; label: string; emoji: string }> = {
  idle: { ring: "border-violet-400/40", label: "The Wizard awaits", emoji: "🧙" },
  thinking: { ring: "border-cyan-400/60 animate-pulse", label: "Conjuring a rebuttal…", emoji: "🧙" },
  speaking: { ring: "border-violet-300/80", label: "The Wizard speaks", emoji: "🧙" },
  caught: { ring: "border-rose-400/80", label: "Caught!", emoji: "😵‍💫" },
};

export function WizardAvatar({ state, size = 96 }: WizardAvatarProps) {
  const s = STATE_STYLE[state];
  return (
    <div className="flex select-none flex-col items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-full border-2 bg-violet-950/50 ${s.ring}`}
        style={{ width: size, height: size, fontSize: size * 0.5, lineHeight: 1 }}
        aria-label={`Wizard, ${state}`}
      >
        <span>{s.emoji}</span>
      </div>
      <span className="text-xs font-medium text-violet-200/70">{s.label}</span>
    </div>
  );
}

export default WizardAvatar;
