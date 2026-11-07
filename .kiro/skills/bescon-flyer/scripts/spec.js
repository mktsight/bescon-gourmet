// JSON仕様の読み込み・検証・導出・正規化
// loadSpec(path) → 生の仕様（'_' で始まるキーは除去）
// normalize(spec, { baseDir }) → layout.renderFlyer() に渡す正規化済みオブジェクト
// 失敗時は SpecError（code 1 = 仕様エラー、code 3 = レイアウトに収まらない）を投げる
const fs = require('fs');
const path = require('path');
const { tw, fitSize, fitWrap } = require('./fit');

const SK = path.resolve(__dirname, '..');
const PALETTES = path.join(SK, 'assets', 'palettes.json');
const WD_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const PAL_KEYS = ['main', 'dark', 'tint', 'tint2', 'warm', 'glow'];
const ROWS = [['date', '日時'], ['place', '集合'], ['exercise', '運動'], ['meal', '食事'], ['items', '持ち物']];

class SpecError extends Error {
  constructor(code, errors) {
    super(errors.join('\n'));
    this.code = code;
    this.errors = errors;
  }
}

function stripComments(v) {
  if (Array.isArray(v)) return v.map(stripComments);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) o[k] = stripComments(x);
    return o;
  }
  return v;
}

function loadSpec(file) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new SpecError(1, [`仕様ファイルを読めません: ${file}: ${e.message}`]);
  }
  return stripComments(raw);
}

