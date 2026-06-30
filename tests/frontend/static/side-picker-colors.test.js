const { assert, cssRule, readProjectFile } = require('./helpers');

const css = readProjectFile('frontend', 'css', 'debate.css');
const rule = (selector) => cssRule(css, selector);

assert(rule('#side-for').includes('background: var(--debate-green)'), 'FOR option should have a green background by default');
assert(rule('#side-against').includes('background: var(--debate-red)'), 'AGAINST option should have a red background by default');
assert(rule('#side-against').includes('color: #fff'), 'AGAINST option should use readable text on red');

console.log('side picker color checks passed');
