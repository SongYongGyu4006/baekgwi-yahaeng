// combat.js 단위 시험 (node:assert)
// 검증: 최소 1 피해 보장, 치명 2배, 방어 차감, 넉백 계산
import assert from 'node:assert';
import { calcDamage, calcKnockback, CRIT_CHANCE, CRIT_MULT } from '../src/combat.js';

// 상수: 설계서 6.2
assert.strictEqual(CRIT_CHANCE, 0.05, '치명 확률 5%');
assert.strictEqual(CRIT_MULT, 2.0, '치명 배율 2배');

// 1) 기본: floor(기본피해 * (1 + 공격력보너스) * 치명배율)
assert.strictEqual(calcDamage(10, 0, false, 0), 10, '기본 10, 무보너스');
assert.strictEqual(calcDamage(10, 0.1, false, 0), 11, '공격력 +10% → floor(11)=11');
assert.strictEqual(calcDamage(10, 1, false, 0), 20, '공격력 +100% → 20');
assert.strictEqual(calcDamage(7, 0.05, false, 0), 7, 'floor(7.35)=7 (내림)');

// 2) 치명 2배
assert.strictEqual(calcDamage(10, 0, true, 0), 20, '치명 2배: 10→20');
assert.strictEqual(calcDamage(10, 0.5, true, 0), 30, '치명+보너스: floor(15*2)=30');

// 3) 방어 차감: max(1, 피해 - def)
assert.strictEqual(calcDamage(10, 0, false, 2), 8, '방어 2 → 8');
assert.strictEqual(calcDamage(10, 0, false, 10), 1, '방어 = 피해 → 0이 아니라 최소 1');
assert.strictEqual(calcDamage(10, 0, false, 50), 1, '방어 초과 → 최소 1 보장');
assert.strictEqual(calcDamage(20, 0, true, 50), 1, '치명해도 방어 초과 시 최소 1');

// 4) 넉백: 피해에 비례, 방향 단위 벡터, 이동량 상한
const kb = calcKnockback(10, 1, 0);
assert.ok(kb.dx > 0 && kb.dy === 0, '단위 방향 그대로 밀림');
assert.ok(kb.dx <= 18, '이동량 상한 18px');
const kb0 = calcKnockback(10, 0, 0); // 방향 (0,0) → 힘 0
assert.strictEqual(kb0.dx, 0);
assert.strictEqual(kb0.dy, 0);
assert.strictEqual(kb0.power, 0, '무방향 → 힘 0');
const kbDiag = calcKnockback(10, 1, 1); // 대각선 단위화
assert.ok(kbDiag.dx > 0 && kbDiag.dy > 0 && kbDiag.dx === kbDiag.dy, '대각선 대칭');
// 결정성: 같은 입력 → 같은 결과
assert.deepStrictEqual(calcKnockback(25, 3, -4), calcKnockback(25, 3, -4), '동일 입력 동일 결과');
assert.ok(calcKnockback(100, 1, 0).dx <= 18, '큰 피해도 상한 유지');

console.log('combat ok');
