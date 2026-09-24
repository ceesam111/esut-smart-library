import fs from 'node:fs';

const oa = fs.readFileSync('src/config/openAccessDatabases.data.ts', 'utf8');
const sub = fs.readFileSync('src/config/subscribedDatabases.data.ts', 'utf8');
const nav = fs.readFileSync('src/components/layout/Navbar.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const foot = fs.readFileSync('src/components/layout/Footer.tsx', 'utf8');
const cfg = fs.readFileSync('src/config/libraryResources.config.ts', 'utf8');
const inst = fs.readFileSync('src/config/institution.config.ts', 'utf8');

const ids = [...oa.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
const subIds = [...sub.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
const subNames = [...sub.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
const r4l = ['hinari', 'agora', 'oare', 'ardi', 'goali'];

const checks = {
  'OA count=117': ids.length === 117,
  'OA unique ids': new Set(ids).size === 117,
  'No research4life umbrella id': !ids.includes('research4life'),
  'Subscribed count=6': subIds.length === 6,
  'R4L five present': r4l.every((id) => subIds.includes(id)),
  'No Research4Life seventh card': !subNames.some((n) => /^Research4Life$/i.test(n)),
  'Nav has Subscribed route': nav.includes('/subscribed-databases'),
  'Nav has OA route': nav.includes('/open-access-databases'),
  'Nav has OPAC external': nav.includes('OPAC_URL') && nav.includes('external: true'),
  'App routes registered': app.includes('/subscribed-databases') && app.includes('/open-access-databases'),
  'Footer links': foot.includes('/subscribed-databases') && foot.includes('/open-access-databases') && foot.includes('OPAC'),
  'WhatsApp official number': cfg.includes('2347030162879') && inst.includes('+2347030162879'),
  'OPAC exact URL': cfg.includes('https://esutlibrary.librarika.com'),
  'WhatsApp prefilled message': cfg.includes('Hello Librarian, I need access details'),
  'Repo nav Open Access updated': !nav.includes("label: 'Open Access Resources',  href: '/categories'"),
};

let fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log(v ? 'PASS' : 'FAIL', k);
  if (!v) fail++;
}
console.log(fail === 0 ? 'ALL CHECKS PASSED' : `FAILED: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
