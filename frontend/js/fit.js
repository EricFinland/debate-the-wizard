/* ========================================
   FIT - scales the 400x260 Game Boy canvas to fill the
   viewport beside the You.com side panel.
   No build/framework: global IIFE, runs on load + resize.
   ======================================== */
(function () {
    'use strict';

    var BASE_W = 400;
    var BASE_H = 260;
    var MIN_SCALE = 1.4;
    var MAX_SCALE = 4;

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    function px(value) {
        var n = parseFloat(value);
        return Number.isFinite(n) ? n : 0;
    }

    function sidePanelWidth() {
        /* mirror the CSS clamp(280px, 26vw, 420px) */
        return Math.min(420, Math.max(280, window.innerWidth * 0.26));
    }

    function fit() {
        var container = document.getElementById('game-container');
        var gb = document.getElementById('game-boy');
        var wrap = document.getElementById('gb-wrap');
        var frame = document.getElementById('gb-frame');
        if (!container || !gb || !wrap || !frame) {
            return;
        }

        var layout = getComputedStyle(container);
        var frameStyle = getComputedStyle(frame);
        var horizontalPadding = px(layout.paddingLeft) + px(layout.paddingRight);
        var verticalPadding = px(layout.paddingTop) + px(layout.paddingBottom);
        var gap = px(layout.columnGap || layout.gap);
        var frameChromeX = px(frameStyle.paddingLeft) + px(frameStyle.paddingRight)
            + px(frameStyle.borderLeftWidth) + px(frameStyle.borderRightWidth);
        var frameChromeY = px(frameStyle.paddingTop) + px(frameStyle.paddingBottom)
            + px(frameStyle.borderTopWidth) + px(frameStyle.borderBottomWidth);
        var viewportW = container.clientWidth;
        var viewportH = container.clientHeight;

        var reserved = sidePanelWidth() + gap + horizontalPadding + frameChromeX;
        var availW = viewportW - reserved;
        var availH = viewportH - verticalPadding - frameChromeY;

        var s = clamp(
            Math.min(availW / BASE_W, availH / BASE_H),
            MIN_SCALE,
            MAX_SCALE
        );

        gb.style.transform = 'scale(' + s + ')';
        wrap.style.width = (BASE_W * s) + 'px';
        wrap.style.height = (BASE_H * s) + 'px';

        /* match the side panel height to the framed game screen */
        var side = document.getElementById('side-panel');
        if (frame && side) {
            side.style.height = frame.offsetHeight + 'px';
        }
    }

    window.addEventListener('resize', fit);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fit);
    } else {
        fit();
    }
    window.addEventListener('load', fit);
})();
