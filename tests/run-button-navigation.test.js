const fs = require('fs');
const path = require('path');

const battle = fs.readFileSync(path.resolve(__dirname, '..', 'frontend', 'js', 'battle.js'), 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(battle.includes("act === 'run'"), 'battle should handle the RUN action');
assert(battle.includes("waitForClick().then(() => ScreenManager.show('MAIN_MENU'))"), 'RUN should return to the main menu');
assert(!battle.includes("waitForClick().then(() => ScreenManager.show('MENU'))"), 'RUN should not return to the difficulty menu');

console.log('run button navigation checks passed');
