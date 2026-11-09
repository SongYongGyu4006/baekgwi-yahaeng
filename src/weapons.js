// 무기 공통 구조(쿨다운·발사·업데이트) + 레지스트리.
// 부적은 M6에서 만든 첫 무기(단일 수치 + 레벨별 규칙). 나머지 7종(부채바람·
// 방울·도깨비불·죽창·장구·벼락·먹물)은 weapons_a.js / weapons_b.js 에 있고,
// 이 파일에서 레지스트리로 모아 updateWeapons/drawProjectiles 이 통일해서 돌린다.
import { WEAPONS, weaponStat, MAX_WEAPON_SLOTS } from './config.js';
import { calcDamage, calcKnockback } from './combat.js';
import { drawSprite } from './art/draw.js';
import { playSfx } from './audio/sfx.js';
import { emitHit } from './fx.js';
import { fan, bell, dokkaebi, strikeEnemy } from './weapons_a.js';
import { spear, janggu, thunder, ink } from './weapons_b.js';

// 17단계: 타격 등록 — 피해 합계 + 콤보(1.2초 유지) + 타격 멈춤(55ms).
// strikeEnemy(weapons_a)·부적 hitEnemy·보스(weapons_b) 모두 여기로 통일.
// (순환 import 없음: weapons_a 는 weapons 로부터 wStat 만, combat → config 만)
export function registerHit(s, e, dmg) {
  if (!e || e.dead || e.hp <= 0) return;
  const d = Math.max(0, dmg || 0);
  s.dmgDealt = (s.dmgDealt || 0) + Math.min(e.hp, d); // 준 피해(레치 없음)
  if (d > (s.dmgMax || 0)) s.dmgMax = d;
  s.combo = (s.combo || 0) + 1;
  s.comboT = 1.2;
  if (s.combo > (s.comboMax || 0)) s.comboMax = s.combo;
  if ((s.hitStopCd || 0) <= 0) {
    s.hitStop = 0.055;   // 55ms(50~80ms)
    s.hitStopCd = 0.32;  // 재사용 대기
  }
}

// 신규 7종 공용 수치: lv[]가 있으면 Lv(n), 부적은 단수 수치.
// (부적은 stats() 규칙을 스스로 갖고 있어 여기서 안 씀)
// im = 11단계 소품 배율 { atk, area, cd, ... } — 쿨다운·범위에 곱한다.
// (공격력은 strikeEnemy 가 s.player.atkBonus 으로, 쿨다운/범위는 여기)
export function wStat(w, s, im) {
  const st = weaponStat(w.id, w.level) || WEAPONS[w.id];
  if (!im) return st;
  // 12단계 진화 특수 효과: 쿨다운 배율(evolveCd, 변신 중 0.7)
  if (s && s.evolveCd && s.evolveCd !== 1 && st.cd) st.cd *= s.evolveCd;
  // 쿨다운: base * stats.cd (하한 0.4 — 무한 발사 방지)
  if (st.cd) st.cd = Math.max(0.4, st.cd * (im.cd || 1));
  // 범위(반경·사거리): base * stats.area
  if (st.area) st.area *= (im.area || 1);
  if (st.range) st.range *= (im.area || 1);
  return st;
}

// ---- 부적 (설계서 6.2: 가장 가까운 적에게 투사, 기본 10, 쿨다운 1.0s) ----
function makeProjectile(x, y, vx, vy, dmg, def) {
  const d = Math.hypot(vx, vy) || 1;
  return { weapon: 'talisman', x, y, vx, vy, dmg, def, nx: vx / d, ny: vy / d, r: 8, life: 1.6, hit: null, hits: 0, dead: false };
}

