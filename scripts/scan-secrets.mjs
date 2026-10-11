import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const PROJECT_ROOT = 'C:\\Users\\LENOVO\\Desktop\\DWC_Platform_2.5_Idea_Project_Intake_Stitch\\Projects\\ESUT SMART LIBRARY';

const RULES = [
  { name: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'github-fine-grained-pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'openai-style-key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'stripe-key', re: /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/ },
  { name: 'supabase-secret-key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}\b/ },
  { name: 'hardcoded-jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, allow: /\b(NEXT_PUBLIC_)?SUPABASE_(ANON|PUBLISHABLE)|_ANON_KEY/ },
  { name: 'credentialed-database-url', re: /\b(postgresql|postgres|mysql|mongodb|redis|amqp):\/\/[^\s/:@'"]+:[^\s/@'"]+@/ },
  { name: 'npm-token', re: /\bnpm_[A-Za-z0-9]{30,}\b/ },
];

const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp4|wasm|node|map|lock|tar|bz2|xz|avif|mp3|wav)$/i;
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

function trackedFiles() {
  try {
    const out = execSync('git ls-files -z', { cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 * 1024 });
    return out.toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

const SECRET_NAME = /(SECRET|PASSWORD|PASSWD|PRIVATE|SERVICE_ROLE|_API_KEY$|_KEY$|_TOKEN$)/;
const PUBLIC_NAME = /(ANON|PUBLISHABLE|PUBLIC|NEXT_PUBLIC|_URL$|BASE_URL|ENDPOINT|_MODEL$|_USER$|FROM_EMAIL|CORS|_ID$)/;

function envValues() {
  const values = [];
  let raw;
  try {
    raw = readFileSync(`${PROJECT_ROOT}\\.env.local`, 'utf8');
  } catch {
    return values;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (!SECRET_NAME.test(key) || PUBLIC_NAME.test(key)) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (value.length >= 16) values.push({ key, value });
  }
  return values;
}

const findings = [];
const files = trackedFiles();
if (files.length === 0) {
  console.error('FATAL: no tracked files found (is this a git repository?)');
  process.exit(2);
}
const secrets = envValues();

for (const rel of files) {
  if (SKIP_EXT.test(rel) || SKIP_FILES.has(rel)) continue;
  let content;
  try {
    const stat = readFileSync(`${PROJECT_ROOT}\\${rel.replace(/\//g, '\\')}`);
    if (stat.length > 2 * 1024 * 1024) continue;
    content = stat.toString('utf8');
  } catch {
    continue;
  }
  if (content.includes('\0')) continue;
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        if (rule.allow && rule.allow.test(line)) continue;
        findings.push({ file: rel, line: idx + 1, rule: rule.name });
      }
    }
    for (const s of secrets) {
      if (line.includes(s.value)) findings.push({ file: rel, line: idx + 1, rule: `env-value-leak(${s.key})` });
    }
  });
}

const unique = [...new Map(findings.map((f) => [`${f.file}:${f.line}:${f.rule}`, f])).values()];
for (const f of unique) console.log(`SECRET ${f.file}:${f.line} ${f.rule}`);
console.log(`scanned ${files.length} tracked files, ${secrets.length} env values checked, ${unique.length} findings`);
if (unique.length > 0) process.exit(1);
console.log('SECRETS SCAN PASSED');
