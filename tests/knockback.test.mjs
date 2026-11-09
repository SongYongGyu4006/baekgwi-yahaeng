// 넉백 연출 속도 모델 시험 — node game/tests/knockback.test.mjs
// hitEnemy: e.kx += kb.dx*8, e.ky += kb.dy*8   (kb = calcKnockback(dmg,nx,ny), 힘 2~18px)
// enemies.js:  e.x += kx*dt; 매 프레임 kx *= 0.85; |kx|+|ky| < 0.3 → 0
import assert from 'node:assert/strict';
import { calcKnockback } from '../src/combat.js';
import { ENEMY_TYPES } from '../src/config.js';
import { updateEnemies } from '../src/enemies.js';
import { state, reset } from '../src/state.js';

function kbVel(dmg, nx, ny) {
  const kb = calcKnockback(dmg, nx, ny);
  return { kx: kb.dx * 8, ky: kb.dy * 8 };
}

// 1) 넉백 속도: 큰 피해(500) → calcKnockback 힘 상한 18px * 8 = 144 px/s
const v = kbVel(500, 1, 0);
assert.equal(v.kx, 144);
assert.equal(v.ky, 0);
// 작은 피해(1) → 최소 힘 2px * 8 = 16 px/s
assert.equal(kbVel(1, 1, 0).kx, 16);

// 2) 총 이동 거리: v0, 감쇠 0.85/프레임(60fps dt=1/60)
//    Σ v0*(0.85)^n*(1/60) = v0/60 * 1/(1-0.85) = v0/9
//    최대 v0=144 → 16px ≤ 20px(상한). 20px 초과하는 피해 없음.
let dist = 0, kx = 144, n = 0;
const dt = 1 / 60;
while (kx > 0.3 && n < 1000) {
  dist += kx * dt;
  kx *= 0.85;
  n++;
}
assert.ok(dist <= 20, `넉백 총 이동 ${dist.toFixed(2)}px 은 20px 이하여야 함`);

// 3) updateEnemies 가 넉백을 감쇠시켜 적을 밀고 0.3 이하면 정지
for (const [id, def] of Object.entries(ENEMY_TYPES)) {
  const s = reset();
  s.alive = false; // 플레이어 피해 끄기(적 추적 멈춤)
  const e = {
    id, def, x: 100, y: 100, hp: 10, maxHp: 10,
    speed: def.speed, radius: def.radius,
    mvx: 0, flash: 0, kx: 144, ky: 72, frames: 0,
  };
  s.enemies = [e];
  const x0 = e.x, y0 = e.y;
  for (let i = 0; i < 600; i++) updateEnemies(s, 1 / 60); // 10초
  assert.ok(e.x > x0 && e.y > y0, `${id}: 넉백으로 밀려나야 함`);
  // 10초 동안 넉백 누적 이동: x 16px + y 8px = hypot ≤ 20px
  assert.ok(Math.hypot(e.x - x0, e.y - y0) <= 20,
    `${id}: 10초 내 넉백 총 이동 20px 초과 불가 (실제 ${Math.hypot(e.x - x0, e.y - y0).toFixed(2)}px)`);
  assert.equal(e.kx, 0, `${id}: 넉백 속도가 끝내 0으로 감쇠해야 함`);
  assert.equal(e.ky, 0);
}

// 4) 넉백 방향: (nx,ny) = 투사체 진행 방향 그대로 → 그 방향으로 밀림
const v2 = kbVel(500, -1, 0);
assert.equal(v2.kx, -144);
assert.equal(v2.ky, 0);
// 5) 무방향(0,0) → 힘 0 (combat.test.mjs 도 점검하지만 연출 쪽에서도)
const v3 = kbVel(10, 0, 0);
assert.equal(v3.kx, 0);
assert.equal(v3.ky, 0);

console.log('knockback.test.mjs OK');
