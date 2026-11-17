(() => {
'use strict';

// ===== 기본 설정 =====
const W = 400, H = 836;
const DY = 56;              // 손님 자리 아래(카운터·진열대·굽는 판·도구)를 내리는 값
const DAY_LEN = 90;          // 하루 영업 시간(초)
const SAVE_KEY = 'bungeo-boss-v1';

const TYPES = {
  red:   { name: '팥',    price: 1000, cost: 150, color: '#6e2018', dot: '#4a120c', unlock: 1, icon: '🫘' },
  cream: { name: '슈크림', price: 1000, cost: 200, color: '#f4d470', dot: '#e3b23c', unlock: 1, icon: '🍮' },
  choco: { name: '초코',  price: 1200, cost: 250, color: '#5a3320', dot: '#3a1d10', unlock: 2, icon: '🍫' },
  pizza: { name: '피자',  price: 1500, cost: 350, color: '#d8452b', dot: '#f6d24a', unlock: 3, icon: '🍕' },
};
const TYPE_KEYS = ['red', 'cream', 'choco', 'pizza'];
const BATTER_COST = 150;

// 반죽 눈금: 첫 번째(절반), 두 번째(가득)
const ZONE1 = [35, 55];
const ZONE2 = [88, 100];
const POUR_RATE = 42;        // %/초
// 익힘: 0.75~1.05 알맞음, 1.35 넘으면 탐
const COOK_BASE = 1 / 9;     // 9초면 알맞게 익음
const DONE_LO = 0.75, DONE_HI = 1.05, BURN = 1.35;

const UPGRADES = [
  { key: 'molds', icon: '🐟', name: '붕어빵 틀 추가', desc: '한 번에 구울 수 있는 틀이 1개 늘어요.', max: 3, costs: [6000, 14000, 26000] },
  { key: 'fire',  icon: '🔥', name: '화력 강화', desc: '더 빨리 익어요. (타는 것도 빨라져요!)', max: 3, costs: [5000, 11000, 20000] },
  { key: 'heater',icon: '♨️', name: '손님 난로', desc: '손님이 15% 더 오래 기다려 줘요.', max: 3, costs: [4000, 9000, 16000] },
  { key: 'alba',  icon: '🧑‍🍳', name: '알바생 고용', desc: '5초마다 붕어빵 1개를 구워 진열대에 올려요. (별 2개, 재료비 있음)', max: 3, costs: [8000, 16000, 30000] },
  { key: 'sign',  icon: '🏮', name: '간판 새로 달기', desc: '붕어빵 값 +10%, 손님이 조금 더 자주 와요.', max: 3, costs: [7000, 15000, 28000] },
];

// ===== 달력·계절 =====
// 하루 장사 = 게임 속 1주, 4주 = 1달. 1주차는 11월 1주.
function calOf(day) {
  const w = day - 1, mi = 10 + Math.floor(w / 4);
  return { year: 1 + Math.floor(mi / 12), month: (mi % 12) + 1, week: (w % 4) + 1 };
}
function calLabel(day) { const c = calOf(day); return c.month + '월 ' + c.week + '주'; }
function seasonOf(day) {
  const m = calOf(day).month;
  if (m === 12 || m <= 2) return { name: '겨울', tag: '성수기', icon: '❄️', mult: 1, snow: true, line: '붕어빵 찾는 손님이 가장 많아요.' };
  if (m === 11) return { name: '늦가을', tag: '', icon: '🍂', mult: 0.9, snow: false, line: '찬 바람이 불기 시작해요. 붕어빵 철이 다가와요.' };
  if (m <= 5) return { name: '봄', tag: '', icon: '🌸', mult: 0.75, snow: false, line: '날이 풀려서 손님이 조금 줄었어요.' };
  if (m <= 8) return { name: '여름', tag: '비수기', icon: '☀️', mult: 0.5, snow: false, line: '더워서 손님이 절반으로 줄어요.' };
  return { name: '가을', tag: '', icon: '🍁', mult: 0.8, snow: false, line: '선선해지니 붕어빵 생각나는 손님이 늘어요.' };
}

// ===== 경영 위기 =====
const CRISES = {
  redbean: { icon: '🫘', title: '팥값 폭등!', weeks: 3, base: { redCost: 2 },
    text: '흉년으로 팥 도매가가 2배가 됐어요. 3주 동안 팥 재료비가 2배예요.',
    choices: [
      { label: '팥 붕어빵 값 올리기', desc: '팥 +300원, 대신 손님이 덜 기다려 줘요(−15%)', fx: { redPrice: 300, patience: -0.15 } },
      { label: '그대로 팔기', desc: '값은 그대로, 이익만 줄어요', fx: {} },
      { label: '슈크림·초코 할인 행사', desc: '손님이 팥을 덜 찾고, 슈크림·초코 −10%', fx: { redWeight: 0.3, discount: 0.1 } },
    ] },
  cold: { icon: '🥶', title: '최강 한파 경보', weeks: 1, base: { rate: 1.4 }, winterOnly: true,
    text: '이번 주 영하 15도! 붕어빵 찾는 손님이 40% 늘어요.',
    choices: [
      { label: '손님께 핫팩 나눠주기', desc: '2,000원, 손님이 30% 더 기다려 줘요', cost: 2000, fx: { patience: 0.3 } },
      { label: '그냥 영업', desc: '추워서 손님이 빨리 지쳐요(−10%)', fx: { patience: -0.1 } },
    ] },
  inspect: { icon: '📋', title: '위생 점검 예고', weeks: 1, base: {},
    text: '이번 주 구청에서 위생 점검을 나와요. 탄 붕어빵이 많으면 다음 주는 영업정지!',
    choices: [
      { label: '대청소 하기', desc: '3,000원, 탄 붕어빵 5개까지 봐줘요', cost: 3000, fx: { burnLimit: 5 } },
      { label: '그냥 받기', desc: '탄 붕어빵 3개부터 영업정지', fx: { burnLimit: 3 } },
    ] },
  viral: { icon: '📱', title: 'SNS에서 대박!', weeks: 1, base: { rate: 2 }, needRating: 2.5,
    text: '"겉바속촉 붕어빵 맛집" 영상이 퍼졌어요. 이번 주 손님이 2배예요!',
    choices: [
      { label: '번호표 나눠주기', desc: '3,000원, 손님이 30% 더 기다려 줘요', cost: 3000, fx: { patience: 0.3 } },
      { label: '그냥 받기', desc: '줄이 길어 손님이 빨리 지쳐요(−20%)', fx: { patience: -0.2 } },
    ] },
};
const SHOP_COST = 50000, RENT = 6000;

// ===== 2차: 동네·직영점·은행 =====
// 가상 동네. traffic = 손님 많음 정도, rent = 주 월세, fav = 잘 팔리는 맛
const AREAS = [
  { id: 'school',  icon: '📚', name: '학원가',   traffic: 1.1, rent: 7000,  fav: '슈크림·초코', desc: '학생 손님이 많아요. 저녁에 붐벼요.' },
  { id: 'station', icon: '🚉', name: '역 앞',    traffic: 1.5, rent: 14000, fav: '팥', desc: '오가는 사람이 가장 많지만 월세가 비싸요.' },
  { id: 'college', icon: '🎓', name: '대학가',   traffic: 1.2, rent: 9000,  fav: '피자', desc: '방학(여름·겨울 일부)엔 손님이 줄어요.' },
  { id: 'village', icon: '🏘️', name: '주택가',   traffic: 0.8, rent: 4000,  fav: '팥', desc: '손님은 적지만 월세가 싸고 꾸준해요.' },
  { id: 'tour',    icon: '🎡', name: '관광지',   traffic: 1.3, rent: 12000, fav: '모든 맛', desc: '계절을 덜 타요. 여름에도 손님이 꽤 와요.' },
];
const BRANCH_COSTS = [120000, 180000, 250000, 330000];
const NEED_RATING = 4.0;
const MGR_FIRST = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];
const MGR_TRAIT = [['꼼꼼한', 0], ['손 빠른', 1], ['친절한', 1], ['베테랑', 2], ['신입', -1]];
function makeManagers() {
  const list = [];
  for (let i = 0; i < 3; i++) {
    const skill = 1 + (Math.random() * 5 | 0);          // 1~5
    const tr = MGR_TRAIT[Math.random() * MGR_TRAIT.length | 0];
    const sk = Math.max(1, Math.min(5, skill + tr[1]));
    list.push({ name: MGR_FIRST[Math.random() * MGR_FIRST.length | 0] + ' 점장', trait: tr[0], skill: sk, wage: 2000 + sk * 1200 });
  }
  return list;
}
function areaOf(id) { return AREAS.find(a => a.id === id); }
// 직영점 한 곳의 이번 주 자동 정산
function branchWeek(b, day, steady) {
  const a = areaOf(b.area), se = seasonOf(day);
  let sm = se.mult;
  if (a.id === 'tour') sm = 0.5 + se.mult * 0.5;                 // 계절을 덜 탐
  if (a.id === 'college' && (calOf(day).month === 7 || calOf(day).month === 8 || calOf(day).month === 1)) sm *= 0.6; // 방학
  const ratingF = 0.7 + Math.min(5, save.rating) * 0.08;
  const sales = Math.round(30000 * a.traffic * sm * (0.6 + 0.1 * b.mgr.skill) * ratingF * (steady ? 1 : 0.9 + Math.random() * 0.2) * eff().rate / 10) * 10;
  const cost = Math.round(sales * 0.3 / 10) * 10;
  return { sales, cost, rent: a.rent, wage: b.mgr.wage, net: sales - cost - a.rent - b.mgr.wage };
}
function loanLimit() { return 100000 + 50000 * save.branches.length + (save.shop ? 50000 : 0); }
const INTEREST = 0.02;   // 주 2%

// 지금 걸린 위기의 효과 모음
function eff() {
  const e = { rate: 1, patience: 0, redCost: 1, redPrice: 0, redWeight: 1, discount: 0, burnLimit: 0 };
  const c = save.crisis;
  if (!c || c.choice == null) return e;
  const def = CRISES[c.id];
  const fx = Object.assign({}, def.base, def.choices[c.choice].fx);
  for (const k in fx) e[k] = fx[k];
  return e;
}
function costOf(t) { return TYPES[t].cost * (t === 'red' ? eff().redCost : 1); }
function trayMax() { return save.shop ? 24 : 16; }

// ===== 저장 =====
function freshSave() {
  return { day: 1, money: 0, upg: { molds: 0, fire: 0, heater: 0, sign: 0, alba: 0 }, best: 0, total: 0,
    shop: false, rating: 0, crisis: null, lastCrisis: 0, suspended: false,
    branches: [], debt: 0, negWeeks: 0, legacy: 0 };
}
let save = freshSave();
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s && s.day) save = Object.assign(save, s, { upg: Object.assign(save.upg, s.upg || {}) });
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ===== 캔버스 =====
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
let isPC = false;
function resize() {
  let vw = window.innerWidth;
  const vh = window.innerHeight;
  // 넓은 PC 화면이면 양옆에 현황판을 두고 가운데 게임
  isPC = vw >= 1000 && vw / vh >= 1.25;
  document.body.classList.toggle('pc', isPC);
  if (isPC) vw -= 2 * 300 + 48;
  scale = Math.min(vw / W, vh * 0.98 / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.style.width = (W * scale) + 'px';
  cv.style.height = (H * scale) + 'px';
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
resize();

// ===== 소리 =====
let actx = null, soundOn = true;
function beep(freq, dur, type, vol, slide) {
  if (!soundOn) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  coin() { beep(988, .08, 'square', .05); setTimeout(() => beep(1319, .14, 'square', .05), 70); },
  pop() { beep(520, .08, 'sine', .1, 900); },
  clank() { beep(160, .12, 'triangle', .12, 90); },
  bad() { beep(220, .25, 'sawtooth', .05, 110); },
  plop() { beep(300, .06, 'sine', .09, 180); },
};

// ===== 레이아웃 =====
const CELL_W = 128, CELL_H = 150, GRILL_X = 8, GRILL_Y = 304;
function cellRect(i) {
  const r = Math.floor(i / 3), c = i % 3;
  return { x: GRILL_X + c * CELL_W, y: GRILL_Y + r * CELL_H };
}
const TOOL_Y = 664;
const TOOLS = ['batter', 'red', 'cream', 'choco', 'pizza'];
function toolRect(i) { return { x: 6 + i * 78, y: TOOL_Y, w: 74, h: 98 }; }
const CUST_X = [72, 200, 328];

// ===== 게임 상태 =====
let G = null;
let tool = 'batter';
let paused = false, running = false;
let lastMold = 0;

function moldCount() { return 3 + save.upg.molds; }
function unlocked(t) { return save.day >= TYPES[t].unlock; }
function priceOf(t) {
  const e = eff();
  let p = TYPES[t].price * (1 + 0.1 * save.upg.sign) + (t === 'red' ? e.redPrice : 0);
  if (t === 'cream' || t === 'choco') p *= 1 - e.discount;
  return Math.round(p / 10) * 10;
}

function newMold() {
  return { state: 'empty', fill: 0, fill1: 0, filling: null, dA: 0, dB: 0, flipAnim: 0, overflow: false, pouring: false, cooking: false };
}

function startDay() {
  G = {
    t: 0, molds: [], tray: [], customers: [null, null, null], nextCust: 5, albaT: 0,
    floats: [], stats: { sold: 0, revenue: 0, tips: 0, cost: 0, happy: 0, angry: 0, burnt: 0, waste: 0, starSum: 0 },
    pointers: {}, closing: false, msg: '', msgT: 0, smoke: [],
  };
  for (let i = 0; i < moldCount(); i++) G.molds.push(newMold());
  tool = 'batter';
  running = true; paused = false;
  hideAll();
  if (save.day === 1 && save.total === 0) say('반죽 주전자로 틀을 꾹 눌러 보세요!', 4);
  else say(calLabel(save.day) + ' 장사 시작!', 2);
}

function say(m, t) { G.msg = m; G.msgT = t || 2.2; }
function float(x, y, text, color) { G.floats.push({ x, y, text, color: color || '#fff', t: 0 }); }

// ===== 손님 =====
const SKINS = ['#f6d3b3', '#eec19a', '#d9a47c', '#f9e0c8'];
const HAIRS = ['#2b1d16', '#4a2e1c', '#7a4a26', '#1c1c24', '#a05a2c', '#c9c0b8'];
const COATS = ['#3d6bb3', '#b34a3d', '#3d8a5f', '#8a5fb3', '#e09a2c', '#4a4a5a', '#d06a8a'];
const HAPPY_LINES = ['최고예요!', '바삭바삭!', '또 올게요~', '겉바속촉!', '역시 여기!'];
const OK_LINES = ['맛있네요', '잘 먹을게요', '감사합니다'];
const MEH_LINES = ['음… 덜 익었나?', '좀 아쉽네요', '속이 좀…'];

function spawnCustomer() {
  const slots = [0, 1, 2].filter(i => !G.customers[i]);
  if (!slots.length) return;
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const e = eff();
  let avail = TYPE_KEYS.filter(unlocked);
  if (e.redWeight < 1 && avail.length > 1 && Math.random() > e.redWeight) avail = avail.filter(t => t !== 'red');
  const maxN = Math.min(1 + save.day, 5);
  const total = 1 + Math.floor(Math.random() * maxN);
  const order = {};
  const kinds = Math.min(avail.length, 1 + Math.floor(Math.random() * Math.min(3, total)));
  const pick = avail.slice().sort(() => Math.random() - .5).slice(0, kinds);
  for (let i = 0; i < total; i++) { const k = pick[i % pick.length]; order[k] = (order[k] || 0) + 1; }
  const pat = Math.max(26, 46 - Math.min(save.day, 12) * 1.5 + total * 4) * (1 + 0.15 * save.upg.heater) * (1 + e.patience);
  G.customers[slot] = {
    order, patience: pat, maxPat: pat, enter: 0, leave: 0, mood: null, line: '', lineT: 0,
    skin: SKINS[Math.random() * SKINS.length | 0], hair: HAIRS[Math.random() * HAIRS.length | 0],
    coat: COATS[Math.random() * COATS.length | 0], hat: Math.random() < .4, bob: Math.random() * 6,
  };
}

function trayCount(t) { return G.tray.filter(b => b.type === t).length; }

function serve(slot) {
  const c = G.customers[slot];
  if (!c || c.leave) return;
  const missing = Object.keys(c.order).filter(t => trayCount(t) < c.order[t]);
  if (missing.length) {
    say(missing.map(t => TYPES[t].name).join('·') + ' 붕어빵이 부족해요');
    sfx.bad();
    return;
  }
  let money = 0, stars = 0, n = 0;
  for (const t of Object.keys(c.order)) {
    const list = G.tray.filter(b => b.type === t).sort((a, b) => b.stars - a.stars).slice(0, c.order[t]);
    for (const b of list) {
      G.tray.splice(G.tray.indexOf(b), 1);
      const mult = b.stars === 3 ? 1 : b.stars === 2 ? .9 : .7;
      money += priceOf(t) * mult; stars += b.stars; n++;
    }
  }
  const avg = stars / n;
  let tip = 0;
  if (avg >= 2.8 && c.patience / c.maxPat > .45) tip = Math.round(money * .15 / 10) * 10;
  money = Math.round(money / 10) * 10;
  G.stats.sold += n; G.stats.revenue += money; G.stats.tips += tip; G.stats.starSum += stars;
  G.stats.happy++;
  c.leave = 0.001;
  c.mood = avg >= 2.5 ? 'happy' : avg >= 1.8 ? 'ok' : 'meh';
  const lines = c.mood === 'happy' ? HAPPY_LINES : c.mood === 'ok' ? OK_LINES : MEH_LINES;
  c.line = lines[Math.random() * lines.length | 0]; c.lineT = 1.6;
  float(CUST_X[slot], 140, '+' + (money + tip).toLocaleString() + '원' + (tip ? ' (팁!)' : ''), '#ffe27a');
  sfx.coin();
}

// ===== 틀 조작 =====
function canPour(m) { return m.state === 'empty' || m.state === 'pour1' || m.state === 'filled' || m.state === 'pour2'; }

function startPour(i) {
  const m = G.molds[i];
  if (!canPour(m)) {
    if (m.state === 'closedA' || m.state === 'closedB') say('뚜껑이 덮여 있어요');
    return false;
  }
  if (m.state === 'empty') { m.state = 'pour1'; m.fill = 0; m.cooking = true; G.stats.cost += BATTER_COST; sfx.plop(); }
  if (m.state === 'filled') { m.state = 'pour2'; }
  m.pouring = true;
  return true;
}
function stopPour(i) { const m = G.molds[i]; if (m) m.pouring = false; }

function addFilling(i, t) {
  const m = G.molds[i];
  if (!unlocked(t)) { say(TYPES[t].name + ' 붕어빵은 ' + TYPES[t].unlock + '주차부터 팔아요'); return; }
  if (m.state === 'empty') { say('먼저 반죽을 절반쯤 부어요'); sfx.bad(); return; }
  if (m.state !== 'pour1') { say(m.filling ? '이미 속을 넣었어요. 반죽 주전자를 골라 마저 부어요' : '이제는 속을 넣을 수 없어요'); return; }
  m.filling = t; m.fill1 = m.fill; m.state = 'filled';
  G.stats.cost += costOf(t);
  sfx.pop();
}

function moldAction(i) {
  const m = G.molds[i];
  if (m.state === 'pour1' || m.state === 'filled' || m.state === 'pour2') {
    if (m.state === 'pour1') m.fill1 = m.fill;
    m.state = 'closedA'; m.pouring = false; m.flipAnim = 1; sfx.clank();
  } else if (m.state === 'closedA') {
    m.state = 'closedB'; m.flipAnim = 1; sfx.clank();
  } else if (m.state === 'closedB') {
    takeOut(i);
  }
}

function evaluate(m) {
  const notes = [];
  let score = 100;
  if (!m.filling) return { plain: true };
  if (m.dA > BURN || m.dB > BURN) return { burnt: true };
  const f1 = m.fill1, f2 = m.fill;
  if (f1 < ZONE1[0] - 12 || f1 > ZONE1[1] + 12) { score -= 15; notes.push(f1 < ZONE1[0] ? '속이 바닥에 붙음' : '속이 위로 뜸'); }
  else if (f1 < ZONE1[0] || f1 > ZONE1[1]) score -= 6;
  if (f2 < 75) { score -= 25; notes.push('반죽이 모자람'); }
  else if (f2 < ZONE2[0]) score -= 8;
  else if (f2 > 108) { score -= 20; notes.push('반죽이 넘침'); }
  else if (f2 > ZONE2[1]) score -= 5;
  for (const d of [m.dA, m.dB]) {
    if (d < 0.5) { score -= 40; notes.push('설익음'); }
    else if (d < DONE_LO) { score -= 15; notes.push('덜 익음'); }
    else if (d > DONE_HI) { score -= 12; notes.push('조금 탐'); }
  }
  const stars = score >= 85 ? 3 : score >= 60 ? 2 : 1;
  return { stars, score, notes };
}

function takeOut(i) {
  const m = G.molds[i];
  const r = evaluate(m);
  const cr = cellRect(i);
  const fx = cr.x + CELL_W / 2, fy = cr.y + 70 + DY;
  if (r.burnt) {
    G.stats.burnt++; say('앗, 새까맣게 탔어요… 버려야 해요'); sfx.bad();
    float(fx, fy - 30, '탔어요 🔥', '#ff8a6a');
  } else if (r.plain) {
    G.stats.waste++; say('앙꼬 없는 붕어빵은 팔 수 없어요'); sfx.bad();
    float(fx, fy - 30, '속이 없어요', '#ffb0a0');
  } else if (G.tray.length >= trayMax()) {
    G.stats.waste++; say('진열대가 꽉 찼어요! 손님에게 먼저 파세요'); sfx.bad();
  } else {
    G.tray.push({ type: m.filling, stars: r.stars, dA: m.dA, dB: m.dB });
    save.total++;
    float(fx, fy - 30, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), '#ffe27a');
    if (r.notes.length) say(r.notes.slice(0, 2).join(', '), 1.6);
    sfx.pop();
  }
  G.molds[i] = newMold();
}

// ===== 입력 =====
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}
function inR(p, x, y, w, h) { return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h; }

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!running || paused) return;
  const p = toLogical(e);
  // 일시정지
  if (inR(p, W - 50, 6, 44, 36)) { pauseGame(); return; }
  // 손님
  for (let s = 0; s < 3; s++) {
    if (G.customers[s] && inR(p, CUST_X[s] - 62, 60, 124, 200 + DY - 60)) { serve(s); return; }
  }
  const q = { x: p.x, y: p.y - DY };
  // 도구
  for (let i = 0; i < TOOLS.length; i++) {
    const r = toolRect(i);
    if (inR(q, r.x, r.y, r.w, r.h)) {
      const t = TOOLS[i];
      if (t !== 'batter' && !unlocked(t)) { say(TYPES[t].name + ' 붕어빵은 ' + TYPES[t].unlock + '주차부터 팔아요'); return; }
      tool = t; beep(700, .04, 'sine', .05); return;
    }
  }
  // 틀
  for (let i = 0; i < G.molds.length; i++) {
    const c = cellRect(i);
    if (inR(q, c.x + 18, c.y + 116, 92, 30)) { lastMold = i; moldAction(i); return; }
    if (inR(q, c.x + 4, c.y + 18, 120, 98)) {
      lastMold = i;
      if (tool === 'batter') {
        if (startPour(i)) { G.pointers[e.pointerId] = i; try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
      } else addFilling(i, tool);
      return;
    }
  }
  // 잠긴 틀
  for (let i = G.molds.length; i < 6; i++) {
    const c = cellRect(i);
    if (inR(q, c.x, c.y, CELL_W, CELL_H)) { say('하루 장사가 끝나면 가게 업그레이드에서 틀을 늘릴 수 있어요'); return; }
  }
}, { passive: false });
function endPointer(e) {
  if (!G) return;
  const i = G.pointers[e.pointerId];
  if (i !== undefined) { stopPour(i); delete G.pointers[e.pointerId]; }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e => e.preventDefault());

