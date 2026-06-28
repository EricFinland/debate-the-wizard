/**
 * api.js — global `Api` fetch client for the Debate the Wizard live backend.
 *
 * Vanilla JS, no imports/modules. Loaded via <script> as a global IIFE (window.Api).
 *
 * Wraps the InsForge edge functions at BASE/functions/<slug> (public, no auth header).
 * Maps the pixel game's difficulty names (easy/medium/hard/impossible) to the
 * backend's (novice/adept/archmage/impossible). A stable clientId is persisted in
 * localStorage and sent as host_user_id / user_id on the relevant calls.
 *
 * Each method throws a clean Error with a short message on a non-OK response.
 */
(function () {
    'use strict';

    var BASE = 'https://atjgzcv9.us-east.insforge.app';
    var CLIENT_ID_KEY = 'dtw_client_id';

    // easy/medium/hard/impossible (pixel) -> novice/adept/archmage/impossible (backend).
    // Backend names are accepted as-is too.
    var DIFFICULTY_MAP = {
        easy: 'novice',
        medium: 'adept',
        hard: 'archmage',
        impossible: 'impossible',
        novice: 'novice',
        adept: 'adept',
        archmage: 'archmage'
    };

    /** Generate a UUID, falling back when crypto.randomUUID is unavailable. */
    function makeUuid() {
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
        } catch (e) { /* fall through */ }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /** Stable per-browser client id, persisted in localStorage (created on first use). */
    function getClientId() {
        var id;
        try {
            id = localStorage.getItem(CLIENT_ID_KEY);
            if (!id) {
                id = makeUuid();
                localStorage.setItem(CLIENT_ID_KEY, id);
            }
        } catch (e) {
            // localStorage blocked (private mode etc.) — fall back to an in-memory id.
            if (!getClientId._mem) getClientId._mem = makeUuid();
            id = getClientId._mem;
        }
        return id;
    }

    function mapDifficulty(difficulty) {
        var key = String(difficulty || '').toLowerCase().trim();
        return DIFFICULTY_MAP[key] || 'novice';
    }

    /** POST JSON to a function slug; throws a clean Error on non-OK. */
    function post(slug, body) {
        return fetch(BASE + '/functions/' + slug, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (res) {
            if (!res.ok) {
                throw new Error(slug + ' failed (' + res.status + ')');
            }
            return res.json();
        }).catch(function (err) {
            if (err instanceof Error && err.message.indexOf(slug) === 0) throw err;
            throw new Error(slug + ' request failed: ' + (err && err.message ? err.message : 'network error'));
        });
    }

    /** GET JSON from a function slug; throws a clean Error on non-OK. */
    function get(slug) {
        return fetch(BASE + '/functions/' + slug, { method: 'GET' })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error(slug + ' failed (' + res.status + ')');
                }
                return res.json();
            }).catch(function (err) {
                if (err instanceof Error && err.message.indexOf(slug) === 0) throw err;
                throw new Error(slug + ' request failed: ' + (err && err.message ? err.message : 'network error'));
            });
    }

    var Api = {
        /** Persisted, stable per-browser client id. */
        clientId: getClientId(),

        /**
         * Create a room.
         * @param {{topic:string, difficulty:string, name?:string}} opts
         *        difficulty accepts pixel (easy/medium/hard/impossible) or backend names.
         */
        createRoom: function (opts) {
            opts = opts || {};
            return post('create-room', {
                topic: opts.topic,
                difficulty: mapDifficulty(opts.difficulty),
                host_user_id: getClientId()
            });
        },

        /** Submit the player's argument for a round. */
        submitArgument: function (roomId, roundNo, argument) {
            return post('submit-argument', {
                room_id: roomId,
                round_no: roundNo,
                argument: argument
            });
        },

        /** Advance the wizard (opponent) for a round, optionally reacting to the player's argument. */
        advanceWizard: function (roomId, roundNo, opponentArgument) {
            return post('advance-wizard', {
                room_id: roomId,
                round_no: roundNo,
                opponent_argument: opponentArgument
            });
        },

        /** Fetch full room state (room, players, scores, claims, winner). */
        getRoom: function (roomId) {
            return post('get-room', { room_id: roomId });
        },

        /** Fetch the leaderboard. */
        leaderboard: function () {
            return get('leaderboard');
        },

        /**
         * Record a finished match for the leaderboard.
         *
         * Uses the logged-in identity when available:
         *   - user_id        = Auth user id, else the guest clientId.
         *   - display_name   = opts.name (account name or Storage name).
         *   - email_verified = the user's REAL emailVerified (true only for
         *                      OAuth/verified accounts). Guests and unverified
         *                      email accounts are false, so only OAuth users rank.
         *
         * Always works for guests (window.Auth may be absent or return null).
         *
         * @param {{name:string, won:(boolean|null), score:number}} opts
         */
        recordMatch: function (opts) {
            opts = opts || {};

            // Best-effort: resolve the logged-in user if Auth is present.
            var userPromise;
            if (window.Auth && typeof window.Auth.getUser === 'function') {
                userPromise = window.Auth.getUser().catch(function () { return null; });
            } else {
                userPromise = Promise.resolve(null);
            }

            return userPromise.then(function (user) {
                var userId = (user && user.id) ? user.id : getClientId();
                var displayName = opts.name || (user && user.name) || 'PLAYER';
                var emailVerified = !!(user && user.emailVerified);

                return post('record-match', {
                    user_id: userId,
                    display_name: displayName,
                    won: opts.won,
                    score: opts.score,
                    email_verified: emailVerified
                });
            });
        }
    };

    window.Api = Api;
})();
