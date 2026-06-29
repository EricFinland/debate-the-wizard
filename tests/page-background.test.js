const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'base.css'), 'utf8');
const backgroundPath = path.join(root, 'frontend', 'img', 'backgrounds', 'bg.jpeg');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(!fs.existsSync(backgroundPath), 'removed background image should not remain in img/backgrounds/bg.jpeg');
assert(!/body\s*\{[\s\S]*background-image:\s*url\('\.\.\/img\/backgrounds\/bg\.jpeg'\)/.test(css), 'body should not use the removed background image');
assert(/body\s*\{[\s\S]*background-color:\s*var\(--bg\)/.test(css), 'body should use the solid theme background color');

console.log('solid page background checks passed');
