// ごほうびの一皿（円形ビネット内、中心(0,0)・半径100）
const L = require('./lib');
const { f, mix, dk, lt, lg, rg, clip, poly, soft } = L;

function table(r, c1, c2, grain) {
  let s = `<rect x="-110" y="-110" width="220" height="220" fill="${lg([[0, c1], [1, c2]], 0, 0, 0.3, 1)}"/>`;
  for (let i = 0; i < 26; i++) {
    const y = -110 + i * 8.5 + r() * 4;
    s += `<path d="M-110 ${f(y)} C-50 ${f(y + (r() - 0.5) * 8)} 30 ${f(y + (r() - 0.5) * 8)} 110 ${f(y + (r() - 0.5) * 6)}" stroke="${r() < 0.6 ? grain : lt(c1, 0.12)}" stroke-width="${f(0.5 + r() * 1.4)}" fill="none" opacity="${f(0.25 + r() * 0.25)}"/>`;
  }
  return s;
}
const vignette = () => `<circle cx="0" cy="0" r="104" fill="${rg([[0, '#000', 0], [0.68, '#000', 0], [1, '#000', 0.45]])}"/>`;

// ビールグラス（泡・結露）
function beer(r, x, by, h, w) {
  const top = by - h, wt = w / 2, wb = w * 0.42;
  let s = `<ellipse cx="${f(x + 6)}" cy="${f(by + 2)}" rx="${f(wt * 1.4)}" ry="${f(w * 0.16)}" fill="#000" opacity="0.35"/>`;
  s += `<ellipse cx="${f(x + wt * 0.9)}" cy="${f(by + 3)}" rx="${f(wt * 0.9)}" ry="${f(w * 0.1)}" fill="#f2b43c" opacity="0.25"/>`;
  const body = `M${f(x - wt)} ${f(top + h * 0.17)} L${f(x - wb)} ${f(by - 3)} Q${f(x)} ${f(by + 3)} ${f(x + wb)} ${f(by - 3)} L${f(x + wt)} ${f(top + h * 0.17)} Z`;
  s += `<path d="${body}" fill="${lg([[0, '#9a5814'], [0.22, '#e3a133'], [0.5, '#f7cd5c'], [0.78, '#d88c26'], [1, '#86480f']], 0, 0, 1, 0)}"/>`;
  for (let i = 0; i < 26; i++) {
    const yy = top + h * 0.2 + r() * h * 0.75, xx = x + (r() - 0.5) * w * 0.7;
    s += `<circle cx="${f(xx)}" cy="${f(yy)}" r="${f(0.4 + r() * 0.7)}" fill="#fff6d0" opacity="0.6"/>`;
  }
  // 泡
  const fy = top + h * 0.19;
  let foam = `M${f(x - wt - 1)} ${f(fy)}`;
  const nb = 7;
  for (let i = 0; i <= nb; i++) {
    const xx = x - wt - 1 + ((w + 2) * i) / nb;
    foam += ` Q${f(xx - w / nb / 2)} ${f(top - 4 - r() * 5)} ${f(xx)} ${f(top + 1 - r() * 2)}`;
  }
  foam += ` L${f(x + wt + 1)} ${f(fy)} Z`;
  s += `<path d="${foam}" fill="${lg([[0, '#fffef8'], [0.7, '#f6eedb'], [1, '#e7d9b8']])}"/>`;
  for (let i = 0; i < 18; i++) s += `<circle cx="${f(x + (r() - 0.5) * w * 0.9)}" cy="${f(top + r() * h * 0.16)}" r="${f(0.6 + r() * 1.3)}" fill="none" stroke="#dccfae" stroke-width="0.5" opacity="0.8"/>`;
  s += `<path d="M${f(x - wt)} ${f(fy)} Q${f(x)} ${f(fy + 3)} ${f(x + wt)} ${f(fy)}" stroke="#d9b45a" stroke-width="1.2" fill="none" opacity="0.6"/>`;
  // グラスの反射・結露
  s += `<path d="M${f(x - wt + 3)} ${f(top + h * 0.22)} L${f(x - wb + 3)} ${f(by - 8)}" stroke="#ffffff" stroke-width="${f(w * 0.09)}" stroke-linecap="round" opacity="0.4"/>`;
  s += `<path d="M${f(x + wt - 4)} ${f(top + h * 0.25)} L${f(x + wb - 3)} ${f(by - 10)}" stroke="#ffffff" stroke-width="1.2" opacity="0.35"/>`;
  for (let i = 0; i < 46; i++) {
    const yy = top + h * 0.24 + r() * h * 0.72, k = (yy - top) / h;
    const half = wt - (wt - wb) * k;
    const xx = x + (r() * 2 - 1) * half * 0.92;
    const rd = 0.6 + r() * 1.3;
    s += `<ellipse cx="${f(xx)}" cy="${f(yy)}" rx="${f(rd * 0.8)}" ry="${f(rd)}" fill="#fff4d8" opacity="0.5"/><circle cx="${f(xx - rd * 0.25)}" cy="${f(yy - rd * 0.35)}" r="${f(rd * 0.3)}" fill="#ffffff" opacity="0.85"/>`;
  }
  for (let i = 0; i < 3; i++) {
    const xx = x - wt * 0.5 + r() * wt;
    s += `<path d="M${f(xx)} ${f(top + h * 0.35 + r() * 10)} q1 ${f(h * 0.2)} 0 ${f(h * 0.38)}" stroke="#fff6dc" stroke-width="1.4" opacity="0.45" fill="none" stroke-linecap="round"/>`;
  }
  s += `<path d="M${f(x - wb)} ${f(by - 3)} Q${f(x)} ${f(by + 3)} ${f(x + wb)} ${f(by - 3)}" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.45"/>`;
  return s;
}

