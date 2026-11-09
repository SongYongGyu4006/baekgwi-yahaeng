// 동작 프레임 선택(순수 함수). sprites.json 의 _anims 를 쓰고, 아직 Image 로딩
// 안 된 프레임 id 는 기본 id 로 대체해 캐릭터가 사라지지 않게 한다.
// DOM 을 쓰지 않아 node 단위 시험에서도 import 가 된다.
import { SPRITES } from './art/sprites.js';
import { getAnims, spriteLoaded } from './art/images.js';

// 파일명('assets/sprites/player_walk0.png') → 스프라이트 id('player_walk0')
function fileIdOf(file) {
  const i = String(file).lastIndexOf('/');
  const name = i >= 0 ? String(file).slice(i + 1) : String(file);
  const j = name.lastIndexOf('.');
  return j > 0 ? name.slice(0, j) : name;
}

// 스프라이트 id + 파일 → 스프라이트 정의 크기(도트 fallback 크기)
function sizeOf(id, file) {
  const d = SPRITES[id];
  if (d) return d.size;
  const f = fileIdOf(file);
  const d2 = SPRITES[f];
  return d2 ? d2.size : 32;
}

// _anims 의 원본(파일 경로 목록). 캐시로 한 번만 읽는다.
let cached = null;
function rawAnims() {
  if (cached === null) cached = getAnims() || {};
  return cached;
}

// 동작 프레임 목록: animFrames('player', 'walk') → [{id, file, size}, ...], 없으면 null
export function animFrames(sprId, key) {
  const set = rawAnims()[sprId];
  const files = set && set[key];
  if (!Array.isArray(files) || !files.length) return null;
  return files.map((f) => ({ id: fileIdOf(f), file: f, size: sizeOf(sprId, f) }));
}

// 프레임 id → 스프라이트 정의가 있으면 그 size, 없으면 기본 id 의 size, 그것도 없으면 32
export function frameSize(id, baseId) {
  const d = SPRITES[id] || SPRITES[baseId];
  return d ? d.size : 32;
}

// id → 도트 프레임 인덱스. 프레임 도트는 기본 스프라이트 첫 장이라 항상 0.
export function frameIndex() {
  return 0;
}

// 안전한 id: 프레임이 아직 Image 로딩 안 됐으면(또는 정의가 없으면) 기본 id 로.
// node(단위 시험)에서는 IMAGES 가 비어 있어 항상 기본 id 가 된다.
export function safeId(id, baseId) {
  if (spriteLoaded(id)) return id;
  if (SPRITES[id]) return id; // 도트 정의가 있으면 그 사용
  return baseId;
}

// 플레이어 동작 프레임 선택. 우선순위: 죽음 → 피격 → 공격 → 걷기 → 가만히.
// p: { moving, animT, atkT, hurtT } (+ alive)
export function pickPlayerFrame(p, alive) {
  const act = animFrames('player', 'act');
  const walk = animFrames('player', 'walk');
  if (!alive && act && act[3]) return act[3];                    // 죽음
  if (p.hurtT > 0 && act && act[2]) return act[2];                // 피격 0.2초
  if (p.atkT > 0 && act && act[1]) return act[1];                 // 공격 0.15초
  if (p.moving && walk && walk.length) {
    const f = walk[Math.floor(p.animT * 8) % walk.length];        // 약 8fps
    return f;
  }
  return act && act[0] ? act[0] : null;                           // 가만히
}

// 적 동작 프레임 선택: enemy_maiden.move / enemy_jiangshi.move 이동 중 반복(약 8fps).
// 프레임이 없는 적(다른 종류)은 null → 호출 쪽이 기존 한 장 + 흔들림.
export function pickEnemyFrame(spriteId, t) {
  const move = animFrames(spriteId, 'move');
  if (!move || !move.length) return null;
  return move[Math.floor(t * 8) % move.length];
}