// ===== 업데이트 =====
function update(dt) {
  if (!running || paused) return;
  G.t += dt;
  const fire = 1 + 0.18 * save.upg.fire;

  // 손님 오기
  if (!G.closing) {
    G.nextCust -= dt;
    if (G.nextCust <= 0) {
      spawnCustomer();
      const base = Math.max(7, 15 - save.day * 0.8) * (1 - 0.08 * save.upg.sign);
      const busy = seasonOf(save.day).mult * (save.shop ? 1.3 : 1) * eff().rate;
      G.nextCust = base / busy * (0.75 + Math.random() * 0.5);
    }
  }
  for (let s = 0; s < 3; s++) {
    const c = G.customers[s];
    if (!c) continue;
    c.enter = Math.min(1, c.enter + dt * 3);
    c.bob += dt;
    if (c.lineT > 0) c.lineT -= dt;
    if (c.leave) {
      c.leave += dt;
      if (c.leave > 1.4) G.customers[s] = null;
      continue;
    }
    c.patience -= dt;
    if (c.patience <= 0) {
      c.leave = 0.001; c.mood = 'angry'; c.line = '너무 오래 걸려요!'; c.lineT = 1.4;
      G.stats.angry++; sfx.bad();
    }
  }

  // 틀
  G.molds.forEach((m, i) => {
    if (m.pouring && canPour(m)) {
      m.fill = Math.min(125, m.fill + POUR_RATE * dt);
      if (m.fill > 108 && !m.overflow) { m.overflow = true; say('반죽이 넘쳐요!'); }
    }
    if (m.cooking) {
      if (m.state === 'closedB') m.dB += COOK_BASE * fire * dt;
      else m.dA += COOK_BASE * fire * dt;
      // 윗면은 덮은 뒤 아주 조금 익음 (열기)
      if (m.state === 'closedA') m.dB += COOK_BASE * fire * dt * 0.12;
    }
    if (m.flipAnim > 0) m.flipAnim = Math.max(0, m.flipAnim - dt * 4);
    const d = m.state === 'closedB' ? m.dB : m.dA;
    if (m.cooking && d > DONE_HI && Math.random() < dt * (d > BURN ? 14 : 5)) {
      const c = cellRect(i);
      G.smoke.push({ x: c.x + 40 + Math.random() * 48, y: c.y + 60, t: 0, dark: d > BURN });
    } else if (m.cooking && Math.random() < dt * 2.5) {
      const c = cellRect(i);
      G.smoke.push({ x: c.x + 40 + Math.random() * 48, y: c.y + 60, t: 0, steam: true });
    }
  });
  // 알바생: 5초마다 한 명당 1개씩 구움
  if (save.upg.alba > 0 && !G.closing) {
    G.albaT += dt;
    if (G.albaT >= 5) {
      G.albaT -= 5;
      for (let k = 0; k < save.upg.alba; k++) albaBake();
    }
  }
  G.smoke = G.smoke.filter(s => (s.t += dt) < 1.6);
  G.floats = G.floats.filter(f => (f.t += dt) < 1.4);
  if (G.msgT > 0) G.msgT -= dt;

  // 영업 종료
  if (G.t >= DAY_LEN && !G.closing) {
    G.closing = true; say('영업 마감! 남은 손님만 받아요', 3);
    for (const p in G.pointers) stopPour(G.pointers[p]);
  }
  if (G.closing && (G.customers.every(c => !c) || G.t >= DAY_LEN + 12)) endDay();
}

