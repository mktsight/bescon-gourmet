// 各フライヤーの文言（旧デザインから一字一句保持。timeline の '|' は改行位置のみ）
// 追加を許可された文言: 〇〇編 / コンセプト帯 / 消費カロリー / ご褒美バッジ
const food = require('./food');
const tryScene = (name) => {
  try { return require('./' + name); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; return () => '<rect width="820" height="330" fill="#ddd"/>'; }
};

module.exports = [
  {
    file: '開催案内.svg', png: 'BCG企画_山寺編.png', edition: '山寺編', place: 'YAMADERA',
    pal: { main: '#c0603a', dark: '#93462a', tint: '#f5e6dc', tint2: '#f1d6c4', warm: '#e0913f', glow: '#f7d6a6' },
    subtitle: '山寺の石段を登って、整った体で板そばと乾杯',
    kcal: '600',
    rows: [
      { label: '日時', value: '2026年11月14日（土）9:30集合' },
      { label: '集合', value: '山寺（立石寺）登山口', sub: '※JR仙山線「山寺駅」すぐ' },
      { label: '運動', value: '立石寺の石段 約1015段を登頂' },
      { label: '食事', value: '下山後、ふもとや本店で板そば＆乾杯' },
      { label: '持ち物', value: '滑りにくい靴・動ける服装・飲み物・防寒着' },
    ],
    notes: ['※9名・土曜昼は混雑のため店は事前予約。', '　きつい人は途中の見晴らし台をゴールにしてもOK'],
    timeline: [
      { t: '9:30', label: '登山口に集合・|準備運動' },
      { t: '9:45', label: '石段を各自の|ペースで登る' },
      { t: '11:00', label: '奥之院で登頂・|全員で記念撮影' },
      { t: '11:45', label: '下山して|ふもとや本店へ' },
      { t: '12:00', label: '板そばで乾杯・|次回ゴール相談' },
    ],
    trail: 'M262 168 Q330 240 430 226 Q520 214 566 182',
    scene: tryScene('scene_yamadera'), reward: food.sobaReward,
  },
  {
    file: '開催案内_蔵王ライザ.svg', png: 'BCG企画_蔵王ライザ編.png', edition: '蔵王ライザ編', place: 'ZAO',
    pal: { main: '#3d6a98', dark: '#2a4e74', tint: '#e2eaf3', tint2: '#d3e0ee', warm: '#5f8fbf', glow: '#f6dcb0' },
    subtitle: '蔵王の高原を歩いて、整った体で石窯ピザと乾杯',
    caution: true,
    kcal: '550',
    rows: [
      { label: '日時', value: '2026年11月14日（土）9:30集合' },
      { label: '集合', value: '蔵王ライザワールド', sub: '※現地集合（上山市蔵王）' },
      { label: '運動', value: '高原・ゲレンデ斜面の軽ハイクで標高差ウォーク' },
      { label: '食事', value: 'ライザレストランでイタリア直輸入の石窯ピザ＆乾杯' },
      { label: '持ち物', value: '防寒着（必須）・歩きやすい靴・手袋・飲み物' },
    ],
    notes: ['※11月中旬は冷え込み強め。防寒重視で、天候が悪ければ屋内中心に。', '　店の営業状況（冬季スキー場営業前）は事前に必ず確認を。'],
    timeline: [
      { t: '9:30', label: '蔵王ライザに|集合・準備運動' },
      { t: '9:45', label: '高原を各自の|ペースでハイク' },
      { t: '11:00', label: '見晴らしポイント|で記念撮影' },
      { t: '11:45', label: 'レストランへ|移動' },
      { t: '12:00', label: '石窯ピザで乾杯・|次回ゴール相談' },
    ],
    trail: 'M450 262 Q520 250 548 215 Q560 198 568 180',
    scene: tryScene('scene_zao'), reward: food.pizzaReward,
  },
  {
    file: '開催案内_上山.svg', png: 'BCG企画_上山編.png', edition: '上山編', place: 'KAMINOYAMA',
    pal: { main: '#875683', dark: '#643d61', tint: '#efe4ee', tint2: '#e6d3e4', warm: '#b6729a', glow: '#f5d6b4' },
    subtitle: '温泉街を歩いて、ととのえた体でワインと乾杯',
    kcal: '350',
    rows: [
      { label: '日時', value: '2026年11月14日（土）9:30集合' },
      { label: '集合', value: 'かみのやま温泉駅', sub: '※JR奥羽本線でアクセス' },
      { label: '運動', value: '城下町さんぽ＋上山城までの坂道ウォーク' },
      { label: '食事', value: '温泉でととのえてから、地元ワイン＆創作和食で乾杯' },
      { label: '持ち物', value: '歩きやすい靴・飲み物・（希望者は）入浴セット' },
    ],
    notes: ['※運動の強度を低めにできる回。温泉→乾杯の流れでコンディションを物理的に整えられる。', '　9名・土曜夜は店が混むため事前予約を。入浴は日帰り温泉の利用時間を確認。'],
    timeline: [
      { t: '9:30', label: 'かみのやま温泉駅|に集合' },
      { t: '9:45', label: '城下町さんぽ・|上山城へ' },
      { t: '11:00', label: '上山城で|記念撮影' },
      { t: '11:30', label: '日帰り温泉で|ととのえる' },
      { t: '12:30', label: 'ワイン＆料理で|乾杯' },
    ],
    trail: 'M370 232 Q450 214 510 192 Q545 176 566 160',
    scene: tryScene('scene_kaminoyama'), reward: food.wineReward,
  },
  {
    file: '開催案内_山形駅前.svg', png: 'BCG企画_山形駅前編.png', edition: '山形駅前編', place: 'YAMAGATA STATION',
    pal: { main: '#47805d', dark: '#305e43', tint: '#e2eee5', tint2: '#d2e5d8', warm: '#6fa067', glow: '#f6dab0' },
    subtitle: '公園を歩いて、整った体で山形牛と乾杯',
    kcal: '400',
    rows: [
      { label: '日時', value: '2026年11月14日（土）9:30集合' },
      { label: '集合', value: 'JR山形駅', sub: '※全員が集まりやすいアクセス重視' },
      { label: '運動', value: '霞城公園（山形城跡）の周回ウォーク／ジョグ' },
      { label: '食事', value: '駅前の山形牛の店で焼肉＆乾杯' },
      { label: '持ち物', value: '歩きやすい靴・動ける服装・飲み物' },
    ],
    notes: ['※移動負担が小さく短時間でも開催できる、集まりやすい回。', '　9名・土曜昼は人気店が混むため事前予約を。二次会もしやすい立地。'],
    timeline: [
      { t: '9:30', label: '山形駅に集合・|準備運動' },
      { t: '9:45', label: '霞城公園を周回|ウォーク／ジョグ' },
      { t: '11:00', label: '公園で|記念撮影' },
      { t: '11:45', label: '駅前の店へ|移動' },
      { t: '12:00', label: '山形牛で乾杯・|次回ゴール相談' },
    ],
    trail: 'M222 292 Q380 280 480 268 Q545 258 568 222',
    scene: tryScene('scene_ekimae'), reward: food.beefReward,
  },
];
