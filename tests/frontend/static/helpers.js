const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');

function projectPath(...parts) {
    return path.join(root, ...parts);
}

function readProjectFile(...parts) {
    return fs.readFileSync(projectPath(...parts), 'utf8');
}

function readJsonFile(...parts) {
    return JSON.parse(readProjectFile(...parts));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function cssRule(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
    return match ? match[1] : '';
}

module.exports = {
    assert,
    cssRule,
    projectPath,
    readJsonFile,
    readProjectFile
};
