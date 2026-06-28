"use client";

// SpectatorLobby — the "scrying hall" where onlookers watch live duels unfold.
// Lists active rooms with topic, difficulty, current score, and a Watch button.
// Pure presentational component; all data + actions are passed in via props.
//
// Animation: CSS keyframes/transitions only (pulse-glow, float, shimmer from
// tailwind.config + globals). No framer-motion — looping/idle/entrance motion
// must be CSS per the project ANIMATION RULE.

import { cn } from "@/lib/ui";

export interface SpectatorRoom {
  id: string;
  topic: string;
  status: string;
  difficulty: string;
  scores: { A: number; B: number };
  created_at: string;
}

export interface SpectatorLobbyProps {
  rooms: SpectatorRoom[];
  onWatch: (roomId: string) => void;
  loading?: boolean;
  onRefresh: () => void;
}

// --- helpers --------------------------------------------------------------

function difficultyStyle(difficulty: string): {
  label: string;
  text: string;
  bg: string;
  border: string;
  pips: number;
} {
  const d = (difficulty || "").toLowerCase();
  // easy / apprentice
  if (d.startsWith("e") || d.startsWith("app") || d.startsWith("nov")) {
    return {
      label: "Apprentice",
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-400/30",
      pips: 1,
    };
  }
  // hard / archmage / expert
  if (d.startsWith("h") || d.startsWith("arch") || d.startsWith("exp")) {
    return {
      label: "Archmage",
      text: "text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-400/30",
      pips: 3,
    };
  }
  // default / medium / adept / unknown
  return {
    label: difficulty ? capitalize(difficulty) : "Adept",
    text: "text-rune-200",
    bg: "bg-rune-300/10",
    border: "border-rune-300/30",
    pips: 2,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusBadge(status: string): { label: string; live: boolean } {
  const s = (status || "").toLowerCase();
  if (s === "active") return { label: "Live", live: true };
  if (s === "finished") return { label: "Concluded", live: false };
  return { label: "Gathering", live: false };
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.max(0, Math.round(diff / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

// --- subcomponents --------------------------------------------------------

function ScoreOrb({
  value,
  tone,
  label,
}: {
  value: number;
  tone: "rune" | "arcane";
  label: string;
}) {
  const isRune = tone === "rune";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border text-base font-semibold tabular-nums transition-colors",
          isRune
            ? "border-rune-400/40 bg-rune-300/10 text-rune-200 shadow-glow-rune"
            : "border-arcane-400/40 bg-arcane/10 text-arcane-200 shadow-glow-arcane",
        )}
      >
        {value}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-widest",
          isRune ? "text-rune-300/80" : "text-arcane-300/80",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function DuelCard({
  room,
  onWatch,
}: {
  room: SpectatorRoom;
  onWatch: (id: string) => void;
}) {
  const diff = difficultyStyle(room.difficulty);
  const badge = statusBadge(room.status);
  const leader =
    room.scores.A > room.scores.B
      ? "A"
      : room.scores.B > room.scores.A
        ? "B"
        : "tie";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-arcane/20 bg-arena-850/70 p-5",
        "shadow-[0_8px_40px_-12px_rgba(109,40,217,0.35)] backdrop-blur-sm",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-arcane/45 hover:bg-arena-800/80",
      )}
    >
      {/* arcane sheen sweep on hover */}
      <div className="pointer-events-none absolute inset-0 bg-arcane-sheen opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex flex-col gap-4">
        {/* top row: status + difficulty + time */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
              badge.live
                ? "bg-arcane/15 text-arcane-200"
                : "bg-zinc-500/10 text-zinc-400",
            )}
          >
            {badge.live && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-arcane-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-arcane-300" />
              </span>
            )}
            {badge.label}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              diff.text,
              diff.bg,
              diff.border,
            )}
          >
            <span className="flex items-center gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i < diff.pips ? "bg-current" : "bg-current/25",
                  )}
                />
              ))}
            </span>
            {diff.label}
          </span>

          <span className="ml-auto text-[11px] text-arcane-200/50">
            {relativeTime(room.created_at)}
          </span>
        </div>

        {/* topic */}
        <h3 className="font-display text-lg leading-snug text-arcane-50">
          {room.topic || "An untitled duel of wits"}
        </h3>

        {/* score + watch */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <ScoreOrb value={room.scores.A} tone="rune" label="Human" />
            <span className="pb-4 text-sm font-medium text-arcane-200/40">
              vs
            </span>
            <ScoreOrb value={room.scores.B} tone="arcane" label="Wizard" />
          </div>

          <button
            type="button"
            onClick={() => onWatch(room.id)}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-xl border border-arcane-400/40 bg-arcane/15 px-4 py-2.5",
              "text-sm font-semibold text-arcane-100 transition-all duration-200",
              "hover:border-arcane-300/70 hover:bg-arcane/25 hover:shadow-glow-arcane",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-300/60",
              "active:scale-[0.97]",
            )}
          >
            <span aria-hidden>🔮</span>
            Watch
          </button>
        </div>

        {/* leader hint bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-arena-700/60">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              leader === "A"
                ? "bg-rune-400/80"
                : leader === "B"
                  ? "bg-arcane-400/80"
                  : "bg-gradient-to-r from-rune-400/60 to-arcane-400/60",
            )}
            style={{
              width: scoreBarWidth(room.scores.A, room.scores.B, leader),
            }}
          />
        </div>
      </div>
    </div>
  );
}

function scoreBarWidth(
  a: number,
  b: number,
  leader: "A" | "B" | "tie",
): string {
  const total = Math.abs(a) + Math.abs(b);
  if (total === 0) return "50%";
  if (leader === "tie") return "50%";
  const lead = leader === "A" ? a : b;
  const pct = Math.min(100, Math.max(8, Math.round((lead / total) * 100)));
  return `${pct}%`;
}

// --- states ---------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="overflow-hidden rounded-2xl border border-arcane/15 bg-arena-850/50 p-5"
        >
          <div className="relative space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-arcane/10" />
              <div className="h-6 w-24 rounded-full bg-arcane/10" />
            </div>
            <div className="h-5 w-3/4 rounded bg-arcane/10" />
            <div className="h-5 w-1/2 rounded bg-arcane/10" />
            <div className="flex justify-between">
              <div className="h-11 w-32 rounded bg-arcane/10" />
              <div className="h-10 w-24 rounded-xl bg-arcane/10" />
            </div>
            {/* shimmer sweep */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-arcane/10 to-transparent bg-[length:200%_100%] animate-shimmer"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-arcane/25 bg-arena-850/40 px-6 py-16 text-center">
      <div className="animate-float text-5xl" aria-hidden>
        🪞
      </div>
      <div className="space-y-1.5">
        <h3 className="font-display text-xl text-arcane-100">
          The scrying glass is dark
        </h3>
        <p className="max-w-sm text-sm text-arcane-200/60">
          No duels are underway right now. Summon a wizard yourself, or peer
          again in a moment.
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-arcane-400/40 bg-arcane/10 px-4 py-2.5",
          "text-sm font-semibold text-arcane-100 transition-all duration-200",
          "hover:border-arcane-300/70 hover:bg-arcane/20 hover:shadow-glow-arcane",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-300/60",
          "active:scale-[0.97]",
        )}
      >
        <span aria-hidden>↻</span>
        Gaze again
      </button>
    </div>
  );
}

