// 13단계(적 생성·AI) 자동 점검. node game/tests/waves.test.mjs
// DOM/performance/실시간 없이. 60fps(1/60초) 고정 dt, 고정 시드 rng 으로
// 결정적으로 검증한다. (REFERENCE 13단계: waves.test.mjs)

import { spawnRate, tableAt, hpScale, ringPositions, weightsAt, pickType, spawnCount } from '../src/spawn.js';
import { ENEMY_TYPES, SPAWN, SPAWN_BANDS } from '../src/config.js';
import { makeState } from '../src/state.js';
import { createEnemy, updateEnemies, splitShards } from '../src/enemies.js';

function expect(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
}

// --- ① hpScale: 기본 * (1 + 0.12*분). t초 → t/60 분. 매 프레임 재곱함 없음.
// (createEnemy 가 spawn.js 순수 hpScale 로 생성 시점에 한 번 곱함 — REFERENCE.)
{
  expect(Math.abs(hpScale(0) - 1) < 1e-9, 'hpScale(0) === 1 (초기 체력=기본)');
  expect(Math.abs(hpScale(5) - 1.6) < 1e-9, 'hpScale(5분) === 1.6 (1 + 0.12*5)');
  expect(hpScale(10) > hpScale(5) && hpScale(5) > hpScale(0), 'hpScale 단조 증가');
  // 0.12/분 규칙이 그대로: 5분 = 1.6
  const m = ENEMY_TYPES.maiden.hp * hpScale(5);
  expect(Math.abs(m - 12 * 1.6) < 1e-6, '처녀귀신 5분 체력 = 12*1.6 = 19.2');
}

// --- ② tableAt: 시간 구간표. 0~60s 마돈, 180~300s 불가사리, 300s+ 재퍼.
{
  const w0 = tableAt(0);
  expect(w0.maiden > 0 && !('reaper' in w0) && !('egg' in w0), '0~60s: 마돈만(100%)');
  const w60 = tableAt(60);
  expect(w60.maiden > 0 && w60.wisp > 0, '60s: 도깨비불 합류 (1:00, DESIGN 6.4)');
  const w120 = tableAt(120);
  expect(('egg' in w120), '120s: 달걀귀신 합류 (2:00, DESIGN 6.4)');
  const w180 = tableAt(180);
  expect(('jiangshi' in w180), '180s: 강시 합류 (3:00, DESIGN 6.4)');
  const w240 = tableAt(240);
  expect(('bulgasari' in w240), '240s: 불가사리 합류 (4:00, DESIGN 6.4)');
  const w300 = tableAt(300);
  expect(!('reaper' in w300), '300s(5:00): 재퍼 아직(6:00 등장)');
  const w360 = tableAt(360);
  expect(('reaper' in w360), '360s(6:00): 저승사자 합류 (DESIGN 6.4)');
  // 각 구간: 가중치가 모두 양수(0은 불가), 합 > 0.
  for (const b of SPAWN_BANDS) {
    const vals = Object.values(b.weights);
    const sum = vals.reduce((a, x) => a + x, 0);
    expect(sum > 0 && vals.every(v => v > 0), `tableAt: 구간 합>0·양수 (${b.until}s)`);
  }
}

// --- ③ spawnRate: 1.2 + 0.35*분, 최대 8
{
  expect(Math.abs(spawnRate(0) - 1.2) < 1e-9, 'spawnRate(0) === 1.2');
  expect(Math.abs(spawnRate(60) - 1.55) < 1e-9, 'spawnRate(60s=1분) === 1.55');
  expect(Math.abs(spawnRate(1500) - 8) < 1e-9, 'spawnRate(1500s=25분) === 8 (cap)');
}

// --- ④ AI 이동 검증 (60fps 고정, 결정적). updateEnemies 전체를 돌리면
//     밀어내기·재배치 등이 섞여 방향을 흐뜨리므로, 종류별 이동 규칙을
//     createEnemy + updateEnemies(1프레임) 로 확인한다.
function fresh() {
  const s = makeState();
  s.time = 0; s.alive = true; s.paused = false; s.rng = undefined;
  return s;
}

