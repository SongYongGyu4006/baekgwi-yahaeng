// 적: 처녀귀신 생성·추격·밀어내기·접촉 피해·사망. 스프라이트로 그림.
import { ENEMY_TYPES, SPAWN, ORB, PLAYER } from './config.js';
import { orbValue } from './xp.js';
import { startEvolveTimer } from './evolve.js';
import { spawnCount, weightsAt, pickType, ringPos, reposition, ringPositions, hpScale } from './spawn.js';
import { hurtPlayer } from './player.js';
import { drawSprite, drawGem } from './art/draw.js';
import { playSfx } from './audio/sfx.js';
import { pickEnemyFrame, safeId, frameIndex } from './anim.js';
import { emitSouls, emitHit } from './fx.js';

// LCG 무작위 생성기(점검 환경에서 결정적)
function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 스프라이트 정의(size)에서 프레임 수
function frameCount(id) {
  const map = {
    enemy_maiden: 2, enemy_wisp: 2, enemy_egg: 2,
    enemy_jiangshi: 2, enemy_bulgasari: 2, enemy_reaper: 2,
  };
  return map[id] || 1;
}

// 적 사망 시 영혼 구슬 드랍. 상한(ORB.max)을 넘으면 가장 오래된 구슬에
// 값을 합쳐서 제거한다(경험치 값은 사라지지 않음).
function dropOrb(s, e) {
  const v = orbValue(e.def.xp);
  const orbs = s.orbs;
  if (orbs.length >= ORB.max) {
    orbs[0].v += v; // 가장 오래된 것에 합침(오래된 것일수록 더 느림)
    return;
  }
  const a = s.rng ? s.rng() : Math.random();
  const b = s.rng ? s.rng() : Math.random();
  const ang = a * Math.PI * 2;
  const dist = 6 + b * 10; // 죽음 지점 주위 살짝 흩뿌림
  orbs.push({ x: e.x + Math.cos(ang) * dist, y: e.y + Math.sin(ang) * dist, v, sp: 0, pulled: false });
}

// 매 프레임: 자석 반경 안에 들어가면 끌려오고, pickup 거리 안이면 흡수.
// swap-remove 로 배열을 직접 갱신(매 프레임 새 배열을 만들지 않음).
export function updateOrbs(s, dt) {
  const p = s.player;
  const orbs = s.orbs;
  // 11단계: 소품 'magnet' 이 플레이어의 magnetR 을 키우므로 p.magnetR 에서 읽는다.
  const magnet = p.magnetR * (s.magnetMul || 1);
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < ORB.pickup) {
      // 흡수: 경험치 추가 (13단계: 자동 레벨업 pending 이 누적 — 레벨·카드는
      // autoLevelUp 이 pending 이 다음 레벨 xp 를 넘을 때 카드 1장씩 처리한다)
      s.xp = (s.xp || 0) + o.v;         // 누적 경험치(점검용)
      s.lvXp = (s.lvXp || 0) + o.v;     // 18단계: 이번 레벨 진행 → levelup.gainLevels
      try { playSfx('gem'); } catch (e2) { /* 무시 */ }
      orbs[i] = orbs[orbs.length - 1];
      orbs.pop();
      continue;
    }
    if (d < magnet) {
      o.pulled = true;
      o.sp = Math.min(ORB.maxSpeed, (o.sp || 0) + ORB.pullAccel * dt);
      o.x += (dx / d) * o.sp * dt;
      o.y += (dy / d) * o.sp * dt;
    } else if (o.pulled) {
      // 자석에서 벗어났어도 이미 빨린 구슬은 계속 진행(막히지 않게)
      o.x += (dx / d) * o.sp * dt;
      o.y += (dy / d) * o.sp * dt;
    }
  }
}

