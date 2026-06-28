"use client";

import { cn } from "@/lib/ui";

export type Difficulty = "novice" | "adept" | "archmage";

export interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}

interface DifficultyOption {
  id: Difficulty;
  title: string;
  subtitle: string;
  flavor: string;
  sigil: string;
  /** number of filled "power" pips */
  power: number;
}

const OPTIONS: DifficultyOption[] = [
  {
    id: "novice",
    title: "Novice",
    subtitle: "Apprentice",
    flavor:
      "A green-robed apprentice. Concedes quickly and rarely twists the facts. A gentle first duel.",
    sigil: "✦",
    power: 1,
  },
  {
    id: "adept",
    title: "Adept",
    subtitle: "Sorcerer",
    flavor:
      "A seasoned sorcerer. Pushes back with real counters and the occasional sleight of logic. A fair fight.",
    sigil: "✧",
    power: 2,
  },
  {
    id: "archmage",
    title: "Archmage",
    subtitle: "Archmage",
    flavor:
      "The tower's master. Relentless, rhetorically vicious, and unafraid to mislead. Bring receipts.",
    sigil: "✶",
    power: 3,
  },
];

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose wizard difficulty"
      className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map((opt, i) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            style={{ animationDelay: `${i * 80}ms` }}
            className={cn(
              "group relative flex flex-col items-start overflow-hidden rounded-2xl p-4 text-left",
              "border backdrop-blur-md transition-all duration-300 ease-out",
              "animate-[float_5s_ease-in-out_infinite] motion-reduce:animate-none",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-arcane/70 focus-visible:ring-offset-2 focus-visible:ring-offset-arena-950",
              selected
                ? "border-arcane/60 bg-arcane-sheen shadow-glow-arcane scale-[1.015]"
                : "border-white/10 bg-white/[0.035] hover:border-arcane/40 hover:bg-arcane/[0.06] hover:-translate-y-0.5 hover:shadow-glow-arcane/50"
            )}
          >
            {/* Selected sheen / animated halo */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500",
                selected ? "opacity-100" : "opacity-0"
              )}
            >
              <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-arcane/30 blur-2xl animate-pulse-glow" />
              <span className="absolute -bottom-10 -left-6 h-20 w-20 rounded-full bg-rune/15 blur-2xl" />
            </span>

            {/* Header row: sigil + selected check */}
            <div className="flex w-full items-center justify-between">
              <span
                aria-hidden
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors duration-300",
                  selected
                    ? "bg-arcane/20 text-arcane-200 text-glow-arcane"
                    : "bg-white/5 text-arcane-300/70 group-hover:text-arcane-200"
                )}
              >
                {opt.sigil}
              </span>

              {/* Power pips */}
              <span className="flex items-center gap-1" aria-hidden>
                {[0, 1, 2].map((p) => (
                  <span
                    key={p}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all duration-300",
                      p < opt.power
                        ? selected
                          ? "bg-arcane-300 shadow-glow-arcane"
                          : "bg-arcane-400/60 group-hover:bg-arcane-300"
                        : "bg-white/10"
                    )}
                  />
                ))}
              </span>
            </div>

            {/* Titles */}
            <div className="mt-3">
              <h3
                className={cn(
                  "font-display text-lg leading-tight transition-colors duration-300",
                  selected ? "text-arcane-100 text-glow-arcane" : "text-zinc-100"
                )}
              >
                {opt.title}
              </h3>
              <p
                className={cn(
                  "text-[0.7rem] font-medium uppercase tracking-[0.18em] transition-colors duration-300",
                  selected ? "text-arcane-300" : "text-zinc-400"
                )}
              >
                {opt.subtitle}
              </p>
            </div>

            {/* Flavor */}
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {opt.flavor}
            </p>

            {/* Selected label pinned at bottom */}
            <span
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider transition-all duration-300",
                selected
                  ? "text-arcane-200 opacity-100"
                  : "text-transparent opacity-0"
              )}
              aria-hidden={!selected}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-arcane-300 animate-pulse-glow" />
              Chosen foe
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default DifficultyPicker;
