// シーンの雛形（コピーして使う。詳細は references/illustration.md）
// パネル座標 820x330。x 0–480 が運動ステージ、x 500–820 はご褒美メダリオンが重なる。
// y 300 より下の x 246–610 はカロリーバッジで隠れる。
// lib と people は ctx から受け取る（require しない：defs レジストリを共有するため）

const meta = {
  id: 'template',
  title: '雛形：空・稜線・霧・地面・歩く3人',
  season: '晩秋',
  // 白い点線：3人の先から、メダリオン左端（x 560–570, y 160–225）へ
  trail: 'M450 268 Q520 252 548 222 Q560 206 566 190',
};

function render(ctx) {
  const L = ctx.L;
  const { f, mix, lg, rg, ridge, mist, soft, grass, sugi } = L;
  const { sideFigure } = ctx.people;
  const r = L.rng(101); // 乱数は必ず seed 付きで（毎回同じ絵になる）
  const FOG = '#e6ebee'; // 遠くのものほどこの色へ寄せる（空気遠近法）

  // 1. 空と日差し
  let s = `<rect x="-5" y="-5" width="830" height="340" fill="${lg([[0, '#8fb2d2'], [0.6, '#c4d6e4'], [1, '#e8edf0']])}"/>`;
  s += `<circle cx="130" cy="40" r="190" fill="${rg([[0, '#fffaf0', 0.9], [0.45, '#fff3dc', 0.3], [1, '#fff3dc', 0]])}"/>`;

  // 2. 遠くの稜線 → 霧
  const far = ridge(r, 150, 26, 0.008);
  s += `<path d="${far.d}" fill="${mix('#6f8296', FOG, 0.55)}"/>`;
  s += mist(140, 200, FOG, 0.7);

  // 3. 中景の山と林
  const mid = ridge(r, 205, 16, 0.011);
  s += `<path d="${mid.d}" fill="${lg([[0, mix('#5d7258', FOG, 0.3)], [1, mix('#465a44', FOG, 0.2)]])}"/>`;
  for (let i = 0; i < 26; i++) {
    const x = r() * 820, b = mid.y(x) + 10 + r() * 10, h = 26 + r() * 18;
    s += sugi(r, x, b, h, h * 0.36, mix('#4f6b52', FOG, 0.35), mix('#2f4636', FOG, 0.35));
  }
  s += mist(225, 270, FOG, 0.35);

  // 4. 近景の地面と道
  const ground = ridge(r, (x) => 280 - x * 0.03, 6, 0.01);
  s += `<path d="${ground.d}" fill="${lg([[0, '#b9a46c'], [1, '#8e7a47']])}"/>`;
  s += grass(r, 0, 820, ground.y, 300, ['#cdb67c', '#a88f52', '#8c7440'], 4, 12);
  s += `<path d="M-5 ${f(ground.y(0) + 30)} Q250 ${f(ground.y(250) + 16)} 560 ${f(ground.y(560) + 2)} L560 ${f(ground.y(560) + 12)} Q250 ${f(ground.y(250) + 34)} -5 ${f(ground.y(0) + 50)} Z" fill="#cbbd9c"/>`;

  // 5. 3人（赤・青・緑のジャケット、H≈78、足元はバッジより上）
  const ppl = [[300, '#b8432f', '#3b3f46'], [360, '#3a5f8f', '#5a5045'], [420, '#3f7a55', '#33373d']];
  for (const [x, jacket, pack] of ppl) {
    s += sideFigure(x, ground.y(x) + 22, 78, { jacket, pack, hat: '#2f3338', pose: 'walk' });
  }

  // 6. 手前のフレーミング（左端の木）と光
  s += sugi(r, 50, 345, 240, 80, '#3f5a44', '#1f3226');
  s += soft(220, 330, 260, 30, 0.3, '#fffaf0');
  return s;
}

module.exports = { meta, render };
