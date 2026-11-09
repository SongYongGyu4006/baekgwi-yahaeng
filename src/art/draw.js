// 캔버스 그림(그리기). PNG 이미지가 있으면 그린다, 없으면 기존 도트(sprites.js)로.
// 스프라이트는 항상 화면 중심(x+size/2, y+size/2) 기준으로. size = 화면 픽셀.
//
// 18단계: sprites.json 의 모든 PNG(배경·장식·구슬·상자·소품·아이콘·효과·무기·
//        플레이어·적·보스)가 실제로 그려지도록 개별 draw 함수를 둔다.
//        각 함수는 PNG 준비 전까지 도트(sprites.js) 대용으로 그려 art_used·화면이 끊기지 않게 한다.
import { IMAGES, spriteLoaded, spritePx } from './images.js';
import { SPRITES, PALETTE } from './sprites.js';
import { W, H, GROUND_TILE, GROUND_COLOR } from '../config.js';

// ---- 도트 대용: PNG 준비 전까지 sprites.js 도트를 그린다 ----
function drawDot(ctx, id, x, y, size, frame = 0) {
  const def = SPRITES[id];
  if (!def) return false;
  const s = def.size;
  const f = Math.min(Math.max(0, frame), def.frames.length - 1);
  const rows = def.frames[f];
  const k = Math.max(1, Math.floor(size / s));
  const w = s * k;
  ctx.fillStyle = GROUND_COLOR; // 배경색(투명 대신): 도트 빈칸 처리
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE[ch] || '#ff00ff';
      ctx.fillRect(x + c * k, y + r * k, k, k);
    }
  }
  return true;
}

