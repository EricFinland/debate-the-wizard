"use client";

// AuthBar — top-right account chip for Debate the Wizard.
// Logged out: "Sign in" with Google + GitHub buttons.
// Logged in: avatar/name + W-L record + total score + sign-out.
// Follows the ANIMATION RULE: CSS transitions/keyframes only (no framer here).

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";

export interface AuthBarUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface AuthBarProfile {
  wins: number;
  losses: number;
  total_score: number;
}

export interface AuthBarProps {
  user: AuthBarUser | null;
  onSignIn: (provider: "google" | "github") => void;
  onSignOut: () => void;
  profile?: AuthBarProfile | null;
}

/** Best-effort display name for the chip. */
function displayName(user: AuthBarUser): string {
  if (user.name && user.name.trim()) return user.name.trim();
  const local = user.email?.split("@")[0] ?? "";
  return local || "Adventurer";
}

/** Two-letter initials for the avatar fallback. */
function initials(user: AuthBarUser): string {
  const n = displayName(user);
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M12 1.5A10.5 10.5 0 0 0 8.68 22.0c.52.1.71-.23.71-.5v-1.77c-2.9.63-3.52-1.4-3.52-1.4-.47-1.2-1.16-1.52-1.16-1.52-.95-.65.07-.64.07-.64 1.05.07 1.6 1.08 1.6 1.08.93 1.6 2.45 1.14 3.05.87.1-.68.36-1.14.66-1.4-2.32-.27-4.76-1.16-4.76-5.16 0-1.14.41-2.07 1.07-2.8-.11-.27-.46-1.33.1-2.78 0 0 .87-.28 2.85 1.07a9.9 9.9 0 0 1 5.18 0c1.98-1.35 2.85-1.07 2.85-1.07.56 1.45.21 2.51.1 2.78.67.73 1.07 1.66 1.07 2.8 0 4.01-2.45 4.89-4.78 5.15.38.32.71.95.71 1.92v2.85c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

export function AuthBar({ user, onSignIn, onSignOut, profile }: AuthBarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset the menu whenever the auth state flips.
  useEffect(() => {
    setOpen(false);
  }, [user?.id]);

  // ---- Logged out ---------------------------------------------------------
  if (!user) {
    return (
      <div ref={wrapRef} className="relative z-30 inline-flex">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border border-rune/40",
            "bg-rune/10 px-4 py-2 text-sm font-semibold text-rune",
            "shadow-glow-arcane/0 transition-all duration-200",
            "hover:border-rune/70 hover:bg-rune/20 hover:shadow-glow-rune",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-rune/60",
          )}
        >
          <span className="text-base leading-none">🪄</span>
          <span>Sign in</span>
        </button>

        {open && (
          <div
            role="menu"
            className={cn(
              "absolute right-0 top-[calc(100%+0.5rem)] w-60 origin-top-right",
              "rounded-2xl border border-arcane/30 bg-arena-900/95 p-2 backdrop-blur-xl",
              "shadow-2xl shadow-black/60 ring-1 ring-white/5",
              "animate-scale-in",
            )}
          >
            <p className="px-3 pb-2 pt-1 text-[0.7rem] uppercase tracking-widest text-zinc-400">
              Enter the duel
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignIn("google");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-100",
                "transition-colors duration-150 hover:bg-white/10",
                "focus:outline-none focus-visible:bg-white/10",
              )}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white">
                <GoogleGlyph />
              </span>
              Continue with Google
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignIn("github");
              }}
              className={cn(
                "mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-100",
                "transition-colors duration-150 hover:bg-white/10",
                "focus:outline-none focus-visible:bg-white/10",
              )}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-800 text-white">
                <GithubGlyph />
              </span>
              Continue with GitHub
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Logged in ----------------------------------------------------------
  const name = displayName(user);
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const score = profile?.total_score ?? 0;

  return (
    <div ref={wrapRef} className="relative z-30 inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "group inline-flex items-center gap-2.5 rounded-full border border-arcane/40",
          "bg-arena-800/70 py-1.5 pl-1.5 pr-3 text-left backdrop-blur-md",
          "transition-all duration-200",
          "hover:border-arcane/70 hover:bg-arena-800 hover:shadow-glow-arcane",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-arcane/60",
        )}
      >
        {/* Avatar */}
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-rune/50"
          />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-arcane to-rune text-xs font-bold text-arena-900 ring-2 ring-rune/40">
            {initials(user)}
          </span>
        )}

        <span className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-[8.5rem] truncate text-sm font-semibold text-zinc-100">
            {name}
          </span>
          <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-zinc-400">
            <span className="text-verdict-supported">{wins}W</span>
            <span className="text-zinc-600">·</span>
            <span className="text-verdict-misleading">{losses}L</span>
            <span className="text-zinc-600">·</span>
            <span className="text-rune">{score} pts</span>
          </span>
        </span>

        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] w-64 origin-top-right",
            "rounded-2xl border border-arcane/30 bg-arena-900/95 p-3 backdrop-blur-xl",
            "shadow-2xl shadow-black/60 ring-1 ring-white/5",
            "animate-scale-in",
          )}
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 px-1 pb-3">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-rune/50"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-arcane to-rune text-sm font-bold text-arena-900 ring-2 ring-rune/40">
                {initials(user)}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-zinc-100">
                {name}
              </span>
              <span className="truncate text-xs text-zinc-500">{user.email}</span>
            </span>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-2 py-2 text-center">
              <div className="text-lg font-bold leading-none text-verdict-supported">
                {wins}
              </div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-wider text-zinc-400">
                Wins
              </div>
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-2 py-2 text-center">
              <div className="text-lg font-bold leading-none text-verdict-misleading">
                {losses}
              </div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-wider text-zinc-400">
                Losses
              </div>
            </div>
            <div className="rounded-xl border border-rune/25 bg-rune/10 px-2 py-2 text-center">
              <div className="text-lg font-bold leading-none text-rune">
                {score}
              </div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-wider text-zinc-400">
                Score
              </div>
            </div>
          </div>

          <div className="my-2.5 h-px bg-white/5" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-300",
              "transition-colors duration-150 hover:bg-rose-500/10 hover:text-rose-300",
              "focus:outline-none focus-visible:bg-rose-500/10",
            )}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M13 14v1.5A1.5 1.5 0 0 1 11.5 17h-6A1.5 1.5 0 0 1 4 15.5v-11A1.5 1.5 0 0 1 5.5 3h6A1.5 1.5 0 0 1 13 4.5V6M9 10h8m0 0-2.5-2.5M17 10l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default AuthBar;
