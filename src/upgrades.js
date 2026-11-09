// 11단계: 패시브 소품(아이템) 8종과 강화 규칙.
// 순수 모듈 — DOM·canvas·전역 상태를 쓰지 않아 node에서 바로 import해 시험한다.
// items 표현: [id, ...] 배열. 인덱스 = 레벨-1 (배열 인덱스가 레벨이라 1-based 가독).
//  - level(id) = arr.indexOf(id) >= 0 ? indexOf+1 : 0
//  - addItem(id) = arr.push(id) (슬롯·만렙 가드는 호출부)
//  - canAdd(id) = 슬롯<상한 && (레벨==0 || 레벨<max)
//  - itemStats = { [id]: lv, cd: 1, area: 1 } 객체 (p.itemStats 캐시)
//  - rollCards: 슬롯 가득이면 보유 강화만, 아니면 신규+강화. 3장 중복 없음.
//               후보 0이면 회복 카드 1장.

export const MAX_ITEM_SLOTS = 6; // 무기 슬롯(MAX_WEAPON_SLOTS=6)과 같은 규칙
export const MAX_LEVEL = 5;      // 소품 만렙 5

// 8종: { id, name, max, per, key, mul, color, sprite, desc }. per = 1레벨당 증가율(최대=per*max).
//  - mul=false(기본): 곱셈 stat — speed/magnet = base * (1+Σper*lv) / maxHp = base + Σper*lv
//    - regen/def: 덧셈 — base + Σper*lv
//  - mul=true: 곱셈 — cd = 1+Σper (쿨다운, 음수=감소) / area = 1+Σper (범위, 양수=증가)
//    - atk: atkBonus = Σper*lv (무기 피해에 1+ 로 곱함)
//  - sprite: assets/sprites 의 소품 그림 id — HUD 아이콘 줄·카드에 drawSprite 로.
export const ITEMS = [
  { id: 'power',  name: '옥구슬',   max: 5, per: 0.10,  key: 'atk',    mul: true,  color: '#e88a3a', sprite: 'item_jade',        desc: '공격력 +10%' },
  { id: 'boots',  name: '짚신',     max: 5, per: 0.08,  key: 'speed',  color: '#6bbf59', sprite: 'item_straw_shoes', desc: '이동속도 +8%' },
  { id: 'magnet', name: '복주머니', max: 5, per: 0.25,  key: 'magnet', color: '#5f86ff', sprite: 'item_pouch',       desc: '자석 반경 +25%' },
  { id: 'regen',  name: '인삼',     max: 5, per: 0.4,   key: 'regen',  color: '#c8302b', sprite: 'item_ginseng',     desc: '초당 체력 재생 +0.4' },
  { id: 'armor',  name: '갓',       max: 5, per: 1,     key: 'def',    color: '#8a8f9c', sprite: 'item_gat',         desc: '받는 피해 -1' },
  { id: 'heart',  name: '달항아리', max: 5, per: 0.10,  key: 'maxHp',  color: '#d14b86', sprite: 'item_jar',         desc: '최대체력 +10%' },
  { id: 'haste',  name: '먹',       max: 5, per: -0.08, key: 'cd',     mul: true,  color: '#b06be0', sprite: 'item_ink',         desc: '무기 쿨다운 -8%' },
  { id: 'range',  name: '거울',     max: 5, per: 0.10,  key: 'area',   mul: true,  color: '#39c6c6', sprite: 'item_mirror',      desc: '무기 범위 +10%' },
];

const ITEM_BY_ID = {};
for (const d of ITEMS) ITEM_BY_ID[d.id] = d;

export function itemDef(id) {
  return ITEM_BY_ID[id] || null;
}

// 레벨 = 같은 id가 몇 번 중복되어 있는가 (추가할 때 뒤에 push 하므로).
// 레벨 0 = 기본값 (없음).
export function itemLevel(arr, id) {
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] === id) n++;
  return n;
}

export function canAdd(items, id) {
  const d = itemDef(id);
  if (!d) return false;
  if ((items || []).length >= MAX_ITEM_SLOTS) return false; // 슬롯 가득
  const lv = itemLevel(items, id);
  return lv === 0 || lv < d.max; // 신규 또는 만렙 아님
}

// 슬롯·만렙 가드 후 추가. 상한 너머 호출해도 max 를 넘지 않는다.
export function addItem(items, id) {
  if (!canAdd(items, id)) return false;
  items.push(id);
  return true;
}

// 효과 합산: 레벨 캐시 객체 { [id]: lv, cd: 1, area: 1 }.
//  - p.itemStats = [id] 키의 레벨 + cd/area 배율(1.0 시작) — onItem 이 cd/area 갱신.
//    wStat(weapons.js) 은 cd/area 를, onItem(player.js) 은 id별 레벨을 읽는다.
//  - 카드 선택 시에만 다시 계산(프레임마다 부르지 말 것).
export function itemStats(items) {
  const arr = Array.isArray(items) ? items : [];
  const stats = { cd: 1, area: 1 };
  for (const id of arr) stats[id] = (stats[id] || 0) + 1;
  return stats;
}

// 카드 3장: 신규(슬롯 남은 것)+보유 강화(Lv<5) 풀에서 3장.
// 슬롯 가득 → 보유 강화만. 후보 0 → 회복 카드 1장.
export function rollCards(items, rng = Math.random, n = 3) {
  const arr = Array.isArray(items) ? items : [];
  const full = arr.length >= MAX_ITEM_SLOTS;
  const pool = [];
  for (const d of ITEMS) {
    const lv = itemLevel(arr, d.id);
    if (lv >= d.max) continue;          // 만렙 제외
    if (lv === 0 && full) continue;     // 슬롯 가득 → 신규 제외
    pool.push(d.id);
  }
  const out = [];
  while (out.length < n && pool.length) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0]; // 뽑으면 제거 → 중복 없음
    const cur = itemLevel(arr, id);
    const d = itemDef(id);
    // 카드: 현재→다음 레벨 표시 (설계서 5: '이름, 설명, 현재→다음 레벨, 번호')
    out.push({ id, kind: 'item', name: d.name, cur, next: cur + 1, desc: `${d.desc}  (Lv${cur} → Lv${cur + 1})` });
  }
  if (!out.length) return [healCard()]; // 후보 0 → 회복 카드
  return out;
}

// 회복 카드: 체력을 회복한다.
export function healCard() {
  return { id: 'heal', kind: 'heal', name: '회복', cur: 0, next: 0, desc: '체력 30 회복' };
}
