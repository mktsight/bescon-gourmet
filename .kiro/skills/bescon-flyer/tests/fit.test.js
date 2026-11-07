const test = require('node:test');
const assert = require('node:assert');
const { tw, fitSize, wrapLines, fitWrap } = require('../scripts/fit');

test('tw: 全角=1em、半角=0.6em', () => {
  assert.strictEqual(tw('山寺編', 62), 186);
  assert.strictEqual(tw('9:30', 10), 24);
  assert.strictEqual(tw('→', 10), 10); // U+2192 は U+2000 以上なので全角扱い（旧実装と同じ）
});

test('fitSize: 収まるときは既定サイズをそのまま返す', () => {
  assert.strictEqual(fitSize('山寺編', 62, 40, 620), 62);
  assert.strictEqual(fitSize('あ'.repeat(10), 62, 40, 620), 62);
});

test('fitSize: はみ出すときは 0.5 刻みで縮小、min でも無理なら null', () => {
  assert.strictEqual(fitSize('あ'.repeat(12), 62, 40, 620), 51.5);
  assert.strictEqual(fitSize('あ'.repeat(40), 62, 40, 620), null);
});

test('wrapLines: | で強制改行', () => {
  assert.deepStrictEqual(wrapLines('登山口に集合・|準備運動', 13.5, 121, 2), ['登山口に集合・', '準備運動']);
  assert.strictEqual(wrapLines('a|b|c', 13.5, 121, 2), null);
  assert.strictEqual(wrapLines('あああああああああああ|い', 13.5, 121, 2), null);
});

test('wrapLines: 収まれば1行のまま', () => {
  assert.deepStrictEqual(wrapLines('公園で記念撮影', 13.5, 121, 2), ['公園で記念撮影']);
});

test('wrapLines: 自動改行は句読点の後を優先', () => {
  assert.deepStrictEqual(wrapLines('霞城公園を周回・ウォーク', 13.5, 121, 2), ['霞城公園を周回・', 'ウォーク']);
});

test('wrapLines: 行頭禁則（、。）・ー で始まらない）', () => {
  for (const lines of [wrapLines('あいうえおかきく、けこさしすせ', 13.5, 108, 2), wrapLines('あいうえおかきーくけこさしすせ', 13.5, 108, 2)]) {
    assert.ok(lines && lines.length === 2);
    for (const ln of lines.slice(1)) assert.ok(!/^[、。）・ー]/.test(ln), ln);
  }
});

test('wrapLines: 英数字の途中では切らない', () => {
  const lines = wrapLines('集合ABCDEFGHIJ', 10, 70, 2);
  assert.deepStrictEqual(lines, ['集合', 'ABCDEFGHIJ']);
});

test('wrapLines: 2行目の接頭辞（全角スペース）を幅に含める', () => {
  const lines = wrapLines('※あいうえおかきくけこ。さしすせそたちつてと', 15, 200, 2, '　');
  assert.deepStrictEqual(lines, ['※あいうえおかきくけこ。', '　さしすせそたちつてと']);
});

test('fitWrap: 改行を優先し、無理なら縮小', () => {
  assert.deepStrictEqual(fitWrap('あいうえおかき', 13.5, 11.5, 121, 2), { size: 13.5, lines: ['あいうえおかき'] });
  const r = fitWrap('あ'.repeat(20), 13.5, 11.5, 121, 2);
  assert.strictEqual(r.size, 12); // 12px なら1行10字×2行に収まる
  assert.strictEqual(r.lines.length, 2);
  assert.strictEqual(fitWrap('あ'.repeat(40), 13.5, 11.5, 121, 2), null);
});
