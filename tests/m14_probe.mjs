// 14단계 검증 스크립트 — (임시)
//  1. _anims 4종(구미호·강시·처녀귀신·도장) 파일이 존재하는지
//  2. 스프라이트 정의/프레임(5,2,2,4)
//  3. makeCards: 카드 kind 검증(기존)
//  4. BOSS.versions 2종 수치
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITES } from '../src/art/sprites.js';
import { BOSS } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const spritesDir = path.join(here, '..', 'assets', 'sprites');

// 1) _anims 파일 존재 — 프레임 4종(구미호·강시·처녀귀신·도장)
//    manifest 에 등록된 프레임 파일이 디스크에 실제로 있는지 확인.
const manifest = JSON.parse(fs.readFileSync(path.join(spritesDir, 'sprites.json'), 'utf8'));
const anims = manifest._anims || {};
const frameIds = ['boss_gumiho', 'enemy_jiangshi', 'enemy_maiden', 'talisman'];
let frameCount = 0;
for (const [base, set] of Object.entries(anims)) {
  for (const [key, files] of Object.entries(set)) {
    for (const f of files) {
      if (!frameIds.includes(base)) continue;
      frameCount++;
      const p = path.join(spritesDir, path.basename(f));
      assert.ok(fs.existsSync(p), `파일 존재: ${f}`);
    }
  }
}
assert.ok(frameCount >= 13, `M14 프레임 4종 합산 ≥ 13 (구미호5+강시2+처녀귀신2+도장4), 실측 ${frameCount}`);
console.log(`manifest M14 프레임: ${frameCount}개 (구미호=${(anims.boss_gumiho && anims.boss_gumiho.idle || []).length}, 강시=${(anims.enemy_jiangshi && anims.enemy_jiangshi.move || []).length}, 처녀귀신=${(anims.enemy_maiden && anims.enemy_maiden.move || []).length}, 도장=${(anims.talisman && anims.talisman.act || []).length})`);

// 2) 스프라이트 정의
const expect = { boss_gumiho: 5, enemy_jiangshi: 2, enemy_maiden: 2, talisman: 4 };
for (const [id, n] of Object.entries(expect)) {
  const d = SPRITES[id];
  assert.ok(d, `SPRITES.${id} 정의`);
  assert.strictEqual(d.frames.length, n, `${id} frames=${d.frames.length} (기대 ${n})`);
  assert.strictEqual(d.frames[0].length, d.size, `${id} 첫행 길이 = size`);
  console.log(`${id}: size=${d.size} frames=${d.frames.length}`);
}

// 3) BOSS versions
assert.strictEqual(BOSS.versions.length, 2);
assert.strictEqual(BOSS.versions[0].t, 300, '약한 버전 5분(300s)');
assert.strictEqual(BOSS.versions[1].t, 600, '강한 버전 10분(600s)');
assert.ok(BOSS.versions[1].hp > BOSS.versions[0].hp, '강한 버전 체력 더 큼');
console.log('BOSS:', BOSS.versions.map((v) => `t=${v.t} hp=${v.hp} dmg=${v.dmg} count=${v.count}`).join(' | '));
console.log('m14 probe ok');
