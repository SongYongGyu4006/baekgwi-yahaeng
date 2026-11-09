// 11단계 임시 검증 스크립트 — 카드 3종(신규/강화/소품)이 makeCards(s)에서 섞여 나오는지.
import assert from 'node:assert';
import { makeCards, applyCard } from '../src/xp.js';
import { WEAPONS } from '../src/config.js';
import { applyWeaponCard } from '../src/weapons.js';

const s = { player: { regen: 0, baseRegen: 0, speed: 200, magnetR: 100, itemStats: { cd: 1, area: 1 } }, magnetMul: 1, speedMul: 1, talismanBonus: 0, talismanCdMul: 1, items: [], weapons: [] };
applyWeaponCard(s, { kind: 'new', id: 'fan', name: '부채바람', desc: '신규 무기' });
assert.ok(s.weapons.some((w) => w.id === 'fan'), 'fan 획득됨');

// 여러 시드값으로: 무기(new/up) 카드·패시브·소품 카드가 섞여 3장
const kindsSeen = new Set();
for (let seed = 0; seed < 50; seed++) {
  const rng = (() => { let n = seed + 1; return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; })();
  const cards = makeCards(rng, s);
  assert.strictEqual(cards.length, 3, '카드 3장 (시드 ' + seed + ')');
  for (const c of cards) {
    assert.ok(['new', 'up', 'passive', 'item'].includes(c.kind), '알려진 kind: ' + c.kind);
    kindsSeen.add(c.kind);
  }
}
assert.ok(kindsSeen.has('new') || kindsSeen.has('up'), '무기 카드 등장: ' + [...kindsSeen]);
assert.ok(kindsSeen.has('item'), '소품 카드 등장: ' + [...kindsSeen]);
console.log('시드 50회 중 나타난 kind:', [...kindsSeen].join(', '));

// 소품 카드(옥구슬/power) 적용 → addItem + onItem(레벨 캐시 재계산)
const before = s.player.itemStats.power || 0;
let appliedPower = 0;
for (let i = 0; i < 400; i++) {
  const rng = (() => { let n = i * 7 + 13; return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; })();
  for (const c of makeCards(rng, s)) {
    if (c.id === 'power') {
      const ok = applyCard(s, c);
      if (ok) { appliedPower++; break; }
    }
  }
  if (appliedPower > 0 && s.player.itemStats.power === before + appliedPower) break;
}
assert.ok(appliedPower >= 1, 'power 카드 최소 1회 적용');
assert.strictEqual(s.player.itemStats.power, before + appliedPower, 'itemStats = 레벨 수');
assert.ok((s.items || []).length === (before + appliedPower), "items 배열 갱신: " + s.items.length);
console.log('power: items=', JSON.stringify(s.items), 'itemStats=', s.player.itemStats.power, '(적용', appliedPower, '회)');
// atkBonus 검증: power Lv5 = 0.50 (onItem 이 ITEMS 에서 계산)
s.player.itemStats.power = 5;
const { onItem } = await import('../src/player.js');
onItem(s);
console.log('atkBonus(power5):', s.player.atkBonus.toFixed(3));
assert.ok(Math.abs(s.player.atkBonus - 0.5) < 1e-9, 'atkBonus = 0.10*5 = 0.50');
// 스피드: base 200, boots Lv1 = 200 + 0.08*1*200 = 216 (onItem 이 덧셈으로 계산)
s.player.itemStats.power = 0;
s.player.itemStats.boots = 1;
s.player.speed = 200; // PLAYER.speed
onItem(s);
console.log('speed(boots1):', s.player.speed.toFixed(1));
assert.ok(Math.abs(s.player.speed - 216) < 0.1, 'speed = 200*1.08 = 216');
console.log('m11 probe ok');
