// 山形駅前：霞城公園の石垣・東大手門・お濠、紅葉、遠景に駅前の街並み、走る3人
// シーン（パネル座標 820x330）。lib/people は ctx から受け取る（defs レジストリを共有するため require しない）

const MAPLE = ['#7e2418', '#b23c22', '#e0702f', '#f2b04a'];
const GINKGO = ['#9a6a1a', '#cf9a2a', '#ecc34e', '#f7dc80'];
const CHERRY = ['#7a3020', '#a8492c', '#cf7442', '#e8a060'];
const GREEN = ['#3f5a40', '#58744f', '#7a9468'];

const meta = {
  id: 'ekimae',
  title: '山形駅前：霞城公園の石垣・東大手門・お濠、紅葉、遠景に駅前の街並み、走る3人',
  season: '晩秋',
  trail: 'M222 292 Q380 280 480 268 Q545 258 568 222',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, poly, ridge, mist, soft, leafTree, jroof, stoneWall, grass } = L;
  const { sideFigure } = ctx.people;
  const r = L.rng(41);
  const FOG = '#e6ebea';
  let s = `<rect width="820" height="330" fill="${lg([[0, '#a6c1da'], [0.6, '#d9e3e8'], [1, '#eef0ea']])}"/>`;
  s += `<circle cx="120" cy="40" r="200" fill="${rg([[0, '#fffaf0', 0.85], [1, '#fffaf0', 0]])}"/>`;
  const m1 = ridge(r, 128, 12, 0.01);
  s += `<path d="${m1.d}" fill="#c3cfda"/>`;
  for (let x = 0; x < 820; x += 7) s += `<path d="M${f(x)} ${f(m1.y(x) + 1)} l1.5 ${f(5 + r() * 6)} l1.5 0 Z" fill="#f4f7fa" opacity="0.8"/>`;
  // 駅前の街並み（淡く）
  let city = '';
  const bl = [[300, 40, 52], [342, 30, 70], [374, 46, 44], [424, 26, 86], [452, 38, 120], [492, 34, 64], [530, 48, 50], [580, 30, 74], [612, 44, 40]];
  for (const [x, w, h] of bl) {
    const top = 168 - h;
    city += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${lg([[0, '#c9d4dd'], [1, '#b6c3ce']], 0, 0, 1, 0)}"/>`;
    for (let y = top + 6; y < 166; y += 6) city += `<line x1="${x + 3}" y1="${y}" x2="${x + w - 3}" y2="${y}" stroke="#e8eef2" stroke-width="1" opacity="0.6"/>`;
  }
  city += `<rect x="462" y="40" width="18" height="10" fill="#c3ced8"/><line x1="471" y1="26" x2="471" y2="40" stroke="#b6c3ce" stroke-width="1.5"/>`;
  s += city + mist(110, 180, FOG, 0.6);
  // 石垣上の木々
  for (let i = 0; i < 22; i++) {
    const x = -10 + r() * 640, pal = [MAPLE, GINKGO, CHERRY, GREEN][Math.floor(r() * 4)];
    s += leafTree(r, x, 168 + r() * 8, 46 + r() * 30, 36 + r() * 26, pal, '#5a4334', 0.9);
  }
  // 石垣
  const WALL = ['#b5ab9b', '#a59b8b', '#c2b8a8', '#978d7e', '#aca291'];
  const wl = `<polygon points="-10,160 205,164 214,246 -10,246"/>`;
  const wr = `<polygon points="330,164 830,172 830,246 322,246"/>`;
  s += stoneWall(r, wl, -10, 216, 158, 246, WALL) + stoneWall(r, wr, 320, 830, 162, 246, WALL);
  s += poly([[-10, 160], [205, 164], [214, 246], [-10, 246]], lg([[0, '#000', 0], [1, '#000', 0.25]]));
  s += poly([[330, 164], [830, 172], [830, 246], [322, 246]], lg([[0, '#000', 0], [1, '#000', 0.25]]));
  // 東大手門（櫓門）
  let g = `<rect x="214" y="160" width="108" height="86" fill="${lg([[0, '#1e1712'], [1, '#3a2c22']])}"/>`;
  g += `<rect x="226" y="176" width="40" height="70" fill="#5a4030"/><rect x="270" y="176" width="40" height="70" fill="#4e3628"/>`;
  for (const x of [232, 244, 256, 276, 288, 300]) for (const y of [190, 210, 230]) g += `<circle cx="${x}" cy="${y}" r="1.4" fill="#8a7a62"/>`;
  g += `<rect x="186" y="110" width="164" height="52" fill="${lg([[0, '#f6f3ec'], [1, '#e2ddd2']])}"/>`;
  g += `<rect x="186" y="148" width="164" height="14" fill="#3a3634"/>`;
  for (const x of [200, 236, 286, 322]) {
    g += `<rect x="${x}" y="122" width="18" height="16" fill="#2e2b2a"/>`;
    for (let k = 1; k < 5; k++) g += `<line x1="${x + k * 3.6}" y1="122" x2="${x + k * 3.6}" y2="138" stroke="#8a8682" stroke-width="0.8"/>`;
  }
  g += jroof(186, 350, 112, 86, 16, '#454a4c');
  s += g;
  // お濠
  const WL = 246;
  s += `<rect x="-10" y="${WL}" width="840" height="58" fill="${lg([[0, '#55767a'], [1, '#3a5559']])}"/>`;
  s += `<g clip-path="${L.clip(`<rect x="-10" y="${WL}" width="840" height="58"/>`)}"><g transform="matrix(1 0 0 -1 0 ${WL * 2})" opacity="0.28">${g}<rect x="-10" y="160" width="840" height="86" fill="#a59b8b"/></g></g>`;
  for (let i = 0; i < 40; i++) {
    const x = r() * 820, y = WL + 4 + r() * 50;
    s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + 8 + r() * 22)}" y2="${f(y)}" stroke="#d9e8e8" stroke-width="1" opacity="${f(0.2 + r() * 0.3)}"/>`;
  }
  for (let i = 0; i < 14; i++) s += `<ellipse cx="${f(r() * 820)}" cy="${f(WL + 6 + r() * 48)}" rx="2.2" ry="1" fill="${MAPLE[1 + Math.floor(r() * 3)]}"/>`;
  // 橋
  s += poly([[230, 246], [306, 246], [340, 304], [196, 304]], lg([[0, '#9a7a58'], [1, '#6e5238']]));
  for (let k = 1; k < 7; k++) {
    const t = k / 7, y = 246 + 58 * t;
    s += `<line x1="${f(230 - 34 * t)}" y1="${f(y)}" x2="${f(306 + 34 * t)}" y2="${f(y)}" stroke="#5a4230" stroke-width="0.8" opacity="0.6"/>`;
  }
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? 230 : 306, x1 = sd < 0 ? 196 : 340;
    s += `<line x1="${x0}" y1="236" x2="${x1}" y2="286" stroke="#4e3a2a" stroke-width="2.4"/>`;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      s += `<line x1="${f(x0 + (x1 - x0) * t)}" y1="${f(236 + 50 * t)}" x2="${f(x0 + (x1 - x0) * t)}" y2="${f(246 + 58 * t)}" stroke="#4e3a2a" stroke-width="${f(1.5 + t * 2)}"/>`;
    }
  }
  // 手前の園路
  s += `<rect x="-10" y="300" width="840" height="8" fill="#8fae78"/>`;
  s += grass(r, -10, 830, () => 306, 160, ['#7a9a5e', '#9ab878', '#5f7e48'], 3, 8);
  s += `<rect x="-10" y="306" width="840" height="30" fill="${lg([[0, '#d8ccb4'], [1, '#bfb196']])}"/>`;
  for (let i = 0; i < 60; i++) s += `<ellipse cx="${f(r() * 820)}" cy="${f(308 + r() * 22)}" rx="${f(1.5 + r() * 2)}" ry="${f(0.8 + r())}" fill="${[...GINKGO, ...MAPLE][Math.floor(r() * 8)]}" opacity="0.9"/>`;
  // 走る3人
  for (const [x, jac, cap, pose] of [[70, '#b8432f', '#2f3338', 'run'], [130, '#3a5f8f', '#e8e2d6', 'run2'], [190, '#3f7a55', '#2f3338', 'run']]) {
    s += sideFigure(x, 326, 70, { jacket: jac, cap, pose, pants: '#2e333c' });
  }
  // 手前の紅葉の枝（左上）
  s += leafTree(r, 20, 120, 150, 140, MAPLE, '#4a3528', 0.8);
  return s;
}

module.exports = { meta, render };
