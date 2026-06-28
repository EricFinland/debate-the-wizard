/* ========================================
   ScreenManager - show/hide screen sections
   ======================================== */

const ScreenManager = (() => {
    const IDS = {
        MAIN_MENU: 'main-menu-screen',
        REGISTRATION: 'registration-screen',
        MENU: 'menu-screen',
        BATTLE: 'battle-screen',
        LEADERBOARD: 'leaderboard-screen'
    };

    const listeners = {};
    let currentScreen = null;

    function show(name) {
        Object.values(IDS).forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        const el = document.getElementById(IDS[name]);
        if (el) el.classList.remove('hidden');
        currentScreen = name;
        if (listeners[name]) listeners[name].forEach(fn => fn());
    }

    /* register a callback that runs each time a screen is shown */
    function onShow(name, fn) {
        (listeners[name] = listeners[name] || []).push(fn);
    }

    function current() {
        return currentScreen;
    }

    return { IDS, show, onShow, current };
})();
