/* ========================================
   Storage - session persistence
   Holds { name, color, difficulty }.
   Isolated so a backend can replace this layer later.
   ======================================== */

const Storage = (() => {
    const config = window.AppConfig;
    if (!config || !config.storageKeys || !config.storageKeys.gameSave) {
        throw new Error('Storage configuration missing: load js/config.js before js/core/storage.js');
    }
    const utils = window.AppUtils;
    if (!utils) {
        throw new Error('Storage utilities missing: load js/core/utils.js before js/core/storage.js');
    }
    const KEY = config.storageKeys.gameSave;

    function sessionStore() {
        try {
            return sessionStorage;
        } catch (e) {
            return null;
        }
    }

    function load() {
        try {
            const raw = utils.safeStorageGet(sessionStore(), KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function save(data) {
        const current = load() || {};
        const merged = { ...current, ...data };
        utils.safeStorageSet(sessionStore(), KEY, JSON.stringify(merged));
        return merged;
    }

    function clear() {
        utils.safeStorageRemove(sessionStore(), KEY);
    }

    function hasSave() {
        const d = load();
        return !!(d && d.name && d.color);
    }

    return { load, save, clear, hasSave };
})();
