const { assert, readProjectFile } = require('./helpers');

const index = readProjectFile('frontend', 'index.html');
const css = readProjectFile('frontend', 'css', 'debate.css');
const battle = readProjectFile('frontend', 'js', 'game', 'battle.js');

assert(index.includes('<input id="debate-arg-input"'), 'battle claim control should be a one-line input');
assert(!index.includes('<textarea id="debate-arg-input"'), 'battle claim control should not be a textarea');
assert(index.includes('class="debate-input-actions"'), 'CAST and RANDOMIZE buttons should be wrapped in an action row');
assert(/\.debate-input\s*\{[\s\S]*flex-direction:\s*column/.test(css), 'battle input layout should stack textbox above buttons');
assert(/\.debate-input-actions\s*\{[\s\S]*justify-content:\s*flex-end/.test(css), 'battle input buttons should align right');
assert(/#debate-arg-input\s*\{[\s\S]*height:\s*26px/.test(css), 'battle claim input should be one-line height');
assert(!battle.includes('Shift+Enter inserts a newline'), 'battle input key handling should not reference multiline newlines');

console.log('battle input layout checks passed');
