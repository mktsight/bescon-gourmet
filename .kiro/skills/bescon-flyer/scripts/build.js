#!/usr/bin/env node
// ベスコングルメ部（BCG企画）開催案内フライヤー生成 CLI（Node 標準ライブラリのみ）
//
// 使い方:
//   node build.js <spec.json> [--out <dir>] [--png] [--force]
//       <dir>/<output_name>.svg（--png なら sips で 2倍 PNG も）を書き出す。--out の既定はカレント
//       既存ファイルは --force なしでは上書きしない
//   node build.js --themes [dir]   パレット一覧と、dir 内の BCG企画_*.svg での使用状況
//   node build.js --list           内蔵シーン／ご褒美イラストの一覧
//
// 終了コード: 0 成功 / 1 仕様・引数エラー / 3 レイアウトに収まらない / 4 出力が既に存在（--force なし）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { SpecError, loadSpec, loadPalettes, normalize, SK } = require('./spec');
const { renderFlyer } = require('./layout');

const USAGE = `usage:
  node build.js <spec.json> [--out <dir>] [--png] [--force]
  node build.js --themes [dir]
  node build.js --list`;

function fail(code, msg) {
  console.error(msg);
  process.exit(code);
}

function listIllustrations() {
  for (const kind of ['scenes', 'rewards']) {
    console.log(kind === 'scenes' ? '# シーン（illustrations/scenes）' : '# ご褒美（illustrations/rewards）');
    const dir = path.join(SK, 'illustrations', kind);
    for (const file of fs.readdirSync(dir).filter((n) => n.endsWith('.js') && !n.startsWith('_')).sort()) {
      const mod = require(path.join(dir, file));
      const meta = mod.meta || {};
      const id = file.replace(/\.js$/, '');
      console.log(`  ${id.padEnd(12)} ${meta.title || ''}${meta.season ? `（${meta.season}）` : ''}`);
    }
  }
}

function listThemes(dir) {
  const used = {};
  const others = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^BCG企画_.+\.svg$/.test(n)).sort() : [];
  for (const file of files) {
    const svg = fs.readFileSync(path.join(dir, file), 'utf8');
    const m = svg.match(/<rect x="0" y="0" width="900" height="6" fill="(#[0-9a-fA-F]{6})"\/>/);
    const ed = file.replace(/^BCG企画_/, '').replace(/\.svg$/, '');
    if (!m) { others.push(`${ed}（上部バーなし）`); continue; }
    const col = m[1].toLowerCase();
    (used[col] = used[col] || []).push(ed);
  }
  const pals = loadPalettes();
  console.log(`# パレット（${dir} の BCG企画_*.svg を走査）`);
  for (const p of pals) {
    const eds = used[p.main.toLowerCase()];
    console.log(`  ${p.id.padEnd(9)} ${p.name_ja}\t${p.main}  ${eds ? '使用中: ' + eds.join('、') : '未使用'}`);
    delete used[p.main.toLowerCase()];
  }
  for (const [col, eds] of Object.entries(used)) others.push(`${eds.join('、')}（パレット外の色 ${col}）`);
  if (others.length) console.log(`  その他: ${others.join(' / ')}`);
}

function main(argv) {
  const args = { png: false, force: false, out: null, spec: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') return listIllustrations();
    if (a === '--themes') return listThemes(path.resolve(argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '.'));
    if (a === '--png') args.png = true;
    else if (a === '--force') args.force = true;
    else if (a === '--out') {
      if (!argv[i + 1]) fail(1, '--out にディレクトリを指定してください\n' + USAGE);
      args.out = argv[++i];
    } else if (a === '-h' || a === '--help') { console.log(USAGE); return; }
    else if (a.startsWith('--')) fail(1, `不明なオプション: ${a}\n${USAGE}`);
    else if (!args.spec) args.spec = a;
    else fail(1, `引数が多すぎます: ${a}\n${USAGE}`);
  }
  if (!args.spec) fail(1, USAGE);

  const specPath = path.resolve(args.spec);
  let norm;
  try {
    norm = normalize(loadSpec(specPath), { baseDir: path.dirname(specPath) });
  } catch (e) {
    if (e instanceof SpecError) fail(e.code, `${e.code === 3 ? 'レイアウトに収まりません' : '仕様エラー'}（${specPath}）:\n  - ${e.errors.join('\n  - ')}`);
    throw e;
  }
  const svg = renderFlyer(norm);

  const outDir = path.resolve(args.out || '.');
  const svgPath = path.join(outDir, norm.outputName + '.svg');
  const pngPath = path.join(outDir, norm.outputName + '.png');
  const targets = args.png ? [svgPath, pngPath] : [svgPath];
  const exists = targets.filter((p) => fs.existsSync(p));
  if (exists.length && !args.force) fail(4, `既に存在します（上書きするには --force）:\n  ${exists.join('\n  ')}`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(svgPath, svg);
  console.log(`wrote ${svgPath}`);
  if (args.png) {
    try {
      execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      fail(1, `sips で PNG 化できませんでした: ${(e.stderr || e.message).toString().trim()}`);
    }
    console.log(`wrote ${pngPath}`);
  }

  // ---- 導出結果のサマリー ----
  const k = norm.kcalInfo;
  console.log(`曜日: ${norm.derived.weekdayJa}（${norm.derived.weekdayEn}）`);
  console.log(`日時: ${norm.derived.dateValue}`);
  console.log(`ヘッダー: ${norm.year} / ${norm.mmdd} / ${norm.startLine} / ${norm.vol} · ${norm.area} / ${norm.roundLabel}`);
  console.log(k.explicit
    ? `消費カロリー: ${norm.kcal} kcal（kcal 直接指定）`
    : `消費カロリー: ${k.mets} METs × 60kg × ${k.hours}h × 1.05 = ${Math.round(k.raw * 10) / 10} → ${norm.kcal} kcal（50単位で四捨五入${k.activity ? '・' + k.activity : ''}）`);
  console.log(`テーマ: ${norm.themeId || 'カスタム'}（main ${norm.pal.main}）`);
  console.log(`イラスト: ${norm.scenePath} + ${norm.rewardPath}`);
  if (norm.fits.length) {
    console.log('自動調整:');
    for (const x of norm.fits) {
      const size = x.to !== x.from ? `${x.from}px → ${x.to}px` : `${x.to}px のまま`;
      console.log(`  ${x.field}: ${size}${x.lines && x.lines.length > 1 ? `、自動改行「${x.lines.join(' / ')}」` : ''}`);
    }
  } else console.log('自動調整: なし');
}

main(process.argv.slice(2));
