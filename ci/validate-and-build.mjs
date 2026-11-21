/**
 * Rico Finances AI: zero-dependency validation and static-site build.
 * Run locally: node ci/validate-and-build.mjs
 * Run automatically before every GitHub Pages deployment.
 */
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (name) => readFileSync(join(root, name), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const required = [
  'index.html', 'styles.css', 'icons.js', 'analyst.js',
  'ai-config.js', 'sw.js', 'version.json', 'manifest.webmanifest',
  'my-finances-apple-touch-icon.png', 'favicon-48.png',
  'my-finances-icon-192.png', 'my-finances-icon-512.png',
  'my-finances-maskable-512.png'
];
for (const file of required) assert(existsSync(join(root, file)), 'Missing required app file: ' + file);

const version = JSON.parse(read('version.json')).version;
assert(/^\d+\.\d+\.\d+$/.test(version), 'Invalid app version in version.json');
const manifest = JSON.parse(read('manifest.webmanifest'));
assert(manifest.name && manifest.start_url && manifest.scope, 'Invalid PWA manifest');
for (const icon of manifest.icons || []) {
  assert(existsSync(join(root, icon.src)), 'Missing manifest icon: ' + icon.src);
}

const html = read('index.html');
const worker = read('sw.js');
assert(html.includes("RICO_APP_VERSION = '" + version + "'"),
  'index.html app version does not match version.json');
assert(worker.includes('v' + version),
  'sw.js cache version does not match version.json');
assert(html.includes('net-worth-v' + version + '.js') &&
       html.includes('linked-loans-v' + version + '.js') &&
       html.includes('linked-budget-v' + version + '.js') &&
       html.includes('linked-utilities-v' + version + '.js') &&
       html.includes('linked-utilities.css') &&
       html.includes('ask-ai-v' + version + '.js'),
       'Net Worth, linked budget and Ask AI scripts must match release');
const shell = worker.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
assert(shell, 'Service worker APP_SHELL not found');
for (const match of shell[1].matchAll(/['"]\.\/([^'"]*)['"]/g)) {
  if (match[1]) assert(existsSync(join(root, match[1])), 'Missing offline asset: ' + match[1]);
}
for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
  const url = match[1];
  if (/^(?:https?:|data:|blob:|#|\/|mailto:|javascript:)/i.test(url)) continue;
  const local = decodeURIComponent(url.split(/[?#]/)[0].replace(/^\.\//, ''));
  if (local && !local.includes('${') && !local.includes('..')) {
    assert(existsSync(join(root, local)), 'Missing HTML asset: ' + local);
  }
}
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\bsrc\s*=/.test(match[1]) && match[2].trim()) {
    new Script(match[2], { filename: 'index.html (inline script)' });
  }
}

const files = readdirSync(root, { withFileTypes: true })
  .filter(e => e.isFile() && !e.name.startsWith('.'))
  .map(e => e.name);
const allowed = new Set(['.html','.css','.js','.json','.webmanifest','.png','.jpg','.jpeg','.svg','.ico','.webp','.gif','.woff','.woff2']);
const publish = files.filter(name => allowed.has(extname(name).toLowerCase()));
for (const file of files.filter(name => name.endsWith('.js'))) {
  const check = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  assert(check.status === 0, 'JavaScript syntax error in ' + file + ': ' + (check.stderr || check.stdout));
}
for (const file of publish.filter(name => name.endsWith('.png'))) {
  const sig = readFileSync(join(root, file)).subarray(0, 8).toString('hex');
  assert(sig === '89504e470d0a1a0a', 'Invalid PNG file: ' + file);
}
const linkedTest = spawnSync(process.execPath, ['ci/check-linked-net-worth.mjs'],
  {cwd:root, encoding:'utf8'});
assert(linkedTest.status === 0,
  'Linked Net Worth regression failed: ' + (linkedTest.stderr || linkedTest.stdout));
process.stdout.write(linkedTest.stdout || '');
const budgetTest = spawnSync(process.execPath, ['ci/check-linked-budget.mjs'],
  {cwd:root, encoding:'utf8'});
assert(budgetTest.status === 0,
  'Linked monthly budget regression failed: ' + (budgetTest.stderr || budgetTest.stdout));
process.stdout.write(budgetTest.stdout || '');
const autoTest=spawnSync(process.execPath, ['ci/check-auto-sync.mjs'],
  {cwd:root,encoding:'utf8'});
assert(autoTest.status===0,
  'Automatic linked-finance sync regression failed: '+(autoTest.stderr||autoTest.stdout));
process.stdout.write(autoTest.stdout||'');
const cashTest=spawnSync(process.execPath, ['ci/check-cash-to-net-worth.mjs'],
  {cwd:root,encoding:'utf8'});
assert(cashTest.status===0,
  'Cash Flow → Net Worth / compact rows regression failed: '+(cashTest.stderr||cashTest.stdout));
process.stdout.write(cashTest.stdout||'');
const keyboardTest=spawnSync(process.execPath, ['ci/check-networth-keyboard.mjs'],
  {cwd:root,encoding:'utf8'});
assert(keyboardTest.status===0,
  'iPhone Asset/Debt editor keyboard regression failed: '+(keyboardTest.stderr||keyboardTest.stdout));
process.stdout.write(keyboardTest.stdout||'');
const utilityTest=spawnSync(process.execPath,['ci/check-linked-utilities.mjs'],
  {cwd:root,encoding:'utf8'});
assert(utilityTest.status===0,
  'Linked paid Home Utilities regression failed: '+(utilityTest.stderr||utilityTest.stdout));
process.stdout.write(utilityTest.stdout||'');
assert(publish.length >= required.length, 'Unexpectedly small publication set');
const dest = join(root, 'dist');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest);
for (const file of publish) copyFileSync(join(root, file), join(dest, file));
writeFileSync(join(dest, '.nojekyll'), '');
console.log('PASS: Rico Finances AI v' + version + ' — ' + publish.length + ' static files validated and built in dist/');
