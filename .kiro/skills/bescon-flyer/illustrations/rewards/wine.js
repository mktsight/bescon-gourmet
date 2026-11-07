// ご褒美：上山の赤ワイン・ボトル・ぶどう
// 中心(0,0)・半径100の円にクリップされ、1.18倍で (690,160) に置かれる。lib は ctx.L、共通パーツは ctx.parts
const meta = {
  id: 'wine',
  title: '上山の赤ワイン・ボトル・ぶどう',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, clip, poly, soft } = L;
  const { table, vignette, beer } = ctx.parts;
  const r = L.rng(21);
  let s = `<rect x="-110" y="-110" width="220" height="220" fill="${lg([[0, '#3a2a28'], [0.55, '#241917'], [1, '#1a1210']])}"/>`;
  for (const [x, y, rad, c, op] of [[-60, -70, 26, '#f3b25a', 0.35], [-10, -84, 18, '#f7d08a', 0.3], [60, -66, 30, '#e9934a', 0.28], [80, -20, 16, '#f6c27a', 0.25], [-86, -26, 18, '#e9a35a', 0.25]]) {
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${rg([[0, c, 1], [0.7, c, 0.6], [1, c, 0]])}" opacity="${op}"/>`;
  }
  s += `<rect x="-110" y="40" width="220" height="80" fill="${lg([[0, '#6a4a34'], [1, '#2e2018']])}"/>`;
  s += `<rect x="-110" y="40" width="220" height="1.5" fill="#8a6a50" opacity="0.6"/>`;
  // ボトル
  s += `<g transform="translate(-58,0)">
    <path d="M-17 62 L-17 -18 Q-17 -36 -6 -44 L-6 -88 L6 -88 L6 -44 Q17 -36 17 -18 L17 62 Z" fill="${lg([[0, '#0b1510'], [0.35, '#2c3e33'], [0.55, '#14211a'], [1, '#060b08']], 0, 0, 1, 0)}"/>
    <rect x="-7" y="-96" width="14" height="12" rx="2" fill="${lg([[0, '#a03a4a'], [1, '#5a1a26']], 0, 0, 1, 0)}"/>
    <rect x="-15" y="2" width="30" height="34" rx="1.5" fill="#efe5d4"/>
    <rect x="-10" y="9" width="20" height="2.5" fill="#6e2a3a"/><rect x="-8" y="15" width="16" height="1.5" fill="#9a8c7a"/><rect x="-10" y="20" width="20" height="1.2" fill="#b4a794"/><rect x="-6" y="27" width="12" height="1.2" fill="#b4a794"/>
    <path d="M-11 -14 L-11 58" stroke="#ffffff" stroke-width="3" opacity="0.18"/>
    <path d="M-3 -84 L-3 -46" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
  </g>`;
  // ワイングラス
  const x0 = 18;
  s += `<ellipse cx="${x0 + 8}" cy="66" rx="36" ry="6" fill="#000" opacity="0.4"/>`;
  s += `<ellipse cx="${x0 + 18}" cy="68" rx="24" ry="4.5" fill="${rg([[0, '#d23a52', 0.7], [1, '#d23a52', 0]])}"/>`;
  const bowl = `M${x0 - 30} -76 C${x0 - 40} -46 ${x0 - 36} -6 ${x0} 4 C${x0 + 36} -6 ${x0 + 40} -46 ${x0 + 30} -76`;
  s += `<path d="${bowl} Z" fill="#ffffff" opacity="0.06"/>`;
  s += `<path d="M${x0 - 36.5} -30 C${x0 - 35} -8 ${x0 - 22} 2 ${x0} 4 C${x0 + 22} 2 ${x0 + 35} -8 ${x0 + 36.5} -30 Z" fill="${lg([[0, '#33060f'], [0.28, '#7a1228'], [0.55, '#a8223e'], [0.82, '#5c0b1d'], [1, '#26050c']], 0, 0, 1, 0)}"/>`;
  s += `<ellipse cx="${x0}" cy="-8" rx="18" ry="7" fill="${rg([[0, '#e2566c', 0.55], [1, '#e2566c', 0]])}"/>`;
  s += `<ellipse cx="${x0}" cy="-30" rx="36.5" ry="6" fill="${lg([[0, '#9c1f36'], [1, '#5a0a1a']])}"/>`;
  s += `<ellipse cx="${x0}" cy="-30" rx="36.5" ry="6" fill="none" stroke="#e98494" stroke-width="0.8" opacity="0.6"/>`;
  s += `<path d="${bowl}" stroke="#f3eaea" stroke-width="1.1" fill="none" opacity="0.55"/>`;
  s += `<ellipse cx="${x0}" cy="-76" rx="30" ry="5" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.75"/>`;
  s += `<path d="M${x0 - 27} -66 C${x0 - 33} -46 ${x0 - 30} -24 ${x0 - 22} -12 C${x0 - 26} -26 ${x0 - 28} -46 ${x0 - 23} -66 Z" fill="#ffffff" opacity="0.6"/>`;
  s += `<rect x="${x0 + 14}" y="-64" width="7" height="18" rx="3" fill="#ffffff" opacity="0.32" transform="rotate(8 ${x0 + 17} -55)"/>`;
  s += `<circle cx="${x0 - 22}" cy="-58" r="1.8" fill="#ffffff" opacity="0.95"/>`;
  s += `<path d="M${x0 - 8} -6 Q${x0} -2 ${x0 + 10} -6" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.35"/>`;
  s += `<rect x="${x0 - 1.8}" y="3" width="3.6" height="58" fill="${lg([[0, '#ffffff', 0.7], [1, '#9a9090', 0.35]], 0, 0, 1, 0)}"/>`;
  s += `<ellipse cx="${x0}" cy="62" rx="26" ry="5" fill="#ffffff" opacity="0.12" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1"/>`;
  // ぶどう
  const gp = [[64, 48], [76, 46], [58, 58], [70, 58], [82, 57], [64, 68], [76, 68], [70, 78]];
  for (const [x, y] of gp) {
    s += `<circle cx="${x}" cy="${y}" r="7" fill="${rg([[0, '#9a6aa6'], [0.6, '#5a2c62'], [1, '#2e1232']], 0.4, 0.35, 0.6)}"/>`;
    s += `<circle cx="${x - 2.4}" cy="${y - 2.6}" r="1.6" fill="#ffffff" opacity="0.6"/>`;
  }
  s += `<path d="M70 40 Q72 32 80 30" stroke="#6b7a3a" stroke-width="2" fill="none"/>`;
  s += vignette();
  return s;
}

module.exports = { meta, render };
