// 16단계: 최고 기록(최장 생존·최다 처치) 저장. localStorage 를 직접 쓰지 않고
// 저장소 객체(getItem/setItem)를 인자로 받는 순수 함수 — node 단위 시험에서
// 가짜 저장소를 넣을 수 있다. DOM·window·globalThis.localStorage 는
// defaultStore() 안에서만, try/catch 로 안전하게 접근한다.
export const KEY = 'baekgwi_best_v1';
export const DEFAULT_BEST = { survive: 0, kills: 0 };

// 값이 숫자가 아니거나 음수·0 이하이면 0. (생존초는 실수, 처치는 정수로)
const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

export function sanitize(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...DEFAULT_BEST };
  return { survive: num(v.survive), kills: Math.floor(num(v.kills)) };
}

export function defaultStore() {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
}

// 저장소가 없거나 JSON이 깨졌거나 값이 이상하면 기본값, 예외는 밖으로 내보내지 않음.
export function loadBest(store = defaultStore()) {
  if (!store) return { ...DEFAULT_BEST };
  try { return sanitize(JSON.parse(store.getItem(KEY))); }
  catch (e) { return { ...DEFAULT_BEST }; }
}

export function saveBest(best, store = defaultStore()) {
  if (!store) return false;
  try { store.setItem(KEY, JSON.stringify(sanitize(best))); return true; }
  catch (e) { return false; }
}

// 이번 판과 기록 비교: 더 큰 값만 갱신 + 신기록 플래그. 같은 값이면 신기록 아님.
export function mergeBest(prev, run) {
  const p = sanitize(prev), r = sanitize(run);
  return {
    best: { survive: Math.max(p.survive, r.survive), kills: Math.max(p.kills, r.kills) },
    newSurvive: r.survive > p.survive,
    newKills: r.kills > p.kills,
  };
}
