const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const results = {};

function run(label, cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 120000, stdio: ['pipe','pipe','pipe'] });
    results[label] = { ok: true, output: out.trim().slice(-500) };
  } catch (e) {
    results[label] = { ok: false, output: (e.stdout || '') + '\n' + (e.stderr || ''), code: e.status };
  }
}

// Check node_modules exists
const nmExists = fs.existsSync(path.join(__dirname, 'node_modules'));
console.log('node_modules exists:', nmExists);

if (!nmExists) {
  console.log('Installing dependencies...');
  run('install', 'npm install --no-audit --no-fund');
  console.log('Install result:', results.install?.ok ? 'OK' : 'FAILED');
  if (!results.install?.ok) {
    console.log(results.install?.output?.slice(-1000));
    process.exit(1);
  }
}

run('test', 'node node_modules/vitest/vitest.mjs run 2>&1');
run('lint', 'node node_modules/.bin/next lint 2>&1');
run('build', 'node node_modules/.bin/next build 2>&1');

for (const [k, v] of Object.entries(results)) {
  console.log(`\n=== ${k.toUpperCase()} === [${v.ok ? 'PASS' : 'FAIL'}]`);
  console.log(v.output?.slice(-800));
}
