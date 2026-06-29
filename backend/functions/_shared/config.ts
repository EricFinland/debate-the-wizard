// _shared/config.ts — shared config, types, and constants for all edge functions.
//
// Import with:  import { env, CORS, SCORE, ... } from "../_shared/config.ts";
//
// Deno bundles relative imports into the same deployment unit, so this is safe
// (no cross-function HTTP calls, no 508 loop risk).

declare const Deno: { env: { get(key: string): string | undefined } };

// ---------- env helper ----------
export const env = (k: string, fallback = ""): string => Deno.env.get(k) ?? fallback;

// ---------- constants ----------
export const DEFAULT_BASE = "https://4eychqk3.us-east.insforge.app";

export const SCORE = { supported: 10, unsupported: 0, misleading: -5 } as const;
export type Verdict = keyof typeof SCORE;

// ---------- CORS ----------
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

/** Convenience response builder. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// ---------- shared types ----------
export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface Scores {
  factual_accuracy: number;
  logic: number;
  evidence: number;
  persuasiveness: number;
}

export const ZERO_SCORES: Scores = {
  factual_accuracy: 0,
  logic: 0,
  evidence: 0,
  persuasiveness: 0,
};
