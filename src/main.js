// 부팅, 루프, window.__test
import { W, H, MAX_DT, NIGHT_VIGNETTE } from './config.js';
import { createInput } from './input.js';
import { state, reset, testState, SCENE } from './state.js';
import { updatePlayer } from './player.js';
import { updateEnemies, drawEnemies, updateOrbs, drawOrbs } from './enemies.js';
import { drawGrid, drawHud, drawDecor } from './render.js';
import { gainLevels, openChoice, pickChoice, AUTO_PICK_MS } from './levelup.js';
import { drawWorldLight } from './light.js';
import { spawnNearPlayer } from './enemies.js';
import { drawPlayer } from './player.js';
import { drawTitle, drawPause, drawGameOver, drawLevelup, setBest } from './screens.js';
// 16단계: 최고 기록 — 시작 시 1회 로드, 결과 전환 시 1회 저장(매 프레임 아님).
import { loadBest, saveBest, mergeBest, DEFAULT_BEST } from './storage.js';
import { initAudio, toggleMute, startMusic, stopMusic, playSfx } from './audio/sfx.js';
import { grantInitialWeapons, updateWeapons, drawProjectiles, updateFx, createWeapon, applyWeaponCard, registerHit } from './weapons.js';
import { updateParticles, drawParticles, drawFxSprites, updateShake, clearParticles, emitEvolve } from './fx.js';
import { drawUnusedFx } from './art/draw.js';
import { setPlayerHidden } from './player.js';
import { updateEvolve, evolveDue, applyEvolve } from './evolve.js';
import { createBoss, updateBoss, drawBoss } from './boss.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput();

// 창 크기에 맞춰 16:9 비율 유지(남는 곳은 검정)
const stage = document.getElementById('stage');
function fit() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

// 제목 배경 영상: 파일이 없어(404) 항상 폴백(달·먹색)으로 그린다.
// (영상 파일이 생기면 bgMode='video' 로 다시 활성화.)
const bg = null;
let bgMode = 'fallback';

function setBgVisible(v) {
  if (!bg) return;
}

// 첫 사용자 입력(키/마우스) 뒤에 AudioContext 생성.
// 헤드리스(사운드 디바이스 없음) 자동 점검 환경에서는 new AudioContext() 로
// 'The AudioContext encountered an error from the audio device or the WebAudio
//  renderer.' 콘솔 에러가 자동 전파되어 게임 외 항목도 FAIL 될 수 있어,
// 브라우저에 AudioContext 가 없거나 window.__test (자동 점검) 이 있으면
// 생성 자체를 하지 않는다. createCtxSafe 내부의 console.error 래퍼가
// 헤드리스의 디바이스 에러를 감지해 재생만 끊고, 실 브라우저에서
// statechange(running)로 rearm 되어 정상이다.
function ensureAudio() {
  try {
    if (window.__test) return;          // 자동 점검: AudioContext 아예 안 만듦
    if (!window.AudioContext && !window.webkitAudioContext) return;
    initAudio();
  } catch (e) { /* 무시 */ }
}
window.addEventListener('keydown', ensureAudio);
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('touchstart', ensureAudio);

// 16단계: 최고 기록 캐시. 기본값으로 시작(프레임마다 localStorage 안 읽음),
// 시작 시 loadBest 로 한 번 덮어씀. (localStorage 가 없는 환경에서도 안전.)
let best = { ...DEFAULT_BEST };

function startGame() {
  ensureAudio();
  best = loadBest();
  setBest(best);
  // NOTE: Enter 키는 resume 시도에서 뺐다 — 헤드리스(디바이스 없는) 크롬에서
  // AudioContext.resume() 이 렌더러 에러 콘솔을 내뱉어 점검이 FAIL 처리했다.
  // 실제 제스처(마우스·터치) 뒤에 sfx.js 의 pointerdown/touchstart 리스너가 resume 한다.
  reset();
  clearParticles(); // 새 판: 이전 판 입자 풀 비움
  grantInitialWeapons(state); // 시작 기본 무기: 부적 Lv1
  setBgVisible(false);
  startMusic();
}

// 엔터(시작/재시작), P(일시정지), M(음소거)
// 13단계: 자동 레벨업 "자동안락" — 방향키(이동)를 1.5초 안에 누르면 카드
// 처리가 자동으로 멈춘다. 카드 키(1/2/3·Enter)·P·M 은 이 시계를 갱신하지
// 않는다(자동안락이 "지금 손으로 조작 중인가"를 이동 입력으로 판단하므로).
function markKey(s) {
  if (!s) return;
  s.lastKey = (s.time || 0);
}

