/* ========================================
   Main - boot + main menu wiring
   ======================================== */

(function () {
    function initMainMenu() {
        const continueOpt = document.getElementById('mm-continue');
        const newGameOpt = document.getElementById('mm-newgame');
        const leaderboardOpt = document.getElementById('mm-leaderboard');
        const nav = KeyboardNav.create({ columns: 1 });

        function menuItems() {
            const items = [continueOpt, newGameOpt];
            if (leaderboardOpt) items.push(leaderboardOpt);
            return items;
        }

        function refresh() {
            if (Storage.hasSave()) {
                continueOpt.classList.remove('disabled');
            } else {
                continueOpt.classList.add('disabled');
            }
            nav.setItems(menuItems(), 1);
        }
        ScreenManager.onShow('MAIN_MENU', refresh);

        continueOpt.addEventListener('click', () => {
            if (!Storage.hasSave()) return;
            ScreenManager.show('MENU');
        });

        newGameOpt.addEventListener('click', () => {
            Storage.clear();
            Registration.reset();
            ScreenManager.show('REGISTRATION');
        });

        if (leaderboardOpt) {
            leaderboardOpt.addEventListener('click', () => {
                ScreenManager.show('LEADERBOARD');
            });
        }

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'MAIN_MENU') return;
            nav.handleKey(event);
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        initMainMenu();
        Registration.init();
        Menu.init();
        Battle.init();
        Leaderboard.init();
        ScreenManager.show('MAIN_MENU');
    });
})();
