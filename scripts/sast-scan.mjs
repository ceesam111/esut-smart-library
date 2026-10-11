import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const PROJECT_ROOT = 'C:\\Users\\LENOVO\\Desktop\\DWC_Platform_2.5_Idea_Project_Intake_Stitch\\Projects\\ESUT SMART LIBRARY';

const CHECKS = [
  { name: 'eslint-disable', re: /eslint-disable/ },
  { name: 'focused-test', re: /\b(describe|it|test)\.only\s*\(|\bfit\s*\(|\bfdescribe\s*\(/ },
  { name: 'dynamic-code-execution', re: /\beval\s*\(|new\s+Function\s*\(/ },
  { name: 'tls-verification-bypass', re: /rejectUnauthorized\s*:\s*false/ },
  { name: 'client-bundled-secret-env', re: /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|PRIVATE)/ },
  { name: 'weak-hash', re: /createHash\s*\(\s*['"](md5|sha1)['"]/ },
  { name: 'insecure-http-fetch', re: /\bfetch\s*\(\s*['"]http:\/\// },
  { name: 'child-process-shell-injection', re: /(exec|execSync|spawn)\s*\(\s*`[^`]*\$\{/ },
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp4|wasm|node|map|lock)$/i;
const SKIP_FILES = new Set(['package-lock.json']);
const ALLOW_LIKE = /test|spec|mock|fixture|example|e2e|[\\/]scripts[\\/]/i;

function trackedFiles() {
  try {
    const out = execSync('git ls-files -z', { cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 * 1024 });
    return out.toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

const findings = [];
let baseline;
try {
  baseline = JSON.parse(readFileSync(`${PROJECT_ROOT}\\scripts\\.sast-baseline.json`, 'utf8'));
} catch {
  baseline = [];
}
const baselineSet = new Set(Array.isArray(baseline) ? baseline : []);
const files = trackedFiles();
if (files.length === 0) {
  console.error('FATAL: no tracked files found (is this a git repository?)');
  process.exit(2);
}

for (const rel of files) {
  if (!SOURCE_EXT.test(rel) || SKIP_EXT.test(rel) || SKIP_FILES.has(rel)) continue;
  let content;
  try {
    const buf = readFileSync(`${PROJECT_ROOT}\\${rel.replace(/\//g, '\\')}`);
    if (buf.length > 1024 * 1024) continue;
    content = buf.toString('utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const check of CHECKS) {
      if (!check.re.test(line)) continue;
      if (check.name === 'eslint-disable') {
        findings.push({ file: rel, line: idx + 1, rule: check.name });
        continue;
      }
      if ((check.name === 'insecure-http-fetch' || check.name === 'tls-verification-bypass') && ALLOW_LIKE.test(rel)) continue;
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      findings.push({ file: rel, line: idx + 1, rule: check.name });
    }
  });
}

const unique = [...new Map(findings.map((f) => [`${f.file}:${f.line}:${f.rule}`, f])).values()]
  .filter((f) => !baselineSet.has(`${f.file}::${f.rule}`));
for (const f of unique) console.log(`SAST ${f.file}:${f.line} ${f.rule}`);
console.log(`scanned ${files.length} tracked files with ${CHECKS.length} rules, ${unique.length} findings`);
if (unique.length > 0) process.exit(1);
console.log('SAST SCAN PASSED');
