// xp.js 단위 시험 (node:assert) — 순수 함수만 import
import assert from 'node:assert';
import { xpToNext, orbValue, applyXp, makeCards, applyCard } from '../src/xp.js';

// 1) 1레벨 값 5, 설계서 6.6 공식: 5 + (L-1)*4 + floor((L-1)^1.6)
assert.strictEqual(xpToNext(1), 5, '1레벨 필요값 5');
assert.strictEqual(xpToNext(2), 10, '2레벨 필요값 10 (5+4+0)');
assert.strictEqual(xpToNext(3), 16, '3레벨 필요값 16 (5+8+3)');
assert.ok(xpToNext(20) > xpToNext(10), '20레벨 > 10레벨 필요값');
assert.ok(xpToNext(20) > 100 && xpToNext(20) < 200, '20레벨 부근 100~200(약 150)');
// 음수·소수·0 입력은 1레벨로
assert.strictEqual(xpToNext(0), 5, '0 → 1레벨');
assert.strictEqual(xpToNext(-3), 5, '음수 → 1레벨');
assert.strictEqual(xpToNext(2.9), xpToNext(2), '소수는 내림');

// 2) 1~50레벨 단조 증가
for (let l = 1; l < 50; l++) {
  assert.ok(xpToNext(l + 1) > xpToNext(l), `단조 증가: L=${l}`);
}

// 3) 구슬 값: 정수 ≥ 1, 단조 비감소
assert.ok(Number.isInteger(orbValue(1)) && orbValue(1) >= 1, 'orbValue(1) 정수 ≥1');
assert.strictEqual(orbValue(1), 1, '작은 구슬 1');
assert.strictEqual(orbValue(5), 5, '중간 구슬 5');
assert.strictEqual(orbValue(20), 20, '큰 구슬 20');
assert.strictEqual(orbValue(0), 1, '0 → 1');
assert.strictEqual(orbValue(null), 1, 'null → 1');
for (let i = 0; i < 1000; i++) {
  const a = i % 101, b = a + 1;
  assert.ok(orbValue(b) >= orbValue(a), `단조 비감소: ${a}→${b}`);
}

// 4) applyXp: 정확히 차면 레벨업, xp는 0
const r1 = applyXp(1, 0, 5);
assert.deepStrictEqual({ level: r1.level, xp: r1.xp, leveled: r1.leveled },
  { level: 2, xp: 0, leveled: 1 }, '5xp → Lv2, 잔여 0');
const r2 = applyXp(1, 0, 4);
assert.deepStrictEqual({ level: r2.level, xp: r2.xp, leveled: r2.leveled },
  { level: 1, xp: 4, leveled: 0 }, '4xp → Lv1 유지, 잔여 4');
const r3 = applyXp(1, 4, 1);
assert.deepStrictEqual({ level: r3.level, xp: r3.xp, leveled: r3.leveled },
  { level: 2, xp: 0, leveled: 1 }, '잔여 4 + 1 → Lv2');

// 5) 큰 값: 여러 레벨이 오르고 xp < xpToNext(level)
const r4 = applyXp(1, 0, 1000);
assert.ok(r4.level > 5, '1000xp → 5레벨 이상 올라감: ' + r4.level);
assert.ok(r4.leveled === r4.level - 1, 'leveled = 오른 횟수');
assert.ok(r4.xp >= 0 && r4.xp < xpToNext(r4.level), '잔여 xp < 다음 레벨 필요값: ' + r4.xp);
// 누적 검산: 전체 xp 가 레벨 커브에 정확히 대응
let lv = 1, total = 0;
while (lv < r4.level) { total += xpToNext(lv); lv++; }
assert.strictEqual(total + r4.xp, 1000, '경험치 보존');

// 6) makeCards: 길이 3, id 서로 다름, 알려진 id
const fakeRng = (() => { let n = 1; return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; })();
for (let t = 0; t < 200; t++) {
  const cards = makeCards(fakeRng);
  assert.strictEqual(cards.length, 3, '카드 3장');
  const ids = cards.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, 3, `id 중복 없음: ${ids.join(',')}`);
  for (const c of cards) {
    assert.ok(c.name && c.desc, `카드 필드: ${c.id}`);
    assert.ok(typeof c.name === 'string' && typeof c.desc === 'string', '이름·설명 문자열');
  }
}

// 7) applyCard: 임시 카드 효과 실제로 반영
const fakeS = (extra = {}) => ({
  player: { regen: 0 },
  magnetMul: 1, speedMul: 1,
  talismanBonus: 0, talismanCdMul: 1,
  ...extra,
});
let s = fakeS();
assert.strictEqual(applyCard(s, makeCards(() => 0)[0] && null), false, 'null 카드 → false');
s = fakeS();
applyCard(s, { id: 'talisman_dmg' });
applyCard(s, { id: 'talisman_dmg' });
assert.strictEqual(s.talismanBonus, 0.5, '부적 강화 2회 = +50% 상한');
s = fakeS();
applyCard(s, { id: 'talisman_cd' });
assert.ok(Math.abs(s.talismanCdMul - 0.9) < 1e-9, '부적 속사 -10%');
s = fakeS();
applyCard(s, { id: 'magnet' });
assert.ok(Math.abs(s.magnetMul - 1.25) < 1e-9, '자석 +25%');
s = fakeS();
applyCard(s, { id: 'move_speed' });
assert.ok(Math.abs(s.speedMul - 1.1) < 1e-9, '이속 +10%');
s = fakeS();
applyCard(s, { id: 'regen' });
assert.ok(Math.abs(s.player.regen - 0.3) < 1e-9, '재생 +0.3');

console.log('xp ok');