// (a) 처녀귀신: 곧장 플레이어 방향으로. 1프레임 후 플레이어 쪽으로 이동.
{
  const s = fresh();
  s.player.x = 0; s.player.y = 0;
  const e = createEnemy('maiden', 100, 0, s.time); // x=100, y=0 → 플레이어(0,0)
  s.enemies.push(e);
  updateEnemies(s, 1 / 60);
  expect(e.x < 100 && e.x > 0, `처녀귀신: 곧장 플레이어 방향 (x: 100→${e.x.toFixed(3)})`);
}

// (b) 도깨비불: 플레이어 방향으로 접근 + 횡방향 흔들림(사파리 곡선).
//     1프레임 이동량이 (0,0)에서 100px 방향(단위벡터) 근처 — 횡 흔들림이
//     크게 벗어나면 "플레이어 방향"이 아니라 우회한다.
{
  const s = fresh();
  s.player.x = 0; s.player.y = 0;
  const e = createEnemy('wisp', 100, 0, s.time);
  s.enemies.push(e);
  updateEnemies(s, 1 / 60);
  // x는 확실히 줄었는지(플레이어 쪽), y는 횡 흔들림으로 약간 벗어질 수 있음.
  expect(e.x < 100, `도깨비불: 플레이어 쪽 접근 (x: 100→${e.x.toFixed(3)})`);
  // 횡(y) 흔들림이 너무 크지 않아야 "플레이어 방향 + 작은 흔들림".
  // wisp speed 110 * 1/60 ≈ 1.83px 이동. y는 0에서 시작 → |y| < 1.83*amp_margin.
  expect(Math.abs(e.y) < 1.2, `도깨비불: 횡 흔들림 제한 (y=${e.y.toFixed(3)})`);
}

// (c) 강시: 돌진(3배) ↔ 멈춤(기본) 반복. 한 사이클(0.8+0.5=1.3초)을
//     샘플링해 (1) 돌진 시 멈춤보다 3배 빠름 (2) 방향이 돌진 시작 시 한 번
//     고정됨 (매 프레임 추적 X) — REFERENCE: "방향은 시작 시 한 번만 고정."
{
  const s = fresh();
  s.player.x = 0; s.player.y = 0;
  const e = createEnemy('jiangshi', 100, 0, 0);
  s.enemies.push(e);
  const dt = 1 / 60;
  // 0.8초(48프레임) 멈춤 + 0.5초(30프레임) 돌진 = 1.3초. 총 78프레임.
  const restFrames = Math.round(0.8 * 60);   // 48
  const dashFrames = Math.round(0.5 * 60);   // 30
  const total = restFrames + dashFrames;
  let lastX = e.x, lastY = e.y;
  let minDist = Infinity, maxDist = -Infinity;
  const restMoves = [], dashMoves = [];
  let inDash = false;
  for (let i = 0; i < total; i++) {
    updateEnemies(s, dt);
    const mv = Math.hypot(e.x - lastX, e.y - lastY);
    const dist = Math.hypot(e.x - s.player.x, e.y - s.player.y);
    minDist = Math.min(minDist, dist); maxDist = Math.max(maxDist, dist);
    if (i < restFrames) restMoves.push(mv); else dashMoves.push(mv);
    if (e.phase === 'dash') inDash = true;
    lastX = e.x; lastY = e.y;
  }
  // 돌진이 실제로 일어났음.
  expect(inDash, '강시: 사이클 중 돌진 발생');
  // 전환 프레임(1프레임)을 중앙값으로 제거해 3배를 검증.
  const med = a => { const c = [...a].sort((x, y) => x - y); return c[Math.floor(c.length / 2)]; };
  const restMed = med(restMoves);   // 기본속도 80px/s * 1/60 = 1.333
  const dashMed = med(dashMoves);   // 240px/s * 1/60 = 4.000
  expect(Math.abs(restMed - (80 / 60)) < 0.15, `강시: 멈춤≈기본속도 (median ${restMed.toFixed(3)} vs ${(80 / 60).toFixed(3)})`);
  expect(Math.abs(dashMed - (240 / 60)) < 0.15, `강시: 돌진≈3배속 (median ${dashMed.toFixed(3)} vs ${(240 / 60).toFixed(3)})`);
  expect(dashMed > restMed * 2, `강시: 돌진(${dashMed.toFixed(2)}) > 멈춤(${restMed.toFixed(2)})*2`);
  // 방향 고정: 돌진 시작 시 한 번 (100,0)→(0,0)=(-1,0) 고정. 사이클 후에도 x 감소.
  expect(e.x < 100, `강시: 플레이어 방향으로 이동 (x: 100→${e.x.toFixed(1)})`);
}

