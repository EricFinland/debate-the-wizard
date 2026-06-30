const fs = require('fs');
const { assert, projectPath, readProjectFile } = require('./helpers');

const css = readProjectFile('frontend', 'css', 'base.css');
const backgroundPath = projectPath('frontend', 'img', 'backgrounds', 'bg.jpeg');

assert(!fs.existsSync(backgroundPath), 'removed background image should not remain in img/backgrounds/bg.jpeg');
assert(!/body\s*\{[\s\S]*background-image:\s*url\('\.\.\/img\/backgrounds\/bg\.jpeg'\)/.test(css), 'body should not use the removed background image');
assert(/body\s*\{[\s\S]*background-color:\s*var\(--page-bg\)/.test(css), 'body should use the solid page background color');

console.log('solid page background checks passed');