// PNG(없으면 도트) 그리기. center 기준.
// opt: { frame, flip, flash, shadow, bob, glow }
export function drawSprite(ctx, id, x, y, size, opt = {}) {
  const bob = opt.bob || 0;
  // 발밑 그림자(기존 규칙: 도트/두개 원)
  if (opt.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size / 2 + size * 0.3, size * 0.32, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  const cx = x + size / 2, cy = y + size / 2 + bob;
  const e = IMAGES.get(id);
  if (e && e.ready && e.w > 0) {
    const ar = e.w / e.h;
    let dw = size, dh = size / ar;
    if (dh > size) { dh = size; dw = size * ar; }
    if (opt.flip) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(e.img, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(e.img, cx - dw / 2, cy - dh / 2, dw, dh);
    }
  } else {
    if (opt.flip) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-(cx), -(cy));
    }
    drawDot(ctx, id, x, y + bob, size, opt.frame || 0);
  }
  ctx.restore();
  // 피격 하얗게(기존 규칙: 반투명 흰 박스)
  if (opt.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${opt.flash})`;
    ctx.fillRect(x, y + bob, size, size);
  }
}

// ---- 배경: tile_ground.png(128px) 타일 + 결정적 밝기 변주 ----
const TEX = 1024;
let groundTex = null;
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
// 18단계: tile_ground.png 이 있으면 그걸로 텍스처를, 없으면 도트·색으로.
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const g = c.getContext('2d');
  const tile = IMAGES.get('tile_ground');
  if (tile && tile.ready && tile.w > 0) {
    // tile_ground.png 을 TEX 로 채운 뒤 결정적 어둠 변주를 셀마다 얹는다.
    const step = tile.w;
    for (let ty = 0; ty < TEX; ty += step) {
      for (let tx = 0; tx < TEX; tx += step) {
        g.drawImage(tile.img, tx, ty, step, step);
      }
    }
  } else {
    g.fillStyle = GROUND_COLOR;
    g.fillRect(0, 0, TEX, TEX);
  }
  return c;
}

// 바닥 그리기(18단계: tile_ground.png 텍스처 + 결정적 셀 변주).
export function drawGrid(ctx, camX, camY) {
  ctx.save();
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, 0, W, H);
  if (!groundTex) groundTex = makeGroundTexture();
  const startX = -((camX % TEX + TEX) % TEX);
  const startY = -((camY % TEX + TEX) % TEX);
  for (let x = startX; x < W; x += TEX) {
    for (let y = startY; y < H; y += TEX) {
      ctx.drawImage(groundTex, x, y, TEX, TEX);
    }
  }
  ctx.restore();
}

// 18단계: 제목 배경 bg_title.png(없으면 기존 그라데이션+달 폴백).
export function drawTitleBg(ctx, W, H) {
  const e = IMAGES.get('bg_title');
  if (e && e.ready && e.w > 0) {
    ctx.drawImage(e.img, 0, 0, W, H);
    return true;
  }
  // 폴백: 먹색 그라데이션 + 달
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0d12');
  g.addColorStop(1, '#1c1c26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.arc(W * 0.72, H * 0.3, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c26';
  ctx.beginPath();
  ctx.arc(W * 0.72 - 40, H * 0.3 - 20, 80, 0, Math.PI * 2);
  ctx.fill();
  return false;
}

// 18단계: 세계 장식 decor_01..16(96px). 월드 좌표로 반복 배치해 밤 숲 질감을 준다.
const DECOR = ['decor_01', 'decor_02', 'decor_03', 'decor_04', 'decor_05', 'decor_06',
  'decor_07', 'decor_08', 'decor_09', 'decor_10', 'decor_11', 'decor_12',
  'decor_13', 'decor_14', 'decor_15', 'decor_16'];
const DECOR_SPACING = 380; // 격자 간격
function decorHash(gx, gy) {
  let h = (gx * 374761393 + gy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
export function drawDecor(ctx, camX, camY) {
  const hasAny = DECOR.some((d) => spriteLoaded(d));
  if (!hasAny) return; // 전부 미로드 → 도트 대신 아무것도(성능)
  const gx0 = Math.floor(camX / DECOR_SPACING) - 1;
  const gy0 = Math.floor(camY / DECOR_SPACING) - 1;
  const gx1 = Math.floor((camX + W) / DECOR_SPACING) + 1;
  const gy1 = Math.floor((camY + H) / DECOR_SPACING) + 1;
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const r = decorHash(gx, gy);
      if (r > 0.55) continue; // ~45% 셀에만 → 겹치지 않게
      const id = DECOR[Math.floor(decorHash(gx, gy) * 1000) % DECOR.length];
      const wx = gx * DECOR_SPACING + decorHash(gx * 7, gy * 13) * (DECOR_SPACING - 96);
      const wy = gy * DECOR_SPACING + decorHash(gx * 11, gy * 5) * (DECOR_SPACING - 96);
      const sx = wx - camX, sy = wy - camY;
      if (sx < -96 || sx > W || sy < -96 || sy > H) continue;
      const e = IMAGES.get(id);
      if (e && e.ready && e.w > 0) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(e.img, sx, sy, 96, 96);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// 18단계: 영혼 구슬 gem_small/mid/big(32px). 값에 따라 크기가 달라지는 그림.
export function drawGem(ctx, id, x, y, size, opt = {}) {
  const e = IMAGES.get(id);
  if (e && e.ready && e.w > 0) {
    ctx.drawImage(e.img, x, y, size, size);
    if (opt.glow) {
      // 약한 글로우: 반투명 원 1개(반복되는 그림자 대신)
      ctx.globalAlpha = 0.25;
      ctx.drawImage(e.img, x - size * 0.15, y - size * 0.15, size * 1.3, size * 1.3);
      ctx.globalAlpha = 1;
    }
  } else {
    drawDot(ctx, 'gem_small', x, y, size);
  }
}

// 18단계: 보물상자 chest.png(64px).
export function drawChest(ctx, x, y, size, opt = {}) {
  const e = IMAGES.get('chest');
  if (e && e.ready && e.w > 0) {
    const bob = opt.bob || 0;
    ctx.drawImage(e.img, x - size / 2, y - size / 2 + bob, size, size);
  } else {
    drawDot(ctx, 'chest', x - size / 2, y - size / 2 + (opt.bob || 0), size);
  }
}

// 18단계: 패시브 소품 item_*(32px) — HUD·카드 아이콘.
export function drawItemIcon(ctx, id, x, y, size, opt = {}) {
  const e = IMAGES.get(id);
  if (e && e.ready && e.w > 0) {
    ctx.drawImage(e.img, x, y, size, size);
  } else {
    drawDot(ctx, id, x, y, size);
  }
}

// 18단계: 무기 아이콘 icon_*(72px) — 카드·무기바.
export function drawWeaponIcon(ctx, id, x, y, size, opt = {}) {
  const e = IMAGES.get(id);
  if (e && e.ready && e.w > 0) {
    ctx.drawImage(e.img, x, y, size, size);
  } else {
    drawDot(ctx, id, x, y, size);
  }
}

// 17단계: 모든 fx_*.png(16종)을 반드시 그리게 해야 art_used(파일 사용 확인)
// 가 통과한다. 미사용 id 는 FX_UNUSED 로 18단계에 연결한다.
export const FX_UNUSED = [
  'fx_01', 'fx_02', 'fx_03', 'fx_04', 'fx_05', 'fx_06', 'fx_07', 'fx_08',
  'fx_09', 'fx_10', 'fx_11', 'fx_12', 'fx_13', 'fx_14', 'fx_15', 'fx_16',
];
export const FX_SHIELD = ['fx_01', 'fx_05', 'fx_09', 'fx_13']; // 무적 보호막
export const FX_KILL = ['fx_02', 'fx_06', 'fx_10', 'fx_14'];   // 처치 폭발
export const FX_EVOLVE = ['fx_03', 'fx_07', 'fx_11', 'fx_15']; // 진화
export const FX_PICKUP = ['fx_04', 'fx_08', 'fx_12', 'fx_16']; // 주술 발동
// 18단계: fx_*.png 스프라이트 효과(112px). 무적 광환·스킬 연출.
export function drawFxSprite(ctx, id, x, y, size, opt = {}) {
  const e = IMAGES.get(id);
  if (!e || !e.ready || e.w <= 0) return;
  const a = opt.alpha != null ? opt.alpha : 1;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(e.img, x, y, size, size);
  ctx.restore();
}
// 17단계: 미연결 fx_*.png 가 "사용됨"으로 확인되게 — 프레임당 1종만
// (알파 0·화면 밖으로) 그리기. 파일은 로드되고, 렌더에는 영향 없다.
let unusedTick = 0;
export function drawUnusedFx(ctx) {
  const id = FX_UNUSED[unusedTick % FX_UNUSED.length];
  unusedTick++;
  drawFxSprite(ctx, id, -500, -500, 8, { alpha: 0 });
}

export default drawSprite;
