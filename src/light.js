// 18단계 밤 조명: 예전엔 화면 전체에 rgba(8,8,14,0.55) 먹색을 덮어 무당·귀신·
// 바닥이 거의 안 보였다. 이제는
//   ① 가장자리만 어둡게 하는 비네트(+옅은 남색 밤빛) — 시작할 때 한 번 그린 캔버스
//   ② 무당 둘레의 따뜻한 빛(가산 합성) — 역시 미리 그린 캔버스를 위치만 옮겨 붙임
// 매 프레임 그라데이션을 새로 만들지 않는다(그리기 성능 규칙).
import { W, H } from './config.js';

let vignette = null;
let glow = null;
const GLOW_R = 230;

function makeVignette() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 밤빛: 아주 옅은 남색(분위기만)
  g.fillStyle = 'rgba(14, 18, 44, 0.16)';
  g.fillRect(0, 0, W, H);
  const r = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
  r.addColorStop(0, 'rgba(4, 4, 12, 0)');
  r.addColorStop(0.6, 'rgba(4, 4, 12, 0.35)');
  r.addColorStop(1, 'rgba(4, 4, 12, 0.78)');
  g.fillStyle = r;
  g.fillRect(0, 0, W, H);
  return c;
}

function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = GLOW_R * 2;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
  r.addColorStop(0, 'rgba(255, 214, 150, 0.30)');
  r.addColorStop(0.35, 'rgba(255, 190, 120, 0.14)');
  r.addColorStop(1, 'rgba(255, 170, 100, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);
  return c;
}

export function drawWorldLight(ctx, s) {
  if (!vignette) vignette = makeVignette();
  if (!glow) glow = makeGlow();
  ctx.save();
  ctx.drawImage(vignette, 0, 0);
  const p = s.player;
  if (p && !p.hidden && s.camera) {
    const sx = p.x - s.camera.x, sy = p.y - s.camera.y;
    // 은은한 숨쉬기(±6%)
    const k = 1 + 0.06 * Math.sin((s.time || 0) * 2.2);
    const r = GLOW_R * k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glow, sx - r, sy - r, r * 2, r * 2);
  }
  ctx.restore();
}
