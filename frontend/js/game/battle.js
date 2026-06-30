/* ========================================
   Battle - debate-driven wizard duel (player vs the wizard)
   Powered by the live You.com + Claude backend via window.Api.
   HP = debate score. Player argues FOR the claim; the wizard argues AGAINST.
   Visual helpers (projectile, updateHp, say, waitForClick, centerOf, HP color
   thresholds) are preserved from the original combat prototype.
   ======================================== */

const Battle = (() => {
    const config = window.AppConfig;
    if (!config || !config.difficulties) {
        throw new Error('Battle configuration missing: load js/config.js before js/game/battle.js');
    }

    const DIFFICULTY = config.difficulties;

    const START_HP = 100;
    const PLAYER_LEVEL = 5;

    /* pool of wizard names; one is picked at random per battle */
    const ENEMY_NAMES = [
        'IGRIS', 'MALGOR', 'ZYREN', 'VEXIS', 'NOCTUA',
        'GRIMWALD', 'SABLE', 'PYRRHA', 'KORVUS', 'THESSA'
    ];

    /* spell tint per verdict (reuse projectile FX) */
    const CAST_COLOR = '#b06bff';      // supported -> arcane bolt
    const FIZZLE_COLOR = '#9a9a9a';    // unsupported -> weak grey

    /* curated debatable topics for the "RANDOMIZE" flow.
       claim = the FOR position, counter = the AGAINST position. */
    const TOPICS = [
        { claim: 'Nuclear energy is the best tool we have for fighting climate change.',
          counter: 'Nuclear energy is not the best tool for fighting climate change.' },
        { claim: 'Cities should prioritize public transit over private cars.',
          counter: 'Cities should not prioritize public transit over private cars.' },
        { claim: 'AI should be heavily regulated by governments.',
          counter: 'AI should not be heavily regulated by governments.' },
        { claim: 'Social media should have a minimum age of 16.',
          counter: 'Social media should not have a minimum age of 16.' },
        { claim: 'Remote work makes companies more productive.',
          counter: 'Remote work does not make companies more productive.' },
        { claim: 'Space exploration deserves more public funding.',
          counter: 'Space exploration does not deserve more public funding.' },
        { claim: 'A four-day work week would benefit the economy.',
          counter: 'A four-day work week would not benefit the economy.' },
        { claim: 'College education should be free for everyone.',
          counter: 'College education should not be free for everyone.' },
        { claim: 'Electric vehicles are better for the planet than gas cars.',
          counter: 'Electric vehicles are not better for the planet than gas cars.' },
        { claim: 'Universal basic income would reduce poverty.',
          counter: 'Universal basic income would not reduce poverty.' }
    ];

    let player = null;
    let enemy = null;
    let busy = false;
    let awaitingContinue = null; // resolver fn while waiting for a click

    // debate state
    let roomId = null;
    let round = 1;
    let roundsTotal = 3;
    let mappedDifficulty = DIFFICULTY.medium.backend;
    let lastCitations = [];      // citations from the most recent turn (for PACK)
    let lastPlayerArg = '';      // fed to the wizard turn as opponent_argument
    let argResolver = null;      // resolver while waiting on the text input
    let creatingRoom = false;    // prevents duplicate room creation requests

    // latest round result, rendered into #round-result for both sides
    let roundResult = { player: null, wizard: null };

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
            playerTopic: document.getElementById('player-topic'),
            enemyTopic: document.getElementById('enemy-topic'),
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
            // citations now live in the side panel (shared DOM contract)
            sideCitations: document.getElementById('side-citations'),
            // legacy in-dialog citation box may no longer exist
            citationBox: document.getElementById('citation-box'),
            // pick-for-me flow
            pickForMe: document.getElementById('pick-for-me'),
            sidePicker: document.getElementById('side-picker'),
            sideFor: document.getElementById('side-for'),
            sideAgainst: document.getElementById('side-against'),
            // persistent stance reminder + tidy round result
            stanceBanner: document.getElementById('stance-banner'),
            roundResult: document.getElementById('round-result')
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
            // Enter submits the one-line argument input.
            if (event.key === 'Enter') {
                event.preventDefault();
                submitArg();
            }
        });

        // pick-for-me: reveal the side-picker with a random curated topic
        if (els.pickForMe) {
            els.pickForMe.addEventListener('click', event => {
                event.stopPropagation();
                openSidePicker();
            });
        }
        // choosing a side immediately starts the duel (no typing needed)
        if (els.sideFor) {
            els.sideFor.addEventListener('click', event => {
                event.stopPropagation();
                chooseSide('for');
            });
        }
        if (els.sideAgainst) {
            els.sideAgainst.addEventListener('click', event => {
                event.stopPropagation();
                chooseSide('against');
            });
        }

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
        const lvlEl = side === 'player' ? els.playerLvl : els.enemyLvl;
        const pct = Math.max(0, c.hp / c.maxHp * 100);
        bar.style.width = pct + '%';
        if (pct > 50) bar.style.backgroundColor = 'var(--hp-green)';
        else if (pct > 20) bar.style.backgroundColor = 'var(--hp-yellow)';
        else bar.style.backgroundColor = 'var(--hp-red)';
        // second HUD line shows the health percentage (no level / no x/yy line)
        if (lvlEl) lvlEl.textContent = '(' + Math.round(pct) + '%)';
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
            hideLegacyCitationBox();
            hideRoundResult();
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

    /* ---------- citations (You.com sources) ----------
       Citations render into the side panel (#side-citations) now, NOT the dialog.
       Newest sources are prepended so the most recent turn sits on top. The
       dialog only narrates the verdict; the big source dump lives to the right. */
    function showCitations(citations) {
        const fresh = Array.isArray(citations) ? citations.slice(0, 2) : [];
        lastCitations = fresh; // PACK / status still reference the latest turn
        const list = els.sideCitations;
        if (!list) return;
        if (!fresh.length) return; // keep prior sources on screen if this turn had none

        // build the group for this turn, newest-on-top
        const group = document.createElement('div');
        group.className = 'side-citation-group';

        fresh.forEach(c => {
            const item = document.createElement('div');
            item.className = 'side-citation';

            const title = document.createElement('span');
            title.className = 'citation-title';
            title.textContent = c.title || 'Source';
            item.appendChild(title);

            if (c.url) {
                const dom = document.createElement('span');
                dom.className = 'citation-domain';
                let label = c.url;
                try { label = new URL(c.url).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
                dom.textContent = label;
                dom.addEventListener('click', () => window.open(c.url, '_blank', 'noopener'));
                item.appendChild(dom);
            }
            if (c.snippet) {
                const snip = document.createElement('span');
                snip.className = 'citation-snippet';
                snip.textContent = c.snippet;
                item.appendChild(snip);

                if (String(c.snippet).length > 120) {
                    const more = document.createElement('button');
                    more.className = 'citation-more';
                    more.type = 'button';
                    more.textContent = 'See More...';
                    more.addEventListener('click', event => {
                        event.stopPropagation();
                        const expanded = item.classList.toggle('is-expanded');
                        more.textContent = expanded ? 'Show Less' : 'See More...';
                    });
                    item.appendChild(more);
                }
            }
            group.appendChild(item);
        });

        // newest on top + scroll to it
        list.insertBefore(group, list.firstChild);
        list.scrollTop = 0;
    }

    /* clear the side panel sources (called on a fresh duel) */
    function clearSideCitations() {
        if (els.sideCitations) els.sideCitations.innerHTML = '';
    }

    /* hide the legacy in-dialog citation box if it still exists */
    function hideLegacyCitationBox() {
        if (els.citationBox) els.citationBox.classList.add('hidden');
    }

    /* ---------- topic reminder beside HUD names ---------- */
    function showTopicInHud(topic) {
        const label = topic ? '[' + topic + ']' : '';
        if (els.playerTopic) {
            els.playerTopic.textContent = label;
            els.playerTopic.title = topic || '';
        }
        if (els.enemyTopic) {
            els.enemyTopic.textContent = label;
            els.enemyTopic.title = topic || '';
        }
        hideStanceBanner();
    }

    function hideStanceBanner() {
        if (els.stanceBanner) els.stanceBanner.classList.add('hidden');
    }

    /* ---------- clean round-result UI (both sides, color-coded) ----------
       roundResult.player / .wizard each: { verdict, rationale, claimText, dmgDealt, dmgTaken } */
    const VERDICT_LABEL = {
        supported: 'SUPPORTED',
        misleading: 'MISLEADING',
        unsupported: 'UNSUPPORTED'
    };

    function shortClaim(claim) {
        const t = (claim && (claim.key_claim || claim.claim || claim.argument)) || '';
        const s = String(t).trim();
        if (s.length <= 140) return s;
        return s.slice(0, 137).replace(/\s+\S*$/, '') + '...';
    }

    function buildResultRow(who, data) {
        const verdict = (data && data.verdict) || 'unsupported';
        const row = document.createElement('div');
        row.className = 'rr-row rr-' + verdict;

        const head = document.createElement('div');
        head.className = 'rr-head';

        const side = document.createElement('span');
        side.className = 'rr-side';
        side.textContent = who;
        head.appendChild(side);

        const pill = document.createElement('span');
        pill.className = 'rr-pill rr-pill-' + verdict;
        pill.textContent = VERDICT_LABEL[verdict] || verdict.toUpperCase();
        head.appendChild(pill);

        if (typeof data.dmg === 'number' && data.dmg > 0) {
            const dmg = document.createElement('span');
            dmg.className = 'rr-dmg rr-dmg-' + (data.dmgTo === 'self' ? 'taken' : 'dealt');
            dmg.textContent = (data.dmgTo === 'self' ? 'TOOK ' : 'DEALT ') + data.dmg;
            head.appendChild(dmg);
        }
        row.appendChild(head);

        if (data.claimText) {
            const ct = document.createElement('div');
            ct.className = 'rr-claim';
            ct.textContent = '"' + data.claimText + '"';
            row.appendChild(ct);
        }
        if (data.rationale) {
            const ra = document.createElement('div');
            ra.className = 'rr-rationale';
            ra.textContent = data.rationale;
            row.appendChild(ra);
        }
        return row;
    }

    function renderRoundResult() {
        const box = els.roundResult;
        if (!box) return;
        box.innerHTML = '';

        const title = document.createElement('div');
        title.className = 'rr-title';
        title.textContent = 'ROUND ' + round + ' RESULT';
        box.appendChild(title);

        if (roundResult.player) {
            box.appendChild(buildResultRow('YOU', roundResult.player));
        }
        if (roundResult.wizard) {
            box.appendChild(buildResultRow(enemy.name, roundResult.wizard));
        }
        box.classList.remove('hidden');
    }

    function hideRoundResult() {
        if (els.roundResult) els.roundResult.classList.add('hidden');
    }

    /* ---------- battle setup ---------- */
    function start(difficulty) {
        const save = Storage.load() || {};
        const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
        mappedDifficulty = cfg.backend;
        const enemyColor = Wizard.enemyColorFor(difficulty);

        player = {
            name: save.name || 'WIZARD',
            color: save.color || config.wizardColors[0],
            level: PLAYER_LEVEL,
            hp: START_HP,
            maxHp: START_HP
        };
        enemy = {
            name: ENEMY_NAMES[rand(0, ENEMY_NAMES.length - 1)],
            color: enemyColor,
            level: cfg.level,
            hp: START_HP,
            maxHp: START_HP,
            damageMultiplier: cfg.damageMultiplier
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
        showTopicInHud('');
        updateHp('player'); // sets the (NN%) on the second HUD line
        updateHp('enemy');

        // reset UI
        els.actionMenu.classList.add('hidden');
        els.moveMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        hideLegacyCitationBox();
        hideSidePicker();
        clearSideCitations();
        hideStanceBanner();
        hideRoundResult();
        els.arrow.classList.add('hidden');
        awaitingContinue = null;
        argResolver = null;
        busy = false;
        creatingRoom = false;

        ScreenManager.show('BATTLE');
        beginDebate();
    }

    async function beginDebate() {
        say('The ' + enemy.name + ' bars your path. STATE YOUR CLAIM to begin the duel!');
        // The input wrap exposes a "RANDOMIZE" button alongside CAST; either a
        // typed claim or a picked side funnels into launchDuel().
        const topic = await askForText('STATE YOUR CLAIM...');
        await launchDuel(topic);
    }

    /* shared duel-start path: open the room for `topic` then drop into the
       action menu. Used by both the typed claim and the pick-for-me side. */
    async function launchDuel(topic) {
        if (creatingRoom) return;
        creatingRoom = true;
        hideSidePicker();
        els.inputWrap.classList.add('hidden');
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
            creatingRoom = false;
            if (err && err.status === 429) {
                say('The arena is overloaded. Wait a moment before stating your claim again.');
                await delay(2500);
                await waitForClick();
                return beginDebate();
            }
            say('The magic connection wavered... try stating your claim again.');
            await waitForClick();
            return beginDebate();
        }
        creatingRoom = false;

        showTopicInHud(topic);

        say('You argue FOR. ' + enemy.name + ' argues AGAINST. ' + roundsTotal + ' rounds. Choose FIGHT to cast an argument!');
        await waitForClick();
        showActionMenu();
    }

    /* ---------- pick-for-me flow ---------- */
    let pickedTopic = null; // { claim, counter } currently shown in the side-picker

    function openSidePicker() {
        // only meaningful while we're waiting for the opening claim
        if (!argResolver) return;
        const topic = TOPICS[rand(0, TOPICS.length - 1)];
        pickedTopic = topic;
        if (els.sideFor) els.sideFor.textContent = 'FOR: ' + topic.claim;
        if (els.sideAgainst) els.sideAgainst.textContent = 'AGAINST: ' + topic.counter;
        if (els.sidePicker) els.sidePicker.classList.remove('hidden');
        say('Pick a side to duel instantly, or type your own claim.');
    }

    function hideSidePicker() {
        if (els.sidePicker) els.sidePicker.classList.add('hidden');
    }

    function chooseSide(side) {
        if (!pickedTopic) return;
        const topic = side === 'against' ? pickedTopic.counter : pickedTopic.claim;
        pickedTopic = null;
        hideSidePicker();
        // we're done waiting for a typed claim; consume the resolver cleanly
        if (argResolver) {
            const fn = argResolver;
            argResolver = null;
            els.inputWrap.classList.add('hidden');
            els.submitBtn.disabled = true;
            // resolve the askForText promise; beginDebate() will launch the duel
            fn(topic);
        } else {
            // resolver already gone (defensive) — launch directly
            launchDuel(topic);
        }
    }

    /* ---------- action menu ---------- */
    function showActionMenu() {
        els.moveMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        hideRoundResult();
        els.actionMenu.classList.remove('hidden');
        say('ROUND ' + round + ' of ' + roundsTotal + ' — what will ' + player.name + ' do?');
        actionNav.setItems(els.actionMenu.querySelectorAll('.menu-item'), 2);
    }

    function onAction(act) {
        if (busy) return;
        if (act === 'fight') {
            runRound();
        } else if (act === 'run') {
            // leave the duel and return to the title screen
            els.actionMenu.classList.add('hidden');
            hideLegacyCitationBox();
            say(player.name + ' fled the debate...');
            waitForClick().then(() => ScreenManager.show('MAIN_MENU'));
        } else if (act === 'pack') {
            // sources now live in the side panel; point the player there
            els.actionMenu.classList.add('hidden');
            if (lastCitations.length) {
                say('Your You.com sources are in the panel on the right.');
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
        hideLegacyCitationBox();
        // fresh result for this round
        roundResult = { player: null, wizard: null };
        hideRoundResult();

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
            say('The magic connection wavered... cast your argument again.');
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

        let dmg = 0;
        let dmgTo = 'enemy';
        if (verdict === 'supported') {
            dmg = rand(22, 30);
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
            dmg = rand(18, 26);
            dmgTo = 'self';
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
            dmg = rand(0, 8);
            const animP = Wizard.playState(els.playerWizard, 'attack', 500);
            await projectile(els.playerWizard, els.enemyWizard, FIZZLE_COLOR);
            if (dmg > 0) {
                enemy.hp = Math.max(0, enemy.hp - dmg);
                updateHp('enemy');
            }
            await animP;
            say('UNSUPPORTED — your claim fizzled (' + dmg + '). ' + rationale);
        }

        roundResult.player = {
            verdict: verdict,
            rationale: rationale,
            claimText: shortClaim({ key_claim: claim && claim.key_claim, argument: lastPlayerArg }),
            dmg: dmg,
            dmgTo: dmgTo
        };
        renderRoundResult();
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

        let dmg = 0;
        let dmgTo = 'player';
        if (verdict === 'supported') {
            dmg = Math.round(rand(22, 30) * enemy.damageMultiplier);
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
            dmg = rand(18, 26);
            dmgTo = 'self';
            await projectile(els.enemyWizard, els.enemyWizard, FIZZLE_COLOR);
            enemy.hp = Math.max(0, enemy.hp - dmg);
            updateHp('enemy');
            await Promise.all([
                pulse(els.enemyWizard, 'shake', 400),
                Wizard.playState(els.enemyWizard, 'hurt', 360)
            ]);
            say('THE WIZARD WAS CAUGHT! Misleading claim backfires for ' + dmg + '! ' + rationale);
        } else {
            dmg = Math.round(rand(0, 8) * enemy.damageMultiplier);
            const animP = Wizard.playState(els.enemyWizard, 'attack', 500);
            await projectile(els.enemyWizard, els.playerWizard, FIZZLE_COLOR);
            if (dmg > 0) {
                player.hp = Math.max(0, player.hp - dmg);
                updateHp('player');
            }
            await animP;
            say(enemy.name + "'s claim was UNSUPPORTED — it fizzles (" + dmg + '). ' + rationale);
        }

        roundResult.wizard = {
            verdict: verdict,
            rationale: rationale,
            claimText: shortClaim(claim),
            dmg: dmg,
            // wizard "self" damage was taken by the enemy; otherwise dealt to player
            dmgTo: dmgTo === 'self' ? 'self' : 'enemy'
        };
        renderRoundResult();
        await waitForClick();
    }

    /* ---------- end ---------- */
    async function endBattle() {
        busy = true;
        els.actionMenu.classList.add('hidden');
        els.inputWrap.classList.add('hidden');
        hideLegacyCitationBox();
        hideRoundResult();

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
