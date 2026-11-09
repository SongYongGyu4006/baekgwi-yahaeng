// 배경·엔티티 그리기. 바닥은 타일 그림 반복 대신, 1024px 무이음 밤 지형
// 캔버스를 깔고 셀마다 결정적 밝기 변주를 얹어 "한 덩어리"의 바닥으로
// 보이게 한다. (10-29 사용자 보고: tile_ground.png 에 옅은 테두리·격자가
// 있어 화면이 사각형 타일로 나뉘어 보였다 → 타일 반복 자체를 없앰.)
import { W, H, GROUND_COLOR } from './config.js';
import { xpToNext } from './xp.js';
import { drawGrid as drawGround, drawDecor } from './art/draw.js';
// 10단계: 무기바 표시용 이름 (talisman 포함, config 정의와 동일)
const WEAPON_NAME = { talisman: '부적', fan: '부채바람', bell: '방울', dokkaebi: '도깨비불', spear: '죽창', janggu: '장구', thunder: '벼락', ink: '먹물' };

// 18단계: 바닥·장식은 art/draw.js 로 이동. render.js 는 재-export만.
export function drawGrid(ctx, camX, camY) {
  drawGround(ctx, camX, camY);
}
export { drawDecor };

export function drawHud(ctx, s) {
  const p = s.player;
  ctx.save();
  // 18단계 HUD: 글자 줄과 막대 줄을 따로 두어 겹치지 않게(글자 14px 이상).
  //   y 14~132 패널: [체력 글자 22] [체력바 30~46] [레벨·xp 글자 68] [xp바 76~86]
  //                  [시간·처치 글자 112]
  const px = 12, py = 10, pw = 300, ph = 116;
  ctx.fillStyle = 'rgba(10, 8, 16, 0.62)';
  roundRect(ctx, px, py, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(232, 184, 58, 0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 9); ctx.stroke();
  const bx = 24, bw = 276;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;
  // 체력: 글자 → 막대
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('체력  ' + Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), bx, py + 22);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2a0c0f';
  ctx.fillRect(bx, py + 30, bw, 14);
  const hpr = Math.max(0, Math.min(1, p.hp / p.maxHp));
  const hg = ctx.createLinearGradient(0, py + 30, 0, py + 44);
  hg.addColorStop(0, hpr < 0.3 ? '#ff6a5a' : '#e8534a');
  hg.addColorStop(1, '#8e1d1a');
  ctx.fillStyle = hg;
  ctx.fillRect(bx, py + 30, bw * hpr, 14);
  ctx.strokeStyle = 'rgba(242, 239, 230, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, py + 30.5, bw - 1, 13);
  // 레벨·경험치: 글자 → 막대 (lvXp = 이번 레벨 진행)
  const xpNext = xpToNext(s.level);
  const cur = Math.floor(s.lvXp || 0);
  const xpr = Math.min(1, xpNext > 0 ? cur / xpNext : 0);
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#e8b83a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`레벨 ${s.level}`, bx, py + 66);
  ctx.fillStyle = '#b9c8ff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`경험치 ${cur} / ${xpNext}`, bx + 70, py + 66);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#16203f';
  ctx.fillRect(bx, py + 74, bw, 10);
  ctx.fillStyle = '#6f93ff';
  ctx.fillRect(bx, py + 74, bw * xpr, 10);
  ctx.strokeStyle = 'rgba(185, 200, 255, 0.35)';
  ctx.strokeRect(bx + 0.5, py + 74.5, bw - 1, 9);
  // 시간 · 처치 (맨 아래 줄, 막대와 22px 이상 띄움)
  const t = Math.max(0, s.time);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`시간 ${mm}:${ss}`, bx, py + 106);
  ctx.fillStyle = '#ff9a7a';
  ctx.fillText(`처치 ${s.kills}`, bx + 120, py + 106);
  // 17단계: 콤보 — 3 이상일 때만 오른쪽 상단(무기바 아래)에 크게.
  const combo = s.combo || 0;
  if (combo >= 3) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(28 + Math.min(18, combo * 1.2) * (0.8 + 0.4 * Math.min(1, s.comboT / 1.2)))}px sans-serif`;
    ctx.fillStyle = combo >= 10 ? '#ffe066' : combo >= 5 ? '#ffb347' : '#dfe8ff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 5;
    ctx.fillText(`${combo} HIT`, W / 2, 74);
    ctx.restore();
    ctx.shadowBlur = 0;
  }
  ctx.shadowBlur = 0;
  // 10단계: 무기바 (장착 무기 이름+레벨, 슬롯 상한 6). 오른쪽 위 한 줄.
  ctx.font = '14px sans-serif';
  let wx = W - 18;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  const wtxt = (s.weapons || []).map((w) => (WEAPON_NAME[w.id] || w.id) + ' Lv' + w.level).join('  ');
  const tw = wtxt ? ctx.measureText(wtxt).width : 0;
  ctx.fillRect(wx - tw - 10, 8, tw + 20, 26);
  ctx.fillStyle = tw ? '#e8d9a0' : 'rgba(200,196,180,0.6)';
  ctx.fillText(wtxt || '무기 없음', wx, 26);
  ctx.textAlign = 'left';
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
