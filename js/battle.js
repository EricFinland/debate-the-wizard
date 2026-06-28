/* ========================================
   Battle - debate-driven wizard duel (player vs the wizard)
   Powered by the live You.com + Claude backend via window.Api.
   HP = debate score. Player argues FOR the claim; the wizard argues AGAINST.
   Visual helpers (projectile, updateHp, say, waitForClick, centerOf, HP color
   thresholds) are preserved from the original combat prototype.
   ======================================== */

const Battle = (() => {
    /* --- difficulty tuning (cosmetic color comes from Wizard.enemyColorFor) ---
       The backend decides verdicts; dmgMult only scales how hard the wizard hits. */
    const DIFFICULTY = {
        easy:       { label: 'EASY',       dmgMult: 0.8, level: 3,  backend: 'novice' },
        medium:     { label: 'MEDIUM',     dmgMult: 1.0, level: 6,  backend: 'adept' },
        hard:       { label: 'HARD',       dmgMult: 1.2, level: 9,  backend: 'archmage' },
        impossible: { label: 'IMPOSSIBLE', dmgMult: 1.5, level: 13, backend: 'impossible' }
    };

    const START_HP = 100;
    const PLAYER_LEVEL = 5;

    /* spell tint per verdict (reuse projectile FX) */
    const CAST_COLOR = '#b06bff';      // supported -> arcane bolt
    const FIZZLE_COLOR = '#9a9a9a';    // unsupported -> weak grey

    let player = null;
    let enemy = null;
    let busy = false;
    let awaitingContinue = null; // resolver fn while waiting for a click

    // debate state
    let roomId = null;
    let round = 1;
    let roundsTotal = 3;
    let mappedDifficulty = 'adept';
    let lastCitations = [];      // citations from the most recent turn (for PACK)
    let lastPlayerArg = '';      // fed to advance-wizard as opponent_argument
    let argResolver = null;      // resolver while waiting on the text input

    let actionNav = null;

    // DOM refs (resolved on init)
    let els = {};

    function init() {
        els = {
            scene: document.getElementById('scene'),
            fx: document.getElementById('fx-container'),
            playerWizard: document.getElementById('player-wizard'),
            enemyWizard: document.getElementById('enemy-wizard'),
            playerName: document.getElementById('player-name'),
            enemyName: document.getElementById('enemy-name'),
            playerLvl: document.getElementById('player-lvl'),
            enemyLvl: document.getElementById('enemy-lvl'),
            playerHpBar: document.getElementById('player-hp-bar'),
            enemyHpBar: document.getElementById('enemy-hp-bar'),
            playerHpText: document.getElementById('player-hp-text'),
            dialog: document.getElementById('dialog-box'),
            text: document.getElementById('text-content'),
            arrow: document.getElementById('advance-arrow'),
            actionMenu: document.getElementById('action-menu'),
            moveMenu: document.getElementById('move-menu'),
            inputWrap: document.getElementById('debate-input-wrap'),
            argInput: document.getElementById('debate-arg-input'),
            submitBtn: document.getElementById('debate-submit'),
            citationBox: document.getElementById('citation-box')
        };
        actionNav = KeyboardNav.create({ columns: 2 });

        // action menu buttons
        els.actionMenu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', event => {
                event.stopPropagation();
                onAction(item.dataset.act);
            });
        });

        // click to advance when a message is waiting (ignore clicks on the input UI)
        els.dialog.addEventListener('click', event => {
            if (els.inputWrap.contains(event.target)) return;
            advanceDialog();
        });

        // argument submit
        els.submitBtn.addEventListener('click', event => {
            event.stopPropagation();
            submitArg();
        });
        els.argInput.addEventListener('keydown', event => {
            // Enter submits; Shift+Enter inserts a newline
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitArg();
            }
        });

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'BATTLE') return;
            // while typing an argument, let the textarea own the keyboard
            if (!els.inputWrap.classList.contains('hidden')) return;
            if (awaitingContinue && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                advanceDialog();
                return;
            }
            if (!els.actionMenu.classList.contains('hidden')) {
                actionNav.handleKey(event);
            }
        });
    }

    /* ---------- helpers (preserved visual layer) ---------- */
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function say(msg) {
        els.text.textContent = msg;
    }

    function waitForClick() {
        return new Promise(resolve => {
            els.arrow.classList.remove('hidden');
            awaitingContinue = resolve;
        });
    }

    function advanceDialog() {
        if (!awaitingContinue) return;
        const fn = awaitingContinue;
        awaitingContinue = null;
        els.arrow.classList.add('hidden');
        fn();
    }

    function updateHp(side) {
        const c = side === 'player' ? player : enemy;
        const bar = side === 'player' ? els.playerHpBar : els.enemyHpBar;
        const pct = Math.max(0, c.hp / c.maxHp * 100);
        bar.style.width = pct + '%';
        if (pct > 50) bar.style.backgroundColor = 'var(--hp-green)';
        else if (pct > 20) bar.style.backgroundColor = 'var(--hp-yellow)';
        else bar.style.backgroundColor = 'var(--hp-red)';
        if (side === 'player') {
            els.playerHpText.textContent = Math.max(0, Math.ceil(c.hp)) + '/' + c.maxHp;
        }
    }

    function centerOf(el) {
        const s = els.scene.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
    }

    /* fly a glowing orb from attacker to target */
    function projectile(fromEl, toEl, color) {
        return new Promise(resolve => {
            const a = centerOf(fromEl);
            const b = centerOf(toEl);
            const orb = document.createElement('div');
            orb.className = 'spell-fx';
            orb.style.color = color;
            orb.style.left = (a.x - 8) + 'px';
            orb.style.top = (a.y - 8) + 'px';
            orb.style.transition = 'transform 0.35s linear, opacity 0.2s';
            els.fx.appendChild(orb);
            void orb.offsetWidth;
            orb.style.transform = `translate(${b.x - a.x}px, ${b.y - a.y}px)`;
            setTimeout(() => {
                orb.style.opacity = '0';
                setTimeout(() => orb.remove(), 200);
                resolve();
            }, 350);
        });
    }

    /* one-shot CSS class animation (shake / hit-flash); resolves after ms */
    function pulse(el, cls, ms) {
        return new Promise(resolve => {
            el.classList.remove(cls);
            void el.offsetWidth;
            el.classList.add(cls);
            setTimeout(() => {
                el.classList.remove(cls);
                resolve();
            }, ms);
        });
    }

    function flashScene(verdict) {
        const cls = 'flash-' + verdict;
        els.scene.classList.remove('flash-supported', 'flash-misleading', 'flash-unsupported');
        void els.scene.offsetWidth;
        els.scene.classList.add(cls);
        setTimeout(() => els.scene.classList.remove(cls), 650);
    }

    /* ---------- argument input ---------- */
    function askForText(placeholder) {
        return new Promise(resolve => {
            els.actionMenu.classList.add('hidden');
            els.citationBox.classList.add('hidden');
            els.arrow.classList.add('hidden');
            els.argInput.value = '';
            els.argInput.placeholder = placeholder || 'TYPE HERE...';
            els.inputWrap.classList.remove('hidden');
            els.submitBtn.disabled = false;
            argResolver = resolve;
            setTimeout(() => els.argInput.focus(), 30);
        });
    }

    function submitArg() {
        if (!argResolver) return;
        const val = els.argInput.value.trim();
        if (!val) {
            els.argInput.focus();
            return;
        }
        const fn = argResolver;
        argResolver = null;
        els.inputWrap.classList.add('hidden');
        els.submitBtn.disabled = true;
        fn(val);
    }

    /* ---------- citations (You.com sources) ---------- */
    function showCitations(citations) {
        lastCitations = Array.isArray(citations) ? citations.slice(0, 2) : [];
        els.citationBox.innerHTML = '';
        if (!lastCitations.length) {
            els.citationBox.classList.add('hidden');
            return;
        }
        const tag = document.createElement('div');
        tag.className = 'youcom-tag';
        tag.textContent = 'YOU.COM SOURCES';
        els.citationBox.appendChild(tag);

        lastCitations.forEach(c => {
            const title = document.createElement('span');
            title.className = 'citation-title';
            title.textContent = c.title || 'Source';
            els.citationBox.appendChild(title);

            if (c.url) {
                const dom = document.createElement('span');
                dom.className = 'citation-domain';
                let label = c.url;
                try { label = new URL(c.url).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
                dom.textContent = label;
                dom.addEventListener('click', () => window.open(c.url, '_blank', 'noopener'));
                els.citationBox.appendChild(dom);
            }
            if (c.snippet) {
                const snip = document.createElement('span');
                snip.className = 'citation-snippet';
                snip.textContent = c.snippet;
                els.citationBox.appendChild(snip);
            }
        });
        els.citationBox.classList.remove('hidden');
    }

    /* ---------- battle setup ---------- */
    function start(difficulty) {
        const save = Storage.load() || {};
        const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
        mappedDifficulty = cfg.backend;
        const enemyColor = Wizard.enemyColorFor(difficulty);

        player = {
            name: save.name || 'WIZARD',
            color: save.color || 'red',
            level: PLAYER_LEVEL,
            hp: START_HP,
            maxHp: START_HP
        };
        enemy = {
            name: 'IGRIS',
            color: enemyColor,
            level: cfg.level,
            hp: START_HP,
            maxHp: START_HP,
            dmgMult: cfg.dmgMult
        };

        roomId = null;
        round = 1;
        roundsTotal = 3;
        lastCitations = [];
        lastPlayerArg = '';

        // render wizards
        Wizard.applyColor(els.playerWizard, player.color);
        Wizard.applyColor(els.enemyWizard, enemy.color);
        els.playerWizard.classList.remove('fainted');
        els.enemyWizard.classList.remove('fainted');

        // HUD
        els.playerName.textContent = player.name;
        els.enemyName.textContent = enemy.name;
        els.playerLvl.textContent = 'Lv' + player.level;
        els.enemyLvl.textContent = 'Lv' + enemy.level;
        updateHp('player');
        updateHp('enemy');

        // reset UI
        els.actionMenu.classList.add('hidden');
        els.moveMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        els.citationBox.classList.add('hidden');
        els.arrow.classList.add('hidden');
        awaitingContinue = null;
        argResolver = null;
        busy = false;

        ScreenManager.show('BATTLE');
        beginDebate();
    }

    async function beginDebate() {
        say('The ' + enemy.name + ' bars your path. STATE YOUR CLAIM to begin the duel!');
        const topic = await askForText('STATE YOUR CLAIM...');

        say('Opening the arena around "' + topic + '"...');
        try {
            const data = await Api.createRoom({
                topic: topic,
                difficulty: mappedDifficulty,
                name: player.name
            });
            roomId = data && data.room && data.room.id;
            if (data && data.room && data.room.rounds_total) {
                roundsTotal = data.room.rounds_total;
            }
            if (!roomId) throw new Error('no room id');
        } catch (err) {
            say('The arcane connection wavered... try stating your claim again.');
            await waitForClick();
            return beginDebate();
        }

        say('You argue FOR. ' + enemy.name + ' argues AGAINST. ' + roundsTotal + ' rounds. Choose FIGHT to cast an argument!');
        await waitForClick();
        showActionMenu();
    }

    /* ---------- action menu ---------- */
    function showActionMenu() {
        els.moveMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        els.actionMenu.classList.remove('hidden');
        say('ROUND ' + round + ' of ' + roundsTotal + ' — what will ' + player.name + ' do?');
        actionNav.setItems(els.actionMenu.querySelectorAll('.menu-item'), 2);
    }

    function onAction(act) {
        if (busy) return;
        if (act === 'fight') {
            runRound();
        } else if (act === 'run') {
            els.actionMenu.classList.add('hidden');
            els.citationBox.classList.add('hidden');
            say(player.name + ' fled the debate...');
            waitForClick().then(() => ScreenManager.show('MENU'));
        } else if (act === 'pack') {
            // re-show the latest You.com citations
            els.actionMenu.classList.add('hidden');
            if (lastCitations.length) {
                showCitations(lastCitations);
                say('The last sources from You.com:');
            } else {
                say('No sources gathered yet. Cast an argument first!');
            }
            waitForClick().then(showActionMenu);
        } else {
            // WIZARD slot: show the duel status
            els.actionMenu.classList.add('hidden');
            say(player.name + ' Lv' + player.level + ' (' + Math.ceil(player.hp) + ' HP)  vs  '
                + enemy.name + ' Lv' + enemy.level + ' (' + Math.ceil(enemy.hp) + ' HP)');
            waitForClick().then(showActionMenu);
        }
    }

    /* ---------- a full round: player turn then wizard turn ---------- */
    async function runRound() {
        if (busy) return;
        busy = true;
        els.actionMenu.classList.add('hidden');
        els.citationBox.classList.add('hidden');

        // ----- PLAYER TURN -----
        say('Cast your argument FOR the claim...');
        const argument = await askForText('CAST YOUR ARGUMENT...');
        lastPlayerArg = argument;

        say('The crowd weighs your words...');
        let claim;
        try {
            const res = await Api.submitArgument(roomId, round, argument);
            claim = res && res.claim ? res.claim : res;
            showCitations((res && res.citations) || (claim && claim.citations) || []);
        } catch (err) {
            say('The arcane connection wavered... cast your argument again.');
            await waitForClick();
            busy = false;
            return showActionMenu();
        }

        await resolvePlayerVerdict(claim);
        if (enemy.hp <= 0) return endBattle();

        // ----- WIZARD TURN -----
        say(enemy.name + ' conjures a rebuttal...');
        let wzClaim;
        try {
            const res = await Api.advanceWizard(roomId, round, lastPlayerArg);
            wzClaim = res && res.claim ? res.claim : res;
            showCitations((res && res.citations) || (wzClaim && wzClaim.citations) || []);
        } catch (err) {
            // wizard turn failed: don't punish the player, just move on
            say('The ' + enemy.name + "'s spell sputtered out in the static...");
            await waitForClick();
            await advanceRound();
            return;
        }

        await resolveWizardVerdict(wzClaim);
        if (player.hp <= 0) return endBattle();

        await advanceRound();
    }

    async function advanceRound() {
        round++;
        busy = false;
        if (round > roundsTotal) {
            return endBattle();
        }
        showActionMenu();
    }

    /* ---------- verdict -> damage + animation (player casting) ---------- */
    async function resolvePlayerVerdict(claim) {
        const verdict = (claim && claim.verdict) || 'unsupported';
        const rationale = (claim && claim.rationale) || '';
        flashScene(verdict);

        if (verdict === 'supported') {
            const dmg = rand(22, 30);
            els.playerWizard.classList.add('lunge');
            const animP = Wizard.playState(els.playerWizard, 'attack', 700);
            await delay(200);
            els.playerWizard.classList.remove('lunge');
            await projectile(els.playerWizard, els.enemyWizard, CAST_COLOR);
            enemy.hp = Math.max(0, enemy.hp - dmg);
            updateHp('enemy');
            pulse(els.enemyWizard, 'hit-flash', 320);
            await Wizard.playState(els.enemyWizard, 'hurt', 360);
            await animP;
            say('SUPPORTED! Your spell strikes for ' + dmg + '! ' + rationale);
        } else if (verdict === 'misleading') {
            // BACKFIRE on the player
            const dmg = rand(18, 26);
            await projectile(els.playerWizard, els.playerWizard, FIZZLE_COLOR);
            player.hp = Math.max(0, player.hp - dmg);
            updateHp('player');
            await Promise.all([
                pulse(els.playerWizard, 'shake', 400),
                Wizard.playState(els.playerWizard, 'hurt', 360)
            ]);
            say('MISLEADING! Your claim was misleading and backfires for ' + dmg + '! ' + rationale);
        } else {
            // unsupported -> fizzle, tiny/no damage
            const dmg = rand(0, 8);
            const animP = Wizard.playState(els.playerWizard, 'attack', 500);
            await projectile(els.playerWizard, els.enemyWizard, FIZZLE_COLOR);
            if (dmg > 0) {
                enemy.hp = Math.max(0, enemy.hp - dmg);
                updateHp('enemy');
            }
            await animP;
            say('UNSUPPORTED — your claim fizzled (' + dmg + '). ' + rationale);
        }
        await waitForClick();
    }

    /* ---------- verdict -> damage + animation (wizard casting) ---------- */
    async function resolveWizardVerdict(claim) {
        const verdict = (claim && claim.verdict) || 'unsupported';
        const rationale = (claim && claim.rationale) || '';
        const taunt = (claim && claim.taunt) || '';
        flashScene(verdict);

        if (taunt) {
            say(enemy.name + ': "' + taunt + '"');
            await waitForClick();
        }

        if (verdict === 'supported') {
            let dmg = Math.round(rand(22, 30) * enemy.dmgMult);
            els.enemyWizard.classList.add('lunge');
            const animP = Wizard.playState(els.enemyWizard, 'attack', 700);
            await delay(200);
            els.enemyWizard.classList.remove('lunge');
            await projectile(els.enemyWizard, els.playerWizard, CAST_COLOR);
            player.hp = Math.max(0, player.hp - dmg);
            updateHp('player');
            pulse(els.playerWizard, 'hit-flash', 320);
            await Wizard.playState(els.playerWizard, 'hurt', 360);
            await animP;
            say('SUPPORTED! ' + enemy.name + ' lands ' + dmg + ' on you! ' + rationale);
        } else if (verdict === 'misleading') {
            // THE WIZARD WAS CAUGHT — backfire on the enemy (money shot)
            const dmg = rand(18, 26);
            await projectile(els.enemyWizard, els.enemyWizard, FIZZLE_COLOR);
            enemy.hp = Math.max(0, enemy.hp - dmg);
            updateHp('enemy');
            await Promise.all([
                pulse(els.enemyWizard, 'shake', 400),
                Wizard.playState(els.enemyWizard, 'hurt', 360)
            ]);
            say('THE WIZARD WAS CAUGHT! Misleading claim backfires for ' + dmg + '! ' + rationale);
        } else {
            const dmg = Math.round(rand(0, 8) * enemy.dmgMult);
            const animP = Wizard.playState(els.enemyWizard, 'attack', 500);
            await projectile(els.enemyWizard, els.playerWizard, FIZZLE_COLOR);
            if (dmg > 0) {
                player.hp = Math.max(0, player.hp - dmg);
                updateHp('player');
            }
            await animP;
            say(enemy.name + "'s claim was UNSUPPORTED — it fizzles (" + dmg + '). ' + rationale);
        }
        await waitForClick();
    }

    /* ---------- end ---------- */
    async function endBattle() {
        busy = true;
        els.actionMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        els.citationBox.classList.add('hidden');

        let playerWon;
        if (player.hp <= 0 && enemy.hp <= 0) playerWon = player.hp >= enemy.hp;
        else if (enemy.hp <= 0) playerWon = true;
        else if (player.hp <= 0) playerWon = false;
        else playerWon = player.hp >= enemy.hp; // ran out of rounds -> higher HP wins

        const loserEl = playerWon ? els.enemyWizard : els.playerWizard;
        const loser = playerWon ? enemy : player;
        Wizard.playState(loserEl, 'dead', 600);
        loserEl.classList.add('fainted');
        say(loser.name + ' is out of arguments!');
        await delay(900);

        say(playerWon
            ? player.name + ' WON the debate with ' + Math.max(0, Math.ceil(player.hp)) + ' HP!'
            : player.name + ' was out-argued by ' + enemy.name + '...');
        await waitForClick();

        // record the match for the leaderboard (best-effort)
        try {
            await Api.recordMatch({
                name: player.name,
                won: playerWon,
                score: Math.max(0, Math.ceil(player.hp))
            });
        } catch (e) { /* leaderboard is best-effort; never block on it */ }

        offerNext(playerWon);
    }

    function offerNext(playerWon) {
        els.actionMenu.classList.add('hidden');
        els.moveMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');

        // Repurpose the action menu as a 2-option end screen.
        const menu = els.actionMenu;
        menu.innerHTML = '';
        const again = document.createElement('div');
        again.className = 'menu-item';
        again.textContent = 'PLAY AGAIN';
        const board = document.createElement('div');
        board.className = 'menu-item';
        board.textContent = 'LEADERBOARD';

        again.addEventListener('click', event => {
            event.stopPropagation();
            restoreActionMenu();
            ScreenManager.show('MENU');
        });
        board.addEventListener('click', event => {
            event.stopPropagation();
            restoreActionMenu();
            ScreenManager.show('LEADERBOARD');
        });
        menu.appendChild(again);
        menu.appendChild(board);

        say(playerWon ? 'A masterful duel. What now?' : 'The wizard stands triumphant. What now?');
        menu.classList.remove('hidden');
        actionNav.setItems(menu.querySelectorAll('.menu-item'), 2);
    }

    /* rebuild the original FIGHT/WIZARD/PACK/RUN action menu after the end screen */
    function restoreActionMenu() {
        busy = false;
        const menu = els.actionMenu;
        menu.classList.add('hidden');
        menu.innerHTML = '';
        const opts = [
            { act: 'fight', label: 'FIGHT' },
            { act: 'pkmn', label: 'WIZARD' },
            { act: 'pack', label: 'PACK' },
            { act: 'run', label: 'RUN' }
        ];
        opts.forEach(o => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.dataset.act = o.act;
            div.textContent = o.label;
            div.addEventListener('click', event => {
                event.stopPropagation();
                onAction(o.act);
            });
            menu.appendChild(div);
        });
    }

    return { init, start };
})();