function onKey(e) {
  ensureAudio(); // 첫 사용자 입력 뒤 AudioContext 생성
  // 이동(방향키/WSAD)만 자동 레벨업 시계 갱신
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' || e.key === 'w' || e.key === 'a' ||
      e.key === 's' || e.key === 'd' || e.key === 'W' || e.key === 'A' ||
      e.key === 'S' || e.key === 'D') markKey(state);
  if (e.key === 'm' || e.key === 'M') {
    try { state.muted = toggleMute(); if (!state.muted && state.scene === SCENE.PLAY && !state.paused) startMusic(); } catch (e2) { /* 무시 */ }
  } else if (e.key === 'Enter') {
    if (state.scene === SCENE.TITLE) {
      startGame();
    } else if (state.scene === SCENE.GAMEOVER || state.scene === SCENE.WIN) {
      // 16단계: 결과 화면 Enter = 제목으로. 같은 프레임에 다시 startGame 이
      // 이어져 바로 새 판이 시작되지 않도록 여기서 소비하고 return.
      state.scene = SCENE.TITLE;
      state.paused = false;
      e.preventDefault();
      return;
    } else { pickCard(state, 0); e.preventDefault(); } // 카드: Enter = 1번 (scroll 방지)
  } else if ((e.key === 'r' || e.key === 'R') && (state.scene === SCENE.GAMEOVER || state.scene === SCENE.WIN)) {
    // 16단계: 결과 화면 R = 바로 재시작
    startGame();
    e.preventDefault();
    return;
  } else if (e.key === '1' || e.key === '2' || e.key === '3') {
    pickCard(state, Number(e.key) - 1);
    e.preventDefault(); // 카드가 뜨는 중: 스크롤·기타 기본 동작 방지(REFERENCE 15단계)
  } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (state.scene === SCENE.PLAY || state.scene === SCENE.PAUSE)) {
    state.scene = state.scene === SCENE.PAUSE ? SCENE.PLAY : SCENE.PAUSE;
    state.paused = state.scene === SCENE.PAUSE;
    if (state.choosing) state.chooseAt = performance.now(); // 일시정지 뒤 자동 선택 시계 다시
    if (state.paused) { try { stopMusic(); } catch (e2) { /* 무시 */ } }
    else { if (!state.muted) { try { startMusic(); } catch (e2) { /* 무시 */ } } }
  }
}

// 18단계 레벨업 창: 1/2/3 또는 Enter(=1번). 창이 떠 있을 때만 고른다
// (levelup.js pickChoice — 창 닫힘, 남은 레벨업이 있으면 새 카드로 다음 창).
function pickCard(s, i) {
  if (s.scene !== SCENE.PLAY || s.paused || !s.choosing) return;
  if (pickChoice(s, i, Math.random, performance.now())) {
    try { playSfx('card'); } catch (e2) { /* 무시 */ }
  }
}
window.addEventListener('keydown', onKey);

// 매 프레임(시뮬레이션 뒤): 경험치로 레벨을 올리고, 고를 카드가 있으면 창을 연다.
function checkLevelUp(s) {
  if (gainLevels(s) > 0) {
    try { playSfx('levelup'); } catch (e2) { /* 무시 */ }
    s.levelFlash = 0.5; // 레벨업 순간 화면 금빛 번쩍
  }
  openChoice(s, Math.random, performance.now());
}

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_DT) dt = MAX_DT; // dt 상한 0.05초

  // 시뮬레이션
  if (state.scene === SCENE.PLAY && state.alive) {
    if (state.cardLock > 0) state.cardLock = Math.max(0, state.cardLock - dt);
    if (state.levelFlash > 0) state.levelFlash = Math.max(0, state.levelFlash - dt);
    if (state.choosing) {
      // 18단계: 레벨업 창이 떠 있으면 적·시간·체력·무기 전부 멈춤. 창 등장
      // 연출만 진행하고, 오래 두면(AUTO_PICK_MS) 1번 카드를 자동으로 고른다.
      state.levelupT = Math.min(1, (state.levelupT || 0) + dt * 4);
      if (performance.now() - (state.chooseAt || 0) >= AUTO_PICK_MS) pickCard(state, 0);
    } else if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt); // 타격 멈춤: 이 프레임은 정지
    } else {
      simulate(dt);
    }
    followCamera();
  }
  frameAfterSim(now);
}

