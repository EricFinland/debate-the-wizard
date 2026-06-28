/* ========================================
   Wizard - color mapping + animation state helper
   Pure mapping functions are decoupled from the DOM.
   ======================================== */

const Wizard = (() => {
    const COLORS = ['red', 'green', 'grey', 'purple'];

    // each difficulty's enemy wizard color (signature color of the trial)
    const DIFFICULTY_COLOR = {
        easy: 'green',
        medium: 'red',
        hard: 'grey',
        impossible: 'purple'
    };

    function colorClass(color) {
        return 'wizard--' + color;
    }

    function enemyColorFor(difficulty) {
        return DIFFICULTY_COLOR[difficulty] || 'red';
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
