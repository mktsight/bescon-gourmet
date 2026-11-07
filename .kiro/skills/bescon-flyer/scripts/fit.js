// 文字幅の概算と自動調整（縮小・改行）
// 既定サイズで収まるテキストは一切変更しない（既存4枚とのバイト一致を保つため）
const f = (v) => Math.round(v * 10) / 10;

// 文字幅の概算（全角=1em、U+2000 未満=0.6em）— 旧 build.js と同一
const tw = (s, size) => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x2000 ? 0.6 : 1), 0) * size;

// 改行してよい位置（この文字の直後）と、行頭に来てはいけない文字
const BREAK_AFTER = new Set([...'・、。）／']);
const NO_START = new Set([...'、。）・ーっゃゅょぁぃぅぇぉッャュョァィゥェォ']);
const WORD = /[A-Za-z0-9:.,'\-]/;
const PARTICLES = new Set([...'でにをはがへもの']);

// 文字種: H=ひらがな K=カタカナ C=漢字 O=その他
const cls = (ch) => (/[\u3041-\u309f]/.test(ch) ? 'H' : /[\u30a0-\u30ff]/.test(ch) ? 'K' : /[\u4e00-\u9fff々]/.test(ch) ? 'C' : 'O');

// prev と next の間で改行するときの減点（em 単位）。句読点の後 < 助詞の後 < 文字種の切れ目 < 語中
function breakPenalty(prev, next) {
  if (BREAK_AFTER.has(prev)) return 0;
  const p = cls(prev), n = cls(next);
  if (PARTICLES.has(prev) && n !== 'H') return 2; // 「上山城で|全員」
  if (p === 'H' && (n === 'C' || n === 'K')) return 2; // かな → 漢字・カタカナ
  if (PARTICLES.has(prev) && prev !== 'の') return 3; // 「温泉で|ととのえる」（「かみの|やま」は避ける）
  if (p !== n && p !== 'C') return 4; // カタカナ・記号などの切れ目
  if (p === 'C' && n === 'K') return 4;
  if (p === 'C' && n === 'H') return 6; // 送り仮名の前（「通|り」）は避ける
  return 8; // 同じ文字種の途中
}

// default から 0.5 刻みで min まで下げ、limit に収まる最大サイズを返す（収まらなければ null）
function fitSize(text, size, min, limit) {
  if (tw(text, size) <= limit) return size;
  for (let s = f(size - 0.5); s >= min - 1e-9; s = f(s - 0.5)) {
    if (tw(text, s) <= limit) return s;
  }
  return null;
}

// text を最大 maxLines 行に折り返す。'|' があればそこで強制改行（自動改行はしない）。
// contPrefix は2行目以降の先頭に付ける文字列（幅に含める）。収まらなければ null。
function wrapLines(text, size, limit, maxLines, contPrefix = '') {
  if (text.includes('|')) {
    const lines = text.split('|').map((ln, i) => (i ? contPrefix + ln : ln));
    if (lines.length > maxLines || lines.some((ln) => !ln.trim() || tw(ln, size) > limit)) return null;
    return lines;
  }
  if (tw(text, size) <= limit) return [text];
  const chars = [...text];
  const pw = tw(contPrefix, size);
  let best = null;
  // 改行位置を全探索（文字列は短く行数も最大2〜3なので十分速い）
  const search = (start, lines, cost) => {
    const restW = tw(chars.slice(start).join(''), size) + (lines.length ? pw : 0);
    if (restW <= limit) {
      const all = [...lines, chars.slice(start).join('')];
      const widths = all.map((ln, i) => tw(ln, size) + (i ? pw : 0));
      // 最長行が短いほど（＝バランスが良いほど）良い。句読点以外での改行は減点
      const score = Math.max(...widths) + cost;
      if (!best || score < best.score) best = { score, lines: all };
      return;
    }
    if (lines.length + 1 >= maxLines) return;
    for (let k = start + 1; k < chars.length; k++) {
      const head = chars.slice(start, k).join('');
      if (tw(head, size) + (lines.length ? pw : 0) > limit) break;
      if (NO_START.has(chars[k])) continue; // 行頭禁則
      if (WORD.test(chars[k - 1]) && WORD.test(chars[k])) continue; // 英数字の途中では切らない
      const penalty = breakPenalty(chars[k - 1], chars[k]) * size;
      search(k, [...lines, head], cost + penalty);
    }
  };
  search(0, [], 0);
  if (!best) return null;
  return best.lines.map((ln, i) => (i ? contPrefix + ln : ln));
}

// 改行を優先し、それでも収まらなければ縮小する。{ size, lines } または null
function fitWrap(text, size, min, limit, maxLines, contPrefix = '') {
  for (let s = size; s >= min - 1e-9; s = f(s - 0.5)) {
    const lines = wrapLines(text, s, limit, maxLines, contPrefix);
    if (lines) return { size: s, lines };
  }
  return null;
}

module.exports = { f, tw, fitSize, wrapLines, fitWrap, BREAK_AFTER, NO_START };
