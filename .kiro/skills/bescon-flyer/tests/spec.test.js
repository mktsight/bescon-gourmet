const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { SpecError, loadSpec, normalize, stripComments } = require('../scripts/spec');

const EX = path.join(__dirname, '..', 'examples');
const base = (name = 'yamadera') => loadSpec(path.join(EX, name + '.json'));
const norm = (spec) => normalize(spec, { baseDir: EX });
const code = (fn) => {
  try { fn(); } catch (e) { if (e instanceof SpecError) return e.code; throw e; }
  return 0;
};

test('曜日: 2026-11-14 と 2027-02-13 はどちらも 土 / SAT', () => {
  const n1 = norm(base());
  assert.strictEqual(n1.derived.weekdayJa, '土');
  assert.strictEqual(n1.startLine, 'SAT  9:30 START');
  assert.strictEqual(n1.derived.dateValue, '2026年11月14日（土）9:30集合');
  const s = base();
  s.date = '2027-02-13';
  s.start = '10:00';
  const n2 = norm(s);
  assert.strictEqual(n2.derived.weekdayEn, 'SAT');
  assert.strictEqual(n2.derived.dateValue, '2027年2月13日（土）10:00集合');
  assert.strictEqual(n2.mmdd, '02.13');
  assert.strictEqual(n2.year, '2027');
});

test('日時の上書きは曜日が正しくないとエラー（exit 1）', () => {
  const s = base();
  s.overview.date = { value: '2026年11月14日（日）9:30集合' };
  assert.strictEqual(code(() => norm(s)), 1);
  s.overview.date = { value: '11月14日（土）9:30 山寺駅前', note: '※雨天決行' };
  const n = norm(s);
  assert.strictEqual(n.rows[0].value, '11月14日（土）9:30 山寺駅前');
  assert.strictEqual(n.rows[0].note, '※雨天決行');
});

test('存在しない日付・不正な時刻はエラー', () => {
  const s = base();
  s.date = '2026-02-30';
  assert.strictEqual(code(() => norm(s)), 1);
  const t = base();
  t.start = '930';
  assert.strictEqual(code(() => norm(t)), 1);
});

test('kcal: 4つの基準 → 600 / 550 / 350 / 400、明示 kcal が優先', () => {
  const want = { yamadera: '600', zao: '550', kaminoyama: '350', ekimae: '400' };
  for (const [id, kc] of Object.entries(want)) assert.strictEqual(norm(base(id)).kcal, kc, id);
  const s = base();
  s.kcal = 720;
  assert.strictEqual(norm(s).kcal, '720');
  s.kcal = 0;
  assert.strictEqual(code(() => norm(s)), 1);
  const t = base();
  delete t.kcal_basis;
  assert.strictEqual(code(() => norm(t)), 1);
});

test('テーマ: パレット id とカスタム色オブジェクト', () => {
  const s = base();
  s.theme = 'seiji';
  const n = norm(s);
  assert.strictEqual(n.themeId, 'seiji');
  assert.strictEqual(n.pal.main, '#2f7d78');
  assert.deepStrictEqual(Object.keys(n.pal), ['main', 'dark', 'tint', 'tint2', 'warm', 'glow']);
  s.theme = 'nope';
  assert.strictEqual(code(() => norm(s)), 1);
  s.theme = { main: '#111111', dark: '#222222', tint: '#333333', tint2: '#444444', warm: '#555555', glow: '#666666' };
  assert.strictEqual(norm(s).pal.glow, '#666666');
  s.theme = { main: '#111111' };
  assert.strictEqual(code(() => norm(s)), 1);
});

test('編の付与・回数・出力名・フッター', () => {
  const s = base();
  s.edition = '天童';
  s.round = 3;
  s.organizer = '副部長';
  const n = norm(s);
  assert.strictEqual(n.edition, '天童編');
  assert.strictEqual(n.outputName, 'BCG企画_天童編');
  assert.strictEqual(n.roundLabel, '第3回 ベスコングルメ部');
  assert.strictEqual(n.vol, 'Vol.03');
  assert.strictEqual(n.footer, '幹事：副部長　／　参加可否はこちらまで');
  s.output_name = '../evil';
  assert.strictEqual(code(() => norm(s)), 1);
});

test("'_' で始まるキーは無視される", () => {
  assert.deepStrictEqual(stripComments({ a: 1, _c: 'x', b: { _d: 2, e: [{ _f: 1, g: 3 }] } }), { a: 1, b: { e: [{ g: 3 }] } });
  const s = base();
  s._anything = { whatever: true };
  s.overview._note = 'x';
  assert.doesNotThrow(() => norm(s));
});

test('trail: 既定はシーンの meta.trail、指定で上書き', () => {
  const n = norm(base());
  assert.strictEqual(n.trail, 'M262 168 Q330 240 430 226 Q520 214 566 182');
  const s = base();
  s.illustration.trail = 'M0 0 L560 200';
  assert.strictEqual(norm(s).trail, 'M0 0 L560 200');
  s.illustration.scene = 'no_such_scene';
  assert.strictEqual(code(() => norm(s)), 1);
});

test('必須項目の欠落は exit 1', () => {
  for (const k of ['edition', 'area_romaji', 'date', 'start', 'subtitle', 'theme', 'overview', 'notes', 'timeline', 'illustration']) {
    const s = base();
    delete s[k];
    assert.strictEqual(code(() => norm(s)), 1, k);
  }
  const s = base();
  s.timeline = s.timeline.slice(0, 3);
  assert.strictEqual(code(() => norm(s)), 1);
});

test('はみ出し（自動調整でも収まらない）は exit 3', () => {
  const s = base();
  s.overview.place.value = 'とても長い集合場所の説明'.repeat(6);
  assert.strictEqual(code(() => norm(s)), 3);
  const t = base();
  t.edition = 'あ'.repeat(20);
  assert.strictEqual(code(() => norm(t)), 3);
});

test('自動調整: 長い値は縮小、1本の長い注記は2行に分割（2行目は全角スペース始まり）', () => {
  const s = base();
  s.overview.meal.value = '下山後、ふもとや本店で名物の板そばと山形の地酒で乾杯して次回の相談';
  s.notes = ['※9名・土曜昼は混雑のため店は事前予約。きつい人は途中の見晴らし台をゴールにしてもOK。営業時間と定休日は事前に要確認。'];
  const n = norm(s);
  assert.ok(n.rows[3].size < 21 && n.rows[3].size >= 16);
  assert.strictEqual(n.notes.lines.length, 2);
  assert.ok(n.notes.lines[1].startsWith('　'));
  assert.ok(n.fits.some((x) => x.field === 'notes'));
});
