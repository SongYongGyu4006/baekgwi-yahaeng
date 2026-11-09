import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, DEFAULT_BEST, sanitize, loadBest, saveBest, mergeBest } from '../src/storage.js';

// 가짜 저장소: 실제 localStorage 없이 node 에서 돌려보기 위한.
function fakeStore(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    dump: (k) => (map.has(k) ? map.get(k) : null),
  };
}
function throwingStore() {
  return {
    getItem: () => { throw new Error('boom read'); },
    setItem: () => { throw new Error('boom write'); },
  };
}

test('저장소 null 이어도 기본값', () => {
  assert.deepEqual(loadBest(null), { survive: 0, kills: 0 });
  assert.equal(saveBest({ survive: 10, kills: 5 }, null), false);
});

test('깨진 값들은 전부 기본값으로 보정', () => {
  for (const raw of ['{깨짐', 'null', '[]', '{"survive":"abc","kills":-5}']) {
    const st = fakeStore({ [KEY]: raw });
    assert.deepEqual(loadBest(st), { survive: 0, kills: 0 }, raw);
  }
  // getItem 이 null (아무 저장 안 된 경우)
  assert.deepEqual(loadBest(fakeStore({})), { survive: 0, kills: 0 });
});

test('setItem 예외를 던져도 saveBest 는 오류 없이 false', () => {
  assert.equal(saveBest({ survive: 1, kills: 1 }, throwingStore()), false);
});

test('읽기 예외도 오류 없이 기본값', () => {
  assert.deepEqual(loadBest(throwingStore()), { survive: 0, kills: 0 });
});

test('정상 라운드트립: 저장 후 불러오면 같은 값', () => {
  const st = fakeStore({});
  assert.equal(saveBest({ survive: 137.5, kills: 42 }, st), true);
  assert.equal(st.dump(KEY), '{"survive":137.5,"kills":42}');
  assert.deepEqual(loadBest(st), { survive: 137.5, kills: 42 });
});

test('sanitize: 배열·오류 형상은 기본값, 음수·문자열은 0', () => {
  assert.deepEqual(sanitize(null), DEFAULT_BEST);
  assert.deepEqual(sanitize([1, 2]), DEFAULT_BEST);
  assert.deepEqual(sanitize('x'), DEFAULT_BEST);
  assert.deepEqual(sanitize({ survive: -3, kills: '9' }), { survive: 0, kills: 0 });
  assert.deepEqual(sanitize({ survive: 5, kills: 2.7 }), { survive: 5, kills: 2 });
});

test('mergeBest: 큰 값만 갱신 + 신기록 플래그', () => {
  const r = mergeBest({ survive: 100, kills: 10 }, { survive: 120, kills: 8 });
  assert.deepEqual(r.best, { survive: 120, kills: 10 });
  assert.equal(r.newSurvive, true);
  assert.equal(r.newKills, false);
});

test('mergeBest: 같은 값이면 신기록 아님', () => {
  const r = mergeBest({ survive: 100, kills: 10 }, { survive: 100, kills: 10 });
  assert.deepEqual(r.best, { survive: 100, kills: 10 });
  assert.equal(r.newSurvive, false);
  assert.equal(r.newKills, false);
});
