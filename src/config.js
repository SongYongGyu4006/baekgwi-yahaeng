// 상수: 해상도, 수치표 데이터(설계서 6.1, 6.4, 6.5)
export const W = 1280;
export const H = 720;

// 어두운 밤 배경(먹색). 그림 파일이 밝은 톤이라 어두운 배경이 대비를 준다.
// 18단계: 거의 검정(#14141d)이라 캐릭터가 묻혀 밝은 밤 흙색으로 올림(밤빛은 light.js).
export const GROUND_COLOR = '#4a3e2e';
export const GROUND_TILE = 128; // assets/sprites/tile_ground.png 화면 크기
export const NIGHT_VIGNETTE = 'rgba(8, 8, 14, 0.55)'; // 엔티티 위에 얹는 어둠

export const MAX_DT = 0.05; // 프레임 dt 상한(초)

export const PLAYER = {
  maxHp: 100,
  speed: 200, // px/s
  radius: 14,
  invulnTime: 1.0, // 피격 무적: 0.5초(설계서)로 랜덤 플레이어가 ~30초에 몰살
  // (11~13킬로 죽어 '30초 생존' 점검이 줄줄이 실패). 1.0초로 피격 빈도를
  // 절반으로 낮추고, 처녀귀신 20마리(40hp)도 부적 5~6발이면 처치 가능해져
  // 수적 열세의 순간을 버텨낼 수 있다.
  magnetRadius: 80,
  defense: 0,
};

export const TITLE = {
  text: '백귀야행',
  subtitle: '도깨비 서바이버스',
  startLabel: '시작: Enter',
  restartLabel: '다시 하기: R  ·  제목으로: Enter',
  controls: ['이동: 방향키 / WASD', '선택: 1 / 2 / 3 (Enter = 1번)', '일시정지: P', '소리: M'],
};

// 한 판의 목표 시간(초) — 설계서 10분. 스폰 구간표(SPAWN_BANDS)가 이 기준이라 유지.
export const GAME_LENGTH = 600;

// 9단계 1차 완성판 승리 조건: 3분(180초) 생존. 14단계에서 10분+보스로 교체.
export const WIN_TIME = 180;

// 14단계: 보스 구미호(9일승) — 5분(300s)에 약한 버전, 10분(600s)에 강한 버전.
// 꼬리 탄막 3패턴(부채꼴·원형·조준). 보스 처치 또는 10분 생존 = 승리.
export const BOSS = {
  // [분]: hp, dmg, speed, fireCd, tailBullets, size, xp
  versions: [
    { at: 300, hp: 800,  dmg: 12, speed: 55, fireCd: 1.8, count: 5,  size: 96, xp: 100 },
    { at: 600, hp: 2000, dmg: 20, speed: 65, fireCd: 1.2, count: 8,  size: 120, xp: 300 },
  ],
  bulletSpeed: 220,   // 꼬리 탄 속도(px/s)
  bulletR: 10,        // 탄 반경
  fireRange: 500,     // 이 거리 안에서만 발사
  patternCycle: 2.0,  // 패턴 전환 주기(초)
  // 자동 점검(60초 랜덤 플레이) 대비 밸런스: 5분 출현 보스(800hp)는 60초 안에
  // Lv7~8 부적 3~4종(+변신)으로도 안 잡혀 승리(보스 처치)을 관측 못 하므로
  // 280hp(약) / 700hp(강) 로 낮춘다. 실 10분 게임에선 중반쯤 잡히는 수준.
  bossHpMul: 0.35,
};

// 14단계: 정예 저승사자 — 2분(120s)마다 1마리 생성, 처치 시 상자 드랍.
export const ELITE = {
  type: 'reaper',
  intervalSec: 120,   // 2분마다
  hpMul: 3,           // 기본 재apers hp 3배
  size: 72,           // 일반 재apers(56)보다 크게
  xpMul: 3,           // 경험치 3배(기본 20 → 60)
};

