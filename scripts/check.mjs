// CI 檢查：語法、版本一致性、疑似個資
// 用法：node scripts/check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';

let failed = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failed++; };

const html = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

// 1. 內嵌 <script> 語法檢查（只編譯、不執行）
console.log('1. JavaScript syntax');
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
blocks.forEach((code, i) => {
  try { new vm.Script(code, { filename: `index.html#script${i}` }); ok(`inline script #${i} (${code.length} chars)`); }
  catch (e) { bad(`inline script #${i}: ${e.message}`); }
});
try { new vm.Script(sw, { filename: 'sw.js' }); ok('sw.js'); } catch (e) { bad('sw.js: ' + e.message); }

// 2. index.html 顯示版號 與 sw.js CACHE 必須一致（忘記 bump 就擋下）
console.log('2. Version consistency');
const appV = (html.match(/>v(\d+\.\d+\.\d+) ·/) || [])[1];
const cacheV = ((sw.match(/CACHE\s*=\s*'sicu-rounds-v([\d-]+)'/) || [])[1] || '').replace(/-/g, '.');
if (!appV) bad('找不到 index.html 的版號（格式 >vX.Y.Z ·）');
else if (appV !== cacheV) bad(`index.html v${appV} ≠ sw.js CACHE v${cacheV}`);
else ok(`v${appV}`);

// 3. 疑似個資：身分證字號格式（repo 是公開的）
console.log('3. PHI guard');
const files = readdirSync('.').filter((f) => /\.(html|js|json|md)$/.test(f) && f !== 'pouchdb.min.js' && statSync(f).isFile());
const twId = /\b[A-Z][12]\d{8}\b/g;
let hits = 0;
for (const f of files) {
  const m = readFileSync(f, 'utf8').match(twId);
  if (m) { hits += m.length; bad(`${f}: 疑似身分證字號 ${[...new Set(m)].join(', ')}`); }
}
if (!hits) ok(`${files.length} files clean`);

console.log(failed ? `\nFAILED (${failed})` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