export function createEnemy(id, x, y, t, rnd = Math.random) {
  const def = ENEMY_TYPES[id];
  // 체력 보정: 설계서 6.4 `기본체력 * (1 + 0.12 * 분)`. spawn.js 순수 함수.
  // 생성 시점에 한 번만 곱한다(REFERENCE: 매 프레임 다시 곱하지 않음).
  const scale = hpScale(Math.max(0, t) / 60);
  return {
    id,
    def,
    x, y,
    hp: Math.round(def.hp * scale),
    maxHp: Math.round(def.hp * scale),
    speed: def.speed,
    radius: def.radius,
    mvx: 0, // 바라보는 방향 x(그림 좌우 뒤집기용)
    flash: 0,  // 피격 하얗게 번쩍임
    kx: 0, // 넉백 속도(x) — calcKnockback 방향, 감쇠하며 사라짐
    ky: 0,
    frames: frameCount(id),
    // 13단계 이동 AI(REFERENCE): 강시 돌진/멈춤 상태기계.
    // 생성 시 phase:'rest', pt:0.6(0.6초 후 첫 돌진) — 모든 적에 붙여도
    // aiEnemy 가 강시만 쓸 뿐 나머지는 기본 추격이라 영향 없음.
    phase: 'rest',
    pt: 0.6,
    dirx: 0, // 돌진 방향(시작 시 한 번 고정, 매 프레임 추적 안 함)
    diry: 0,
    slowT: 0,
    slowMul: 1,
    // 단청 후광 색(알파 포함, REFERENCE: 매 프레임 문자열 + 하지 않기 위해
    // 미리 '#rrggbb55' 로 정해둠 — drawEnemies 가 그대로 fillStyle 사용).
    aura: (def.aura || '#ffffff') + '55',
  };
}

// 불가사리 분열(REFERENCE ③): 죽는 처리에서 호출. 조각(enemy_shard)을
// n 개로 원형 배치해 만든다. shard 의 splitOnDeath 은 0 이라 무한 분열 안 함.
// REFERENCE 상한 우회 주의: 같은 상한(SPAWN.maxEnemies) 검사를 거치고,
// 공간이 부족하면 줄인다 — 전부 못 넣어도 나머지는 조용히 포기.
export function spawnNearPlayer(s, n) {
  // 자동 점검(__test.spawnNear): 플레이어 주위 80~160px 에 처녀귀신 n마리.
  const p = s.player;
  let made = 0;
  for (let i = 0; i < n && s.enemies.length < SPAWN.maxEnemies; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const r = 80 + (i % 3) * 40;
    s.enemies.push(createEnemy('maiden', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, s.time || 0));
    made++;
  }
  return made;
}

export function splitShards(s, e) {
  const n = e.def.splitOnDeath || 0;
  if (!n) return;
  const rnd = s.rng || Math.random;
  for (let i = 0; i < n; i++) {
    if (s.enemies.length >= SPAWN.maxEnemies) return; // 상한이면 포기(REFERENCE)
    const a = (i / n) * Math.PI * 2;
    s.enemies.push(createEnemy('shard', e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, s.time, rnd));
  }
}

