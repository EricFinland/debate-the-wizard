/* ========================================
   Battle - turn-based wizard duel (player vs bot)
   ======================================== */

const Battle = (() => {
    /* --- spell definitions --- */
    const MOVES = {
        fireball:   { name: 'FIREBALL',   min: 18, max: 26, color: '#ff7a2e', heal: false },
        frost:      { name: 'FROST SHARD', min: 14, max: 20, color: '#5ad6ff', heal: false },
        arcane:     { name: 'ARCANE BOLT', min: 16, max: 24, color: '#b06bff', heal: false },
        heal:       { name: 'HEAL',        min: 18, max: 26, color: '#5ad66b', heal: true }
    };
    const MOVE_ORDER = ['fireball', 'frost', 'arcane', 'heal'];

    /* --- difficulty tuning (cosmetic color comes from Wizard.enemyColorFor) --- */
    const DIFFICULTY = {
        easy:       { label: 'EASY',       hp: 70,  dmgMult: 0.7, level: 3,  smart: false, fumble: 0.25 },
        medium:     { label: 'MEDIUM',     hp: 95,  dmgMult: 1.0, level: 6,  smart: false, fumble: 0.10 },
        hard:       { label: 'HARD',       hp: 115, dmgMult: 1.2, level: 9,  smart: true,  fumble: 0.05 },
        impossible: { label: 'IMPOSSIBLE', hp: 150, dmgMult: 1.6, level: 13, smart: true,  fumble: 0.0 }
    };

    const PLAYER_MAX_HP = 100;
    const PLAYER_LEVEL = 5;

    let player = null;
    let enemy = null;
    let busy = false;
    let awaitingContinue = null; // resolver fn while waiting for a click
    let actionNav = null;
    let moveNav = null;

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
            moveMenu: document.getElementById('move-menu')
        };
        actionNav = KeyboardNav.create({ columns: 2 });
        moveNav = KeyboardNav.create({ columns: 2 });

        // action menu buttons
        els.actionMenu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', event => {
                event.stopPropagation();
                onAction(item.dataset.act);
            });
        });

        // click to advance when a message is waiting
        els.dialog.addEventListener('click', () => {
            advanceDialog();
        });

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'BATTLE') return;
            if (awaitingContinue && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                advanceDialog();
                return;
            }
            if (!els.actionMenu.classList.contains('hidden') && actionNav.handleKey(event)) return;
            if (!els.moveMenu.classList.contains('hidden')) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    showActionMenu();
                    return;
                }
                moveNav.handleKey(event);
            }
        });
    }

    /* ---------- helpers ---------- */
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

    /* ---------- battle setup ---------- */
    function start(difficulty) {
        const save = Storage.load() || {};
        const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
        const enemyColor = Wizard.enemyColorFor(difficulty);

        player = {
            name: save.name || 'WIZARD',
            color: save.color || 'red',
            level: PLAYER_LEVEL,
            hp: PLAYER_MAX_HP,
            maxHp: PLAYER_MAX_HP
        };
        enemy = {
            name: 'IGRIS',
            color: enemyColor,
            level: cfg.level,
            hp: cfg.hp,
            maxHp: cfg.hp,
            dmgMult: cfg.dmgMult,
            smart: cfg.smart,
            fumble: cfg.fumble
        };

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
        els.arrow.classList.add('hidden');
        awaitingContinue = null;
        busy = false;

        ScreenManager.show('BATTLE');

        say('A wild ' + enemy.name + ' appears!');
        waitForClick().then(showActionMenu);
    }

    /* ---------- player turn ---------- */
    function showActionMenu() {
        els.moveMenu.classList.add('hidden');
        els.actionMenu.classList.remove('hidden');
        say('What will ' + player.name + ' do?');
        actionNav.setItems(els.actionMenu.querySelectorAll('.menu-item'), 2);
    }

    function onAction(act) {
        if (busy) return;
        if (act === 'fight') {
            showMoveMenu();
        } else if (act === 'run') {
            els.actionMenu.classList.add('hidden');
            say(player.name + ' fled the duel...');
            waitForClick().then(() => ScreenManager.show('MENU'));
        } else {
            // WIZARD / PACK kept from the original layout, not wired yet
            els.actionMenu.classList.add('hidden');
            say('Not available yet.');
            waitForClick().then(showActionMenu);
        }
    }

    function showMoveMenu() {
        els.actionMenu.classList.add('hidden');
        els.moveMenu.classList.remove('hidden');
        els.moveMenu.innerHTML = '';
        MOVE_ORDER.forEach(key => {
            const div = document.createElement('div');
            div.className = 'move-item';
            div.textContent = MOVES[key].name;
            div.addEventListener('click', event => {
                event.stopPropagation();
                playerMove(key);
            });
            els.moveMenu.appendChild(div);
        });
        const back = document.createElement('div');
        back.className = 'move-back';
        back.textContent = '◀ BACK';
        back.addEventListener('click', event => {
            event.stopPropagation();
            showActionMenu();
        });
        els.moveMenu.appendChild(back);
        moveNav.setItems(els.moveMenu.querySelectorAll('.move-item, .move-back'), 2);
    }

    async function playerMove(key) {
        if (busy) return;
        busy = true;
        els.moveMenu.classList.add('hidden');
        await performMove('player', key);
        if (enemy.hp <= 0) return endBattle(true);
        await enemyTurn();
        if (player.hp <= 0) return endBattle(false);
        busy = false;
        showActionMenu();
    }

    /* ---------- enemy turn (AI scaled by difficulty) ---------- */
    async function enemyTurn() {
        let key;
        if (Math.random() < enemy.fumble) {
            say(enemy.name + ' fumbled its spell!');
            await Wizard.playState(els.enemyWizard, 'hurt', 360);
            await delay(500);
            return;
        }
        if (enemy.smart && enemy.hp < enemy.maxHp * 0.3 && Math.random() < 0.7) {
            key = 'heal';
        } else {
            const attacks = ['fireball', 'frost', 'arcane'];
            key = attacks[rand(0, attacks.length - 1)];
        }
        await performMove('enemy', key);
    }

    /* ---------- shared move resolution ---------- */
    async function performMove(side, key) {
        const move = MOVES[key];
        const isPlayer = side === 'player';
        const attacker = isPlayer ? player : enemy;
        const target = isPlayer ? enemy : player;
        const attackerEl = isPlayer ? els.playerWizard : els.enemyWizard;
        const targetEl = isPlayer ? els.enemyWizard : els.playerWizard;

        say(attacker.name + ' used ' + move.name + '!');

        attackerEl.classList.add('lunge');
        const animP = Wizard.playState(attackerEl, 'attack', 700);
        await delay(220);
        attackerEl.classList.remove('lunge');

        if (move.heal) {
            await animP;
            const amount = rand(move.min, move.max);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount);
            updateHp(side);
            say(attacker.name + ' restored ' + amount + ' HP!');
            await delay(700);
            return;
        }

        await projectile(attackerEl, targetEl, move.color);

        let dmg = rand(move.min, move.max);
        if (!isPlayer) dmg = Math.round(dmg * attacker.dmgMult);
        const crit = Math.random() < 0.1;
        if (crit) dmg = Math.round(dmg * 1.5);

        target.hp = Math.max(0, target.hp - dmg);
        updateHp(isPlayer ? 'enemy' : 'player');
        await Wizard.playState(targetEl, 'hurt', 360);
        await animP;

        say(crit ? 'A critical hit! ' + dmg + ' damage!' : target.name + ' took ' + dmg + ' damage!');
        await delay(750);
    }

    /* ---------- end ---------- */
    async function endBattle(playerWon) {
        const loserEl = playerWon ? els.enemyWizard : els.playerWizard;
        const loser = playerWon ? enemy : player;
        Wizard.playState(loserEl, 'dead', 600);
        loserEl.classList.add('fainted');
        say(loser.name + ' fainted!');
        await delay(900);

        say(playerWon
            ? player.name + ' won the duel!'
            : player.name + ' was defeated...');
        await waitForClick();
        busy = false;
        ScreenManager.show('MENU');
    }

    return { init, start };
})();
