/* ========================================
   Registration - name + wizard color
   ======================================== */

const Registration = (() => {
    let selectedColor = null;
    let nav = null;

    function init() {
        const picker = document.getElementById('color-picker');
        const input = document.getElementById('name-input');
        const error = document.getElementById('reg-error');
        const back = document.getElementById('reg-back');
        const confirmBtn = document.getElementById('reg-confirm');
        nav = KeyboardNav.create({ columns: 4 });

        picker.querySelectorAll('.color-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                picker.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedColor = opt.dataset.color;
                error.classList.add('hidden');
            });
        });

        confirmBtn.addEventListener('click', confirm);
        back.addEventListener('click', () => {
            ScreenManager.show('MAIN_MENU');
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') confirm();
        });

        ScreenManager.onShow('REGISTRATION', refreshNav);

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'REGISTRATION') return;
            if (event.target === input && !event.key.startsWith('Arrow') && event.key !== 'Escape') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                back.click();
                return;
            }
            nav.handleKey(event);
        });
    }

    function reset() {
        selectedColor = null;
        document.getElementById('name-input').value = '';
        document.getElementById('reg-error').classList.add('hidden');
        document.querySelectorAll('#color-picker .color-opt').forEach(o => o.classList.remove('selected'));
        if (nav) refreshNav();
    }

    function refreshNav() {
        const colorOptions = document.querySelectorAll('#color-picker .color-opt');
        const back = document.getElementById('reg-back');
        const confirmBtn = document.getElementById('reg-confirm');
        nav.setItems([...colorOptions, back, confirmBtn], 4);
    }

    function confirm() {
        const name = document.getElementById('name-input').value.trim().toUpperCase();
        const error = document.getElementById('reg-error');

        if (!name || !selectedColor) {
            error.classList.remove('hidden');
            return;
        }

        Storage.save({ name, color: selectedColor });
        ScreenManager.show('MENU');
    }

    return { init, reset };
})();
