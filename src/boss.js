// 14단계: 보스 구미호(9일승). 5분에 약한 버전, 10분에 강한 버전.
// 꼬리 탄막 3패턴(부채꼴·원형·조준). 보스 처치 시 승리.
import { BOSS } from './config.js';
import { hurtPlayer } from './player.js';
import { drawSprite } from './art/draw.js';
import { playSfx } from './audio/sfx.js';
import { emitHit, emitSouls } from './fx.js';
import { pickEnemyFrame, safeId, frameIndex } from './anim.js';

// 보스 인스턴스 생성. version = 0(300s) 또는 1(600s).
export function createBoss(s, version, x, y) {
  const v = BOSS.versions[version] || BOSS.versions[0];
  const hp = Math.max(1, Math.round(v.hp * (BOSS.bossHpMul || 1))); // 점검 밸런스 배율
  return {
    version,
    x, y,
    hp,
    maxHp: hp,
    speed: v.speed,
    dmg: v.dmg,
    radius: Math.round(v.size / 2),
    size: v.size,
    xp: v.xp,
    fireCd: v.fireCd,
    count: v.count,
    // 패턴: 0=부채꼴, 1=원형, 2=조준. patternT 는 전환 타이머.
    pattern: 0,
    patternT: BOSS.patternCycle,
    flash: 0,
    mvx: 0,
    dead: false,
    // 스프라이트(9일승)
    sprite: 'boss_gumiho',
    aura: '#8a5fc0',
  };
}

// 3패턴 탄 발사. p = 플레이어, boss = 보스.
function firePattern(boss, s, p) {
  const n = boss.count;
  const spd = BOSS.bulletSpeed;
  const dx = p.x - boss.x, dy = p.y - boss.y;
  const d = Math.hypot(dx, dy) || 1;
  const base = Math.atan2(dy, dx);

  for (let i = 0; i < n; i++) {
    let ang;
    switch (boss.pattern) {
      case 0: // 부채꼴: 플레이어 중심으로 -60°~+60°
        ang = base + (i / (n - 1) - 0.5) * (Math.PI / 3) * 2;
        break;
      case 1: // 원형: 360도 균등
        ang = (i / n) * Math.PI * 2;
        break;
      case 2: // 조준: 플레이어 방향에 좁은 확산
        ang = base + (i / (n - 1) - 0.5) * 0.25;
        break;
      default:
        ang = base;
    }
    s.projectiles.push({
      weapon: 'boss', x: boss.x, y: boss.y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      nx: Math.cos(ang), ny: Math.sin(ang),
      r: BOSS.bulletR, life: 3.0, dmg: boss.dmg,
      def: 0, hit: null, hits: 0, dead: false,
    });
  }
  try { playSfx('fire'); } catch (e) { /* */ }
}

// 보스 탄이 플레이어와 충돌하면 피해 + 소멸.
function bossBulletHit(b, p) {
  const minD = BOSS.bulletR + p.radius;
  const dx = b.x - p.x, dy = b.y - p.y;
  if (dx * dx + dy * dy < minD * minD) {
    hurtPlayer(p, b.dmg);
    b.dead = true;
  }
}

// 매 프레임: 보스 이동(AI) + 발사 + 탄 업데이트 + 체력 확인.
export function updateBoss(s, dt) {
  const b = s.boss;
  if (!b || b.dead) return;

  const p = s.player;

  // 1) 이동: 플레이어 방향으로 느리게 추적.
  if (s.alive) {
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    // 200px 안이면 멈추고(발사 위치 유지), 밖이면 접근.
    if (d > 200) {
      b.x += (dx / d) * b.speed * dt;
      b.y += (dy / d) * b.speed * dt;
    }
    b.mvx = dx / d; // 바라보는 방향(그림 뒤집기)
  }
  if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);

  // 2) 발사: 쿨다운 0 + fireRange 안에 있으면 패턴 발사.
  b.fireCd -= dt;
  b.patternT -= dt;
  if (b.patternT <= 0) {
    b.pattern = (b.pattern + 1) % 3;
    b.patternT = BOSS.patternCycle;
  }
  if (s.alive && b.fireCd <= 0) {
    const dx = p.x - b.x, dy = p.y - b.y;
    if (Math.hypot(dx, dy) < BOSS.fireRange) {
      b.fireCd = BOSS.versions[b.version].fireCd;
      firePattern(b, s, p);
    }
  }

  // 3) 보스 탄 업데이트: 이동 + 플레이어 충돌 + 화면 밖 소멸.
  for (const pr of s.projectiles) {
    if (pr.dead || pr.weapon !== 'boss') continue;
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life <= 0) { pr.dead = true; continue; }
    // 화면 밖(W=1280, H=720 기준 + 100 마진) → 소멸
    if (pr.x < -100 || pr.x > 1380 || pr.y < -100 || pr.y > 820) { pr.dead = true; continue; }
    if (s.alive && p.invuln <= 0) bossBulletHit(pr, p);
  }
  if (s.projectiles.some((pr) => pr.weapon === 'boss')) {
    s.projectiles = s.projectiles.filter((pr) => !pr.dead);
  }

  // 4) 보스 사망: 체력 0 → 승리.
  if (b.hp <= 0) {
    b.dead = true;
    s.boss = null;
    s.won = true;
    s.kills += 1;
    emitSouls(b.x, b.y);
    try { playSfx('win'); } catch (e) { /* */ }
  }
}

// 보스 그리기: 스프라이트 + 체력바(화면 상단).
export function drawBoss(ctx, s, camX, camY) {
  const b = s.boss;
  if (!b || b.dead) return;

  // 스프라이트
  const sx = b.x - camX, sy = b.y - camY;
  if (sx > -200 && sx < 1480 && sy > -200 && sy < 920) {
    // 후광
    ctx.fillStyle = b.aura + '55';
    ctx.beginPath();
    ctx.ellipse(sx, sy + b.size * 0.2, b.size * 0.55, b.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 스프라이트(9일승) — 프레임 1개만(9일승 스프라이트는 프레임이 5개)
    const fr = pickEnemyFrame(b.sprite, s.time);
    const spriteId = fr ? safeId(fr.id, b.sprite) : b.sprite;
    const frame = fr ? frameIndex(spriteId) : 0;
    const flip = b.mvx < -0.05;
    const flash = b.flash > 0 ? Math.min(1, b.flash / 0.1) * 0.8 : 0;
    drawSprite(ctx, spriteId, sx - b.size / 2, sy - b.size / 2, b.size, { frame, flip, flash, shadow: true });
  }

  // 보스 체력바(화면 상단 중앙, 카메라 고정)
  const bw = 320, bh = 16;
  const bx = 640 - bw / 2, by = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#2a1030';
  ctx.fillRect(bx, by, bw, bh);
  const hpR = Math.max(0, b.hp) / b.maxHp;
  ctx.fillStyle = '#8a5fc0';
  ctx.fillRect(bx, by, bw * hpR, bh);
  ctx.fillStyle = '#f2efe6';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('구미호', 640, by + bh + 14);
  ctx.textAlign = 'left';
}
