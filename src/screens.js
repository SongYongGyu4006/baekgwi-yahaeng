// 제목 / 일시정지 / 결과(게임오버·승리) 화면
import { W, H, TITLE } from './config.js';
import { drawTitleBg, drawItemIcon, drawWeaponIcon } from './art/draw.js';
import { ITEMS } from './upgrades.js';
import { WEAPONS } from './config.js';

// 16단계: 최고 기록(최장 생존·최다 처치). main.js 가 시작 시 한 번 loadBest,
// 게임오버 전환 시 한 번 mergeBest·saveBest 해서 갱신하는 모듈 변수.
// 프레임마다 localStorage 를 읽지 않는다 (fps 보호).
let best = { survive: 0, kills: 0 };
export function setBest(b) {
  best = b && Number.isFinite(b.survive) && Number.isFinite(b.kills)
    ? { survive: b.survive, kills: b.kills } : { survive: 0, kills: 0 };
}
const fmtTime = (sec) => {
  const t = Math.max(0, sec);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
};

// 18단계: 카드 아이콘 — item 카드는 item_* PNG, 무기 카드는 icon_* PNG.
const ITEM_ICON = {}; // item id -> item_* sprite id
for (const d of ITEMS) ITEM_ICON[d.id] = d.sprite;
const WEAPON_ICON = {}; // weapon id -> icon_* sprite id
for (const [id, w] of Object.entries(WEAPONS)) WEAPON_ICON[id] = 'icon_' + id.replace(/s$/, '');
// icon_ 이름 매핑(weapon id → 실제 icon_* 파일)
WEAPON_ICON.talisman = 'icon_talisman';
WEAPON_ICON.fan = 'icon_fan_wave';
WEAPON_ICON.bell = 'icon_bell';
WEAPON_ICON.dokkaebi = 'icon_fireball';
WEAPON_ICON.spear = 'icon_spear';
WEAPON_ICON.janggu = 'icon_drum_ring';
WEAPON_ICON.thunder = 'icon_lightning';
WEAPON_ICON.ink = 'icon_ink';

function drawCardIcon(ctx, card, x, y, size) {
  if (card.kind === 'item') {
    drawItemIcon(ctx, ITEM_ICON[card.id] || card.id, x, y, size);
  } else if (card.kind === 'heal') {
    drawItemIcon(ctx, 'item_ginseng', x, y, size); // 회복 = 인삼
  } else {
    drawWeaponIcon(ctx, WEAPON_ICON[card.id] || card.id, x, y, size);
  }
}

export function drawTitle(ctx, s, bgMode) {
  ctx.save();
  if (bgMode !== 'video') {
    // 18단계: bg_title.png 이 있으면 그린다, 없으면 폴백(먹색+달)
    drawTitleBg(ctx, W, H);
  } else {
    // 영상 배경 모드: 반투명 어둠으로 가려서 제목이 읽히게
    ctx.fillStyle = 'rgba(8, 8, 12, 0.45)';
    ctx.fillRect(0, 0, W, H);
  }
  // 제목 (그림 위에서도 읽히게 그림자)
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(TITLE.text, W / 2, H * 0.38);
  ctx.fillStyle = '#c8302b';
  ctx.font = '24px sans-serif';
  ctx.fillText(TITLE.subtitle, W / 2, H * 0.47);
  // 깜박이는 시작 안내
  if (Math.floor(performance.now() / 600) % 2 === 0) {
    ctx.fillStyle = '#e8b83a';
    ctx.font = '28px sans-serif';
    ctx.fillText(TITLE.startLabel, W / 2, H * 0.6);
  }
  // 조작 안내 (반투명 판 위에)
  ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(8,8,14,0.6)'; ctx.fillRect(W / 2 - 170, H * 0.72 - 22, 340, TITLE.controls.length * 24 + 12); ctx.restore();
  ctx.fillStyle = '#e6e1d2';
  ctx.font = '17px sans-serif';
  TITLE.controls.forEach((c, i) => ctx.fillText(c, W / 2, H * 0.72 + i * 24));
  // 16단계: 최고 기록 (localStorage 캐시 — 프레임을 타지 않는 모듈 변수)
  ctx.fillStyle = '#3fb8a8';
  ctx.font = '20px sans-serif';
  ctx.fillText(`최고 기록  생존 ${fmtTime(best.survive)}  ·  처치 ${best.kills}`, W / 2, H * 0.92);
  ctx.restore();
}

export function drawPause(ctx, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('일시정지', W / 2, H * 0.42);
  ctx.fillStyle = '#e8b83a';
  ctx.font = '22px sans-serif';
  ctx.fillText('이어가기: P    다시 시작: Enter', W / 2, H * 0.55);
  ctx.restore();
}

