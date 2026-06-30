const { assert, cssRule, readProjectFile } = require('./helpers');

const css = readProjectFile('frontend', 'css', 'debate.css');
const rule = (selector) => cssRule(css, selector);

assert(rule('.lb-screen').includes('background: var(--bg)'), 'leaderboard screen should use the game background color');
assert(rule('.lb-screen .lb-title').includes('color: var(--accent)'), 'leaderboard title should use the accent color');
assert(rule('.lb-row').includes('color: var(--text)'), 'leaderboard rows should use readable theme text');
assert(rule('.lb-row').includes('border: 2px solid var(--separator)'), 'leaderboard rows should use theme separator borders');
assert(rule('.lb-row').includes('background: var(--bg-alt)'), 'leaderboard rows should use alternate theme background');
assert(rule('.lb-score').includes('color: var(--accent)'), 'leaderboard scores should use the accent color');
assert(rule('.lb-row.lb-first').includes('background: var(--warn)'), 'first-place row should use the warning/gold color');

console.log('leaderboard color checks passed');