// 알바생이 구울 맛: 기다리는 손님에게 모자란 맛 먼저
function albaBake() {
  if (G.tray.length >= trayMax()) return;
  const need = {};
  for (const c of G.customers) if (c && !c.leave) for (const t in c.order) need[t] = (need[t] || 0) + c.order[t];
  let pick = null, gap = 0;
  for (const t in need) { const g = need[t] - trayCount(t); if (g > gap) { gap = g; pick = t; } }
  if (!pick) { const av = TYPE_KEYS.filter(unlocked); pick = av[Math.random() * av.length | 0]; }
  G.tray.push({ type: pick, stars: 2, alba: true });
  G.stats.cost += BATTER_COST + costOf(pick);
  float(W / 2, 290 + DY - 40, '알바생: ' + TYPES[pick].name + ' 1개!', '#bfe8ff');
}

// ===== 그리기 =====
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fishPath(cx, cy, w, h) {
  const L = cx - w / 2, R = cx + w / 2;
  ctx.beginPath();
  ctx.moveTo(L, cy);
  ctx.bezierCurveTo(L, cy - h * 0.58, cx + w * 0.08, cy - h * 0.62, cx + w * 0.28, cy - h * 0.1);
  ctx.lineTo(R, cy - h * 0.46);
  ctx.quadraticCurveTo(R - w * 0.09, cy, R, cy + h * 0.46);
  ctx.lineTo(cx + w * 0.28, cy + h * 0.1);
  ctx.bezierCurveTo(cx + w * 0.08, cy + h * 0.62, L, cy + h * 0.58, L, cy);
  ctx.closePath();
}
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * t;
  const g = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t;
  const bl = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
}
function bakeColor(d) {
  const stops = [[0, '#f7e8b8'], [0.5, '#f0cf7a'], [0.9, '#dc9a3c'], [1.15, '#a8602a'], [1.4, '#4a2a16'], [1.8, '#1a1210']];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const t = (d - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return lerpColor(stops[i - 1][1], stops[i][1], Math.max(0, t));
    }
  }
  return '#1a1210';
}
// 다 구운 붕어빵 그림
function drawBun(cx, cy, w, h, d, filling) {
  ctx.save();
  fishPath(cx, cy, w, h);
  ctx.fillStyle = bakeColor(d);
  ctx.fill();
  // 빛
  ctx.save(); ctx.clip();
  const hl = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  hl.addColorStop(0, 'rgba(255,255,230,.45)'); hl.addColorStop(.45, 'rgba(255,255,230,0)');
  hl.addColorStop(1, 'rgba(60,20,0,.25)');
  ctx.fillStyle = hl; ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  ctx.restore();
  ctx.lineWidth = Math.max(1.2, w / 50); ctx.strokeStyle = 'rgba(90,40,10,.55)';
  ctx.stroke();
  // 비늘
  ctx.strokeStyle = 'rgba(110,50,15,.45)'; ctx.lineWidth = Math.max(1, w / 70);
  const sx = cx - w * 0.12, sy = cy;
  for (let r = -1; r <= 1; r++) for (let c = 0; c < 3; c++) {
    ctx.beginPath();
    ctx.arc(sx + c * w * 0.11 + (r & 1) * w * 0.055, sy + r * h * 0.17, w * 0.055, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
  }
  // 아가미
  ctx.beginPath(); ctx.arc(cx - w * 0.3, cy, h * 0.3, -Math.PI * 0.35, Math.PI * 0.35); ctx.stroke();
  // 꼬리 줄
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath(); ctx.moveTo(cx + w * 0.32, cy + k * h * 0.05); ctx.lineTo(cx + w * 0.46, cy + k * h * 0.28); ctx.stroke();
  }
  // 눈
  ctx.fillStyle = 'rgba(70,30,8,.8)';
  ctx.beginPath(); ctx.arc(cx - w * 0.37, cy - h * 0.12, Math.max(1.5, w * 0.03), 0, 7); ctx.fill();
  // 속 표시 (입가에 살짝 삐져나온 속)
  if (filling && d < BURN) {
    ctx.fillStyle = TYPES[filling].color;
    ctx.beginPath(); ctx.ellipse(cx + w * 0.02, cy + h * 0.42, w * 0.07, h * 0.06, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawMiniFish(x, y, t, s) {
  drawBun(x, y, 30 * s, 18 * s, 0.95, null);
  ctx.fillStyle = TYPES[t].color;
  ctx.strokeStyle = TYPES[t].dot; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x - 1 * s, y + 1 * s, 4 * s, 0, 7); ctx.fill(); ctx.stroke();
}

function drawBackground() {
  // 밤하늘
  const sky = ctx.createLinearGradient(0, 0, 0, 240 + DY);
  sky.addColorStop(0, '#1b2240'); sky.addColorStop(1, '#3a3f6e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 240 + DY);
  // 골목 건물
  ctx.fillStyle = '#272b4f';
  ctx.fillRect(0, 90, 90, 210); ctx.fillRect(300, 80, 100, 220); ctx.fillRect(150, 115, 110, 185);
  ctx.fillStyle = '#ffd98a';
  for (const [x, y] of [[18, 112], [52, 112], [18, 150], [320, 104], [356, 104], [356, 142], [170, 136], [214, 136]]) {
    ctx.globalAlpha = .55; ctx.fillRect(x, y, 18, 22); ctx.globalAlpha = 1;
  }
  // 눈 (겨울만)
  if (!seasonOf(save.day).snow) return;
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  const tt = (G ? G.t : performance.now() / 1000);
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + tt * (8 + i % 5 * 3)) % W;
    const y = (i * 53 + tt * (18 + i % 4 * 6)) % 280;
    ctx.beginPath(); ctx.arc(x, y + 10, 1.2 + (i % 3) * .5, 0, 7); ctx.fill();
  }
}

function drawCustomer(s, c) {
  const x = CUST_X[s];
  const slide = c.leave ? Math.min(1, c.leave / 1.2) : 1 - c.enter;
  const dx = (s === 2 ? 1 : -1) * slide * 220 * (c.leave ? 1 : 1);
  const bx = x + dx, by = 196 + DY + Math.sin(c.bob * 3) * 1.5;
  ctx.save();
  // 몸
  ctx.fillStyle = c.coat; rr(bx - 30, by - 50, 60, 70, 22); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(bx - 2, by - 46, 4, 60);
  // 목도리
  ctx.fillStyle = '#e8e2d0'; rr(bx - 22, by - 56, 44, 12, 6); ctx.fill();
  // 머리
  ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(bx, by - 76, 24, 0, 7); ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath(); ctx.arc(bx, by - 82, 25, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  if (c.hat) {
    ctx.fillStyle = '#c94a3a'; ctx.beginPath(); ctx.arc(bx, by - 86, 24, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by - 112, 6, 0, 7); ctx.fill();
    rr(bx - 25, by - 90, 50, 8, 4); ctx.fill();
  }
  // 얼굴
  const ratio = c.patience / c.maxPat;
  const mood = c.mood || (ratio > .5 ? 'fine' : ratio > .22 ? 'wait' : 'mad');
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath(); ctx.arc(bx - 8, by - 74, 2.4, 0, 7); ctx.arc(bx + 8, by - 74, 2.4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 2; ctx.beginPath();
  if (mood === 'happy' || mood === 'fine' || mood === 'ok') ctx.arc(bx, by - 68, 6, Math.PI * .15, Math.PI * .85);
  else if (mood === 'wait' || mood === 'meh') { ctx.moveTo(bx - 5, by - 64); ctx.lineTo(bx + 5, by - 64); }
  else { ctx.arc(bx, by - 60, 6, Math.PI * 1.2, Math.PI * 1.8); ctx.moveTo(bx - 12, by - 82); ctx.lineTo(bx - 4, by - 79); ctx.moveTo(bx + 12, by - 82); ctx.lineTo(bx + 4, by - 79); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,.35)';
  ctx.beginPath(); ctx.arc(bx - 14, by - 68, 4, 0, 7); ctx.arc(bx + 14, by - 68, 4, 0, 7); ctx.fill();
  ctx.restore();

  // 말풍선 (주문)
  if (!c.leave) {
    const keys = Object.keys(c.order);
    const bh = 18 + keys.length * 20, bw = 112;
    const tx = Math.max(4, Math.min(W - bw - 4, bx - bw / 2)), ty = by - 110 - bh;
    ctx.fillStyle = '#fffaf0'; rr(tx, ty, bw, bh, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 6, ty + bh); ctx.lineTo(bx + 4, ty + bh + 8); ctx.lineTo(bx + 8, ty + bh); ctx.fill();
    keys.forEach((k, j) => {
      const yy = ty + 14 + j * 20;
      drawMiniFish(tx + 22, yy, k, 1);
      const have = trayCount(k) >= c.order[k];
      ctx.fillStyle = have ? '#2e8a3a' : '#4a2a12';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(TYPES[k].name + ' ×' + c.order[k], tx + 42, yy + 1);
    });
    // 인내심
    const pw = bw - 24, px = tx + 12, py = ty + bh - 11;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(px, py, pw, 7, 3.5); ctx.fill();
    ctx.fillStyle = ratio > .5 ? '#7ad35a' : ratio > .22 ? '#f2c230' : '#ef5a3a';
    rr(px, py, pw * Math.max(0, ratio), 7, 3.5); ctx.fill();
  } else if (c.lineT > 0) {
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(c.line).width + 20;
    ctx.fillStyle = c.mood === 'angry' ? '#ffd6cc' : '#fffaf0';
    rr(bx - w / 2, by - 140, w, 28, 12); ctx.fill();
    ctx.fillStyle = '#4a2a12'; ctx.fillText(c.line, bx, by - 126);
  }
}

function drawStall() {
  if (save.shop) { drawShopFront(); return; }
  // 차양
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#f4efe4' : '#d6402a';
    ctx.beginPath();
    ctx.moveTo(i * W / stripes, 44); ctx.lineTo((i + 1) * W / stripes, 44);
    ctx.lineTo((i + 1) * W / stripes, 58);
    ctx.arc((i + .5) * W / stripes, 58, W / stripes / 2, 0, Math.PI);
    ctx.closePath(); ctx.fill();
  }
  // 등불
  const glow = ctx.createRadialGradient(W / 2, 80, 10, W / 2, 80, 230);
  glow.addColorStop(0, 'rgba(255,200,90,.22)'); glow.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 44, W, 260);
}
// 2단계 '내 가게': 벽돌 벽, 창문, 간판
function drawShopFront() {
  ctx.fillStyle = '#5a2e22'; ctx.fillRect(0, 44, W, 256);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let y = 92; y < 300; y += 14) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = ((y / 14) % 2) * 20; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
  }
  // 창문 (따뜻한 실내)
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = .35;
  rr(24, 110, 110, 90, 8); ctx.fill(); rr(266, 110, 110, 90, 8); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#3a1d14'; ctx.lineWidth = 4;
  rr(24, 110, 110, 90, 8); ctx.stroke(); rr(266, 110, 110, 90, 8); ctx.stroke();
  // 간판
  ctx.fillStyle = '#2b1a12'; rr(40, 50, W - 80, 38, 10); ctx.fill();
  ctx.strokeStyle = '#e9a514'; ctx.lineWidth = 2; rr(44, 54, W - 88, 30, 8); ctx.stroke();
  ctx.fillStyle = '#ffd36a'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐟 붕어빵 사장님 1호점', W / 2, 70);
  const glow = ctx.createRadialGradient(W / 2, 80, 10, W / 2, 80, 230);
  glow.addColorStop(0, 'rgba(255,200,90,.18)'); glow.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 44, W, 260);
}
function drawCounter() {
  // 카운터
  ctx.fillStyle = '#9b5a2c'; ctx.fillRect(0, 222, W, 12);
  ctx.fillStyle = '#7a4520'; ctx.fillRect(0, 234, W, 66);
  ctx.fillStyle = '#6a3a1a';
  for (let x = 0; x < W; x += 50) ctx.fillRect(x, 234, 2, 66);
}

