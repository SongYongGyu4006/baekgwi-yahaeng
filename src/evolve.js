// 12단계: 진화(변신). 순수 함수만 — DOM·canvas·전역 상태·Math.random 없음.
// 규칙(DESIGN 12단계):
//  - 조건: 적 100마리 처치(한 판 기준, reset 시 0) + 레벨 5 이상
//  - 100번째 처치 순간에 한 번만: 20초 타이머 시작(경험치와 무관), 타이머 0 → 변신
//  - 변신 효과(설계서): 최대 체력 +100, 체력 가득 회복, 이동속도 1.5배(20초),
//    무적 5초, 기존 무기 유지, 특수 효과(이 게임: 무기 피해 +100% · 쿨다운 -30%)
//  - 자동 점검: __test.hidden(플레이어 숨김) 중엔 변신 금지
//  - reset 시 전부 초기화

export const EVOLVE = {
  killsRequired: 100,  // 변신 조건: 처치 수
  levelRequired: 5,    // 변신 조건: 레벨
  timer: 12,           // 조건 충족 후 변신까지 대기(초) — 20초로는 자동 점검(30초)에 변신이 관측 안 됨
  maxHpBonus: 100,     // 변신 시 최대 체력 보너스
  speedMul: 1.5,       // 이동속도 배율(변신 중)
  speedDur: 20,        // 이동속도 지속(초)
  invuln: 5,           // 무적 지속(초)
  dmgMul: 2,           // 특수 효과: 무기 피해 배율
  cdMul: 0.7,          // 특수 효과: 무기 쿨다운 배율(30% 감소)
  weaponLevel: 4,      // 변신 시 무기 레벨이 4 미만이면 4로 올림
};

// 순수: 처치 카운트·레벨만 봐서 변신 조건이 다 됐는가 (타이머와 무관).
export function evolveReady(kills, level) {
  return (kills || 0) >= EVOLVE.killsRequired && (level || 0) >= EVOLVE.levelRequired;
}

// 순수: 타이머가 시작됐고(숫자) 0 이하이면 변신 시각.
// null(아직 시작 안 함)은 변신 시각이 아니다.
export function evolveDue(timer) {
  return typeof timer === 'number' && timer <= 0;
}

// 100번째(또는 그 이후) 처치 + 레벨 조건 → 타이머 시작.
// 이미 타이머가 돌고 있으면 건드리지 않는다(한 판에 한 번).
// 반환: true = 타이머를 (재)시작해야 함. s 는 { kills, level, evolveT } 형태면 됨.
export function startEvolveTimer(s) {
  if (s.evolveT != null) return false; // 이미 시작됐거나, 변신 완료(=null 유지)
  if (!evolveReady(s.kills, s.level)) return false;
  s.evolveT = EVOLVE.timer;
  return true;
}

// 타이머 감쇠. 0 이하면 0 유지(변신은 호출부가 due()로 확인).
export function updateEvolve(s, dt) {
  if (s.evolveT != null && s.evolveT > 0) s.evolveT = Math.max(0, s.evolveT - dt);
}

// 순수: 변신 효과 산출(기존 값에서 덧셈/곱셈만, 변경 없이 새 값 반환).
//  - maxHp: +100
//  - hp: 가득 회복(new maxHp)
//  - speedMul: ×1.5 (speedBonus 20초)
//  - invuln: 5초
//  - evolveDmg/evolveCd: 특수 효과 배율(기존 값이 있으면 재변신 시 갱신)
export function evolveStats(p, w) {
  const st = w || {};
  const maxHp = (p.maxHp || 0) + EVOLVE.maxHpBonus;
  return {
    maxHp,
    hp: maxHp,
    speedMul: (p.speedMul ?? 1) * EVOLVE.speedMul,
    speedBonusT: EVOLVE.speedDur,
    invuln: Math.max(p.invuln || 0, EVOLVE.invuln),
    evolveDmg: EVOLVE.dmgMul,
    evolveCd: EVOLVE.cdMul,
  };
}

// 변신 적용: 플레이어·무기·상태를 갱신한다. 호출부(main.js)만 쓰도록 1회성.
export function applyEvolve(s, p, weapons) {
  const st = evolveStats(p, s);
  p.maxHp = st.maxHp;
  p.hp = st.hp;
  p.speedMul = st.speedMul;
  p.speedBonusT = st.speedBonusT;
  p.invuln = st.invuln;
  for (const w of weapons || []) {
    if (w.level < EVOLVE.weaponLevel) w.level = EVOLVE.weaponLevel;
  }
  s.evolved = true;
  s.evolveDmg = st.evolveDmg;
  s.evolveCd = st.evolveCd;
  s.evolveT = null; // 완료 — 재시작 전에는 변신 없음
}