function hitEnemy(p, e, s) {
  // 11단계: 소품 'power' 공격력(atkBonus)을 부적에 더한다.
  const atkBonus = (s.talismanBonus || 0) + (s.player && s.player.atkBonus || 0);
  // 12단계 진화 특수 효과: 변신 중 부적 피해 evolveDmg(=2) 배
  const dmg = calcDamage(p.dmg * (s.evolveDmg || 1), atkBonus, Math.random() < 0.05, e.def.def || 0);
  registerHit(s, e, dmg); // 18단계: 준 피해 합계 + 17단계 콤보·타격멈춤
  e.hp -= dmg;
  const kb = calcKnockback(dmg, p.nx, p.ny);
  e.kx += kb.dx * 8;
  e.ky += kb.dy * 8;
  e.flash = 0.08;
  emitHit(e.x, e.y);
  if (s.fxNumbers) s.fxNumbers.push({ x: e.x, y: e.y - 16, v: dmg, crit: false, t: 0.7 });
  if (s.fxParticles) s.fxParticles.push({ x: e.x, y: e.y, vx: p.nx * 40, vy: p.ny * 40 - 20, t: 0.3 });
}

const talisman = {
  id: 'talisman',
  create() { return { id: 'talisman', level: 1, cd: 0, speed: WEAPONS.talisman.speed }; },
  // 인스턴스 메서드: w.stats(w.level, s) 로 부른다(레지스트리 공통 인터페이스)
  stats(lv, s) {
    const t = WEAPONS.talisman;
    let dmg = t.dmg, count = 1, pierce = 1;
    if (lv >= 2) count += 1;
    if (lv >= 3) dmg += 5;
    if (lv >= 4) count += 1;
    if (lv >= 5) pierce += 1;
    if (lv >= 6) dmg += 5;
    if (lv >= 7) count += 1;
    if (lv >= 8) dmg += 10;
    if (s && s.talismanBonus) dmg *= (1 + s.talismanBonus);
    // 12단계 진화 특수 효과: 변신 중 피해 evolveDmg(=2) 배, 쿨다운 evolveCd(0.7)
    if (s && s.evolveDmg) dmg *= s.evolveDmg;
    let cd = t.cooldown * Math.pow(0.92, lv - 1);
    if (s && s.talismanCdMul) cd *= s.talismanCdMul;
    if (s && s.evolveCd && s.evolveCd !== 1) cd *= s.evolveCd;
    return { dmg, count, pierce, cd };
  },
  // 발사: 가장 가까운 적에게 (count)발. (인스턴스 메서드: fire(w, s))
  fire(w, s) {
    const p = s.player;
    const st = w.stats(w.level, s);
    const enemies = s.enemies.filter((e) => e.hp > 0);
    if (!enemies.length) return;
    enemies.sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
    const n = Math.min(st.count, enemies.length);
    try { playSfx(WEAPONS.talisman.sfx); } catch (e) { /* */ }
    for (let i = 0; i < n; i++) {
      const e = enemies[i];
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      s.projectiles.push(makeProjectile(p.x + (dx / d) * 18, p.y + (dy / d) * 18, (dx / d) * w.speed, (dy / d) * w.speed, st.dmg, e.def.def || 0));
    }
  },
  // 투사체 비행·명중. (인스턴스 메서드: update(w, p, s, enemies, dt) — 레지스트리 공통 인터페이스)
  update(w, p, s, enemies, dt) {
    const st = w.stats(w.level);
    for (const pr of s.projectiles) {
      if (pr.dead || pr.weapon !== w.id) continue;
      pr.life -= dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      for (const e of enemies) {
        if (e.hp <= 0 || pr.hit === e) continue;
        const dx = pr.x - e.x, dy = pr.y - e.y;
        const minD = pr.r + (e.radius || 10);
        if (dx * dx + dy * dy < minD * minD) {
          hitEnemy(pr, e, s);
          pr.hits += 1;
          if (pr.hits >= st.pierce) { pr.dead = true; break; }
        }
      }
    }
    if (s.projectiles.length) s.projectiles = s.projectiles.filter((pr) => !pr.dead);
  },
  draw(ctx, w, s, camX, camY) {
    for (const pr of s.projectiles) {
      const sx = pr.x - camX, sy = pr.y - camY;
      if (sx < -32 || sx > 1312 || sy < -32 || sy > 752) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(pr.ny, pr.nx));
      ctx.rotate(Math.PI / 2);
      drawSprite(ctx, WEAPONS.talisman.sprite, -12, -12, 24, { shadow: false });
      ctx.restore();
    }
  },
  levelUp(w) { if (w.level < 8) w.level++; },
};

