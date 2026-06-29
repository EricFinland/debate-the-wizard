/* ========================================
   Leaderboard - pixel champions screen
   ======================================== */

const Leaderboard = (() => {
    let loading = false;

    function init() {
        const quit = document.getElementById('lb-quit');
        if (quit) {
            quit.addEventListener('click', () => {
                ScreenManager.show('MAIN_MENU');
            });
        }

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'LEADERBOARD') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                const q = document.getElementById('lb-quit');
                if (q) q.click();
            }
        });

        ScreenManager.onShow('LEADERBOARD', render);
    }

    function setMessage(list, text) {
        list.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'lb-empty';
        msg.textContent = text;
        list.appendChild(msg);
    }

    async function render() {
        const list = document.getElementById('lb-list');
        if (!list) return;
        if (loading) return;
        loading = true;

        setMessage(list, 'LOADING...');

        let data = null;
        try {
            data = await Api.leaderboard();
        } catch (err) {
            setMessage(list, 'CONNECTION LOST');
            loading = false;
            return;
        }

        loading = false;

        const rows = (data && data.leaderboard) ? data.leaderboard : [];
        if (!rows.length) {
            setMessage(list, 'NO CHAMPIONS YET');
            return;
        }

        const save = Storage.load() || {};
        const myName = (save.name || '').toUpperCase();

        list.innerHTML = '';
        rows.forEach((entry, idx) => {
            const rank = idx + 1;
            const wins = (entry.wins != null) ? entry.wins : 0;
            const losses = (entry.losses != null) ? entry.losses : 0;
            const score = (entry.total_score != null) ? entry.total_score : 0;
            const name = entry.display_name || 'UNKNOWN';

            const row = document.createElement('div');
            row.className = 'lb-row';
            if (rank === 1) row.classList.add('lb-first');
            if (myName && String(name).toUpperCase() === myName) row.classList.add('lb-me');

            const rankEl = document.createElement('span');
            rankEl.className = 'lb-rank';
            rankEl.textContent = rank;

            const nameEl = document.createElement('span');
            nameEl.className = 'lb-name';
            nameEl.textContent = name;

            const scoreEl = document.createElement('span');
            scoreEl.className = 'lb-score';
            scoreEl.textContent = score + ' PTS  ' + wins + '-' + losses;

            row.appendChild(rankEl);
            row.appendChild(nameEl);
            row.appendChild(scoreEl);
            list.appendChild(row);
        });
    }

    return { init, render };
})();