function drawTray() {
  // 진열대 (망)
  ctx.fillStyle = '#5a3018'; rr(6, 238, W - 12, 60, 10); ctx.fill();
  ctx.fillStyle = '#3b2010'; rr(10, 242, W - 20, 52, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,200,.18)'; ctx.lineWidth = 1;
  for (let x = 14; x < W - 10; x += 8) { ctx.beginPath(); ctx.moveTo(x, 244); ctx.lineTo(x, 292); ctx.stroke(); }
  const avail = TYPE_KEYS;
  avail.forEach((t, i) => {
    const x = 14 + i * 96, y = 244;
    const n = trayCount(t);
    const lock = !unlocked(t);
    ctx.globalAlpha = lock ? .35 : 1;
    if (n > 0) {
      for (let k = Math.min(n, 3) - 1; k >= 0; k--) drawBun(x + 20 + k * 4, y + 28 - k * 3, 34, 21, 0.95, t);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 3]);
      fishPath(x + 22, y + 26, 34, 21); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(TYPES[t].name, x + 44, y + 16);
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = n ? '#ffe27a' : 'rgba(255,255,255,.5)';
    ctx.fillText(lock ? '🔒' : '×' + n, x + 44, y + 36);
    ctx.globalAlpha = 1;
  });
}

function gauge(x, y, w, val, max, zone, color) {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(x, y, w, 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(120,220,100,.55)';
  ctx.fillRect(x + w * zone[0] / max, y, w * (zone[1] - zone[0]) / max, 10);
  ctx.fillStyle = color;
  rr(x, y + 2, Math.max(4, w * Math.min(val, max) / max), 6, 3); ctx.fill();
}

function drawMold(i) {
  const m = G.molds[i];
  const c = cellRect(i);
  const cx = c.x + CELL_W / 2, cy = c.y + 70;
  const fw = 100, fh = 62;
  // 틀 판
  ctx.fillStyle = '#2b2b30'; rr(c.x + 6, c.y + 26, 116, 90, 14); ctx.fill();
  ctx.fillStyle = '#3c3c44'; rr(c.x + 9, c.y + 29, 110, 84, 12); ctx.fill();
  // 손잡이
  ctx.fillStyle = '#5a3a24'; rr(c.x + 54, c.y + 112, 20, 8, 3); ctx.fill();

  const closed = m.state === 'closedA' || m.state === 'closedB';
  const sq = closed && m.flipAnim > 0 ? Math.abs(Math.cos(m.flipAnim * Math.PI)) : 1;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, Math.max(.08, sq)); ctx.translate(-cx, -cy);
  // 빈 틀 홈
  fishPath(cx, cy, fw, fh);
  ctx.fillStyle = '#18181c'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#55555e'; ctx.stroke();

  if (!closed && m.state !== 'empty') {
    // 반죽 채우기 (아래부터)
    ctx.save();
    fishPath(cx, cy, fw - 4, fh - 4); ctx.clip();
    const lvl = Math.min(m.fill, 100) / 100;
    const top = cy + fh / 2 - fh * lvl;
    ctx.fillStyle = lerpColor('#f8ecc4', '#e8b860', Math.min(1, m.dA * 0.55));
    ctx.fillRect(c.x, top, CELL_W, fh);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(c.x, top, CELL_W, 2);
    // 기포
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let k = 0; k < 5; k++) {
      const bx = cx - 30 + k * 14, by = Math.max(top + 5, cy + 4 + (k % 2) * 8);
      ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
    // 속
    if (m.filling) {
      const tf = TYPES[m.filling];
      const under = m.state === 'pour2' ? Math.min(1, Math.max(0, (m.fill - m.fill1) / 30)) : 0;
      ctx.globalAlpha = 1 - under * .75;
      ctx.fillStyle = tf.color;
      ctx.beginPath(); ctx.ellipse(cx - 4, cy + 2, 22, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = tf.dot;
      for (let k = 0; k < 7; k++) {
        ctx.beginPath(); ctx.arc(cx - 18 + (k * 13) % 30, cy - 4 + (k * 7) % 12, m.filling === 'pizza' ? 3 : 1.8, 0, 7); ctx.fill();
      }
      if (m.filling === 'pizza') { ctx.fillStyle = '#4a8a3a'; ctx.fillRect(cx + 6, cy - 2, 5, 3); ctx.fillRect(cx - 12, cy + 6, 4, 3); }
      ctx.globalAlpha = 1;
    }
    // 넘친 반죽
    if (m.fill > 104) {
      ctx.fillStyle = '#f3e2b0';
      const k = Math.min(1, (m.fill - 104) / 16);
      ctx.beginPath(); ctx.ellipse(cx + 10, cy + fh / 2 + 4, 20 + 22 * k, 5 + 4 * k, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - 30, cy - fh / 2 + 2, 8 + 10 * k, 3 + 3 * k, 0, 0, 7); ctx.fill();
    }
  }
  if (closed) {
    // 뚜껑 (무쇠 붕어 무늬)
    fishPath(cx, cy, fw + 6, fh + 6);
    const lg = ctx.createLinearGradient(cx, cy - fh / 2, cx, cy + fh / 2);
    lg.addColorStop(0, '#6a6a74'); lg.addColorStop(1, '#2a2a30');
    ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
    for (let r = -1; r <= 1; r++) for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(cx - 12 + k * 11 + (r & 1) * 5, cy + r * 10, 5.5, Math.PI * .6, Math.PI * 1.4); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx - 31, cy, 18, -1.1, 1.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(cx - 38, cy - 7, 3, 0, 7); ctx.fill();
    // 반죽이 삐져나온 가장자리 색으로 익힘 힌트
    const d = m.state === 'closedB' ? m.dB : m.dA;
    ctx.strokeStyle = bakeColor(d); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy + fh / 2 + 1); ctx.quadraticCurveTo(cx, cy + fh / 2 + 5, cx + 22, cy + fh / 2 - 1); ctx.stroke();
    // 뒤집기 표시
    ctx.fillStyle = m.state === 'closedB' ? '#ffb347' : '#9ad0ff';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.state === 'closedB' ? '윗면' : '아랫면', cx + 34, cy - 22);
  }
  ctx.restore();

  // 붓는 주전자
  if (m.pouring) {
    ctx.fillStyle = '#c9c9d2';
    ctx.strokeStyle = '#f6e6b6'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - 10, c.y + 22); ctx.lineTo(cx - 6, cy - 6 + Math.sin(G.t * 30)); ctx.stroke();
    drawKettle(cx + 6, c.y + 12, 0.75, -0.5);
  }

  // 게이지
  const gx = c.x + 14, gy = c.y + 8, gw = 100;
  if (m.state === 'empty') {
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tool === 'batter' ? '꾹 눌러 반죽 붓기' : '반죽부터 부어요', cx, cy);
  } else if (!closed) {
    const zone = m.state === 'pour1' ? ZONE1 : m.state === 'filled' || m.state === 'pour2' ? ZONE2 : ZONE1;
    gauge(gx, gy, gw, m.fill, 120, zone, m.fill > 108 ? '#ef5a3a' : '#fff1c2');
    // 아랫면 익힘 작은 표시
    const d = m.dA;
    ctx.fillStyle = d > DONE_HI ? (d > BURN ? '#ef5a3a' : '#f2a030') : 'rgba(255,255,255,.55)';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(d > BURN ? '바닥 탐!' : d > DONE_HI ? '바닥 타는 중' : '', c.x + 118, c.y + 24);
  } else {
    const d = m.state === 'closedB' ? m.dB : m.dA;
    gauge(gx, gy, gw, d, 1.6, [DONE_LO, DONE_HI], d > BURN ? '#3a2416' : d > DONE_HI ? '#c86a2a' : '#f0b850');
  }

  // 버튼
  let label = '', on = false;
  if (m.state === 'pour1' || m.state === 'filled' || m.state === 'pour2') { label = '덮기'; on = m.state !== 'pour1' || m.fill > 0; }
  else if (m.state === 'closedA') { label = '뒤집기'; on = true; }
  else if (m.state === 'closedB') { label = '꺼내기'; on = true; }
  if (label) {
    const d = m.state === 'closedB' ? m.dB : m.dA;
    const ready = (m.state === 'closedA' || m.state === 'closedB') && d >= DONE_LO;
    const hot = (m.state === 'closedA' || m.state === 'closedB') && d > DONE_HI;
    ctx.fillStyle = hot ? '#e0442a' : ready ? '#e9a514' : m.state === 'pour2' && m.fill >= ZONE2[0] ? '#e9a514' : '#7a5a40';
    if (ready && !hot) { ctx.shadowColor = '#ffd36a'; ctx.shadowBlur = 8 + 4 * Math.sin(G.t * 8); }
    rr(c.x + 20, c.y + 120, 88, 26, 13); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,.5)';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, c.y + 133);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('틀 ' + (i + 1) + (isPC ? ' · ' + 'QWEASD'[i] + ' 키' : ''), cx, c.y + 133);
  }
}

