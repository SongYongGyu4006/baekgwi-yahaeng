// 아트 기준 시험(공정이 넣음, 수정 금지): ART.json 의 모든 스프라이트가 규칙대로 있는가
import assert from 'node:assert'; import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname); const art = JSON.parse(fs.readFileSync(path.join(here, '..', 'ART.json'), 'utf8'));
const { PALETTE, SPRITES } = await import(path.join(here, '..', 'src', 'art', 'sprites.js'));
assert.deepStrictEqual(Object.keys(PALETTE).sort(), Object.keys(art.palette).sort(), '팔레트 키가 ART.json 과 다름');
for (const sp of art.sprites) {
  const s = SPRITES[sp.id]; assert.ok(s, '스프라이트 없음: ' + sp.id); assert.strictEqual(s.size, sp.size, sp.id + ' 크기');
  assert.ok(Array.isArray(s.frames) && s.frames.length >= 1 && s.frames.length <= 4, sp.id + ' 프레임 수');
  for (const f of s.frames) { assert.strictEqual(f.length, sp.size, sp.id + ' 줄 수'); for (const row of f) { assert.strictEqual(row.length, sp.size, sp.id + ' 줄 길이'); for (const ch of row) assert.ok(ch === '.' || ch in PALETTE, sp.id + ' 팔레트에 없는 글자 ' + ch); } }
  const filled = s.frames[0].join('').replace(/\./g, '').length; assert.ok(filled >= sp.size * sp.size * 0.12, sp.id + ' 거의 빈 그림');
}
console.log('art ok', art.sprites.length);
