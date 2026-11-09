// 10단계: 무기 7종 중 A 그룹 — 부채바람·방울·도깨비불.
// 부적과 같은 모양의 객체 { create, update, draw, levelUp } 를 만든다.
// 수치는 전부 config.js WEAPONS 표에서 읽고, 피해는 combat.js calcDamage.
// 킬·경험치는 enemies.js(updateEnemies)에서 hp<=0 을 처리하므로, 무기는
// hp만 깎고 킬은 안 잡는다(중복 킬·구슬 방지).
// 11단계: 소품 배율(s.player.itemStats)을 wStat 으로 쿨다운·범위에 곱한다.
import { WEAPONS } from './config.js';
import { wStat, registerHit } from './weapons.js';
import { calcDamage, calcKnockback } from './combat.js';
import { playSfx } from './audio/sfx.js';
import { drawSprite } from './art/draw.js';

// 무기가 한 적을 때리는 공용 헬퍼. hp 0으로만 깎고, 킬·구슬·사운드는 안 한다
// (updateEnemies 가 hp<=0 적을 정리하며 킬+구슬+kill sfx 처리). 피해 숫자는
// 부적이 쓰는 것과 동일하게 s.fxNumbers 에 올린다.
// 11단계: 공격력 소품(atkBonus)을 calcDamage 의 atkBonus 자리에 넣는다.
//   atkBonus = s.talismanBonus(부적) + s.player.atkBonus(소품 'power')
export function strikeEnemy(s, e, w, base, nx, ny, kbMul = 1) {
  if (!e || e.hp <= 0) return false;
  const def = (e.def && e.def.def) || 0;
  const atkBonus = (s.talismanBonus || 0) + (s.player && s.player.atkBonus || 0);
  // 12단계 진화 특수 효과: 변신 중 무기 피해 evolveDmg(=2) 배
  const d = calcDamage(base * (s.evolveDmg || 1), atkBonus, Math.random() < 0.05, def);
  registerHit(s, e, d); // 18단계: 준 피해 합계 + 17단계 콤보·타격멈춤
  e.hp = Math.max(0, e.hp - d);
  e.flash = 0.08;
  const k = calcKnockback(d, nx, ny);
  if (k.power) { e.kx = (e.kx || 0) + k.dx * kbMul; e.ky = (e.ky || 0) + k.dy * kbMul; }
  if (!s.fxNumbers) s.fxNumbers = [];
  s.fxNumbers.push({ x: e.x, y: e.y - (e.radius || 10) - 6, v: d, crit: false, t: 0.7 });
  return true;
}

// 바라보는 방향 (p.facing) 단위 벡터.
function facing(p) {
  const fx = p.facing ? p.facing.x : 1, fy = p.facing ? p.facing.y : 0;
  const l = Math.hypot(fx, fy) || 1;
  return { x: fx / l, y: fy / l };
}