function loadPalettes() {
  return JSON.parse(fs.readFileSync(PALETTES, 'utf8'));
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';

// 内蔵 id（illustrations/<kind>/<id>.js）または .js パス（仕様ファイルからの相対・絶対）を解決
function resolveSnippet(ref, kind, baseDir) {
  if (/^[a-z0-9_-]+$/.test(ref)) return path.join(SK, 'illustrations', kind, ref + '.js');
  if (ref.endsWith('.js')) return path.resolve(baseDir, ref);
  return null;
}

function normalize(spec, opts = {}) {
  const baseDir = opts.baseDir || process.cwd();
  const E = []; // 仕様エラー（exit 1）
  const O = []; // はみ出し（exit 3）
  const fits = []; // 自動調整の記録
  const s = spec || {};

  // ---- 編名・回数・エリア ----
  let edition = isStr(s.edition) ? s.edition.trim() : (E.push('edition: 必須（例「山寺編」）'), '');
  if (edition && !edition.endsWith('編')) edition += '編';
  const round = s.round === undefined ? 1 : s.round;
  if (!Number.isInteger(round) || round < 1 || round > 99) E.push('round: 1〜99 の整数');
  const area = s.area_romaji;
  if (!isStr(area)) E.push('area_romaji: 必須（大文字ローマ字、例 YAMADERA）');
  else if (!/^[A-Z0-9 .'&-]+$/.test(area)) E.push(`area_romaji: 大文字の半角英数字のみ（${area}）`);
  else if (area.length > 24) E.push(`area_romaji: 24文字以内（${area.length}文字）`);

  // ---- 日付・曜日 ----
  let y, m, d, wd;
  const dm = typeof s.date === 'string' && s.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) E.push('date: 必須（YYYY-MM-DD）');
  else {
    [y, m, d] = [+dm[1], +dm[2], +dm[3]];
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) E.push(`date: 存在しない日付（${s.date}）`);
    else wd = dt.getUTCDay();
  }
  const start = s.start;
  if (typeof start !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(start)) E.push('start: 必須（H:MM、例 9:30）');

  if (!isStr(s.subtitle)) E.push('subtitle: 必須（キャッチコピー）');

  // ---- テーマ色 ----
  let pal = null, themeId = null;
  if (typeof s.theme === 'string') {
    const p = loadPalettes().find((x) => x.id === s.theme);
    if (!p) E.push(`theme: 不明なパレット id「${s.theme}」（${loadPalettes().map((x) => x.id).join(' / ')}）`);
    else { themeId = p.id; pal = {}; for (const k of PAL_KEYS) pal[k] = p[k]; }
  } else if (s.theme && typeof s.theme === 'object') {
    const bad = PAL_KEYS.filter((k) => typeof s.theme[k] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.theme[k]));
    if (bad.length) E.push(`theme: ${bad.join(', ')} が #rrggbb ではありません`);
    else { pal = {}; for (const k of PAL_KEYS) pal[k] = s.theme[k]; }
  } else E.push('theme: 必須（パレット id または {main,dark,tint,tint2,warm,glow}）');

  // ---- 消費カロリー ----
  let kcal = null, kcalInfo = null;
  const kOk = (v) => Number.isInteger(v) && v >= 1 && v <= 9999;
  if (s.kcal !== undefined) {
    const v = typeof s.kcal === 'string' && /^\d+$/.test(s.kcal) ? +s.kcal : s.kcal;
    if (!kOk(v)) E.push('kcal: 1〜9999 の整数');
    else { kcal = String(v); kcalInfo = { explicit: true }; }
  } else if (s.kcal_basis && typeof s.kcal_basis === 'object') {
    const { mets, hours, activity } = s.kcal_basis;
    if (!(typeof mets === 'number' && mets > 0) || !(typeof hours === 'number' && hours > 0)) E.push('kcal_basis: mets と hours は正の数');
    else {
      const v = Math.round((mets * 60 * hours * 1.05) / 50) * 50;
      if (!kOk(v)) E.push(`kcal_basis: 計算結果 ${v} kcal が 1〜9999 の範囲外`);
      else { kcal = String(v); kcalInfo = { mets, hours, activity: activity || null, raw: mets * 60 * hours * 1.05 }; }
    }
  } else E.push('kcal または kcal_basis {mets, hours} のどちらかが必須');

  // ---- 開催概要 ----
  const ov = s.overview && typeof s.overview === 'object' ? s.overview : (E.push('overview: 必須'), {});
  let dateValue = null;
  if (y && wd !== undefined && start) dateValue = `${y}年${m}月${d}日（${WD_JA[wd]}）${start}集合`;
  const rows = [];
  for (const [key, label] of ROWS) {
    const o = ov[key];
    let value, note;
    if (key === 'date') {
      if (o !== undefined && (typeof o !== 'object' || o === null)) { E.push('overview.date: {value?, note?}'); continue; }
      value = o && o.value !== undefined ? o.value : dateValue;
      note = o ? o.note : undefined;
      if (o && o.value !== undefined) {
        if (!isStr(o.value)) E.push('overview.date.value: 文字列');
        else if (wd !== undefined && !o.value.includes(`（${WD_JA[wd]}）`)) E.push(`overview.date.value: 曜日が違います（${s.date} は「（${WD_JA[wd]}）」）`);
      }
    } else {
      if (!o || typeof o !== 'object' || !isStr(o.value)) { E.push(`overview.${key}.value: 必須`); continue; }
      value = o.value; note = o.note;
    }
    if (note !== undefined && !isStr(note)) { E.push(`overview.${key}.note: 文字列`); continue; }
    rows.push({ key, label, value, note: note || null });
  }

  // ---- 注記 ----
  const caution = !!s.caution;
  let notes = Array.isArray(s.notes) ? s.notes : null;
  if (!notes || notes.length < 1 || notes.length > 2 || !notes.every(isStr)) { E.push('notes: 1〜2個の文字列'); notes = null; }

  // ---- 当日の流れ ----
  let timeline = Array.isArray(s.timeline) ? s.timeline : null;
  if (!timeline || timeline.length < 4 || timeline.length > 6) { E.push('timeline: 4〜6個の {time, label}（最後がご褒美）'); timeline = null; }
  else timeline.forEach((t, i) => {
    if (!t || typeof t.time !== 'string' || !/^\d{1,2}:\d{2}$/.test(t.time)) E.push(`timeline[${i}].time: H:MM`);
    if (!t || !isStr(t.label)) E.push(`timeline[${i}].label: 必須`);
  });

  // ---- イラスト ----
  let scene = null, reward = null, trail = null, scenePath = null, rewardPath = null;
  const il = s.illustration && typeof s.illustration === 'object' ? s.illustration : (E.push('illustration: 必須 {scene, reward}'), {});
  const loadMod = (ref, kind, field) => {
    if (!isStr(ref)) { E.push(`illustration.${field}: 必須（内蔵 id または .js パス）`); return [null, null]; }
    const p = resolveSnippet(ref, kind, baseDir);
    if (!p) { E.push(`illustration.${field}: 内蔵 id（英小文字）か .js で終わるパス（${ref}）`); return [null, null]; }
    if (!fs.existsSync(p)) { E.push(`illustration.${field}: 見つかりません（${p}）`); return [null, null]; }
    let mod;
    try { mod = require(p); } catch (e) { E.push(`illustration.${field}: 読み込み失敗（${p}）: ${e.message}`); return [null, null]; }
    if (!mod || typeof mod.render !== 'function') { E.push(`illustration.${field}: module.exports = { meta, render(ctx) } ではありません（${p}）`); return [null, null]; }
    return [mod, p];
  };
  if (s.illustration) {
    [scene, scenePath] = loadMod(il.scene, 'scenes', 'scene');
    [reward, rewardPath] = loadMod(il.reward, 'rewards', 'reward');
    if (il.trail !== undefined) {
      if (!isStr(il.trail)) E.push('illustration.trail: SVG パス文字列');
      else trail = il.trail;
    } else if (scene) {
      if (scene.meta && isStr(scene.meta.trail)) trail = scene.meta.trail;
      else E.push('illustration.trail: シーンの meta.trail が無いので指定が必要');
    }
  }

  // ---- フッター・出力名 ----
  for (const k of ['organizer', 'contact']) if (s[k] !== undefined && !isStr(s[k])) E.push(`${k}: 文字列`);
  const footer = `幹事：${s.organizer || '部長'}　／　${s.contact || '参加可否はこちらまで'}`;
  let outputName = s.output_name !== undefined ? s.output_name : 'BCG企画_' + edition;
  if (!isStr(outputName) || /[\/\\:]/.test(outputName) || outputName.startsWith('.')) { E.push('output_name: ファイル名として使える文字列（/ \\ : 不可）'); outputName = null; }

  if (E.length) throw new SpecError(1, E);

  // ---- 自動調整（既定サイズで収まればそのまま） ----
  const record = (field, from, to, lines) => {
    if (to !== from || (lines && lines.auto)) fits.push({ field, from, to, lines: lines ? lines.list : undefined });
  };
  const edSize = fitSize(edition, 62, 40, 620);
  if (edSize === null) O.push(`edition: 「${edition}」が長すぎます（40px でも幅 620 を超過）`);
  else record('edition', 62, edSize);
  const subSize = fitSize(s.subtitle, 19, 15, 779);
  if (subSize === null) O.push(`subtitle: 長すぎます（15px でも幅 779 を超過、現在 ${Math.round(tw(s.subtitle, 15))}）`);
  else record('subtitle', 19, subSize);

  for (const row of rows) {
    const noteW = row.note ? tw(row.note, 14.5) : 0;
    if (noteW > 300) { O.push(`overview.${row.key}.note: 長すぎます（幅 ${Math.round(noteW)} > 300）`); continue; }
    const limit = 680 - (row.note ? noteW + 20 : 0);
    row.size = fitSize(row.value, 21, 16, limit);
    if (row.size === null) O.push(`overview.${row.key}.value: 長すぎます（16px でも幅 ${Math.round(limit)} を超過）`);
    else record(`overview.${row.key}.value`, 21, row.size);
  }

  const noteLimit = caution ? 712 : 732;
  let noteLines = null, noteSize = null;
  if (notes.length === 2) {
    noteSize = Math.min(...notes.map((n) => fitSize(n, 15, 12.5, noteLimit) ?? -1));
    if (noteSize < 0) O.push(`notes: 長すぎます（12.5px でも幅 ${noteLimit} を超過）`);
    else { noteLines = notes.slice(); record('notes', 15, noteSize); }
  } else {
    const r = fitWrap(notes[0], 15, 12.5, noteLimit, 2, '　');
    if (!r) O.push(`notes: 長すぎます（12.5px・2行でも幅 ${noteLimit} を超過）`);
    else { noteSize = r.size; noteLines = r.lines; record('notes', 15, r.size, { auto: r.lines.length > 1, list: r.lines }); }
  }

  const exN = timeline.length - 1;
  const step = (594 - 70) / exN;
  const tl = timeline.map((t, i) => {
    const meal = i === exN;
    const [size0, min, limit] = meal ? [15, 12.5, 208] : [13.5, 11.5, step - 10];
    const r = fitWrap(t.label, size0, min, limit, 2);
    if (!r) { O.push(`timeline[${i}].label: 「${t.label}」が ${min}px・2行でも幅 ${Math.round(limit)} を超過`); return null; }
    record(`timeline[${i}].label`, size0, r.size, { auto: !t.label.includes('|') && r.lines.length > 1, list: r.lines });
    return { time: t.time, lines: r.lines, size: r.size };
  });

  const footerSize = fitSize(footer, 14, 11, 280);
  if (footerSize === null) O.push(`organizer/contact: フッター「${footer}」が長すぎます（11px でも幅 280 を超過）`);
  else record('footer', 14, footerSize);

  if (O.length) throw new SpecError(3, O);

  const pad = (n) => String(n).padStart(2, '0');
  return {
    outputName,
    edition, edSize,
    roundLabel: `第${round}回 ベスコングルメ部`,
    vol: `Vol.${pad(round)}`,
    area,
    year: String(y),
    mmdd: `${pad(m)}.${pad(d)}`,
    startLine: `${WD_EN[wd]}  ${start} START`,
    subtitle: s.subtitle, subSize,
    themeId, pal,
    kcal, kcalInfo,
    rows,
    notes: { lines: noteLines, size: noteSize },
    caution,
    timeline: tl,
    scene, reward, scenePath, rewardPath, trail,
    footer, footerSize,
    derived: { weekdayJa: WD_JA[wd], weekdayEn: WD_EN[wd], dateValue: rows[0].value },
    fits,
  };
}

module.exports = { SpecError, loadSpec, loadPalettes, normalize, stripComments, resolveSnippet, SK, WD_JA, WD_EN };
