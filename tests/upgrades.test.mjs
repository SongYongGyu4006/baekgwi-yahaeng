// 11단계: upgrades.js 단위 시험 (node:assert) — 순수 함수만 import
import assert from 'node:assert';
import { ITEMS, MAX_ITEM_SLOTS, MAX_LEVEL, itemLevel, canAdd, addItem, itemStats, rollCards, healCard } from '../src/upgrades.js';

// 0) 정의: 8종, id·name·max·per·color
assert.strictEqual(ITEMS.length, 8, '8종');
for (const d of ITEMS) {
  assert.ok(d.id && d.name && d.max > 0 && Number.isFinite(d.per) && d.color, '정의 필드: ' + d.id);
  assert.strictEqual(d.max, MAX_LEVEL, d.id + ' max = 5');
}

// 1) 레벨 0 = 기본값 (indexOf -1 → 0), 레벨 5 = per*5
assert.strictEqual(itemLevel([], 'power'), 0, '레벨 0 (없음)');
const one = ['power'];
assert.strictEqual(itemLevel(one, 'power'), 1, '레벨 1 (첫 추가)');
assert.strictEqual(itemLevel(one, 'boots'), 0, '다른 것 레벨 0');
const five = ['power', 'power', 'power', 'power', 'power'];
assert.strictEqual(itemLevel(five, 'power'), 5, '레벨 5 (5번 추가)');
// itemStats: 레벨 캐시 객체 { [id]: lv, cd: 1, area: 1 }
const st0 = itemStats([]);
assert.strictEqual(st0.power, undefined, '빈 stats');
assert.strictEqual(st0.cd, 1, 'cd 기본 1');
assert.strictEqual(st0.area, 1, 'area 기본 1');
const st1 = itemStats(one);
assert.strictEqual(st1.power, 1, 'power Lv1');
assert.strictEqual(st1.cd, 1, 'cd 1 (없음)');
assert.strictEqual(st1.area, 1, 'area 1 (없음)');
const st5 = itemStats(five);
assert.strictEqual(st5.power, 5, 'power Lv5');
// cd(음수)는 1+per*lv: Lv5 = 1-0.4=0.6
const stH = itemStats(['haste', 'haste', 'haste', 'haste', 'haste']);
assert.strictEqual(stH.haste, 5, 'haste Lv5');
assert.strictEqual(stH.cd, 1, 'cd 1 (onItem 이 갱신)');
assert.strictEqual(stH.area, 1, 'area 1 (onItem 이 갱신)');

// 2) 만렙 소품은 후보에서 제외
{
  const items = ['power', 'power', 'power', 'power', 'power']; // power Lv5 (만렙)
  let sawPower = false, other = 0;
  for (let t = 0; t < 200; t++) {
    const c = rollCards(items, Math.random);
    assert.strictEqual(c.length, 3, '3장');
    for (const card of c) {
      if (card.id === 'power') sawPower = true;
      else other++;
    }
  }
  assert.strictEqual(sawPower, false, '만렙 power 는 후보에서 제외');
  assert.ok(other > 0, '다른 후보는 있음');
}

// 3) 슬롯 가득(6) → 신규 소품 제외, 보유 강화만
{
  const items = ['power', 'boots', 'magnet', 'regen', 'armor', 'heart']; // 6종, 전부 Lv1 (슬롯 가득)
  const fullSet = new Set(items);
  for (let t = 0; t < 200; t++) {
    const c = rollCards(items, Math.random);
    assert.strictEqual(c.length, 3, '3장');
    for (const card of c) {
      assert.ok(fullSet.has(card.id), '슬롯 가득 → 보유 강화만: ' + card.id);
      assert.ok(card.cur === 1 && card.next === 2, 'Lv1 → Lv2');
    }
  }
}

// 4) 카드 3장에 중복 없음 (rng 주입, 결정적)
{
  let n = 12345;
  const rng = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  for (let t = 0; t < 500; t++) {
    const c = rollCards([], rng);
    assert.strictEqual(c.length, 3, '3장');
    const ids = c.map((x) => x.id);
    assert.strictEqual(new Set(ids).size, 3, `중복 없음: ${ids.join(',')}`);
  }
}

// 5) 후보 0 (전부 만렙) → 회복 카드 1장
{
  const items = [];
  for (const d of ITEMS) for (let i = 0; i < d.max; i++) items.push(d.id); // 8종 전부 Lv5
  const c = rollCards(items, Math.random);
  assert.strictEqual(c.length, 1, '후보 0 → 1장');
  assert.strictEqual(c[0].id, 'heal', '회복 카드');
  assert.ok(c[0].kind === 'heal', 'kind heal');
  assert.strictEqual(healCard().id, 'heal', 'healCard()');
}

// 6) addItem 상한 너버 → 레벨이 max(5)를 넘지 않음
{
  const items = [];
  for (let i = 0; i < 99; i++) addItem(items, 'power'); // 99번
  assert.strictEqual(itemLevel(items, 'power'), 5, 'power 5 (max) — 99번 추가해도 5');
  assert.strictEqual(items.length, 5, '슬롯에 5 개');
  // 다른 소품도 슬롯 여유 있음 (5 < 6)
  assert.strictEqual(canAdd(items, 'boots'), true, 'boots 추가 가능');
  addItem(items, 'boots');
  assert.strictEqual(items.length, 6, '슬롯 6 (상한)');
  // 슬롯 가득 → 신규 불가, 만렙 강화도 불가
  assert.strictEqual(canAdd(items, 'magnet'), false, '슬롯 가득 → 신규 불가');
  assert.strictEqual(addItem(items, 'magnet'), false, 'magnet 추가 실패');
  assert.strictEqual(addItem(items, 'power'), false, '만렙+슬롯 → 실패');
  assert.strictEqual(items.length, 6, '슬롯 유지 6');
}

// 7) canAdd: 신규(슬롯 남은) 가능, 만렙 불가
{
  assert.strictEqual(canAdd([], 'power'), true, '빈 슬롯 → 신규 가능');
  assert.strictEqual(canAdd(['power', 'power', 'power', 'power', 'power', 'boots'], 'power'), false, '슬롯 가득 + 만렙 → 불가');
  assert.strictEqual(canAdd(['power'], 'power'), true, '보유 Lv1 → 강화 가능');
  assert.strictEqual(canAdd(['power', 'power', 'power', 'power', 'power'], 'power'), false, '만렙 → 불가');
}

console.log('upgrades ok 8');
