// ご褒美の共通パーツ（テーブル木目・ビネット・ビールグラス）
// 使い方: ctx.parts = require('./_parts')(ctx.L) をジェネレーターが用意する
module.exports = function parts(L) {
  const { f, lt, lg, rg } = L;

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

  return { table, vignette, beer };
};
