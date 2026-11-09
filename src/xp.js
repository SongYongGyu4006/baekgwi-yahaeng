// 순수 함수: 경험치·레벨업 곡선·구슬 값·레벨업 카드 (DOM·Math.random 없음).
// 수치표: 설계서 6.6 — 다음 레벨 필요 경험치 = 5 + (L-1)*4 + floor((L-1)^1.6)

// 현재 레벨 L 이 다음 레벨에 필요한 경험치. 1레벨 = 5, 단조 증가.
export function xpToNext(level) {
  const l = Math.max(1, Math.floor(level));
  return 5 + (l - 1) * 4 + Math.floor(Math.pow(l - 1, 1.6));
}

// 구슬 값: 적 정의의 xp(1/3/5/20/100) → 정수, 최소 1.
export function orbValue(enemyXp) {
  return Math.max(1, Math.floor(enemyXp || 1));
}

// gain 만큼 경험치 추가. 한 번에 여러 레벨이 오를 수 있으니 while 로 처리.
// 반환: { level, xp(잔여), leveled(오른 횟수) }
export function applyXp(level, xp, gain) {
  let lv = Math.max(1, Math.floor(level));
  let cur = xp + gain;
  let leveled = 0;
  while (cur >= xpToNext(lv)) {
    cur -= xpToNext(lv);
    lv += 1;
    leveled += 1;
  }
  return { level: lv, xp: cur, leveled };
}

// 다음 레벨의 경험치(설계서 6.6): 5 + L*4 + floor(L^1.6), L=현재 레벨, 하한 1.
// L1→8, L2→14, L3→22, L4→32, L5→43 ... (레벨이 오를수록 느려지는 곡선)
export function nextLevelXp(level) {
  const L = Math.max(1, Math.floor(level));
  return Math.max(1, Math.round((5 + L * 4 + Math.floor(Math.pow(L, 1.6))) * 1.28));
}

// 8단계 임시 패시브 카드 풀 (부적 강화·속사·자석·신속·호흡).
const PASSIVE_POOL = [
  { id: 'talisman_dmg',  kind: 'passive', name: '부적 강화', desc: '부적 피해 +25%' },
  { id: 'talisman_cd',   kind: 'passive', name: '부적 속사', desc: '부적 쿨다운 -10%' },
  { id: 'magnet',        kind: 'passive', name: '자석 확대', desc: '자석 반경 +25%' },
  { id: 'move_speed',    kind: 'passive', name: '신속',       desc: '이동 속도 +10%' },
  { id: 'regen',         kind: 'passive', name: '호흡',       desc: '초당 체력 재생 +0.3' },
];

// 10단계: 무기 카드 (신규 무기 획득 / 보유 무기 강화). config 무기 이름 + 슬롯 상한.
// (순환 import 없음: weapons.js → config/combat/art/audio/fx, xp.js 는 config+weapons 만)
import { WEAPONS, MAX_WEAPON_SLOTS } from './config.js';
import { applyWeaponCard } from './weapons.js';
import { rollCards as rollItemCards, addItem } from './upgrades.js';
import { onItem } from './player.js';
const WEAPON_NAME = { fan: '부채바람', bell: '방울', dokkaebi: '도깨비불', spear: '죽창', janggu: '장구', thunder: '벼락', ink: '먹물' };

// 무기 후보를 카드 형태로 (new/up). weapons.js 에서 슬롯·Lv8 가드를 거친다.
function weaponCards(s) {
  const cards = [];
  const pool = (s && s.weapons) ? s.weapons : [];
  // 신규 무기: 슬롯(6)이 남았을 때만. 8종 중 미보유.
  if (s && pool.length < 6) {
    for (const id of Object.keys(WEAPON_NAME)) {
      if (!pool.some((w) => w.id === id)) cards.push({ kind: 'new', id, name: WEAPON_NAME[id], desc: '신규 무기' });
    }
  }
  // 보유 무기 강화: Lv8 미만만.
  for (const w of pool) {
    if (w.level < 8) cards.push({ kind: 'up', id: w.id, name: (WEAPON_NAME[w.id] || '무기') + ' Lv' + (w.level + 1), desc: '무기 강화' });
  }
  return cards;
}

