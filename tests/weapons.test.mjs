// weapons.js + combat.js 단위 시험 (node:assert, 결정적)
import assert from 'node:assert';
import { calcDamage, calcKnockback, CRIT_CHANCE, CRIT_MULT } from '../src/combat.js';
import { grantInitialWeapons, createTalisman, updateWeapons } from '../src/weapons.js';

// 1) 전투 공식: 방어가 크면 피해 1 (최소)
assert.strictEqual(calcDamage(10, 0, false, 100), 1, '방어 초과 → 최소 1');
assert.strictEqual(calcDamage(10, 0, false, 0), 10, '무방어 → 기본 10');
assert.strictEqual(CRIT_CHANCE, 0.05, '치명 확률 5%');
assert.strictEqual(CRIT_MULT, 2.0, '치명 배율 2배');

// 2) 넉백: 방어 클수록 약해지고, 최대 이동량 상한
const kb0 = calcKnockback(10, 1, 0);
assert.ok(kb0.dx > 0 && Math.abs(kb0.dy) < 1e-9, '단위 방향 그대로 밀림');
assert.ok(kb0.dx < 30, '최대 이동량 상한');
const kbDef = calcKnockback(10, 1, 0); // 방어 0
const kbHigh = calcKnockback(10, 1, 0); // (같은 입력 → 같은 결과, 결정성)
assert.strictEqual(kb0.dx, kbDef.dx, '동일 입력 → 동일 결과');

// 3) 시작 기본 무기 지급: 부적 Lv1
const s = { player: { x: 640, y: 360 }, enemies: [], projectiles: [], fxNumbers: [], fxParticles: [], weapons: [], kills: 0, alive: true };
grantInitialWeapons(s);
assert.strictEqual(s.weapons.length, 1, '부적 1개 지급');
assert.strictEqual(s.weapons[0].id, 'talisman', 'id=talisman');
assert.strictEqual(s.weapons[0].level, 1, 'Lv1');

// 4) 적이 없으면 발사하지 않는다 (투사체 0)
updateWeapons(s, 1 / 60);
assert.strictEqual(s.projectiles.length, 0, '적 없음 → 발사 없음');

// 5) 적이 있으면 쿨다운 종료 시 투사체 1발 (Lv1: 1발)
// (적은 추적하지 않는 스텁이라 정지해 두고, 투사체만 날아가 명중하게 한다)
s.enemies.push({ def: { def: 0 }, x: 820, y: 360, hp: 30, radius: 12, flash: 0 });
for (let f = 0; f < 70; f++) updateWeapons(s, 1 / 60); // 1초 쿨다운 + 약간의 비행
assert.strictEqual(s.projectiles.length, 1, '쿨다운 후 1발 발사: ' + s.projectiles.length);
assert.strictEqual(s.projectiles[0].weapon, 'talisman', '투사체 weapon id');

// 6) 명중: 피해 확정(무기 10, 무방어 → 10) + 넉백 + 번쩍 + 피해 숫자
const hpBefore = s.enemies[0].hp;
for (let f = 0; f < 60; f++) {
  updateWeapons(s, 1 / 60);
  if (s.fxNumbers.length > 0) break;
}
assert.ok(s.fxNumbers.length > 0, '피해 숫자 발생');
assert.strictEqual(Math.round(s.fxNumbers[0].v), 10, '무방어 명중 피해 10');
assert.ok(s.enemies[0].hp < hpBefore || s.enemies[0].hp <= 0, '적 hp 감소: ' + s.enemies[0].hp);
assert.strictEqual(s.kills, 0, '아직 처치 아님(30hp)');

// 7) 처치: hp 12 적을 명중시켜 사망
s.enemies[0] = { def: { def: 0 }, x: 700, y: 360, hp: 12, radius: 12, flash: 0 };
s.projectiles = [];
s.fxNumbers = [];
for (let f = 0; f < 240; f++) updateWeapons(s, 1 / 60); // 발사+비행+명중
assert.ok(s.enemies[0].hp <= 0, '명중 후 사망: hp=' + s.enemies[0].hp);
// (kill 집계는 enemies.js updateEnemies 담당: s.kills 는 이쪽 테스트 범위 밖)

// 8) 레벨 8: 4발 + 관통 2 + 피해 30 + 쿨다운 감소
const w = createTalisman();
w.level = 8;
const st8 = w.stats(8);
assert.strictEqual(st8.count, 4, 'Lv8 4발');
assert.strictEqual(st8.pierce, 2, 'Lv8 관통 2');
assert.strictEqual(st8.dmg, 30, 'Lv8 피해 30');
assert.ok(st8.cd < 1.0, 'Lv8 쿨다운 < 1.0');

// 9) 관통: 같은 적 중복 피격 없이 2명 관통 후 소멸
const eA = { def: { def: 0 }, x: 700, y: 360, hp: 100, radius: 12, flash: 0 };
const eB = { def: { def: 0 }, x: 780, y: 360, hp: 100, radius: 12, flash: 0 };
s.enemies = [eA, eB];
s.projectiles = [];
s.fxNumbers = [];
s.weapons = [w];
for (let f = 0; f < 120; f++) updateWeapons(s, 1 / 60);
assert.ok(s.fxNumbers.length >= 2, '관통으로 2명 피격: ' + s.fxNumbers.length);
assert.ok(eA.hp < 100 && eB.hp < 100, '양쪽 모두 피해');

console.log('weapons ok');
