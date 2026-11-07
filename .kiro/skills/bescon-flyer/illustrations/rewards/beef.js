// ご褒美：山形牛の焼肉（網焼き）＋ビール
// 中心(0,0)・半径100の円にクリップされ、1.18倍で (690,160) に置かれる。lib は ctx.L、共通パーツは ctx.parts
const meta = {
  id: 'beef',
  title: '山形牛の焼肉（網焼き）＋ビール',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, dk, lt, lg, rg, clip, poly, soft } = L;
  const { table, vignette, beer } = ctx.parts;
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

module.exports = { meta, render };