function drawKettle(x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  ctx.fillStyle = '#d9d9e2'; ctx.strokeStyle = '#7a7a88'; ctx.lineWidth = 2;
  rr(-16, -14, 32, 28, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-30, -14); ctx.lineTo(-27, -17); ctx.lineTo(-13, -8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(18, 0, 8, -1.3, 1.3); ctx.stroke();
  ctx.fillStyle = '#f6e6b6'; ctx.fillRect(-12, -12, 24, 6);
  ctx.restore();
}

function drawLockedCell(i) {
  const c = cellRect(i);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
  rr(c.x + 6, c.y + 26, 116, 90, 14); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🔒 틀 추가', c.x + CELL_W / 2, c.y + 70);
}

function drawTools() {
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, TOOL_Y - 8, W, H - TOOL_Y + 8);
  TOOLS.forEach((t, i) => {
    const r = toolRect(i), sel = tool === t;
    const lock = t !== 'batter' && !unlocked(t);
    ctx.fillStyle = sel ? '#ffcf5a' : '#4a3020';
    rr(r.x, r.y, r.w, r.h, 14); ctx.fill();
    if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalAlpha = lock ? .35 : 1;
    const cx = r.x + r.w / 2;
    if (t === 'batter') {
      drawKettle(cx + 4, r.y + 38, 1, 0);
    } else {
      // 재료 그릇
      ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.ellipse(cx, r.y + 44, 26, 12, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = TYPES[t].color; ctx.beginPath(); ctx.ellipse(cx, r.y + 40, 24, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = TYPES[t].dot;
      for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(cx - 16 + (k * 9) % 32, r.y + 35 + (k * 5) % 10, t === 'pizza' ? 3 : 2, 0, 7); ctx.fill(); }
      if (t === 'pizza') { ctx.fillStyle = '#4a8a3a'; ctx.fillRect(cx - 4, r.y + 36, 6, 4); ctx.fillRect(cx + 10, r.y + 41, 5, 3); }
      ctx.strokeStyle = '#bdb6aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, r.y + 40, 26, 12, 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = sel ? '#4a2a12' : '#f6e6c8';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t === 'batter' ? '반죽' : TYPES[t].name, cx, r.y + 72);
    ctx.font = '11px sans-serif';
    ctx.fillText(lock ? TYPES[t].unlock + '주차부터' : t === 'batter' ? '꾹 누르기' : priceOf(t).toLocaleString() + '원', cx, r.y + 88);
    ctx.globalAlpha = 1;
  });
}

function hintFor(m) {
  if (!m) return '';
  switch (m.state) {
    case 'empty': return '① 반죽 주전자로 틀을 꾹 눌러 절반쯤 부어요';
    case 'pour1': return m.fill < ZONE1[0] ? '① 초록 칸까지 반죽을 부어요' : '② 아래에서 속(팥·슈크림…)을 골라 틀을 톡!';
    case 'filled': return tool === 'batter' ? '③ 가득(초록 칸)까지 마저 부어요' : '③ 아래 반죽 주전자를 골라 마저 부어요';
    case 'pour2': return m.fill < ZONE2[0] ? '③ 초록 칸까지 마저 부어요' : '④ 덮기를 눌러요';
    case 'closedA': return m.dA < DONE_LO ? '⑤ 아랫면 익는 중… 초록 칸에서 뒤집기' : '⑤ 지금 뒤집기!';
    case 'closedB': return m.dB < DONE_LO ? '⑥ 윗면 익는 중… 초록 칸에서 꺼내기' : '⑥ 지금 꺼내기!';
  }
  return '';
}

function draw() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawStall();
  if (!G) { ctx.save(); ctx.translate(0, DY); drawCounter(); ctx.restore(); return; }
  // 손님
  for (let s = 0; s < 3; s++) if (G.customers[s]) drawCustomer(s, G.customers[s]);
  ctx.save(); ctx.translate(0, DY);
  drawCounter();
  drawTray();
  // 굽는 판
  ctx.fillStyle = '#1e1e22'; ctx.fillRect(0, 300, W, TOOL_Y - 300);
  const heat = ctx.createLinearGradient(0, 300, 0, TOOL_Y);
  heat.addColorStop(0, 'rgba(255,90,20,0)'); heat.addColorStop(1, 'rgba(255,90,20,.18)');
  ctx.fillStyle = heat; ctx.fillRect(0, 300, W, TOOL_Y - 300);
  for (let i = 0; i < 6; i++) {
    if (i < G.molds.length) drawMold(i); else drawLockedCell(i);
  }
  // 연기
  for (const s of G.smoke) {
    ctx.fillStyle = s.dark ? 'rgba(40,30,30,' + (0.6 * (1 - s.t / 1.6)) + ')' : s.steam ? 'rgba(255,255,255,' + (0.25 * (1 - s.t / 1.6)) + ')' : 'rgba(160,150,150,' + (0.45 * (1 - s.t / 1.6)) + ')';
    ctx.beginPath(); ctx.arc(s.x + Math.sin(s.t * 4 + s.x) * 6, s.y - s.t * 40, 5 + s.t * 8, 0, 7); ctx.fill();
  }
  // 안내줄
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(10, 608, W - 20, 40, 12); ctx.fill();
  ctx.fillStyle = '#fff3d6'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const msg = G.msgT > 0 ? G.msg : (save.day <= 2 ? hintFor(G.molds[lastMold]) : '손님을 누르면 주문한 붕어빵을 건네요');
  ctx.fillText(msg, W / 2, 628);
  drawTools();
  ctx.restore();
  // HUD
  ctx.fillStyle = 'rgba(10,12,30,.7)'; ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px sans-serif'; ctx.fillText(calLabel(save.day), 10, 22);
  const left = Math.max(0, DAY_LEN - G.t);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(76, 16, 84, 12, 6); ctx.fill();
  ctx.fillStyle = left < 15 ? '#ef5a3a' : '#ffcf5a'; rr(76, 16, 84 * left / DAY_LEN, 12, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
  ctx.fillText(G.closing ? '마감' : Math.ceil(left) + '초', 165, 22);
  ctx.textAlign = 'right'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffe27a';
  ctx.fillText((G.stats.revenue + G.stats.tips).toLocaleString() + '원', W - 58, 22);
  // 알바생 표시
  if (save.upg.alba > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.15)'; rr(200, 10, 60, 24, 12); ctx.fill();
    ctx.fillStyle = '#bfe8ff'; rr(200, 10, 60 * Math.min(1, G.albaT / 5), 24, 12); ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('알바 ' + save.upg.alba + '명', 230, 22);
  }
  // 일시정지 버튼
  ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(W - 48, 8, 40, 28, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 34, 15, 4, 14); ctx.fillRect(W - 26, 15, 4, 14);
  // 떠오르는 글자
  for (const f of G.floats) {
    ctx.globalAlpha = 1 - f.t / 1.4;
    ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,20,10,.8)';
    ctx.strokeText(f.text, f.x, f.y - f.t * 30); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.t * 30);
    ctx.globalAlpha = 1;
  }
}

