// 9단계: 1차 완성판 승리 조건 (순수 함수 checkWin, node:assert)
import assert from 'node:assert';
import { checkWin } from '../src/state.js';
import { WIN_TIME, GAME_LENGTH } from '../src/config.js';

// 1) 수치표: 1차 = 3분(180초) 생존. 10분(600) 스폰 구간표와 별개.
assert.strictEqual(WIN_TIME, 180, '1차 승리 180초(3분)');
assert.strictEqual(GAME_LENGTH, 600, '10분 스폰 기준 유지');

// 2) 180초 미만이면 안 이김
assert.strictEqual(checkWin(0), false, '0초 → 패배(아직)');
assert.strictEqual(checkWin(60), false, '1분 → 아직');
assert.strictEqual(checkWin(179.9), false, '180 직전 → 아직');

// 3) 180초 도달(이후)이면 이김 — 경계 포함
assert.strictEqual(checkWin(180), true, '정확히 180초 → 승리');
assert.strictEqual(checkWin(180.1), true, '180 이후 → 승리');
assert.strictEqual(checkWin(600), true, '10분 → 승리');

// 4) 비-숫자 입력은 false (오류 없이)
assert.strictEqual(checkWin(NaN), false, 'NaN → false');
assert.strictEqual(checkWin(null), false, 'null → false');
assert.strictEqual(checkWin(undefined), false, 'undefined → false');
assert.strictEqual(checkWin('180'), false, '문자열 → false(숫자만)');

// 5) 불리언 반환 타입
assert.strictEqual(typeof checkWin(200), 'boolean');

console.log('win ok');
