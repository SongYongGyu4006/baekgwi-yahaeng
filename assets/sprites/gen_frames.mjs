// 동작 프레임 PNG 생성기(한번): 기본 스프라이트를 변형해 sprites.json _anims 의 프레임 파일을 만든다.
//   node game/assets/sprites/gen_frames.mjs
// 플레이어: walk 4프레임(보행 흔들림) + act 4프레임(가만히·공격·피격·죽음)
// 처녀귀신: move 4프레임(부유 느낌), 강시: move 4프레임(웅크림·점프)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const dir = path.dirname(fileURLToPath(import.meta.url));

// --- PNG 인코딩(최소 기능: 8비트 RGBA, non-interlaced) ---
function crc32(buf) {
  if (!crc32.table) {
    crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8비트 RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // none filter
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- PNG 디코딩(최소 기능: 8비트, 컬러타입 2(RGB)/6(RGBA)) ---
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
function decodePng(buf) {
  const chunks = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push([type, data]);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const ihdr = chunks.find((c) => c[0] === 'IHDR');
  const w = ihdr[1].readUInt32BE(0), h = ihdr[1].readUInt32BE(4);
  const bit = ihdr[1][8], colort = ihdr[1][9];
  if (bit !== 8 || (colort !== 6 && colort !== 2)) throw new Error('지원 안 되는 픽셀 형식: bit=' + bit + ' ctype=' + colort);
  const cpp = colort === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c[0] === 'IDAT').map((c) => c[1])));
  const stride = w * cpp;
  const px = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < w; x++) {
      const i = x * cpp;
      const a = x > 0 ? cur[i - 1] : 0;
      const b = prev ? prev[i] : 0;
      const d = prev && x > 0 ? prev[i - 1] : 0;
      const c = x > 0 ? cur[i - cpp] : 0; // left (채널 c)
      for (let k = 0; k < cpp; k++) {
        const rr = row[i + k];
        let f;
        if (filter === 0) f = rr;
        else if (filter === 1) f = rr + a;
        else if (filter === 2) f = rr + b;
        else if (filter === 3) f = rr + ((a + b) >> 1);
        else f = rr + paeth(a, b, d);
        cur[i + k] = f & 0xff;
      }
    }
  }
  // RGB → RGBA (알파 255)
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (cpp === 4) out.set(px.subarray(i * 4, i * 4 + 4), i * 4);
    else { out[i * 4] = px[i * 3]; out[i * 4 + 1] = px[i * 3 + 1]; out[i * 4 + 2] = px[i * 3 + 2]; out[i * 4 + 3] = 255; }
  }
  return { w, h, px: out };
}

// --- 픽셀 변형: src 를 (dy,dx 이동, shear 전단, squash 수직압축, tint, alphaMul) 로 dst ---
function transform(src, w, h, opt) {
  const { dy = 0, dx = 0, shear = 0, squash = 0, tint = null, alphaMul = 1 } = opt;
  const dst = Buffer.alloc(w * h * 4);
  const anchorY = h * 0.97; // 발밑 기준 수직 압축
  for (let y = 0; y < h; y++) {
    let sy = y - dy;
    if (squash) sy = Math.round((y - anchorY) / (1 - squash) + anchorY);
    for (let x = 0; x < w; x++) {
      let sx = x + dx;
      if (shear) sx = Math.round(x + shear * (y - anchorY)); // 머리 쪽으로 기울임
      const inb = sx >= 0 && sx < w && sy >= 0 && sy < h;
      const o = (y * w + x) * 4;
      if (!inb) { dst[o + 3] = 0; continue; }
      const si = (sy * w + sx) * 4;
      const a = tint ? tint[0] : 1, g = tint ? tint[1] : 1, b = tint ? tint[2] : 1;
      dst[o] = Math.min(255, Math.round(src[si] * a));
      dst[o + 1] = Math.min(255, Math.round(src[si + 1] * g));
      dst[o + 2] = Math.min(255, Math.round(src[si + 2] * b));
      dst[o + 3] = Math.round(src[si + 3] * alphaMul);
    }
  }
  return dst;
}

const man = JSON.parse(fs.readFileSync(path.join(dir, 'sprites.json'), 'utf8'));
const read = (n) => decodePng(fs.readFileSync(path.join(dir, n)));
const save = (n, w, h, px) => { fs.writeFileSync(path.join(dir, n), encodePng(w, h, px)); console.log('  ->', n); };

function genFor(sprId) {
  const set = (man._anims || {})[sprId];
  if (!set) return;
  const base = read(path.basename(man[sprId].file));
  for (const [key, files] of Object.entries(set)) {
    console.log(sprId + '.' + key);
    files.forEach((f) => save(path.basename(f), base.w, base.h, transform(base.px, base.w, base.h, OPTS[sprId][key])));
  }
}

// 프레임별 변형 옵션(각 스프라이트 64x64 기준)
const OPTS = {
  player: {
    // 보행: 좌우 1px 흔들림 + 위아래 1px(보행 사이클 4)
    walk: [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 },
    ],
    // 동작: 가만히(그대로) / 공격(앞으로 15% 기울임) / 피격(빨갛게) / 죽음(푸르게 흐림)
    act: [
      {},
      { shear: 0.15 },
      { tint: [0.95, 0.45, 0.4] },
      { tint: [0.4, 0.55, 0.85], alphaMul: 0.6 },
    ],
  },
  enemy_maiden: {
    // 처녀귀신: 천천히 부유하는 느낌(1~2px)
    move: [
      { dy: 0 }, { dx: 1, dy: 1 }, { dy: 2 }, { dx: -1, dy: 1 },
    ],
  },
  enemy_jiangshi: {
    // 강시: 웅크림-점프-착지 사이클(수직 압축 0.12~0.2 + 앞뒤)
    move: [
      { squash: 0.12, dy: 1 }, { dx: 2, dy: -2 }, { squash: 0.2, dy: 0 }, { dx: -2, dy: -1 },
    ],
  },
};

for (const id of Object.keys(man._anims || {})) genFor(id);
console.log('프레임 생성 완료:', Object.values(man._anims).flatMap((s) => Object.values(s).flat()).length + '개');
