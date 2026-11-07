// ご褒美の雛形（コピーして使う。詳細は references/illustration.md）
// 中心 (0,0)・半径100の円にクリップされ、1.18倍で (690,160) に置かれる。−110〜110 を全部塗ること。
// lib は ctx.L、共通パーツ（table / beer / vignette）は ctx.parts から受け取る（require しない）

const meta = {
  id: 'template',
  title: '雛形：木のテーブル・丼・ビール',
};

function render(ctx) {
  const L = ctx.L;
  const { f, lg, rg, soft } = L;
  const { table, vignette, beer } = ctx.parts;
  const r = L.rng(202); // 乱数は必ず seed 付きで

  // 1. 全面のテーブル（明るい色・暗い色・木目の色）
  let s = table(r, '#6a4630', '#34231a', '#26180f');

  // 2. 料理（中心は (−10, 12) あたり、大きく寄せる）
  const cx = -10, cy = 12;
  s += `<ellipse cx="${cx + 6}" cy="${cy + 10}" rx="78" ry="58" fill="#000" opacity="0.35"/>`; // 落ち影
  s += `<ellipse cx="${cx}" cy="${cy}" rx="76" ry="56" fill="${lg([[0, '#f4efe6'], [1, '#c9c0b0']], 0, 0, 1, 1)}"/>`; // 器
  s += `<ellipse cx="${cx}" cy="${cy - 2}" rx="62" ry="44" fill="${rg([[0, '#e8b46a'], [0.7, '#b9742f'], [1, '#7a4618']])}"/>`; // 中身
  for (let i = 0; i < 30; i++) {
    // 質感（具・照り）
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    s += `<circle cx="${f(cx + Math.cos(a) * d * 52)}" cy="${f(cy - 2 + Math.sin(a) * d * 36)}" r="${f(2 + r() * 4)}" fill="${r() < 0.5 ? '#f6d79a' : '#8a4f1f'}" opacity="0.8"/>`;
  }
  s += `<path d="M${cx - 40} ${cy - 24} Q${cx} ${cy - 40} ${cx + 36} ${cy - 26}" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/>`; // ハイライト
  for (let i = 0; i < 6; i++) s += soft(cx - 10 + r() * 30, cy - 50 - i * 8, 16 + i * 2, 9 + i, f(0.2 - i * 0.02), '#f6f1ea'); // 湯気

  // 3. 右に飲み物（乾杯）→ 4. 周辺減光で締める
  s += beer(r, 80, 66, 120, 36);
  s += vignette();
  return s;
}

module.exports = { meta, render };
