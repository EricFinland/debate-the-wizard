/* ========================================
   Menu - difficulty selection (4 staffs)
   ======================================== */

const Menu = (() => {
    let nav = null;

    function init() {
        nav = KeyboardNav.create({ columns: 2 });

        document.querySelectorAll('#staff-grid .staff-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const difficulty = opt.dataset.difficulty;
                Storage.save({ difficulty });
                Battle.start(difficulty);
            });
        });

        document.getElementById('menu-quit').addEventListener('click', () => {
            ScreenManager.show('MAIN_MENU');
        });

        // refresh greeting whenever the menu is shown
        ScreenManager.onShow('MENU', refresh);

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'MENU') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                document.getElementById('menu-quit').click();
                return;
            }
            nav.handleKey(event);
        });
    }

    function refresh() {
        const save = Storage.load() || {};
        const name = save.name || 'WIZARD';
        document.getElementById('menu-greeting').textContent = 'WELCOME, ' + name;
        nav.setItems([
            ...document.querySelectorAll('#staff-grid .staff-opt'),
            document.getElementById('menu-quit')
        ], 2);
    }

    return { init, refresh };
})();
