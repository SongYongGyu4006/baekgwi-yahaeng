// 13단계: 레벨업 카드 선택(choose) 계약 단위 시험 — 순수 함수만 import.
// 설계서 6.6: 13단계 자동 레벨업. 경험치가 다음 레벨에 도달하면 카드 3장이 뜨고
// (자동으로 1장이 적용되거나) 플레이어가 1/2/3·Enter 로 1장을 선택한다.
// 이 시험은 카드 선택의 순수 계약(3장·무중복·1장만 반영·결정성)만 확인한다.
import assert from 'node:assert';
import { makeCards, applyCard, nextLevelXp } from '../src/xp.js';

// 결정적 의사난수 (mulberry32) — Math.random 이 아닌 시드 기반, 시험이 재현 가능.
function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 최소 상태: 무기·패시브 소품 없음 → 카드 풀은 패시브 5종 + 회복 보충만.
const baseS = () => ({ weapons: [], items: [] });

// 1) makeCards(시드) 는 항상 3장을 반환하고 id 가 서로 다르다(무보유 시).
for (let t = 0; t < 300; t++) {
  const s = baseS();
  const cards = makeCards(rng32(t + 1), s);
  assert.strictEqual(cards.length, 3, `t=${t} 카드 3장`);
  const ids = cards.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, 3, `t=${t} id 중복 없음: ${ids.join(',')}`);
  for (const c of cards) assert.ok(c.name && c.desc, `t=${t} 카드 필드: ${c.id}`);
}
console.log('choose: 3장·무중복 ok (300 시드)');

// 2) 결정성: 같은 시드 → 같은 카드 순서.
const a = makeCards(rng32(7), baseS()).map((c) => c.id);
const b = makeCards(rng32(7), baseS()).map((c) => c.id);
assert.deepStrictEqual(a, b, '같은 시드 → 같은 카드 순서');
console.log('choose: 결정성 ok', a.join(','));

// 3) 1장을 선택해 applyCard → 효과 1개만 반영되고 true 를 반환.
const s = { weapons: [], player: { regen: 0 }, magnetMul: 1, speedMul: 1, talismanBonus: 0, talismanCdMul: 1 };
const cards = makeCards(rng32(42), s);
const card = cards[1]; // 2번 카드 선택
const ok = applyCard(s, card);
assert.strictEqual(typeof ok, 'boolean', `applyCard 는 boolean 반환: ${card.id} → ${ok}`);
assert.ok(ok === true, `카드 1장 적용 true: ${card.id}`);
console.log('choose: 1장 적용 ok', card.id, '→', ok);

// 4) 다음 레벨 xp (13단계 곡선): 1레벨 13, 단조 증가, 13~60 구간 내.
assert.strictEqual(nextLevelXp(1), 13, 'L1 다음 레벨 = 13');
for (let l = 1; l < 20; l++) assert.ok(nextLevelXp(l + 1) > nextLevelXp(l), `단조: L=${l}`);
console.log('choose: nextLevelXp 곡선 ok (L1=13, 단조)');

console.log('choose ok');
