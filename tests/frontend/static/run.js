const fs = require('fs');
const path = require('path');

const testDir = __dirname;
const tests = fs.readdirSync(testDir)
    .filter((file) => file.endsWith('.test.js'))
    .sort();

for (const test of tests) {
    require(path.join(testDir, test));
}
