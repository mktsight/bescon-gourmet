// 上山：上山城（白壁・黒瓦）と湯けむりの温泉街を歩く3人
const L = require('./lib');
const { f, mix, dk, lt, lg, rg, poly, ridge, mist, soft, leafTree, jroof, stoneWall } = L;
const { backFigure } = require('./people');

const MAPLE = ['#7e2418', '#b23c22', '#e0702f', '#f2b04a'];
const GINKGO = ['#9a6a1a', '#cf9a2a', '#ecc34e', '#f7dc80'];
const GREEN = ['#3f5a40', '#58744f', '#7a9468'];

module.exports = function sceneKaminoyama() {
  const r = L.rng(37);
  const FOG = '#ece4dc';
  let s = `<rect width="820" height="330" fill="${lg([[0, '#b9cbdb'], [0.6, '#e8e1d9'], [1, '#f0e3d4']])}"/>`;
  s += `<circle cx="140" cy="50" r="200" fill="${rg([[0, '#fff8ea', 0.9], [0.4, '#fdeed6', 0.4], [1, '#fdeed6', 0]])}"/>`;
  const m1 = ridge(r, 150, 14, 0.01);
  s += `<path d="${m1.d}" fill="#c4ccd5"/>`;
  s += mist(130, 200, FOG, 0.6);
  // 城山（紅葉の森）
  s += `<path d="M-10 330 L-10 200 Q80 140 200 128 Q320 132 420 190 L440 330 Z" fill="${lg([[0, '#8f8a6a'], [1, '#6a6a50']])}"/>`;
  for (let i = 0; i < 26; i++) {
    const x = -10 + r() * 440, base = 150 + Math.abs(x - 200) * 0.38 + r() * 50;
    const pal = [MAPLE, GINKGO, GREEN, MAPLE][Math.floor(r() * 4)];
    s += leafTree(r, x, base + 30, 40 + r() * 20, 30 + r() * 22, pal.map((c) => mix(c, FOG, 0.25)), '#5a4334', 0.9);
  }
  // 上山城
  const cx = 200;
  let c = '';
  c += stoneWall(r, `<polygon points="${cx - 52},140 ${cx + 52},140 ${cx + 60},166 ${cx - 60},166"/>`, cx - 62, cx + 62, 140, 166, ['#b8ae9e', '#a49a8a', '#c6bcac', '#9a9080'], '#6e6658', [5, 7], [8, 15]);
  c += `<rect x="${cx - 44}" y="112" width="74" height="28" fill="#f4f1ea"/><rect x="${cx + 30}" y="112" width="14" height="28" fill="#d5d1c8"/>`;
  for (let i = 0; i < 4; i++) c += `<rect x="${cx - 38 + i * 17}" y="120" width="8" height="9" fill="#3d3e46"/><line x1="${cx - 34 + i * 17}" y1="120" x2="${cx - 34 + i * 17}" y2="129" stroke="#9a9aa2" stroke-width="0.6"/>`;
  c += `<rect x="${cx - 44}" y="134" width="88" height="6" fill="#3a3a40"/>`;
  c += jroof(cx - 46, cx + 46, 114, 102, 9, '#3f4248');
  c += `<rect x="${cx - 30}" y="86" width="50" height="18" fill="#f4f1ea"/><rect x="${cx + 20}" y="86" width="10" height="18" fill="#d5d1c8"/>`;
  for (let i = 0; i < 3; i++) c += `<rect x="${cx - 25 + i * 16}" y="91" width="7" height="8" fill="#3d3e46"/>`;
  c += jroof(cx - 34, cx + 34, 88, 76, 8, '#3f4248');
  c += `<path d="M${cx - 12} 80 L${cx} 70 L${cx + 12} 80 Z" fill="#f4f1ea" stroke="#3f4248" stroke-width="2"/>`;
  c += `<rect x="${cx - 18}" y="58" width="32" height="15" fill="#f4f1ea"/><rect x="${cx + 14}" y="58" width="6" height="15" fill="#d5d1c8"/>`;
  c += `<rect x="${cx - 12}" y="62" width="6" height="7" fill="#3d3e46"/><rect x="${cx + 2}" y="62" width="6" height="7" fill="#3d3e46"/>`;
  c += jroof(cx - 22, cx + 22, 60, 44, 8, '#3f4248');
  c += `<circle cx="${cx - 12}" cy="41" r="2.4" fill="#c9a24a"/><circle cx="${cx + 12}" cy="41" r="2.4" fill="#c9a24a"/>`;
  s += c;
  s += mist(150, 210, FOG, 0.3);
  // 通り（透視）
  const CX = 330, HZ = 228, F = 300, CAM = 1.6;
  const P = (x, y, z) => [CX + (F * x) / z, HZ - (F * (y - CAM)) / z];
  const fogT = (z) => Math.min(0.7, Math.max(0, (z - 5) / 50));
  s += poly([P(-3.2, 0, 2.5), P(4, 0, 2.5), P(4, 0, 70), P(-3.2, 0, 70)], lg([[0, '#c7bfb2'], [1, '#857d72']]));
  for (let z = 3; z < 60; z *= 1.16) s += `<line x1="${f(P(-3.2, 0, z)[0])}" y1="${f(P(0, 0, z)[1])}" x2="${f(P(4, 0, z)[0])}" y2="${f(P(0, 0, z)[1])}" stroke="#6e675d" stroke-width="${f(Math.max(0.3, 3 / z))}" opacity="0.35"/>`;
  for (const x of [-2, -0.8, 0.4, 1.6, 2.8]) s += `<line x1="${f(P(x, 0, 2.5)[0])}" y1="${f(P(x, 0, 2.5)[1])}" x2="${f(P(x, 0, 60)[0])}" y2="${f(P(x, 0, 60)[1])}" stroke="#6e675d" stroke-width="0.6" opacity="0.3"/>`;
  // 左の低い石垣
  s += poly([P(-3.2, 0, 2.5), P(-3.2, 0.9, 2.5), P(-3.2, 0.9, 60), P(-3.2, 0, 60)], lg([[0, '#9e968a'], [1, '#7a7368']]));
  s += poly([P(-3.2, 0.9, 2.5), P(-3.5, 0.95, 2.5), P(-3.5, 0.95, 60), P(-3.2, 0.9, 60)], '#c2baae');
  // 右の町家（奥→手前）
  const bs = [[44, 60, 6.5], [36, 44, 7.5], [29, 36, 6.8], [23, 29, 7.8], [17.5, 23, 6.6], [12.5, 17.5, 7.6], [8, 12.5, 6.8], [2, 8, 7.4]];
  const NOREN = ['#2f3a5a', '#5b3a5e', '#7a2f2a'];
  bs.forEach(([z1, z2, h], bi) => {
    const t = fogT(z1), m = (col) => mix(col, FOG, t);
    const zf = z2, zn = z1;
    // 手前向きの妻壁
    s += poly([P(4, 0, zn), P(4, h, zn), P(10, h, zn), P(10, 0, zn)], m('#d9cdb8'));
    s += poly([P(3, h, zn), P(7, h + 2.6, zn), P(11, h, zn)], m('#3f3d3f'));
    // 1階：格子
    s += poly([P(4, 0, zn), P(4, 3, zn), P(4, 3, zf), P(4, 0, zf)], m('#6b4a33'));
    for (let z = zn; z < zf; z += 0.24) s += `<line x1="${f(P(4, 0, z)[0])}" y1="${f(P(4, 0.05, z)[1])}" x2="${f(P(4, 0, z)[0])}" y2="${f(P(4, 2.9, z)[1])}" stroke="${m('#3a2618')}" stroke-width="${f(Math.max(0.3, 9 / z))}"/>`;
    const ze = zn + (zf - zn) * 0.3, ze2 = zn + (zf - zn) * 0.55;
    s += poly([P(4, 0, ze), P(4, 2.4, ze), P(4, 2.4, ze2), P(4, 0, ze2)], lg([[0, m('#f2c27a')], [1, m('#6a3a1a')]]));
    s += poly([P(3.98, 1.55, ze), P(3.98, 2.4, ze), P(3.98, 2.4, ze2), P(3.98, 1.55, ze2)], m(NOREN[bi % 3]));
    // 庇
    s += poly([P(4, 3.35, zn), P(3.05, 2.95, zn), P(3.05, 2.95, zf), P(4, 3.35, zf)], m('#38363a'));
    // 2階：漆喰
    s += poly([P(4, 3.35, zn), P(4, h, zn), P(4, h, zf), P(4, 3.35, zf)], m('#efe6d4'));
    for (const z of [zn, (zn + zf) / 2, zf]) s += `<line x1="${f(P(4, 0, z)[0])}" y1="${f(P(4, 3.35, z)[1])}" x2="${f(P(4, 0, z)[0])}" y2="${f(P(4, h, z)[1])}" stroke="${m('#4a3426')}" stroke-width="${f(Math.max(0.4, 14 / z))}"/>`;
    const zw = zn + (zf - zn) * 0.2, zw2 = zn + (zf - zn) * 0.42;
    s += poly([P(4, 4.2, zw), P(4, 5.6, zw), P(4, 5.6, zw2), P(4, 4.2, zw2)], m('#4a3a30'));
    // 軒
    s += poly([P(4, h + 1.1, zn), P(2.9, h, zn), P(2.9, h, zf), P(4, h + 1.1, zf)], lg([[0, m('#55524f')], [1, m('#2c2a2b')]]));
    // 提灯
    const zl = zn + 0.4;
    const [lx, ly] = P(3.4, 2.4, zl), lr = Math.max(1.2, (F * 0.2) / zl);
    s += `<circle cx="${f(lx)}" cy="${f(ly)}" r="${f(lr * 3)}" fill="${rg([[0, '#ffb760', 0.55], [1, '#ffb760', 0]])}"/>`;
    s += `<ellipse cx="${f(lx)}" cy="${f(ly)}" rx="${f(lr)}" ry="${f(lr * 1.35)}" fill="${lg([[0, '#fbe2a8'], [1, '#e08a38']])}"/>`;
  });
  // ♨ 看板
  const [sx, sy] = P(3.6, 4.6, 6.5), ss = F / 6.5;
  s += `<rect x="${f(sx - ss * 0.32)}" y="${f(sy - ss * 0.5)}" width="${f(ss * 0.64)}" height="${f(ss * 1.0)}" rx="3" fill="#f6efe2" stroke="#4a3426" stroke-width="2.5"/>`;
  s += `<text x="${f(sx)}" y="${f(sy + ss * 0.22)}" text-anchor="middle" font-size="${f(ss * 0.55)}" fill="#8a2f2a">♨</text>`;
  // 足湯の湯けむり（左手前）
  const [bx, by] = P(-2.0, 0.45, 6.2);
  s += `<ellipse cx="${f(bx)}" cy="${f(by + 8)}" rx="44" ry="10" fill="#8f877b"/><ellipse cx="${f(bx)}" cy="${f(by + 5)}" rx="38" ry="7" fill="${lg([[0, '#a9c6cc'], [1, '#6f949c']])}"/>`;
  for (let i = 0; i < 16; i++) s += soft(bx - 10 + i * 3 + Math.sin(i) * 12, by - 6 - i * 11, 18 + i * 2.2, 14 + i * 1.6, f(0.62 - i * 0.03));
  for (let i = 0; i < 10; i++) s += soft(P(3.3, 3.4, 10)[0] - i * 2, P(3.3, 3.4, 10)[1] - i * 10, 12 + i * 2, 9 + i * 1.5, f(0.45 - i * 0.035));
  // 柳
  const [wx, wy] = P(-3.6, 0, 4.2);
  s += `<path d="M${f(wx)} ${f(wy)} Q${f(wx + 4)} ${f(wy - 80)} ${f(wx + 10)} ${f(wy - 170)}" stroke="#4a3a2c" stroke-width="7" fill="none"/>`;
  for (let i = 0; i < 46; i++) {
    const x0 = wx - 40 + r() * 110, y0 = wy - 190 + r() * 40;
    s += `<path d="M${f(x0)} ${f(y0)} q${f((r() - 0.5) * 12)} ${f(50 + r() * 50)} ${f((r() - 0.5) * 6)} ${f(90 + r() * 60)}" stroke="${['#8c9a4a', '#a8a856', '#c2b55e', '#6f7c3c'][Math.floor(r() * 4)]}" stroke-width="${f(1 + r() * 1.4)}" fill="none" opacity="0.9"/>`;
  }
  // 歩く3人（後ろ姿）
  for (const [x, z, jac, pack] of [[0.9, 7.8, '#3f7a55', '#5a5045'], [-0.4, 6.4, '#b8432f', '#3b3f46'], [1.9, 6.9, '#3a5f8f', '#33373d']]) {
    const [px, py] = P(x, 0, z);
    s += backFigure(px, py, (F * 1.7) / z, { jacket: jac, pack, hat: null, pose: 'walk' });
  }
  return s;
};
