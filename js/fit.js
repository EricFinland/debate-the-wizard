/* ========================================
   FIT - scales the 400x260 Game Boy canvas to fill the
   viewport beside the You.com side panel.
   No build/framework: global IIFE, runs on load + resize.
   ======================================== */
(function () {
    'use strict';

    var BASE_W = 400;
    var BASE_H = 380;
    var MIN_SCALE = 1.4;
    var MAX_SCALE = 4;
    var GAP = 20;      /* must match #game-container gap */
    var PADDING = 40;  /* #game-container padding 20px each side */

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    function sidePanelWidth() {
        /* mirror the CSS clamp(280px, 26vw, 420px) */
        return Math.min(420, Math.max(280, window.innerWidth * 0.26));
    }

    /* The side panel is hidden until the first argument produces citations.
       It starts hidden (class 'hidden'/'is-hidden' -> display:none) and
       battle.js reveals it by removing that class + dispatching 'resize'.
       Reserve its width ONLY while it is actually laid out (visible). */
    function panelVisible() {
        var panel = document.getElementById('side-panel');
        if (!panel) {
            return false;
        }
        if (panel.classList.contains('hidden') ||
            panel.classList.contains('is-hidden')) {
            return false;
        }
        /* offsetParent is null when the element (or an ancestor) is display:none */
        if (panel.offsetParent === null && panel.offsetWidth === 0) {
            return false;
        }
        return getComputedStyle(panel).display !== 'none';
    }

    function fit() {
        var gb = document.getElementById('game-boy');
        var wrap = document.getElementById('gb-wrap');
        if (!gb || !wrap) {
            return;
        }

        /* Center across the FULL viewport when the panel is hidden (reserve 0);
           reserve the panel's width + gap only when it is visible. */
        var reserved = panelVisible()
            ? (sidePanelWidth() + GAP + PADDING)
            : PADDING;
        var availW = window.innerWidth - reserved;
        var availH = window.innerHeight - PADDING;

        var s = clamp(
            Math.min(availW / BASE_W, availH / BASE_H),
            MIN_SCALE,
            MAX_SCALE
        );

        gb.style.transform = 'scale(' + s + ')';
        wrap.style.width = (BASE_W * s) + 'px';
        wrap.style.height = (BASE_H * s) + 'px';
    }

    window.addEventListener('resize', fit);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fit);
    } else {
        fit();
    }
    window.addEventListener('load', fit);
})();
