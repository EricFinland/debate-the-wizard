/**
 * api.js - endpoint facade for the Debate the Wizard live backend.
 *
 * Vanilla JS, no imports/modules. Loaded via <script> as window.Api.
 */
(function () {
    'use strict';

    var support = window.ApiSupport;
    if (!support) {
        throw new Error('Api support missing: load js/services/api-support.js before js/services/api.js');
    }

    var Api = {
        createRoom: function (opts) {
            opts = opts || {};
            return support.post(support.slugs.createRoom, {
                topic: opts.topic,
                difficulty: support.mapDifficulty(opts.difficulty),
                host_user_id: support.getClientId()
            });
        },

        submitArgument: function (roomId, roundNo, argument) {
            return support.post(support.slugs.submitArgument, {
                room_id: roomId,
                round_no: roundNo,
                argument: argument
            });
        },

        getRoom: function (roomId) {
            return support.post(support.slugs.getRoom, { room_id: roomId });
        },

        leaderboard: function () {
            return support.get(support.slugs.leaderboard);
        },

        recordMatch: function (opts) {
            opts = opts || {};
            return support.getAuthUser().then(function (user) {
                return support.post(support.slugs.recordMatch, support.recordMatchPayload(opts, user));
            });
        }
    };

    window.Api = Api;
})();
