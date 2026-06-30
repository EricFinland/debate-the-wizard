/**
 * api.js — global `Api` fetch client for the Debate the Wizard live backend.
 *
 * Vanilla JS, no imports/modules. Loaded via <script> as a global IIFE (window.Api).
 *
 * Wraps the InsForge edge functions at the configured /functions/<slug> URLs
 * (public, no auth header). Difficulty/backend mapping, function slugs, and
 * storage keys live in window.AppConfig.
 *
 * Each method throws a clean Error with a short message on a non-OK response.
 */
(function () {
    'use strict';

    var config = window.AppConfig;
    var insforgeConfig = config && config.insforge;
    var functionSlugs = config && config.api && config.api.functions;
    var difficulties = config && config.difficulties;
    var storageKeys = config && config.storageKeys;
    if (!insforgeConfig || !insforgeConfig.baseUrl || !functionSlugs || !difficulties || !storageKeys) {
        throw new Error('Api configuration missing: load js/config.js before js/services/api.js');
    }

    var BASE = String(insforgeConfig.baseUrl).replace(/\/+$/, '');
    var CLIENT_ID_KEY = storageKeys.clientId;

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
        if (difficulties[key] && difficulties[key].backend) {
            return difficulties[key].backend;
        }
        var backendNames = Object.keys(difficulties).map(function (name) {
            return difficulties[name].backend;
        });
        if (backendNames.indexOf(key) !== -1) return key;
        return difficulties.easy.backend;
    }

    function httpError(slug, status) {
        var err = new Error(slug + ' failed (' + status + ')');
        err.status = status;
        err.slug = slug;
        return err;
    }

    /** POST JSON to a function slug; throws a clean Error on non-OK. */
    function post(slug, body) {
        return fetch(BASE + '/functions/' + slug, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (res) {
            if (!res.ok) {
                throw httpError(slug, res.status);
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
                    throw httpError(slug, res.status);
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
            return post(functionSlugs.createRoom, {
                topic: opts.topic,
                difficulty: mapDifficulty(opts.difficulty),
                host_user_id: getClientId()
            });
        },

        /** Submit the player's argument for a round. */
        submitArgument: function (roomId, roundNo, argument) {
            return post(functionSlugs.submitArgument, {
                room_id: roomId,
                round_no: roundNo,
                argument: argument
            });
        },

        /** Advance the wizard (opponent) for a round, optionally reacting to the player's argument. */
        advanceWizard: function (roomId, roundNo, opponentArgument) {
            return post(functionSlugs.advanceWizard, {
                room_id: roomId,
                round_no: roundNo,
                opponent_argument: opponentArgument
            });
        },

        /** Fetch full room state (room, players, scores, claims, winner). */
        getRoom: function (roomId) {
            return post(functionSlugs.getRoom, { room_id: roomId });
        },

        /** Fetch the leaderboard. */
        leaderboard: function () {
            return get(functionSlugs.leaderboard);
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

                return post(functionSlugs.recordMatch, {
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
