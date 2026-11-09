// 게임 상태 컨테이너. reset()으로 한 판 초기화한다.
import { PLAYER, WIN_TIME } from './config.js';

export const SCENE = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSE: 'pause',
  GAMEOVER: 'gameover',
  WIN: 'win',
};

// state().screen 에 쓸 숫자 코드 (자동 점검은 문자열을 못 받아 숫자로).
export const SCENE_CODE = { title: 0, play: 1, pause: 2, gameover: 3, win: 4 };

function freshState() {
  return {
    scene: SCENE.TITLE,
    time: 0, // 플레이 중 경과 초
    player: {
      x: 0, y: 0,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      radius: PLAYER.radius,
      speed: PLAYER.speed,
      invuln: 0,
      hurtFlash: 0, // 피격 하얗게 깜빡임 타이머
      hurtT: 0,    // 피격 동작 프레임(0.2초)
      atkT: 0,     // 공격 동작 프레임(0.15초)
      facing: { x: 1, y: 0 },
      moving: false,  // 지금 걷는가(동작 프레임 선택용)
      face: 1,       // 바라보는 방향: -1 왼쪽, 1 오른쪽(vx 부호)
      animT: 0,      // 걸음 애니메이션 누적(약 8fps 보행 사이클)
      dustT: 0,      // 걷기 흙먼지 타이머(0.12초에 1개)
      regen: 0,
      baseRegen: 0,      // 8단계 카드(호흡) 재생 — onItem 이 카드+소품 재생을 합친다
      defense: 0,
      magnetR: PLAYER.magnetRadius,
      atkBonus: 0,        // 11단계 소품 'power' 공격력 (무기에서 1+으로 곱함)
      // 11단계: 소품 레벨 캐시 { [id]: lv, cd: 1, area: 1 } — onItem 이 갱신
      itemStats: { cd: 1, area: 1 },
    },
    shake: 0, // 플레이어 피격 화면 흔들림(초)
    camera: { x: 0, y: 0 },
    enemies: [],
    projectiles: [],   // 투사체 (중심 좌표)
    fxNumbers: [],     // 피해 숫자 {x, y, v, crit, t}
    fxParticles: [],   // 파티클 {x, y, vx, vy, t}
    gems: [],
    weapons: [],       // 장착된 무기 (시작: 부적 Lv1)
    items: [],
    level: 1,
    xp: 0,
    kills: 0,
    alive: true,
    won: false,
    paused: false,
    // 8단계: 경험치·레벨업
    orbs: [],           // 영혼 구슬 {x, y, v, sp, pulled}
    levelupPending: 0,  // 처리할 레벨업 횟수(카드를 그 횟수 보여 줌)
    levelupT: 0,        // 레벨업 표시 타이머(카드 UI 연출용)
    cards: [],          // 현재 카드 3장 [{id, name, desc}]
    // 13단계(자동 레벨업): pending 과 별개의 "다음 레벨까지 남은 xp" 카운터.
    // pending 은 카드 선택이 끝날 때만 0 이되고, autoT/auto 는 자동 처리 타이머·
    // 스위치, lastKey 는 마지막으로 키를 누른 시계(자동안락 해제용).
    pending: 0,
    // 18단계: 레벨업 창 — lvXp(이번 레벨 진행 xp), choosing(창 떠 있음=게임 멈춤)
    lvXp: 0,
    choosing: false,
    chooseAt: 0,        // 창이 열린 실시간(ms) — 자동 선택 카운트다운
    chooseLv: 1,        // 창 제목에 보일 레벨
    dmgDealt: 0,        // 지금까지 적에게 준 피해 합계
    combo: 0,           // 17단계: 콤보(연속 타격) 카운터
    comboT: 0,          // 17단계: 콤보 유지 타이머(초, 1.2초 넘으면 초기화)
    comboMax: 0,        // 17단계: 이번 판 최고 콤보
    dmgMax: 0,          // 17단계: 한 번의 타격 최고 피해(점검 expr 용)
    hitStop: 0,         // 타격 멈춤(초, 실시간)
    hitStopCd: 0,       // 타격 멈춤 재사용 대기
    levelFlash: 0,      // 레벨업 순간 화면 번쩍(초)
    autoT: 0,          // 자동 레벨업 대기(2.5초) 카운터
    auto: true,         // 자동 레벨업 스위치(기본 켬)
    lastKey: -9,        // 마지막 키 입력 시계(s.time 기준)
    cardLock: 0,        // 카드 갱신 직후 키 입력 잠금(초, 실시간)
    // 카드 효과용 배율 (기본값 1.0)
    magnetMul: 1,
    speedMul: 1,
    talismanBonus: 0,   // 부적 공격력 보너스 (calcDamage atkBonus)
    talismanCdMul: 1,   // 부적 쿨다운 배율
    // 12단계: 진화(변신) — reset(새 판) 시 전부 초기화
    evolved: false,     // 이번 판에 변신했는가(한 판에 한 번)
    evolveT: null,      // 변신 대기 타이머(초). null = 시작 안 함, 0 이하 = 변신 시각
    evolveDmg: 1,       // 변신 특수 효과: 무기 피해 배율(2 = +100%)
    evolveCd: 1,        // 변신 특수 효과: 무기 쿨다운 배율(0.7 = -30%)
    // 14단계: 보스 구미호
    boss: null,         // 보스 인스턴스(createBoss 반환) 또는 null(없음)
    bossSpawnT: null,   // 보스 출현 타이머(초). null = 아직 안 나옴. 0 도달 시 출현.
    // 16단계: 최고 기록 — 결과 전환 판당 한 번(mergeBest 결과 저장)
    resultDone: false,  // 이번 판에 이미 기록 처리를 했는가(중복 저장 방지)
    newRec: null,       // mergeBest 결과 {best, newSurvive, newKills} 또는 null
  };
}