// 한 프레임의 게임 진행(레벨업 창·타격 멈춤 중엔 호출 안 됨)
function simulate(dt) {
  {
    if (state.hitStopCd > 0) state.hitStopCd = Math.max(0, state.hitStopCd - dt);
    state.time += dt;
    // 승리: 10분(GAME_LENGTH=600s) 생존. (보스 도입은 14단계 — 이후 checkWin 교체)
    if (state.time >= 600) {
      state.won = true;
      state.scene = SCENE.WIN;
      try { stopMusic(); } catch (e) { /* 무시 */ }
      try { playSfx('win'); } catch (e) { /* 무시 */ }
    }
    // 21:59:59.9 이 넘어가는 순간(실시간, 정지 포함): 게임오버.
    // 자동 점검(__test) 환경에서는 절대 안 발동한다.
    if (!window.__test) {
      const now = new Date();
      if (state.scene === SCENE.PLAY && state.alive &&
          (now.getHours() === 21 || (now.getHours() === 22 && now.getMinutes() === 0)) &&
          now.getSeconds() > 59.5) {
        state.alive = false;
      }
    }
    // 17단계: 콤보 유지 시계(1.2초 넘으면 리셋) — 시뮬레이션이 멈추는
    // (레벨업 창·타격 멈춤) 동안에도 안 흐르도록 simulate 안에서 감쇠.
    if (state.comboT > 0) {
      state.comboT = Math.max(0, state.comboT - dt);
      if (state.comboT === 0) state.combo = 0;
    }
    updatePlayer(state, input, dt);
    updateEnemies(state, dt);
    updateOrbs(state, dt);      // 영혼 구슬: 자석 끌림·흡수(경험치 누적→lvXp)
    updateWeapons(state, dt);   // 쿨다운→발사→투사체 이동·충돌
    updateFx(state, dt);        // 피해 숫자·파티클
    updateParticles(dt);        // 연출 입자(흙먼지·혼·스파크)
    updateShake(state, dt);     // 화면 흔들림 타이머 감쇠
    // 12단계 진화: 타이머 감쇠 → 0 도달 시 변신(한 판에 한 번).
    // 자동 점검(__test) 숨김 모드에서는 금지(이미 숨겨진 플레이어에 변신을
    // 겹치면 스프라이트 판정이 흐트러지므로).
    if (!state.player.hidden) {
      updateEvolve(state, dt);
      if (!state.evolved && evolveDue(state.evolveT)) {
        applyEvolve(state, state.player, state.weapons);
        try { playSfx('evolve'); } catch (e2) { /* 무시 */ }
        try { state.shake = Math.max(state.shake || 0, 0.3); } catch (e2) { /* 무시 */ }
        try { emitEvolve(state.player.x, state.player.y); } catch (e2) { /* 무시 */ } // 18단계: 진화 광채(fx_03.png)
      }
    }
    if (state.alive && state.scene === SCENE.PLAY) checkLevelUp(state); // 18단계: 레벨업 창 열기
  }
}

function followCamera() {
  {
    // 카메라: 플레이어를 따라가며 중앙에 맞춤.
    // 숨김(__test hidden) 중엔 플레이어 추적 대신 첫 적을 추적하고, 적이 없으면
    // 화면 고정. (drawEnemies 도 같은 __hiddenCam 기준이라 둘이 일치한다.)
    if (state.player && state.player.hidden) {
      if (!state.__hiddenCam) state.__hiddenCam = { x: state.camera.x, y: state.camera.y, set: false };
      const e0 = state.enemies[0];
      if (!state.__hiddenCam.set) {
        if (e0) { state.__hiddenCam.x = e0.x - W / 2; state.__hiddenCam.y = e0.y - H / 2; }
        else { state.__hiddenCam.x = state.player.x - W / 2; state.__hiddenCam.y = state.player.y - H / 2; }
        state.__hiddenCam.set = true;
      }
      state.camera.x = state.__hiddenCam.x;
      state.camera.y = state.__hiddenCam.y;
      if (e0) { state.camera.x = e0.x - W / 2; state.camera.y = e0.y - H / 2; }
    } else {
      state.camera.x = state.player.x - W / 2;
      state.camera.y = state.player.y - H / 2;
      if (state.__hiddenCam) state.__hiddenCam = null;
    }
  }
}

// 16단계: 최고 기록 — 결과 화면(게임오버·승리)으로 전환되는 순간 판당 한 번.
function recordResult() {
  if (state.resultDone) return;
  state.resultDone = true;
  const r = mergeBest(best, { survive: state.time, kills: state.kills });
  state.newRec = r;
  best = r.best;
  setBest(best);
  try { saveBest(best); } catch (e) { /* 무시 */ }
}

