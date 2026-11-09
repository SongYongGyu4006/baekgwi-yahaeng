// 연출 기준 시험(공정이 넣음, 수정 금지): 동작 프레임 파일이 있고 게임 코드가 쓰는가
import assert from 'node:assert'; import fs from 'node:fs'; import path from 'node:path';
const g = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const man = JSON.parse(fs.readFileSync(path.join(g, 'assets', 'sprites', 'sprites.json'), 'utf8')); const an = man._anims || {};
for (const [id, set] of Object.entries(an)) for (const [k, files] of Object.entries(set)) { assert.ok(files.length >= 2, id + ' ' + k + ' 프레임 부족'); for (const f of files) assert.ok(fs.existsSync(path.join(g, f)), '없는 프레임 ' + f); }
const src = fs.readdirSync(path.join(g, 'src'), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => fs.readFileSync(path.join(g, 'src', String(f)), 'utf8')).join('\n');
assert.ok(/_anims/.test(src), '게임 코드가 sprites.json 의 _anims(동작 프레임)를 쓰지 않음');
console.log('anim ok');