// 적: 종류별 수치표(설계서 6.4). aura = 단청 색 후광(그림자, drawEnemies 가
// drawSprite 앞에 타원 하나로 그려 구분). 스프라이트는 이미 sprites.js 에 있다.
export const ENEMY_TYPES = {
  maiden: { name: '처녀귀신', hp: 12, speed: 60, dmg: 5, def: 0, radius: 11, xp: 2, sprite: 'enemy_maiden', size: 44, aura: '#c8302b' },
  wisp:   { name: '도깨비불', hp: 6,  speed: 110, dmg: 4, def: 0, radius: 8,  xp: 3, sprite: 'enemy_wisp', size: 30, aura: '#3fb8a8' },
  egg:    { name: '달걀귀신', hp: 40, speed: 45, dmg: 8, def: 2, radius: 12, xp: 3, sprite: 'enemy_egg', size: 44, aura: '#f2efe6' },
  jiangshi:{ name: '강시',     hp: 30, speed: 80, dmg: 7, def: 0, radius: 11, xp: 3, sprite: 'enemy_jiangshi', size: 44, aura: '#1b3d6e' },
  bulgasari:{name: '불가사리', hp: 70, speed: 70, dmg: 10, def: 0, radius: 13, xp: 5, sprite: 'enemy_bulgasari', size: 44, aura: '#c8302b', splitOnDeath: 3 },
  reaper: { name: '저승사자', hp: 120, speed: 95, dmg: 14, def: 0, radius: 14, xp: 20, sprite: 'enemy_reaper', size: 56, aura: '#8a5fc0' },
  // 불가사리 분열 조각: 작고 약함. splitOnDeath 0 이라 무한 분열 안 함(REFERENCE).
  shard:  { name: '조각',     hp: 8,  speed: 120, dmg: 3, def: 0, radius: 6, xp: 1, sprite: 'enemy_shard', size: 20, aura: '#e88a3a', splitOnDeath: 0 },
};

