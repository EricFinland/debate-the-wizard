/* ========================================
   KeyboardNav - shared arrow-key selection
   ======================================== */

const KeyboardNav = (() => {
    const ACTIVE_CLASS = 'is-key-selected';
    const ACTIVATE_KEYS = ['Enter', ' '];

    function create(options = {}) {
        let items = [];
        let index = 0;
        let columns = options.columns || 1;
        // bound pointer handler so we can detach it from old item sets
        const onPointer = event => {
            const i = items.indexOf(event.currentTarget);
            if (i !== -1) focus(i);
        };

        function selectable(item) {
            return item && !item.classList.contains('hidden') && !item.classList.contains('disabled');
        }

        function clear() {
            // clear the active class from EVERY tracked item so no stale highlight lingers
            items.forEach(item => item.classList.remove(ACTIVE_CLASS));
        }

        function focus(nextIndex = index) {
            clear();
            if (!items.length) return;
            index = Math.max(0, Math.min(nextIndex, items.length - 1));
            if (!selectable(items[index])) {
                const fallback = items.findIndex(selectable);
                index = fallback === -1 ? 0 : fallback;
            }
            items[index].classList.add(ACTIVE_CLASS);
        }

        function detachPointer() {
            items.forEach(item => {
                item.removeEventListener('mousemove', onPointer);
                item.removeEventListener('mousedown', onPointer);
            });
        }

        function setItems(nextItems, nextColumns = columns) {
            // detach from the OLD set, clear THEIR highlight, then rebind to the new set
            detachPointer();
            clear();
            items = Array.from(nextItems).filter(Boolean);
            columns = nextColumns || 1;
            // keep the keyboard highlight in lockstep with the mouse so the
            // highlighted box is always the one the user is actually on
            items.forEach(item => {
                item.addEventListener('mousemove', onPointer);
                item.addEventListener('mousedown', onPointer);
            });
            // always reset selection to the first selectable item for the new screen/menu
            index = 0;
            focus(0);
        }

        function move(delta) {
            if (!items.length) return;
            let next = index;
            for (let tries = 0; tries < items.length; tries++) {
                next = (next + delta + items.length) % items.length;
                if (selectable(items[next])) break;
            }
            focus(next);
        }

        function activate() {
            if (selectable(items[index])) items[index].click();
        }

        function handleKey(event) {
            if (!items.length) return false;

            if (event.key === 'ArrowRight') move(1);
            else if (event.key === 'ArrowLeft') move(-1);
            else if (event.key === 'ArrowDown') move(columns);
            else if (event.key === 'ArrowUp') move(-columns);
            else if (ACTIVATE_KEYS.includes(event.key)) activate();
            else return false;

            event.preventDefault();
            return true;
        }

        function reset() {
            detachPointer();
            clear();
            items = [];
            index = 0;
        }

        return { setItems, focus, reset, handleKey };
    }

    return { create };
})();
