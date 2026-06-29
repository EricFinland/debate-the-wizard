const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'debate.css'), 'utf8');
const battle = fs.readFileSync(path.join(root, 'frontend', 'js', 'battle.js'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(battle.includes("more.className = 'citation-more'"), 'sidebar citations should render a See More button');
assert(battle.includes("more.textContent = 'See More...'"), 'See More button copy should match request');
assert(battle.includes("item.classList.toggle('is-expanded')"), 'See More button should toggle expanded source text');
assert(/#side-citations \.citation-snippet\s*\{[\s\S]*max-height:\s*96px/.test(css), 'sidebar snippets should be clamped by default');
assert(/#side-citations \.side-citation\.is-expanded \.citation-snippet\s*\{[\s\S]*max-height:\s*none/.test(css), 'expanded sidebar snippets should show full text');
assert(/#side-citations \.citation-more\s*\{[\s\S]*cursor:\s*pointer/.test(css), 'See More should be styled as an interactive control');

console.log('sidebar see more checks passed');
