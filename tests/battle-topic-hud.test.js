const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf8');
const battle = fs.readFileSync(path.join(root, 'frontend', 'js', 'game', 'battle.js'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(index.includes('id="enemy-topic"'), 'enemy HUD should include an enemy-topic element');
assert(index.includes('id="player-topic"'), 'player HUD should include a player-topic element');
assert(!battle.includes("lbl.textContent = 'YOU ARGUE FOR:'"), 'battle should not render the YOU ARGUE FOR label');
assert(battle.includes('showTopicInHud(topic);'), 'launchDuel should show the active topic in the HUD');

console.log('battle topic HUD checks passed');
