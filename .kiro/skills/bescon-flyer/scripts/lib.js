// 共通ヘルパー: 色・乱数・グラデーション登録・汎用シェイプ
// sips(CoreSVG) で確認済み: linear/radialGradient, clipPath, pattern, opacity, stroke-dasharray
// 非対応: filter, tspan の装飾, font-weight="bold"（→ 600 を使う）
const f = (v) => Math.round(v * 10) / 10;

function hx(c) { c = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16)); }
function toHex(a) { return '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
const dk = (c, t) => mix(c, '#000000', t);
const lt = (c, t) => mix(c, '#ffffff', t);

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- defs レジストリ（フライヤーごとにリセット） ----
const G = { defs: [], cache: {}, uid: 0 };
function resetDefs() { G.defs = []; G.cache = {}; G.uid = 0; }
function stopsStr(stops) {
  return stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined && op !== 1 ? ` stop-opacity="${op}"` : ''}/>`).join('');
}
function lg(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const key = 'L' + JSON.stringify([stops, x1, y1, x2, y2]);
  if (!G.cache[key]) {
    const id = 'g' + G.uid++;
    G.cache[key] = id;
    G.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsStr(stops)}</linearGradient>`);
  }
  return `url(#${G.cache[key]})`;
}
function rg(stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy) {
  const key = 'R' + JSON.stringify([stops, cx, cy, r, fx, fy]);
  if (!G.cache[key]) {
    const id = 'g' + G.uid++;
    G.cache[key] = id;
    const foc = fx !== undefined ? ` fx="${fx}" fy="${fy}"` : '';
    G.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${foc}>${stopsStr(stops)}</radialGradient>`);
  }
  return `url(#${G.cache[key]})`;
}
function clip(shape) {
  const id = 'c' + G.uid++;
  G.defs.push(`<clipPath id="${id}">${shape}</clipPath>`);
  return `url(#${id})`;
}
function pattern(key, w, h, content) {
  const k = 'P' + key;
  if (!G.cache[k]) {
    const id = 'p' + G.uid++;
    G.cache[k] = id;
    G.defs.push(`<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${content}</pattern>`);
  }
  return `url(#${G.cache[k]})`;
}

// ---- 汎用シェイプ ----
const pts = (arr) => arr.map((p) => f(p[0]) + ',' + f(p[1])).join(' ');
const poly = (arr, fill, extra = '') => `<polygon points="${pts(arr)}" fill="${fill}" ${extra}/>`;

function ridge(r, base, amp, freq, bottom = 330) {
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const b = typeof base === 'function' ? base : () => base;
  const y = (x) => b(x) - amp * (0.55 * Math.sin(x * freq + ph[0]) + 0.3 * Math.sin(x * freq * 2.3 + ph[1]) + 0.15 * Math.sin(x * freq * 5.1 + ph[2]));
  let d = `M-5 ${bottom}`;
  for (let x = -5; x <= 825; x += 5) d += ` L${x} ${f(y(x))}`;
  d += ` L825 ${bottom} Z`;
  return { d, y };
}

function mist(y0, y1, color, op) {
  return `<rect x="-5" y="${f(y0)}" width="830" height="${f(y1 - y0)}" fill="${lg([[0, color, 0], [0.5, color, op], [1, color, 0]])}"/>`;
}

function soft(cx, cy, rx, ry, op, color = '#ffffff') {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${rg([[0, color, 1], [0.55, color, 0.45], [1, color, 0]])}" opacity="${op}"/>`;
}

// 葉の塊（光は左上から）
function foliage(r, cx, cy, rx, ry, pal, n, r0, r1) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
    const t = ((x - cx) / rx) * 0.5 + ((y - cy) / ry) * 0.9 + (r() - 0.5) * 0.5;
    let c = t > 0.35 ? pal[0] : t > -0.3 ? pal[1] : pal[2];
    if (pal[3] && r() < 0.1) c = pal[3];
    items.push({ x, y, t, c, rad: r0 + (r1 - r0) * r() });
  }
  items.sort((p, q) => q.t - p.t);
  return `<ellipse cx="${f(cx)}" cy="${f(cy + ry * 0.1)}" rx="${f(rx * 0.92)}" ry="${f(ry * 0.88)}" fill="${pal[0]}"/>` +
    items.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.rad)}" fill="${p.c}"/>`).join('');
}

