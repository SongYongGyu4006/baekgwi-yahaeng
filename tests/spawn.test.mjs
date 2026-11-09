// spawn.js 단위 시험 (node:assert)
import assert from 'node:assert';
import { spawnRate, weightsAt, pickType, ringPos, reposition, spawnCount } from '../src/spawn.js';
import { ENEMY_TYPES, SPAWN, SPAWN_BANDS } from '../src/config.js';

// 1) 초당 생성량: 1.2 + 0.35*분, 최대 8
assert.ok(Math.abs(spawnRate(0) - 1.2) < 1e-9, 'rate(0)=1.2');
assert.ok(Math.abs(spawnRate(60) - (1.2 + 0.35)) < 1e-9, 'rate(60s)=1.55');
assert.ok(Math.abs(spawnRate(300) - (1.2 + 0.35 * 5)) < 1e-9, 'rate(5분)=2.95');
assert.strictEqual(spawnRate(9999), 8, 'rate 최대 8');
for (let t = 0; t < 600; t += 37) {
  const r = spawnRate(t);
  assert.ok(r >= 1.2 && r <= 8, '범위: ' + r);
}
// 단조 증가 (천장이 닿을 때까지)
for (let t = 0; t < 1200; t += 10) assert.ok(spawnRate(t) <= spawnRate(t + 1) + 1e-9, '단조');

// 2) 시간 구간별 가중치: 0~1분 처녀귀신 100%
const w0 = weightsAt(0);
assert.deepStrictEqual(w0, [{ id: 'maiden', w: 10 }], '0분: 처녀귀신만');
assert.deepStrictEqual(weightsAt(59), [{ id: 'maiden', w: 10 }], '59초: 처녀귀신만');
const w120 = weightsAt(120);
assert.ok(w120.some((e) => e.id === 'wisp'), '2분: 도깨비불 합류');
const w601 = weightsAt(601);
assert.ok(w601.some((e) => e.id === 'reaper'), '보스 이후: 저승사자');
for (const e of [...weightsAt(0), ...weightsAt(100), ...weightsAt(200), ...weightsAt(400), ...weightsAt(500)]) {
  assert.ok(ENEMY_TYPES[e.id], '알 수 없는 적 id: ' + e.id);
  assert.ok(e.w > 0);
}

// 3) 무작위 종류 뽑기: 모든 값이 유효 + 균등 근사 (4만 샘플)
const seen = new Set();
for (let i = 0; i < 40000; i++) {
  const id = pickType(weightsAt(200), (i * 0.61803398875) % 1);
  seen.add(id);
  assert.ok(ENEMY_TYPES[id], 'pickType 결과 유효: ' + id);
}
assert.ok(seen.size >= 3, '여러 종류 뽑힘: ' + [...seen]);
assert.strictEqual(pickType([], 0.5), null, '빈 가중치 → null');
assert.strictEqual(pickType([{ id: 'maiden', w: 0 }, { id: 'wisp', w: 5 }], 0.1), 'wisp', '무효 가중치 무시');

// 4) 화면 밖 링 위치: 반경 700~800
for (let i = 0; i < 1000; i++) {
  const r1 = (i * 0.7385598) % 1, r2 = (i * 0.41414) % 1;
  const p = ringPos(100, -50, r1, r2);
  const d = Math.hypot(p.x - 100, p.y - (-50));
  assert.ok(d >= SPAWN.ringMin - 1e-6 && d <= SPAWN.ringMax + 1e-6, '링 반경 범위: ' + d);
}

// 5) 재배치: 1200px 이상 벗어난 적 → 플레이어 근처 링
const far = { x: 5000, y: 3000 };
reposition(far, 0, 0, 0.3, 0.7);
assert.ok(Math.hypot(far.x, far.y) <= SPAWN.ringMax, '재배치 후 링 안에');

// 6) 분할 생성: rate*dt 의 기댓값, 상한 300
const n1 = spawnCount(0, 1, 0.9); // 1.2 → 1 또는 2
assert.ok(n1 === 1 || n1 === 2, '1초 생성: ' + n1);
const n2 = spawnCount(0, 0.1, 0.9); // 0.12 → 거의 0
assert.ok(n2 === 0 || n2 === 1, '0.1초: ' + n2);
assert.strictEqual(spawnCount(0, 1, 0.1), 2, 'rnd 0.1 < 0.2 → 2마리(1 + 소수부 발동)');
assert.strictEqual(spawnCount(0, 1, 0.99), 1, 'rnd 0.99 > 0.2 → 1마리');
assert.ok(spawnCount(9999, 999, 0.5) <= 300, '상한 300');

// 7) 상수표: 설계서 6.4 처녀귀신 수치
const m = ENEMY_TYPES.maiden;
assert.strictEqual(m.hp, 12); assert.strictEqual(m.speed, 60); assert.strictEqual(m.dmg, 5); assert.strictEqual(m.xp, 2);
assert.strictEqual(SPAWN.maxEnemies, 300);
assert.strictEqual(SPAWN.ringMin, 700); assert.strictEqual(SPAWN.ringMax, 800);
assert.strictEqual(SPAWN.farDist, 1200);
assert.ok(SPAWN_BANDS.length >= 6, '구간표 존재');

console.log('spawn ok');
