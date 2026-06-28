"use client";

// Singleton InsForge SDK client + typed auth/realtime helpers for
// "Debate the Wizard". The browser only ever uses the publishable anon key —
// the admin ik_ key must NEVER appear here.
//
// Usage:
//   import { signIn, signOut, getUser, subscribeRoom } from "@/lib/insforge-auth";
//   const user = await getUser();
//   await signIn("google");
//   const unsub = subscribeRoom(roomId, () => refetch());

import { createClient } from "@insforge/sdk";

// Importing shared types keeps this file in the project's type universe even
// though the realtime payload itself is loosely shaped by the backend.
import type { Room } from "@/lib/debate-client";

export type OAuthProvider = "google" | "github";

/** Normalized user shape consumed by the UI. */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  /** True once the email is verified. OAuth users are always verified. */
  emailVerified: boolean;
}

type InsforgeClient = ReturnType<typeof createClient>;

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

// Lazily-created singleton so we never instantiate the SDK during SSR and never
// create more than one client on the browser (avoids duplicate realtime sockets).
let _client: InsforgeClient | null = null;

const isBrowser = (): boolean => typeof window !== "undefined";

/**
 * Returns the shared InsForge client, creating it on first use. Returns null on
 * the server (no window) and when env vars are missing, so callers can guard
 * gracefully instead of throwing during render.
 */
export function getInsforge(): InsforgeClient | null {
  if (!isBrowser()) return null;
  if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[insforge-auth] Missing NEXT_PUBLIC_INSFORGE_URL / NEXT_PUBLIC_INSFORGE_ANON_KEY",
      );
    }
    return null;
  }
  if (!_client) {
    _client = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
    });
  }
  return _client;
}

/**
 * Kick off an OAuth sign-in. Redirects the browser back to the current origin
 * on success. No-op on the server.
 */
export async function signIn(provider: OAuthProvider): Promise<void> {
  const insforge = getInsforge();
  if (!insforge || !isBrowser()) return;
  await insforge.auth.signInWithOAuth(provider, {
    redirectTo: window.location.origin,
  });
}

/**
 * Sign up with email + password. Email verification is disabled on this
 * project, so a session is returned immediately. Resolves to the normalized
 * AuthUser, or null on the server / when the SDK is unavailable.
 *
 * Throws on real auth errors (e.g. email already registered, weak password)
 * so the calling form can surface the message.
 */
export async function signUpEmail(
  email: string,
  password: string,
  name?: string,
): Promise<AuthUser | null> {
  const insforge = getInsforge();
  if (!insforge || !isBrowser()) return null;

  const { data, error } = await insforge.auth.signUp({
    email,
    password,
    ...(name ? { name } : {}),
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message ?? "Sign-up failed");

  const u = (data as { user?: RawUser } | null)?.user;
  return u ? normalizeUser(u) : getUser();
}

/**
 * Sign in with email + password. Resolves to the normalized AuthUser, or null
 * on the server / when the SDK is unavailable. Throws on bad credentials so
 * the calling form can surface the message.
 */
export async function signInEmail(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const insforge = getInsforge();
  if (!insforge || !isBrowser()) return null;

  const { data, error } = await insforge.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");

  const u = (data as { user?: RawUser } | null)?.user;
  return u ? normalizeUser(u) : getUser();
}

/** Sign the current user out. Safe to call when already signed out. */
export async function signOut(): Promise<void> {
  const insforge = getInsforge();
  if (!insforge) return;
  try {
    await insforge.auth.signOut();
  } catch {
    // Already signed out / network blip — nothing actionable for the UI.
  }
}

/**
 * Resolve the current user in the normalized AuthUser shape, or null when
 * signed out / unavailable. Tolerant of small differences in the SDK's user
 * object (metadata vs. top-level fields).
 */
export async function getUser(): Promise<AuthUser | null> {
  const insforge = getInsforge();
  if (!insforge) return null;
  try {
    const { data } = await insforge.auth.getCurrentUser();
    const u = (data as { user?: RawUser } | null)?.user;
    if (!u || !u.id) return null;
    return normalizeUser(u);
  } catch {
    return null;
  }
}

/**
 * Map a raw SDK user into the normalized AuthUser shape. Tolerant of small
 * differences in the SDK's user object (metadata vs. top-level fields) and the
 * various spellings of the verified flag. OAuth users come back verified.
 */
function normalizeUser(u: RawUser): AuthUser {
  const meta = u.user_metadata ?? u.metadata ?? {};
  return {
    id: u.id ?? "",
    email: u.email ?? "",
    name: u.name ?? meta.name ?? meta.full_name ?? undefined,
    avatar_url: u.avatar_url ?? meta.avatar_url ?? meta.picture ?? undefined,
    emailVerified: Boolean(
      u.emailVerified ?? u.email_verified ?? u.email_confirmed_at,
    ),
  };
}

/** Loosely-typed raw user from the SDK (shape varies by provider). */
interface RawUser {
  id?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  emailVerified?: boolean;
  email_verified?: boolean;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, string | undefined>;
  metadata?: Record<string, string | undefined>;
}

/**
 * Subscribe to realtime row changes for a single room across the rooms,
 * players, claims and citations tables. Calls `onUpdate` on any change scoped
 * to the given room id. Returns an unsubscribe function (no-op on the server).
 *
 * The payload is intentionally loose — callers typically just refetch via
 * getRoom rather than reconcile diffs by hand.
 */
export function subscribeRoom(
  roomId: string,
  onUpdate: (payload: RoomRealtimePayload) => void,
): () => void {
  const insforge = getInsforge();
  if (!insforge || !isBrowser() || !roomId) return () => {};

  const realtime = (insforge as unknown as { realtime?: RealtimeApi }).realtime;
  if (!realtime?.channel) {
    // SDK build without realtime support — degrade silently; caller should poll.
    return () => {};
  }

  let channel: RealtimeChannel | null = null;
  try {
    channel = realtime.channel(`room:${roomId}`);

    const emit = (table: RoomTable) => (raw: unknown) => {
      onUpdate({ table, room_id: roomId, raw });
    };

    // rooms keys on `id`, the child tables on `room_id`.
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, emit("rooms"))
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, emit("players"))
      .on("postgres_changes", { event: "*", schema: "public", table: "claims", filter: `room_id=eq.${roomId}` }, emit("claims"))
      .on("postgres_changes", { event: "*", schema: "public", table: "citations", filter: `room_id=eq.${roomId}` }, emit("citations"))
      .subscribe();
  } catch {
    return () => {};
  }

  return () => {
    try {
      channel?.unsubscribe?.();
    } catch {
      // ignore teardown errors
    }
  };
}

export type RoomTable = "rooms" | "players" | "claims" | "citations";

export interface RoomRealtimePayload {
  table: RoomTable;
  room_id: string;
  /** Raw change event from the SDK; shape depends on the table. */
  raw: unknown;
}

// Minimal structural types for the optional realtime surface so we avoid `any`
// while not hard-depending on a specific SDK realtime version.
interface RealtimeChannel {
  on: (
    event: string,
    opts: Record<string, unknown>,
    cb: (payload: unknown) => void,
  ) => RealtimeChannel;
  subscribe: () => unknown;
  unsubscribe?: () => unknown;
}

interface RealtimeApi {
  channel: (name: string) => RealtimeChannel;
}

// Re-export Room for convenience so consumers can pull the room type alongside
// the auth helpers from one module.
export type { Room };

const insforgeAuth = {
  getInsforge,
  signIn,
  signUpEmail,
  signInEmail,
  signOut,
  getUser,
  subscribeRoom,
};

export default insforgeAuth;