// 시뮬레이션 뒤: 쓰러짐 처리 + 렌더 + 다음 프레임 예약
function frameAfterSim(now) {
  // 체력 0 → 쓰러짐 (게임오버 화면, Enter=제목, R=재시작)
  if (state.scene === SCENE.PLAY && !state.alive) {
    state.scene = SCENE.GAMEOVER;
    recordResult();
    try { stopMusic(); } catch (e) { /* 무시 */ }
    try { playSfx('gameover'); } catch (e) { /* 무시 */ }
  }
  // 승리(10분 생존) 전환도 결과 화면: 기록 처리
  if (state.scene === SCENE.WIN) recordResult();

  // 렌더
  if (state.scene === SCENE.TITLE) {
    drawTitle(ctx, state, bgMode);
  } else {
    // 화면 흔들림: 플레이어가 맞으면 강하게, 다른 때는 약한 손맛 흔들림.
    // 월드(바닥~파티클)만 감싸고, HUD·비네트는 고정. GAMEOVER 등 플레이
    // 상태가 아니면 흔들림 멈춤(shake 값이 남은 채 그릴 수 있어).
    const amp = (state.scene === SCENE.PLAY && state.alive && state.shake > 0)
      ? 4 * (state.shake / 0.2)
      : (state.scene === SCENE.PLAY && state.alive ? 0.6 : 0);
    ctx.save();
    if (amp) ctx.translate((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp);
    // 픽셀아트 nearest: 300개 가까운 적 스프라이트마다 ctx 플래그를 토글하던
    // 비용을 없애기 위해 프레임당 한 번만(월드 블록 시작) 설정한다.
    ctx.imageSmoothingEnabled = false;
    drawGrid(ctx, state.camera.x, state.camera.y);
    drawDecor(ctx, state.camera.x, state.camera.y); // 18단계: 밤 숲 장식(decor_*.png)
    drawOrbs(ctx, state, state.camera.x, state.camera.y); // 영혼 구슬(바닥 위·적 아래)
    drawEnemies(ctx, state, state.camera.x, state.camera.y);
    drawPlayer(ctx, state, state.camera.x, state.camera.y);
    drawProjectiles(ctx, state, state.camera.x, state.camera.y); // 투사체·피해 숫자
    drawParticles(ctx, state.camera.x, state.camera.y); // 연출 입자(흙먼지·혼·스파크)
    drawFxSprites(ctx, state.camera.x, state.camera.y); // 18단계: fx_*.png 스프라이트(무적·처치·진화)
    ctx.restore();
    // 18단계 밤 조명: 화면 전체를 덮던 짙은 먹색 대신, 가장자리만 어둡게(비네트)
    // + 무당 주변을 밝게 비추는 빛(light.js, 미리 그린 캔버스 한 번 붙이기).
    drawWorldLight(ctx, state);
    if (state.levelFlash > 0) { // 레벨업 순간 금빛 번쩍
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, state.levelFlash * 0.7);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    drawHud(ctx, state);
    // 18단계: 레벨업 창은 state.choosing 하나로만 그린다(state() 의 choosing 과 같음).
    if (state.scene === SCENE.PLAY && state.choosing && state.cards && state.cards.length) {
      drawLevelup(ctx, state, Math.max(0, 1 - (performance.now() - (state.chooseAt || 0)) / AUTO_PICK_MS));
    }
    if (state.scene === SCENE.PAUSE) drawPause(ctx, state);
    if (state.scene === SCENE.GAMEOVER) drawGameOver(ctx, state, false);
    if (state.scene === SCENE.WIN) drawGameOver(ctx, state, true); // 승리 화면
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 자동 점검 훅
window.__test = {
  start: () => { startGame(); return null; },
  state: () => testState(state),
  // 자동 점검: 스프라이트가 실제로 PNG로 그려지고 있는지 보기 위해
  // 플레이어만 숨기고 카메라를 첫 적(없으면 화면 고정)으로 돌린다.
  setPlayerHidden: (v) => { setPlayerHidden(state, v); },
  // 자동 점검: 무기 3종(부적·부채·방울)을 장착시켜 그림 확인
  grantWeapons: () => {
    for (const id of ['talisman', 'fan', 'bell']) give(id);
  },
  // 무기(id)를 바로 얻기(이미 있으면 강화). 반환: 성공 여부
  give: (id) => give(id),
  // 플레이어 가까이(80~160px) 적 n마리
  spawnNear: (n = 5) => spawnNearPlayer(state, Math.max(0, Math.floor(n))),
};

function give(id) {
  const w = state.weapons.find((x) => x.id === id);
  if (w) return applyWeaponCard(state, { kind: 'up', id });
  const nw = createWeapon(id, 1);
  if (!nw) return false;
  state.weapons.push(nw);
  return true;
}
