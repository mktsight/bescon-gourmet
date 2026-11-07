// ご褒美：山寺の板そば＋ビール
// 中心(0,0)・半径100の円にクリップされ、1.18倍で (690,160) に置かれる。lib は ctx.L、共通パーツは ctx.parts
const meta = {
  id: 'soba',
  title: '山寺の板そば＋ビール',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, clip, poly, soft } = L;
  const { table, vignette, beer } = ctx.parts;
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

module.exports = { meta, render };