// ===== 루프 =====
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ===== 아침 뉴스 + 위기 카드 =====
const $ = id => document.getElementById(id);
const FLAVOR = [
  '동네 학원가에 붕어빵 냄새가 퍼지고 있어요.', '단골 할머니가 오늘도 들르신대요.', '옆 골목 호떡집 사장님이 인사를 왔어요.',
  '퇴근길 직장인들이 붕어빵을 찾고 있어요.', '초등학생들 사이에서 슈크림이 유행이래요.', '오늘은 바람이 잔잔해요. 장사하기 좋은 날!',
];
function rollCrisis() {
  if (save.crisis || save.suspended || save.day < 3) return;
  if (save.day - (save.lastCrisis || 0) < 2) return;
  if (save.rolledDay === save.day) return;   // 하루에 한 번만 뽑기
  save.rolledDay = save.day; persist();
  if (Math.random() > 0.4) return;
  const winter = seasonOf(save.day).snow;
  const pool = Object.keys(CRISES).filter(id => {
    const d = CRISES[id];
    if (d.winterOnly && !winter) return false;
    if (d.needRating && save.rating < d.needRating) return false;
    return true;
  });
  const id = pool[Math.random() * pool.length | 0];
  save.crisis = { id, left: CRISES[id].weeks, choice: null };
  save.lastCrisis = save.day;
  persist();
}
function openNews() {
  rollCrisis();
  const se = seasonOf(save.day), c = calOf(save.day);
  $('newsDate').textContent = c.year + '년차 ' + calLabel(save.day);
  const lines = [];
  lines.push(`<div class="nline">${se.icon} <b>${se.name}${se.tag ? ' ' + se.tag : ''}</b> · ${se.line}</div>`);
  if (save.shop) lines.push(`<div class="nline">🏠 본점${save.branches.length ? ' + 직영점 ' + save.branches.length + '곳' : ''} 영업 중 · 직영점은 점장이 알아서 장사해요.</div>`);
  if (save.debt) lines.push(`<div class="nline">🏦 대출 ${save.debt.toLocaleString()}원 · 이번 주 이자 ${Math.round(save.debt * INTEREST).toLocaleString()}원</div>`);
  if (save.negWeeks > 0) lines.push(`<div class="nline warn">⚠️ 돈이 마이너스 ${save.negWeeks}주째예요. 4주 연속이면 파산해요.</div>`);
  const cr = save.crisis;
  if (cr && cr.choice != null) {
    const d = CRISES[cr.id];
    lines.push(`<div class="nline warn">${d.icon} <b>${d.title}</b> ${cr.left}주 남음 · ${d.choices[cr.choice].label}</div>`);
  }
  if (!cr && !save.suspended) lines.push(`<div class="nline">📰 ${FLAVOR[Math.random() * FLAVOR.length | 0]}</div>`);
  $('newsLines').innerHTML = lines.join('');
  const card = $('crisisCard'), btn = $('btnOpenShop');
  card.innerHTML = '';
  card.style.display = 'none';
  btn.disabled = false;
  if (save.suspended) {
    card.style.display = 'block';
    card.innerHTML = `<div class="ctitle">🚫 영업정지 1주</div><div class="ctext">위생 점검에 걸려 이번 주는 문을 닫아야 해요.${save.shop ? ' 월세는 그대로 나가요.' : ''}</div>`;
    btn.textContent = '이번 주 쉬기';
  } else if (cr && cr.choice == null) {
    const d = CRISES[cr.id];
    card.style.display = 'block';
    card.innerHTML = `<div class="ctitle">${d.icon} ${d.title}</div><div class="ctext">${d.text}</div><div class="cpick">어떻게 할까요?</div>`;
    d.choices.forEach((ch, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      const short = ch.cost && save.money < ch.cost;
      b.innerHTML = `<b>${ch.label}</b><span>${ch.desc}${short ? ' (돈이 모자라요)' : ''}</span>`;
      b.disabled = !!short;
      b.onclick = () => {
        if (ch.cost) save.money -= ch.cost;
        cr.choice = i; persist(); sfx.pop(); openNews();
      };
      card.appendChild(b);
    });
    btn.disabled = true;
    btn.textContent = '먼저 대응을 골라 주세요';
  } else {
    btn.textContent = calLabel(save.day) + ' 장사 시작';
  }
  show('news');
}
function skipWeek() {
  const rent = save.shop ? RENT : 0;
  save.money -= rent;
  save.suspended = false;
  save.rating = Math.max(0, save.rating - 0.3);
  save.day++;
  persist();
  openNews();
}
$('btnOpenShop').onclick = () => {
  if (save.suspended) { skipWeek(); return; }
  if (save.crisis && save.crisis.choice == null) return;
  startDay();
};

// ===== 화면 전환 =====
function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }
function show(id) { hideAll(); $(id).classList.add('show'); }

function refreshTitle() {
  $('titleInfo').innerHTML = save.total
    ? `<b>${calOf(save.day).year}년차 ${calLabel(save.day)}</b> · ${save.shop ? (save.branches.length ? '가게 ' + (save.branches.length + 1) + '곳' : '내 가게') : '포장마차'}<br>가진 돈 <b>${save.money.toLocaleString()}원</b> · 평점 ★${save.rating.toFixed(1)}${save.debt ? ' · 대출 ' + save.debt.toLocaleString() + '원' : ''}${save.legacy ? ' · 장인 비법 Lv.' + save.legacy : ''}<br>지금까지 구운 붕어빵 ${save.total.toLocaleString()}개`
    : '반죽 붓고, 속 넣고, 뒤집고, 꺼내고!<br>오늘부터 붕어빵 가게 사장님이에요.';
  $('btnStart').textContent = save.day > 1 ? calLabel(save.day) + ' 장사 시작' : '장사 시작';
  const rb = $('btnReset');
  rb.style.display = (save.day > 1 || save.total > 0 || save.money) ? 'block' : 'none';
  rb.classList.remove('armed'); rb.textContent = '처음부터 다시 시작';
}

// 처음부터 다시 시작: 실수 방지로 두 번 눌러야 지워짐
let resetTimer = null;
$('btnReset').onclick = () => {
  const rb = $('btnReset');
  if (!rb.classList.contains('armed')) {
    rb.classList.add('armed');
    rb.textContent = '한 번 더 누르면 처음부터 시작해요';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(refreshTitle, 4000);
    return;
  }
  clearTimeout(resetTimer);
  save = freshSave();
  persist();
  refreshTitle();
  shopTab = 'upg';
  sfx.pop();
};

