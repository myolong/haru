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
  { key: 'sign',  icon: '🏮', name: '간판 새로 달기', desc: '붕어빵 값 +10%, 손님이 조금 더 자주 와요.', max: 3, costs: [7000, 15000, 28000] },
];

// ===== 저장 =====
let save = { day: 1, money: 0, upg: { molds: 0, fire: 0, heater: 0, sign: 0 }, best: 0, total: 0 };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s && s.day) save = Object.assign(save, s, { upg: Object.assign(save.upg, s.upg || {}) });
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ===== 캔버스 =====
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
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
function priceOf(t) { return Math.round(TYPES[t].price * (1 + 0.1 * save.upg.sign) / 10) * 10; }

function newMold() {
  return { state: 'empty', fill: 0, fill1: 0, filling: null, dA: 0, dB: 0, flipAnim: 0, overflow: false, pouring: false, cooking: false };
}

function startDay() {
  G = {
    t: 0, molds: [], tray: [], customers: [null, null, null], nextCust: 5,
    floats: [], stats: { sold: 0, revenue: 0, tips: 0, cost: 0, happy: 0, angry: 0, burnt: 0, waste: 0, starSum: 0 },
    pointers: {}, closing: false, msg: '', msgT: 0, smoke: [],
  };
  for (let i = 0; i < moldCount(); i++) G.molds.push(newMold());
  tool = 'batter';
  running = true; paused = false;
  hideAll();
  if (save.day === 1 && save.total === 0) say('반죽 주전자로 틀을 꾹 눌러 보세요!', 4);
  else say(save.day + '일차 장사 시작!', 2);
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
  const avail = TYPE_KEYS.filter(unlocked);
  const maxN = Math.min(1 + save.day, 5);
  const total = 1 + Math.floor(Math.random() * maxN);
  const order = {};
  const kinds = Math.min(avail.length, 1 + Math.floor(Math.random() * Math.min(3, total)));
  const pick = avail.slice().sort(() => Math.random() - .5).slice(0, kinds);
  for (let i = 0; i < total; i++) { const k = pick[i % pick.length]; order[k] = (order[k] || 0) + 1; }
  const pat = Math.max(26, 46 - save.day * 1.5 + total * 4) * (1 + 0.15 * save.upg.heater);
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
  if (!unlocked(t)) { say(TYPES[t].name + ' 붕어빵은 ' + TYPES[t].unlock + '일차부터 팔아요'); return; }
  if (m.state === 'empty') { say('먼저 반죽을 절반쯤 부어요'); sfx.bad(); return; }
  if (m.state !== 'pour1') { say(m.filling ? '이미 속을 넣었어요. 반죽 주전자를 골라 마저 부어요' : '이제는 속을 넣을 수 없어요'); return; }
  m.filling = t; m.fill1 = m.fill; m.state = 'filled';
  G.stats.cost += TYPES[t].cost;
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
  } else if (G.tray.length >= 16) {
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
      if (t !== 'batter' && !unlocked(t)) { say(TYPES[t].name + ' 붕어빵은 ' + TYPES[t].unlock + '일차부터 팔아요'); return; }
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
      G.nextCust = base * (0.75 + Math.random() * 0.5);
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
  // 눈
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
    ctx.fillText('틀 ' + (i + 1), cx, c.y + 133);
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
    ctx.fillText(lock ? TYPES[t].unlock + '일차부터' : t === 'batter' ? '꾹 누르기' : priceOf(t).toLocaleString() + '원', cx, r.y + 88);
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
  ctx.fillText(save.day + '일차', 12, 22);
  const left = Math.max(0, DAY_LEN - G.t);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(70, 16, 120, 12, 6); ctx.fill();
  ctx.fillStyle = left < 15 ? '#ef5a3a' : '#ffcf5a'; rr(70, 16, 120 * left / DAY_LEN, 12, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
  ctx.fillText(G.closing ? '마감' : Math.ceil(left) + '초', 196, 22);
  ctx.textAlign = 'right'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffe27a';
  ctx.fillText((G.stats.revenue + G.stats.tips).toLocaleString() + '원', W - 58, 22);
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

// ===== 화면 전환 =====
const $ = id => document.getElementById(id);
function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }
function show(id) { hideAll(); $(id).classList.add('show'); }

function refreshTitle() {
  $('titleInfo').innerHTML = save.total
    ? `<b>${save.day}일차</b> · 가진 돈 <b>${save.money.toLocaleString()}원</b><br>지금까지 구운 붕어빵 ${save.total.toLocaleString()}개`
    : '반죽 붓고, 속 넣고, 뒤집고, 꺼내고!<br>오늘부터 붕어빵 가게 사장님이에요.';
  $('btnStart').textContent = save.day > 1 ? save.day + '일차 장사 시작' : '장사 시작';
}

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
  save.money += profit;
  if (profit > save.best) save.best = profit;
  lastResult = { profit, day: save.day };
  bonusUsed = false;
  save.day++;
  persist();

  $('resTitle').textContent = lastResult.day + '일차 장사 끝!';
  $('resStars').textContent = '★'.repeat(dayStars) + '☆'.repeat(3 - dayStars);
  const row = (a, b, cls) => `<tr class="${cls || ''}"><td>${a}</td><td>${b}</td></tr>`;
  $('resTable').innerHTML =
    row('판 붕어빵', st.sold + '개') +
    row('매출', st.revenue.toLocaleString() + '원') +
    row('팁', st.tips.toLocaleString() + '원') +
    row('재료비', '−' + st.cost.toLocaleString() + '원') +
    row('웃으며 간 손님 / 화난 손님', served + ' / ' + st.angry + '명') +
    row('탄 붕어빵 / 버린 붕어빵', st.burnt + ' / ' + (st.waste + G.tray.length) + '개') +
    row('오늘 순이익', (profit >= 0 ? '' : '−') + Math.abs(profit).toLocaleString() + '원', 'total');
  const tips = [];
  if (st.burnt) tips.push('뚜껑을 덮은 뒤 버튼이 노랗게 빛나면 바로 뒤집거나 꺼내요.');
  if (st.angry) tips.push('손님이 늘면 틀을 여러 개 같이 돌려 보세요.');
  if (!st.sold) tips.unshift('진열대에 붕어빵이 모이면 손님을 눌러 건네요.');
  if (!tips.length) tips.push('완벽한 하루였어요! 업그레이드로 가게를 키워 보세요.');
  $('resNote').textContent = tips[0];
  $('btnBonus').style.display = profit > 0 ? 'block' : 'none';
  $('btnBonus').disabled = false;
  $('btnBonus').textContent = '오늘 순이익 2배 받기 (+' + Math.max(0, profit).toLocaleString() + '원)';
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

function renderShop() {
  $('shopMoney').textContent = save.money.toLocaleString();
  $('shopList').innerHTML = '';
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

$('btnToShop').onclick = () => { renderShop(); show('shop'); };
$('btnShop0').onclick = () => { renderShop(); show('shop'); };
$('btnNextDay').onclick = () => { window.Ads.interstitial(() => startDay()); };
$('btnShopBack').onclick = () => { refreshTitle(); show('title'); G = null; };
$('btnStart').onclick = () => {
  if (save.day === 1 && save.total === 0) { show('how'); $('how').dataset.thenStart = '1'; return; }
  startDay();
};
$('btnHow').onclick = () => { show('how'); };
$('btnHow2').onclick = () => { $('how').dataset.backPause = '1'; show('how'); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
  const how = $('how');
  if (how.dataset.thenStart) { delete how.dataset.thenStart; startDay(); return; }
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

// 시험용
window.__bungeo = { get G() { return G; }, save: () => save, startDay, moldAction, startPour, stopPour, addFilling, serve, setTool: t => tool = t, endDay };
})();
