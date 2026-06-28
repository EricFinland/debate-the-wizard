/**
 * auth.js — global `Auth` IIFE wrapping the InsForge browser SDK.
 *
 * Vanilla JS, NOT a module. Loaded via <script> as a global (window.Auth).
 * It reads window.__insforge, which is created by the module <script> in
 * index.html and signalled via the 'insforge-ready' event.
 *
 * Product rule mirrored here:
 *   - email + password account = saves progress, NO email verification needed to play.
 *   - OAuth (Google/GitHub) = the only way to be marked verified, i.e. the only
 *     identity that ranks on the leaderboard.
 *
 * Guests (not logged in) must always keep working. No method blocks the game:
 * every call awaits readiness, but readiness resolves fine even if the SDK is
 * slow, and getUser() simply returns null when there is no session.
 */
(function () {
    'use strict';

    var cachedUser = null;       // last known {id,email,name,emailVerified} | null
    var cachedFetched = false;   // have we ever resolved a getUser() round-trip?

    /** Resolve once window.__insforge exists (it may already be there). */
    function ready() {
        if (window.__insforge) return Promise.resolve(window.__insforge);
        return new Promise(function (resolve) {
            function onReady() {
                if (window.__insforge) {
                    window.removeEventListener('insforge-ready', onReady);
                    resolve(window.__insforge);
                }
            }
            window.addEventListener('insforge-ready', onReady);
            // Safety net in case the event fired before this listener attached.
            var tries = 0;
            var poll = setInterval(function () {
                tries++;
                if (window.__insforge) {
                    clearInterval(poll);
                    window.removeEventListener('insforge-ready', onReady);
                    resolve(window.__insforge);
                } else if (tries > 100) { // ~10s; give up waiting, stay a guest
                    clearInterval(poll);
                }
            }, 100);
        });
    }

    /** Normalize whatever the SDK returns into our small user shape (or null).
     *  Every @insforge/sdk auth call resolves to { data, error } and does NOT
     *  throw on auth failures, so we dig through the envelope:
     *    getCurrentUser -> { data: { user }, error }
     *    signIn/signUp  -> { data: { user, accessToken, ... }, error }
     *  We tolerate the raw user object too (defensive). */
    function mapUser(raw) {
        if (!raw) return null;
        // Unwrap { data, error } first, then { user } inside data, then fall
        // back to the object itself.
        var payload = (raw && raw.data) ? raw.data : raw;
        var u = (payload && payload.user) ? payload.user : payload;
        if (!u || (!u.id && !u.email)) return null;

        var verified = u.emailVerified;
        if (verified == null) verified = u.email_verified;
        if (verified == null) verified = u.email_confirmed;
        // OAuth users come back verified; plain email signups do not.

        var name = u.name;
        if (name == null && u.profile) name = u.profile.name;
        if (name == null) name = u.displayName || u.display_name;

        return {
            id: u.id || null,
            email: u.email || null,
            name: name || null,
            emailVerified: !!verified
        };
    }

    function callGetCurrentUser(insforge) {
        try {
            var r = insforge.auth.getCurrentUser();
            return Promise.resolve(r);
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    /** Turn a settled { data, error } envelope into a resolved user or a
     *  rejected Error. SDK calls don't throw on bad creds; they put the
     *  failure in `error`, so we promote it so callers' .catch() fires. */
    function unwrapAuth(res) {
        var err = res && res.error;
        if (err) {
            var msg = (err && err.message) || (typeof err === 'string' ? err : 'Authentication failed');
            throw new Error(msg);
        }
        return mapUser(res);
    }

    var Auth = {
        /** Resolves once the SDK client exists (or after the safety timeout). */
        isReady: function () {
            return ready().then(function () { return true; });
        },

        /**
         * Current user {id,email,name,emailVerified} or null. Cached after the
         * first successful round-trip; pass force=true to refetch.
         */
        getUser: function (force) {
            if (cachedFetched && !force) return Promise.resolve(cachedUser);
            return ready().then(function (insforge) {
                return callGetCurrentUser(insforge);
            }).then(function (raw) {
                cachedUser = mapUser(raw);
                cachedFetched = true;
                return cachedUser;
            }).catch(function () {
                cachedFetched = true;
                cachedUser = null;
                return null;
            });
        },

        /** Synchronous best-effort read of the cached user (may be null). */
        getCachedUser: function () {
            return cachedUser;
        },

        /** Email + password signup. Session lands immediately (verification off). */
        signUpEmail: function (email, password, name) {
            return ready().then(function (insforge) {
                return insforge.auth.signUp({ email: email, password: password, name: name });
            }).then(function (raw) {
                // Throws on { error } so the caller's .catch() shows the message.
                cachedUser = unwrapAuth(raw);
                cachedFetched = true;
                return cachedUser;
            });
        },

        /** Email + password sign-in. */
        signInEmail: function (email, password) {
            return ready().then(function (insforge) {
                return insforge.auth.signInWithPassword({ email: email, password: password });
            }).then(function (raw) {
                cachedUser = unwrapAuth(raw);
                cachedFetched = true;
                return cachedUser;
            });
        },

        /** OAuth sign-in. provider is 'google' or 'github'. Redirects the page.
         *  In the SPA flow the SDK navigates away, so this usually never resolves;
         *  if it returns first with an { error } (e.g. provider not configured),
         *  promote it so the caller's .catch() can show a message. */
        signInOAuth: function (provider) {
            return ready().then(function (insforge) {
                return insforge.auth.signInWithOAuth(provider, {
                    redirectTo: window.location.href
                });
            }).then(function (res) {
                if (res && res.error) {
                    var err = res.error;
                    throw new Error((err && err.message) || 'OAuth sign-in failed');
                }
                return res;
            });
        },

        /** Sign out and clear the cache. */
        signOut: function () {
            return ready().then(function (insforge) {
                return insforge.auth.signOut();
            }).then(function () {
                cachedUser = null;
                cachedFetched = true;
                return true;
            }).catch(function () {
                cachedUser = null;
                cachedFetched = true;
                return true;
            });
        }
    };

    window.Auth = Auth;
})();
