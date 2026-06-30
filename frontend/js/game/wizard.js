/* ========================================
   Wizard - color mapping + animation state helper
   Pure mapping functions are decoupled from the DOM.
   ======================================== */

const Wizard = (() => {
    const config = window.AppConfig;
    if (!config || !config.wizardColors || !config.difficulties) {
        throw new Error('Wizard configuration missing: load js/config.js before js/game/wizard.js');
    }

    const COLORS = config.wizardColors;
    const DIFFICULTY_COLOR = {};
    Object.keys(config.difficulties).forEach(key => {
        DIFFICULTY_COLOR[key] = config.difficulties[key].enemyColor;
    });

    function colorClass(color) {
        return 'wizard--' + color;
    }

    function enemyColorFor(difficulty) {
        return DIFFICULTY_COLOR[difficulty] || COLORS[0];
    }

    /* Apply a color to a .wizard element (removes any previous color class). */
    function applyColor(el, color) {
        COLORS.forEach(c => el.classList.remove(colorClass(c)));
        el.classList.add(colorClass(color));
    }

    /*
     * Play a one-shot animation state on a battle wizard, then return to idle.
     * state: 'attack' | 'hurt' | 'dead'
     * Returns a Promise that resolves when the animation finishes.
     */
    function playState(el, state, duration) {
        return new Promise(resolve => {
            el.classList.remove('wizard--idle');
            // restart animation cleanly
            void el.offsetWidth;
            el.classList.add('wizard--' + state);
            setTimeout(() => {
                el.classList.remove('wizard--' + state);
                if (state !== 'dead') {
                    void el.offsetWidth;
                    el.classList.add('wizard--idle');
                }
                resolve();
            }, duration);
        });
    }

    return { COLORS, DIFFICULTY_COLOR, colorClass, enemyColorFor, applyColor, playState };
})();
