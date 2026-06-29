const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'debate.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(root, 'frontend', 'css', 'base.css'), 'utf8');
const fit = fs.readFileSync(path.join(root, 'frontend', 'js', 'fit.js'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(!/#side-panel\s*\{[\s\S]*transform:\s*scale\(4\)/.test(css), 'side panel should not use transform scale(4)');
assert(css.includes('--side-panel-text-scale: 2.5'), 'side panel should define a 2.5x text scale');
assert(/#side-panel \.side-panel-header\s*\{[\s\S]*font-size:\s*calc\(9px \* var\(--side-panel-text-scale\)\)/.test(css), 'side panel header text should use the 2.5x scale');
assert(/#side-citations \.citation-title\s*\{[\s\S]*font-size:\s*calc\(8px \* var\(--side-panel-text-scale\)\)/.test(css), 'source title text should use the 2.5x scale');
assert(/#side-citations\s*\{[\s\S]*padding:\s*24px/.test(css), 'side citations should have enough panel padding');
assert(/#side-citations \.side-citation\s*\{[\s\S]*margin-inline:\s*8px/.test(css), 'source cards should not touch the sidebar sides');
assert(/#side-citations \.side-citation \+ \.side-citation\s*\{[\s\S]*margin-top:\s*24px/.test(css), 'sources in the same group should have extra vertical space');
assert(/#side-citations \.side-citation-group \+ \.side-citation-group\s*\{[\s\S]*margin-top:\s*28px/.test(css), 'source groups should have extra vertical space');
assert(/#game-container\s*\{[\s\S]*padding:\s*clamp\(32px,\s*4vw,\s*56px\)/.test(baseCss), 'game container should preserve viewport-side padding');
assert(/#game-container\s*\{[\s\S]*gap:\s*clamp\(24px,\s*3vw,\s*40px\)/.test(baseCss), 'game container should preserve a visible gap between main panels');
assert(!baseCss.includes('--app-scale: 0.67'), 'game container should not force a 67% app scale');
assert(!baseCss.includes('transform: scale(var(--app-scale))'), 'game container should not apply an internal app scale');
assert(/#game-container\s*\{[\s\S]*width:\s*100vw/.test(baseCss), 'game container should use normal viewport width');
assert(/#game-container\s*\{[\s\S]*height:\s*100vh/.test(baseCss), 'game container should use normal viewport height');
assert(fit.includes('getComputedStyle(container)'), 'fit script should read layout spacing from CSS');
assert(fit.includes('var viewportW = container.clientWidth'), 'fit script should size against the scaled container width');
assert(fit.includes('var viewportH = container.clientHeight'), 'fit script should size against the scaled container height');
assert(!fit.includes('var GAP = 20'), 'fit script should not hardcode the container gap');
assert(!fit.includes('var PADDING = 40'), 'fit script should not hardcode container padding');

console.log('sidebar layout checks passed');
