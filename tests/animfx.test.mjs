// anim.js + fx.js 단위 시험 — node game/tests/animfx.test.mjs
import assert from 'node:assert/strict';
import { pickPlayerFrame, pickEnemyFrame, animFrames, safeId, frameIndex, frameSize } from '../src/anim.js';
import { emitDust, emitSouls, emitHit, updateParticles, clearParticles, drawParticles, updateShake } from '../src/fx.js';

// safeId: 프레임 id 가 SPRITES 에 등재돼 있으면 그대로(브라우저에서는 Image 준비 시 그 그림,
// node 도트에서는 기본 도트 첫 장으로 그린다), 정의도 없으면 기본 id 로 대체해 사라지지 않게.
assert.equal(safeId('player_walk0', 'player'), 'player_walk0'); // 등재됨
assert.equal(safeId('player', 'player'), 'player'); // 정의가 있으면 그대로
assert.equal(safeId('no_such_id', 'player'), 'player'); // 정의도 없으면 기본 id (사라지지 않음)

// _anims 구조
assert.equal(animFrames('player', 'walk').length, 4);
assert.equal(animFrames('player', 'act').length, 4);
assert.equal(animFrames('enemy_maiden', 'move').length, 4);
assert.equal(animFrames('enemy_jiangshi', 'move').length, 4);
assert.equal(animFrames('enemy_wisp', 'move'), null); // 도깨비불은 한 장
assert.equal(animFrames('enemy_maiden', 'act'), null); // 없는 동작은 null

// frameIndex = 항상 0(프레임 도트는 기본 첫 장), frameSize = 기본 스프라이트 크기와 일치
const wk = pickPlayerFrame({ moving: true, animT: 0, atkT: 0, hurtT: 0 }, true);
assert.equal(frameIndex(wk.id), 0);
assert.equal(frameSize(wk.id, 'player'), 24); // player size 24

// 동작 우선순위: 죽음 > 피격 > 공격 > 걷기 > 가만히
assert.equal(pickPlayerFrame({ moving: true, animT: 0.5, atkT: 0.1, hurtT: 0.1 }, false).id, 'player_dead');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.5, atkT: 0.1, hurtT: 0.1 }, true).id, 'player_hurt');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.5, atkT: 0.1, hurtT: 0 }, true).id, 'player_attack');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.5, atkT: 0, hurtT: 0 }, true).id, 'player_walk0');
assert.equal(pickPlayerFrame({ moving: false, animT: 0, atkT: 0, hurtT: 0 }, true).id, 'player_idle');

// 걷기 사이클: 8fps → 4프레임, index = floor(animT*8)%4. 0.125초마다 1프레임, 0.5초에 1바퀴
assert.equal(pickPlayerFrame({ moving: true, animT: 0, atkT: 0, hurtT: 0 }, true).id, 'player_walk0');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.125, atkT: 0, hurtT: 0 }, true).id, 'player_walk1');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.25, atkT: 0, hurtT: 0 }, true).id, 'player_walk2');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.375, atkT: 0, hurtT: 0 }, true).id, 'player_walk3');
assert.equal(pickPlayerFrame({ moving: true, animT: 0.5, atkT: 0, hurtT: 0 }, true).id, 'player_walk0');

// 적 이동 프레임: 8fps 사이클, index = floor(t*8)%4, 0.5초에 1바퀴. 없는 적(null)은 한 장 유지
assert.equal(pickEnemyFrame('enemy_maiden', 0).id, 'enemy_maiden_move0');
assert.equal(pickEnemyFrame('enemy_maiden', 0.125).id, 'enemy_maiden_move1');
assert.equal(pickEnemyFrame('enemy_maiden', 0.25).id, 'enemy_maiden_move2');
assert.equal(pickEnemyFrame('enemy_maiden', 0.5).id, 'enemy_maiden_move0'); // 1바퀴
assert.equal(pickEnemyFrame('enemy_jiangshi', 0.25).id, 'enemy_jiangshi_move2');
assert.equal(pickEnemyFrame('enemy_wisp', 1), null);

// --- fx.js: 입자 풀(상한·덮어쓰기·감쇠) ---
clearParticles();
emitDust(10, 10);
emitSouls(50, 50);
emitHit(80, 80);
updateParticles(0.01); // t += dt, 속도 0.96 감쇠
updateParticles(100);  // life 초과 → 풀림(on=false)
assert.doesNotThrow(() => {
  // 무해한 ctx(방문하는 메서드만)로 모든 입자 그리기
  const ctx = new Proxy({}, { get: (t, k) => {
    if (k === 'globalAlpha') return 1;
    return (...a) => a; // fillRect 등: 무시
  }, set: () => true });
  drawParticles(ctx, 0, 0);
});

// 풀 상한: 150개 초과해도 예외 없이 덮어써야 함(예외 = FAIL)
for (let i = 0; i < 200; i++) emitDust(i, i);
updateParticles(0.016);
updateParticles(10); // 전부 만료
drawParticles({ globalAlpha: 1, fillStyle: '', fillRect() {} }, 0, 0);

// 흔들림: 감소 → 0 이하에서는 0(양수 유지)
const s = { shake: 0.2 };
updateShake(s, 0.05);
assert.ok(s.shake <= 0.2 && s.shake > 0);
for (let i = 0; i < 20; i++) updateShake(s, 0.05);
assert.equal(s.shake, 0);
updateShake(s, 0.5); // 0 이라도 음수로 빠지지 않음
assert.equal(s.shake, 0);

console.log('animfx.test.mjs OK');
