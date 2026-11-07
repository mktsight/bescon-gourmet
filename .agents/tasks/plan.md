# Implementation Plan: bescon-flyer Kiro Skill

Goal: a workspace Kiro Skill at `/Users/makotosaito/bescon/.kiro/skills/bescon-flyer` that turns minimal event info into ベスコングルメ部 flyers (SVG + 2x PNG) in exactly the design of the 4 finished flyers.

## Findings from exploration

- The existing generator `/Users/makotosaito/bescon/.agents/flyer/` (build.js, data.js, lib.js, people.js, food.js, scene_*.js) reproduces the 4 reference flyers **byte for byte**. I copied it to a temp dir and ran it: the only difference from `BCG企画_*編.svg` is `<title>BCG企画_〇〇編</title>`, inserted right after the opening `<svg ...>` tag with no newline, before `\n  <defs>`.
- `sips -s format png` is deterministic. Rendering the regenerated SVGs gives PNGs that are byte-identical (`cmp`) to all 4 `BCG企画_*編.png`, with or without `<title>`. So verification can be exact: `cmp` the SVG and the PNG.
- `people.js` is required by the scenes. It is not listed in the brief, but it is part of the library. Every scene uses the same 3 team jackets: `#b8432f` red, `#3a5f8f` blue, `#3f7a55` green.
- build.js hardcodes these values, which must come from the spec instead: `第1回`, `Vol.01`, `2026`, `11.14`, `SAT  9:30 START` (with two spaces), and the footer `幹事：部長　／　参加可否はこちらまで`. The timeline step width already scales with the item count (`(exX1-exX0)/exN`).
- The order in which gradient defs get their ids (g0, g1, …) is: scene() first, then reward(), then layout (concept pill, hero, …). Byte identity depends on keeping this order. `lib.js` keeps its defs registry `G` as module-level state, so every snippet must use the **same lib instance**. That is why snippets receive lib through `ctx` instead of calling `require` themselves.
- sips limitations (from lib.js comments plus the brief): `dy` does not render, and neither do `filter`, tspan decoration, or `font-weight="bold"` (use 600). Gradients, clipPath, pattern, opacity, and dasharray all work.
- The workspace is not a git repo. Tools: node v20.19.0 at /usr/local/bin/node (on PATH), python3 3.9.6, /usr/bin/sips. A baseline checksum of the protected files is saved in `/Users/makotosaito/bescon/.agents/tasks/task-bescon-flyer-skill/originals.sha256` (check with `cd /Users/makotosaito/bescon && shasum -a 256 -c .agents/tasks/task-bescon-flyer-skill/originals.sha256`).
- Chat history (`ベスコングルメ部-チャット履歴.md`): Japanese text inside chat code blocks shows as tofu in Kiro. Shop info was verified by web search, with a note that business hours must be confirmed. The group has 9 members.

## Kiro Skill format (researched)

