/* ========================================
   Menu - difficulty selection (4 staffs)
   ======================================== */

const Menu = (() => {
    const config = window.AppConfig;
    if (!config || !config.difficulties) {
        throw new Error('Menu configuration missing: load js/config.js before js/screens/menu.js');
    }

    let nav = null;

    function init() {
        nav = KeyboardNav.create({ columns: 2 });

        document.querySelectorAll('#staff-grid .staff-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const difficulty = opt.dataset.difficulty;
                Storage.save({ difficulty });
                Battle.start(difficulty);
            });
            const difficulty = config.difficulties[opt.dataset.difficulty];
            const label = opt.querySelector('.staff-label');
            const image = opt.querySelector('.staff-img');
            if (difficulty && label) label.textContent = difficulty.label;
            if (difficulty && image) image.alt = difficulty.label + ' staff';
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
        nav.setItems([
            ...document.querySelectorAll('#staff-grid .staff-opt'),
            document.getElementById('menu-quit')
        ], 2);
    }

    return { init, refresh };
})();