// 13단계 이동 AI 표(REFERENCE ②). 종류별 이동만 담당(추적은 기본으로,
// 강시만 돌진/멈춤 상태기계, 도깨비불만 사인 흔들림). 적끼리 거리 계산
// (O(n²))은 넣지 않는다 — REFERENCE fps 요령.
//   wisp     : 플레이어 방향으로 접근 + 횡방향 사인 곡선(도깨비불 흔들림)
//   egg      : 느린 직진(기본)
//   jiangshi : 돌진(3배속, 방향 고정) ↔ 멈춤(기본 속도) 반복
//   bulgasari: 직진(기본)
//   shard    : 빠른 직진(기본, speed 120)
//   default  : 기본 직진
function aiEnemy(e, p, dt, s) {
  // 먹물 장판 감속 계수(기존과 같은 규칙)
  let slow = 1;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT > 0) slow = e.slowMul || 1; else slow = 1; }

  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d; // 플레이어 방향(단위 벡터)
  e.mvx = nx; // 바라보는 방향(그림 좌우 뒤집기용) — 모든 AI 가 공유

  switch (e.id) {
    case 'jiangshi': {
      // 돌진/멈춤 상태기계: pt(타이머)가 0 이면 상태 전환.
      // 돌진 시작 시 이 순간 한 번만 플레이어 방향으로 dirx/diry 고정한다
      // (매 프레임 추적하면 '빠른 추적'이 되어 돌진 의미가 사라진다 — REFERENCE).
      e.pt -= dt;
      if (e.pt <= 0) {
        if (e.phase === 'rest') {
          e.dirx = nx; e.diry = ny;
          e.phase = 'dash'; e.pt = 0.5; // 0.5초 돌진
        } else {
          e.phase = 'rest'; e.pt = 0.8; // 0.8초 멈춤
        }
      }
      // 돌진 중 3배속, 멈춤 중 기본 속도. (slow 도 곱해 먹물 장판에 감속됨)
      const mul = (e.phase === 'dash' ? 3 : 1) * slow;
      const vx = (e.phase === 'dash' ? e.dirx : nx);
      const vy = (e.phase === 'dash' ? e.diry : ny);
      e.x += vx * e.speed * mul * dt;
      e.y += vy * e.speed * mul * dt;
      break;
    }
    case 'wisp': {
      // 도깨비불: 플레이어 방향으로 접근하면서 횡방향으로 사인 곡선 흔들림.
      // (x,y) 기준 이동 벡터 = 진행방향 + ⊥방향 * sin(시계 * freq + 위상)
      const freq = 6;                 // 초당 진동(0.16초 주기)
      const amp = 0.6;                // 횡방향 진폭(진행속도 대비)
      const px = -ny, py = nx;        // 진행방향 수직
      const wave = Math.sin((s.time || 0) * freq + (e.x * 0.017 + e.y * 0.013)) * amp;
      const vx = nx + px * wave, vy = ny + py * wave;
      const vl = Math.hypot(vx, vy) || 1;
      e.x += (vx / vl) * e.speed * slow * dt;
      e.y += (vy / vl) * e.speed * slow * dt;
      break;
    }
    default: {
      // egg / bulgasari / shard / reaper / maiden: 기본 곧장 추격.
      e.x += nx * e.speed * slow * dt;
      e.y += ny * e.speed * slow * dt;
    }
  }
}

