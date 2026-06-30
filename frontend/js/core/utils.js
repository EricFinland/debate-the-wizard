/* ========================================
   AppUtils - shared browser helpers
   Keep this file small: only generic utilities used by multiple modules.
   ======================================== */
(function () {
    'use strict';

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

    function safeStorageGet(storage, key) {
        try {
            return storage ? storage.getItem(key) : null;
        } catch (e) {
            return null;
        }
    }

    function safeStorageSet(storage, key, value) {
        try {
            if (!storage) return false;
            storage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function safeStorageRemove(storage, key) {
        try {
            if (!storage) return false;
            storage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    window.AppUtils = {
        makeUuid: makeUuid,
        safeStorageGet: safeStorageGet,
        safeStorageSet: safeStorageSet,
        safeStorageRemove: safeStorageRemove
    };
})();
