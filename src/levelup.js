// 18단계: 레벨업 창(선택 대기) 상태기계 — DOM 없음, rng 주입(순수에 가깝게).
//   경험치(s.lvXp)가 xpToNext(레벨)(설계서 6.6: 5,10,16…)을 넘으면 레벨이 오르고
//   levelupPending(고를 카드 수)이 1 늘어난다. 고를 카드가 있으면 창을 연다
//   (s.choosing=true) — main.js 는 창이 열려 있는 동안 시뮬레이션(적·시간·체력)을
//   멈춘다. 1/2/3/Enter 로 고르면 카드 1장 적용 → 창 닫힘 → 남은 게 있으면
//   새 카드 3장으로 다음 창(제목의 Lv 숫자도 그 레벨로 바뀜).
import { xpToNext, makeCards, applyCard } from './xp.js';

export const AUTO_PICK_MS = 3000; // 창을 이만큼(실시간) 두면 1번 카드 자동 선택

// 쌓인 경험치로 레벨을 올린다. 반환: 이번에 오른 횟수.
export function gainLevels(s) {
  let n = 0;
  while ((s.lvXp || 0) >= xpToNext(s.level || 1)) {
    s.lvXp -= xpToNext(s.level || 1);
    s.level = (s.level || 1) + 1;
    s.levelupPending = (s.levelupPending || 0) + 1;
    n++;
  }
  return n;
}

// 고를 카드가 남아 있고 창이 닫혀 있으면 연다. 반환: 새로 열었는가.
export function openChoice(s, rng, now = 0) {
  if (s.choosing || !(s.levelupPending > 0)) return false;
  s.cards = makeCards(rng || Math.random, s);
  s.choosing = true;
  s.chooseAt = now;
  s.levelupT = 0;
  s.cardLock = 0.2; // 이동 중 누른 키가 바로 카드를 고르지 않게 짧은 잠금
  // 창 제목에 보일 레벨: 아직 고르지 않은 것 중 가장 앞 레벨
  s.chooseLv = (s.level || 1) - s.levelupPending + 1;
  return true;
}

// i 번째(0..2) 카드를 고른다. 반환: 적용했는가.
export function pickChoice(s, i, rng, now = 0) {
  if (!s.choosing || (s.cardLock || 0) > 0) return false;
  const cards = s.cards || [];
  let ok = cards[i] ? applyCard(s, cards[i]) : false;
  // 적용 실패(슬롯 가득 등)면 다른 카드 → 그래도 안 되면 회복
  for (let k = 0; !ok && k < cards.length; k++) if (k !== i) ok = applyCard(s, cards[k]);
  if (!ok) applyCard(s, { id: 'heal', kind: 'passive' });
  s.levelupPending = Math.max(0, (s.levelupPending || 0) - 1);
  s.choosing = false;
  s.cards = [];
  openChoice(s, rng, now); // 더 고를 게 있으면 다음 창(다른 Lv 표시)
  return true;
}
