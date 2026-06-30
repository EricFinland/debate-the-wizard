/**
 * config.js — runtime configuration for the static frontend.
 *
 * This app has no build step, so shared runtime values live on a browser
 * global that is loaded before the other frontend scripts.
 */
(function () {
    'use strict';

    var env = window.AppEnv || {};

    function requireEnv(name) {
        var value = env[name];
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error('Missing frontend environment value: ' + name + '. Run npm run generate-env in frontend/.');
        }
        return value.trim();
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object') return value;
        Object.keys(value).forEach(function (key) {
            deepFreeze(value[key]);
        });
        return Object.freeze(value);
    }

    window.AppConfig = deepFreeze({
        insforge: {
            baseUrl: requireEnv('INSFORGE_API_URL'),
            anonKey: env.INSFORGE_ANON_KEY || '',
            sdkUrl: requireEnv('INSFORGE_SDK_URL')
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
