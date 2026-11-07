// ご褒美：石窯ピザ（マルゲリータ）＋ビール
// 中心(0,0)・半径100の円にクリップされ、1.18倍で (690,160) に置かれる。lib は ctx.L、共通パーツは ctx.parts
const meta = {
  id: 'pizza',
  title: '石窯ピザ（マルゲリータ）＋ビール',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, clip, poly, soft } = L;
  const { table, vignette, beer } = ctx.parts;
  const r = L.rng(8);
  let s = `<rect x="-110" y="-110" width="220" height="220" fill="${lg([[0, '#3b3532'], [1, '#1f1b19']])}"/>`;
  for (let i = 0; i < 60; i++) s += `<circle cx="${f(-105 + r() * 210)}" cy="${f(-105 + r() * 210)}" r="${f(0.4 + r() * 1)}" fill="#ffffff" opacity="0.06"/>`;
  // 木のピール
  s += `<ellipse cx="-10" cy="16" rx="104" ry="86" fill="${lg([[0, '#b8875a'], [1, '#7c5534']], 0, 0, 1, 1)}"/>`;
  const cx = -12, cy = 12, rx = 90, ry = 74;
  s += `<ellipse cx="${cx + 6}" cy="${cy + 8}" rx="${rx}" ry="${ry}" fill="#000" opacity="0.35"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${rg([[0, '#e7b56c'], [0.8, '#dc9c4c'], [0.92, '#b8702e'], [1, '#7e4318']])}"/>`;
  s += `<ellipse cx="${cx - 2}" cy="${cy - 3}" rx="${rx - 7}" ry="${ry - 6}" fill="none" stroke="#f5d396" stroke-width="3.5" opacity="0.55"/>`;
  // レオパード（焦げ斑）
  for (let i = 0; i < 48; i++) {
    const a = r() * Math.PI * 2, k = 0.85 + r() * 0.13;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    const w = 2 + r() * 4, h = 1.4 + r() * 2.6;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w * 1.7)}" ry="${f(h * 1.6)}" fill="#7a3d16" opacity="0.35"/>`;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w)}" ry="${f(h)}" fill="#24150d" opacity="0.88" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`;
  }
  // ソース（不規則な縁）
  let sd = '';
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, k = 0.8 + Math.sin(a * 5 + 1) * 0.015 + r() * 0.02;
    sd += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rx * k)} ${f(cy + Math.sin(a) * ry * k)} `;
  }
  sd += 'Z';
  s += `<path d="${sd}" fill="${rg([[0, '#c8401f'], [0.75, '#ad2d17'], [1, '#842412']])}"/>`;
  for (let i = 0; i < 30; i++) s += `<circle cx="${f(cx + (r() - 0.5) * rx * 1.4)}" cy="${f(cy + (r() - 0.5) * ry * 1.4)}" r="${f(0.8 + r() * 1.6)}" fill="#7a1c0c" opacity="0.5"/>`;
  // モッツァレラ
  const cheese = [[-40, -14, 17], [8, -30, 15], [30, 14, 18], [-18, 26, 16], [-52, 30, 11], [44, -12, 11], [-6, 0, 10]];
  for (const [x0, y0, rad] of cheese) {
    let d = '';
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2, k = 0.8 + r() * 0.35;
      d += `${i ? 'L' : 'M'}${f(cx + x0 + Math.cos(a) * rad * k)} ${f(cy + y0 + Math.sin(a) * rad * 0.82 * k)} `;
    }
    d += 'Z';
    s += `<path d="${d}" fill="${rg([[0, '#fffbf0'], [0.65, '#f7ead0'], [1, '#e2bf7e']])}" stroke="#e8c27c" stroke-width="1" stroke-linejoin="round"/>`;
    for (let i = 0; i < 3; i++) s += `<ellipse cx="${f(cx + x0 + (r() - 0.5) * rad)}" cy="${f(cy + y0 + (r() - 0.5) * rad * 0.7)}" rx="${f(1.5 + r() * 2.5)}" ry="${f(1 + r() * 1.5)}" fill="#c98a3a" opacity="0.55"/>`;
    s += `<ellipse cx="${f(cx + x0 - rad * 0.3)}" cy="${f(cy + y0 - rad * 0.3)}" rx="${f(rad * 0.3)}" ry="${f(rad * 0.15)}" fill="#ffffff" opacity="0.8"/>`;
  }
  // バジル
  const basil = [[-26, -34, -30, 24], [22, -4, 40, 22], [-30, 10, 160, 20], [14, 38, -60, 21], [52, 30, 100, 17]];
  for (const [x0, y0, rot, l] of basil) {
    const x = cx + x0, y = cy + y0;
    s += `<g transform="translate(${f(x)},${f(y)}) rotate(${rot})">
      <path d="M${-l / 2} 1 Q0 ${-l * 0.62} ${l / 2} 0 Q0 ${l * 0.5} ${-l / 2} 1 Z" fill="#000" opacity="0.3" transform="translate(1.5,2)"/>
      <path d="M${-l / 2} 0 Q0 ${-l * 0.62} ${l / 2} 0 Q0 ${l * 0.5} ${-l / 2} 0 Z" fill="${lg([[0, '#5c9a3f'], [1, '#2a5a22']])}"/>
      <path d="M${-l / 2} 0 Q0 -1.5 ${l / 2 - 1} 0" stroke="#a6d07a" stroke-width="0.9" fill="none" opacity="0.8"/>
      <path d="M${-l * 0.15} -1 l3 ${-l * 0.18} M${l * 0.12} -1 l3 ${-l * 0.16} M${-l * 0.1} 0.5 l3 ${l * 0.16}" stroke="#86b860" stroke-width="0.5" opacity="0.7"/>
      <ellipse cx="${-l * 0.1}" cy="${-l * 0.14}" rx="${l * 0.18}" ry="${l * 0.05}" fill="#ffffff" opacity="0.3"/>
    </g>`;
  }
  for (let i = 0; i < 14; i++) s += `<ellipse cx="${f(cx + (r() - 0.5) * rx * 1.3)}" cy="${f(cy + (r() - 0.5) * ry * 1.3)}" rx="${f(0.8 + r() * 1.5)}" ry="${f(0.5 + r())}" fill="#fff6dd" opacity="0.7"/>`;
  s += beer(r, 86, -20, 110, 34);
  s += vignette();
  return s;
}

module.exports = { meta, render };