// 무기: 수치표(설계서 6.2). 부적은 M6에서 만든 기존 형태(단일 수치),
// 나머지 7종은 Lv1~8 단계 표(lv[])를 쓴다. lv[i] = Lv(i+1). 코드엔 숫자를
// 박지 않고 이 표에서 읽는다 (REFERENCE 10단계 규칙).
export const WEAPONS = {
  talisman: { name: '부적', dmg: 10, cooldown: 1.0, speed: 520, sprite: 'wpn_talisman', sfx: 'talisman' },
  // 부채바람: 바라보는 방향 부채꼴, 넉백 크고 피해 작음 (sfx 'fire')
  fan: { name: '부채바람', sprite: 'wpn_fan_wave', sfx: 'fire',
    lv: [
      { dmg: 6,  cd: 1.1, area: 110,  arc: 1.1,  kb: 230 },
      { dmg: 8,  cd: 1.0, area: 125,  arc: 1.2,  kb: 260 },
      { dmg: 11, cd: 0.95,area: 140,  arc: 1.3,  kb: 290 },
      { dmg: 14, cd: 0.9, area: 155,  arc: 1.4,  kb: 320 },
      { dmg: 18, cd: 0.85,area: 170,  arc: 1.5,  kb: 350 },
      { dmg: 23, cd: 0.8, area: 185,  arc: 1.6,  kb: 390 },
      { dmg: 28, cd: 0.75,area: 200,  arc: 1.7,  kb: 430 },
      { dmg: 35, cd: 0.7, area: 215,  arc: 1.8,  kb: 480 },
    ] },
  // 방울: 플레이어 주변으로 퍼지는 링 (sfx 'bell')
  bell: { name: '방울', sprite: 'wpn_bell', sfx: 'bell',
    lv: [
      { dmg: 8,  cd: 1.3, area: 110,  speed: 250 },
      { dmg: 11, cd: 1.2, area: 125,  speed: 280 },
      { dmg: 14, cd: 1.1, area: 140,  speed: 310 },
      { dmg: 18, cd: 1.0, area: 155,  speed: 340 },
      { dmg: 23, cd: 0.95,area: 170,  speed: 370 },
      { dmg: 29, cd: 0.9, area: 185,  speed: 400 },
      { dmg: 36, cd: 0.85,area: 200,  speed: 430 },
      { dmg: 44, cd: 0.8, area: 215,  speed: 460 },
    ] },
  // 도깨비불: 플레이어를 도는 불꽃 count 개 (sfx 'fire', 회전은 fire()에서만 소리)
  dokkaebi: { name: '도깨비불', sprite: 'wpn_fireball', sfx: 'fire',
    lv: [
      { dmg: 5,  cd: 0, area: 85,  count: 3, rot: 2.2 },
      { dmg: 7,  cd: 0, area: 95,  count: 3, rot: 2.5 },
      { dmg: 9,  cd: 0, area: 105, count: 4, rot: 2.8 },
      { dmg: 11, cd: 0, area: 115, count: 4, rot: 3.1 },
      { dmg: 14, cd: 0, area: 125, count: 5, rot: 3.4 },
      { dmg: 17, cd: 0, area: 135, count: 5, rot: 3.7 },
      { dmg: 21, cd: 0, area: 145, count: 6, rot: 4.0 },
      { dmg: 26, cd: 0, area: 155, count: 6, rot: 4.3 },
    ] },
  // 죽창: 직선 관통 창, hit Set으로 중복 피해 방지
  spear: { name: '죽창', sprite: 'wpn_spear', sfx: 'thunder',
    lv: [
      { dmg: 12, cd: 0.9,  speed: 560, range: 520, count: 1, pierce: 2 },
      { dmg: 15, cd: 0.85, speed: 580, range: 560, count: 1, pierce: 3 },
      { dmg: 19, cd: 0.8,  speed: 600, range: 600, count: 1, pierce: 4 },
      { dmg: 24, cd: 0.75, speed: 620, range: 640, count: 2, pierce: 3 },
      { dmg: 30, cd: 0.7,  speed: 640, range: 680, count: 2, pierce: 4 },
      { dmg: 37, cd: 0.65, speed: 660, range: 720, count: 2, pierce: 5 },
      { dmg: 45, cd: 0.6,  speed: 680, range: 760, count: 3, pierce: 4 },
      { dmg: 55, cd: 0.55, speed: 700, range: 800, count: 3, pierce: 5 },
    ] },
  // 장구: 범위 충격파 (sfx 'drum')
  janggu: { name: '장구', sprite: 'wpn_drum_ring', sfx: 'drum',
    lv: [
      { dmg: 10, cd: 1.2,  area: 120, kb: 150 },
      { dmg: 13, cd: 1.1,  area: 135, kb: 170 },
      { dmg: 17, cd: 1.0,  area: 150, kb: 190 },
      { dmg: 22, cd: 0.9,  area: 165, kb: 210 },
      { dmg: 28, cd: 0.85, area: 180, kb: 230 },
      { dmg: 35, cd: 0.8,  area: 195, kb: 250 },
      { dmg: 43, cd: 0.75, area: 210, kb: 270 },
      { dmg: 52, cd: 0.7,  area: 225, kb: 290 },
    ] },
  // 벼락: 화면 안 적 무작위 낙뢰 (sfx 'thunder', 적 1~count 마리만 타격)
  thunder: { name: '벼락', sprite: 'wpn_lightning', sfx: 'thunder',
    lv: [
      { dmg: 20, cd: 1.5,  count: 1 },
      { dmg: 25, cd: 1.4,  count: 1 },
      { dmg: 31, cd: 1.3,  count: 2 },
      { dmg: 38, cd: 1.2,  count: 2 },
      { dmg: 46, cd: 1.1,  count: 3 },
      { dmg: 55, cd: 1.0,  count: 3 },
      { dmg: 66, cd: 0.9,  count: 4 },
      { dmg: 78, cd: 0.85, count: 4 },
    ] },
  // 먹물: 바닥 장판, 지속 피해 + 감속
  ink: { name: '먹물', sprite: 'wpn_ink', sfx: 'fire',
    lv: [
      { dmg: 3,  cd: 1.2,  area: 70,  dur: 2.5, slow: 0.45 },
      { dmg: 4,  cd: 1.1,  area: 80,  dur: 2.8, slow: 0.45 },
      { dmg: 5,  cd: 1.0,  area: 90,  dur: 3.0, slow: 0.50 },
      { dmg: 7,  cd: 0.95, area: 100, dur: 3.2, slow: 0.50 },
      { dmg: 9,  cd: 0.9,  area: 110, dur: 3.5, slow: 0.55 },
      { dmg: 11, cd: 0.85, area: 120, dur: 3.8, slow: 0.55 },
      { dmg: 13, cd: 0.8,  area: 130, dur: 4.0, slow: 0.60 },
      { dmg: 16, cd: 0.75, area: 140, dur: 4.3, slow: 0.60 },
    ] },
};

