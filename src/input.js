// 키 상태: window.__input (키가 눌러져 있는지)
const CODE_KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };
export function createInput() {
  const keys = Object.create(null);
  const attach = () => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', (e) => {
      keys[e.key] = true;
      if (CODE_KEY[e.code]) keys[CODE_KEY[e.code]] = true;   // 한글 입력 상태에서도 WASD
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; if (CODE_KEY[e.code]) keys[CODE_KEY[e.code]] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  };
  const down = (k) => !!keys[k];
  // 8방향 입력 벡터 (대각선 정규화됨)
  const moveVector = () => {
    let x = 0, y = 0;
    if (down('ArrowLeft') || down('a') || down('A')) x -= 1;
    if (down('ArrowRight') || down('d') || down('D')) x += 1;
    if (down('ArrowUp') || down('w') || down('W')) y -= 1;
    if (down('ArrowDown') || down('s') || down('S')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  };
  const releaseAll = () => { for (const k in keys) keys[k] = false; };
  attach();
  return { keys, down, moveVector, releaseAll };
}

if (typeof window !== 'undefined') window.__input = createInput();