// 무기 레지스트리 (REFERENCE 10단계: 8종). create()로 새 인스턴스를 만든다.
export const REGISTRY = { talisman, fan, bell, dokkaebi, spear, janggu, thunder, ink };
export const WEAPON_IDS = Object.keys(REGISTRY);

// 부적 인스턴스 생성: stats 메서드를 붙여 w.stats(w.level, s) 인터페이스 통일.
// (레지스트리는 create()만 유지 — 메서드를 create 안에 넣으면 순환 참조가 되므로
// create()가 반환한 객체에 메서드를 할당한다. 위 talisman 정의 뒤에 정의되어야 한다.)
export function createWeapon(id, level = 1) {
  const d = REGISTRY[id];
  if (!d) return null;
  const w = d.create ? d.create(level) : d.create();
  // 부적 인스턴스에 공통 인터페이스 메서드(stats/fire/update/draw)를 붙인다.
  // (레지스트리 정의는 create()만 — 메서드를 create 안에 넣으면 순환 참조)
  if (w && w.id === 'talisman') {
    w.stats = (lv, s) => talisman.stats(lv, s);
    w.fire = (ww, s) => talisman.fire(ww, s);
    w.update = (ww, p, s, enemies, dt) => talisman.update(ww, p, s, enemies, dt);
    w.draw = (ctx, ww, s, camX, camY) => talisman.draw(ctx, ww, s, camX, camY);
  } else if (w) {
    // 신규 7종(weapons_a/b)은 update(w, dt, p, s, enemies) 안에서 쿨다운·발사를 스스로 처리한다.
    // 공통 호출 순서(ww, p, s, enemies, dt)에 맞춰 붙이고, updateWeapons 가 쿨다운을 건드리지 않게 self 표시.
    w.self = true;
    if (d.update) w.update = (ww, p, s, enemies, dt) => d.update(ww, dt, p, s, enemies);
    // weapons_b 의 draw 는 (ctx, w, p, s, camX, camY) — 플레이어 인자가 하나 더 있다
    if (d.draw) w.draw = d.draw.length >= 6 ? (ctx, ww, s, camX, camY) => d.draw(ctx, ww, s.player, s, camX, camY) : (ctx, ww, s, camX, camY) => d.draw(ctx, ww, s, camX, camY);
    if (d.levelUp) w.levelUp = () => d.levelUp(w);
  }
  return w;
}
// 하위 호환: createTalisman(레벨) — createWeapon('talisman') 의 별칭.
export function createTalisman(level = 1) {
  return createWeapon('talisman', level);
}

// 시작 시 기본 무기 지급: 부적 Lv1. (8종 모두 장착하면 8칸 — 슬롯 상한은
// 레벨업 신규 뽑기에만 적용. 시작 기본 무기는 1.)
export function grantInitialWeapons(s) {
  if (!s.weapons.length) s.weapons.push(createWeapon('talisman'));
}