// 테스트·도구용: freshState()를 그대로 노출. 테스트가 독립 state 를 만들 때 쓴다.
export const makeState = freshState;

export const state = freshState();

// 순수: 생존 시간이 WIN_TIME(180초)을 넘으면 승리. 단조, WIN_TIME 정수.
export function checkWin(time) {
  return typeof time === 'number' && time >= WIN_TIME;
}

export function reset() {
  const s = freshState();
  Object.assign(state, s);
  state.scene = SCENE.PLAY;
  return state;
}

// window.__test.state() 로 반환할 순수 값 객체
export function testState(s) {
  return {
    x: s.player.x,
    y: s.player.y,
    hp: s.player.hp,
    maxHp: s.player.maxHp,
    level: s.level,
    xp: s.xp,
    kills: s.kills,
    time: s.time,
    enemies: s.enemies.length,
    weapons: s.weapons.length,
    items: s.items.length,
    alive: s.alive,
    paused: s.paused,
    won: s.won,
    // 자동 점검 규칙: state() 값은 숫자·불리언뿐. 화면 이름은 숫자 코드로,
    // 화면별 불리언 플래그도 같이 뒀다(문자열 'title'|'play'|'over'|'win' 대조용).
    screen: SCENE_CODE[s.scene],
    inTitle: s.scene === SCENE.TITLE,
    inPlay: s.scene === SCENE.PLAY,
    inOver: s.scene === SCENE.GAMEOVER,
    inWin: s.scene === SCENE.WIN,
    boss: false,
    evolved: s.evolved,
    // 16단계: 최고 기록 신기록 여부(숫자·불리언뿐)
    newSurvive: !!(s.newRec && s.newRec.newSurvive),
    newKills: !!(s.newRec && s.newRec.newKills),
    // 자동 레벨업: 카드가 화면에 떠 있으면 true. 13단계 모델: pending(누적 xp)
    // >= 다음 레벨 xp 이면 카드가 뜨고, 선택(자동·수동)으로 카드가 소진되면
    // false. main.js 의 레벨업 화면 표시 조건(pending>=need && 카드 존재)과
    // 정확히 일치시켜 checking 이 실제 카드 표시와 똑같이 동작하도록 한다.
    // 18단계: 레벨업 창이 떠 있으면 true(그동안 게임이 멈춘다)
    choosing: !!s.choosing,
    dmgDealt: Math.round(s.dmgDealt || 0),
    // 17단계: 콤보·최고 피해(숫자뿐)
    combo: s.combo || 0,
    comboMax: s.comboMax || 0,
    dmgMax: Math.round(s.dmgMax || 0),
  };
}