// rng(0..1) 인자로 받아 순수하게 3장 뽑는다.
// 10단계: 무기 카드 + 패시브 카드. 11단계: 패시브 소품 카드 추가.
// (s 가 없으면 패시브만, 단위 시험 호환)
export function makeCards(rng, s) {
  const r = typeof rng === 'function' ? rng : () => Math.random();
  const pool = PASSIVE_POOL.slice();
  if (s) {
    for (const c of weaponCards(s)) pool.push(c);
    // 11단계: 패시브 소품 카드 (슬롯 남은 신규 + 보유 강화, 3장)
    for (const c of rollItemCards(s.items, r)) pool.push(c);
    // 셔플
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
  }
  // 3장을 고른다. 같은 종류(kind) 내 id 가 중복되지 않게 뽑는다(13단계).
  // (기존 splice 방식은 같은 id 가 2~3장 나오게 했다 — 500시드 중 2.2%. 같은
  //  카드를 2번 고를 수 있으므로, 같은 kind 내 이미 뽑은 id 는 제외한다.)
  //  무보유 시 패시브 5종(5≥3)·소품·무기는 각각 3종 이상이라 항상 3장 확보.
  const out = [];
  const seenId = new Set();
  let guard = 0;
  while (out.length < 3 && guard++ < 64) {
    if (!pool.length) break;
    const c = pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (seenId.has(c.id)) continue; // 같은 id 중복 방지
    seenId.add(c.id);
    out.push(c);
  }
  // (극히 드물게) 3장이 채워지지 않으면 회복으로 보충.
  while (out.length < 3) out.push({ id: 'heal', kind: 'passive', name: '회복', desc: '체력 +30' });
  return out;
}

// 카드 1장을 상태 s에 반영.
// 10단계: 무기 카드(kind 'new'/'up')는 weapons.js 의 applyWeaponCard 위임.
// 11단계: 패시브 소품 카드(kind 'item')는 upgrades.js 의 addItem.
// 패시브 카드는 8단계 임시 효과 그대로:
//  - talisman_dmg: 부적 무기(atkBonus) +25% — 10%씩 최대 5번(50%)
//  - talisman_cd:  부적 쿨다운 -10% — 10%씩 최대 5번
//  - magnet:       자석 반경 +25% / move_speed: 이동 +10% / regen: 체력 재생 +0.3
export function applyCard(s, card) {
  if (!card) return false;
  // 무기 카드(10단계): 신규 획득 or 강화
  if (card.kind === 'new' || card.kind === 'up') {
    return applyWeaponCard(s, card);
  }
  // 11단계: 패시브 소품 카드 — addItem 후 레벨 캐시 갱신 + onItem 통계 재계산
  if (card.kind === 'item') {
    const ok = addItem(s.items, card.id);
    if (!ok) return false; // 슬롯 가득·만렙 → 실패 (호출부가 다른 카드로 재도구)
    s.player.itemStats[card.id] = (s.player.itemStats[card.id] || 0) + 1;
    onItem(s);
    return true;
  }
  switch (card.id) {
    case 'talisman_dmg':
      s.talismanBonus = Math.min(0.5, (s.talismanBonus || 0) + 0.25);
      break;
    case 'talisman_cd':
      s.talismanCdMul = Math.max(0.5, (s.talismanCdMul ?? 1) * 0.9);
      break;
    case 'magnet':
      s.magnetMul = (s.magnetMul || 1) * 1.25;
      break;
    case 'move_speed':
      s.speedMul = (s.speedMul || 1) * 1.1;
      break;
    case 'regen':
      s.player.regen = (s.player.regen || 0) + 0.3;
      break;
    case 'heal':
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30);
      break;
    default:
      return false;
  }
  return true;
}
