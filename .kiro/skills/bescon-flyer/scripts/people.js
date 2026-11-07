// 人物（頭身 約7.5、登山・ウォーク装備）
const { f, dk, lt, lg } = require('./lib');

const SKIN = '#e9bf98';
const HAIR = '#2d2522';

// 後ろ姿（山寺の石段・温泉街の通りを奥へ進む人）
function backFigure(x, y, H, o) {
  const u = H / 7.5;
  const j = o.jacket, pants = o.pants || '#3a3f4a', pack = o.pack || '#34373d';
  const climb = o.pose === 'climb';
  const P = (a, b) => `${f(a * u)} ${f(b * u)}`;
  const stroke = (d, c, w) => `<path d="${d}" stroke="${c}" stroke-width="${f(w * u)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  let s = `<ellipse cx="${f(0.1 * u)}" cy="0" rx="${f(1.5 * u)}" ry="${f(0.3 * u)}" fill="#000" opacity="0.22"/>`;
  // 脚
  const legL = `M${P(-0.42, -3.75)} Q${P(-0.5, -2)} ${P(-0.5, -0.4)}`;
  const legR = climb ? `M${P(0.42, -3.75)} Q${P(0.62, -2.5)} ${P(0.5, -1.25)}` : `M${P(0.42, -3.75)} Q${P(0.52, -2)} ${P(0.48, -0.55)}`;
  s += stroke(legR, dk(pants, 0.15), 0.78) + stroke(legL, pants, 0.8);
  s += stroke(`M${P(-0.6, -3.5)} Q${P(-0.68, -2)} ${P(-0.66, -0.6)}`, lt(pants, 0.25), 0.16);
  // 靴
  s += `<rect x="${f(-0.86 * u)}" y="${f(-0.55 * u)}" width="${f(0.74 * u)}" height="${f(0.55 * u)}" rx="${f(0.22 * u)}" fill="#4a3a2e"/>`;
  s += `<rect x="${f(-0.86 * u)}" y="${f(-0.16 * u)}" width="${f(0.74 * u)}" height="${f(0.16 * u)}" rx="${f(0.06 * u)}" fill="#231d19"/>`;
  const fy = climb ? -1.35 : -0.62;
  s += `<rect x="${f(0.14 * u)}" y="${f(fy * u)}" width="${f(0.72 * u)}" height="${f(0.5 * u)}" rx="${f(0.22 * u)}" fill="#3e3128"/>`;
  s += `<rect x="${f(0.14 * u)}" y="${f((fy + 0.36) * u)}" width="${f(0.72 * u)}" height="${f(0.15 * u)}" rx="${f(0.06 * u)}" fill="#1e1916"/>`;
  // 腕（後ろ）
  const armL = `M${P(-1.0, -5.9)} Q${P(-1.32, -4.9)} ${P(-1.22, -3.95)}`;
  const armR = climb ? `M${P(1.0, -5.9)} Q${P(1.35, -5.1)} ${P(1.3, -4.3)}` : `M${P(1.0, -5.9)} Q${P(1.3, -4.9)} ${P(1.2, -3.95)}`;
  s += stroke(armL, lt(j, 0.05), 0.52) + stroke(armR, dk(j, 0.22), 0.52);
  s += `<circle cx="${f(-1.22 * u)}" cy="${f(-3.85 * u)}" r="${f(0.21 * u)}" fill="${SKIN}"/>`;
  s += `<circle cx="${f((climb ? 1.3 : 1.2) * u)}" cy="${f((climb ? -4.2 : -3.85) * u)}" r="${f(0.21 * u)}" fill="${dk(SKIN, 0.12)}"/>`;
  // 胴（ジャケット）
  s += `<path d="M${P(-1.02, -6.05)} Q${P(-1.2, -5.85)} ${P(-1.12, -5.25)} L${P(-0.92, -3.5)} L${P(0.92, -3.5)} L${P(1.12, -5.25)} Q${P(1.2, -5.85)} ${P(1.02, -6.05)} Q${P(0, -6.38)} ${P(-1.02, -6.05)} Z" fill="${lg([[0, lt(j, 0.18)], [0.5, j], [1, dk(j, 0.3)]], 0, 0, 1, 0)}"/>`;
  s += `<rect x="${f(-0.92 * u)}" y="${f(-3.72 * u)}" width="${f(1.84 * u)}" height="${f(0.22 * u)}" fill="${dk(j, 0.25)}"/>`;
  // ザック
  s += `<rect x="${f(-0.8 * u)}" y="${f(-6.2 * u)}" width="${f(1.6 * u)}" height="${f(2.35 * u)}" rx="${f(0.38 * u)}" fill="${lg([[0, lt(pack, 0.2)], [0.6, pack], [1, dk(pack, 0.35)]], 0, 0, 1, 0)}"/>`;
  s += `<path d="M${P(-0.78, -5.7)} Q${P(0, -6.5)} ${P(0.78, -5.7)} L${P(0.78, -5.35)} L${P(-0.78, -5.35)} Z" fill="${dk(pack, 0.2)}"/>`;
  s += `<rect x="${f(-0.55 * u)}" y="${f(-4.95 * u)}" width="${f(1.1 * u)}" height="${f(0.95 * u)}" rx="${f(0.22 * u)}" fill="${dk(pack, 0.12)}"/>`;
  s += `<line x1="${f(-0.45 * u)}" y1="${f(-4.75 * u)}" x2="${f(0.45 * u)}" y2="${f(-4.75 * u)}" stroke="${lt(pack, 0.4)}" stroke-width="${f(0.06 * u)}"/>`;
  s += `<rect x="${f(-0.95 * u)}" y="${f(-4.0 * u)}" width="${f(1.9 * u)}" height="${f(0.18 * u)}" rx="${f(0.08 * u)}" fill="#222"/>`;
  // 首・頭
  s += `<rect x="${f(-0.2 * u)}" y="${f(-6.62 * u)}" width="${f(0.4 * u)}" height="${f(0.45 * u)}" fill="${dk(SKIN, 0.1)}"/>`;
  s += `<ellipse cx="${f(-0.5 * u)}" cy="${f(-6.92 * u)}" rx="${f(0.1 * u)}" ry="${f(0.17 * u)}" fill="${SKIN}"/>`;
  s += `<ellipse cx="${f(0.5 * u)}" cy="${f(-6.92 * u)}" rx="${f(0.1 * u)}" ry="${f(0.17 * u)}" fill="${dk(SKIN, 0.1)}"/>`;
  s += `<circle cx="0" cy="${f(-6.98 * u)}" r="${f(0.5 * u)}" fill="${lg([[0, lt(HAIR, 0.15)], [1, HAIR]], 0, 0, 1, 0)}"/>`;
  if (o.hat) {
    s += `<path d="M${P(-0.53, -6.95)} Q${P(-0.56, -7.62)} ${P(0, -7.65)} Q${P(0.56, -7.62)} ${P(0.53, -6.95)} Z" fill="${lg([[0, lt(o.hat, 0.15)], [1, dk(o.hat, 0.25)]], 0, 0, 1, 0)}"/>`;
    s += `<rect x="${f(-0.55 * u)}" y="${f(-7.12 * u)}" width="${f(1.1 * u)}" height="${f(0.24 * u)}" rx="${f(0.1 * u)}" fill="${dk(o.hat, 0.15)}"/>`;
  }
  return `<g transform="translate(${f(x)},${f(y)})">${s}</g>`;
}

// 横向き（右向き）。pose の角度は鉛直下向き=0、進行方向=+
const POSES = {
  walk: { lean: 5, tN: 20, kN: 6, tF: -17, kF: 24, aUN: -20, aFN: 14, aUF: 20, aFF: 26, fN: -8, fF: 22 },
  hike: { lean: 9, tN: 24, kN: 14, tF: -15, kF: 20, aUN: 28, aFN: 26, aUF: -14, aFF: 30, fN: -6, fF: 20, poles: true },
  run: { lean: 12, tN: 38, kN: 34, tF: -30, kF: 84, aUN: -42, aFN: 100, aUF: 38, aFF: 88, fN: -10, fF: 40 },
  run2: { lean: 11, tN: 12, kN: 8, tF: -10, kF: 100, aUN: 30, aFN: 92, aUF: -36, aFF: 96, fN: 0, fF: 55 },
};

function sideFigure(x, y, H, o) {
  const u = H / 7.5;
  const p = Object.assign({}, POSES[o.pose || 'walk'], o.adj || {});
  const R = (d) => (d * Math.PI) / 180;
  const v = (a, l) => [Math.sin(R(a)) * l, Math.cos(R(a)) * l];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const hip = [0, 0];
  const kN = add(hip, v(p.tN, 1.95 * u)), aN = add(kN, v(p.tN - p.kN, 1.85 * u));
  const kF = add(hip, v(p.tF, 1.95 * u)), aF = add(kF, v(p.tF - p.kF, 1.85 * u));
  const L = R(p.lean);
  const up = [Math.sin(L), -Math.cos(L)], nf = [Math.cos(L), Math.sin(L)];
  const sh = [up[0] * 2.4 * u, up[1] * 2.4 * u];
  const Q = (b, fw, upd) => [b[0] + nf[0] * fw * u + up[0] * upd * u, b[1] + nf[1] * fw * u + up[1] * upd * u];
  const eN = add(sh, v(p.aUN, 1.45 * u)), hN = add(eN, v(p.aUN + p.aFN, 1.25 * u));
  const eF = add(sh, v(p.aUF, 1.45 * u)), hF = add(eF, v(p.aUF + p.aFF, 1.25 * u));
  const ground = Math.max(aN[1], aF[1]) + 0.36 * u;
  const j = o.jacket, pants = o.pants || '#383d48', pack = o.pack;
  const S = (a) => `${f(a[0])} ${f(a[1])}`;
  const limb = (a, b, c, col, w1, w2) =>
    `<path d="M${S(a)} L${S(b)}" stroke="${col}" stroke-width="${f(w1 * u)}" stroke-linecap="round"/><path d="M${S(b)} L${S(c)}" stroke="${col}" stroke-width="${f(w2 * u)}" stroke-linecap="round"/>`;
  const boot = (a, rot, col) => `<g transform="translate(${S(a)}) rotate(${rot})"><path d="M${f(-0.32 * u)} ${f(-0.3 * u)} L${f(0.22 * u)} ${f(-0.32 * u)} Q${f(0.55 * u)} ${f(-0.12 * u)} ${f(0.9 * u)} ${f(0.02 * u)} L${f(0.9 * u)} ${f(0.3 * u)} L${f(-0.36 * u)} ${f(0.3 * u)} Z" fill="${col}"/><rect x="${f(-0.36 * u)}" y="${f(0.2 * u)}" width="${f(1.26 * u)}" height="${f(0.13 * u)}" fill="#1b1714"/></g>`;
  let s = '';
  // 腕（奥）・脚（奥）
  s += limb(sh, eF, hF, dk(j, 0.3), 0.5, 0.44) + `<circle cx="${f(hF[0])}" cy="${f(hF[1])}" r="${f(0.2 * u)}" fill="${dk(SKIN, 0.18)}"/>`;
  if (p.poles) s += `<line x1="${f(hF[0])}" y1="${f(hF[1])}" x2="${f(hF[0] - 0.5 * u)}" y2="${f(ground)}" stroke="#5a5f66" stroke-width="${f(0.08 * u)}"/>`;
  s += limb(hip, kF, aF, dk(pants, 0.3), 0.8, 0.62) + boot(aF, p.fF, '#3a2e26');
  // ザック
  if (pack) {
    s += `<path d="M${S(Q(sh, -0.45, 0.05))} L${S(Q(sh, -1.3, -0.1))} Q${S(Q(sh, -1.65, -1.1))} ${S(Q(hip, -1.38, 0.62))} L${S(Q(hip, -0.5, 0.5))} Z" fill="${lg([[0, lt(pack, 0.2)], [1, dk(pack, 0.3)]])}"/>`;
    s += `<path d="M${S(Q(sh, -1.25, -0.05))} Q${S(Q(sh, -1.0, 0.35))} ${S(Q(sh, -0.4, 0.15))}" stroke="${dk(pack, 0.3)}" stroke-width="${f(0.3 * u)}" fill="none" stroke-linecap="round"/>`;
  }
  // 胴
  const torso = `M${S(Q(hip, -0.58, -0.45))} L${S(Q(hip, -0.62, 0.1))} L${S(Q(sh, -0.72, -0.5))} Q${S(Q(sh, -0.62, 0.25))} ${S(Q(sh, -0.3, 0.14))} L${S(Q(sh, 0.32, 0.14))} Q${S(Q(sh, 0.7, 0.05))} ${S(Q(sh, 0.62, -0.38))} L${S(Q(hip, 0.56, 0.4))} L${S(Q(hip, 0.55, -0.45))} Z`;
  s += `<path d="${torso}" fill="${lg([[0, lt(j, 0.16)], [0.6, j], [1, dk(j, 0.22)]])}"/>`;
  s += `<path d="M${S(Q(sh, 0.6, -0.2))} L${S(Q(hip, 0.52, -0.38))}" stroke="${dk(j, 0.35)}" stroke-width="${f(0.1 * u)}"/>`;
  if (pack) s += `<path d="M${S(Q(sh, -0.25, 0.1))} Q${S(Q(sh, 0.5, -0.3))} ${S(Q(sh, 0.38, -1.2))}" stroke="${dk(pack, 0.25)}" stroke-width="${f(0.2 * u)}" fill="none"/>`;
  // 脚（手前）・腕（手前）
  s += limb(hip, kN, aN, pants, 0.82, 0.64) + boot(aN, p.fN, '#4a3a2e');
  s += `<path d="M${S(Q(hip, 0.2, -0.1))} L${S([kN[0] + 0.25 * u, kN[1]])}" stroke="${lt(pants, 0.2)}" stroke-width="${f(0.16 * u)}" stroke-linecap="round"/>`;
  s += limb(sh, eN, hN, j, 0.52, 0.46) + `<circle cx="${f(hN[0])}" cy="${f(hN[1])}" r="${f(0.21 * u)}" fill="${SKIN}"/>`;
  if (p.poles) s += `<line x1="${f(hN[0])}" y1="${f(hN[1])}" x2="${f(hN[0] + 0.6 * u)}" y2="${f(ground)}" stroke="#6a7078" stroke-width="${f(0.09 * u)}"/>`;
  // 首・頭
  const hc = Q(sh, 0.16, 0.86);
  s += `<path d="M${S(Q(sh, 0.06, 0.05))} L${S(Q(sh, 0.12, 0.5))}" stroke="${dk(SKIN, 0.12)}" stroke-width="${f(0.34 * u)}" stroke-linecap="round"/>`;
  s += `<circle cx="${f(hc[0])}" cy="${f(hc[1])}" r="${f(0.52 * u)}" fill="${HAIR}"/>`;
  s += `<ellipse cx="${f(hc[0] + 0.14 * u)}" cy="${f(hc[1] + 0.1 * u)}" rx="${f(0.42 * u)}" ry="${f(0.44 * u)}" fill="${lg([[0, lt(SKIN, 0.1)], [1, dk(SKIN, 0.1)]], 0, 0, 1, 1)}"/>`;
  s += `<path d="M${f(hc[0] + 0.52 * u)} ${f(hc[1] - 0.02 * u)} l${f(0.12 * u)} ${f(0.16 * u)} l${f(-0.12 * u)} ${f(0.05 * u)} Z" fill="${dk(SKIN, 0.05)}"/>`;
  s += `<ellipse cx="${f(hc[0] - 0.06 * u)}" cy="${f(hc[1] + 0.06 * u)}" rx="${f(0.1 * u)}" ry="${f(0.15 * u)}" fill="${dk(SKIN, 0.12)}"/>`;
  if (o.hat) {
    s += `<path d="M${f(hc[0] - 0.56 * u)} ${f(hc[1] - 0.02 * u)} Q${f(hc[0] - 0.56 * u)} ${f(hc[1] - 0.72 * u)} ${f(hc[0]+0.02*u)} ${f(hc[1] - 0.72 * u)} Q${f(hc[0] + 0.58 * u)} ${f(hc[1] - 0.7 * u)} ${f(hc[0] + 0.58 * u)} ${f(hc[1] - 0.12 * u)} Z" fill="${lg([[0, lt(o.hat, 0.15)], [1, dk(o.hat, 0.2)]])}"/>`;
    s += `<path d="M${f(hc[0] - 0.58 * u)} ${f(hc[1] - 0.05 * u)} L${f(hc[0] + 0.6 * u)} ${f(hc[1] - 0.16 * u)}" stroke="${dk(o.hat, 0.2)}" stroke-width="${f(0.22 * u)}" stroke-linecap="round"/>`;
  }
  if (o.cap) {
    s += `<path d="M${f(hc[0] - 0.52 * u)} ${f(hc[1] - 0.12 * u)} Q${f(hc[0] - 0.4 * u)} ${f(hc[1] - 0.66 * u)} ${f(hc[0] + 0.1 * u)} ${f(hc[1] - 0.6 * u)} Q${f(hc[0] + 0.5 * u)} ${f(hc[1] - 0.52 * u)} ${f(hc[0] + 0.52 * u)} ${f(hc[1] - 0.22 * u)} Z" fill="${o.cap}"/>`;
    s += `<path d="M${f(hc[0] + 0.4 * u)} ${f(hc[1] - 0.24 * u)} L${f(hc[0] + 0.95 * u)} ${f(hc[1] - 0.16 * u)}" stroke="${dk(o.cap, 0.2)}" stroke-width="${f(0.13 * u)}" stroke-linecap="round"/>`;
  }
  const dir = o.dir || 1;
  return `<ellipse cx="${f(x + dir * 0.2 * u)}" cy="${f(y)}" rx="${f(1.7 * u)}" ry="${f(0.28 * u)}" fill="#000" opacity="0.2"/>
    <g transform="translate(${f(x)},${f(y - ground)}) scale(${dir},1)">${s}</g>`;
}

module.exports = { backFigure, sideFigure };
