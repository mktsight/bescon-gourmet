// 蔵王：雪の稜線・ゴンドラ・晩秋のカラマツ・高原を歩く3人
const L = require('./lib');
const { f, mix, dk, lt, lg, rg, ridge, mist, soft, larch, snowFir, grass } = L;
const { sideFigure } = require('./people');

const LARCH = ['#b8862e', '#a0661f', '#e3b24a', '#f0cc6a'];

module.exports = function sceneZao() {
  const r = L.rng(23);
  const FOG = '#e3eaf0';
  let s = `<rect width="820" height="330" fill="${lg([[0, '#86abd0'], [0.55, '#bcd0e2'], [1, '#e4ebf0']])}"/>`;
  s += `<circle cx="110" cy="30" r="200" fill="${rg([[0, '#fffaf0', 0.9], [0.4, '#fff3dc', 0.35], [1, '#fff3dc', 0]])}"/>`;
  // 遠景の雪稜
  const m1 = ridge(r, 118, 24, 0.009);
  s += `<path d="${m1.d}" fill="${lg([[0, '#f5f8fb'], [1, '#c6d3e0']])}"/>`;
  for (let x = 0; x < 820; x += 9) {
    const y = m1.y(x);
    s += `<path d="M${f(x)} ${f(y + 3)} l${f(2 + r() * 3)} ${f(18 + r() * 26)} l${f(-1.5)} 0 Z" fill="#a8b8ca" opacity="0.45"/>`;
  }
  s += mist(130, 185, FOG, 0.7);
  // 中景：雪をかぶった山
  const m2 = ridge(r, 168, 26, 0.007);
  s += `<path d="${m2.d}" fill="${lg([[0, '#8d8b82'], [1, '#6b6a62']])}"/>`;
  let snow = `M-5 330`;
  for (let x = -5; x <= 825; x += 5) snow += ` L${x} ${f(m2.y(x))}`;
  for (let x = 825; x >= -5; x -= 7) snow += ` L${x} ${f(m2.y(x) + 22 + Math.sin(x * 0.07) * 6 + r() * 10)}`;
  s += `<path d="${snow} Z" fill="${lg([[0, '#f7f9fb'], [1, '#d5dfe8']])}"/>`;
  for (let x = 0; x < 820; x += 11) {
    const y = m2.y(x) + 18 + r() * 8;
    s += `<path d="M${f(x)} ${f(y)} q${f(1 + r() * 2)} ${f(10 + r() * 16)} ${f(2 + r() * 2)} ${f(22 + r() * 18)}" stroke="#eef3f7" stroke-width="${f(1 + r() * 1.5)}" fill="none" opacity="0.7"/>`;
  }
  s += mist(190, 240, FOG, 0.6);
  // 中景のカラマツ林
  const m3 = ridge(r, 232, 10, 0.012);
  s += `<path d="${m3.d}" fill="${lg([[0, '#a79668'], [1, '#86764b']])}"/>`;
  for (let i = 0; i < 60; i++) {
    const x = r() * 820, b = m3.y(x) + 4 + r() * 14, h = 18 + r() * 22;
    if (r() < 0.75) s += L.poly([[x, b - h], [x + h * 0.22, b], [x - h * 0.22, b]], mix(LARCH[Math.floor(r() * 4)], FOG, 0.35));
    else s += L.poly([[x, b - h], [x + h * 0.18, b], [x - h * 0.18, b]], mix('#3e5a4a', FOG, 0.35));
  }
  // ゴンドラ
  const cy = (x) => 268 - (x + 10) * (226 / 840);
  const tower = (x, base, w) => {
    const top = cy(x) + 2;
    return `<path d="M${f(x - w * 0.3)} ${f(top)} L${f(x - w)} ${f(base)} M${f(x + w * 0.3)} ${f(top)} L${f(x + w)} ${f(base)}" stroke="#5f6a76" stroke-width="${f(w * 0.35)}" fill="none"/>
      <line x1="${f(x - w * 1.4)}" y1="${f(top)}" x2="${f(x + w * 1.4)}" y2="${f(top)}" stroke="#5f6a76" stroke-width="${f(w * 0.4)}"/>
      ${[0.35, 0.65].map((t) => `<line x1="${f(x - w * (0.3 + 0.7 * t))}" y1="${f(top + (base - top) * t)}" x2="${f(x + w * (0.3 + 0.7 * t))}" y2="${f(top + (base - top) * t)}" stroke="#5f6a76" stroke-width="${f(w * 0.25)}"/>`).join('')}`;
  };
  s += tower(470, m3.y(470) + 6, 5) + tower(250, 300, 7);
  s += `<path d="M-10 268 Q120 236 250 ${f(cy(250))} Q360 ${f(cy(360) + 10)} 470 ${f(cy(470))} Q650 ${f(cy(650) + 8)} 830 ${f(cy(830))}" stroke="#4d5763" stroke-width="1.6" fill="none"/>`;
  s += `<path d="M-10 276 Q120 244 250 ${f(cy(250) + 8)} Q360 ${f(cy(360) + 18)} 470 ${f(cy(470) + 7)} Q650 ${f(cy(650) + 15)} 830 ${f(cy(830) + 7)}" stroke="#4d5763" stroke-width="1.2" fill="none" opacity="0.8"/>`;
  const cabin = (x, sc, dy) => {
    const y = cy(x) + dy;
    return `<g transform="translate(${f(x)},${f(y)}) scale(${sc})">
      <line x1="0" y1="0" x2="0" y2="12" stroke="#4d5763" stroke-width="2"/><rect x="-6" y="-2" width="12" height="4" rx="2" fill="#4d5763"/>
      <rect x="-14" y="11" width="28" height="24" rx="6" fill="${lg([[0, '#d65a44'], [1, '#952e22']])}"/>
      <rect x="-11" y="15" width="22" height="9" rx="2" fill="${lg([[0, '#f4f8fb'], [1, '#a9c0d4']], 0, 0, 1, 1)}"/>
      <line x1="0" y1="15" x2="0" y2="24" stroke="#952e22" stroke-width="1.2"/>
      <rect x="-14" y="30" width="28" height="5" rx="2" fill="#3a3f46"/>
      <rect x="-12" y="12" width="3" height="20" fill="#ffffff" opacity="0.25"/></g>`;
  };
  s += cabin(140, 1.0, 4) + cabin(360, 0.8, 8) + cabin(560, 0.62, 5);
  s += mist(240, 290, FOG, 0.35);
  // 手前の高原（枯れ草・初雪）
  const m4 = ridge(r, (x) => 286 - x * 0.03, 8, 0.01);
  s += `<path d="${m4.d}" fill="${lg([[0, '#c8a868'], [1, '#97783f']])}"/>`;
  s += grass(r, 0, 820, m4.y, 520, ['#d9bb79', '#b8954f', '#a07d3e', '#e6cf96', '#8a6a35'], 5, 14);
  const trail = `M-5 ${f(m4.y(0) + 26)} Q200 ${f(m4.y(200) + 20)} 330 ${f(m4.y(330) + 14)} Q450 ${f(m4.y(450) + 8)} 560 ${f(m4.y(560) + 2)} L560 ${f(m4.y(560) + 12)} Q450 ${f(m4.y(450) + 22)} 330 ${f(m4.y(330) + 30)} Q200 ${f(m4.y(200) + 38)} -5 ${f(m4.y(0) + 46)} Z`;
  s += `<path d="${trail}" fill="${lg([[0, '#cfc0a2'], [1, '#a8987a']])}"/>`;
  for (let i = 0; i < 16; i++) {
    const x = r() * 560, y = m4.y(x) + 6 + r() * 30;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(4 + r() * 10)}" ry="${f(1.5 + r() * 2.5)}" fill="#f2f5f8" opacity="0.85"/>`;
  }
  // 歩く3人（ポール・ザック）
  const ppl = [[300, '#b8432f', '#3b3f46', '#2f3338'], [360, '#3a5f8f', '#5a5045', '#c9b48a'], [420, '#3f7a55', '#33373d', '#b8432f']];
  for (const [x, jac, pack, hat] of ppl) {
    const y = m4.y(x) + 24;
    s += sideFigure(x, y, 78, { jacket: jac, pack, hat, pose: 'hike' });
  }
  // 手前のカラマツ・モミ
  s += larch(r, 40, 340, 230, 80, LARCH) + larch(r, 120, 345, 160, 58, LARCH);
  s += snowFir(r, 200, 340, 90, 34);
  s += soft(200, 330, 260, 30, 0.35, '#fffaf0');
  return s;
};