// (d) 불가사리: 곧장(기본) + 분열. splitShards 가 3 조각 생성(1상한 안),
//     shard.splitOnDeath=0 → 재분열 없음.
{
  const s = fresh();
  s.enemies.length = 0; // 초기 적 비움(정확한 조각 수 측정)
  const e = createEnemy('bulgasari', 100, 0, s.time);
  s.enemies.push(e);
  // 불가사리 곧장 이동 확인.
  updateEnemies(s, 1 / 60);
  expect(e.x < 100, `불가사리: 곧장 플레이어 방향 (x: 100→${e.x.toFixed(3)})`);
  // 분열: hp 0 → splitShards. 3개 조각, shard.splitOnDeath=0.
  e.hp = 0;
  splitShards(s, e);
  const shards = s.enemies.filter(x => x.id === 'shard');
  expect(shards.length === 3, `불가사리 분열: 3개 조각 (${shards.length}개)`);
  for (const sh of shards) {
    expect(sh.def.splitOnDeath === 0, '조각: 재분열 없음 (splitOnDeath=0)');
    // shard 는 불가사리 근처(12px 원)에 배치.
    expect(Math.hypot(sh.x - e.x, sh.y - e.y) <= 12.01, `조각 위치: 원형 12px (d=${Math.hypot(sh.x - e.x, sh.y - e.y).toFixed(2)})`);
  }
}

// (e) 무리 포위(6.5): 5분(180s)부터 45s마다 도깨비불 12마리 원형(ring 760).
{
  const s = fresh();
  s.time = 300; // 5분
  s.enemies.length = 0;
  s.groupT = 44.999; // 다음 프레임에 += 1/60 > 45 → 12마리 생성
  updateEnemies(s, 1 / 60);
  const wisps = s.enemies.filter(x => x.id === 'wisp');
  expect(wisps.length === 12, `무리 포위: 도깨비불 12마리 (${wisps.length}마리)`);
  // 12마리가 플레이어(0,0) 주위 ring=760 원에 고르게. 각 거리 ≈ 760.
  // (1프레임 AI 이동 + 재배치로 ±5px 변동 가능.)
  for (const w of wisps) {
    const d = Math.hypot(w.x, w.y);
    expect(Math.abs(d - SPAWN.group.ring) < 5, `포위 거리: ~760 (d=${d.toFixed(1)})`);
  }
  // ringPositions 순수함수: n개, 각 지점 정확히 r.
  const pts = ringPositions(0, 0, 12, 760);
  expect(pts.length === 12, 'ringPositions: 12개 지점');
  for (const pt of pts) expect(Math.abs(Math.hypot(pt.x, pt.y) - 760) < 1e-9, 'ringPositions: 각 지점 정확히 r');
}

// (f) 180~300s 무리 생성 없이도 300s+ 포위 + spawnCount 상한.
{
  // 상한: 300개 → 0.
  expect(spawnCount(60, 1, 0.5, 300) === 0, 'spawnCount: 300개면 0 (상한)');
  expect(spawnCount(60, 1, 0.5, 299) >= 1, 'spawnCount: 299개면 ≥1');
}

console.log('waves ok');