// 매 프레임 호출: 생성, (무리 포위), 추격, 밀어내기, 접촉, 재배치
export function updateEnemies(s, dt) {
  const p = s.player;
  if (!s.rng) s.rng = makeRng(1);
  const rnd = s.rng;

  // 1) 생성 (상한 300 — 화면에 있는 적 수로 제한. 재배치가 화면 밖→가까이
  //    옮기므로 화면 밖 적을 버려도 플레이어 앞 밀도는 유지된다)
  if (s.alive) {
    const n = spawnCount(s.time, dt, rnd(), s.enemies.length);
    for (let i = 0; i < n && s.enemies.length < SPAWN.maxEnemies; i++) {
      const id = pickType(weightsAt(s.time), rnd());
      if (!id) break;
      const pos = ringPos(p.x, p.y, rnd(), rnd());
      s.enemies.push(createEnemy(id, pos.x, pos.y, s.time, rnd));
    }
    // 1-1) 무리 포위(설계서 6.5): 5분(180s)부터 intervalSec(45s)마다
    //      도깨비불 12마리를 플레이어 주위 원형(ring 760px, 화면 밖)에 배치.
    //      ringPositions 가 원형 n개 지점을 주므로 고르게 둘러싼다.
    if (s.time >= SPAWN.group.startSec) {
      if (s.groupT == null) s.groupT = 0;
      s.groupT += dt;
      if (s.groupT >= SPAWN.group.intervalSec) {
        s.groupT = 0;
        const spots = ringPositions(p.x, p.y, SPAWN.group.count, SPAWN.group.ring);
        for (const sp of spots) {
          if (s.enemies.length >= SPAWN.maxEnemies) break; // 상한(REFERENCE 우회 금지)
          s.enemies.push(createEnemy(SPAWN.group.type, sp.x, sp.y, s.time, rnd));
        }
      }
    }
  }

  const list = s.enemies;
  const alive = [];

  for (const e of list) {
    // 화면에서 1200px 이상 벗어난 적 → 플레이어 근처 링으로 재배치
    const dxr = e.x - p.x, dyr = e.y - p.y;
    if (dxr * dxr + dyr * dyr > SPAWN.farDist * SPAWN.farDist) {
      reposition(e, p.x, p.y, rnd(), rnd());
    }

    // 2) 종류별 이동 AI(REFERENCE 13단계): 강시 돌진/멈춤, 도깨비불 사인
    //    흔들림, 나머지는 기본 곧장 추격. 먹물 장판 감속은 aiEnemy 안에서.
    if (s.alive) {
      aiEnemy(e, p, dt, s);
    } else if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowT = 0; }
    // 2-2) 넉백: 맞은 방향으로 밀려나며 감쇠 (weapons.js hitEnemy 에서 e.kx/e.ky +=)
    if (e.kx || e.ky) {
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= 0.85;
      e.ky *= 0.85;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 0.3) e.kx = e.ky = 0;
    }
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);

    // 3) 서로 겹치지 않게 약하게 밀어내기 (O(n^2), 상한 300)
    for (const o of list) {
      if (o === e) continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      // 빠른 배제: 반경 합(상한 ~27px)보다 충분히 떨어져 있으면 대각선
      // 체크(1.5배) 안에 없으면 skip — 300^2 루프의 대다수가 여기서 끝남.
      const minD = e.radius + o.radius;
      const maxD = minD + 30; // 2배 여유: 충분히 멀으면 절대 안 닿음
      const maxD2 = maxD * maxD;
      const d2 = dx * dx + dy * dy;
      if (d2 > maxD2) continue;
      if (d2 > 0.0001 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.25; // 약하게
        const nx = dx / d, ny = dy / d;
        e.x += nx * push;
        e.y += ny * push;
        o.x -= nx * push;
        o.y -= ny * push;
      }
    }

    // 4) 플레이어 접촉: 5피해 + 0.5초 무적 (hurtPlayer가 무적·체력 처리)
    if (s.alive && p.invuln <= 0) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const minD = p.radius + e.radius;
      if (dx * dx + dy * dy < minD * minD) hurtPlayer(s, e.def.dmg);
    }

    // 5) 사망 처리 (5단계에서 무기 공격이 hp를 깎아 0에 도달)
    if (e.hp <= 0) {
      s.kills += 1;
      emitSouls(e.x, e.y); // 푸른 혼 입자가 흩어지며 사라짐
      dropOrb(s, e);       // 영혼 구슬(경험치) 드랍 — 상한 ORB.max, 넘으면 값 합침
      // 불가사리 분열(REFERENCE ③): splitOnDeath 조각 원형 배치. shard 는 0 이라
      // 한 번 분열로 끝. 상한(SPAWN.maxEnemies) 검사 + 부족 시 줄임.
      splitShards(s, e);
      // 12단계 진화: 100번째(또는 그 이후) 처치 + 레벨 5 이상이면 변신 타이머 시작.
      // startEvolveTimer 는 이미 시작(null→숫자)하면 false 로 무시 → 한 판에 한 번.
      startEvolveTimer(s);
      // 18단계 손맛: 처치 순간 짧은 타격 멈춤(60ms) + 약한 흔들림. 연속 처치에
      // 화면이 계속 멈추지 않게 0.35초 재사용 대기.
      if (!(s.hitStopCd > 0)) { s.hitStop = 0.06; s.hitStopCd = 0.35; s.shake = Math.max(s.shake || 0, 0.06); }
      try { playSfx('kill'); } catch (e2) { /* 무시 */ }
      continue;
    }
    // 5-1) 화면에서 멀리 벗어난 적 제거. 재배치(farDist)가 이미 이들을 플레이어
    //      근처로 다시 가져오려 하지만, 생성이 계속 쌓이면 300을 크게 넘어
    //      밀어내기 O(n^2)가 프레임 비용을 부수는 원인이 된다. 화면 밖(뷰포트
    //      밖 400px 마진)의 적은 본 적이 없으니 버려도 플레이 체감은 변하지 않고,
    //      어차피 재배치가 다시 부를 수 있다.
    const dxs = e.x - p.x, dys = e.y - p.y;
    if (dxs * dxs + dys * dys > SPAWN.cullDist * SPAWN.cullDist) continue;
    alive.push(e);
  }
  s.enemies = alive;
}

