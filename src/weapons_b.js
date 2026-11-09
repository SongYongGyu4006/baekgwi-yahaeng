// 10단계: 무기 7종 중 B 그룹 — 죽창·장구·벼락·먹물.
// 수치는 config.js WEAPONS 표, 피해는 combat.js, 공용 타격은 weapons_a.strikeEnemy.
import { WEAPONS, W, H } from './config.js';
import { wStat } from './weapons.js';
import { calcDamage, calcKnockback } from './combat.js';
import { playSfx } from './audio/sfx.js';
import { strikeEnemy } from './weapons_a.js';
import { drawSprite } from './art/draw.js';

// ---- 죽창: 직선 관통 창. 적당 관통(pierce), hit Set으로 중복 피해 방지 ----
export const spear = {
  id: 'spear',
  create() { return { id: 'spear', level: 1, cd: 0, list: [] }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt;
    if (w.cd <= 0) {
      w.cd = st.cd;
      try { playSfx(WEAPONS.spear.sfx); } catch (e) { /* */ }
      const f = p.facing || { x: 1, y: 0 };
      const l = Math.hypot(f.x, f.y) || 1;
      const dx = f.x / l, dy = f.y / l;
      for (let i = 0; i < st.count; i++) {
        w.list.push({ x: p.x + dx * 18, y: p.y + dy * 18, dx, dy, t: 0, range: st.range, speed: st.speed, pierce: st.pierce, dmg: st.dmg, hit: new Set() });
      }
      if (w.list.length > 24) w.list.splice(0, w.list.length - 24); // 상한
    }
    for (let i = w.list.length - 1; i >= 0; i--) {
      const b = w.list[i];
      b.t += dt;
      b.x += b.dx * b.speed * dt;
      b.y += b.dy * b.speed * dt;
      if (b.t > b.range / b.speed) { w.list[i] = w.list[w.list.length - 1]; w.list.pop(); continue; }
      for (const e of enemies) {
        if (e.hp <= 0 || b.hit.has(e)) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < 16 + (e.radius || 10)) {
          if (strikeEnemy(s, e, w, b.dmg, b.dx, b.dy)) { b.hit.add(e); b.pierce--; if (b.pierce <= 0) break; }
        }
      }
    }
  },
  draw(ctx, w, p, s, camX, camY) {
    for (const b of w.list) {
      const sx = b.x - camX, sy = b.y - camY;
      if (sx < -60 || sx > 1340 || sy < -60 || sy > 780) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(b.dy, b.dx));
      drawSprite(ctx, 'wpn_spear', -14, -8, 28, { shadow: false });
      ctx.restore();
    }
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// ---- 장구: 범위 충격파 (일시 타격 + 넉백) ----
export const janggu = {
  id: 'janggu',
  create() { return { id: 'janggu', level: 1, cd: 0, t: 0, hit: new Set() }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt;
    if (w.cd <= 0) {
      w.cd = st.cd;
      w.t = 0.3;
      w.hit.clear();
      try { playSfx(WEAPONS.janggu.sfx); } catch (e) { /* */ }
      for (const e of enemies) {
        if (e.hp <= 0 || w.hit.has(e)) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (Math.hypot(dx, dy) < st.area + (e.radius || 10)) {
          const dl = Math.hypot(dx, dy) || 1;
          const k = calcKnockback(st.dmg, dx / dl, dy / dl);
          if (strikeEnemy(s, e, w, st.dmg, dx / dl, dy / dl, st.kb / 100)) {
            w.hit.add(e);
            if (k.power) { e.kx = (e.kx || 0) + k.dx * 0.6; e.ky = (e.ky || 0) + k.dy * 0.6; }
          }
        }
      }
    }
    if (w.t > 0) w.t -= dt;
  },
  draw(ctx, w, p, s, camX, camY) {
    if (w.t <= 0) return;
    const st = wStat(w, s, s.player && s.player.itemStats);
    const a = w.t / 0.3;
    const sx = p.x - camX, sy = p.y - camY;
    ctx.save();
    ctx.globalAlpha = 0.5 * a + 0.1;
    ctx.strokeStyle = '#ffcf6b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, st.area * (0.4 + 0.6 * a), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// ---- 벼락: 화면 안 무작위 적 1~count 마리 낙뢰 (성능: 적 한 마리만 타격) ----
export const thunder = {
  id: 'thunder',
  create() { return { id: 'thunder', level: 1, cd: 0, bolts: [] }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt;
    // 볼트 연출 감소
    for (let i = w.bolts.length - 1; i >= 0; i--) { w.bolts[i].t -= dt; if (w.bolts[i].t <= 0) { w.bolts[i] = w.bolts[w.bolts.length - 1]; w.bolts.pop(); } }
    if (w.cd <= 0) {
      w.cd = st.cd;
      try { playSfx(WEAPONS.thunder.sfx); } catch (e) { /* */ }
      const camX = s.camera ? s.camera.x : p.x - W / 2;
      const camY = s.camera ? s.camera.y : p.y - H / 2;
      // 화면 안에 있는 살아 있는 적 후보
      const inView = enemies.filter(e => {
        if (e.hp <= 0) return false;
        const sx = e.x - camX, sy = e.y - camY;
        return sx > 0 && sx < W && sy > 0 && sy < H;
      });
      for (let i = 0; i < st.count && inView.length; i++) {
        const idx = Math.floor(Math.random() * inView.length);
        const e = inView.splice(idx, 1)[0];
        const k = strikeEnemy(s, e, w, st.dmg, (Math.random() - 0.5), -1);
        if (k) { const kk = calcKnockback(st.dmg, 0, -1); e.ky = (e.ky || 0) - kk.power * 0.5; }
        w.bolts.push({ x: e.x, y: e.y, t: 0.35 });
      }
      if (w.bolts.length > 10) w.bolts.splice(0, w.bolts.length - 10);
    }
  },
  draw(ctx, w, p, s, camX, camY) {
    for (const b of w.bolts) {
      const sx = b.x - camX, sy = b.y - camY;
      const a = b.t / 0.35;
      ctx.save();
      ctx.globalAlpha = 0.9 * a;
      ctx.strokeStyle = '#cfe0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 220);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      drawSprite(ctx, 'wpn_lightning', sx - 14, sy - 16, 28, { shadow: false, flash: a });
      ctx.restore();
    }
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// ---- 먹물: 바닥 장판, 지속 피해 + 감속. 장판 8개 상한, 오래된 것부터 제거 ----
export const ink = {
  id: 'ink',
  create() { return { id: 'ink', level: 1, cd: 0, pads: [], tick: 0 }; },
  update(w, dt, p, s, enemies) {
    const st = wStat(w, s, s.player && s.player.itemStats);
    w.cd -= dt;
    if (w.cd <= 0) {
      w.cd = st.cd;
      w.pads.push({ x: p.x, y: p.y, area: st.area, dmg: st.dmg, slow: st.slow, dur: st.dur, life: st.dur });
      if (w.pads.length > 8) w.pads.shift(); // 상한: 가장 오래된 것부터
      try { playSfx(WEAPONS.ink.sfx); } catch (e) { /* */ }
    }
    // 장판 수명 + 지속 피해(tick)
    w.tick += dt;
    const tickInt = Math.min(1, w.tick); // 1초당 피해
    for (let i = w.pads.length - 1; i >= 0; i--) {
      const pad = w.pads[i];
      pad.life -= dt;
      if (pad.life <= 0) { w.pads[i] = w.pads[w.pads.length - 1]; w.pads.pop(); continue; }
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - pad.x, dy = e.y - pad.y;
        if (dx * dx + dy * dy < pad.area * pad.area) {
          // 감속(장판 안 적 이동 속도 감쇄) — 적별 slowT
          e.slowT = (e.slowT || 0) + dt;
          e.slowMul = pad.slow;
          if (w.tick >= 1) {
            w.tick -= 1;
            if (strikeEnemy(s, e, w, pad.dmg, dx || 0.1, dy || 0.1)) { /* */ }
          }
        }
      }
    }
  },
  draw(ctx, w, p, s, camX, camY) {
    for (const pad of w.pads) {
      const sx = pad.x - camX, sy = pad.y - camY;
      if (sx < -160 || sx > 1440 || sy < -160 || sy > 880) continue;
      const a = Math.min(1, pad.life / 0.6) * 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#1a1626';
      ctx.beginPath();
      ctx.ellipse(sx, sy, pad.area, pad.area * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};
