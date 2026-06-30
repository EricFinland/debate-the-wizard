const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const battle = fs.readFileSync(path.join(root, 'frontend', 'js', 'game', 'battle.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'debate.css'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(!battle.includes("const verb = data.dmgTo === 'self' ? '-' : '';"), 'self damage should not render with a negative sign');
assert(battle.includes("data.dmgTo === 'self' ? 'TOOK ' : 'DEALT '"), 'damage label should distinguish taken vs dealt damage');
assert(/\.round-result \.rr-rationale\s*\{[\s\S]*-webkit-line-clamp:\s*2/.test(css), 'round result rationale should be clamped to two lines');
assert(/\.round-result \.rr-claim\s*\{[\s\S]*white-space:\s*nowrap/.test(css), 'round result claim should stay on one compact line');

console.log('round result UI checks passed');