let lastResult = null, bonusUsed = false;
function endDay() {
  running = false;
  const st = G.stats;
  const gross = st.revenue + st.tips;
  const profit = gross - st.cost;
  const served = st.happy, total = st.happy + st.angry;
  const avgStar = st.sold ? st.starSum / st.sold : 0;
  const rate = total ? served / total : 0;
  const dayStars = (rate >= .9 && avgStar >= 2.6) ? 3 : (rate >= .7 && avgStar >= 2) ? 2 : rate >= .4 ? 1 : 0;
  const rent = save.shop ? RENT : 0;
  // 직영점 자동 정산
  const brs = save.branches.map(b => Object.assign({ b }, branchWeek(b, save.day)));
  const brNet = brs.reduce((a, r) => a + r.net, 0);
  const interest = Math.round(save.debt * INTEREST / 10) * 10;
  const net = profit - rent + brNet - interest;
  save.money += net;
  save.negWeeks = save.money < 0 ? (save.negWeeks || 0) + 1 : 0;
  if (net > save.best) save.best = net;
  // 평점: 붕어빵 별 + 손님 만족을 섞어 서서히 움직임
  if (total) {
    const dr = Math.min(5, avgStar * 1.2 + rate * 1.4);
    save.rating = save.rating ? save.rating * 0.6 + dr * 0.4 : dr;
  }
  // 위기 처리
  let crisisNote = '';
  const cr = save.crisis;
  if (cr && cr.choice != null) {
    if (cr.id === 'inspect') {
      const lim = eff().burnLimit;
      if (st.burnt >= lim) { save.suspended = true; crisisNote = '위생 점검 불합격! 탄 붕어빵 ' + st.burnt + '개… 다음 주는 영업정지예요.'; }
      else crisisNote = '위생 점검 통과! 깨끗한 가게로 인정받았어요.';
    }
    cr.left--;
    if (cr.left <= 0) { if (!crisisNote) crisisNote = CRISES[cr.id].title.replace('!', '') + ' 상황이 끝났어요.'; save.crisis = null; }
  }
  lastResult = { profit: net, day: save.day };
  bonusUsed = false;
  save.day++;
  persist();

  $('resTitle').textContent = calLabel(lastResult.day) + ' 장사 끝!';
  $('resStars').textContent = '★'.repeat(dayStars) + '☆'.repeat(3 - dayStars);
  const row = (a, b, cls) => `<tr class="${cls || ''}"><td>${a}</td><td>${b}</td></tr>`;
  $('resTable').innerHTML =
    row('판 붕어빵', st.sold + '개') +
    row('매출', st.revenue.toLocaleString() + '원') +
    row('팁', st.tips.toLocaleString() + '원') +
    row('재료비', '−' + st.cost.toLocaleString() + '원') +
    (rent ? row('본점 월세', '−' + rent.toLocaleString() + '원') : '') +
    brs.map(r => row(areaOf(r.b.area).icon + ' ' + areaOf(r.b.area).name + '점 (자동)', (r.net >= 0 ? '+' : '−') + Math.abs(r.net).toLocaleString() + '원')).join('') +
    (interest ? row('대출 이자', '−' + interest.toLocaleString() + '원') : '') +
    row('웃으며 간 손님 / 화난 손님', served + ' / ' + st.angry + '명') +
    row('탄 붕어빵 / 버린 붕어빵', st.burnt + ' / ' + (st.waste + G.tray.length) + '개') +
    row('이번 주 순이익', (net >= 0 ? '' : '−') + Math.abs(net).toLocaleString() + '원', 'total');
  const tips = [];
  if (st.burnt) tips.push('뚜껑을 덮은 뒤 버튼이 노랗게 빛나면 바로 뒤집거나 꺼내요.');
  if (st.angry) tips.push('손님이 늘면 틀을 여러 개 같이 돌려 보세요.');
  if (!st.sold) tips.unshift('진열대에 붕어빵이 모이면 손님을 눌러 건네요.');
  if (!tips.length) tips.push('완벽한 한 주였어요! 업그레이드로 가게를 키워 보세요.');
  $('resNote').textContent = (crisisNote ? crisisNote + ' ' : '') + tips[0];
  if (save.negWeeks >= 4) { showBankrupt(); return; }
  if (save.negWeeks > 0) $('resNote').textContent = '⚠️ 돈이 마이너스예요(' + save.negWeeks + '주째). 4주 연속이면 파산! 은행 대출로 버틸 수 있어요.';
  $('btnBonus').style.display = net > 0 ? 'block' : 'none';
  $('btnBonus').disabled = false;
  $('btnBonus').textContent = '순이익 2배 받기 (+' + Math.max(0, net).toLocaleString() + '원)';
  show('result');
}

$('btnBonus').onclick = () => {
  if (bonusUsed || !lastResult || lastResult.profit <= 0) return;
  window.Ads.rewarded(ok => {
    if (!ok) return;
    bonusUsed = true;
    save.money += lastResult.profit; persist();
    $('btnBonus').disabled = true; $('btnBonus').textContent = '보너스 받았어요!';
    sfx.coin();
  });
};

let shopTab = 'upg';
function renderShop() {
  $('shopMoney').textContent = save.money.toLocaleString();
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  $('shopList').innerHTML = '';
  if (shopTab === 'map') { renderMap(); return; }
  if (shopTab === 'bank') { renderBank(); return; }
  const sd = document.createElement('div');
  sd.className = 'item big-item';
  if (!save.shop) {
    sd.innerHTML = `<div class="ic">🏠</div><div class="tx"><b>내 가게 열기 <span class="lv">2단계</span></b>포장마차를 접고 상가에 1호점을 열어요. 손님 +30%, 진열대 16→24개. 대신 매주 월세 ${RENT.toLocaleString()}원.</div>`;
    const b = document.createElement('button');
    b.textContent = SHOP_COST.toLocaleString() + '원';
    b.disabled = save.money < SHOP_COST;
    b.onclick = () => { if (save.money < SHOP_COST) return; save.money -= SHOP_COST; save.shop = true; persist(); sfx.coin(); renderShop(); };
    sd.appendChild(b);
  } else {
    sd.innerHTML = `<div class="ic">🏠</div><div class="tx"><b>1호점 운영 중</b>손님 +30%, 진열대 24개 · 월세 매주 ${RENT.toLocaleString()}원</div>`;
  }
  $('shopList').appendChild(sd);
  UPGRADES.forEach(u => {
    const lv = save.upg[u.key];
    const div = document.createElement('div');
    div.className = 'item';
    const maxed = lv >= u.max;
    const cost = maxed ? 0 : u.costs[lv];
    div.innerHTML = `<div class="ic">${u.icon}</div><div class="tx"><b>${u.name} <span class="lv">Lv.${lv}/${u.max}</span></b>${u.desc}</div>`;
    const b = document.createElement('button');
    if (maxed) { b.textContent = '최고'; b.className = 'max'; b.disabled = true; }
    else {
      b.textContent = cost.toLocaleString() + '원';
      b.disabled = save.money < cost;
      b.onclick = () => {
        if (save.money < cost) return;
        save.money -= cost; save.upg[u.key]++; persist(); sfx.coin(); renderShop();
      };
    }
    div.appendChild(b);
    $('shopList').appendChild(div);
  });
  const next = TYPE_KEYS.filter(t => TYPES[t].unlock === save.day);
  if (next.length) {
    const d = document.createElement('div');
    d.className = 'small'; d.style.textAlign = 'center'; d.style.margin = '6px 0';
    d.textContent = '🎉 오늘부터 ' + next.map(t => TYPES[t].name).join('·') + ' 붕어빵도 팔아요!';
    $('shopList').appendChild(d);
  }
}

document.querySelectorAll('#shopTabs button').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; pickArea = null; renderShop(); });

// 가게 확장 탭: 동네 카드 + 점장 고르기
let pickArea = null, mgrCands = null;
function itemEl(icon, title, desc, btnText, onClick, disabled) {
  const d = document.createElement('div');
  d.className = 'item';
  d.innerHTML = `<div class="ic">${icon}</div><div class="tx"><b>${title}</b>${desc}</div>`;
  if (btnText) {
    const b = document.createElement('button');
    b.textContent = btnText; b.disabled = !!disabled;
    if (onClick) b.onclick = onClick;
    d.appendChild(b);
  }
  $('shopList').appendChild(d);
  return d;
}
function note(text) {
  const d = document.createElement('div');
  d.className = 'small'; d.style.margin = '4px 2px 10px'; d.innerHTML = text;
  $('shopList').appendChild(d);
}
function renderMap() {
  const n = save.branches.length;
  const cost = BRANCH_COSTS[n];
  if (!save.shop) { note('🔒 먼저 <b>업그레이드</b> 탭에서 내 가게(본점)를 열어야 직영점을 낼 수 있어요.'); }
  else if (n >= BRANCH_COSTS.length) note('🎉 직영점 4곳을 모두 열었어요! 다음은 프랜차이즈 본사(3차)예요.');
  else if (save.rating < NEED_RATING) note(`🔒 평점 ★${NEED_RATING.toFixed(1)} 이상이면 직영점을 낼 수 있어요. 지금 ★${save.rating.toFixed(1)}`);
  else note(`${n + 2}호점 출점 비용 <b>${cost.toLocaleString()}원</b> · 동네를 골라 주세요.`);
  if (pickArea) { renderManagers(); return; }
  AREAS.forEach(a => {
    const mine = save.branches.find(b => b.area === a.id);
    const desc = `${a.desc}<br>손님 ${'●'.repeat(Math.round(a.traffic * 2))} · 월세 ${a.rent.toLocaleString()}원 · 인기 ${a.fav}`;
    if (mine) {
      const est = branchWeek(mine, save.day);
      itemEl(a.icon, `${a.name}점 <span class="lv">${mine.mgr.name} ★${mine.mgr.skill}</span>`, desc + `<br>이번 주 예상 ${est.net >= 0 ? '+' : '−'}${Math.abs(est.net).toLocaleString()}원`, null);
    } else {
      const can = save.shop && n < BRANCH_COSTS.length && save.rating >= NEED_RATING && save.money >= cost;
      itemEl(a.icon, a.name, desc, '출점', () => { pickArea = a.id; mgrCands = makeManagers(); renderShop(); }, !can);
    }
  });
}
function renderManagers() {
  const a = areaOf(pickArea), cost = BRANCH_COSTS[save.branches.length];
  note(`<b>${a.icon} ${a.name}점</b>을 맡을 점장을 골라 주세요. 실력(★)이 높을수록 잘 팔지만 주급이 비싸요.`);
  mgrCands.forEach(m => {
    const est = branchWeek({ area: a.id, mgr: m }, save.day);
    itemEl('🧑‍💼', `${m.name} <span class="lv">${m.trait} ★${m.skill}</span>`, `주급 ${m.wage.toLocaleString()}원 · 이번 계절 예상 ${est.net >= 0 ? '+' : '−'}${Math.abs(est.net).toLocaleString()}원/주`,
      '고용', () => {
        if (save.money < cost) return;
        save.money -= cost;
        save.branches.push({ area: a.id, mgr: m, since: save.day });
        pickArea = null; persist(); sfx.coin(); renderShop();
      }, save.money < cost);
  });
  const back = document.createElement('button');
  back.className = 'ghost'; back.textContent = '다른 동네 고르기';
  back.onclick = () => { pickArea = null; renderShop(); };
  $('shopList').appendChild(back);
}
function renderBank() {
  const lim = loanLimit();
  note(`🏦 대출 <b>${save.debt.toLocaleString()}원</b> / 한도 ${lim.toLocaleString()}원 · 이자 매주 ${Math.round(INTEREST * 100)}%<br>돈이 4주 연속 마이너스면 파산해요. 파산하면 포장마차부터 다시 시작하지만 '장인 비법'을 하나 얻어요.`);
  const unit = 50000;
  itemEl('💰', '5만원 빌리기', `이자 매주 ${(unit * INTEREST).toLocaleString()}원 늘어요.`, '빌리기', () => {
    if (save.debt + unit > lim) return;
    save.debt += unit; save.money += unit; persist(); sfx.coin(); renderShop();
  }, save.debt + unit > lim);
  const pay = Math.min(save.debt, unit);
  itemEl('📤', pay ? pay.toLocaleString() + '원 갚기' : '갚을 돈 없음', '갚을수록 이자가 줄어요.', '갚기', () => {
    if (!pay || save.money < pay) return;
    save.debt -= pay; save.money -= pay; persist(); sfx.coin(); renderShop();
  }, !pay || save.money < pay);
}

