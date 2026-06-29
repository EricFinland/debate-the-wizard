/* ========================================
   Storage - session persistence
   Holds { name, color, difficulty }.
   Isolated so a backend can replace this layer later.
   ======================================== */

const Storage = (() => {
    const KEY = 'wizardBattleSave';

    function load() {
        try {
            const raw = sessionStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function save(data) {
        const current = load() || {};
        const merged = { ...current, ...data };
        try {
            sessionStorage.setItem(KEY, JSON.stringify(merged));
        } catch (e) {
            /* storage unavailable - game still works for this session in-memory */
        }
        return merged;
    }

    function clear() {
        try {
            sessionStorage.removeItem(KEY);
        } catch (e) { /* ignore */ }
    }

    function hasSave() {
        const d = load();
        return !!(d && d.name && d.color);
    }

    return { load, save, clear, hasSave };
})();
