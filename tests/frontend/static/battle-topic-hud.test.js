const { assert, readProjectFile } = require('./helpers');

const index = readProjectFile('frontend', 'index.html');
const battle = readProjectFile('frontend', 'js', 'game', 'battle.js');

assert(index.includes('id="enemy-topic"'), 'enemy HUD should include an enemy-topic element');
assert(index.includes('id="player-topic"'), 'player HUD should include a player-topic element');
assert(!battle.includes("lbl.textContent = 'YOU ARGUE FOR:'"), 'battle should not render the YOU ARGUE FOR label');
assert(battle.includes('showTopicInHud(topic);'), 'launchDuel should show the active topic in the HUD');

console.log('battle topic HUD checks passed');
