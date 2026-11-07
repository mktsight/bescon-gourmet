// SVG 内の <text> の中身を文書順に1行ずつ出力する（文言チェック・差分確認用）
// 使い方: node texts.js <file.svg>
const fs = require('fs');

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function extractTexts(svg) {
  const out = [];
  const re = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) out.push(unesc(m[1].replace(/<[^>]+>/g, '')));
  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node texts.js <file.svg>');
    process.exit(1);
  }
  for (const t of extractTexts(fs.readFileSync(file, 'utf8'))) console.log(t);
}

module.exports = { extractTexts };
