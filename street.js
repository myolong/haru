// PC 넓은 화면 전용: 게임 뒤에 깔리는 연말 거리 배경.
// 건물·가게 간판·전구줄·트리·가로등·눈, 그리고 거리를 걸어 다니는 사람들.
// 게임에서 손님이 오면 거리의 사람이 가게(화면 가운데)로 걸어 들어가고, 다 사면 봉투를 들고 나가요.
(function () {
  const cv = document.getElementById('street');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr = 1, on = false;
  let bg = null, bgKey = '';
  let month = 11, snow = false;
  const people = [];
  const flakes = [];
  let t = 0;

  const SKINS = ['#f6d3b3', '#eec19a', '#d9a47c', '#f9e0c8'];
  const HAIRS = ['#2b1d16', '#4a2e1c', '#7a4a26', '#1c1c24', '#a05a2c', '#c9c0b8'];
  const COATS = ['#3d6bb3', '#b34a3d', '#3d8a5f', '#8a5fb3', '#e09a2c', '#4a4a5a', '#d06a8a', '#c9b38a', '#2f4f6f'];
  const SCARF = ['#e8e2d0', '#d6402a', '#2e8a3a', '#f2c230', '#ffffff', '#6a8ad6'];
  const SHOPS = [
    ['카페', '#6b4423', '#ffe0a8'], ['꽃집', '#2e6b4a', '#ffd6e8'], ['문구', '#3d4f8a', '#fff2b0'],
    ['빵집', '#8a5a2c', '#ffe6b8'], ['서점', '#4a3a6b', '#e8deff'], ['분식', '#a8382a', '#fff0c8'],
    ['옷가게', '#2b2b38', '#ffd0d0'], ['약국', '#2a6b6b', '#d8fff4'], ['장난감', '#b0602a', '#fff2c0'],
  ];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.random() * a.length | 0]; }
  function rr(c, x, y, ww, hh, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + ww, y, x + ww, y + hh, r); c.arcTo(x + ww, y + hh, x, y + hh, r);
    c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + ww, y, r); c.closePath();
  }
  // 이 달에 연말 장식을 하나
  function festive() { return month === 12 || month === 1 || month === 11 || month === 2; }
  function xmas() { return month === 12 || month === 1; }

  // 거리 위치
  const GROUND = () => h * 0.70;   // 건물 1층 바닥(인도 시작)
  const LANES = () => [h * 0.80, h * 0.92];

  function resize() {
    on = document.body.classList.contains('pc');
    cv.style.display = on ? 'block' : 'none';
    if (!on) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    bgKey = '';
    if (!people.length) for (let i = 0; i < 16; i++) addWalker(rnd(0, w));
    if (!flakes.length) for (let i = 0; i < 140; i++) flakes.push({ x: Math.random(), y: Math.random(), s: rnd(.6, 2.4), v: rnd(.03, .09), p: rnd(0, 6) });
  }

  // ===== 고정된 배경(건물·간판)을 한 번만 그려 둠 =====
  function buildBg() {
    const key = w + 'x' + h + ':' + (xmas() ? 'x' : festive() ? 'f' : 'n') + (snow ? 's' : '');
    if (key === bgKey) return;
    bgKey = key;
    bg = document.createElement('canvas');
    bg.width = cv.width; bg.height = cv.height;
    const c = bg.getContext('2d');
    c.scale(dpr, dpr);
    const G0 = GROUND();
    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, G0);
    sky.addColorStop(0, '#0b1030'); sky.addColorStop(.7, '#262b5a'); sky.addColorStop(1, '#3b3570');
    c.fillStyle = sky; c.fillRect(0, 0, w, G0);
    // 별
    c.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 70; i++) { c.globalAlpha = rnd(.2, .7); c.fillRect(rnd(0, w), rnd(0, G0 * .35), 1.5, 1.5); }
    c.globalAlpha = 1;
    // 먼 빌딩 실루엣
    let x = -20;
    while (x < w) {
      const bw = rnd(60, 140), bh = rnd(h * .25, h * .5);
      c.fillStyle = '#1a1f44'; c.fillRect(x, G0 - bh - h * .12, bw, bh + h * .12);
      c.fillStyle = 'rgba(255,214,140,.35)';
      for (let yy = G0 - bh - h * .1; yy < G0 - h * .2; yy += 18) for (let xx = x + 8; xx < x + bw - 10; xx += 16) if (Math.random() < .3) c.fillRect(xx, yy, 7, 9);
      x += bw + rnd(4, 20);
    }
    // 가까운 가게 건물 줄
    x = -10; let si = 0;
    while (x < w) {
      const bw = rnd(150, 230), bh = rnd(h * .32, h * .44);
      const [name, wall, light] = SHOPS[si++ % SHOPS.length];
      const top = G0 - bh;
      // 벽
      c.fillStyle = shade(wall, -.25); c.fillRect(x, top, bw, bh);
      // 위층 창문
      for (let yy = top + 18; yy < G0 - h * .17; yy += 46) {
        for (let xx = x + 16; xx + 30 < x + bw - 10; xx += 46) {
          const lit = Math.random() < .65;
          c.fillStyle = lit ? 'rgba(255,214,140,.85)' : '#141832';
          c.fillRect(xx, yy, 30, 32);
          c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(xx + 14, yy, 2, 32); c.fillRect(xx, yy + 15, 30, 2);
        }
      }
      // 1층 가게: 유리창
      const sy = G0 - h * .15;
      c.fillStyle = light; c.globalAlpha = .9; c.fillRect(x + 10, sy + 22, bw - 20, h * .15 - 22); c.globalAlpha = 1;
      const glow = c.createLinearGradient(0, sy + 22, 0, G0);
      glow.addColorStop(0, 'rgba(255,255,255,0)'); glow.addColorStop(1, 'rgba(255,170,80,.35)');
      c.fillStyle = glow; c.fillRect(x + 10, sy + 22, bw - 20, h * .15 - 22);
      c.fillStyle = 'rgba(0,0,0,.35)';
      for (let xx = x + 10; xx < x + bw - 10; xx += 44) c.fillRect(xx, sy + 22, 3, h * .15 - 22);
      // 차양
      const ac = wall;
      for (let i = 0; i < Math.ceil((bw - 8) / 22); i++) {
        c.fillStyle = i % 2 ? '#f4efe4' : ac;
        c.fillRect(x + 4 + i * 22, sy + 4, Math.min(22, bw - 8 - i * 22), 18);
      }
      // 간판
      c.fillStyle = '#1b1426'; rr(c, x + bw / 2 - 46, sy - 30, 92, 28, 7); c.fill();
      c.fillStyle = light; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(name, x + bw / 2, sy - 16);
      // 크리스마스 리스
      if (xmas() && si % 2 === 0) {
        const wx = x + bw - 30, wy = top + 40;
        c.strokeStyle = '#2e7a3a'; c.lineWidth = 8; c.beginPath(); c.arc(wx, wy, 13, 0, 7); c.stroke();
        c.fillStyle = '#d6402a'; for (let a = 0; a < 6; a++) { c.beginPath(); c.arc(wx + Math.cos(a) * 13, wy + Math.sin(a) * 13, 2.5, 0, 7); c.fill(); }
        c.fillStyle = '#d6402a'; c.fillRect(wx - 5, wy + 10, 10, 6);
      }
      // 지붕 눈
      if (snow) { c.fillStyle = '#eef3ff'; rr(c, x - 2, top - 5, bw + 4, 9, 4); c.fill(); }
      x += bw + 6;
    }
    // 인도
    const side = c.createLinearGradient(0, G0, 0, h);
    side.addColorStop(0, '#4a4560'); side.addColorStop(1, '#2a2840');
    c.fillStyle = side; c.fillRect(0, G0, w, h - G0);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
    for (let yy = G0 + 14; yy < h; yy += 22) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
    for (let yy = G0, r = 0; yy < h; yy += 22, r++) for (let xx = (r % 2) * 30; xx < w; xx += 60) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 22); c.stroke(); }
    c.fillStyle = 'rgba(255,190,110,.10)'; c.fillRect(0, G0, w, 10);
    if (snow) {
      c.fillStyle = 'rgba(240,245,255,.85)';
      for (let xx = 0; xx < w; xx += rnd(80, 200)) { c.beginPath(); c.ellipse(xx, G0 + 4, rnd(30, 70), 7, 0, 0, 7); c.fill(); }
    }
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  // ===== 움직이는 것들 =====
  function lamps() { const gp = gaps(); return [gp.r + 40]; }
  function drawLamps() {
    const G0 = GROUND();
    for (const x of lamps()) {
      ctx.fillStyle = '#20202c'; ctx.fillRect(x - 3, G0 - h * .30, 6, h * .30 + 16);
      ctx.fillRect(x - 14, G0 - h * .30, 28, 6);
      const gl = ctx.createRadialGradient(x, G0 - h * .28, 4, x, G0 - h * .28, 140);
      gl.addColorStop(0, 'rgba(255,220,140,.55)'); gl.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, G0 - h * .28, 140, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(x, G0 - h * .28 + 4, 7, 0, 7); ctx.fill();
      // 바닥 불빛
      const fg = ctx.createRadialGradient(x, G0 + 30, 5, x, G0 + 30, 130); fg.addColorStop(0, 'rgba(255,210,130,.16)'); fg.addColorStop(1, 'rgba(255,210,130,0)'); ctx.fillStyle = fg; ctx.fillRect(x - 130, G0 - 20, 260, 110);
    }
  }
  // 전구줄
  const BULBS = ['#ff5a4a', '#ffd34a', '#5ad46a', '#5ab4ff', '#ff8ad8'];
  function drawLights() {
    if (!festive()) return;
    const y0 = h * .14, sag = h * .07;
    for (let row = 0; row < 2; row++) {
      const yb = y0 + row * h * .13, span = 260 + row * 60;
      for (let x0 = -span / 2 * row; x0 < w; x0 += span) {
        ctx.strokeStyle = 'rgba(20,20,30,.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) { const u = i / 20, xx = x0 + u * span, yy = yb + Math.sin(u * Math.PI) * sag; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
        for (let i = 1; i < 12; i++) {
          const u = i / 12, xx = x0 + u * span, yy = yb + Math.sin(u * Math.PI) * sag + 4;
          const k = (i + row * 3 + Math.floor(x0 / span)) % BULBS.length;
          const blink = .55 + .45 * Math.sin(t * 2.4 + i * 1.7 + x0);
          ctx.globalAlpha = .25 * blink; ctx.fillStyle = BULBS[k];
          ctx.beginPath(); ctx.arc(xx, yy, 9, 0, 7); ctx.fill();
          ctx.globalAlpha = .6 + .4 * blink; ctx.beginPath(); ctx.arc(xx, yy, 3.2, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  // 트리 (양 끝 보이는 자리)
  function drawTree(x, s) {
    const G0 = GROUND() + 10;
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 8 * s, G0 - 30 * s, 16 * s, 30 * s);
    for (let i = 0; i < 4; i++) {
      const yy = G0 - 30 * s - i * 46 * s, ww = (110 - i * 22) * s;
      ctx.fillStyle = i % 2 ? '#2a7a3e' : '#236a35';
      ctx.beginPath(); ctx.moveTo(x - ww / 2, yy); ctx.lineTo(x + ww / 2, yy); ctx.lineTo(x, yy - 70 * s); ctx.closePath(); ctx.fill();
      if (snow) { ctx.fillStyle = 'rgba(240,245,255,.8)'; ctx.fillRect(x - ww / 2 + 6, yy - 4, ww - 12, 4); }
    }
    for (let i = 0; i < 26; i++) {
      const u = (i * 37 % 100) / 100, lv = i % 4;
      const yy = G0 - 40 * s - lv * 46 * s - u * 30 * s, ww = (100 - lv * 22) * s * (1 - u * .6);
      const xx = x + ((i * 53 % 100) / 100 - .5) * ww;
      const blink = .5 + .5 * Math.sin(t * 3 + i);
      ctx.fillStyle = BULBS[i % BULBS.length]; ctx.globalAlpha = .5 + .5 * blink;
      ctx.beginPath(); ctx.arc(xx, yy, 3 * s, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    // 별
    const sy = G0 - 30 * s - 3 * 46 * s - 72 * s;
    ctx.fillStyle = '#ffd34a'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 * s : 14 * s, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    // 선물 상자
    const gifts = [['#d6402a', -50], ['#3d6bb3', -22], ['#e9a514', 26], ['#8a5fb3', 52]];
    for (const [col, dx] of gifts) {
      const gw = 26 * s, gh = 20 * s, gx = x + dx * s - gw / 2;
      ctx.fillStyle = col; ctx.fillRect(gx, G0 - gh, gw, gh);
      ctx.fillStyle = '#fff3d6'; ctx.fillRect(gx + gw / 2 - 2, G0 - gh, 4, gh); ctx.fillRect(gx, G0 - gh / 2 - 2, gw, 4);
    }
  }
  // 네온 글씨
  function drawNeon() {
    if (!festive()) return;
    const text = xmas() ? (month === 12 ? 'Merry Christmas' : 'Happy New Year') : '따끈한 겨울';
    const gp = gaps(), x = gp.r, y = h * .27;
    ctx.save();
    ctx.font = 'bold italic 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fl = Math.sin(t * 7) > -.95 ? 1 : .4;
    ctx.shadowColor = '#ff6ab0'; ctx.shadowBlur = 18 * fl;
    ctx.fillStyle = fl > .5 ? '#ffd0ea' : '#a06a88';
    const words = text.split(' ');
    words.forEach((wd, i) => ctx.fillText(wd, x, y + (i - (words.length - 1) / 2) * 30));
    ctx.restore();
  }

  // ===== 지나가는 사람 =====
  function addWalker(x, opts) {
    const lane = opts && opts.lane != null ? opts.lane : (Math.random() < .5 ? 0 : 1);
    const dir = opts && opts.dir ? opts.dir : (Math.random() < .5 ? 1 : -1);
    const p = {
      x: x != null ? x : (dir > 0 ? -60 : w + 60), lane, dir,
      v: rnd(38, 62), ph: rnd(0, 6),
      skin: pick(SKINS), hair: pick(HAIRS), coat: pick(COATS), scarf: pick(SCARF),
      hat: Math.random() < (xmas() ? .35 : .15) ? (xmas() && Math.random() < .5 ? 'santa' : 'beanie') : null,
      hatCol: pick(['#c94a3a', '#3d6bb3', '#2e8a3a', '#e9a514']),
      carry: Math.random() < (festive() ? .45 : .2) ? pick(['bag', 'gift', 'bag']) : null,
      kid: Math.random() < .12,
      target: null, fade: 1, mood: null, moodT: 0,
    };
    if (opts) Object.assign(p, opts);
    people.push(p);
    return p;
  }
  function stallX() { return w / 2; }
  // 현황판과 게임 사이 빈 거리(보이는 곳)의 가운데
  function gaps() {
    const g = document.getElementById('game').getBoundingClientRect();
    const L = document.getElementById('pcLeft').getBoundingClientRect();
    const R = document.getElementById('pcRight').getBoundingClientRect();
    return { l: (L.right + g.left) / 2, r: (g.right + R.left) / 2, lw: g.left - L.right, rw: R.left - g.right };
  }

  // 손님이 가게로 걸어 들어가요
  function arrive() {
    if (!on) return;
    const cx = stallX();
    // 가게 쪽으로 오고 있던 사람 중 가까운 사람을 고름
    let best = null, bd = 1e9;
    for (const p of people) {
      if (p.target != null || p.fade < 1) continue;
      const d = (cx - p.x) * p.dir;
      if (d > 120 && d < 520 && d < bd) { bd = d; best = p; }
    }
    if (!best) {
      const dir = Math.random() < .5 ? 1 : -1;
      best = addWalker(cx - dir * rnd(300, 420), { dir });
    }
    best.target = cx + rnd(-30, 30);
    best.v = 70;
  }
  // 다 산 손님이 봉투를 들고 나가요
  function leave(mood) {
    if (!on) return;
    const dir = Math.random() < .5 ? 1 : -1;
    addWalker(stallX() + dir * 60, { dir, carry: mood === 'angry' ? null : 'bun', mood, moodT: 2.5, fade: 0, fadeIn: true, lane: 1 });
  }

  function drawPerson(p) {
    const lanes = LANES();
    const s = (p.lane ? 1 : .8) * (h / 900) * (p.kid ? .72 : 1);
    const footY = lanes[p.lane];
    const x = p.x;
    const step = Math.sin(p.ph);
    ctx.save();
    ctx.globalAlpha = p.fade;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, footY, 20 * s, 5 * s, 0, 0, 7); ctx.fill();
    // 다리
    ctx.strokeStyle = '#2a2a36'; ctx.lineWidth = 8 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, footY - 34 * s); ctx.lineTo(x + step * 9 * s, footY - 3 * s);
    ctx.moveTo(x, footY - 34 * s); ctx.lineTo(x - step * 9 * s, footY - 3 * s); ctx.stroke();
    // 몸(코트)
    const by = footY - 30 * s + Math.abs(Math.cos(p.ph)) * -2 * s;
    ctx.fillStyle = p.coat; rr(ctx, x - 17 * s, by - 52 * s, 34 * s, 56 * s, 13 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x - 1.5 * s, by - 48 * s, 3 * s, 50 * s);
    // 팔 + 든 것
    const arm = -step * 8 * s;
    ctx.strokeStyle = shade(p.coat, -.2); ctx.lineWidth = 8 * s;
    ctx.beginPath(); ctx.moveTo(x + p.dir * 6 * s, by - 42 * s); ctx.lineTo(x + p.dir * 6 * s + arm, by - 16 * s); ctx.stroke();
    const hx = x + p.dir * 6 * s + arm, hy = by - 12 * s;
    if (p.carry === 'bag') {
      ctx.fillStyle = '#e9d6b0'; ctx.fillRect(hx - 9 * s, hy, 18 * s, 20 * s);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(hx, hy, 5 * s, Math.PI, 0); ctx.stroke();
    } else if (p.carry === 'gift') {
      ctx.fillStyle = '#d6402a'; ctx.fillRect(hx - 10 * s, hy - 4 * s, 20 * s, 18 * s);
      ctx.fillStyle = '#ffd34a'; ctx.fillRect(hx - 1.5 * s, hy - 4 * s, 3 * s, 18 * s); ctx.fillRect(hx - 10 * s, hy + 4 * s, 20 * s, 3 * s);
    } else if (p.carry === 'bun') {
      // 붕어빵 종이봉투
      ctx.fillStyle = '#f3e2c0'; ctx.beginPath(); ctx.moveTo(hx - 10 * s, hy - 2 * s); ctx.lineTo(hx + 10 * s, hy - 2 * s); ctx.lineTo(hx + 7 * s, hy + 20 * s); ctx.lineTo(hx - 7 * s, hy + 20 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9954a'; ctx.beginPath(); ctx.ellipse(hx, hy - 3 * s, 8 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (.25 + .15 * Math.sin(t * 4 + x)) + ')';
      ctx.beginPath(); ctx.arc(hx + Math.sin(t * 3) * 2, hy - 12 * s, 4 * s, 0, 7); ctx.fill();
    }
    // 목도리
    ctx.fillStyle = p.scarf; rr(ctx, x - 13 * s, by - 58 * s, 26 * s, 9 * s, 4 * s); ctx.fill();
    // 머리
    const hy0 = by - 72 * s;
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x, hy0, 14 * s, 0, 7); ctx.fill();
    ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(x - p.dir * 2 * s, hy0 - 3 * s, 14.5 * s, Math.PI * 1.0, Math.PI * 2.0); ctx.fill();
    ctx.beginPath(); ctx.arc(x - p.dir * 9 * s, hy0 + 1 * s, 7 * s, 0, 7); ctx.fill();
    if (p.hat === 'santa') {
      ctx.fillStyle = '#c94a3a'; ctx.beginPath(); ctx.moveTo(x - 14 * s, hy0 - 6 * s); ctx.lineTo(x + 14 * s, hy0 - 6 * s); ctx.lineTo(x - p.dir * 16 * s, hy0 - 30 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, x - 15 * s, hy0 - 9 * s, 30 * s, 6 * s, 3 * s); ctx.fill();
      ctx.beginPath(); ctx.arc(x - p.dir * 16 * s, hy0 - 30 * s, 4 * s, 0, 7); ctx.fill();
    } else if (p.hat === 'beanie') {
      ctx.fillStyle = p.hatCol; ctx.beginPath(); ctx.arc(x, hy0 - 4 * s, 14.5 * s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x, hy0 - 19 * s, 4 * s, 0, 7); ctx.fill();
    }
    // 눈 (가는 쪽을 봄)
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath(); ctx.arc(x + p.dir * 5 * s, hy0 + 1 * s, 1.6 * s, 0, 7); ctx.arc(x + p.dir * 11 * s, hy0 + 1 * s, 1.6 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,120,.4)'; ctx.beginPath(); ctx.arc(x + p.dir * 8 * s, hy0 + 6 * s, 2.6 * s, 0, 7); ctx.fill();
    // 기분 표시
    if (p.mood && p.moodT > 0) {
      ctx.globalAlpha = p.fade * Math.min(1, p.moodT);
      ctx.font = Math.round(20 * s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.mood === 'angry' ? '💢' : p.mood === 'meh' ? '😐' : '💕', x, hy0 - 34 * s - (2.5 - p.moodT) * 8);
    }
    ctx.restore();
  }

  function step(dt) {
    t += dt;
    for (const p of people) {
      p.ph += dt * p.v / 9;
      if (p.moodT > 0) p.moodT -= dt;
      if (p.fadeIn) { p.fade = Math.min(1, p.fade + dt * 2); if (p.fade >= 1) p.fadeIn = false; }
      if (p.target != null) {
        const d = p.target - p.x;
        if (Math.abs(d) < 8) { p.fade -= dt * 2.5; if (p.fade <= 0) p.dead = true; }
        else { p.dir = Math.sign(d); p.x += p.dir * p.v * dt; }
        // 가게 쪽(안쪽 줄)으로 다가감
        if (p.lane === 0 && Math.abs(d) < 200) p.lane = 1;
      } else {
        p.x += p.dir * p.v * dt;
        if (p.x < -80 || p.x > w + 80) p.dead = true;
      }
    }
    for (let i = people.length - 1; i >= 0; i--) if (people[i].dead) people.splice(i, 1);
    const free = people.filter(p => p.target == null).length;
    if (free < 14 && Math.random() < dt * 1.2) addWalker();
  }

  function frame() {
    if (!on) return;
    buildBg();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLights();
    drawNeon();
    if (festive()) drawTree(gaps().l, h / 900);
    drawLamps();
    // 먼 줄 → 가까운 줄 순서
    const sorted = people.slice().sort((a, b) => a.lane - b.lane);
    for (const p of sorted) drawPerson(p);
    // 눈
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of flakes) {
        const x = ((f.x + Math.sin(t * .6 + f.p) * .01) % 1) * w, y = f.y * h;
        ctx.globalAlpha = .4 + f.s / 4;
        ctx.beginPath(); ctx.arc(x, y, f.s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (on) {
      step(dt);
      if (snow) for (const f of flakes) { f.y += f.v * dt * (f.s / 1.5); f.x += .004 * dt; if (f.y > 1) { f.y = -.02; f.x = Math.random(); } }
      frame();
    }
    requestAnimationFrame(loop);
  }

  window.Street = {
    resize, arrive, leave,
    setSeason(m, sn) { if (m !== month || sn !== snow) { month = m; snow = sn; bgKey = ''; } },
  };
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
})();