// 파산
function showBankrupt() {
  $('bkText').innerHTML = `4주 연속 돈이 마이너스라 가게를 정리했어요.<br>빚 ${save.debt.toLocaleString()}원, 가진 돈 ${save.money.toLocaleString()}원.<br><br>포장마차부터 다시 시작해요. 대신 <b>장인 비법 Lv.${(save.legacy || 0) + 1}</b>로 처음 돈 ${(((save.legacy || 0) + 1) * 30000).toLocaleString()}원을 들고 가요.`;
  show('bankrupt');
}
$('btnRestart').onclick = () => {
  const lv = (save.legacy || 0) + 1;
  save = freshSave();
  save.legacy = lv; save.money = lv * 30000; save.total = 1;
  persist(); refreshTitle(); show('title');
};

$('btnToShop').onclick = () => { renderShop(); show('shop'); };
$('btnShop0').onclick = () => { renderShop(); show('shop'); };
$('btnNextDay').onclick = () => { window.Ads.interstitial(() => openNews()); };
$('btnShopBack').onclick = () => { refreshTitle(); show('title'); G = null; };
$('btnStart').onclick = () => {
  if (save.day === 1 && save.total === 0) { show('how'); $('how').dataset.thenStart = '1'; return; }
  openNews();
};
$('btnHow').onclick = () => { show('how'); };
$('btnHow2').onclick = () => { $('how').dataset.backPause = '1'; show('how'); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
  const how = $('how');
  if (how.dataset.thenStart) { delete how.dataset.thenStart; openNews(); return; }
  if (how.dataset.backPause) { delete how.dataset.backPause; show('pause'); return; }
  refreshTitle(); show('title');
});

function pauseGame() {
  if (!running) return;
  paused = true;
  for (const p in G.pointers) stopPour(G.pointers[p]);
  G.pointers = {};
  $('btnSound').textContent = soundOn ? '소리 끄기' : '소리 켜기';
  show('pause');
}
$('btnResume').onclick = () => { paused = false; hideAll(); };
$('btnSound').onclick = () => { soundOn = !soundOn; $('btnSound').textContent = soundOn ? '소리 끄기' : '소리 켜기'; };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

refreshTitle();

// ===== PC: 키보드 단축키 =====
// 1~5 재료, Q W E / A S D 틀(누르고 있으면 반죽), 스페이스 = 마지막 틀 덮기·뒤집기·꺼내기, Z X C 손님, P 일시정지
const MOLD_KEYS = ['q', 'w', 'e', 'a', 's', 'd'];
const CUST_KEYS = ['z', 'x', 'c'];
const keyPour = {};
document.addEventListener('keydown', e => {
  if (!running || paused || !G) return;
  const k = e.key.toLowerCase();
  if (k === 'p' || k === 'escape') { pauseGame(); return; }
  if (e.repeat) return;
  if (k >= '1' && k <= '5') {
    const t = TOOLS[+k - 1];
    if (t !== 'batter' && !unlocked(t)) { say(TYPES[t].name + ' 붕어빵은 ' + TYPES[t].unlock + '주차부터 팔아요'); return; }
    tool = t; beep(700, .04, 'sine', .05); return;
  }
  const mi = MOLD_KEYS.indexOf(k);
  if (mi >= 0 && mi < G.molds.length) {
    lastMold = mi;
    if (tool === 'batter') { if (startPour(mi)) keyPour[k] = mi; }
    else addFilling(mi, tool);
    return;
  }
  if (k === ' ') { e.preventDefault(); moldAction(lastMold); return; }
  const ci = CUST_KEYS.indexOf(k);
  if (ci >= 0 && G.customers[ci]) serve(ci);
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (keyPour[k] !== undefined) { stopPour(keyPour[k]); delete keyPour[k]; }
});

// ===== PC: 양옆 현황판 =====
function won(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString() + '원'; }
function pcRow(a, b, cls) { return `<div class="pcrow ${cls || ''}"><span>${a}</span><b>${b}</b></div>`; }
function updatePanels() {
  if (!isPC) return;
  const se = seasonOf(save.day), c = calOf(save.day);
  let L = '';
  L += `<div class="pcbox"><h3>📅 ${c.year}년차</h3><div class="big">${calLabel(save.day)}</div><div class="sub">${se.icon} ${se.name}${se.tag ? ' ' + se.tag : ''} · ${se.line}</div></div>`;
  let news = '';
  const cr = save.crisis;
  if (save.suspended) news += `<div class="pcwarn">🚫 영업정지 1주</div>`;
  if (cr) { const d = CRISES[cr.id]; news += `<div class="pcwarn">${d.icon} ${d.title} (${cr.left}주 남음)</div><div class="sub">${cr.choice != null ? '대응: ' + d.choices[cr.choice].label : '아침 뉴스에서 대응을 골라요'}</div>`; }
  if (save.negWeeks > 0) news += `<div class="pcwarn">⚠️ 마이너스 ${save.negWeeks}주째 (4주면 파산)</div>`;
  L += `<div class="pcbox"><h3>📰 이번 주 소식</h3>${news || '<div class="sub">별일 없는 평화로운 한 주예요.</div>'}</div>`;
  let shops = pcRow(save.shop ? '🏠 본점 (직접 굽기)' : '🛒 포장마차 (직접 굽기)', save.shop ? '월세 ' + won(RENT) : '월세 없음');
  for (const b of save.branches) {
    const a = areaOf(b.area), est = branchWeek(b, save.day, true);
    shops += pcRow(`${a.icon} ${a.name}점 · ${b.mgr.name} ★${b.mgr.skill}`, (est.net >= 0 ? '+' : '') + won(est.net));
  }
  if (save.shop && save.branches.length < BRANCH_COSTS.length) shops += `<div class="sub" style="margin-top:6px">다음 출점 ${won(BRANCH_COSTS[save.branches.length])} · 평점 ★${NEED_RATING.toFixed(1)} 필요</div>`;
  L += `<div class="pcbox"><h3>🗺️ 내 가게들</h3>${shops}</div>`;
  L += `<div class="pcbox"><h3>🏆 기록</h3>${pcRow('최고 주간 순이익', won(save.best))}${pcRow('구운 붕어빵', save.total.toLocaleString() + '개')}${save.legacy ? pcRow('장인 비법', 'Lv.' + save.legacy) : ''}</div>`;
  $('pcLeft').innerHTML = L;

  let R = `<div class="pcbox"><h3>💵 사장님 지갑</h3><div class="big">${won(save.money)}</div><div class="sub">평점 ★${save.rating.toFixed(1)}${save.debt ? ' · 대출 ' + won(save.debt) : ''}</div></div>`;
  if (G && running) {
    const st = G.stats;
    const brs = save.branches.reduce((a, b) => a + branchWeek(b, save.day, true).net, 0);
    const rent = save.shop ? RENT : 0, intr = Math.round(save.debt * INTEREST);
    const est = st.revenue + st.tips - st.cost - rent + brs - intr;
    R += `<div class="pcbox"><h3>💰 이번 주 장부 (진행 중)</h3>${pcRow('매출 + 팁', won(st.revenue + st.tips))}${pcRow('재료비', won(-st.cost))}${rent ? pcRow('본점 월세', won(-rent)) : ''}${save.branches.length ? pcRow('직영점 예상', won(brs)) : ''}${intr ? pcRow('대출 이자', won(-intr)) : ''}${pcRow('예상 순이익', won(est), 'total')}${pcRow('손님 웃음 / 화남', st.happy + ' / ' + st.angry + '명')}</div>`;
    const need = {};
    for (const cu of G.customers) if (cu && !cu.leave) for (const t in cu.order) need[t] = (need[t] || 0) + cu.order[t];
    let ord = '';
    for (const t of TYPE_KEYS) {
      if (!unlocked(t)) continue;
      const n = need[t] || 0, have = trayCount(t);
      ord += pcRow(TYPES[t].name, `<span class="${n && have < n ? 'no' : 'ok'}">진열 ${have}</span> / 주문 ${n}`);
    }
    R += `<div class="pcbox"><h3>📋 주문 현황</h3>${ord}${save.upg.alba ? `<div class="sub" style="margin-top:6px">🧑‍🍳 알바 ${save.upg.alba}명이 5초마다 굽는 중</div>` : ''}</div>`;
  }
  R += `<div class="pcbox keys"><h3>⌨️ 단축키</h3>
    <div><kbd>1</kbd>~<kbd>5</kbd> 반죽·팥·슈크림·초코·피자</div>
    <div><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 틀 (누르고 있으면 반죽)</div>
    <div><kbd>Space</kbd> 덮기·뒤집기·꺼내기 (마지막 틀)</div>
    <div><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd> 손님에게 건네기</div>
    <div><kbd>P</kbd> 잠깐 쉬기</div></div>`;
  $('pcRight').innerHTML = R;
}
setInterval(updatePanels, 300);

// 시험용
window.__bungeo = { get G() { return G; }, save: () => save, openNews, setSave: o => { Object.assign(save, o); persist(); }, startDay, moldAction, startPour, stopPour, addFilling, serve, setTool: t => tool = t, endDay };
})();
