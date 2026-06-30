/**
 * http.js - generic JSON fetch helpers.
 *
 * Vanilla JS, no imports/modules. Loaded via <script> as window.JsonHttp.
 */
(function () {
    'use strict';

    function requestJson(url, options) {
        return fetch(url, options)
            .then(function (res) {
                if (!res.ok) {
                    var err = new Error('HTTP request failed (' + res.status + ')');
                    err.status = res.status;
                    throw err;
                }
                return res.json();
            });
    }

    function postJson(url, body) {
        return requestJson(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    }

    function getJson(url) {
        return requestJson(url, { method: 'GET' });
    }

    window.JsonHttp = {
        requestJson: requestJson,
        getJson: getJson,
        postJson: postJson
    };
})();
