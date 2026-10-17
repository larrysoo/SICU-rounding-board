// 從 index.html 抽出指定的函式與常數，在 Node 裡測試（不需瀏覽器）
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

function grab(name) {
  let i = src.indexOf('function ' + name + '(');
  if (i >= 0) { // 依大括號配對抓完整函式（略過字串內容）
    let j = src.indexOf('{', i), depth = 0, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return src.slice(i, j + 1);
    }
  }
  const m = src.match(new RegExp('const ' + name + '=[^;]*;'));
  if (m) return m[0].replace(/^const /, 'var ');
  throw new Error('not found: ' + name);
}

export function load(names, globals = {}) {
  const ctx = vm.createContext({ ...globals });
  vm.runInContext(names.map(grab).join('\n') + '\n', ctx);
  return ctx;
}

let pass = 0, fail = 0;
export function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
}
export function done() { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; }
