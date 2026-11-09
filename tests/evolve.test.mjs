// evolve.js 단위 시험 (node:assert) — 순수 함수만 import
import assert from 'node:assert';
import { EVOLVE, evolveReady, evolveDue, startEvolveTimer, updateEvolve, evolveStats, applyEvolve } from '../src/evolve.js';

// 1) 조건: 적 100마리 + 레벨 5
assert.ok(evolveReady(100, 5), '100처치·Lv5 → 준비됨');
assert.ok(!evolveReady(99, 5), '99처치 → 아직');
assert.ok(!evolveReady(100, 4), '레벨 4 → 아직');
assert.ok(!evolveReady(0, 50), '처치 0 → 아직');
assert.ok(!evolveReady(null, null), 'null → 아직');
assert.ok(!evolveReady(-5, -5), '음수 → 아직');
assert.ok(evolveReady(101, 5), '101처치(그 이상) → 준비됨');

// 2) 타이머 시작: 한 판에 한 번, 조건 충족 순간
let s = { kills: 100, level: 5, evolveT: null };
assert.ok(startEvolveTimer(s) === true, '100처치·Lv5 → 타이머 시작');
assert.strictEqual(s.evolveT, EVOLVE.timer, '타이머 = 20초');
assert.ok(startEvolveTimer(s) === false, '이미 돌고 있어 재시작 안 함');
s = { kills: 99, level: 5, evolveT: null };
assert.ok(startEvolveTimer(s) === false, '99처치 → 시작 안 함');
assert.strictEqual(s.evolveT, null, '타이머 없음');
s = { kills: 100, level: 4, evolveT: null };
assert.ok(startEvolveTimer(s) === false, '레벨 4 → 시작 안 함');
s = { kills: 100, level: 5, evolveT: 15 };
assert.ok(startEvolveTimer(s) === false, '타이머 잔여 중에도 건드리지 않음');

// 3) 타이머 감쇠: 0 이하이면 0, null 은 그대로
s = { evolveT: 20 };
updateEvolve(s, 5);
assert.strictEqual(s.evolveT, 15, '5초 경과 → 15');
updateEvolve(s, 30);
assert.strictEqual(s.evolveT, 0, '너무 긴 dt → 0 이하가 아니라 0');
s = { evolveT: null };
updateEvolve(s, 1);
assert.strictEqual(s.evolveT, null, 'null(미시작/완료) → 그대로');
// 변신 판정
assert.ok(evolveDue(0), '0 → 변신 시각');
assert.ok(evolveDue(-3), '음수 → 변신 시각');
assert.ok(!evolveDue(15), '15 남아 → 아직');
assert.ok(!evolveDue(null), 'null(시작 안 함) → 변신 안 됨');

// 4) 변신 효과 산출(순수 — 입력 변경 없음)
const p0 = { maxHp: 100, hp: 60, speedMul: 1, invuln: 0 };
const snap = { maxHp: p0.maxHp, hp: p0.hp, speedMul: p0.speedMul, invuln: p0.invuln };
const st = evolveStats(p0, { evolveT: 0 });
assert.strictEqual(p0.hp, snap.hp, '순수함수: hp 변경 없음');
assert.strictEqual(p0.maxHp, snap.maxHp, '순수함수: maxHp 변경 없음');
assert.strictEqual(st.maxHp, 200, '최대 체력 +100');
assert.strictEqual(st.hp, 200, '체력 가득 회복');
assert.ok(Math.abs(st.speedMul - 1.5) < 1e-9, '이속 1.5배');
assert.strictEqual(st.speedBonusT, EVOLVE.speedDur, '이속 지속 20초');
assert.ok(st.invuln >= EVOLVE.invuln, '무적 5초');
assert.ok(Math.abs(st.evolveDmg - 2) < 1e-9, '특수: 무기 피해 2배(+100%)');
assert.ok(Math.abs(st.evolveCd - 0.7) < 1e-9, '특수: 쿨다운 0.7배(-30%)');

// 5) applyEvolve: 플레이어·무기·상태 실제 반영
const p1 = { maxHp: 100, hp: 50, speedMul: 1, speedBonusT: 0, invuln: 0 };
const weapons = [
  { id: 'talisman', level: 1 },
  { id: 'spear', level: 4 },   // 4 이상 → 올리지 않음
  { id: 'fan', level: 2 },     // 4 미만 → 4로
];
const s1 = { evolveT: 0, evolved: false, evolveDmg: 1, evolveCd: 1 };
applyEvolve(s1, p1, weapons);
assert.strictEqual(p1.maxHp, 200, '최대 체력 200');
assert.strictEqual(p1.hp, 200, '체력 가득');
assert.ok(Math.abs(p1.speedMul - 1.5) < 1e-9, '이속 1.5배');
assert.strictEqual(p1.speedBonusT, 20, '이속 타이머 20초');
assert.ok(p1.invuln >= 5, '무적 5초');
assert.strictEqual(weapons[0].level, 4, 'Lv1 무기 → 4');
assert.strictEqual(weapons[1].level, 4, 'Lv4 무기 → 그대로(올림 없음)');
assert.strictEqual(weapons[2].level, 4, 'Lv2 무기 → 4');
assert.ok(s1.evolved === true, 'evolved 플래그');
assert.strictEqual(s1.evolveT, null, '타이머 완료(null)');
assert.ok(Math.abs(s1.evolveDmg - 2) < 1e-9, '피해 배율 저장');
assert.ok(Math.abs(s1.evolveCd - 0.7) < 1e-9, '쿨다운 배율 저장');

// 재적용 안전: 이미 변신 상태면 효과 재적용(무기 레벨 4 유지)
applyEvolve(s1, p1, weapons);
assert.strictEqual(p1.maxHp, 300, '재적용 시 다시 +100 (상한 없음 — 재시작 전 1회라 실제 1회)');
assert.strictEqual(weapons[0].level, 4, '4 이상 → 올리지 않음');

console.log('evolve ok');
