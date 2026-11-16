'use strict';
/* 오늘의 그림일기 카드(캔버스) — 크레파스 느낌 그림 + 원고지 글씨 + 선생님 도장 */
const Diary = (() => {
  const INK = '#3b3127', RED = '#e04b3c';
  const r = (a, b) => a + Math.random() * (b - a);
  let ctx;

  // ── 크레파스 도구 ──
  function crayon(pts, color, w = 6, close = false) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = pass ? 0.45 : 0.85; ctx.lineWidth = w * (pass ? 0.6 : 1);
      ctx.beginPath();
      pts.forEach((p, i) => { const x = p[0] + r(-1.6, 1.6), y = p[1] + r(-1.6, 1.6); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (close) ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  function circlePts(x, y, rx, ry = rx, a0 = 0, a1 = Math.PI * 2) {
    const n = 28, pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]); }
    return pts;
  }
  function circle(x, y, rad, color, w = 6, fill) { if (fill) hatch(() => { ctx.arc(x, y, rad, 0, 7); }, fill); crayon(circlePts(x, y, rad), color, w); }
  function rect(x, y, w, h, color, lw = 6, fill) {
    if (fill) hatch(() => ctx.rect(x, y, w, h), fill);
    crayon([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, lw);
  }
  function hatch(pathFn, color, gap = 7) {
    ctx.save(); ctx.beginPath(); pathFn(); ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 잘라낸 영역은 그대로, 줄은 캔버스 전체 기준으로
    const CW = ctx.canvas.width, CH = ctx.canvas.height;
    ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = 0.55; ctx.lineWidth = gap * 0.95; ctx.beginPath();
      const o = pass ? gap / 2 : 0;
      for (let i = -CH; i < CW; i += gap) { ctx.moveTo(i + o + r(-2, 2), 0); ctx.lineTo(i + o + CH + r(-2, 2), CH); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function text(t, x, y, size, color = INK, align = 'center', weight = 700) {
    ctx.save(); ctx.font = `${weight} ${size}px Gaegu, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y); ctx.restore();
  }

  // ── 사람 ──  mood: happy | sad | sleep | shock | angry
  function person(x, y, s, o = {}) {
    const { mood = 'happy', shirt = '#ffcc33', tilt = 0, arms = 'down', hair = INK } = o;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
    // 다리
    crayon([[-12, 0], [-16, 70]], INK, 7); crayon([[12, 0], [16, 70]], INK, 7);
    // 몸
    hatch(() => { ctx.moveTo(-34, 4); ctx.lineTo(-26, -90); ctx.lineTo(26, -90); ctx.lineTo(34, 4); ctx.closePath(); }, shirt);
    crayon([[-34, 4], [-26, -90], [26, -90], [34, 4], [-34, 4]], INK, 6);
    // 팔
    const A = { down: [[-28, -80, -50, -20], [28, -80, 50, -20]], up: [[-26, -84, -60, -150], [26, -84, 60, -150]],
      run: [[-26, -80, -66, -50], [26, -80, 62, -110]], hold: [[-26, -80, -40, -150], [28, -80, 50, -20]] }[arms];
    A.forEach(a => crayon([[a[0], a[1]], [a[2], a[3]]], INK, 7));
    // 머리
    hatch(() => ctx.arc(0, -130, 40, 0, 7), '#f6cfa6');
    crayon(circlePts(0, -130, 40), INK, 6);
    crayon(circlePts(0, -138, 41, 34, Math.PI * 1.05, Math.PI * 1.95), hair, 10);
    // 얼굴
    if (mood === 'sleep') { crayon([[-20, -132], [-8, -132]], INK, 5); crayon([[8, -132], [20, -132]], INK, 5); crayon(circlePts(0, -112, 6), INK, 4); }
    else if (mood === 'shock') { circle(-14, -134, 6, INK, 5); circle(14, -134, 6, INK, 5); crayon(circlePts(0, -110, 9, 12), INK, 5); }
    else {
      crayon([[-15, -137], [-13, -129]], INK, 7); crayon([[15, -137], [13, -129]], INK, 7);
      if (mood === 'happy') crayon(circlePts(0, -120, 16, 12, 0.2, Math.PI - 0.2), INK, 5);
      else if (mood === 'sad') crayon(circlePts(0, -104, 14, 10, Math.PI + 0.3, Math.PI * 2 - 0.3), INK, 5);
      else if (mood === 'angry') { crayon([[-24, -150], [-6, -142]], INK, 5); crayon([[24, -150], [6, -142]], INK, 5); crayon([[-12, -110], [12, -110]], INK, 5); }
      if (mood === 'happy') { circle(-26, -116, 6, '#ff9a9a', 6); circle(26, -116, 6, '#ff9a9a', 6); }
    }
    if (mood === 'sad' || mood === 'shock') crayon([[44, -150], [40, -136], [46, -132]], '#5aa0ff', 5);
    ctx.restore();
  }
  function zzz(x, y) { text('Z', x, y, 44, '#5a6fd6'); text('z', x + 30, y - 34, 34, '#5a6fd6'); text('z', x + 52, y - 60, 26, '#5a6fd6'); }
  function sun(x, y, rad = 46) { circle(x, y, rad, '#ff9a1f', 7, '#ffd34d'); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; crayon([[x + Math.cos(a) * (rad + 12), y + Math.sin(a) * (rad + 12)], [x + Math.cos(a) * (rad + 34), y + Math.sin(a) * (rad + 34)]], '#ff9a1f', 6); } }
  function cloud(x, y, s = 1, fill = '#ffffff', line = '#8a9bb0') {
    hatch(() => { ctx.arc(x - 40 * s, y, 30 * s, 0, 7); ctx.arc(x, y - 20 * s, 40 * s, 0, 7); ctx.arc(x + 42 * s, y, 30 * s, 0, 7); ctx.rect(x - 40 * s, y, 82 * s, 30 * s); }, fill);
    crayon([...circlePts(x - 40 * s, y, 30 * s, 30 * s, Math.PI * 0.5, Math.PI * 1.6), ...circlePts(x, y - 20 * s, 40 * s, 40 * s, Math.PI * 1.1, Math.PI * 1.95), ...circlePts(x + 42 * s, y, 30 * s, 30 * s, Math.PI * 1.4, Math.PI * 2.5), [x - 40 * s, y + 30 * s]], line, 5);
  }
  function rain(x, y, w, h) { for (let i = 0; i < 14; i++) { const px = x + r(0, w), py = y + r(0, h); crayon([[px, py], [px - 8, py + 26]], '#5aa0ff', 5); } }
  function bolt(x, y) { hatch(() => { ctx.moveTo(x, y); ctx.lineTo(x - 26, y + 60); ctx.lineTo(x - 4, y + 60); ctx.lineTo(x - 18, y + 110); ctx.lineTo(x + 26, y + 40); ctx.lineTo(x + 4, y + 40); ctx.lineTo(x + 16, y); ctx.closePath(); }, '#ffd34d'); }
  function clock(x, y, rad, time) {
    circle(x, y, rad, INK, 6, '#ffffff');
    const [h, m] = time.split(':').map(Number), am = (m / 60) * Math.PI * 2 - Math.PI / 2, ah = ((h % 12) / 12 + m / 720) * Math.PI * 2 - Math.PI / 2;
    crayon([[x, y], [x + Math.cos(ah) * rad * 0.5, y + Math.sin(ah) * rad * 0.5]], INK, 7);
    crayon([[x, y], [x + Math.cos(am) * rad * 0.8, y + Math.sin(am) * rad * 0.8]], RED, 5);
  }

  // ── 장면 (1000 x 600 안에서) ──
  const SCENES = {
    alarm(res, g) {
      hatch(() => ctx.rect(0, 0, 1000, 600), g === 2 ? '#fff1c9' : '#e6f3ff');
      rect(640, 50, 260, 180, INK, 6, '#bfe3ff'); crayon([[770, 50], [770, 230]], INK, 5); crayon([[640, 140], [900, 140]], INK, 5);
      if (g === 2) sun(830, 100, 34); else { hatch(() => ctx.arc(720, 100, 30, 0, 7), '#ffe39a'); }
      rect(60, 380, 560, 110, INK, 6, '#8fb7e8'); crayon([[60, 380], [60, 560]], INK, 8); crayon([[620, 380], [620, 560]], INK, 8);
      rect(80, 340, 130, 50, INK, 5, '#ffffff');
      if (g === 0) { person(760, 470, 1.35, { mood: 'happy', arms: 'up' }); text('기지개~', 760, 250, 46, '#ff7b29'); }
      else if (g === 1) { person(300, 440, 1.0, { mood: 'sleep', arms: 'down', tilt: -0.5 }); text('5분만…', 420, 230, 50, '#5a6fd6'); }
      else { hatch(() => { ctx.ellipse(330, 380, 230, 70, 0, Math.PI, 0); }, '#5f86c9'); circle(150, 330, 40, INK, 6, '#f6cfa6'); zzz(200, 260); text('늦었다!!', 800, 300, 64, RED); }
      clock(500, 210, 70, res.wakeAt || '07:00');
      if (g > 0) { crayon([[420, 150], [400, 130]], RED, 6); crayon([[580, 150], [600, 130]], RED, 6); crayon([[430, 260], [405, 280]], RED, 6); crayon([[570, 260], [595, 280]], RED, 6); }
    },
    subway(res, g) {
      hatch(() => ctx.rect(0, 0, 1000, 600), '#e3e8ef');
      rect(-10, 40, 1020, 150, INK, 6, '#6f86a8');
      for (let i = 0; i < 7; i++) { const x = 70 + i * 145; crayon([[x, 190], [x, 230]], INK, 4); crayon(circlePts(x, 245, 14), INK, 5); }
      const C = ['#9aa7c0', '#c7a689', '#a8c79a', '#b79ac7', '#8fa3b5'];
      [110, 250, 390, 610, 750, 890].forEach((x, i) => person(x, 520, 0.95, { mood: g === 2 ? 'angry' : 'sad', shirt: C[i % 5] }));
      const tilt = [0, 0.32, 0.6][g];
      person(500, 540, 1.15, { mood: g === 0 ? 'happy' : 'shock', tilt, arms: g === 0 ? 'hold' : 'run' });
      if (g > 0) text('덜컹!', 820, 300, 70, RED);
      if (g === 2) text('죄송합니다…', 300, 300, 46, INK);
      if (g === 0) text('평온', 500, 120, 44, '#ffffff');
    },
    lunch(res, g) {
      hatch(() => ctx.rect(0, 0, 1000, 600), '#fff4dc');
      person(200, 470, 1.0, { mood: g === 2 ? 'happy' : 'happy', shirt: '#7d8fb3' });
      person(800, 470, 1.0, { mood: g === 0 ? 'happy' : 'angry', shirt: '#b38a7d' });
      person(500, 470, 1.15, { mood: g === 0 ? 'happy' : 'sad' });
      rect(80, 440, 840, 40, INK, 6, '#c99a6b'); crayon([[140, 480], [140, 600]], INK, 8); crayon([[860, 480], [860, 600]], INK, 8);
      const bowl = (x) => { hatch(() => ctx.ellipse(x, 430, 70, 34, 0, 0, Math.PI), '#ffffff'); crayon(circlePts(x, 430, 70, 34, 0, Math.PI), INK, 6); crayon([[x - 70, 430], [x + 70, 430]], INK, 6); };
      bowl(500);
      const food = (res.food || '').length < 6 ? res.food : '';
      if (g === 2) { text(food === '청국장' ? '청국장' : (food || '???'), 500, 530, 44, '#8a5a1f'); crayon([[470, 360], [460, 320], [475, 290]], '#9a7a40', 5); crayon([[530, 360], [540, 320], [525, 290]], '#9a7a40', 5); text('…', 500, 200, 60, INK); }
      else { text('냠냠', 500, 210, 56, '#ff7b29'); crayon([[480, 400], [470, 370]], '#ffb366', 5); crayon([[520, 400], [530, 370]], '#ffb366', 5); }
      text(g === 0 ? '센스왕!' : '아무거나라며…', 800, 160, 44, g === 0 ? '#3aa65b' : RED);
    },
    doze(res, g) {
      hatch(() => ctx.rect(0, 0, 1000, 600), '#eef1f6');
      rect(330, 90, 340, 230, INK, 7, '#2d3340'); rect(355, 112, 290, 185, INK, 4, '#ffffff');
      for (let i = 0; i < 6; i++) crayon([[365, 135 + i * 28], [635, 135 + i * 28]], '#9fb0c4', 3);
      crayon([[500, 320], [500, 370]], INK, 8);
      rect(60, 430, 880, 50, INK, 6, '#c99a6b');
      if (g === 0) { person(500, 560, 1.0, { mood: 'happy', arms: 'hold' }); rect(640, 370, 50, 60, INK, 5, '#ffffff'); text('커피 수혈', 820, 160, 42, '#8a5a1f'); }
      else { person(470, 590, 1.0, { mood: 'sleep', tilt: 0.5 }); zzz(560, 380); }
      if (g === 2) { person(850, 480, 1.25, { mood: 'angry', shirt: '#4a5470' }); text('자네 지금 자나?', 770, 120, 46, RED); text('!', 920, 230, 80, RED); }
      if (g === 1) { person(880, 480, 1.1, { mood: 'angry', shirt: '#4a5470' }); text('흠…', 880, 230, 50, RED); }
    },
    leave(res, g) {
      if (!res.escaped) {
        hatch(() => ctx.rect(0, 0, 1000, 600), '#2c3557');
        rect(60, 40, 300, 170, '#ffffff', 5, '#1c2340'); for (let i = 0; i < 6; i++) text('★', 90 + i * 45, 80 + (i % 2) * 70, 30, '#ffe066');
        hatch(() => ctx.arc(780, 110, 50, 0, 7), '#ffe39a'); hatch(() => ctx.arc(805, 95, 45, 0, 7), '#2c3557');
        hatch(() => { ctx.moveTo(500, 140); ctx.lineTo(330, 470); ctx.lineTo(670, 470); ctx.closePath(); }, 'rgba(255,230,140,.5)');
        crayon([[500, 140], [560, 60], [620, 90]], '#ffffff', 6);
        person(500, 520, 1.1, { mood: 'sad', shirt: '#9aa7c0' });
        rect(60, 450, 880, 40, '#ffffff', 6, '#7a5a3a');
        clock(870, 330, 60, '22:00'); text('야근…', 200, 340, 64, '#ffffff');
        return;
      }
      hatch(() => ctx.rect(0, 0, 1000, 600), '#ffd9a8');
      hatch(() => ctx.rect(0, 380, 1000, 220), '#d9c4a8');
      sun(160, 120, 50);
      rect(760, 150, 150, 260, INK, 7, '#a0663a'); circle(885, 290, 10, INK, 4, '#ffd34d');
      text('EXIT', 835, 120, 40, '#3aa65b');
      person(560, 470, 1.2, { mood: g === 0 ? 'happy' : 'shock', arms: 'run', tilt: 0.15 });
      rect(420, 360, 60, 50, INK, 5, '#5a4632');
      crayon([[390, 340], [330, 340]], INK, 5); crayon([[390, 380], [310, 380]], INK, 5); crayon([[390, 420], [340, 420]], INK, 5);
      text(g === 0 ? '칼퇴!!' : '도망!!', 560, 140, 72, g === 0 ? '#e04b3c' : '#8a5a1f');
      if (g > 0) { person(120, 520, 0.8, { mood: 'angry', shirt: '#4a5470' }); text('내일 회의 자료는?', 230, 300, 34, RED); }
    },
  };

  // ── 글 만들기 ──
  const TITLE = {
    alarm: '지각할 뻔한 날', subway: '지하철에서 춤춘 날', lunch: '청국장 먹은 날', doze: '부장님께 들킨 날', leave: '야근한 날',
  };
  function weather(avg) {
    if (avg >= 85) return ['맑음', 'sun']; if (avg >= 65) return ['구름 조금', 'part']; if (avg >= 45) return ['흐림', 'cloud'];
    if (avg >= 25) return ['비', 'rain']; return ['천둥 번개', 'storm'];
  }
  function drawWeather(kind, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.62, 0.62);
    if (kind === 'sun') sun(0, 0, 40);
    else if (kind === 'part') { sun(-30, -20, 30); cloud(20, 20, 0.8); }
    else if (kind === 'cloud') { cloud(-10, 10, 1, '#d6dde6'); }
    else if (kind === 'rain') { cloud(0, -10, 0.9, '#c3ccd8'); rain(-60, 30, 120, 50); }
    else { cloud(0, -10, 0.9, '#9aa4b2', INK); bolt(10, 20); }
    ctx.restore();
  }
  const STAMP = [[85, '참 잘했어요'], [60, '잘했어요'], [35, '수고했어요'], [0, '내일은 잘할 거야']];
  const COMMENT = [[85, '어른이 되어서도 참 잘하고 있어요!'], [60, '오늘도 버텨 낸 거, 대단해요.'], [35, '그래도 집에 왔으니 장해요!'], [0, '푹 자고 내일 다시 해 봐요 :)']];
  const END = [[85, '오늘 나 좀 멋졌다.'], [60, '그래도 잘 버텼다.'], [35, '내일은 더 잘하자.'], [0, '내일은 금요일이면 좋겠다.']];
  const pickBy = (arr, v) => arr.find(a => v >= a[0])[1];

  async function render(results, lines) {
    try { await Promise.race([document.fonts.load('700 40px Gaegu'), new Promise(res => setTimeout(res, 2500))]); } catch (e) {}
    const keys = ['alarm', 'subway', 'lunch', 'doze', 'leave'];
    const scores = keys.map(k => results[k].score), avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const g = s => (s >= 70 ? 0 : s >= 40 ? 1 : 2);
    let worst = keys.reduce((a, k) => (results[k].score < results[a].score ? k : a), keys[0]);
    let hi = results[worst].score < 50 ? worst : 'leave';
    let title = results[worst].score < 50 ? TITLE[worst] : results.leave.escaped ? (avg >= 85 ? '완벽한 하루' : '칼퇴한 날') : '야근한 날';
    if (hi === 'leave' && !results.leave.escaped) title = '야근한 날';
    const body = (lines.join(' ') + ' ' + pickBy(END, avg)).replace(/\s+/g, ' ');

    const W = 1080, COLS = 16, CELL = 1000 / COLS;
    // 원고지 칸 나누기 (줄 맨 앞 띄어쓰기는 건너뜀)
    const cells = []; let row = [];
    for (const ch of body) {
      if (ch === ' ' && row.length === 0) continue;
      if (row.length === 0 && '.,!?…'.includes(ch) && cells.length) { const pr = cells[cells.length - 1]; pr[pr.length - 1] += ch; continue; }
      row.push(ch); if (row.length === COLS) { cells.push(row); row = []; }
    }
    if (row.length) cells.push(row);
    const gridY = 920, H = gridY + cells.length * CELL + 270;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');

    // 종이
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.05; for (let i = 0; i < 2500; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#a07a40'; ctx.fillRect(r(0, W), r(0, H), 2, 2); } ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(20, 20, W - 40, H - 40);

    // 머리줄: 날짜 / 날씨
    const d = new Date(), days = '일월화수목금토';
    ctx.lineWidth = 3; ctx.strokeRect(40, 40, 1000, 110); ctx.beginPath(); ctx.moveTo(690, 40); ctx.lineTo(690, 150); ctx.stroke();
    text(`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`, 365, 96, 50);
    const [wName, wKind] = weather(avg);
    text('날씨', 735, 96, 36, '#7a6a55', 'center', 400);
    drawWeather(wKind, 830, 96);
    text(wName, 960, 96, 36);
    // 제목
    ctx.strokeRect(40, 160, 1000, 90);
    text('제목:', 60, 207, 44, '#7a6a55', 'left', 400);
    text(title, 175, 207, 56, INK, 'left');
    // 그림
    ctx.save(); ctx.translate(40, 270); ctx.beginPath(); ctx.rect(0, 0, 1000, 600); ctx.clip();
    SCENES[hi](results[hi], g(results[hi].score)); ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(40, 270, 1000, 600);
    // 원고지
    ctx.strokeStyle = '#7fbf8f'; ctx.lineWidth = 2;
    for (let i = 0; i < cells.length; i++) for (let j = 0; j < COLS; j++) ctx.strokeRect(40 + j * CELL, gridY + i * CELL, CELL, CELL);
    ctx.lineWidth = 4; ctx.strokeRect(40, gridY, 1000, cells.length * CELL);
    cells.forEach((rowc, i) => rowc.forEach((ch, j) => text(ch, 40 + j * CELL + CELL / 2, gridY + i * CELL + CELL / 2 + 3, CELL * 0.78, '#2b2620', 'center', 400)));

    // 선생님 한마디 + 도장
    const by = gridY + cells.length * CELL;
    text('선생님 한마디:', 60, by + 62, 36, RED, 'left');
    text(pickBy(COMMENT, avg), 60, by + 112, 40, RED, 'left');
    const stamp = pickBy(STAMP, avg);
    ctx.save(); ctx.translate(925, by + 125); ctx.rotate(-0.18);
    ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 78, 0, 7); ctx.stroke();
    const sp = stamp.indexOf(' '), parts = sp > 0 ? [stamp.slice(0, sp), stamp.slice(sp + 1)] : [stamp];
    parts.forEach((p, i) => text(p, 0, (i - (parts.length - 1) / 2) * 48, parts.length === 1 ? 40 : p.length > 4 ? 34 : 42, RED));
    ctx.restore();
    text(`점수 ${Math.round(avg)}점 · 오늘의 그림일기 · ${(location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '')}`, 60, H - 60, 30, '#9a8a75', 'left', 400);
    return cv;
  }
  return { render };
})();
