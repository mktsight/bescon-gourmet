// フライヤーのレイアウト（旧 .agents/flyer/build.js の build() を文単位で移植）
// renderFlyer(norm) → SVG 文字列。norm は spec.normalize() の戻り値
// defs の id 順（g0, g1, …）は シーン → ご褒美 → レイアウト の呼び出し順で決まるので順序を変えないこと
const L = require('./lib');
const people = require('./people');
const makeParts = require('../illustrations/rewards/_parts');
const { tw } = require('./fit');
const { f, lg, rg, clip, resetDefs, G, soft } = L;

const JP = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
const MIN = "'Hiragino Mincho ProN','Yu Mincho',serif";
const EN = "'Avenir Next','Helvetica Neue',sans-serif";
const INK = '#2b2723', SUB = '#5a544c', MUTED = '#8a847a', LINE = '#e6e0d5', PAGE = '#f6f3ee';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shadowRect(x, y, w, h, r) {
  return `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${r}" fill="#2b2016" opacity="0.035"/>
  <rect x="${x}" y="${y + 2}" width="${w}" height="${h}" rx="${r}" fill="#2b2016" opacity="0.045"/>`;
}
function card(x, y, w, h, r = 16) {
  return shadowRect(x, y, w, h, r) + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" stroke="${LINE}" stroke-width="1"/>`;
}

