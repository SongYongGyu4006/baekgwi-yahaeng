// 그림 파일(assets/sprites/*.png) 이미지 로더. sprites.json 의 id -> file·px 를 읽는다.
// drawSprite 는 이 모듈에서 Image 를 먼저 쓰고, 다 불러오기 전엔 기존 도트(sprites.js)를 쓴다.
// node(단위 시험)에서도 import 가 가능하도록 환경(브라우저/노드)을 갈라놓는다.
import { PALETTE, SPRITES } from './sprites.js';

const isBrowser = typeof document !== 'undefined' && typeof Image !== 'undefined';

let manifest = null;
try {
  if (isBrowser) {
    const txt = await (await fetch(new URL('../../assets/sprites/sprites.json', import.meta.url))).text();
    manifest = JSON.parse(txt);
  } else {
    const fs = await import('node:fs');
    manifest = JSON.parse(fs.readFileSync(new URL('../../assets/sprites/sprites.json', import.meta.url), 'utf8'));
  }
} catch (e) {
  console.warn('[art] sprites.json 로딩 실패, 도트로만 그립니다:', e && e.message);
  manifest = null; // sprites.json 이 없으면 도트만 쓴다
}

// id -> { img, w, h, px, ready, failed, pending }
export const IMAGES = new Map();
let allLoaded = false;

if (manifest && isBrowser) {
  // 1) 명시적 이미지(id -> file)
  for (const [id, def] of Object.entries(manifest)) {
    if (id.startsWith('_')) continue; // _anims 같은 메타 항목은 이미지가 아님
    if (def && def.file) loadImg(id, def.file, def.px || 32);
  }
  // 2) _anims 동작 프레임(파일명 = 프레임 id). 10/28: 이 부분이 없어서
  //    걷기·공격·이동 프레임이 도트 대용으로만 그려졌다.
  if (manifest._anims) {
    for (const set of Object.values(manifest._anims)) {
      for (const files of Object.values(set || {})) {
        for (const file of files || []) {
          const id = String(file).split('/').pop().replace(/\.[^.]+$/, '');
          if (IMAGES.has(id)) continue;
          loadImg(id, file, 64);
        }
      }
    }
  }
  // 3) 18단계: 모든 PNG가 실제로 그려져야 하므로, 아직 안 불러온 manifest
  //    파일(배경·장식·아이콘·효과 등)도 전부 적재한다. 파일만 요청되는 게
  //    아니라 렌더에서 drawImage 해야 art_used 가 통과한다.
  for (const [id, def] of Object.entries(manifest)) {
    if (id.startsWith('_') || !def || !def.file) continue;
    if (!IMAGES.has(id)) loadImg(id, def.file, def.px || 64);
  }
}

function loadImg(id, file, px) {
  const img = new Image();
  img.decoding = 'async';
  const entry = { img, w: 0, h: 0, px, ready: false, failed: false, pending: true };
  img.addEventListener('load', () => {
    entry.pending = false;
    entry.w = img.naturalWidth || px;
    entry.h = img.naturalHeight || px;
    entry.ready = true;
    checkAll();
  });
  img.addEventListener('error', () => {
    entry.pending = false;
    entry.failed = true; // 그림 실패 → drawSprite 는 도트로 대체
    checkAll();
  });
  IMAGES.set(id, entry);
  img.src = new URL('../../' + file, import.meta.url);
  return entry;
}

// 전부(또는 실패 확정)끝나면 true. 실패한 건 ready=false 로 남고 그리는 쪽은 도트로 대체.
function checkAll() {
  if (allLoaded) return;
  for (const e of IMAGES.values()) if (e.pending && !e.ready) return;
  allLoaded = true;
}
if (IMAGES.size === 0) allLoaded = true;

export function spriteLoaded(id) {
  const e = IMAGES.get(id);
  return !!(e && e.ready && e.w > 0);
}

export function allSpritesReady() {
  return allLoaded;
}

// sprites.json 의 _anims(동작 프레임 파일 목록). 메타 항목이라 Image 로드는 안 한다.
// anim.js 에서 import: animFrames('player', 'walk') → 파일명 배열, 없으면 null.
export function getAnims() {
  return (manifest && manifest._anims) || null;
}

// 스프라이트의 화면 픽셀 크기. sprites.json 의 px 를 따른다(없으면 도트 크기*2).
export function spritePx(id) {
  const m = manifest && manifest[id];
  if (m) return m.px;
  const d = SPRITES[id];
  return d ? d.size * 2 : 32;
}

// node(단위 시험)에서 OffscreenCanvas 도트 캔버스를 만든다.
// 브라우저에서 호출되는 일은 없고, 시험이 그림 데이터를 확인하는 용도.
export function makeSpriteCanvas(id, frame = 0, scale = 1) {
  const def = SPRITES[id];
  if (!def) return null;
  const f = Math.min(Math.max(0, Math.floor(frame)), def.frames.length - 1);
  const k = Math.max(1, Math.round(scale));
  const c = new OffscreenCanvas(def.size * k, def.size * k);
  const g = c.getContext('2d');
  const rows = def.frames[f] || def.frames[0];
  for (let y = 0; y < def.size; y++) {
    for (let x = 0; x < def.size; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = PALETTE[ch] || '#ff00ff';
      g.fillRect(x * k, y * k, k, k);
    }
  }
  return c;
}

export default IMAGES;
