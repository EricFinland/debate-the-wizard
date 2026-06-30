/**
 * api-support.js - shared support for the Debate the Wizard API endpoints.
 *
 * Vanilla JS, no imports/modules. Loaded via <script> as window.ApiSupport.
 */
(function () {
    'use strict';

    var config = window.AppConfig;
    var insforgeConfig = config && config.insforge;
    var functionSlugs = config && config.api && config.api.functions;
    var difficulties = config && config.difficulties;
    var storageKeys = config && config.storageKeys;
    var utils = window.AppUtils;
    var http = window.JsonHttp;

    if (!insforgeConfig || !insforgeConfig.baseUrl || !functionSlugs || !difficulties || !storageKeys || !utils || !http) {
        throw new Error('ApiSupport configuration missing: load js/config.js, js/core/utils.js, and js/services/http.js before js/services/api-support.js');
    }

    var BASE = String(insforgeConfig.baseUrl).replace(/\/+$/, '');
    var CLIENT_ID_KEY = storageKeys.clientId;

    function localStore() {
        try {
            return localStorage;
        } catch (e) {
            return null;
        }
    }

    function getClientId() {
        var storage = localStore();
        var id = utils.safeStorageGet(storage, CLIENT_ID_KEY);
        if (id) return id;

        id = getClientId._mem || utils.makeUuid();
        if (utils.safeStorageSet(storage, CLIENT_ID_KEY, id)) {
            return id;
        }

        getClientId._mem = id;
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

    function functionUrl(slug) {
        return BASE + '/functions/' + slug;
    }

    function wrapFunctionError(slug, err) {
        if (err && err.status) {
            throw httpError(slug, err.status);
        }
        throw new Error(slug + ' request failed: ' + (err && err.message ? err.message : 'network error'));
    }

    function post(slug, body) {
        return http.postJson(functionUrl(slug), body).catch(function (err) {
            wrapFunctionError(slug, err);
        });
    }

    function get(slug) {
        return http.getJson(functionUrl(slug)).catch(function (err) {
            wrapFunctionError(slug, err);
        });
    }

    function getAuthUser() {
        if (window.Auth && typeof window.Auth.getUser === 'function') {
            return window.Auth.getUser().catch(function () { return null; });
        }
        return Promise.resolve(null);
    }

    function recordMatchPayload(opts, user) {
        opts = opts || {};
        return {
            user_id: (user && user.id) ? user.id : getClientId(),
            display_name: opts.name || (user && user.name) || 'PLAYER',
            won: opts.won,
            score: opts.score,
            email_verified: !!(user && user.emailVerified)
        };
    }

    window.ApiSupport = {
        slugs: functionSlugs,
        post: post,
        get: get,
        mapDifficulty: mapDifficulty,
        getClientId: getClientId,
        recordMatchPayload: recordMatchPayload,
        getAuthUser: getAuthUser
    };
})();
