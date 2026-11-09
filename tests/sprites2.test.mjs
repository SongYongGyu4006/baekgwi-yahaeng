// 아티스트 2차 기준 시험(공정이 넣음, 수정 금지): 그림 파일이 모두 있고, 그리기가 그림 파일을 쓰는가
import assert from 'node:assert'; import fs from 'node:fs'; import path from 'node:path';
const g = path.join(path.dirname(new URL(import.meta.url).pathname), '..'); const art = JSON.parse(fs.readFileSync(path.join(g, 'ART.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(path.join(g, 'assets', 'sprites', 'sprites.json'), 'utf8'));
for (const s of art.sprites) { assert.ok(man[s.id], '그림 목록에 없음: ' + s.id); assert.ok(fs.existsSync(path.join(g, man[s.id].file)), '그림 파일 없음: ' + s.id); }
const draw = fs.readFileSync(path.join(g, 'src', 'art', 'draw.js'), 'utf8');
assert.ok(/sprites\.json|assets\/sprites/.test(draw), 'drawSprite 가 assets/sprites 그림 파일을 쓰지 않음');
console.log('sprites2 ok', Object.keys(man).length);
