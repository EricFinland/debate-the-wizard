const fs = require('fs');
const path = require('path');

const battle = fs.readFileSync(path.resolve(__dirname, '..', 'frontend', 'js', 'game', 'battle.js'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(!battle.includes('The arcane connection wavered'), 'connection error should avoid ambiguous arcane copy');
assert(battle.includes('The magic connection wavered... try stating your claim again.'), 'claim retry copy should use readable wording');
assert(battle.includes('The magic connection wavered... cast your argument again.'), 'argument retry copy should use readable wording');

console.log('battle error copy checks passed');
