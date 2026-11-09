// 플레이어 이동·피격·재생 (설계서 6.1) + 연출: 동작 프레임·기울기·흙먼지
import { PLAYER } from './config.js';
import { ITEMS } from './upgrades.js';
import { EVOLVE } from './evolve.js';
import { drawSprite } from './art/draw.js';
import { playSfx } from './audio/sfx.js';
import { pickPlayerFrame, safeId, frameIndex } from './anim.js';
import { emitDust, emitShield, emitEvolve } from './fx.js';

export function updatePlayer(s, input, dt) {
  const p = s.player;
  const v = input.moveVector ? input.moveVector() : { x: 0, y: 0 };
  // p.speed = (base + 11단계 소품 덧셈) * (8단계 카드 배율) — onItem 이 계산. 상한 1.5*base.
  const spd = Math.min(PLAYER.speed * 1.5, p.speed);
  p.x += v.x * spd * dt;
  p.y += v.y * spd * dt;
  if (v.x !== 0 || v.y !== 0) p.facing = { x: v.x, y: v.y };
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.hurtFlash > 0) p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (p.hurtT > 0) p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.atkT > 0) p.atkT = Math.max(0, p.atkT - dt);
  // 초당 체력 재생(인삼 등 소품) — 기본 0
  if (p.hp < p.maxHp && p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // --- 연출 상태: 이동 처리 이후에 갱신(keys_move 점검이 x 변화로 보므로 건드리지 않음) ---
  const moving = v.x !== 0 || v.y !== 0;
  p.moving = moving;
  if (v.x !== 0) p.face = v.x > 0 ? 1 : -1; // 정지 시에는 마지막 방향 유지
  if (moving) {
    p.animT += dt * 8 * (p.speed / PLAYER.speed); // 속도에 맞춰 약 8fps 보행 사이클
    p.dustT -= dt;
    if (p.dustT <= 0) {
      p.dustT = 0.12; // 걷는 동안 0.12초마다 발밑 흙먼지 1개
      emitDust(p.x, p.y);
    }
  } else {
    p.dustT = 0;
  }
  // 숨김(__test hidden): 이동·피격·무적은 그대로 돌리되 렌더에서는 전부 안 그린다.
  // hidden 도중엔 흙먼지도 안 뿜음.
  if (p.hidden) p.dustT = 0.12;
}

// 숨김 토글: 그림·그림자·흙먼지 전부 안 보이게. 시뮬레이션(이동·피격)은 그대로.
export function setPlayerHidden(s, v) {
  s.player.hidden = !!v;
}

// 11단계: 소품으로 유도되는 통계 재계산 (카드 선택 시에만 — 프레임마다 부르지 않음).
//  - 덧셈(stat): speed/magnet/regen/def = base + Σ per*lv
//  - 곱셈: cd = 1+Σper (쿨다운), area = 1+Σper (범위), atkBonus = Σ per*lv, speed/magnet = 1+Σper
//  - maxHp: base * (1+Σper) (현재 hp 비율 유지)
// p.itemStats = { [id]: lv } (단순 객체). wStat 도 p.itemStats 의 cd/area 를 읽는다.
export function onItem(s) {
  const p = s.player;
  const lv = p.itemStats; // { [id]: lv }
  let add = { speed: 0, magnet: 0, regen: 0, def: 0, maxHp: 0 };
  let atk = 0;
  let cd = 1, area = 1;
  for (const d of ITEMS) {
    const l = lv[d.id] || 0;
    if (l === 0) continue;
    if (d.mul) {
      if (d.key === 'cd') cd += d.per * l;        // 쿨다운(음수 = 감소)
      else if (d.key === 'area') area += d.per * l; // 범위(양수 = 증가)
      else atk += d.per * l;                       // 공격력
    } else {
      add[d.key] += d.per * l;
    }
  }
  // 8단계 카드(신속/자석/호흡)는 배율(s.speedMul/magnetMul)로 곱하고,
  // 11단계 소품은 base 에 곱셈. 두 효과를 함께 쓴다.
  p.speed = PLAYER.speed * (1 + add.speed) * (s.speedMul || 1);
  p.magnetR = PLAYER.magnetRadius * (1 + add.magnet) * (s.magnetMul || 1);
  p.regen = (s.baseRegen || 0) + add.regen;       // 카드 재생(기본) + 소품 재생
  p.defense = add.def;       // hurtPlayer 가 p.defense 사용
  p.atkBonus = atk;          // 무기에서 (1+atkBonus) 으로 곱함
  p.itemStats.cd = cd;       // wStat: base * cd
  p.itemStats.area = area;   // wStat: base * area
  // (cd/area 만 쓰여도 좋다 — id별 레벨은 lv[] 로 읽는다)
  const oldMax = p.maxHp;
  p.maxHp = PLAYER.maxHp * (1 + add.maxHp); // 곱셈
  p.hp = Math.min(p.maxHp, p.hp * (p.maxHp / oldMax)); // 비율 유지
}

