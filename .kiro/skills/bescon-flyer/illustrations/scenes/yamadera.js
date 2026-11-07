// 山寺：杉木立の石段（透視図法）＋岩崖の五大堂・納経堂、晩秋の紅葉
// シーン（パネル座標 820x330）。lib/people は ctx から受け取る（defs レジストリを共有するため require しない）

const MAPLE = ['#7e2418', '#b23c22', '#e0702f', '#f2b04a'];
const MAPLE_Y = ['#9a5a1a', '#cc8526', '#eab045', '#f7d97a'];
const PINE = ['#2f4233', '#465c47', '#62785e'];

const meta = {
  id: 'yamadera',
  title: '山寺：杉木立の石段（透視図法）＋岩崖の五大堂・納経堂、晩秋の紅葉',
  season: '晩秋',
  trail: 'M262 168 Q330 240 430 226 Q520 214 566 182',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, clip, poly, ridge, mist, soft, foliage, leafTree, sugi, jroof } = L;
  const { backFigure } = ctx.people;
  const r = L.rng(11);
  const FOG = '#e7e1d6';
  let s = '';
  // 空・光
  s += `<rect width="820" height="330" fill="${lg([[0, '#bccbd5'], [0.5, '#e6e0d3'], [1, '#efe2cd']])}"/>`;
  s += `<circle cx="560" cy="20" r="260" fill="${rg([[0, '#fff7e2', 0.95], [0.35, '#fbe8c6', 0.5], [1, '#fbe8c6', 0]])}"/>`;
  // 遠景の山並み（空気遠近）
  const m1 = ridge(r, 150, 24, 0.012);
  s += `<path d="${m1.d}" fill="${lg([[0, '#b3bec4'], [1, '#c9cdc9']])}"/>`;
  const m2 = ridge(r, 190, 18, 0.016);
  s += `<path d="${m2.d}" fill="${lg([[0, '#a5ad9c'], [1, '#bfc0b2']])}"/>`;
  for (let i = 0; i < 120; i++) {
    const x = 380 + r() * 450, y = m2.y(x) + 4 + r() * 60;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2 + r() * 3)}" fill="${[ '#c69a72', '#b98a66', '#a9a487', '#c7a27c'][Math.floor(r() * 4)]}" opacity="0.55"/>`;
  }
  s += mist(150, 240, FOG, 0.75);

  // 岩崖（凝灰岩・浸食の穴）
  const cliffPts = [[492, 330], [505, 285], [522, 246], [545, 212], [566, 192], [585, 164], [604, 140], [628, 120], [660, 106], [700, 101], [736, 105], [762, 96], [796, 101], [830, 96], [900, 92], [990, 96], [990, 330]];
  const rockY = (x) => {
    for (let i = 1; i < cliffPts.length - 1; i++) {
      const [x0, y0] = cliffPts[i - 1], [x1, y1] = cliffPts[i];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return 100;
  };
  let cliffG = "";
  const cliffShape = `<polygon points="${L.pts(cliffPts)}"/>`;
  cliffG += poly(cliffPts, lg([[0, '#cfc3ad'], [0.4, '#ab9d88'], [1, '#6c6257']], 0, 0, 1, 0.7));
  let tex = '';
  for (let i = 0; i < 26; i++) {
    const x = 500 + r() * 330, y = 110 + r() * 220, w = 14 + r() * 40, h = 20 + r() * 60;
    tex += poly([[x, y], [x + w, y + h * 0.2], [x + w * 0.7, y + h], [x - w * 0.2, y + h * 0.8]], r() < 0.5 ? '#ddd2bf' : '#4f463d', `opacity="${f(0.12 + r() * 0.16)}"`);
  }
  for (let i = 0; i < 40; i++) {
    const x = 505 + r() * 320, y = rockY(Math.min(828, x)) + r() * 140, l = 25 + r() * 80;
    tex += `<path d="M${f(x)} ${f(y)} q${f((r() - 0.5) * 10)} ${f(l / 2)} ${f((r() - 0.5) * 8)} ${f(l)}" stroke="#40382f" stroke-width="${f(0.6 + r() * 1.2)}" fill="none" opacity="0.3"/>`;
  }
  const holes = [[600, 205, 13, 9], [655, 160, 9, 7], [720, 190, 15, 10], [690, 245, 11, 8], [780, 160, 10, 7], [760, 260, 14, 9], [560, 270, 9, 6]];
  for (const [x, y, rx, ry] of holes) {
    tex += `<ellipse cx="${x}" cy="${y - 1.5}" rx="${rx + 2}" ry="${ry + 1.5}" fill="#e1d6c3" opacity="0.45"/>`;
    tex += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${rg([[0, '#231d18'], [0.7, '#3c342c'], [1, '#5b5147', 0.4]])}"/>`;
  }
  cliffG += `<g clip-path="${clip(cliffShape)}">${tex}</g>`;

  // 五大堂（懸造り）
  let hall = '';
  for (let x = 580; x <= 702; x += 11) {
    hall += `<line x1="${x}" y1="101" x2="${x}" y2="${f(rockY(x) + 6)}" stroke="#3e2a20" stroke-width="2.6"/>`;
  }
  for (const by of [116, 132, 150]) {
    const xs = [];
    for (let x = 580; x <= 702; x += 11) if (rockY(x) > by + 3) xs.push(x);
    if (xs.length > 1) hall += `<line x1="${xs[0]}" y1="${by}" x2="${xs[xs.length - 1]}" y2="${by}" stroke="#4a3226" stroke-width="2"/>`;
  }
  hall += `<path d="M580 116 L602 132 M602 116 L580 132 M591 132 L613 150 M613 132 L591 150" stroke="#4a3226" stroke-width="1.2"/>`;
  hall += `<rect x="574" y="97" width="134" height="5.5" fill="#3a271d"/>`;
  hall += `<rect x="576" y="86" width="130" height="1.8" fill="#5a3b2a"/>`;
  for (let x = 578; x <= 706; x += 8) hall += `<line x1="${x}" y1="86" x2="${x}" y2="97" stroke="#5a3b2a" stroke-width="1.1"/>`;
  hall += `<rect x="588" y="64" width="106" height="33" fill="${lg([[0, '#8e6045'], [1, '#5f3c2b']], 0, 0, 1, 0)}"/>`;
  for (let i = 0; i < 5; i++) {
    const x = 592 + i * 20.5;
    hall += `<rect x="${f(x)}" y="68" width="16" height="22" fill="${lg([[0, '#2a1d17'], [1, '#4d3428']])}"/>`;
    hall += `<rect x="${f(x - 3)}" y="64" width="3" height="33" fill="#3d281d"/>`;
  }
  hall += `<rect x="586" y="64" width="110" height="3" fill="#3a271d"/>`;
  hall += jroof(590, 692, 66, 42, 16, '#4a4440');
  // 納経堂（小さな朱塗りの堂）
  hall += `<rect x="772" y="80" width="26" height="17" fill="${lg([[0, '#c2543a'], [1, '#8a3424']], 0, 0, 1, 0)}"/>`;
  hall += `<rect x="780" y="84" width="10" height="13" fill="#3a2019"/>`;
  hall += jroof(772, 798, 81, 68, 6, '#4a4440');
  cliffG += hall;
  // 崖の紅葉・松
  const cliffTrees = [
    [538, 236, 30, 46, MAPLE], [566, 214, 22, 30, PINE], [622, 150, 20, 26, MAPLE_Y], [716, 116, 26, 30, MAPLE], [744, 112, 18, 22, PINE],
    [808, 120, 34, 40, MAPLE_Y], [770, 236, 40, 50, MAPLE], [700, 300, 54, 56, MAPLE_Y], [606, 318, 56, 60, MAPLE], [812, 300, 40, 60, PINE],
    [660, 228, 24, 30, PINE], [740, 176, 22, 26, MAPLE],
  ];
  for (const [x, y, w, h, pal] of cliffTrees) cliffG += leafTree(r, x, y, h, w, pal, '#4a3a2e', 1.1);
  s += `<g transform="translate(-185,0)">${cliffG}</g>`;
  s += mist(270, 360, FOG, 0.45);

  // ---- 杉木立と石段（透視） ----
  const cam = 1.6, F = 320, hz = 200, cx = 230, D = 0.36, Hs = 0.2, d0 = 3.3, N = 36, HW = 1.5;
  const off = (d) => 0.9 * Math.sin((d - 3) / 4.5) - 0.3;
  const PX = (X, d) => cx + (F * (X + off(d))) / d;
  const PY = (h, d) => hz - (F * (h - cam)) / d;
  const hAt = (d) => ((d - d0) / D) * Hs;
  const fogT = (d) => Math.min(0.78, Math.max(0, (d - 4) / 15));
  const yFar = PY(hAt(d0 + N * D), d0 + N * D);

  // 奥の杉林（霧の中）
  for (let i = 0; i < 26; i++) {
    const x = -10 + r() * 340, base = yFar + 6 + r() * 26, h = 90 + r() * 110;
    const c = mix('#55684f', FOG, 0.55 + r() * 0.2);
    s += sugi(r, x, base, h, 20 + r() * 16, lt(c, 0.06), dk(c, 0.06), mix('#6b5244', FOG, 0.6));
  }
  s += mist(yFar - 70, yFar + 40, FOG, 0.7);

  // 斜面の林床
  s += poly([[-10, 345], [-10, yFar], [330, yFar], [362, 140], [398, 240], [430, 345]], lg([[0, '#9a9a82'], [0.25, '#6f7556'], [1, '#2f3a26']]));
  // 崖手前の杉
  for (const [x, base, h, w] of [[338, 160, 120, 22], [372, 300, 150, 30]]) {
    const c = mix('#3f5540', FOG, 0.35 - (base - 150) / 700);
    s += sugi(r, x, base, h, w, lt(c, 0.1), dk(c, 0.2), '#4f3a2c');
  }
  // 林床の下草・落葉
  for (let i = 0; i < 160; i++) {
    const d = d0 + r() * (N * D), X = (r() < 0.5 ? -1 : 1) * (1.7 + r() * 9);
    const x = PX(X, d), y = PY(hAt(d), d), sc = 6 / d;
    if (x < -10 || x > 420) continue;
    const t = fogT(d);
    if (r() < 0.65) {
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(7 * sc)}" ry="${f(3.2 * sc)}" fill="${mix(['#3d5233', '#4f6a3e', '#2f4228'][Math.floor(r() * 3)], FOG, t)}"/>`;
    } else {
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(2.2 * sc)}" ry="${f(1 * sc)}" fill="${mix(['#b8562a', '#d08a2e', '#9a3a20'][Math.floor(r() * 3)], FOG, t)}"/>`;
    }
  }

  // 石段
  let st = '';
  const STONE = ['#b9ae9c', '#a99f8e', '#c4b8a4', '#9f9584', '#b2a796'];
  for (let i = N - 1; i >= 0; i--) {
    const di = d0 + i * D, t = fogT(di);
    const ht = (i + 1) * Hs;
    const yF = PY(ht, di), yB = PY(ht, di + D);
    if (yB < yF - 0.3) {
      st += poly([[PX(-HW, di), yF], [PX(HW, di), yF], [PX(HW, di + D), yB], [PX(-HW, di + D), yB]], mix('#cfc5b3', FOG, t));
      const nl = Math.floor(r() * 3);
      for (let k = 0; k < nl; k++) {
        const X = -HW + 0.2 + r() * (2 * HW - 0.4);
        st += `<ellipse cx="${f(PX(X, di + D * 0.5))}" cy="${f((yF + yB) / 2)}" rx="${f(5.5 / di)}" ry="${f(2.2 / di)}" fill="${mix(['#b8502a', '#d48a2e', '#a3301c'][Math.floor(r() * 3)], FOG, t)}"/>`;
      }
    }
    const yT = PY(ht, di), yBt = PY(i * Hs, di), xl = PX(-HW, di), xr = PX(HW, di);
    let x = xl;
    const nb = 2 + Math.floor(r() * 3);
    for (let k = 0; k < nb; k++) {
      const w = k === nb - 1 ? xr - x : ((xr - xl) / nb) * (0.75 + r() * 0.5);
      const c = mix(STONE[Math.floor(r() * STONE.length)], FOG, t);
      st += `<rect x="${f(x)}" y="${f(yT)}" width="${f(Math.max(0.5, w))}" height="${f(yBt - yT)}" fill="${lg([[0, lt(c, 0.06)], [1, dk(c, 0.18)]])}" stroke="${mix('#6a6255', FOG, t)}" stroke-width="${f(Math.max(0.3, 2.2 / di))}"/>`;
      x += w;
    }
    st += `<rect x="${f(xl)}" y="${f(yT)}" width="${f(xr - xl)}" height="${f(Math.max(0.4, 2.6 / di))}" fill="${mix('#e4dccd', FOG, t)}"/>`;
    if (r() < 0.6) st += `<ellipse cx="${f(xl + (xr - xl) * r())}" cy="${f(yBt - 1)}" rx="${f(10 / di)}" ry="${f(2 / di)}" fill="${mix('#5f7a46', FOG, t)}" opacity="0.8"/>`;
    // 石段脇の縁石
    for (const sd of [-1, 1]) {
      const X = sd * (HW + 0.18);
      st += `<rect x="${f(PX(X, di) - (F * 0.18) / di)}" y="${f(PY(ht + 0.12, di))}" width="${f((F * 0.36) / di)}" height="${f(PY(i * Hs - 0.05, di) - PY(ht + 0.12, di))}" fill="${mix('#7f786a', FOG, t)}"/>`;
    }
  }
  s += st;
  s += mist(yFar - 40, yFar + 60, '#f3ecdf', 0.8);

  // 人物（3名・後ろ姿で登る）
  const ppl = [[17, -0.1, '#3f7a55', '#5a5045', '#d8cbb0'], [10, 0.5, '#3a5f8f', '#33373d', '#2f3338'], [3, -0.45, '#b8432f', '#3b3f46', '#c9b48a']];
  for (const [i, X, jac, pack, hat] of ppl) {
    const d = d0 + i * D + D * 0.55;
    const t = fogT(d) * 0.8;
    const fig = backFigure(PX(X, d), PY((i + 1) * Hs, d), (F * 1.7) / d, { jacket: mix(jac, FOG, t), pack: mix(pack, FOG, t), pants: mix('#3a3f4a', FOG, t), hat: mix(hat, FOG, t), pose: i % 2 ? 'climb' : 'climb' });
    s += fig;
  }

  // 杉の大木の幹
  const trunks = [[2.4, 4.0, 0.95], [-2.7, 5.2, 0.9], [-2.3, 8.4, 0.85], [2.2, 7.6, 0.85], [2.6, 10.8, 0.8], [-3.1, 11.8, 0.8], [1.9, 13.8, 0.7], [-2.1, 14.6, 0.7], [-6.5, 7.0, 1.0], [-4.6, 3.5, 1.1], [5.2, 9.5, 0.9]];
  trunks.sort((a, b) => b[1] - a[1]);
  for (const [X, d, wm] of trunks) {
    const x = PX(X, d), base = PY(hAt(d), d) + 3, w = (F * wm) / d, t = fogT(d);
    if (x > 330) continue;
    const cL = mix('#8e5c40', FOG, t), cD = mix('#36231a', FOG, t);
    s += `<path d="M${f(x - w * 0.5)} -5 L${f(x - w * 0.5)} ${f(base - w * 0.6)} Q${f(x - w * 0.62)} ${f(base - w * 0.1)} ${f(x - w * 0.95)} ${f(base)} L${f(x + w * 0.95)} ${f(base)} Q${f(x + w * 0.62)} ${f(base - w * 0.1)} ${f(x + w * 0.5)} ${f(base - w * 0.6)} L${f(x + w * 0.5)} -5 Z" fill="${lg([[0, cL], [0.45, mix(cL, cD, 0.45)], [1, cD]], 0, 0, 1, 0)}"/>`;
    for (let k = 0; k < Math.max(3, w / 4); k++) {
      const bx = x - w * 0.42 + r() * w * 0.84;
      s += `<path d="M${f(bx)} -5 Q${f(bx + (r() - 0.5) * 3)} ${f(base * 0.5)} ${f(bx + (r() - 0.5) * 4)} ${f(base - 2)}" stroke="${r() < 0.5 ? dk(cD, 0.2) : lt(cL, 0.15)}" stroke-width="${f(Math.max(0.5, w * 0.05))}" fill="none" opacity="0.45"/>`;
    }
  }
  // 手前の下草（クマザサ）
  for (const [cx0, cy0, n] of [[30, 330, 26], [390, 330, 18], [130, 336, 14]]) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2, l = 18 + r() * 26;
      const x1 = cx0 + (r() - 0.5) * 50, y1 = cy0;
      const x2 = x1 + Math.cos(a) * l, y2 = y1 + Math.sin(a) * l;
      s += `<path d="M${f(x1)} ${f(y1)} Q${f((x1 + x2) / 2 + 4)} ${f((y1 + y2) / 2)} ${f(x2)} ${f(y2)}" stroke="${['#2e4428', '#3f5a33', '#557043'][Math.floor(r() * 3)]}" stroke-width="${f(2 + r() * 2.5)}" stroke-linecap="round" fill="none"/>`;
    }
  }
  // 林冠
  let can = '';
  for (let i = 0; i < 70; i++) {
    const x = -10 + r() * 400, y = -10 + r() * 50 * (1 - x / 560);
    can += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(14 + r() * 26)}" ry="${f(8 + r() * 14)}" fill="${['#1f2d22', '#2a3b2c', '#34483a', '#4a6250'][Math.floor(r() * 4)]}"/>`;
  }
  s += can;
  // 木漏れ日の光芒
  for (const [x0, x1, b0, b1, op] of [[330, 370, 90, 200, 0.32], [380, 400, 230, 290, 0.22], [280, 310, 10, 80, 0.18]]) {
    s += `<polygon points="${x0},0 ${x1},0 ${b1},330 ${b0},330" fill="${lg([[0, '#fff6dc', op], [1, '#fff6dc', 0]])}"/>`;
  }
  s += soft(370, 40, 70, 40, 0.5, '#fff4d8');
  return s;
}

module.exports = { meta, render };
