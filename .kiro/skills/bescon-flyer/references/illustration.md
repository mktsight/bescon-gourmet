# イラスト リファレンス（スニペット API・座標契約・スタイルガイド）

フライヤーの中央パネルは、左に「運動シーン」、右に「ご褒美の一皿」の円形メダリオンを置く構成。シーンとご褒美はそれぞれ独立した JS ファイル（スニペット）で、ジェネレーターが呼び出して SVG 文字列を受け取る。

- 内蔵: `illustrations/scenes/{yamadera,zao,kaminoyama,ekimae}.js`、`illustrations/rewards/{soba,pizza,wine,beef}.js`
- 雛形: `illustrations/scenes/_template.js`、`illustrations/rewards/_template.js`（`_` で始まるファイルは `--list` に出ない）

## スニペット API

```js
const meta = {
  id: 'tendo',                     // 英小文字・数字・- _
  title: '天童：雪の舞鶴山…',       // --list に出る説明
  season: '冬',                    // シーンのみ
  trail: 'M430 300 Q500 280 …',    // シーンのみ。白い点線のパス（下記）
};
function render(ctx) {
  const L = ctx.L;                 // scripts/lib.js（色・乱数・グラデーション・形）
  const { sideFigure, backFigure } = ctx.people;   // scripts/people.js
  // ctx.theme  … 現在のパレット {main, dark, tint, tint2, warm, glow}
  // ctx.parts  … ご褒美用の共通パーツ {table, vignette, beer}
  return '<rect …/>…';             // SVG 要素の文字列
}
module.exports = { meta, render };
```

- **`require` しない。** lib・people・parts は必ず `ctx` から受け取る。グラデーション等の defs は1つのレジストリに登録されるので、別インスタンスを読み込むと id が壊れる。この形を守れば、ファイルはどこに置いてもよい（仕様ファイルからの相対パスで指定）。
- 描画順は シーン → ご褒美 → レイアウト。シーンとご褒美には同じ ctx が渡る。
- 戻り値はパネル（またはメダリオン）内の座標で書いた SVG 断片。

## シーンの座標（パネル 820 × 330）

パネルはページの (40, 266) に置かれ、角丸 rx 18 でクリップされる。背景は −5〜825 まで隙間なく塗る。

```
x: 0 ─────────────── 480 ── 500 ────────── 820
   │  運動ステージ      │      │  ヒーロー領域   │
   │  3人をここに描く   │      │  メダリオン     │
y: 0                            湯気 y 0–40
                                 中心 (690,160) 外枠 r≈125
                                 REWARD ラベル y≈272–294
 300 ─ ─ ─ ─ ┌ カロリーバッジ x 246–610 ┐ ─ ─
 330         └ （y 300 より下は隠れる）  ┘
```

- **運動ステージ x 0–480:** 3人のメンバーを描く。横向きの人物は高さ H ≈ 70–80。足元は y ≈ 250–295。
- **ヒーロー領域 x 500–820:** レイアウトが光の帯（glow）、白縁のメダリオン（中心 (690,160)、画像半径 118 = 100 × 1.18、外枠 r ≈ 125）、湯気（y 0–40）、REWARD ラベル（y ≈ 272–294）を重ねる。背景はここまで連続させ、重要なものは置かない。
- **カロリーバッジ x 246–610、y 300 より下:** パネル下端にバッジが重なる。人物の足や重要なモチーフをここに入れない。

## 点線（trail）

- `meta.trail`（または仕様の `illustration.trail`）は、3人の近くから**メダリオンの左端**へ向かうパス。
- 終点は x 560–570、y 160–225。
- 白・線幅3・`stroke-dasharray="2 7"` で、シーンの上・ヒーローの下に描かれる。
- 前例: 蔵王 `M450 262 Q520 250 548 215 Q560 198 568 180`。

## ご褒美の座標（メダリオン）

- 中心 (0,0) のローカル座標。半径 100 の円でクリップされ、1.18 倍してパネルの (690,160) に置かれる。
- −110〜110 の正方形を**全部塗る**（`ctx.parts.table(r, 明, 暗, 木目)` が全面のテーブルを描く）。端に隙間を作らない。
- 料理は (−10, 12) あたりを中心に大きく寄せる。
- 右側に飲み物を置いて乾杯感を出す: `ctx.parts.beer(r, x, 底のy, 高さ, 幅)`（前例 `beer(r, 76, 68, 132, 40)`、`beer(r, 88, -26, 104, 32)`）。
- 最後に `ctx.parts.vignette()`（周辺減光）で締める。

## 色

- テーマ色はレイアウトだけが使う: 上部バー、見出し、タイトルと下線、コンセプト帯（main → warm）、アイコン（dark）、ヒーローの光（glow）、REWARD ラベル（dark）、カロリーバッジ、開催概要のタグ（tint / dark）、注記帯、タイムラインの点とバッジ（main）、ご褒美帯（tint → tint2）。
- シーンとご褒美は自然な固定色で描く。`ctx.theme` は使えるが、既存4枚では使っていない。
- メンバー3人のジャケットは毎回同じ: 赤 `#b8432f`、青 `#3a5f8f`、緑 `#3f7a55`。