export function hurtPlayer(s, dmg, dt = 0) {
  const p = s.player;
  if (p.invuln > 0 || !s.alive) return;
  p.hp = Math.max(0, p.hp - Math.max(1, dmg - (p.defense || 0)));
  p.invuln = PLAYER.invulnTime;
  p.hurtFlash = PLAYER.invulnTime; // 피격 하얗게 깜빡임(무적 시간과 같이)
  p.hurtT = 0.2;                    // 피격 동작 프레임 0.2초
  s.shake = 0.2;                    // 화면 짧게 흔들림(강도: 렌더에서 0.2초 기준)
  emitShield(p.x, p.y);             // 18단계: 무적 광환(fx_02.png)
  try { playSfx('hurt'); } catch (e) { /* 무시 */ }
  if (p.hp <= 0) s.alive = false;
}

export function drawPlayer(ctx, s, camX, camY) {
  const p = s.player;
  if (p.hidden) return; // 숨김: 스프라이트·그림자·틸트 전부 안 그린다
  const sx = p.x - camX, sy = p.y - camY;
  const size = 48; // sprites.json px=64 의 3/4 (반경 14와 어울림)
  const moving = p.moving;
  // 가만히 있을 때만 약한 bob(걷는 중엔 0: 동작 프레임이 움직임을 표현)
  const bob = moving ? 0 : Math.sin(s.time * 2.5) * -1.5;
  // 진행 방향으로 살짝 기울임(뒤집기 전 rotate → flip 후에도 진행 방향)
  const tilt = moving ? -p.face * 0.12 : 0;
  const flip = p.face < 0; // 그림 기본은 오른쪽 바라봄 → 왼쪽이면 뒤집기
  ctx.save();
  // 피격 무적 깜빡임
  if (s.alive && p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  // 동작 프레임: 죽었으면 죽음, 그 다음 피격·공격·걷기·가만히
  const f = pickPlayerFrame(p, s.alive);
  const id = f ? safeId(f.id, 'player') : 'player';
  const frame = f ? frameIndex(id) : 0;
  // 12단계 진화: 조건 충족 후 변신 대기(골드 링, 남은 시간 비례) + 변신 중(보라 글로우)
  if (!p.hidden && s.alive) {
    const pulse = 0.75 + 0.25 * Math.sin(s.time * 6);
    if (s.evolveT != null && s.evolveT > 0 && !s.evolved) {
      // 변신 대기: 골드가 커지며 다가오는 링
      const r = 26 + 10 * pulse;
      ctx.save();
      ctx.globalAlpha = 0.85 * pulse;
      ctx.strokeStyle = '#e8b83a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      // 남은 시간 바 (위쪽)
      const rem = Math.min(1, s.evolveT / EVOLVE.timer);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e8b83a';
      ctx.fillRect(sx - 24, sy - 44, 48 * rem, 4);
      ctx.restore();
    } else if (s.evolved) {
      // 변신 후: 보라 글로우 + 상시 링 (무적 5초 동안은 더 강하게)
      ctx.save();
      const strong = p.invuln > 0;
      ctx.globalAlpha = (strong ? 0.95 : 0.55) * pulse;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, 34 + 6 * pulse);
      g.addColorStop(0, 'rgba(178,102,255,0.55)');
      g.addColorStop(1, 'rgba(178,102,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, 34 + 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (strong ? 1 : 0.6) * pulse;
      ctx.strokeStyle = '#b266ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 28 + 4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  drawSprite(ctx, id, sx - size / 2, sy - size / 2, size, {
    frame,
    bob,
    flip,
    tilt,
    flash: p.hurtFlash > 0 ? 0.75 * (p.hurtFlash / PLAYER.invulnTime) : 0, // 피격 하얗게
  });
  ctx.restore();
}