// 레벨업 카드 3장: 화면 중앙 아래. 반투명 어두운 배경 + 카드 3개.
// 카드마다 이름(20px) + 효과 설명(14px) + 키 번호.
export function drawLevelup(ctx, s, remain = 1) {
  ctx.save();
  const pop = Math.min(1, s.levelupT || 1);
  const scale = 0.9 + 0.1 * pop; // 살짝 커지며 등장
  ctx.globalAlpha = 0.85 * pop + 0.15;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const cw = 210, ch = 130, gap = 30;
  const totalW = cw * 3 + gap * 2;
  const cx0 = W / 2 - totalW / 2;
  const cy = H * 0.58;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b83a';
  ctx.font = 'bold 30px sans-serif';
  // 18단계: 제목 레벨은 지금 고르는 레벨(chooseLv) — 고른 뒤 다음 창은 숫자가 바뀐다.
  ctx.fillText(`레벨업! (Lv ${s.chooseLv || s.level})`, W / 2, cy - 76);
  ctx.fillStyle = '#c9c4b4';
  ctx.font = '15px sans-serif';
  const more = Math.max(0, (s.levelupPending || 1) - 1);
  ctx.fillText('게임 멈춤 — 1 / 2 / 3 키로 선택   Enter = 1번' + (more ? `   (남은 선택 ${more})` : ''), W / 2, cy - 48);
  // 자동 선택 카운트다운 막대(시간이 다 되면 1번 카드)
  const bw = 240;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(W / 2 - bw / 2, cy - 34, bw, 5);
  ctx.fillStyle = '#e8b83a';
  ctx.fillRect(W / 2 - bw / 2, cy - 34, bw * Math.max(0, Math.min(1, remain)), 5);
  ctx.fillStyle = '#8a8f9c';
  ctx.font = '14px sans-serif';
  ctx.fillText('시간이 다 되면 1번 자동 선택', W / 2, cy - 12);
  const cards = s.cards || [];
  for (let i = 0; i < Math.min(3, cards.length); i++) {
    const c = cards[i];
    if (!c) continue;
    const x = cx0 + i * (cw + gap);
    const y = cy - (1 - scale) * ch / 2;
    // 카드 배경
    ctx.fillStyle = 'rgba(28, 28, 38, 0.92)';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = i === 0 ? '#e8b83a' : 'rgba(232, 184, 58, 0.45)';
    ctx.lineWidth = i === 0 ? 3 : 2;
    ctx.strokeRect(x, y, cw, ch);
    // 키 번호 배지
    ctx.fillStyle = '#e8b83a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(String(i + 1), x + 18, y + 22);
    // 18단계: 카드 아이콘(item_*/icon_* PNG) — 이름 위에 40px
    drawCardIcon(ctx, c, x + cw / 2 - 20, y + 30, 40);
    // 카드 이름
    ctx.fillStyle = '#f2efe6';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(c.name || c.id, x + cw / 2, y + 88);
    // 효과 설명 (2줄로 감)
    ctx.fillStyle = '#b8b2a0';
    ctx.font = '14px sans-serif';
    const desc = c.desc || '';
    if (desc.length > 14) {
      const half = Math.ceil(desc.length / 2);
      ctx.fillText(desc.slice(0, half), x + cw / 2, y + 110);
      ctx.fillText(desc.slice(half), x + cw / 2, y + 124);
    } else {
      ctx.fillText(desc, x + cw / 2, y + 112);
    }
  }
  ctx.restore();
}

// 게임오버(쓰러짐) / 승리 화면. Enter로 바로 새 판(reset).
// 1차: 3분(WIN_TIME) 생존 = 승리. 나중 단계에서 10분·보스로 바뀐다.
export function drawGameOver(ctx, s, win) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#e8b83a' : '#c8302b';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText(win ? `3분 버텨 승리!` : '쓰러졌다', W / 2, H * 0.35);
  ctx.fillStyle = '#f2efe6';
  ctx.font = '22px sans-serif';
  const t = Math.floor(s.time);
  ctx.fillText(`생존 시간 ${Math.floor(t / 60)}분 ${t % 60}초   처치 ${s.kills}   레벨 ${s.level}`, W / 2, H * 0.5);
  if (win) {
    ctx.fillStyle = '#c9c4b4';
    ctx.font = '18px sans-serif';
    ctx.fillText('새벽(10분)·보스는 다음 업데이트로', W / 2, H * 0.56);
  }
  // 16단계: 신기록 강조 (main.js 가 mergeBest 결과로 s.newRec 을 담음)
  if (s.newRec && s.newRec.newSurvive) {
    ctx.fillStyle = '#e8b83a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('★ 신기록! 최장 생존 ★', W / 2, H * 0.58);
  } else if (s.newRec && s.newRec.newKills) {
    ctx.fillStyle = '#e8b83a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('★ 신기록! 최다 처치 ★', W / 2, H * 0.58);
  }
  ctx.fillStyle = '#e8b83a';
  ctx.font = '26px sans-serif';
  ctx.fillText(TITLE.restartLabel, W / 2, H * 0.62);
  ctx.restore();
}