// ---- 부채바람: 부채꼴 넉백. 피해 작고 밀어내기가 크다 ----
export const fan = {
  id: 'fan',
  create() { return { id: 'fan', level: 1, cd: 0, t: 0, fired: 0 }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt; w.t = Math.max(0, w.t - dt);
    if (w.cd <= 0) {
      w.cd = st.cd;
      const base = Math.atan2(p.facing ? p.facing.y : 0, p.facing ? p.facing.x : 1);
      w.t = 0.28; w.fired = 1;
      try { playSfx(WEAPONS.fan.sfx); } catch (e) { /* */ }
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > st.area + (e.radius || 10)) continue;
        const ea = Math.atan2(dy, dx);
        let diff = ea - base;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > st.arc / 2) continue;
        const k = strikeEnemy(s, e, w, st.dmg, dx / d, dy / d, st.kb / 100);
        if (k) { const kx = calcKnockback(st.dmg, dx / d, dy / d); e.kx = (e.kx || 0) + (kx.dx / 100) * st.kb * 0.12; e.ky = (e.ky || 0) + (kx.dy / 100) * st.kb * 0.12; }
      }
    }
  },
  draw(ctx, w, s, camX, camY) {
    const p = s.player;
    if (w.t <= 0) return;
    const st = wStat(w, s, p && p.itemStats);
    const a = w.t / 0.28; // 1→0
    const base = Math.atan2(p.facing ? p.facing.y : 0, p.facing ? p.facing.x : 1);
    const sx = p.x - camX, sy = p.y - camY;
    ctx.save();
    ctx.globalAlpha = 0.5 * a;
    ctx.translate(sx, sy);
    ctx.rotate(base);
    const r = st.area * (1 - a * 0.35);
    ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, -st.arc / 2, st.arc / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// ---- 방울: 주기적으로 퍼지는 링 (링 통과 시 적 타격) ----
export const bell = {
  id: 'bell',
  create() { return { id: 'bell', level: 1, cd: 0, ring: null }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt;
    if (w.cd <= 0) {
      w.cd = st.cd;
      w.ring = { r: 8, hit: new Set() };
      try { playSfx(WEAPONS.bell.sfx); } catch (e) { /* */ }
    }
    const rg = w.ring;
    if (!w.ring) return;
    rg.r += st.speed * dt;
    const maxR = st.area;
    for (const e of enemies) {
      if (e.hp <= 0 || rg.hit.has(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (Math.abs(d - rg.r) < 18 + (e.radius || 10)) {
        const dx = e.x - p.x, dy = e.y - p.y, dl = Math.hypot(dx, dy) || 1;
        if (strikeEnemy(s, e, w, st.dmg, dx / dl, dy / dl)) rg.hit.add(e);
      }
    }
    if (rg.r > maxR) w.ring = null;
  },
  draw(ctx, w, s, camX, camY) {
    const p = s.player;
    const rg = w.ring;
    if (!rg) return;
    const st = wStat(w, s, p && p.itemStats);
    const a = Math.max(0, 1 - rg.r / st.area);
    const sx = p.x - camX, sy = p.y - camY;
    ctx.save();
    ctx.globalAlpha = 0.6 * a + 0.1;
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, rg.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// ---- 도깨비불: 플레이어를 도는 불꽃 count 개, 회전하며 적 타격 ----
export const dokkaebi = {
  id: 'dokkaebi',
  create() { return { id: 'dokkaebi', level: 1, ang: 0, hit: {} }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.ang += st.rot * dt;
    // 재타격 대기: 적마다 hitT. 0.35초 동안 같은 불꽃이 재타격 못 함.
    const n = st.count;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (w.hit[e.id] && w.hit[e.id] > 0) { w.hit[e.id] -= dt; continue; }
      // 가장 가까운 불꽃이 적을 스친가 (count 개 중 하나라도 반경 안)
      for (let i = 0; i < n; i++) {
        const a = w.ang + (i * Math.PI * 2) / n;
        const fx = p.x + Math.cos(a) * st.area, fy = p.y + Math.sin(a) * st.area;
        const d = Math.hypot(e.x - fx, e.y - fy);
        if (d < 14 + (e.radius || 10)) {
          const nx = (e.x - fx), ny = (e.y - fy), nl = Math.hypot(nx, ny) || 1;
          if (strikeEnemy(s, e, w, st.dmg, nx / nl, ny / nl)) { w.hit[e.id] = 0.35; break; }
        }
      }
    }
    // 오래된 hit 기록 정리(메모리 누수 방지)
    if (Object.keys(w.hit).length > 400) { for (const k in w.hit) if (w.hit[k] <= 0) delete w.hit[k]; }
  },
  draw(ctx, w, s, camX, camY) {
    const p = s.player;
    const st = wStat(w, s, p && p.itemStats);
    const n = st.count;
    const sx = p.x - camX, sy = p.y - camY;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a = w.ang + (i * Math.PI * 2) / n;
      const fx = sx + Math.cos(a) * st.area, fy = sy + Math.sin(a) * st.area;
      drawSprite(ctx, 'wpn_fireball', fx - 8, fy - 8, 16, { shadow: false });
    }
    ctx.restore();
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};
