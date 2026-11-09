// 순수 함수: 데미지·치명·방어·넉백 계산 (설계서 6.2)
export const CRIT_CHANCE = 0.05; // 치명 확률 5%
export const CRIT_MULT = 2.0; // 치명 배율 2배

// 최종피해 = floor(기본피해 * (1 + 공격력보너스) * 치명배율) → 방어 차감 → 최소 1
export function calcDamage(base, atkBonus = 0, crit = false, def = 0) {
  const mult = crit ? CRIT_MULT : 1;
  const raw = Math.floor(base * (1 + atkBonus) * mult);
  return Math.max(1, raw - (def || 0));
}

// 넉백: 공격 방향(nx, ny) 단위 벡터, 힘은 피해에 비례하고 18px로 상한.
// (0,0) 방향이면 힘을 0으로 돌려 힘만 반환해 호출쪽에서 방향을 다시 잡게 한다.
export function calcKnockback(dmg, nx, ny) {
  const len = Math.hypot(nx, ny);
  if (len === 0) return { dx: 0, dy: 0, power: 0 };
  const power = Math.min(18, Math.max(2, dmg * 0.5));
  return { dx: (nx / len) * power, dy: (ny / len) * power, power };
}
