const { assert, readProjectFile } = require('./helpers');

const battle = readProjectFile('frontend', 'js', 'game', 'battle.js');

assert(battle.includes("act === 'run'"), 'battle should handle the RUN action');
assert(battle.includes("waitForClick().then(() => ScreenManager.show('MAIN_MENU'))"), 'RUN should return to the main menu');
assert(!battle.includes("waitForClick().then(() => ScreenManager.show('MENU'))"), 'RUN should not return to the difficulty menu');

console.log('run button navigation checks passed');
