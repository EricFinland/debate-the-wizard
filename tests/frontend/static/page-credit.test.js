const { assert, readProjectFile } = require('./helpers');

const index = readProjectFile('frontend', 'index.html');
const baseCss = readProjectFile('frontend', 'css', 'base.css');

assert(index.includes('id="page-credit"'), 'page should include a bottom-right credit element');
assert(index.includes('Made with'), 'credit copy should include the opening phrase');
assert(index.includes('You.com'), 'credit copy should credit You.com');
assert(index.includes('InsForge.dev'), 'credit copy should credit InsForge.dev');
assert(index.includes('Love'), 'credit copy should include Love');
assert(index.includes('[Eric, Tom, Jay]'), 'credit copy should credit Eric, Tom, and Jay');
assert(/#page-credit\s*\{[\s\S]*position:\s*fixed/.test(baseCss), 'page credit should be fixed to the viewport');
assert(/#page-credit\s*\{[\s\S]*right:\s*clamp\(16px,\s*3vw,\s*32px\)/.test(baseCss), 'page credit should sit on the right side');
assert(/#page-credit\s*\{[\s\S]*bottom:\s*clamp\(10px,\s*2vw,\s*20px\)/.test(baseCss), 'page credit should sit on the bottom');

console.log('page credit checks passed');