// 매 프레임: 쿨다운 감쇠 → 0이면 발사 → update.
// (신규 7종은 cd=0 도깨비불처럼 매 프레임 회전만 하고, 쿨다운 기반은 cd<=0에서)
export function updateWeapons(s, dt) {
  // 11단계: 소품 배율 (쿨다운·범위). 카드 선택 시 캐시(s.itemStats) — 프레임마다 안 부름.
  const im = s.player && s.player.itemStats;
  for (const w of s.weapons) {
    if (!s.alive) { if (w.update && !w.self) w.update(w, s.player, s, s.enemies, dt); continue; }
    if (w.self) { if (w.update) w.update(w, s.player, s, s.enemies, dt); continue; }
    if (w.cd !== undefined) w.cd = Math.max(0, w.cd - dt);
    const st = w.id === 'talisman' ? w.stats(w.level, s) : wStat(w, s, im);
    if (w.cd <= 0 && st && st.cd > 0) {
      w.cd = st.cd;
      if (w.fire) { w.fire(w, s); s.player.atkT = 0.15; }
    }
    if (w.update) w.update(w, s.player, s, s.enemies, dt);
  }
}

// 투사체(부적) + 신규 7종 효과 + 피해 숫자·파티클 그리기
export function drawProjectiles(ctx, s, camX, camY) {
  for (const w of s.weapons) {
    if (w.draw) w.draw(ctx, w, s, camX, camY);
  }
  drawFx(ctx, s, camX, camY);
}

// 피해 숫자(떠오름) + 파티클
export function drawFx(ctx, s, camX, camY) {
  if (!s.fxNumbers) return;
  ctx.save();
  ctx.textAlign = 'center';
  for (const n of s.fxNumbers) {
    const sx = n.x - camX, sy = n.y - camY;
    if (sx < -40 || sx > 1320 || sy < -40 || sy > 760) continue;
    const a = Math.max(0, Math.min(1, n.t / 0.7));
    ctx.globalAlpha = a;
    ctx.fillStyle = n.crit ? '#e8b83a' : '#f2efe6';
    ctx.font = n.crit ? 'bold 20px sans-serif' : '14px sans-serif';
    ctx.fillText(String(n.v), sx, sy);
  }
  ctx.globalAlpha = 1;
  for (const pt of s.fxParticles || []) {
    const a = Math.max(0, pt.t / 0.3);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e88a3a';
    ctx.fillRect(pt.x - camX - 1.5, pt.y - camY - 1.5, 3, 3);
  }
  ctx.restore();
}

// fx 업데이트: 숫자 떠오름(0.7초), 파티클 이동(0.3초)
export function updateFx(s, dt) {
  if (s.fxNumbers) {
    for (const n of s.fxNumbers) { n.y -= 34 * dt; n.t -= dt; }
    s.fxNumbers = s.fxNumbers.filter((n) => n.t > 0);
  }
  if (s.fxParticles) {
    for (const pt of s.fxParticles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.t -= dt; }
    s.fxParticles = s.fxParticles.filter((pt) => pt.t > 0);
  }
}

// 레벨업 카드: 무기 후보 풀 (REFERENCE 10단계 ②).
// 신규 무기는 슬롯(MAX_WEAPON_SLOTS=6)이 남았을 때만, Lv8 무기는 뺀다.
export function weaponCardPool(s) {
  const pool = [];
  for (const w of s.weapons) if (w.level < 8) pool.push({ kind: 'up', id: w.id });
  if (s.weapons.length < MAX_WEAPON_SLOTS) {
    for (const id of WEAPON_IDS) if (!s.weapons.some((w) => w.id === id)) pool.push({ kind: 'new', id });
  }
  return pool;
}

// 카드 적용: 신규 = createWeapon()으로 push(슬롯 상한 가드), up = levelUp.
export function applyWeaponCard(s, c) {
  if (!c || !REGISTRY[c.id]) return false;
  if (c.kind === 'new') {
    if (s.weapons.length >= MAX_WEAPON_SLOTS) return false; // 두 곳(풀+적용)에서 가드
    s.weapons.push(createWeapon(c.id));
  } else {
    const w = s.weapons.find((x) => x.id === c.id);
    if (w) REGISTRY[c.id].levelUp(w);
  }
  return true;
}
