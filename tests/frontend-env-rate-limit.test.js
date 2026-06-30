const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf8');
const config = fs.readFileSync(path.join(root, 'frontend', 'js', 'config.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'frontend', 'js', 'services', 'api.js'), 'utf8');
const battle = fs.readFileSync(path.join(root, 'frontend', 'js', 'game', 'battle.js'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'frontend', 'scripts', 'generate-env.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'frontend', 'package.json'), 'utf8'));

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(index.indexOf('js/env.js') < index.indexOf('js/config.js'), 'env.js should load before config.js');
assert(config.includes("requireEnv('INSFORGE_API_URL')"), 'config should require INSFORGE_API_URL');
assert(config.includes("requireEnv('INSFORGE_SDK_URL')"), 'config should require INSFORGE_SDK_URL');
assert(!config.includes('atjgzcv9'), 'config should not fall back to a stale InsForge project');
assert(!config.includes('anon_bc75'), 'config should not fall back to a hardcoded anon key');
assert(pkg.scripts.dev.includes('npm run generate-env'), 'dev script should generate env.js before serving');
assert(pkg.scripts['vercel-build'].includes('generate-env'), 'Vercel build should generate env.js');

assert(generator.includes("'INSFORGE_API_URL'"), 'generator should expose INSFORGE_API_URL');
assert(generator.includes("'INSFORGE_ANON_KEY'"), 'generator should expose optional INSFORGE_ANON_KEY');
assert(!generator.includes("'INSFORGE_API_KEY'"), 'generator must not expose INSFORGE_API_KEY');

assert(api.includes('err.status = status'), 'API errors should preserve HTTP status');
assert(battle.includes('err.status === 429'), 'battle should handle 429 rate limits explicitly');
assert(battle.includes('let creatingRoom = false'), 'battle should guard duplicate room creation');

console.log('frontend env and rate-limit checks passed');