## sips で描画できる SVG

- 使える: linearGradient / radialGradient、clipPath、pattern、opacity、stroke-dasharray、transform。
- 使えない: `filter`（ぼかし・影）、`dy`、tspan の装飾、`font-weight="bold"`（600 を使う）。
- 禁止: `<image>`・写真・ラスター画像の埋め込み。
- 乱数は `ctx.L.rng(seed)` だけ（毎回同じ絵になる）。`Math.random` は使わない。

## 人物（ctx.people）

- `sideFigure(x, y, H, {jacket, pants?, pack?, hat?, cap?, pose, dir?, adj?})` … 右向きの全身（7.5頭身）。(x, y) は足元。
  - `pose`: `'walk'`（歩く）、`'hike'`（両手にストック）、`'run'` / `'run2'`（走る）
  - `pack` ザックの色、`hat` ニット帽の色、`cap` キャップの色、`dir: -1` で左向き、`adj` で関節角度を微調整
- `backFigure(x, y, H, {jacket, pants?, pack?, hat?, pose})` … 後ろ姿（奥へ進む人）。`pose`: `'walk'` / `'climb'`（石段）
- 前例: 蔵王は `[300, 360, 420]` の x に H 78 の `hike` を3人。

## lib ヘルパー（ctx.L）

| 関数 | 用途 |
|---|---|
| `f(v)` | 小数1桁に丸める（座標の出力に必ず使う） |
| `mix(a, b, t)` / `dk(c, t)` / `lt(c, t)` | 色の混合 / 暗く / 明るく |
| `rng(seed)` | 決定的な乱数（0〜1） |
| `lg(stops, x1, y1, x2, y2)` | 線形グラデーション（`[[offset, color, opacity?], …]`、既定は縦） → `url(#id)` |
| `rg(stops, cx, cy, r, fx, fy)` | 放射グラデーション → `url(#id)` |
| `clip(shape)` | クリップパス → `url(#id)` |
| `pattern(key, w, h, content)` | パターン → `url(#id)` |
| `pts(arr)` / `poly(arr, fill, extra)` | 点列文字列 / 多角形 |
| `ridge(r, base, amp, freq, bottom)` | 稜線（`{d, y(x)}`。base は数値か関数） |
| `mist(y0, y1, color, op)` | 横長の霧の帯 |
| `soft(cx, cy, rx, ry, op, color)` | ふんわりした光・雲・湯気 |
| `foliage(r, cx, cy, rx, ry, pal, n, r0, r1)` | 葉の塊（左上から光） |
| `leafTree(r, x, base, h, w, pal, trunk, density)` | 落葉樹（紅葉・銀杏・桜） |
| `sugi(r, x, base, h, w, light, dark, trunk)` | 杉 |
| `larch(r, x, base, h, w, pal, trunk)` | カラマツ（晩秋の黄金色） |
| `snowFir(r, x, base, h, w, dark)` | 雪をかぶったモミ |
| `grass(r, x0, x1, yfn, count, cols, hmin, hmax)` | 草 |
| `jroof(xL, xR, yE, yR, o, col)` | 反りのある和風屋根 |
| `stoneWall(r, clipShape, x0, x1, y0, y1, palette)` | 石垣 |

ご褒美用 `ctx.parts`: `table(r, c1, c2, grain)` 木目のテーブル、`beer(r, x, by, h, w)` ビール、`vignette()` 周辺減光。

## スタイルガイド

- **奥行きのレイヤー（奥から順に）:** 空のグラデーションと日差し（`rg` の円） → 遠くの稜線 → 霧（`mist`） → 中景（林・建物） → 近景の地面と道 → 3人 → 手前の木や草のフレーミング（左端に大きめの木を置くと締まる）。
- **空気遠近法:** 遠いものほど霧の色 FOG（例 `#e3eaf0`）へ `mix(c, FOG, 0.3〜0.6)` で寄せ、コントラストを下げる。
- **リアルな人物:** `sideFigure` の7.5頭身を使い、運動内容に合ったポーズ（登山・ハイクは `hike`、街歩きは `walk`、ジョグは `run`）。3人はやや間隔を空けて道の上に並べ、影を地面に落とす。
- **美味しそうなご褒美の寄り:** 料理が円の大半を占めるくらい寄る。暖色の光、白いハイライト、落ち影、質感（麺線・霜降り・焦げ目・湯気）を重ね、右に飲み物。
- **季節の描写:** 晩秋＝紅葉・カラマツ・枯れ草、冬＝雪原・雪をかぶったモミ・雪の稜線、春＝桜・若草、夏＝青葉・入道雲。
- **土地の象徴:** その場所らしいモチーフを1つ大きめに入れる（例 山寺の五大堂、蔵王のゴンドラ、上山城、霞城公園の石垣、天童の将棋の駒）。
- 新しく描いたら必ず PNG を開き、点線の終点・バッジとの干渉・メダリオンの隙間を確認する。
