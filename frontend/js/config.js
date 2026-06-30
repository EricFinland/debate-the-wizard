/**
 * config.js — runtime configuration for the static frontend.
 *
 * This app has no build step, so shared runtime values live on a browser
 * global that is loaded before the other frontend scripts.
 */
(function () {
    'use strict';

    function deepFreeze(value) {
        if (!value || typeof value !== 'object') return value;
        Object.keys(value).forEach(function (key) {
            deepFreeze(value[key]);
        });
        return Object.freeze(value);
    }

    window.AppConfig = deepFreeze({
        insforge: {
            baseUrl: 'https://atjgzcv9.us-east.insforge.app',
            anonKey: 'anon_bc75b3318f511cc45a2b0c86dd7cd801cd1f46becdd93dd2fd6da1845748fa6e',
            sdkUrl: 'https://esm.sh/@insforge/sdk@1.4.3'
        },
        api: {
            functions: {
                createRoom: 'create-room',
                submitArgument: 'submit-argument',
                advanceWizard: 'advance-wizard',
                getRoom: 'get-room',
                leaderboard: 'leaderboard',
                recordMatch: 'record-match'
            }
        },
        storageKeys: {
            clientId: 'dtw_client_id',
            gameSave: 'wizardBattleSave'
        },
        auth: {
            readyPollIntervalMs: 100,
            readyMaxPolls: 100
        },
        routes: {
            root: '/debate-the-wizard',
            paths: {
                MAIN_MENU: '/debate-the-wizard',
                REGISTRATION: '/debate-the-wizard/registration',
                MENU: '/debate-the-wizard/difficulty',
                BATTLE: '/debate-the-wizard/battle',
                LEADERBOARD: '/debate-the-wizard/leaderboard',
                ACCOUNT: '/debate-the-wizard/account'
            }
        },
        wizardColors: ['red', 'green', 'grey', 'purple'],
        difficulties: {
            easy: {
                label: 'EASY',
                backend: 'novice',
                enemyColor: 'green',
                level: 3,
                damageMultiplier: 0.8
            },
            medium: {
                label: 'MEDIUM',
                backend: 'adept',
                enemyColor: 'red',
                level: 6,
                damageMultiplier: 1.0
            },
            hard: {
                label: 'HARD',
                backend: 'archmage',
                enemyColor: 'grey',
                level: 9,
                damageMultiplier: 1.2
            },
            impossible: {
                label: 'IMPOSSIBLE',
                backend: 'impossible',
                enemyColor: 'purple',
                level: 13,
                damageMultiplier: 1.5
            }
        }
    });
})();
