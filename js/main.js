/* ========================================
   Main - boot + main menu wiring
   ======================================== */

(function () {
    function initMainMenu() {
        const continueOpt = document.getElementById('mm-continue');
        const newGameOpt = document.getElementById('mm-newgame');
        const nav = KeyboardNav.create({ columns: 1 });

        function refresh() {
            if (Storage.hasSave()) {
                continueOpt.classList.remove('disabled');
            } else {
                continueOpt.classList.add('disabled');
            }
            nav.setItems([continueOpt, newGameOpt], 1);
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
        ScreenManager.show('MAIN_MENU');
    });
})();