// --- main -----------------------------------------------------------------

export function SpectatorLobby({
  rooms,
  onWatch,
  loading = false,
  onRefresh,
}: SpectatorLobbyProps) {
  const liveCount = rooms.filter(
    (r) => (r.status || "").toLowerCase() === "active",
  ).length;

  return (
    <section className="relative w-full">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl border border-arcane/30 bg-arcane/10 text-xl shadow-glow-arcane"
            aria-hidden
          >
            🔭
          </span>
          <div>
            <h2 className="font-display text-2xl leading-none text-arcane-50">
              Scrying Hall
            </h2>
            <p className="mt-1 text-sm text-arcane-200/55">
              {loading
                ? "Peering through the glass…"
                : liveCount > 0
                  ? `${liveCount} live duel${liveCount === 1 ? "" : "s"} unfolding`
                  : "Watch challengers face the wizard"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-arcane/30 bg-arena-800/60 px-3.5 py-2",
            "text-sm font-medium text-arcane-100/90 transition-all duration-200",
            "hover:border-arcane/55 hover:bg-arena-700/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-300/60",
            "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]",
          )}
        >
          <span
            className={cn("text-base", loading && "animate-spin")}
            aria-hidden
          >
            ↻
          </span>
          Refresh
        </button>
      </div>

      {/* body */}
      {loading && rooms.length === 0 ? (
        <LoadingSkeleton />
      ) : rooms.length === 0 ? (
        <EmptyState onRefresh={onRefresh} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <DuelCard room={room} onWatch={onWatch} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SpectatorLobby;