// 영혼 구슬(경험치) 그리기. 스프라이트(gem_*)를 쓰고,
// 화면 밖은 스킵. drawSprite 안의 그림자·save/restore 는 구슬마다 무거워
// shadow:false 로 가볍게. v(값)에 따라 크기·색을 살짝 다르게.
export function drawOrbs(ctx, s, camX, camY) {
  const orbs = s.orbs;
  if (!orbs.length) return;
  for (const o of orbs) {
    const sx = o.x - camX, sy = o.y - camY;
    if (sx < -24 || sx > 1304 || sy < -24 || sy > 744) continue; // 화면 밖 스킵
    const id = o.v >= 20 ? 'gem_big' : o.v >= 5 ? 'gem_mid' : 'gem_small';
    const size = ORB.size; // 16px (sprites.json px 32 의 절반)
    // 18단계: gem_*.png 으로(미로드 시 도트 폴백) + 약한 글로우
    drawGem(ctx, id, sx - size / 2, sy - size / 2 + Math.sin((s.time || 0) * 4 + o.x * 0.05) * -1.5, size, { glow: true });
  }
}

export function drawEnemies(ctx, s, camX, camY) {
  // 숨김(__test hidden): main.js 의 카메라가 (첫 적 중심) 기준인 화면 좌표를
  // 그대로 받아 적들을 그린다 — 플레이어 중심 추적과 독립적이다.
  let ox = 0, oy = 0;
  if (s.player && s.player.hidden) {
    ox = (s.__hiddenCam ? s.__hiddenCam.x : (s.camera ? s.camera.x : 0));
    oy = (s.__hiddenCam ? s.__hiddenCam.y : (s.camera ? s.camera.y : 0));
  }
  const list = s.enemies;
  for (const e of list) {
    const sx = e.x - (camX + ox), sy = e.y - (camY + oy);
    if (sx < -80 || sx > 1360 || sy < -80 || sy > 800) continue; // 화면 밖 스킵
    const size = e.def.size || 40; // 그림 크기는 config(size)가 결정, 충돌 반경(e.radius)은 그대로
    // 동작 프레임(_anims 의 move): 있는 적(강시·처녀귀신)은 이동 중 8fps 반복,
    // 프레임이 없는 적(도깨비불·달걀 등)은 기존 한 장 + 위아래 흔들림.
    const fr = pickEnemyFrame(e.def.sprite, s.time);
    const spriteId = fr ? safeId(fr.id, e.def.sprite) : e.def.sprite;
    const frame = fr ? frameIndex(spriteId) : 0;
    // 도깨비불은 둥글고 좌우 대칭이라 뒤집기 없음. 스프라이트 기본은 오른쪽
    // 바라봄(플레이어와 같은 규칙, move 프레임도 오른쪽) → 왼쪽으로만 움직일 때
    // 뒤집기. 예전엔 mvx>0 시 뒤집어 다가오면서 뒤를 향한 채 걸어 보였음(10-29 보고).
    const flip = e.def.sprite !== 'enemy_wisp' && e.mvx < -0.05;
    const flash = e.flash > 0 ? Math.min(1, e.flash / 0.08) * 0.8 : 0; // 0.08초 번쩍
    const bob = fr ? 0 : Math.sin(s.time * 3 + e.x * 0.01) * -2; // 프레임이 없으면 귀신 느낌의 느린 흔들림
    // 발밑 그림자는 플레이어 근처 적만. 300개 가까운 적 전부 에리프스·
    // fill 하마다 경로가 한 번씩 들어가는 게 렌더의 큰 비중을 차지하므로,
    // 플레이어에서 300px 미만(화면 반지름) 안의 적에만 그림자를 남긴다.
    const shadow = e.x * e.x + e.y * e.y < 90000 ? true : false; // 300^2
    // 단청 색 후광(REFERENCE ④): 스프라이트 아래 부드러운 타원 하나.
    // fillStyle 는 createEnemy 가 미리 '#rrggbb55' 로 정한 값 — 매 프레임
    // 문자열 + 로 바꾸지 않는다(REFERENCE: 그대도 안 쓰는 것).
    if (e.aura) {
      ctx.fillStyle = e.aura;
      ctx.beginPath();
      ctx.ellipse(sx, sy + size * 0.26, size * 0.52, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(ctx, spriteId, sx - size / 2, sy - size / 2 + bob, size, { frame, flip, flash, shadow });
  }
}
