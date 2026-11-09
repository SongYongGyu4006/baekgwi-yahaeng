// 손맛 효과: 고정 크기 입자 풀(할당 없음, 상한) + 화면 흔들림.
// 18단계: fx_*.png(112px) 스프라이트 효과 — 무적·스킬·처치 순간.
import { IMAGES } from './art/images.js';
import { drawFxSprite, FX_SHIELD, FX_KILL, FX_EVOLVE, FX_PICKUP } from './art/draw.js';
import { W, H } from './config.js';

const MAX = 150; // 입자 상한(300적 상황에서 fps 30 유지)
const pool = Array.from({ length: MAX }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, r: 2, c: '#fff' }));
let head = 0;

function spawn(x, y, vx, vy, life, r, c) {
  const q = pool[head];
  head = (head + 1) % MAX; // 가득 차면 가장 오래것 덮어씀
  q.on = true; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.t = 0; q.life = life; q.r = r; q.c = c;
}

// 18단계: fx 스프라이트(무적 광환, 처치 폭발, 스킬 원형)
const FX_MAX = 20;
const fxPool = Array.from({ length: FX_MAX }, () => ({ on: false, x: 0, y: 0, t: 0, life: 0.5, id: 'fx_01', size: 112 }));
let fxHead = 0;

export function spawnFxSprite(id, x, y, life = 0.5, size = 112) {
  const q = fxPool[fxHead];
  fxHead = (fxHead + 1) % FX_MAX;
  q.on = true; q.x = x; q.y = y; q.t = 0; q.life = life; q.id = id; q.size = size;
}

// 걷기 흙먼지: 발밑, 위로 살짝 흩어지며 사라짐
export function emitDust(x, y) {
  spawn(x + (Math.random() - 0.5) * 10, y, (Math.random() - 0.5) * 24, -8 - Math.random() * 14, 0.35, 2.5, '#8a7a62');
}

// 처치 혼 입자: 푸른 색으로 사방 흩어짐 + 18단계: fx_* 처치 폭발(4종 순환)
const lastKill = { n: 0 };
export function emitSouls(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * 6.283;
    spawn(x, y, Math.cos(a) * 55, Math.sin(a) * 55 - 25, 0.6, 3, '#7fc8ff');
  }
  spawnFxSprite(FX_KILL[lastKill.n++ % FX_KILL.length], x, y, 0.45, 96); // 처치 폭발
}

// 피격 스파크(적): 적 색, 짧게
export function emitHit(x, y) {
  spawn(x + (Math.random() - 0.5) * 8, y - 8, (Math.random() - 0.5) * 60, -30 - Math.random() * 30, 0.25, 2, '#f2efe6');
}

// 18단계: 무적 발동 시 fx_* 무적 광환(4종 순환)
const lastShield = { n: 0 };
export function emitShield(x, y) {
  spawnFxSprite(FX_SHIELD[lastShield.n++ % FX_SHIELD.length], x, y, 0.5, 128);
}

// 18단계: 진화(변신) 시 fx_* 진화 광채(4종 순환)
const lastEvolve = { n: 0 };
export function emitEvolve(x, y) {
  spawnFxSprite(FX_EVOLVE[lastEvolve.n++ % FX_EVOLVE.length], x, y, 1.0, 160);
}

// 18단계: 주술(스킬) 발동 시 fx_* 원형(4종 순환)
const lastPickup = { n: 0 };
export function emitPickup(x, y) {
  for (let i = 0; i < 3; i++) {
    spawnFxSprite(FX_PICKUP[(lastPickup.n++ + i) % FX_PICKUP.length], x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 0.4, 60);
  }
}

export function updateParticles(dt) {
  for (const q of pool) {
    if (!q.on) continue;
    q.t += dt;
    if (q.t >= q.life) { q.on = false; continue; }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.96;
    q.vy *= 0.96;
  }
  for (const q of fxPool) {
    if (!q.on) continue;
    q.t += dt;
    if (q.t >= q.life) q.on = false;
  }
}

export function clearParticles() {
  for (const q of pool) q.on = false;
  for (const q of fxPool) q.on = false;
}

// 월드 좌표 → 화면 좌표(camX/camY)로 그리기. 화면 밖은 스킵.
export function drawParticles(ctx, camX, camY) {
  for (const q of pool) {
    if (!q.on) continue;
    const sx = q.x - camX, sy = q.y - camY;
    if (sx < -16 || sx > 1296 || sy < -16 || sy > 736) continue;
    ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
    ctx.fillStyle = q.c;
    ctx.fillRect(sx - q.r, sy - q.r, q.r * 2, q.r * 2);
  }
  ctx.globalAlpha = 1; // 꼭 되돌리기
}

// 18단계: fx_*.png 스프라이트 그리기(무적·처치·진화)
export function drawFxSprites(ctx, camX, camY) {
  for (const q of fxPool) {
    if (!q.on) continue;
    const sx = q.x - camX, sy = q.y - camY;
    if (sx < -128 || sx > W + 128 || sy < -128 || sy > H + 128) continue;
    const alpha = Math.max(0, 1 - q.t / q.life);
    const scale = 1 + q.t / q.life * 0.4; // 커지며 사라짐
    drawFxSprite(ctx, q.id, sx - (q.size * scale) / 2, sy - (q.size * scale) / 2, q.size * scale, { alpha });
  }
}

// 화면 흔들림 타이머 감쇠(강도 자체는 렌더에서 s.shake 로 산출)
export function updateShake(s, dt) {
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
}
