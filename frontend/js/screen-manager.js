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

    /* border-title path shown for each screen (my terminal frame) */
    const ROOT_PATH = '/debate-the-wizard';
    const PATHS = {
        MAIN_MENU: ROOT_PATH,
        REGISTRATION: ROOT_PATH + '/registration',
        MENU: ROOT_PATH + '/difficulty',
        BATTLE: ROOT_PATH + '/battle',
        LEADERBOARD: ROOT_PATH + '/leaderboard',
        ACCOUNT: ROOT_PATH + '/account'
    };

    const listeners = {};
    let currentScreen = null;

    function show(name) {
        Object.values(IDS).forEach(id => {
            const node = document.getElementById(id);
            if (node) node.classList.add('hidden');
        });
        const el = document.getElementById(IDS[name]);
        if (el) el.classList.remove('hidden');
        currentScreen = name;
        const label = document.querySelector('.term-label');
        if (label) label.textContent = PATHS[name] || ROOT_PATH;
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
