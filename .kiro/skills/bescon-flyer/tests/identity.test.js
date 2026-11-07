// 4つの例の仕様から、ワークスペース直下の既存フライヤーと同一の SVG が生成されることを確認
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadSpec, normalize } = require('../scripts/spec');
const { renderFlyer } = require('../scripts/layout');

const SK = path.join(__dirname, '..');
const WS = path.resolve(SK, '..', '..', '..');
const EXAMPLES = { yamadera: '山寺編', zao: '蔵王ライザ編', kaminoyama: '上山編', ekimae: '山形駅前編' };

for (const [id, ed] of Object.entries(EXAMPLES)) {
  const orig = path.join(WS, `BCG企画_${ed}.svg`);
  test(`examples/${id}.json → BCG企画_${ed}.svg と同一`, { skip: !fs.existsSync(orig) && `${orig} が無い` }, () => {
    const specPath = path.join(SK, 'examples', id + '.json');
    const n = normalize(loadSpec(specPath), { baseDir: path.dirname(specPath) });
    assert.strictEqual(n.fits.length, 0);
    const svg = renderFlyer(n);
    assert.ok(svg === fs.readFileSync(orig, 'utf8'), `${id}: 生成結果が既存 SVG と一致しません`);
  });
}
