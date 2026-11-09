// 순수 함수: 적 생성량·시간 구간별 가중치·생성 위치 계산(설계서 6.5)
// Math.random/performance.now 을 안 쓰고 인자(rnd, t)로 받는다 → tests 가 고정.
import { SPAWN, SPAWN_BANDS } from './config.js';

// 체력 보정: 기본체력 * (1 + 0.12 * 분) — 설계서 6.4. hpScale(0)===1, 단조 증가.
export const HP_PER_MIN = 0.12;
export function hpScale(minute) {
  return 1 + Math.max(0, minute) * HP_PER_MIN;
}

// 시간 구간표에서 가중치 객체(REFERENCE 이름 tableAt). t(초) 기준.
export function tableAt(t) {
  const tt = Math.max(0, t);
  for (const band of SPAWN_BANDS) {
    if (tt < band.until) return band.weights;
  }
  return SPAWN_BANDS[SPAWN_BANDS.length - 1].weights;
}

// 초당 생성량: 1.2 + 0.35*분, 최대 8
export function spawnRate(t) {
  const minutes = Math.max(0, t) / 60;
  return Math.min(SPAWN.rateMax, SPAWN.rateBase + SPAWN.ratePerMin * minutes);
}

// 시간 구간표에서 가중치 목록 (t: 초)
export function weightsAt(t) {
  const tt = Math.max(0, t);
  for (const band of SPAWN_BANDS) {
    if (tt < band.until) return Object.entries(band.weights).map(([id, w]) => ({ id, w }));
  }
  return Object.entries(SPAWN_BANDS[SPAWN_BANDS.length - 1].weights).map(([id, w]) => ({ id, w }));
}

// 가중치에서 무작위 종류 1개 (rnd: [0,1) 균등)
export function pickType(weights, rnd) {
  if (!weights || !weights.length) return null;
  const total = weights.reduce((a, e) => a + e.w, 0);
  if (total <= 0) return weights[0].id;
  let r = rnd * total;
  for (const e of weights) {
    if (r < e.w) return e.id;
    r -= e.w;
  }
  return weights[weights.length - 1].id;
}

// 플레이어 주변 화면 밖 링(반경 ringMin~ringMax) 무작위 지점
export function ringPos(px, py, rnd, rnd2) {
  const ang = rnd * Math.PI * 2;
  const dist = SPAWN.ringMin + rnd2 * (SPAWN.ringMax - SPAWN.ringMin);
  return { x: px + Math.cos(ang) * dist, y: py + Math.sin(ang) * dist };
}

// 화면에서 너무 멀리(1200px 이상) 벗어난 적을 플레이어 근처 링으로 재배치
export function reposition(e, px, py, rnd, rnd2) {
  const p = ringPos(px, py, rnd, rnd2);
  e.x = p.x; e.y = p.y;
  return e;
}

// (cx, cy) 중심 원형에 고르게 나란히 배치한 n개 지점 (무리 포위용, 설계서 6.5).
// 각 지점은 (cx, cy) 에서 정확히 r 만큼 떨어져 있다.
export function ringPositions(cx, cy, n, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// t 시점에 dt 동안 생성할 적 수 (분할 생성, rnd: [0,1)).
// aliveCount(현재 화면에 있는 적 수)를 받아서 상한(SPawn.maxEnemies=300)에
// 도달하면 0을 반환한다 — 300개를 초과하면 밀어내기 O(n^2)가 폭발해 프레임
// 비용이 상한을 깨기 때문. 재배치는 화면 근처로 옮기므로 '화면 적 수'를
// 기준으로 삼아도 플레이어 앞의 적 밀도는 유지된다.
export function spawnCount(t, dt, rnd, aliveCount = 0) {
  if (aliveCount >= SPAWN.maxEnemies) return 0;
  const expected = spawnRate(Math.max(0, t)) * Math.max(0, dt);
  const n = Math.floor(expected) + (rnd < expected - Math.floor(expected) ? 1 : 0);
  return Math.min(n, SPAWN.maxEnemies - aliveCount);
}
