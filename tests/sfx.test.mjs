// 사운드 기준 시험(공정이 넣음, 수정 금지)
import assert from 'node:assert'; import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname); const art = JSON.parse(fs.readFileSync(path.join(here, '..', 'ART.json'), 'utf8'));
const m = await import(path.join(here, '..', 'src', 'audio', 'sfx.js'));
for (const f of ['playSfx', 'startMusic', 'stopMusic']) assert.strictEqual(typeof m[f], 'function', f + ' 없음');
for (const x of art.sfx) { const p = m.SFX[x.id]; assert.ok(p, '효과음 없음: ' + x.id);
  assert.ok(['square', 'sine', 'triangle', 'sawtooth', 'noise'].includes(p.wave), x.id + ' wave'); for (const [k, lo, hi] of [['freq', 30, 4000], ['dur', 0.02, 2], ['vol', 0, 1]]) assert.ok(p[k] >= lo && p[k] <= hi, x.id + ' ' + k); }
console.log('sfx ok', art.sfx.length);