Sources: [Kiro docs: Agent Skills](https://kiro.dev/docs/skills/), [Agent Skills specification](https://agentskills.io/specification), [Kiro CLI 1.24 changelog](https://kiro.dev/changelog/cli/1-24/). Content was rephrased for compliance with licensing restrictions.

- A skill is a directory containing `SKILL.md`. The file has YAML frontmatter followed by a Markdown body. Workspace skills live in `.kiro/skills/<name>/`, user skills in `~/.kiro/skills/<name>/`.
- `name` is required: 1–64 chars, lowercase a-z, 0-9 and hyphens only, no leading, trailing or double hyphen, and it must match the directory name. Here it is `bescon-flyer`.
- `description` is required: 1–1024 chars. It should say what the skill does and when to use it, and include trigger keywords. Optional fields: license, compatibility, metadata, allowed-tools.
- Only name and description are loaded at startup. Kiro activates a skill automatically when a request matches its description, or explicitly through the `/` slash command. The full body loads on activation, so the description is what drives auto-triggering. Put the literal trigger phrases in it and use imperative "use when" wording.
- Keep the body under about 500 lines. Put detail in `references/`, `scripts/` and `assets/`, referenced by relative paths one level deep. These are loaded on demand.

## Design decisions

1. **Generator in Node.js (stdlib only), not Python.** The brief prefers python3, but the 8 illustrations are procedural JS that depends on a seeded mulberry32 RNG (`Math.imul`) and on JS number-to-string formatting. A Python port would risk subtle drift across about 2,000 dense lines. Reusing the proven JS keeps output byte-identical, which is the strongest possible guarantee of "identical design". Node is available, and no npm packages are used (only `fs`, `path`, `child_process`, `node:test`).
2. **Snippet API = injected context.** Every scene/reward file is `module.exports = { meta, render(ctx) }`, where `ctx = { L, people, theme, parts }` (parts is for rewards only). Snippets never `require` lib themselves, so custom files can live anywhere (for example in /tmp) and still share the one defs registry.
3. **Library location.** Scenes go in `illustrations/scenes/<id>.js` and rewards in `illustrations/rewards/<id>.js`. A spec refers to a bare id (built in), or to a path ending in `.js` (resolved relative to the spec file; absolute paths are allowed). After user approval, new illustrations are promoted into the library so they can be reused.
4. **Spec format = JSON with English keys.** Keys that start with `_` are ignored, which gives JSON a way to carry comments (stdlib JSON has no comment syntax). User specs are saved in `<workspace>/flyer-specs/BCG企画_〇〇編.json`, so later updates only need editing and rebuilding.
5. **Derived by the generator, never by hand:** weekday (computed from the date), the 日時 row, the header year / `MM.DD` (zero-padded) / `WKD  H:MM START`, `第N回` and `Vol.NN`, kcal from `kcal_basis`, the default trail from scene meta, the footer, the `<title>`, and the file name. **Derived by the agent** (documented in references/derivation.md): romaji, catchphrase, theme pick, METs and duration, 持ち物, timeline, notes.
6. **Auto-fit only above a threshold.** Each text slot has a default size equal to today's literal value and a width limit. Text that fits is emitted unchanged, so the 4 references stay byte-identical. Text that is too wide is shrunk down to a minimum size and/or wrapped onto its allowed number of lines. If it still does not fit, the build fails with exit code 3, writes nothing, and the message names the field. Widths use the existing estimate `tw()`: full-width = 1em, characters below U+2000 = 0.6em.
7. **Safety.** The build refuses to overwrite an existing output without `--force` (exit 4), which protects the 4 originals. sips is called with `execFileSync` using an argument array, with no shell.
8. **Tests use `node:test`** (built into Node 20), in `tests/`, run with `node --test`.

## Target file tree

```
.kiro/skills/bescon-flyer/
├── SKILL.md                      # 日本語。frontmatter name/description
├── references/
│   ├── spec.md                   # JSON仕様の全フィールド（必須/任意/既定値/導出）
│   ├── derivation.md             # 導出ルール（ローマ字・キャッチコピー・色・METs表・持ち物・流れ・注記）
│   └── illustration.md           # スタイルガイド＋座標契約＋スニペットAPI
├── scripts/
│   ├── build.js                  # CLI
│   ├── spec.js                   # load / validate / derive / normalize
│   ├── fit.js                    # tw(), fitSize(), wrapLines()
│   ├── layout.js                 # renderFlyer(norm) → SVG string（旧 build() の移植）
│   ├── texts.js                  # SVG の <text> 抽出（QA/差分用）
│   ├── lib.js                    # .agents/flyer/lib.js をそのままコピー
│   └── people.js                 # .agents/flyer/people.js をそのままコピー
├── illustrations/
│   ├── scenes/{yamadera,zao,kaminoyama,ekimae}.js, _template.js
│   └── rewards/_parts.js, {soba,pizza,wine,beef}.js, _template.js
├── assets/palettes.json
├── examples/{yamadera,zao,kaminoyama,ekimae}.json, minimal-example.json
└── tests/{spec,fit,identity}.test.js
```

## Spec schema (references/spec.md must document exactly this)

| key | required | notes |
|---|---|---|
| `edition` | yes | 〇〇編. Append `編` if it is missing. |
| `round` | no (1) | Gives `第N回 ベスコングルメ部` and `Vol.NN` (2-digit). |
| `area_romaji` | yes | Uppercase ASCII, ≤ 24 chars, shown as `Vol.01 · YAMADERA`. |
| `date` | yes | `YYYY-MM-DD`. The weekday is computed from it. |
| `start` | yes | `H:MM`. |
| `subtitle` | yes | Catchphrase. |
| `theme` | yes | Palette id from assets/palettes.json, or an object `{main,dark,tint,tint2,warm,glow}`. |
| `kcal` / `kcal_basis` | one of the two | `kcal_basis: {mets, hours, activity?}` → `round(mets*60*hours*1.05/50)*50`. An explicit `kcal` wins. Integer 1–9999. |
| `overview.date` | no | `{value?, note?}`. value defaults to `YYYY年M月D日（曜）H:MM集合`. An override must contain the correct （曜）, or the build fails (exit 1). |
| `overview.place/exercise/meal/items` | yes | `{value, note?}`. The note is shown right-aligned (old `sub`). |
| `notes` | yes | 1–2 strings. A single over-long string is auto-split into 2 lines at punctuation, and the second line gets a `　` prefix. |
| `caution` | no (false) | Red ⚠ callout. |
| `timeline` | yes | 4–6 `{time, label}`. The last item is the ご褒美 step. `|` forces a line break; without it the label is auto-wrapped. |
| `illustration.scene` / `.reward` | yes | Built-in id or path to `.js`. `.trail` is optional and overrides `meta.trail`. |
| `organizer` | no (部長) | |
| `contact` | no (参加可否はこちらまで) | |
| `output_name` | no | Defaults to `BCG企画_` + edition. Also used as the `<title>`. |

Fit rules (default size → min, width limit):
- edition: 62 → 40, limit 620.
- subtitle: 19 → 15, limit 779.
- overview value: 21 → 16, limit `680 − (note ? tw(note,14.5)+20 : 0)`. A note wider than 300 is an error.
- notes: 15 → 12.5, limit 732, or 712 when caution. Both lines share one size.
- exercise timeline label: 13.5 → 11.5, limit `step − 10`, max 2 lines.
- meal label: 15 → 12.5, limit 208, max 2 lines.
- footer: 14 → 11, limit 280.
- area_romaji ≤ 24 chars.
- Wrapping prefers breaks after `・、。）／` and never starts a line with `、。）・ー`.

## Palettes (assets/palettes.json)

Each entry is `{id, name_ja, main, dark, tint, tint2, warm, glow}`. The existing 4 are copied verbatim from data.js:
- `kaki` 柿渋 (山寺)
- `ai` 藍 (蔵王ライザ)
- `budou` 葡萄 (上山)
- `tokiwa` 常磐 (山形駅前)

New entries:
- `yamabuki` 山吹: #a87a28 / #7a561a / #f3e9d6 / #ecdcbb / #cf9f45 / #f7dcae
- `seiji` 青磁: #2f7d78 / #1f5a56 / #dfeeec / #cde4e1 / #52a199 / #f5dab0
- `enji` 臙脂: #a3404e / #772c37 / #f4e3e5 / #ecd1d5 / #cc6a5f / #f6d5b2
- `sumi` 鈍色: #5b6470 / #3e4550 / #e8eaec / #d9dde2 / #7f8a97 / #f5d9b0

"Used" status is not stored. `build.js --themes [dir]` scans `<dir>/BCG企画_*.svg` for `<rect x="0" y="0" width="900" height="6" fill="#xxxxxx"/>` and prints each palette with the edition that uses it (or 未使用).

## CLI (scripts/build.js)

- `node build.js <spec.json> [--out <dir>] [--png] [--force]`
  - Writes `<out>/<output_name>.svg` (and `.png` via sips). `--out` defaults to the cwd.
  - Prints the output paths plus a derived summary: weekday, 日時 row, the kcal formula with its result, any auto-fit changes.
- `node build.js --themes [dir]` lists the palettes and which ones are used.
- `node build.js --list` lists built-in scenes and rewards with their meta.title.
- Exit codes: 0 ok, 1 spec/usage error, 3 layout overflow, 4 output exists without --force.

## Illustration contract (references/illustration.md must document)

Scene:
- Panel-local coordinates 0..820 × 0..330. The panel sits at page (40,266) and is clipped by rx 18. Draw full-bleed from −5 to 825.
- The exercise stage is x 0–480. Show the 3 members in red, blue and green jackets, using `ctx.people.sideFigure(x,y,H,{jacket,pack,hat,cap,pose:'walk'|'hike'|'run'|'run2',dir})` or `backFigure(x,y,H,{pose:'walk'|'climb'})`. A side figure is H ≈ 70–80.
- x 500–820 is covered by the hero: a glow strip, the reward medallion centered at (690,160) with outer ring r ≈ 125 (image r 118 = 100×1.18), steam at y 0–40, and the REWARD pill at y ≈ 272–294. Keep the background continuous there.
- The calorie badge covers x 246–610 below y ≈ 300, so nothing important goes there.

Trail:
- `meta.trail` is a path from near the group to the left edge of the medallion. It ends at x 560–570, y 160–225.
- It is drawn as white, stroke-width 3, dasharray `2 7`, above the scene and below the hero.

Reward:
- Local coordinates are centered on (0,0) and clipped to r 100, then scaled 1.18. Fill −110..110 completely.
- The dish sits around (−10, 12). A drink goes on the right, via `ctx.parts.beer(r,x,by,h,w)`, to suggest 乾杯. End with `ctx.parts.vignette()`.

Colors:
- Theme colors are applied by the layout only: top bar, eyebrow, title and highlight, concept pill (main→warm), icons (dark), hero glow (glow), REWARD label (dark), kcal badge, overview tags (tint/dark), note bar, timeline dots and badge (main), reward phase (tint→tint2).
- Scenes and rewards use natural fixed colors. `ctx.theme` is available but is not used by the 4 references.

Rules:
- Use `ctx.L.rng(seed)` only, never `Math.random`.
- No `<image>`, no photos, no filter, no dy.
- Use lib helpers: ridge, mist, soft, foliage, leafTree, sugi, larch, snowFir, grass, jroof, stoneWall, poly, mix/dk/lt.

## Plan

- [ ] 1. Copy the shared modules and split the illustrations into the library (FEAT-001).
      - Copy `lib.js` and `people.js` verbatim into `scripts/`.
      - Turn each `scene_*.js` into `illustrations/scenes/<id>.js`: export `{ meta: {title, season, trail}, render(ctx) }` and take L and people from ctx. Leave the body logic and module constants unchanged. Copy the `trail` value from data.js.
      - Split food.js into `illustrations/rewards/_parts.js` (`module.exports = (L) => ({ table, vignette, beer })`) and `soba/pizza/wine/beef.js` (`render(ctx)` uses `ctx.L` and `ctx.parts`).
      Files: `.kiro/skills/bescon-flyer/scripts/{lib,people}.js`, `illustrations/scenes/*.js`, `illustrations/rewards/*.js`
      Verify: `node -e` loads every module without error. Full verification is in item 3.

- [ ] 2. Implement `scripts/fit.js`, `scripts/spec.js`, `scripts/layout.js`, `scripts/build.js`, `scripts/texts.js`, `assets/palettes.json` (FEAT-001).
      - layout.js is the old `build()` copied statement by statement. It reads normalized fields instead of literals and keeps the defs registration order.
      - It emits `<title>` exactly as in the references.
      - It implements the CLI, exit codes, `--themes`, `--list` and `--png`, following the sections above.
      Files: `.kiro/skills/bescon-flyer/scripts/*.js`, `assets/palettes.json`
      Verify: `node .kiro/skills/bescon-flyer/scripts/build.js --list` and `--themes /Users/makotosaito/bescon` print the 4 built-ins and show kaki/ai/budou/tokiwa as used.

- [ ] 3. Write the 4 example specs, generated programmatically from data.js with a throwaway script in /tmp so the text is copied exactly.
      - `rows[].sub` becomes `overview.*.note`.
      - Leave out `overview.date.value` and `illustration.trail` so both are derived.
      - Use `kcal_basis` instead of kcal: 山寺 {8.0, 1.2} → 600, 蔵王 {6.0, 1.5} → 550, 上山 {3.5, 1.5} → 350, 駅前 {5.0, 1.25} → 400.
      - Add `_comment` keys.
      Then write `tests/{spec,fit,identity}.test.js` (FEAT-001).
      Files: `examples/{yamadera,zao,kaminoyama,ekimae}.json`, `tests/*.test.js`
      Verify (checklist a, part 1):
      - For each example: `node .kiro/skills/bescon-flyer/scripts/build.js .kiro/skills/bescon-flyer/examples/<x>.json --out /tmp/bescon-skill-test --png`.
      - `cmp` both the SVG and the PNG against `/Users/makotosaito/bescon/BCG企画_<編>.svg/.png`. All 8 must be identical.
      - `node scripts/texts.js` on the new and the original SVG, then `diff`: no output.
      - `node --test .kiro/skills/bescon-flyer/tests/` passes.

- [ ] 4. Auto-fit stress check (FEAT-001).
      - Write a /tmp spec with a 10-char edition, a long overview value with a note, a single long notes string, timeline labels without `|`, and 6 timeline items. Build and render it, then view the PNG with read_file: no clipping or overlap.
      - Write a deliberately impossible spec. It must exit with code 3 and write no file.
      Files: /tmp/bescon-skill-test only.
      Verify: exit codes as described, and the PNG inspected visually.

- [ ] 5. Write the docs in Japanese (FEAT-002).
      - `SKILL.md`: frontmatter plus a procedure under 500 lines.
      - `references/spec.md`, `references/derivation.md`, `references/illustration.md`.
      - `illustrations/scenes/_template.js` and `illustrations/rewards/_template.js`: minimal, valid, commented starters.
      - `examples/minimal-example.json`: fictional 蔵王温泉編, 2026-12-12 10:00, 集合 蔵王温泉バスターミナル, 運動 温泉街の坂道ウォーク, ご褒美 ジンギスカン. Reuse the `zao` scene and the `beef` reward, `_derived` comments on every derived field, and theme yamabuki.
      Files: as listed.
      Verify:
      - Build minimal-example.json and both templates (through a /tmp spec pointing at `_template.js`) into /tmp/bescon-skill-test and inspect the PNGs.
      - Check the SKILL.md frontmatter with `python3 -c` to confirm the name matches the directory and the description is under 1024 chars.
      - `node --test` still passes.

- [ ] 6. End-to-end test with fictional minimal input (FEAT-002, checklist b).
      Input: 編名「天童」, 2027-02-13, 10:00, 集合 天童駅, 運動「舞鶴山ハイキング」, ご褒美「天童温泉の将棋の駒そば」.
      - Follow SKILL.md literally and derive the rest: TENDO, a catchphrase, an unused theme from `--themes` (expected: yamabuki or seiji), METs 6.0 × duration giving kcal, winter 持ち物, a 5-step timeline starting at 10:00, caution:true for snow, and notes saying business hours need confirmation.
      - Write a new custom scene `/tmp/bescon-skill-test/tendo_scene.js`: winter 舞鶴山 / 天童公園, snow, snowFir, distant snowy ridges, a large 将棋の駒 monument, and 3 members hiking with poles. Write a custom reward `tendo_reward.js`: soba on a 駒-shaped wooden board plus beer.
      - Build with --png and inspect the PNG. Weekday must be SAT / （土） (2027-02-13 is a Saturday). Check no overlap or clipping, the trail ends at the medallion, and figures sit clear of the kcal badge. Fix and re-render until clean.
      Files: /tmp/bescon-skill-test only.
      Verify: build exits 0, `texts.js` output contains `2027年2月13日（土）10:00集合` and `SAT  10:00 START`, and the PNG has been visually approved.

- [ ] 7. Cleanup and protection check.
      - `rm -rf /tmp/bescon-skill-test/*`.
      - `cd /Users/makotosaito/bescon && shasum -a 256 -c .agents/tasks/task-bescon-flyer-skill/originals.sha256`: all OK.
      - Confirm that no `開催案内*.svg` or other stray files were created in the workspace root (`ls /Users/makotosaito/bescon`).
      Verify: as described.

## SKILL.md content requirements (for item 5)

Frontmatter:
```
---
name: bescon-flyer
description: ベスコングルメ部（BCG企画）の開催案内フライヤー（SVG＋2倍PNG）を、既存4枚（山寺編・蔵王ライザ編・上山編・山形駅前編）と同一デザインで作成・更新する。「ベスコングルメの資料作って」「〇〇編の開催案内」「BCG企画」「ベスコンの案内を更新」と言われたら使う。編名・開催日・集合時刻・集合場所・運動内容・ご褒美の食事だけから、キャッチコピー・テーマ色・消費カロリー・持ち物・当日の流れを導出してJSON仕様を作り、生成スクリプトで描画する。Use when asked to create or update Bescon Gourmet Club (BCG) event flyers.
---
```

Body (Japanese):
1. 概要と出力: `BCG企画_〇〇編.svg/.png` in the workspace root, with the `<title>` equal to the file name.
2. 最小入力:
   - Required: 編名, 開催日, 集合時刻, 集合場所, 運動内容, ご褒美の食事.
   - Optional: 回数 (default 1), 幹事, 連絡先文言, 持ち物, 注意事項/caution, テーマ色, タイムライン上書き, kcal上書き.
   - Ask only for the missing required items, in one message.
3. 導出するもの: a short list pointing to references/derivation.md.
   - The weekday is always computed by the generator. Never write it by hand.
   - Always show the METs × time behind the kcal value.
4. 手順:
   1. Collect the input.
   2. Web-search the shop and note that business hours need confirmation.
   3. Derive the rest.
   4. Run `--themes`.
   5. Write `flyer-specs/BCG企画_〇〇編.json`, starting from examples/.
   6. Prepare the illustration: reuse one, or create a new scene/reward from `_template.js` following references/illustration.md.
   7. `build.js --png`.
   8. Read the PNG with read_file. This visual check is **mandatory**, using the checklist: overlap, clipping, wrapping, weekday, kcal, trail, figures vs badge.
   9. Fix and re-render.
   10. Report in Japanese plain text.
5. 既存4枚の更新: copy `examples/<x>.json` into `flyer-specs/`, edit it, and rebuild with `--force` only after the user confirms.
6. ルール:
   - Never put Japanese inside chat code blocks (Kiro shows it as tofu). Show commands without Japanese, or describe them in prose.
   - Never embed photos or raster images.
   - Do not touch `旧デザイン/` or the existing flyers without `--force` and user confirmation.
   - Never use `dy`. The generator writes x/y for every line.
7. イラスト スタイルガイド (short; details in references/illustration.md):
   - Layered depth: sky and sun glow, far ridge, mist, middle ground, near ground, figures, foreground framing.
   - Atmospheric perspective: colors mix toward FOG with distance.
   - Realistic 7.5-head proportions.
   - An appetizing reward close-up: warm light, highlights, shadows, texture, and a drink.
   - Seasonal details: 晩秋 紅葉/カラマツ, 冬 雪, 春 桜, 夏 青葉.
   - Use seeded RNG.

## derivation.md content requirements

- **Romaji:** Hepburn, uppercase, long vowels dropped. Precedents: ZAO, KAMINOYAMA. Generic words are translated: 駅前 → STATION.
- **Catchphrase:** pattern 「{場所}の{対象}を{動詞て形}、整った体で{ご褒美}と乾杯」, ≤ 26 full-width chars. Precedents are the 4 subtitles; the 上山 variant uses 「ととのえた体」.
- **Theme:** run `--themes` and pick an unused palette, preferring one that matches the season or place. Default order: yamabuki → seiji → enji → sumi. Always state the reason.
- **METs table:**
  - ウォーキング 3.5
  - 坂道・速歩 4.3
  - ウォーク／ジョグ混合 5.0
  - ジョギング 7.0
  - ハイキング 6.0
  - 雪上ハイク・スノーシュー 7.0
  - 登山・石段 8.0
  - サイクリング（ゆっくり） 4.0

  hours = the active span from 運動開始 to 到達/移動. Formula: round(METs×60×h×1.05/50)×50. The 4 precedents and their bases are given in item 3.
- **持ち物 defaults by activity:**
  - 登山/石段: 滑りにくい靴・動ける服装・飲み物・防寒着
  - 高原ハイク: 防寒着・歩きやすい靴・手袋・飲み物
  - ウォーク/ジョグ: 歩きやすい靴・動ける服装・飲み物
  - Add （希望者は）入浴セット when 温泉 is included.
  - December–March: add 防寒着/手袋 and 雪道で滑りにくい靴.
- **Timeline:** start 集合・準備運動 → +15min 運動開始 → 到達/記念撮影 → 店へ移動 → ご褒美の乾杯. Precedent: 9:30/9:45/11:00/11:45/12:00. Labels are 2 lines of ≤ 9 full-width chars each, split with `|`.
- **Notes:**
  - Line 1: reservation, e.g. 「※9名・土曜昼は混雑のため店は事前予約。」
  - Line 2: an alternative or advice, and that business hours and closing days must be confirmed.
  - Set caution:true for winter, mountains or weather risk.
- The weekday is computed, never assumed.

## Gaps and assumptions

- Generator language: Node instead of Python (Decision 1).
- `MM.DD` is zero-padded for months below 10 (e.g. `02.13`), which keeps the stamp look. `Vol.NN` follows the round number.
- The minimal example reuses the existing zao/beef illustrations. A real new event would normally get its own scene.
- The e2e reward 「将棋の駒そば」 is fictional, so web search will not confirm a shop. The notes must say this needs confirmation.