function sobaReward() {
  const r = L.rng(5);
  let s = table(r, '#5a3b27', '#2e1e14', '#24170e');
  // 板（せいろ板）
  const BL = [-100, -26], BR = [36, -42], FR = [56, 34], FL = [-82, 54];
  const dn = (p, d) => [p[0], p[1] + d];
  s += poly([dn(BL, 10), dn(BR, 10), dn(FR, 14), dn(FL, 14)].map((p) => [p[0] + 6, p[1] + 4]), '#000', 'opacity="0.38"');
  s += poly([FL, FR, dn(FR, 8), dn(FL, 8)], '#a77a48');
  s += poly([BR, FR, dn(FR, 8), dn(BR, 8)], '#8a6136');
  s += poly([BL, BR, FR, FL], lg([[0, '#e6c899'], [1, '#c39a63']], 0, 0, 1, 1));
  const top = `<polygon points="${L.pts([BL, BR, FR, FL])}"/>`;
  let gr = '';
  for (let i = 0; i < 18; i++) {
    const t = i / 18 + r() * 0.03;
    const a = [BL[0] + (FL[0] - BL[0]) * t, BL[1] + (FL[1] - BL[1]) * t], b = [BR[0] + (FR[0] - BR[0]) * t, BR[1] + (FR[1] - BR[1]) * t];
    gr += `<path d="M${f(a[0])} ${f(a[1])} Q${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2 + (r() - 0.5) * 4)} ${f(b[0])} ${f(b[1])}" stroke="#a87c4a" stroke-width="${f(0.4 + r() * 0.8)}" fill="none" opacity="0.5"/>`;
  }
  s += `<g clip-path="${clip(top)}">${gr}</g>`;
  // そば（細い麺線を多数）
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const m = (u, v) => lerp(lerp(BL, BR, u), lerp(FL, FR, u), v);
  const mound = [m(0.08, 0.14), m(0.5, 0.06), m(0.92, 0.14), m(0.95, 0.5), m(0.9, 0.86), m(0.5, 0.94), m(0.08, 0.86), m(0.04, 0.5)];
  let md = `M${f(mound[0][0])} ${f(mound[0][1])}`;
  for (let i = 1; i <= mound.length; i++) {
    const p = mound[i % mound.length], q = mound[(i + 1) % mound.length];
    md += ` Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
  }
  md += ' Z';
  s += `<path d="${md}" transform="translate(3,4)" fill="#000" opacity="0.25"/>`;
  s += `<path d="${md}" fill="${lg([[0, '#8d8371'], [1, '#5c5345']], 0, 0, 0.6, 1)}"/>`;
  let nd = '';
  const NC = ['#6f6453', '#8a7e6b', '#a09480', '#5a5043', '#b3a791', '#7d715f', '#3f382f'];
  for (let i = 0; i < 120; i++) {
    const v = 0.06 + r() * 0.9, w0 = r() * 0.15, w1 = 0.85 + r() * 0.15;
    const p0 = m(w0, v), p1 = m(w1, v + (r() - 0.5) * 0.1);
    const c1 = m((w0 + w1) * 0.35, v + (r() - 0.5) * 0.12), c2 = m((w0 + w1) * 0.7, v + (r() - 0.5) * 0.12);
    nd += `<path d="M${f(p0[0])} ${f(p0[1])} C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p1[0])} ${f(p1[1])}" stroke="${NC[Math.floor(r() * NC.length)]}" stroke-width="${f(1.1 + r() * 1.1)}" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 70; i++) {
    const v = 0.08 + r() * 0.6, w0 = 0.1 + r() * 0.3, w1 = w0 + 0.2 + r() * 0.4;
    const p0 = m(w0, v), p1 = m(w1, v + (r() - 0.5) * 0.06), c = m((w0 + w1) / 2, v + (r() - 0.5) * 0.08);
    nd += `<path d="M${f(p0[0])} ${f(p0[1])} Q${f(c[0])} ${f(c[1])} ${f(p1[0])} ${f(p1[1])}" stroke="#e6decd" stroke-width="0.7" fill="none" opacity="0.75"/>`;
  }
  for (let i = 0; i < 40; i++) {
    const p = m(0.1 + r() * 0.8, 0.1 + r() * 0.8);
    nd += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="0.5" fill="#2d2620" opacity="0.7"/>`;
  }
  nd += `<path d="${md}" fill="${lg([[0, '#ffffff', 0.18], [0.5, '#ffffff', 0], [1, '#000000', 0.22]], 0, 0, 0.7, 1)}"/>`;
  s += `<g clip-path="${clip(`<path d="${md}"/>`)}">${nd}</g>`;
  s += beer(r, 76, 68, 132, 40);
  s += vignette();
  return s;
}

function pizzaReward() {
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

function wineReward() {
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

function beefReward() {
  const r = L.rng(33);
  let s = table(r, '#2e2420', '#151110', '#0c0908');
  const cx = -10, cy = 14;
  s += `<ellipse cx="${cx + 6}" cy="${cy + 10}" rx="98" ry="72" fill="#000" opacity="0.4"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="96" ry="70" fill="${lg([[0, '#6a6460'], [0.5, '#3a3532'], [1, '#1d1a18']], 0, 0, 1, 1)}"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="86" ry="61" fill="${rg([[0, '#ffb54a'], [0.45, '#e25a1c'], [0.85, '#5a1a08'], [1, '#2a0d05']])}"/>`;
  for (let i = 0; i < 40; i++) s += `<circle cx="${f(cx + (r() - 0.5) * 150)}" cy="${f(cy + (r() - 0.5) * 100)}" r="${f(1 + r() * 2.5)}" fill="${r() < 0.5 ? '#ffd27a' : '#3a1206'}" opacity="0.5"/>`;
  const inner = `<ellipse cx="${cx}" cy="${cy}" rx="86" ry="61"/>`;
  let bars = '';
  for (let x = cx - 90; x < cx + 90; x += 8.5) {
    bars += `<line x1="${f(x)}" y1="${cy - 70}" x2="${f(x + 18)}" y2="${cy + 70}" stroke="#1e1b1a" stroke-width="3.4"/>`;
    bars += `<line x1="${f(x - 1)}" y1="${cy - 70}" x2="${f(x + 17)}" y2="${cy + 70}" stroke="#8c8580" stroke-width="0.7" opacity="0.6"/>`;
  }
  s += `<g clip-path="${clip(inner)}">${bars}</g>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="86" ry="61" fill="none" stroke="#14110f" stroke-width="3"/>`;
  // 肉（霜降り）
  function slice(x, y, rot, w, h, cooked) {
    let d = '';
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const kx = Math.cos(a), ky = Math.sin(a);
      const sq = Math.pow(Math.abs(kx), 0.5) * Math.sign(kx), sqy = Math.pow(Math.abs(ky), 0.5) * Math.sign(ky);
      d += `${i ? 'L' : 'M'}${f(sq * w / 2 * (0.94 + r() * 0.08))} ${f(sqy * h / 2 * (0.92 + r() * 0.1))} `;
    }
    d += 'Z';
    let g = `<g transform="translate(${x},${y}) rotate(${rot})">`;
    g += `<path d="${d}" fill="#000" opacity="0.35" transform="translate(2,3)"/>`;
    g += `<path d="${d}" fill="${cooked ? lg([[0, '#a85a3c'], [1, '#6c2f1e']]) : lg([[0, '#d65a5c'], [0.6, '#bb3c42'], [1, '#972a32']])}"/>`;
    let mb = '';
    const MB = cooked ? '#e2b48e' : '#f7e3de';
    for (let i = 0; i < 26; i++) {
      const x0 = (r() - 0.5) * w, y0 = (r() - 0.5) * h, l = 4 + r() * 12, a = r() * Math.PI;
      const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
      mb += `<path d="M${f(x0)} ${f(y0)} Q${f((x0 + x1) / 2 + (r() - 0.5) * 6)} ${f((y0 + y1) / 2 + (r() - 0.5) * 6)} ${f(x1)} ${f(y1)}" stroke="${MB}" stroke-width="${f(0.5 + r() * 1.3)}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
    }
    for (let i = 0; i < 10; i++) mb += `<ellipse cx="${f((r() - 0.5) * w)}" cy="${f((r() - 0.5) * h)}" rx="${f(0.8 + r() * 1.8)}" ry="${f(0.6 + r())}" fill="${MB}" opacity="0.8"/>`;
    mb += `<rect x="${-w / 2}" y="${h / 2 - h * 0.18}" width="${w}" height="${h * 0.25}" fill="${cooked ? '#d9a77a' : '#f2dcd2'}" opacity="0.85"/>`;
    if (cooked) for (let k = -2; k <= 2; k++) mb += `<line x1="${f(k * 9 - 6)}" y1="${-h / 2}" x2="${f(k * 9 + 6)}" y2="${h / 2}" stroke="#2a130b" stroke-width="3" opacity="0.8"/>`;
    mb += `<path d="M${f(-w * 0.35)} ${f(-h * 0.28)} Q0 ${f(-h * 0.4)} ${f(w * 0.3)} ${f(-h * 0.3)}" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.45" stroke-linecap="round"/>`;
    g += `<g clip-path="${clip(`<path d="${d}"/>`)}">${mb}</g>`;
    return g + '</g>';
  }
  s += slice(-44, -8, -12, 58, 34, true);
  s += slice(18, -18, 8, 60, 34, false);
  s += slice(-14, 32, -4, 62, 34, false);
  s += slice(42, 34, 14, 46, 28, true);
  // 煙
  for (let i = 0; i < 12; i++) s += soft(-30 + r() * 70, -30 - i * 7 - r() * 10, 18 + i * 2.5, 10 + i * 1.5, f(0.22 - i * 0.012), '#f2ece6');
  s += beer(r, 88, -26, 104, 32);
  s += vignette();
  return s;
}

module.exports = { sobaReward, pizzaReward, wineReward, beefReward };