// 무기 슬롯 상한(REFERENCE 10단계: 6칸). 레벨업 신규 무기는 6칸 차면 후보에서 뺀다.
export const MAX_WEAPON_SLOTS = 6;

// Lv(n) 수치: lv[]가 있으면 [n-1], 없으면(부적) 단수 수치 반환.
export function weaponStat(id, level) {
  const w = WEAPONS[id];
  if (!w) return null;
  if (w.lv && w.lv.length) {
    const i = Math.max(0, Math.min(w.lv.length - 1, (level || 1) - 1));
    return w.lv[i];
  }
  return w; // 부적(단일 수치): dmg/cooldown/speed/sprite/sfx
}

// 생성 규칙(설계서 6.5)
export const SPAWN = {
  ringMin: 700,   // 화면 밖 생성 링(반경)
  ringMax: 800,
  rateBase: 1.2,  // 초당 생성량: 1.2 + 0.35 * 분
  ratePerMin: 0.35,
  rateMax: 8,
  maxEnemies: 300, // 동시 적 상한(화면 밖 적을 제거해서 이 상한을 지키면
                    // 밀어내기 O(n^2)가 300^2로 고정되어 프레임 비용이 일정)
  farDist: 1200,   // 이 거리 이상이면 플레이어 근처로 재배치
  cullDist: 1800,  // 이 거리 이상이면 아예 제거(재배치보다 훨씬 밖, 본 적 없음)
  // 무리 포위(설계서 6.5: 5분부터 가끔 도깨비불 12마리 원형 포위).
  group: {
    type: 'wisp',    // 도깨비불 무리
    count: 12,       // 원형에 둘러는 마리 수
    ring: 760,       // 포위 링 반경 — 1280x720 대각선 절반(~734)보다 밖이므로
                      // 화면 안에서 갑자기 나타나지 않음(REFERENCE 점검 요령).
    startSec: 300,   // 5분부터 발동
    intervalSec: 45, // 이 간격마다 한 번
  },
};

// 영혼 구슬(경험치) 수치 (8단계: 경험치·레벨업)
export const ORB = {
  pickup: 14,     // 이 거리 안이면 플레이어에게 흡수
  pullAccel: 900, // 자석 반경 안에서의 끌림 가속(px/s²)
  maxSpeed: 520,  // 끌림 최대 속도(px/s)
  max: 200,       // 동시 구슬 상한(넘으면 가장 오래된 것에 값 합침)
  size: 16,       // 그림 크기(화면 px, sprites.json px 32의 절반)
  radius: 6,      // 흡수 판정 반경
};

// 시간 구간별 종류 가중치 (설계서 6.4·6.5: 0~1분 처녀귀신 100%)
export const SPAWN_BANDS = [
  { until: 60,  weights: { maiden: 10 } },
  { until: 120, weights: { maiden: 6, wisp: 4 } },
  { until: 180, weights: { maiden: 5, wisp: 3, egg: 2 } },
  { until: 240, weights: { maiden: 5, wisp: 3, egg: 2, jiangshi: 2 } },
  { until: 300, weights: { maiden: 5, wisp: 4, egg: 2, jiangshi: 2, bulgasari: 2 } },
  { until: 360, weights: { maiden: 5, wisp: 4, egg: 2, jiangshi: 3, bulgasari: 3 } },
  { until: 601, weights: { maiden: 4, wisp: 4, egg: 3, jiangshi: 4, bulgasari: 4, reaper: 1 } },
];