// 落葉樹（紅葉・銀杏など）
function leafTree(r, x, base, h, w, pal, trunk = '#5a4334', density = 1) {
  const fy = base - h * 0.62;
  const tw = Math.max(1.2, w * 0.07);
  let s = `<path d="M${f(x - tw)} ${f(base)} Q${f(x - tw * 0.6)} ${f(base - h * 0.3)} ${f(x - tw * 0.3)} ${f(fy)} L${f(x + tw * 0.3)} ${f(fy)} Q${f(x + tw * 0.6)} ${f(base - h * 0.3)} ${f(x + tw)} ${f(base)} Z" fill="${trunk}"/>`;
  s += `<path d="M${f(x)} ${f(base - h * 0.42)} L${f(x - w * 0.22)} ${f(fy - h * 0.05)} M${f(x)} ${f(base - h * 0.48)} L${f(x + w * 0.24)} ${f(fy - h * 0.02)}" stroke="${trunk}" stroke-width="${f(tw * 0.7)}" stroke-linecap="round"/>`;
  const n = Math.round(Math.min(160, Math.max(14, (w * h) / 55)) * density);
  const rr = Math.max(1.2, Math.min(7, w / 14));
  s += foliage(r, x, fy, w / 2, h * 0.38, pal, n, rr * 0.6, rr * 1.15);
  return s;
}

// 杉（暗い針葉樹・ギザギザのシルエット＋房の質感）
function sugi(r, x, base, h, w, light, dark, trunk = '#4a3326') {
  const top = base - h, n = 11;
  const L = [], R = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n, y = top + t * h * 0.84, hw = (w / 2) * Math.pow(t, 0.8);
    const j = k % 2 ? 1 : 0.68;
    L.push([x - hw * j - r() * w * 0.05, y + (k % 2 ? h * 0.025 : 0)]);
    R.push([x + hw * j + r() * w * 0.05, y + (k % 2 ? h * 0.025 : 0)]);
  }
  let s = `<rect x="${f(x - w * 0.045)}" y="${f(base - h * 0.2)}" width="${f(w * 0.09)}" height="${f(h * 0.2)}" fill="${trunk}"/>`;
  s += poly([[x, top], ...L, [x, base - h * 0.12], ...R.reverse()], lg([[0, light], [0.55, mix(light, dark, 0.55)], [1, dark]], 0, 0, 1, 0));
  const tufts = Math.round(Math.min(40, h / 4));
  for (let i = 0; i < tufts; i++) {
    const t = 0.12 + r() * 0.8, y = top + t * h * 0.84, hw = (w / 2) * Math.pow(t, 0.8) * 0.8;
    const xx = x + (r() * 2 - 1) * hw;
    const lit = xx < x - hw * 0.2;
    s += `<ellipse cx="${f(xx)}" cy="${f(y)}" rx="${f(Math.max(0.8, w * 0.07))}" ry="${f(Math.max(0.5, h * 0.012))}" fill="${lit ? lt(light, 0.12) : dk(dark, 0.18)}" opacity="0.8"/>`;
  }
  return s;
}

// カラマツ（晩秋の黄金色・まばらな枝ぶり）
function larch(r, x, base, h, w, pal, trunk = '#5b4332') {
  const top = base - h;
  let s = `<line x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(base)}" stroke="${trunk}" stroke-width="${f(Math.max(0.8, w * 0.05))}"/>`;
  const tiers = Math.max(5, Math.round(h / 12));
  const dot = Math.max(0.9, Math.min(2.8, h / 75));
  s += poly([[x, top], [x + w * 0.42, base - h * 0.1], [x - w * 0.42, base - h * 0.1]], pal[0], 'opacity="0.55"');
  for (let k = 0; k < tiers; k++) {
    const t = (k + 0.6) / tiers, y = top + t * h * 0.88, hw = (w / 2) * Math.pow(t, 0.9);
    for (const sd of [-1, 1]) {
      const ex = x + sd * hw, ey = y + hw * 0.22;
      s += `<path d="M${f(x)} ${f(y)} Q${f(x + sd * hw * 0.5)} ${f(y - hw * 0.05)} ${f(ex)} ${f(ey)}" stroke="${trunk}" stroke-width="${f(Math.max(0.5, w * 0.018))}" fill="none" opacity="0.7"/>`;
      const m = Math.max(3, Math.round(hw / (dot * 1.3)));
      for (let i = 0; i < m; i++) {
        const u = (i + r()) / m;
        const px = x + sd * hw * u, py = y + hw * 0.22 * u * u + (r() - 0.6) * dot * 2.4;
        const lit = sd < 0 || r() < 0.25;
        const c = lit ? pal[2 + (r() < 0.5 ? 0 : 1)] || pal[2] : pal[1];
        s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(dot * (0.7 + r() * 0.6))}" fill="${c}"/>`;
      }
    }
  }
  return s;
}

