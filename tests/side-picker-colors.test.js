const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.resolve(__dirname, '..', 'frontend', 'css', 'debate.css'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
    return match ? match[1] : '';
}

assert(rule('#side-for').includes('background: var(--debate-green)'), 'FOR option should have a green background by default');
assert(rule('#side-against').includes('background: var(--debate-red)'), 'AGAINST option should have a red background by default');
assert(rule('#side-against').includes('color: #fff'), 'AGAINST option should use readable text on red');

console.log('side picker color checks passed');
