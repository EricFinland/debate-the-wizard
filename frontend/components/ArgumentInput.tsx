'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/ui'

export interface ArgumentInputProps {
  /** When true, the composer is fully inert (e.g. it is not the player's turn). */
  disabled?: boolean
  /** When true, the argument is being scored by the backend; shows a spinner. */
  loading?: boolean
  /** Called with the trimmed, non-empty argument text. */
  onSubmit: (text: string) => void
  /** Hard character cap on the argument. Defaults to 4000. */
  maxLength?: number
}

const MODIFIER_HINT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl'

/**
 * Player's argument composer for Debate the Wizard.
 *
 * Arcane-styled textarea with a live character counter, hard maxLength
 * enforcement, Cmd/Ctrl+Enter submit, and a spinner-locked loading state.
 * Trims input and silently ignores empty submissions. Purely presentational:
 * all state beyond the local draft is driven by props.
 */
export function ArgumentInput({
  disabled = false,
  loading = false,
  onSubmit,
  maxLength = 4000,
}: ArgumentInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [shake, setShake] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const locked = disabled || loading
  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0 && !locked

  const remaining = maxLength - value.length
  const ratio = Math.min(value.length / maxLength, 1)
  const nearLimit = remaining <= 200
  const atLimit = remaining <= 0

  const counterTone = useMemo(() => {
    if (atLimit) return 'text-rose-300'
    if (nearLimit) return 'text-amber-300'
    return 'text-zinc-500'
  }, [atLimit, nearLimit])

  const handleSubmit = useCallback(() => {
    if (!trimmed) {
      // nudge the player when they try to fire an empty argument
      setShake((n) => n + 1)
      textareaRef.current?.focus()
      return
    }
    if (locked) return
    onSubmit(trimmed)
    setValue('')
  }, [trimmed, locked, onSubmit])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      setValue(next.length > maxLength ? next.slice(0, maxLength) : next)
    },
    [maxLength],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <motion.div
      key={shake}
      animate={
        shake
          ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.42, ease: 'easeInOut' }}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border bg-zinc-950/60 backdrop-blur-sm transition-colors duration-300',
        focused
          ? 'border-amber-400/50 shadow-[0_0_30px_-6px_rgba(251,191,36,0.35)]'
          : 'border-violet-500/20 shadow-[0_0_24px_-12px_rgba(139,92,246,0.45)]',
        locked && 'opacity-80',
      )}
    >
      {/* arcane rune-gold seam at the top edge */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-300',
          'bg-gradient-to-r from-transparent via-amber-300/70 to-transparent',
          focused ? 'opacity-100' : 'opacity-40',
        )}
      />

      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          aria-hidden
          className="text-sm leading-none text-amber-300/80 transition-transform duration-300 group-focus-within:rotate-12"
        >
          {'✦'}
        </span>
        <label
          htmlFor="argument-input"
          className="select-none font-serif text-xs uppercase tracking-[0.22em] text-amber-200/70"
        >
          Your incantation
        </label>
      </div>

      <textarea
        ref={textareaRef}
        id="argument-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={locked}
        maxLength={maxLength}
        spellCheck
        rows={5}
        aria-label="Your argument"
        aria-describedby="argument-counter argument-hint"
        placeholder={
          disabled
            ? 'The arena is sealed for now…'
            : 'Make your case. Cite the truth. The wizard is listening…'
        }
        className={cn(
          'w-full resize-none bg-transparent px-4 pb-3 pt-3 font-sans text-[15px] leading-relaxed text-zinc-100',
          'placeholder:text-zinc-500/80 focus:outline-none',
          'disabled:cursor-not-allowed disabled:text-zinc-500',
          'min-h-[120px] max-h-[320px]',
        )}
      />

      {/* live char-fill meter */}
      <div aria-hidden className="px-4">
        <div className="h-px w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className={cn(
              'h-full rounded-full',
              atLimit
                ? 'bg-rose-400'
                : nearLimit
                  ? 'bg-amber-300'
                  : 'bg-gradient-to-r from-violet-500 to-amber-300',
            )}
            initial={false}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 30 }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            id="argument-counter"
            className={cn(
              'tabular-nums font-mono text-xs transition-colors duration-200',
              counterTone,
            )}
            aria-live="polite"
          >
            {value.length.toLocaleString()}
            <span className="text-zinc-600">/{maxLength.toLocaleString()}</span>
          </span>
          <span
            id="argument-hint"
            className="hidden truncate text-xs text-zinc-600 sm:inline"
          >
            {MODIFIER_HINT}
            <span className="px-0.5 text-zinc-700">+</span>
            Enter to cast
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={loading}
          className={cn(
            'relative inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2 font-serif text-sm font-semibold tracking-wide transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
            canSubmit
              ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 shadow-[0_0_22px_-4px_rgba(251,191,36,0.6)] hover:from-amber-200 hover:to-amber-400 hover:shadow-[0_0_28px_-2px_rgba(251,191,36,0.75)] active:scale-[0.97]'
              : 'cursor-not-allowed bg-white/5 text-zinc-500',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
                  />
                </svg>
                Conjuring…
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5"
              >
                <span aria-hidden className="text-base leading-none">
                  {'⚡'}
                </span>
                Cast argument
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  )
}

export default ArgumentInput