// ---- アイコン ----
function flame(cx, cy, s, col, inner) {
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <path d="M0 -13 C6 -6 10 -2 10 4 C10 10 5.5 14 0 14 C-5.5 14 -10 10 -10 4 C-10 -1 -6 -3 -4 -8 C-2 -4 -1 -2 1 -1 C2 -5 1 -9 0 -13 Z" fill="${col}"/>
    <path d="M0 3 C3 6 4.5 8 4.5 10 C4.5 12.5 2.5 14 0 14 C-2.5 14 -4.5 12.5 -4.5 10 C-4.5 7.5 -2 6 0 3 Z" fill="${inner}"/>
  </g>`;
}
const iconShoe = (cx, cy, c) => `<g transform="translate(${cx},${cy})">
    <ellipse cx="-4" cy="-3" rx="3.4" ry="5.2" fill="${c}" transform="rotate(-12 -4 -3)"/><circle cx="-5.3" cy="4.6" r="2" fill="${c}"/>
    <ellipse cx="4.5" cy="1" rx="3.4" ry="5.2" fill="${c}" transform="rotate(12 4.5 1)"/><circle cx="5.8" cy="8.4" r="2" fill="${c}" opacity="0"/>
    <circle cx="5.6" cy="-6.4" r="2" fill="${c}"/></g>`;
const iconSpark = (cx, cy, c) => `<g transform="translate(${cx},${cy})">
    <path d="M0 -9 Q1.2 -1.2 9 0 Q1.2 1.2 0 9 Q-1.2 1.2 -9 0 Q-1.2 -1.2 0 -9 Z" fill="${c}"/>
    <path d="M7 -8 Q7.5 -6.5 9 -6 Q7.5 -5.5 7 -4 Q6.5 -5.5 5 -6 Q6.5 -6.5 7 -8 Z" fill="${c}"/></g>`;
const iconCheers = (cx, cy, c, bg) => `<g transform="translate(${cx},${cy})">
    <path d="M-11 -8 L-3 -9 L-3.5 2 Q-6.5 4 -9.5 2 Z" fill="${c}" transform="rotate(-14 -6 -3)"/>
    <path d="M3 -9 L11 -8 L9.5 2 Q6.5 4 3.5 2 Z" fill="${c}" transform="rotate(14 6 -3)"/>
    <line x1="-5.5" y1="2.5" x2="-7.5" y2="9" stroke="${c}" stroke-width="1.6"/><line x1="5.5" y1="2.5" x2="7.5" y2="9" stroke="${c}" stroke-width="1.6"/>
    <line x1="-10" y1="9" x2="-5" y2="9" stroke="${c}" stroke-width="1.6"/><line x1="5" y1="9" x2="10" y2="9" stroke="${c}" stroke-width="1.6"/>
    <path d="M0 -15 L0 -12 M-4 -14 L-3 -11.5 M4 -14 L3 -11.5" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/></g>`;

function renderFlyer(cfg) {
  resetDefs();
  const a = cfg.pal;
  const W = 900;
  const P = { x: 40, y: 266, w: 820, h: 330 };
  // スニペットには同じ lib インスタンスを渡す（defs レジストリ共有）
  const ctx = { L, people, theme: a, parts: makeParts(L) };
  const scene = cfg.scene.render(ctx);
  const reward = cfg.reward.render(ctx);

  // ---- ヘッダー ----
  const ed = cfg.edition, edSize = cfg.edSize, edW = tw(ed, edSize);
  const header = `
  <text x="60" y="40" font-family="${EN}" font-size="12.5" font-weight="500" letter-spacing="4" fill="${a.main}">BESCON GOURMET CLUB</text>
  <text x="840" y="40" text-anchor="end" font-family="${EN}" font-size="12.5" font-weight="500" letter-spacing="3" fill="${MUTED}">${esc(cfg.vol)} · ${esc(cfg.area)}</text>
  <line x1="60" y1="54" x2="840" y2="54" stroke="#d9d1c4" stroke-width="1"/>
  <text x="61" y="86" font-size="15" fill="${MUTED}" letter-spacing="3">${esc(cfg.roundLabel)}</text>
  <rect x="54" y="126" width="${f(edW + 14)}" height="26" rx="3" fill="${a.tint}"/>
  <rect x="54" y="152" width="${f(edW + 14)}" height="3.5" rx="2" fill="${a.main}" opacity="0.85"/>
  <text x="58" y="148" font-family="${MIN}" font-size="${edSize}" font-weight="600" fill="${a.main}">${esc(ed)}</text>
  <text x="61" y="187" font-size="${cfg.subSize}" fill="${SUB}">${esc(cfg.subtitle)}</text>
  <text x="840" y="88" text-anchor="end" font-family="${EN}" font-size="12.5" font-weight="500" letter-spacing="3" fill="${MUTED}">${esc(cfg.year)}</text>
  <text x="842" y="134" text-anchor="end" font-family="${EN}" font-size="44" font-weight="500" fill="${INK}">${esc(cfg.mmdd)}</text>
  <text x="840" y="160" text-anchor="end" font-family="${EN}" font-size="12" font-weight="500" letter-spacing="3" fill="${MUTED}">${esc(cfg.startLine)}</text>`;

  // ---- コンセプト帯：①運動で整える → ②最高のコンディション → ③ご褒美の美味しい食事 ----
  const num = (cx, cy, n, stroke, fill, txt) => `<circle cx="${cx}" cy="${cy}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${cx}" y="${cy + 4.5}" text-anchor="middle" font-family="${EN}" font-size="13" font-weight="500" fill="${txt}">${n}</text>`;
  const chev = (x) => `<path d="M${x} 222 L${x + 7} 229 L${x} 236 M${x + 8} 222 L${x + 15} 229 L${x + 8} 236" stroke="${a.main}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`;
  const concept = `
  <rect x="60" y="208" width="182" height="42" rx="21" fill="#ffffff" stroke="${LINE}"/>
  ${num(84, 229, 1, a.main, '#ffffff', a.main)}${iconShoe(112, 229, a.dark)}
  <text x="128" y="235" font-size="16" font-weight="600" fill="${INK}">運動で整える</text>
  ${chev(248)}
  <rect x="270" y="208" width="246" height="42" rx="21" fill="#ffffff" stroke="${LINE}"/>
  ${num(294, 229, 2, a.main, '#ffffff', a.main)}${iconSpark(322, 229, a.dark)}
  <text x="338" y="235" font-size="16" font-weight="600" fill="${INK}">最高のコンディション</text>
  ${chev(522)}
  ${shadowRect(544, 202, 296, 54, 27)}
  <rect x="544" y="202" width="296" height="54" rx="27" fill="${lg([[0, a.main], [1, a.warm]], 0, 0, 1, 0)}"/>
  ${num(572, 229, 3, '#ffffff', '#ffffff', a.main)}${iconCheers(604, 230, '#ffffff')}
  <text x="624" y="236" font-size="19" font-weight="600" fill="#ffffff">ご褒美の美味しい食事</text>`;

  // ---- イラスト（左：運動 → 右：ご褒美） ----
  const RX = 690, RY = 160, RS = 1.18; // ご褒美の一皿（パネル内座標）
  const medClip = clip(`<circle cx="0" cy="0" r="100"/>`);
  const hero = `
      <rect x="500" y="0" width="320" height="330" fill="${lg([[0, a.glow, 0], [0.4, a.glow, 0.5], [1, a.glow, 0.8]], 0, 0, 1, 0)}"/>
      <circle cx="${RX}" cy="${RY}" r="200" fill="${rg([[0, '#fff3d6', 0.95], [0.5, a.glow, 0.6], [1, a.glow, 0]])}"/>
      ${[[-70, -150, 30], [-30, -160, 36], [20, -150, 30], [60, -140, 24]].map(([dx, dy, rr], i) => soft(RX + dx, RY + dy + 8, rr, rr * 1.5, 0.75 - i * 0.05)).join('')}
      <path d="M${RX - 40} ${RY - 128} q-10 -16 2 -30 q10 -14 0 -28 M${RX} ${RY - 124} q-10 -18 2 -32 q10 -14 0 -30 M${RX + 40} ${RY - 128} q-10 -16 2 -30 q10 -14 0 -28" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.75"/>
      <circle cx="${RX}" cy="${RY + 8}" r="${f(100 * RS + 8)}" fill="#3a2414" opacity="0.18"/>
      <circle cx="${RX}" cy="${RY + 3}" r="${f(100 * RS + 7)}" fill="#3a2414" opacity="0.12"/>
      <circle cx="${RX}" cy="${RY}" r="${f(100 * RS + 7)}" fill="#ffffff"/>
      <g transform="translate(${RX},${RY}) scale(${RS})">
        <g clip-path="${medClip}">${reward}</g>
      </g>
      ${[[RX - 128, RY - 70, 1], [RX + 122, RY - 92, 0.8], [RX + 128, RY + 60, 0.7], [RX - 120, RY + 80, 0.6]].map(([x, y, s]) => `<path d="M${x} ${y - 9 * s} Q${x + 1.2 * s} ${y - 1.2 * s} ${x + 9 * s} ${y} Q${x + 1.2 * s} ${y + 1.2 * s} ${x} ${y + 9 * s} Q${x - 1.2 * s} ${y + 1.2 * s} ${x - 9 * s} ${y} Q${x - 1.2 * s} ${y - 1.2 * s} ${x} ${y - 9 * s} Z" fill="#ffffff" opacity="0.9"/>`).join('')}
      <rect x="${RX - 45}" y="${f(RY + 100 * RS - 6)}" width="90" height="22" rx="11" fill="#ffffff" stroke="${LINE}"/>
      <text x="${RX}" y="${f(RY + 100 * RS + 9)}" text-anchor="middle" font-family="${EN}" font-size="10.5" font-weight="500" letter-spacing="3" fill="${a.dark}">REWARD</text>`;
  const trail = `<path d="${cfg.trail}" stroke="#ffffff" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" fill="none" opacity="0.95"/>`;

  // ---- 消費カロリー（運動 → ご褒美への橋渡し） ----
  const kc = cfg.kcal;
  const kx = 286, ky = 570, kw = 322, kh = 58;
  const numW = tw(kc, 30) * 1.0 + 6; // 数字の後ろに余白（kcal と重ならないように）
  const xYaku = kx + 130, xNum = xYaku + 19, xKcal = xNum + numW + 3, xShohi = xKcal + 36;
  const kcal = `
  ${shadowRect(kx, ky, kw, kh, 14)}
  <rect x="${kx}" y="${ky}" width="${kw}" height="${kh}" rx="14" fill="#ffffff" stroke="${a.main}" stroke-opacity="0.45" stroke-width="1.2"/>
  <circle cx="${kx + 30}" cy="${ky + 29}" r="19" fill="${a.tint}"/>
  ${flame(kx + 30, ky + 28, 1.05, a.main, '#f3c27a')}
  <text x="${kx + 58}" y="${ky + 31}" font-size="13" font-weight="600" fill="${SUB}">この運動で</text>
  <text x="${xYaku}" y="${ky + 32}" font-size="16" font-weight="600" fill="${a.dark}">約</text>
  <text x="${f(xNum)}" y="${ky + 33}" font-family="${EN}" font-size="30" font-weight="500" fill="${a.main}">${kc}</text>
  <text x="${f(xKcal)}" y="${ky + 32}" font-family="${EN}" font-size="15" font-weight="500" fill="${a.dark}">kcal</text>
  <text x="${f(xShohi)}" y="${ky + 32}" font-size="15" font-weight="600" fill="${a.dark}">消費</text>
  <text x="${kx + 58}" y="${ky + 48}" font-size="10.5" fill="${MUTED}">体重60kg換算の目安・個人差あり</text>
  <path d="M${kx + kw + 6} ${ky + 26} Q${kx + kw + 30} ${ky + 20} ${kx + kw + 40} ${ky - 4}" stroke="${a.main}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M${kx + kw + 33} ${ky - 1} L${kx + kw + 41} ${ky - 7} L${kx + kw + 44} ${ky + 3}" stroke="${a.main}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  // ---- 開催概要 ----
  const OY = 644;
  const rowY = [OY + 94, OY + 131, OY + 168, OY + 205, OY + 242];
  const rows = cfg.rows.map((row, i) => {
    const y = rowY[i];
    const sep = i < 4 ? `<line x1="70" y1="${y + 14}" x2="830" y2="${y + 14}" stroke="${LINE}" stroke-width="1"/>` : '';
    const sub = row.note ? `<text x="830" y="${y}" text-anchor="end" font-size="14.5" fill="${MUTED}">${esc(row.note)}</text>` : '';
    return `
    <rect x="70" y="${y - 19}" width="62" height="25" rx="5" fill="${a.tint}"/>
    <text x="101" y="${y - 2}" text-anchor="middle" font-size="13.5" font-weight="600" fill="${a.dark}" letter-spacing="1">${esc(row.label)}</text>
    <text x="150" y="${y}" font-size="${row.size}" fill="${INK}">${esc(row.value)}</text>${sub}${sep}`;
  }).join('');
  const caution = !!cfg.caution;
  const NY = OY + 258;
  // 注記は2行（y=NY+20, NY+40）。1行だけのときは帯の中央（NY+30）に置く
  const nl = cfg.notes.lines;
  const noteYs = nl.length === 1 ? [NY + 30] : [NY + 20, NY + 40];
  const notes = `
    <rect x="70" y="${NY}" width="760" height="50" rx="6" fill="${caution ? '#f8ebe7' : '#f6f3ee'}"/>
    <rect x="70" y="${NY}" width="4" height="50" rx="2" fill="${caution ? '#b5432f' : a.main}"/>
    ${caution ? `<path d="M93 ${NY + 9} L101 ${NY + 23} L85 ${NY + 23} Z" fill="#b5432f"/><text x="93" y="${NY + 21.5}" text-anchor="middle" font-size="10" font-weight="600" fill="#ffffff">!</text>` : ''}
    ${nl.map((ln, k) => `<text x="${caution ? 110 : 90}" y="${noteYs[k]}" font-size="${cfg.notes.size}" fill="${caution ? '#a33a2a' : '#6b655d'}">${esc(ln)}</text>`).join('\n    ')}`;

  // ---- 当日の流れ（運動フェーズ → ご褒美フェーズ） ----
  const TY = 976;
  const exX0 = 70, exX1 = 594, rwX0 = 606, rwX1 = 830;
  const bandY = TY + 50, bandH = 124;
  const lineY = bandY + 52;
  const exN = cfg.timeline.length - 1;
  const step = (exX1 - exX0) / exN;
  let tl = `
  <rect x="${exX0}" y="${bandY}" width="${exX1 - exX0}" height="${bandH}" rx="12" fill="#f6f3ee"/>
  <rect x="${rwX0}" y="${bandY}" width="${rwX1 - rwX0}" height="${bandH}" rx="12" fill="${lg([[0, a.tint], [1, a.tint2]], 0, 0, 1, 1)}"/>
  <text x="${exX0 + 14}" y="${bandY + 20}" font-family="${EN}" font-size="10.5" font-weight="500" letter-spacing="2.5" fill="${MUTED}">EXERCISE</text>
  <text x="${exX0 + 92}" y="${bandY + 20}" font-size="11.5" fill="${MUTED}">運動で整える</text>
  <text x="${rwX0 + 14}" y="${bandY + 20}" font-family="${EN}" font-size="10.5" font-weight="500" letter-spacing="2.5" fill="${a.dark}">REWARD</text>
  <line x1="${exX0 + step / 2}" y1="${lineY}" x2="${exX1 - step / 2}" y2="${lineY}" stroke="#cfc6b8" stroke-width="2"/>
  <line x1="${exX1 - step / 2}" y1="${lineY}" x2="${(rwX0 + rwX1) / 2}" y2="${lineY}" stroke="${a.main}" stroke-width="2" stroke-dasharray="3 4"/>`;
  cfg.timeline.forEach((t, i) => {
    const meal = i === exN;
    const lines = t.lines;
    if (!meal) {
      const cx = exX0 + step * (i + 0.5);
      tl += `
  <text x="${f(cx)}" y="${lineY - 12}" text-anchor="middle" font-family="${EN}" font-size="17" font-weight="500" fill="${SUB}">${esc(t.time)}</text>
  <circle cx="${f(cx)}" cy="${lineY}" r="5.5" fill="#ffffff" stroke="${a.main}" stroke-width="2.2"/>
  ${lines.map((ln, k) => `<text x="${f(cx)}" y="${lineY + 26 + k * 19}" text-anchor="middle" font-size="${t.size}" fill="${INK}">${esc(ln)}</text>`).join('')}`;
    } else {
      const cx = (rwX0 + rwX1) / 2;
      const timeW = tw(t.time, 22) * 0.98;
      tl += `
  <text x="${f(cx - 26)}" y="${lineY - 11}" text-anchor="middle" font-family="${EN}" font-size="22" font-weight="500" fill="${a.main}">${esc(t.time)}</text>
  <rect x="${f(cx - 26 + timeW / 2 + 8)}" y="${lineY - 31}" width="60" height="24" rx="12" fill="${a.main}"/>
  <text x="${f(cx - 26 + timeW / 2 + 38)}" y="${lineY - 14}" text-anchor="middle" font-size="13" font-weight="600" fill="#ffffff" letter-spacing="1">ご褒美</text>
  <circle cx="${cx}" cy="${lineY}" r="13" fill="${a.main}" opacity="0.2"/>
  <circle cx="${cx}" cy="${lineY}" r="8" fill="${a.main}"/>
  ${lines.map((ln, k) => `<text x="${cx}" y="${lineY + 27 + k * 20}" text-anchor="middle" font-size="${t.size}" font-weight="600" fill="${INK}">${esc(ln)}</text>`).join('')}`;
    }
  });

  const body = `
  <rect width="${W}" height="1200" fill="${PAGE}"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${a.main}"/>
  ${header}
  ${concept}

  <!-- illustration -->
  <rect x="${P.x}" y="${P.y + 6}" width="${P.w}" height="${P.h}" rx="18" fill="#2b2016" opacity="0.05"/>
  <rect x="${P.x}" y="${P.y + 2}" width="${P.w}" height="${P.h}" rx="18" fill="#2b2016" opacity="0.06"/>
  <g transform="translate(${P.x},${P.y})">
    <g clip-path="${clip(`<rect x="0" y="0" width="${P.w}" height="${P.h}" rx="18"/>`)}">
      ${scene}
      ${trail}
      ${hero}
    </g>
  </g>
  ${kcal}

  <!-- 開催概要 -->
  ${card(40, OY, 820, 318)}
  <text x="70" y="${OY + 30}" font-family="${EN}" font-size="11" font-weight="500" letter-spacing="3.5" fill="${a.main}">OVERVIEW</text>
  <text x="70" y="${OY + 56}" font-size="21" font-weight="600" fill="${INK}">開催概要</text>
  ${rows}
  ${notes}

  <!-- 当日の流れ -->
  ${card(40, TY, 820, 184)}
  <text x="70" y="${TY + 28}" font-family="${EN}" font-size="11" font-weight="500" letter-spacing="3.5" fill="${a.main}">SCHEDULE</text>
  <text x="160" y="${TY + 30}" font-size="18" font-weight="600" fill="${INK}">当日の流れ</text>
  ${tl}

  <!-- footer -->
  <line x1="60" y1="1181" x2="300" y2="1181" stroke="#d9d1c4" stroke-width="1"/>
  <line x1="600" y1="1181" x2="840" y2="1181" stroke="#d9d1c4" stroke-width="1"/>
  <text x="450" y="1186" text-anchor="middle" font-size="${cfg.footerSize}" fill="${MUTED}">${esc(cfg.footer)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2400" viewBox="0 0 900 1200" font-family="${JP}"><title>${esc(cfg.outputName)}</title>
  <defs>
    ${G.defs.join('\n    ')}
  </defs>
${body}
</svg>
`;
}

module.exports = { renderFlyer, esc };