// 雪をかぶったモミ
function snowFir(r, x, base, h, w, dark = '#2f4a3c') {
  let s = sugi(r, x, base, h, w, lt(dark, 0.15), dk(dark, 0.25));
  const tiers = 6;
  for (let k = 0; k < tiers; k++) {
    const t = (k + 0.5) / tiers, y = base - h + t * h * 0.82, hw = (w / 2) * Math.pow(t, 0.8);
    s += `<path d="M${f(x - hw * 0.9)} ${f(y + h * 0.02)} Q${f(x)} ${f(y - h * 0.05)} ${f(x + hw * 0.6)} ${f(y + h * 0.01)}" stroke="#f2f6fa" stroke-width="${f(Math.max(0.8, h * 0.025))}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  }
  return s;
}

function grass(r, x0, x1, yfn, count, cols, hmin, hmax, wmin = 0.6, wmax = 1.3) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + r() * (x1 - x0), y = yfn(x) + r() * 4;
    const h = hmin + r() * (hmax - hmin), lean = (r() - 0.4) * h * 0.5;
    s += `<path d="M${f(x)} ${f(y)} q${f(lean * 0.3)} ${f(-h * 0.5)} ${f(lean)} ${f(-h)}" stroke="${cols[Math.floor(r() * cols.length)]}" stroke-width="${f(wmin + r() * (wmax - wmin))}" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

// 和風屋根（反りのある軒・瓦目パターン）
function jroof(xL, xR, yE, yR, o, col) {
  const w = xR - xL, inset = w * 0.2, mid = (xL + xR) / 2;
  const d = `M${f(xL - o)} ${f(yE - o * 0.45)} Q${f(mid)} ${f(yE + o * 0.3)} ${f(xR + o)} ${f(yE - o * 0.45)} Q${f(xR - inset * 0.25)} ${f(yE - (yE - yR) * 0.3)} ${f(xR - inset)} ${f(yR)} L${f(xL + inset)} ${f(yR)} Q${f(xL + inset * 0.25)} ${f(yE - (yE - yR) * 0.3)} ${f(xL - o)} ${f(yE - o * 0.45)} Z`;
  const tiles = pattern('tiles', 3, 10, `<line x1="1.5" y1="0" x2="1.5" y2="10" stroke="#ffffff" stroke-opacity="0.13" stroke-width="0.8"/>`);
  return `<path d="M${f(xL - o + 2)} ${f(yE - o * 0.45 + 1.5)} Q${f(mid)} ${f(yE + o * 0.3 + 4)} ${f(xR + o - 2)} ${f(yE - o * 0.45 + 1.5)}" stroke="#1d1a19" stroke-width="${f(Math.max(1.5, o * 0.35))}" fill="none" opacity="0.55"/>
    <path d="${d}" fill="${lg([[0, lt(col, 0.28)], [0.6, col], [1, dk(col, 0.3)]])}"/>
    <path d="${d}" fill="${tiles}"/>
    <path d="M${f(xL - o)} ${f(yE - o * 0.45)} Q${f(mid)} ${f(yE + o * 0.3)} ${f(xR + o)} ${f(yE - o * 0.45)}" stroke="${lt(col, 0.35)}" stroke-width="0.9" fill="none"/>
    <rect x="${f(xL + inset - 2)}" y="${f(yR - 2.4)}" width="${f(w - 2 * inset + 4)}" height="3.2" rx="1.2" fill="${dk(col, 0.35)}"/>`;
}

// 石垣（打込接風）
function stoneWall(r, clipShape, x0, x1, y0, y1, palette, joint = '#5e574d', rowH = [7, 11], stW = [12, 26]) {
  let s = '';
  for (let y = y0; y < y1;) {
    const h = rowH[0] + r() * (rowH[1] - rowH[0]);
    for (let x = x0 - r() * 15; x < x1;) {
      const w = stW[0] + r() * (stW[1] - stW[0]);
      s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w - 1)}" height="${f(h - 1)}" rx="1.8" fill="${palette[Math.floor(r() * palette.length)]}" stroke="${joint}" stroke-width="0.8"/>`;
      s += `<line x1="${f(x + 1.5)}" y1="${f(y + 1)}" x2="${f(x + w - 3)}" y2="${f(y + 1)}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1"/>`;
      x += w;
    }
    y += h;
  }
  return `<g clip-path="${clip(clipShape)}">${s}</g>`;
}

module.exports = { f, mix, dk, lt, rng, G, resetDefs, lg, rg, clip, pattern, pts, poly, ridge, mist, soft, foliage, leafTree, sugi, larch, snowFir, grass, jroof, stoneWall };
