// 18단계: 레벨업 창 상태기계 단위 시험 (node game/tests/levelup.test.mjs)
import assert from 'node:assert';
import { gainLevels, openChoice, pickChoice } from '../src/levelup.js';
import { xpToNext } from '../src/xp.js';

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mk = () => ({ level: 1, lvXp: 0, levelupPending: 0, choosing: false, cards: [], cardLock: 0,
  weapons: [], items: [], player: { regen: 0, hp: 50, maxHp: 100, itemStats: { cd: 1, area: 1 } },
  magnetMul: 1, speedMul: 1, talismanBonus: 0, talismanCdMul: 1 });

// 1) 경험치 미달이면 레벨·창 없음
let s = mk();
s.lvXp = xpToNext(1) - 1;
assert.strictEqual(gainLevels(s), 0);
assert.strictEqual(openChoice(s, rng32(1)), false);
assert.strictEqual(s.choosing, false);

// 2) 한 번에 두 레벨: 레벨 3, 창 열림(Lv 2 부터)
s = mk();
s.lvXp = xpToNext(1) + xpToNext(2) + 1;
assert.strictEqual(gainLevels(s), 2);
assert.strictEqual(s.level, 3);
assert.strictEqual(s.lvXp, 1);
assert.ok(openChoice(s, rng32(2)));
assert.strictEqual(s.choosing, true);
assert.strictEqual(s.cards.length, 3);
assert.strictEqual(s.chooseLv, 2);

// 3) 잠금 중엔 못 고름, 잠금 풀리면 고름 → 다음 창은 Lv 3
assert.strictEqual(pickChoice(s, 0, rng32(3)), false);
s.cardLock = 0;
assert.strictEqual(pickChoice(s, 1, rng32(3)), true);
assert.strictEqual(s.levelupPending, 1);
assert.strictEqual(s.choosing, true, '남은 레벨업 → 다음 창');
assert.strictEqual(s.chooseLv, 3, '다음 창은 다른 Lv 숫자');

// 4) 마지막 선택 뒤 창 닫힘(같은 창이 다시 뜨지 않음)
s.cardLock = 0;
assert.strictEqual(pickChoice(s, 2, rng32(4)), true);
assert.strictEqual(s.choosing, false);
assert.strictEqual(s.levelupPending, 0);
assert.strictEqual(s.cards.length, 0);
assert.strictEqual(openChoice(s, rng32(5)), false);
assert.strictEqual(pickChoice(s, 0, rng32(5)), false, '창 없으면 1/2/3 무시');

console.log('levelup ok');
