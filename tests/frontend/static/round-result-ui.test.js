const { assert, readProjectFile } = require('./helpers');

const battle = readProjectFile('frontend', 'js', 'game', 'battle.js');
const css = readProjectFile('frontend', 'css', 'debate.css');

assert(!battle.includes("const verb = data.dmgTo === 'self' ? '-' : '';"), 'self damage should not render with a negative sign');
assert(battle.includes("data.dmgTo === 'self' ? 'TOOK ' : 'DEALT '"), 'damage label should distinguish taken vs dealt damage');
assert(/\.round-result \.rr-rationale\s*\{[\s\S]*-webkit-line-clamp:\s*2/.test(css), 'round result rationale should be clamped to two lines');
assert(/\.round-result \.rr-claim\s*\{[\s\S]*white-space:\s*nowrap/.test(css), 'round result claim should stay on one compact line');

console.log('round result UI checks passed');
