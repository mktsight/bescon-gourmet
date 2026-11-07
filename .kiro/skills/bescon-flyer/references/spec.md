# 仕様 JSON リファレンス

`scripts/build.js` が読む JSON 仕様の全キー。実装は `scripts/spec.js`。

- 文字コードは UTF-8。JSON なのでコメントは書けないが、**キー名が `_` で始まるものは（入れ子も含めて）読み込み時に捨てられる**。`_comment`、`_input`、`_derived`、`_kcal` などに根拠やメモを残してよい。
- エラーはフィールド名付きの箇条書きで表示される。

## キー一覧

| キー | 必須 | 既定値 | 説明・制約 |
|---|---|---|---|
| `edition` | 必須 | — | 編名。末尾に「編」が無ければ自動で付く（`"天童"` → `天童編`）。タイトルの大きなアクセント |
| `round` | 任意 | `1` | 1〜99 の整数。`第N回 ベスコングルメ部` と `Vol.NN`（2桁ゼロ埋め）になる |
| `area_romaji` | 必須 | — | 大文字の半角英数字と空白 `.` `'` `&` `-` のみ、24文字以内。ヘッダー右上に `Vol.01 · TENDO` と出る |
| `date` | 必須 | — | `YYYY-MM-DD`（実在する日付）。**曜日はここから計算する** |
| `start` | 必須 | — | 集合時刻 `H:MM`（0:00〜23:59、例 `9:30`, `10:00`） |
| `subtitle` | 必須 | — | キャッチコピー（タイトル下の1行） |
| `theme` | 必須 | — | `assets/palettes.json` のパレット id（`kaki` `ai` `budou` `tokiwa` `yamabuki` `seiji` `enji` `sumi`）、または `{main, dark, tint, tint2, warm, glow}`（すべて `#rrggbb`） |
| `kcal` | どちらか必須 | — | 1〜9999 の整数（数字だけの文字列も可）。指定すると `kcal_basis` より優先 |
| `kcal_basis` | どちらか必須 | — | `{mets, hours, activity?}`。mets・hours は正の数。`round(mets × 60 × hours × 1.05 / 50) × 50` kcal |
| `overview.date` | 任意 | 導出 | `{value?, note?}`。value の既定は `YYYY年M月D日（曜）H:MM集合`（月日はゼロ埋めなし）。value を手書きした場合、正しい `（曜）` を含まないとエラー（exit 1） |
| `overview.place` | 必須 | — | 集合 `{value, note?}` |
| `overview.exercise` | 必須 | — | 運動 `{value, note?}` |
| `overview.meal` | 必須 | — | 食事 `{value, note?}` |
| `overview.items` | 必須 | — | 持ち物 `{value, note?}` |
| `notes` | 必須 | — | 1〜2個の文字列。開催概要の下の注記帯。2行目は `　`（全角空白）で始めると1行目の「※」と揃う |
| `caution` | 任意 | `false` | true で注記帯が赤くなり ⚠ が付く（冬・山・天候リスク） |
| `timeline` | 必須 | — | 4〜6個の `{time, label}`。time は `H:MM`。**最後の1つがご褒美ステップ**（右側の色付き帯に「ご褒美」バッジ付きで出る）。label の `\|` は強制改行 |
| `illustration.scene` | 必須 | — | 運動シーン。内蔵 id か `.js` パス（下記） |
| `illustration.reward` | 必須 | — | ご褒美の一皿。内蔵 id か `.js` パス |
| `illustration.trail` | 任意 | シーンの `meta.trail` | 白い点線の SVG パス（パネル座標）。シーンに meta.trail が無いときは必須 |
| `organizer` | 任意 | `部長` | フッター `幹事：部長　／　参加可否はこちらまで` |
| `contact` | 任意 | `参加可否はこちらまで` | 同上 |
| `output_name` | 任意 | `BCG企画_` + edition | 出力ファイル名（拡張子なし）と SVG の `<title>`。`/` `\` `:` を含まない・`.` で始まらない |

各 `overview.*` の `note` は行の右端に小さく右寄せで出る補足（例 `※JR仙山線「山寺駅」すぐ`）。

## ジェネレーターが導出するもの

| 出力 | 導出元 | 例（2027-02-13, 10:00, round 1） |
|---|---|---|
| 曜日 | `date`（UTC で計算） | 土 / SAT |
| 日時行 | `date` + `start` | `2027年2月13日（土）10:00集合` |
| ヘッダー年 | `date` | `2027` |
| ヘッダー日付 | `date`（ゼロ埋め） | `02.13` |
| 開始行 | 曜日 + `start`（間は半角空白2つ） | `SAT  10:00 START` |
| 回数 | `round` | `第1回 ベスコングルメ部` / `Vol.01` |
| kcal | `kcal` または `kcal_basis` | 6.0 × 60 × 1.5 × 1.05 = 567 → `550` |
| 点線 | `illustration.trail` またはシーンの `meta.trail` | |
| フッター | `organizer` / `contact` | `幹事：部長　／　参加可否はこちらまで` |
| ファイル名・`<title>` | `output_name` または `BCG企画_` + edition | `BCG企画_天童編` |

## イラストの参照方法

- **内蔵 id**（英小文字・数字・`-`・`_` のみ）→ `illustrations/scenes/<id>.js` / `illustrations/rewards/<id>.js`。一覧は `node .kiro/skills/bescon-flyer/scripts/build.js --list`（`_` で始まるファイルは一覧に出ない）。
  - シーン: `yamadera` `zao` `kaminoyama` `ekimae`
  - ご褒美: `soba` `pizza` `wine` `beef`
- **`.js` で終わるパス** → 仕様ファイルのあるディレクトリからの相対パス（絶対パスも可）。例 `"scene": "tendo_scene.js"`。
- ファイルは `module.exports = { meta, render(ctx) }` 形式（[illustration.md](illustration.md)）。

## 自動調整（はみ出し対策）

文字幅は概算（全角 = 1em、U+2000 未満の文字 = 0.6em）。**既定サイズで収まるテキストは一切変更しない**。収まらないときだけ 0.5px 刻みで縮小・改行し、それでも収まらなければ exit 3 で何も書き出さない。

| 対象 | 既定 → 最小 | 幅の上限 | 行数 |
|---|---|---|---|
| `edition` | 62 → 40px | 620 | 1 |
| `subtitle` | 19 → 15px | 779 | 1 |
| `overview.*.value` | 21 → 16px | 680 −（note があれば note 幅 + 20） | 1 |
| `overview.*.note` | 14.5px 固定 | 300（超えるとエラー） | 1 |
| `notes` | 15 → 12.5px | 732（caution 時 712） | 2個なら両方同じサイズ。1個で長ければ句読点で2行に分け、2行目に `　` を付ける。1個で短ければ帯の中央に1行 |
| 運動ステップの label | 13.5 → 11.5px | （594 − 70）÷ 運動ステップ数 − 10 | 2 |
| ご褒美ステップの label | 15 → 12.5px | 208 | 2 |
| フッター | 14 → 11px | 280 | 1 |

- 改行はまず既定サイズのまま試し、収まらなければ縮小する。
- label に `|` があればそこで改行し、自動改行はしない（各行が上限内に収まる必要がある）。
- 自動改行は `・、。）／` の直後を優先し、助詞の後、文字種の切れ目の順に選ぶ。行頭に `、。）・ー` や小書きのかな（`っゃゅょ` など）は来ない。英数字の途中では切らない。
- 実際に行った調整は描画後に `自動調整:` として表示される（例 `edition: 62px → 56px`、`timeline[0].label: 13.5px のまま、自動改行「a / b」`）。

## CLI と終了コード

```
node .kiro/skills/bescon-flyer/scripts/build.js <spec.json> [--out <dir>] [--png] [--force]
node .kiro/skills/bescon-flyer/scripts/build.js --themes [dir]
node .kiro/skills/bescon-flyer/scripts/build.js --list
node .kiro/skills/bescon-flyer/scripts/texts.js <file.svg>
```

- `--out` の既定はカレントディレクトリ（無ければ作る）。`--png` で sips による PNG も出す。
- 既存の出力（SVG、`--png` 時は PNG も）があると `--force` なしでは何も書かない。
- `--themes [dir]` は dir（既定カレント）の `BCG企画_*.svg` の上部バーの色を読み、パレットごとに「使用中: 〇〇編」か「未使用」を表示する。
- `texts.js` は SVG 内の全テキストを1行ずつ表示する（文字の確認・差分比較用）。

| 終了コード | 意味 |
|---|---|
| 0 | 成功 |
| 1 | 仕様エラー・引数エラー・sips の失敗 |
| 3 | レイアウトに収まらない（何も書き出さない。メッセージのフィールドを短くする） |
| 4 | 出力が既に存在し `--force` なし（何も書き出さない） |

## 注釈付きの例

`examples/yamadera.json`（既存の山寺編。描画すると既存ファイルとバイト単位で一致する）:

```jsonc
{
  "_comment": "…",                       // _ で始まるキーは無視される
  "edition": "山寺編",                    // タイトル（編は省略可）
  "round": 1,                             // 第1回 / Vol.01
  "area_romaji": "YAMADERA",              // Vol.01 · YAMADERA
  "date": "2026-11-14",                   // 曜日（土 / SAT）はここから計算
  "start": "9:30",                        // 日時行・SAT  9:30 START・タイムラインの起点
  "subtitle": "山寺の石段を登って、整った体で板そばと乾杯",
  "theme": "kaki",                        // 柿渋
  "kcal_basis": { "mets": 8, "hours": 1.2, "activity": "石段登山" },  // 604.8 → 600 kcal
  "overview": {                           // date は省略 → 2026年11月14日（土）9:30集合
    "place":    { "value": "山寺（立石寺）登山口", "note": "※JR仙山線「山寺駅」すぐ" },
    "exercise": { "value": "立石寺の石段 約1015段を登頂" },
    "meal":     { "value": "下山後、ふもとや本店で板そば＆乾杯" },
    "items":    { "value": "滑りにくい靴・動ける服装・飲み物・防寒着" }
  },
  "notes": [
    "※9名・土曜昼は混雑のため店は事前予約。",
    "　きつい人は途中の見晴らし台をゴールにしてもOK"   // 2行目は全角空白で字下げ
  ],
  "caution": false,
  "timeline": [                           // 4〜6個。最後がご褒美
    { "time": "9:30",  "label": "登山口に集合・|準備運動" },
    { "time": "9:45",  "label": "石段を各自の|ペースで登る" },
    { "time": "11:00", "label": "奥之院で登頂・|全員で記念撮影" },
    { "time": "11:45", "label": "下山して|ふもとや本店へ" },
    { "time": "12:00", "label": "板そばで乾杯・|次回ゴール相談" }
  ],
  "illustration": { "scene": "yamadera", "reward": "soba" }   // trail はシーンの meta.trail
}
```

（説明のため `//` コメントを付けている。実際の JSON にはコメントを書けないので `_` キーを使う。）
