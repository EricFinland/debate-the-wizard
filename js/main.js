/* ========================================
   Main - boot + main menu wiring + account screen
   ======================================== */

(function () {
    /*
     * ScreenManager.IDS has no ACCOUNT entry and we don't own screen-manager.js.
     * IDS is a live object reference, so we register ACCOUNT at runtime: this
     * makes ScreenManager.show('ACCOUNT') work natively (hides every screen,
     * shows #account-screen, fires onShow listeners). registerAccountScreen()
     * returns true on success; showAccount() falls back to a manual .hidden
     * toggle if registration ever fails, so the screen is always reachable.
     */
    function registerAccountScreen() {
        try {
            if (ScreenManager && ScreenManager.IDS && !ScreenManager.IDS.ACCOUNT) {
                ScreenManager.IDS.ACCOUNT = 'account-screen';
            }
            return !!(ScreenManager && ScreenManager.IDS && ScreenManager.IDS.ACCOUNT);
        } catch (e) {
            return false;
        }
    }

    function showAccount() {
        if (registerAccountScreen()) {
            ScreenManager.show('ACCOUNT');
            return;
        }
        // Fallback: manual toggle if ScreenManager couldn't take the new id.
        document.querySelectorAll('.screen').forEach(function (el) {
            el.classList.add('hidden');
        });
        var acct = document.getElementById('account-screen');
        if (acct) acct.classList.remove('hidden');
        renderAccount();
    }

    /* ---------- ACCOUNT screen rendering + wiring ---------- */

    function setAcctError(msg) {
        var err = document.getElementById('acct-error');
        if (!err) return;
        if (msg) {
            err.textContent = String(msg).toUpperCase();
            err.classList.remove('hidden');
        } else {
            err.textContent = '';
            err.classList.add('hidden');
        }
    }

    function renderAccount() {
        var loggedOut = document.getElementById('acct-loggedout');
        var loggedIn = document.getElementById('acct-loggedin');
        var emailDisplay = document.getElementById('acct-email-display');
        var rankNote = document.getElementById('acct-rank-note');
        setAcctError('');

        // Optimistic render from cache, then refresh from the SDK.
        function paint(user) {
            if (user) {
                if (loggedOut) loggedOut.classList.add('hidden');
                if (loggedIn) loggedIn.classList.remove('hidden');
                if (emailDisplay) emailDisplay.textContent = (user.email || user.name || 'PLAYER');
                if (rankNote) {
                    rankNote.textContent = user.emailVerified
                        ? 'OAUTH VERIFIED - YOU CAN RANK ON THE LEADERBOARD'
                        : 'EMAIL ACCOUNT - SIGN IN WITH OAUTH TO RANK';
                }
            } else {
                if (loggedIn) loggedIn.classList.add('hidden');
                if (loggedOut) loggedOut.classList.remove('hidden');
            }
        }

        if (window.Auth) {
            paint(Auth.getCachedUser());
            Auth.getUser(true).then(paint).catch(function () { paint(null); });
        } else {
            paint(null);
        }
    }

    function initAccount() {
        registerAccountScreen();
        try { ScreenManager.onShow('ACCOUNT', renderAccount); } catch (e) { /* ignore */ }

        var emailEl = document.getElementById('acct-email');
        var passEl = document.getElementById('acct-password');
        var loginBtn = document.getElementById('acct-login');
        var signupBtn = document.getElementById('acct-signup');
        var googleBtn = document.getElementById('acct-google');
        var githubBtn = document.getElementById('acct-github');
        var signoutBtn = document.getElementById('acct-signout');
        var guestBtn = document.getElementById('acct-guest');

        function creds() {
            return {
                email: (emailEl && emailEl.value || '').trim(),
                password: (passEl && passEl.value || '')
            };
        }

        function busy(btn, on, label) {
            if (!btn) return;
            if (on) {
                btn._label = btn.textContent;
                btn.textContent = label || '...';
                btn.classList.add('disabled');
            } else {
                if (btn._label) btn.textContent = btn._label;
                btn.classList.remove('disabled');
            }
        }

        function afterAuth(user) {
            // Mirror the account name into Storage so the rest of the game
            // (battle HUD, leaderboard highlight) picks it up. Never overwrite
            // an existing chosen name with nothing.
            if (user && user.name) {
                try { Storage.save({ name: String(user.name).slice(0, 8).toUpperCase() }); } catch (e) {}
            }
            renderAccount();
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', function () {
                if (!window.Auth) { setAcctError('AUTH UNAVAILABLE'); return; }
                var c = creds();
                if (!c.email || !c.password) { setAcctError('ENTER EMAIL & PASSWORD'); return; }
                setAcctError('');
                busy(loginBtn, true);
                Auth.signInEmail(c.email, c.password).then(function (user) {
                    busy(loginBtn, false);
                    afterAuth(user);
                }).catch(function (err) {
                    busy(loginBtn, false);
                    setAcctError((err && err.message) || 'LOGIN FAILED');
                });
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', function () {
                if (!window.Auth) { setAcctError('AUTH UNAVAILABLE'); return; }
                var c = creds();
                if (!c.email || !c.password) { setAcctError('ENTER EMAIL & PASSWORD'); return; }
                setAcctError('');
                busy(signupBtn, true);
                // Use the saved game name (if any) as the account display name.
                var save = (typeof Storage !== 'undefined' && Storage.load()) || {};
                var name = save.name || (c.email.split('@')[0] || 'PLAYER');
                Auth.signUpEmail(c.email, c.password, name).then(function (user) {
                    busy(signupBtn, false);
                    afterAuth(user);
                }).catch(function (err) {
                    busy(signupBtn, false);
                    setAcctError((err && err.message) || 'SIGN UP FAILED');
                });
            });
        }

        if (googleBtn) {
            googleBtn.addEventListener('click', function () {
                if (!window.Auth) { setAcctError('AUTH UNAVAILABLE'); return; }
                setAcctError('');
                Auth.signInOAuth('google').catch(function (err) {
                    setAcctError((err && err.message) || 'GOOGLE SIGN-IN FAILED');
                });
            });
        }

        if (githubBtn) {
            githubBtn.addEventListener('click', function () {
                if (!window.Auth) { setAcctError('AUTH UNAVAILABLE'); return; }
                setAcctError('');
                Auth.signInOAuth('github').catch(function (err) {
                    setAcctError((err && err.message) || 'GITHUB SIGN-IN FAILED');
                });
            });
        }

        if (signoutBtn) {
            signoutBtn.addEventListener('click', function () {
                if (!window.Auth) { renderAccount(); return; }
                busy(signoutBtn, true);
                Auth.signOut().then(function () {
                    busy(signoutBtn, false);
                    renderAccount();
                });
            });
        }

        if (guestBtn) {
            guestBtn.addEventListener('click', function () {
                ScreenManager.show('MAIN_MENU');
            });
        }

        document.addEventListener('keydown', function (event) {
            if (ScreenManager.current() !== 'ACCOUNT') return;
            if (event.key === 'Escape') {
                event.preventDefault();
                ScreenManager.show('MAIN_MENU');
            }
        });
    }

    /* ---------- MAIN MENU ---------- */

    function initMainMenu() {
        const continueOpt = document.getElementById('mm-continue');
        const newGameOpt = document.getElementById('mm-newgame');
        const leaderboardOpt = document.getElementById('mm-leaderboard');
        const accountOpt = document.getElementById('mm-account');
        const nav = KeyboardNav.create({ columns: 1 });

        function menuItems() {
            const items = [continueOpt, newGameOpt];
            if (leaderboardOpt) items.push(leaderboardOpt);
            if (accountOpt) items.push(accountOpt);
            return items;
        }

        function refresh() {
            if (Storage.hasSave()) {
                continueOpt.classList.remove('disabled');
            } else {
                continueOpt.classList.add('disabled');
            }
            nav.setItems(menuItems(), 1);
        }
        ScreenManager.onShow('MAIN_MENU', refresh);

        continueOpt.addEventListener('click', () => {
            if (!Storage.hasSave()) return;
            ScreenManager.show('MENU');
        });

        newGameOpt.addEventListener('click', () => {
            Storage.clear();
            Registration.reset();
            ScreenManager.show('REGISTRATION');
        });

        if (leaderboardOpt) {
            leaderboardOpt.addEventListener('click', () => {
                ScreenManager.show('LEADERBOARD');
            });
        }

        if (accountOpt) {
            accountOpt.addEventListener('click', () => {
                showAccount();
            });
        }

        document.addEventListener('keydown', event => {
            if (ScreenManager.current() !== 'MAIN_MENU') return;
            nav.handleKey(event);
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        initMainMenu();
        initAccount();
        Registration.init();
        Menu.init();
        Battle.init();
        Leaderboard.init();
        ScreenManager.show('MAIN_MENU');

        // Best-effort session restore. Never blocks the game; guests just stay null.
        if (window.Auth && typeof Auth.getUser === 'function') {
            Auth.getUser().then(function (user) {
                if (user && user.name) {
                    var save = (Storage.load && Storage.load()) || {};
                    if (!save.name) {
                        try { Storage.save({ name: String(user.name).slice(0, 8).toUpperCase() }); } catch (e) {}
                    }
                }
            }).catch(function () { /* stay a guest */ });
        }
    });
})();
