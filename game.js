'use strict';
/* 오늘의 그림일기 — 미니게임 5개로 버티는 하루 */
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hm = min => { const h = Math.floor(min / 60), m = Math.floor(min % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
const grade = s => (s >= 70 ? 0 : s >= 40 ? 1 : 2);
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c <= 11171 && c % 28 ? a : b); };
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

function loop(fn) {
  let last = performance.now(), alive = true;
  function f(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (fn(dt) === false) { alive = false; return; }
    requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
  return () => { alive = false; };
}
function toast(el, text) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
  el.appendChild(d); setTimeout(() => d.remove(), 950);
}
function shakeEl(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ───────── 1. 07:00 알람 끄기 ───────── */
const ALARM = {
  key: 'alarm', clock: 7 * 60, icon: '⏰', title: '알람 끄기',
  howto: '움직이는 [일어나기] 버튼을 4번 눌러요.\n커다란 [5분만 더…]는 누르면 5분 늦어져요!',
  play(el, end) {
    el.innerHTML = `<div class="g-alarm">
      <div class="phone ring"><div class="ph-time">07:00</div><div class="ph-label">⏰ 출근 알람</div></div>
      <div class="bed"><div class="sleeper">😴</div><div class="prog">일어나는 중 0/4</div></div>
      <button class="btn-wake">일어나기</button>
      <button class="btn-snooze">5분만 더… 😪</button></div>`;
    const g = $('.g-alarm', el), phone = $('.phone', g), tEl = $('.ph-time', g), wake = $('.btn-wake', g),
      snooze = $('.btn-snooze', g), me = $('.sleeper', g), prog = $('.prog', g);
    const faces = ['😴', '😪', '🥱', '😑', '😤'];
    let t = 0, snoozes = 0, taps = 0, moveT = 0, done = false;
    const now = () => 7 * 60 + t * 2 + snoozes * 5;
    function place() {
      const W = g.clientWidth, H = g.clientHeight, bw = wake.offsetWidth, bh = wake.offsetHeight;
      const x = rnd(10, W - bw - 10), y = rnd(130, H - 110 - bh);
      wake.style.left = x + 'px'; wake.style.top = y + 'px'; moveT = rnd(0.6, 0.95);
    }
    place();
    wake.addEventListener('pointerdown', e => {
      e.preventDefault(); if (done) return;
      taps++; vib(20); me.textContent = faces[taps]; prog.textContent = `일어나는 중 ${taps}/4`;
      me.style.transform = `translateY(${-taps * 8}px) rotate(${-taps * 8}deg)`;
      if (taps >= 4) finish(); else place();
    });
    snooze.addEventListener('pointerdown', e => {
      e.preventDefault(); if (done) return;
      snoozes++; vib(60); shakeEl(snooze); toast(g, '+5분 😴'); taps = Math.max(0, taps - 1);
      me.textContent = faces[taps]; prog.textContent = `일어나는 중 ${taps}/4`; me.style.transform = `translateY(${-taps * 8}px)`;
    });
    function finish() {
      done = true; stop(); phone.classList.remove('ring');
      const late = Math.round(now() - 7 * 60);
      setTimeout(() => end({ score: clamp(100 - Math.max(0, late - 6) * 3.2, 0, 100), late, snoozes, wakeAt: hm(now()) }), 500);
    }
    const stop = loop(dt => {
      t += dt; moveT -= dt; tEl.textContent = hm(now()); setClock(now());
      if (moveT <= 0) place();
      if (now() >= 7 * 60 + 45) { finish(); return false; }
    });
    return () => { done = true; stop(); };
  },
  line(r) {
    const g = grade(r.score);
    return [`${r.wakeAt} 기상! 알람 한 번에 일어났다.`, `${r.wakeAt} 기상. 5분만 더를 ${r.snoozes}번 외쳤다.`, `눈 떠 보니 ${r.wakeAt}... 망했다.`][g];
  },
};

/* ───────── 2. 08:10 지옥철 버티기 ───────── */
const SUBWAY = {
  key: 'subway', clock: 8 * 60 + 10, icon: '🚇', title: '지옥철 버티기',
  howto: '열차가 덜컹거려요!\n몸이 기우는 반대쪽 버튼을 눌러\n15초 동안 쓰러지지 않게 버텨요.',
  play(el, end) {
    el.innerHTML = `<div class="g-subway"><canvas></canvas>
      <div class="pads"><button data-d="-1">◀ 왼쪽</button><button data-d="1">오른쪽 ▶</button></div></div>`;
    const cv = $('canvas', el), ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W, H;
    function size() { W = el.clientWidth; H = el.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    let th = rnd(-0.05, 0.05), om = 0, t = 0, falls = 0, freeze = 0, jerkT = rnd(1.5, 2.5), jerkTxt = 0, sayT = 0, done = false;
    const DUR = 15;
    const crowd = Array.from({ length: 9 }, (_, i) => ({ x: (i + 0.5) / 9, y: rnd(0.0, 0.08), c: pick(['#7d8aa3', '#a3836b', '#8aa37d', '#9b7da3', '#6b7c8f']), ph: rnd(0, 6) }));
    el.querySelectorAll('.pads button').forEach(b => b.addEventListener('pointerdown', e => {
      e.preventDefault(); if (done || freeze > 0) return;
      om += Number(b.dataset.d) * 1.25; vib(10);
      b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 90);
    }));
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // 열차 안
      ctx.fillStyle = '#dfe6ee'; ctx.fillRect(0, 0, W, H);
      const winY = H * 0.08, winH = H * 0.2;
      const scroll = (t * 260) % 120;
      ctx.fillStyle = '#5b6f8a'; ctx.fillRect(0, winY, W, winH);
      ctx.fillStyle = '#7f94b0';
      for (let x = -scroll; x < W; x += 120) ctx.fillRect(x, winY + winH * 0.55, 60, winH * 0.25);
      ctx.strokeStyle = '#3b3127'; ctx.lineWidth = 4; ctx.strokeRect(-4, winY, W + 8, winH);
      // 손잡이
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.5) / 6 * W, sw = Math.sin(t * 2 + i) * 6 + th * 20;
        ctx.beginPath(); ctx.moveTo(x, winY + winH); ctx.lineTo(x + sw, winY + winH + 34); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + sw, winY + winH + 44, 10, 0, 7); ctx.stroke();
      }
      // 사람들(뒤)
      const floorY = H - 120;
      crowd.forEach(p => {
        const x = p.x * W + Math.sin(t * 2.2 + p.ph) * 4 + th * 14, y = floorY - 210 + p.y * H;
        ctx.fillStyle = p.c; ctx.strokeStyle = '#3b3127'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(x - 26, y + 34, 52, 200, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(x, y + 14, 22, 0, 7); ctx.fill(); ctx.stroke();
      });
      // 나
      const px = W / 2, py = floorY + 6;
      ctx.save(); ctx.translate(px, py); ctx.rotate(th);
      ctx.strokeStyle = '#3b3127'; ctx.lineWidth = 4;
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.roundRect(-30, -170, 60, 130, 20); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, -42); ctx.lineTo(-18, 0); ctx.moveTo(14, -42); ctx.lineTo(18, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-28, -150); ctx.lineTo(-52 - th * 30, -100); ctx.moveTo(28, -150); ctx.lineTo(52 - th * 30, -100); ctx.stroke();
      ctx.fillStyle = '#f3c9a0'; ctx.beginPath(); ctx.arc(0, -200, 30, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b3127';
      const scared = Math.abs(th) > 0.55 || freeze > 0;
      if (scared) { ctx.font = 'bold 20px Gaegu'; ctx.textAlign = 'center'; ctx.fillText('> <', 0, -196); ctx.beginPath(); ctx.arc(0, -184, 6, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(-10, -204, 4, 0, 7); ctx.arc(10, -204, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, -190, 8, 0.2, Math.PI - 0.2); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#9aa7b6'; ctx.fillRect(0, floorY + 6, W, H);
      // 균형 게이지
      const gw = W * 0.7, gx = (W - gw) / 2, gy = H - 112;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b3127'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(gx, gy, gw, 14, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(58,166,91,.35)'; ctx.fillRect(gx + gw * 0.3, gy + 2, gw * 0.4, 10);
      ctx.fillStyle = Math.abs(th) > 0.6 ? '#e04b3c' : '#3b3127';
      ctx.beginPath(); ctx.arc(gx + gw / 2 + clamp(th / 1.0, -1, 1) * gw / 2, gy + 7, 10, 0, 7); ctx.fill();
      // 글자
      ctx.textAlign = 'center'; ctx.fillStyle = '#3b3127';
      ctx.font = 'bold 22px Gaegu';
      ctx.fillText(`남은 시간 ${Math.max(0, Math.ceil(DUR - t))}초 · 넘어짐 ${falls}번`, W / 2, winY + winH + 84);
      if (jerkTxt > 0) { ctx.font = 'bold 44px Gaegu'; ctx.fillStyle = '#e04b3c'; ctx.fillText('덜컹!', W / 2, H * 0.48); }
      if (sayT > 0) {
        ctx.font = 'bold 26px Gaegu'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b3127';
        const tx = '앗 죄송합니다…!', tw = ctx.measureText(tx).width + 24;
        ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, H * 0.45, tw, 40, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3b3127'; ctx.fillText(tx, W / 2, H * 0.45 + 29);
      }
    }
    const stop = loop(dt => {
      t += dt; jerkTxt -= dt; sayT -= dt;
      if (freeze > 0) { freeze -= dt; if (freeze <= 0) { th = 0; om = 0; } }
      else {
        const sway = 0.55 * Math.sin(t * 1.7) + 0.4 * Math.sin(t * 0.83 + 1);
        jerkT -= dt;
        if (jerkT <= 0) { om += (Math.random() < 0.5 ? -1 : 1) * rnd(1.0, 1.6); jerkT = rnd(1.6, 3.0); jerkTxt = 0.6; vib(40); }
        om += (th * 2.0 + sway * 0.9) * dt; om *= (1 - 0.7 * dt); th += om * dt;
        if (Math.abs(th) > 1.0) { falls++; freeze = 0.9; sayT = 1.2; vib(120); }
      }
      draw();
      if (t >= DUR) { done = true; setTimeout(() => end({ score: [100, 75, 50, 30, 15][Math.min(falls, 4)], falls }), 300); return false; }
    });
    setClock(8 * 60 + 10);
    return () => { done = true; stop(); };
  },
  line(r) {
    return [r.falls === 0 ? '지옥철에서 한 번도 안 넘어졌다.' : '지옥철에서 한 번 휘청했지만 버텼다.',
      `지옥철에서 ${r.falls}번 휘청거렸다.`, `지옥철에서 ${r.falls}번이나 남의 품에 안겼다.`][grade(r.score)];
  },
};

/* ───────── 3. 12:00 점심 메뉴 고르기 ───────── */
const MENUS = [
  ['김치찌개', '🍲', 'spicy soup korean rice'], ['국밥', '🥣', 'soup korean rice'], ['짜장면', '🍝', 'noodle chinese'],
  ['짬뽕', '🌶️', 'spicy noodle soup chinese'], ['돈가스', '🍖', 'fried japanese rice'], ['초밥', '🍣', 'raw japanese rice'],
  ['샐러드', '🥗', 'light'], ['마라탕', '🔥', 'spicy soup chinese'], ['햄버거', '🍔', 'fried'], ['쌀국수', '🍜', 'noodle soup'],
  ['제육볶음', '🥘', 'spicy korean rice'], ['비빔밥', '🍚', 'korean rice'], ['떡볶이', '🍢', 'spicy korean'], ['우동', '🍥', 'noodle soup japanese'],
  ['치킨', '🍗', 'fried korean'], ['볶음밥', '🍳', 'rice chinese'],
].map(([n, e, t]) => ({ n, e, tags: t.split(' ') }));
const RULES = [
  { who: '부장님', face: '👨‍💼', say: '난 매운 거 못 먹어.', ok: m => !m.tags.includes('spicy') },
  { who: '대리님', face: '🙋', say: '면 먹으면 오후에 졸려요.', ok: m => !m.tags.includes('noodle') },
  { who: '과장님', face: '🧑‍💼', say: '오늘 추운데 국물 있는 거!', ok: m => m.tags.includes('soup') },
  { who: '대리님', face: '🙋', say: '밥심으로 버텨야죠.', ok: m => m.tags.includes('rice') },
  { who: '부장님', face: '👨‍💼', say: '어제 중국집 갔잖아.', ok: m => !m.tags.includes('chinese') },
  { who: '과장님', face: '🧑‍💼', say: '튀긴 건 속이 좀…', ok: m => !m.tags.includes('fried') },
  { who: '신입', face: '🧑', say: '날것은 못 먹어요…', ok: m => !m.tags.includes('raw') },
  { who: '신입', face: '🧑', say: '한식 먹고 싶어요!', ok: m => m.tags.includes('korean') },
];
function makeRound(n) {
  for (let tries = 0; tries < 200; tries++) {
    const rules = shuffle(RULES).filter((r, i, a) => a.findIndex(x => x.say === r.say) === i).slice(0, n);
    const good = MENUS.filter(m => rules.every(r => r.ok(m)));
    const bad = MENUS.filter(m => !rules.every(r => r.ok(m)));
    if (good.length >= 1 && bad.length >= 3) return { rules, opts: shuffle([pick(good), ...shuffle(bad).slice(0, 3)]) };
  }
}
const LUNCH = {
  key: 'lunch', clock: 12 * 60, icon: '🍱', title: '점심 메뉴 고르기',
  howto: '"아무거나"라더니 조건이 많아요.\n모두가 만족하는 메뉴를\n빨리 골라요! (3라운드)',
  play(el, end) {
    let round = 0, right = 0, stopT = null, done = false, picked = [];
    const LIMIT = [9, 9, 10];
    const bar = document.createElement('div'); bar.className = 'tbar';
    function next() {
      if (round >= 3) { done = true; return end({ score: Math.round(right / 3 * 100), right, food: picked[picked.length - 1] }); }
      const R = makeRound(round === 2 ? 3 : 2);
      el.innerHTML = `<div class="g-lunch"><div class="round">${round + 1} / 3 라운드</div>
        ${R.rules.map(r => `<div class="say"><div class="who"><i>${r.face}</i>${r.who}</div><div class="bub">${r.say}</div></div>`).join('')}
        <div class="result"></div>
        <div class="menus">${R.opts.map((m, i) => `<button data-i="${i}"><i>${m.e}</i>${m.n}</button>`).join('')}</div></div>`;
      el.appendChild(bar);
      const res = $('.result', el); let answered = false, t = 0;
      el.querySelectorAll('.menus button').forEach(b => b.addEventListener('pointerdown', e => {
        e.preventDefault(); if (answered) return; answered = true; stopT();
        const m = R.opts[b.dataset.i], fail = R.rules.find(r => !r.ok(m));
        if (!fail) { right++; b.classList.add('ok'); res.textContent = pick(['다들 만족! 👍', '센스 있는데? 😎', '통과! 🎉']); picked.push(m.n); vib(20); }
        else { b.classList.add('no'); res.textContent = `${fail.who}: "${fail.say}" 😑`; picked.push(m.n); vib(100); shakeEl(b); }
        round++; setTimeout(next, 1100);
      }));
      stopT = loop(dt => {
        t += dt; bar.style.width = Math.max(0, 100 - t / LIMIT[round] * 100) + '%';
        setClock(12 * 60 + round * 3 + t / 3);
        if (t >= LIMIT[round]) {
          answered = true; res.textContent = '부장님: "그냥 청국장 먹자." 😶'; picked.push('청국장'); vib(100);
          round++; setTimeout(next, 1200); return false;
        }
      });
    }
    next();
    return () => { done = true; stopT && stopT(); };
  },
  line(r) {
    return [`점심 메뉴를 ${r.right}번 다 맞혔다. 센스왕!`, `점심 메뉴를 3번 중 ${r.right}번 맞혔다.`,
      `점심은 결국 ${josa(r.food || '청국장', '을', '를')} 먹었다. 눈치가 없었다.`][grade(r.score)];
  },
};

/* ───────── 4. 14:30 오후 졸음 참기 ───────── */
const DOZE = {
  key: 'doze', clock: 14 * 60 + 30, icon: '😪', title: '오후 졸음 참기',
  howto: '점심 먹고 눈꺼풀이 내려와요.\n화면을 톡톡 눌러 눈을 떠요!\n"뚜벅뚜벅" 소리가 나면 부장님이 와요.',
  play(el, end) {
    el.innerHTML = `<div class="g-doze"><div class="scene">
        <div class="monitor"><div class="sheet"><div class="rows"></div><b>보고서_최종_진짜최종.xlsx</b></div></div>
        <div class="desk"></div><div class="kb"></div><div class="cup">☕</div>
        <div class="boss"><div class="bh"></div><div class="bb"></div></div></div>
      <div class="warn">뚜벅뚜벅…</div>
      <div class="lid t"></div><div class="lid b"></div>
      <div class="flash"></div><div class="hint">톡톡! 눈 떠!</div></div>`;
    const g = $('.g-doze', el), scene = $('.scene', g), rows = $('.rows', g), boss = $('.boss', g), warn = $('.warn', g),
      lt = $('.lid.t', g), lb = $('.lid.b', g), flash = $('.flash', g), hint = $('.hint', g);
    const bar = document.createElement('div'); bar.className = 'tbar'; g.appendChild(bar);
    const DUR = 18;
    let c = 0.1, t = 0, caught = 0, sleep = 0, done = false;
    const visits = [rnd(3.5, 5), rnd(8.5, 10.5), rnd(13.5, 15)].map(at => ({ at, st: 0, hit: false }));
    g.addEventListener('pointerdown', e => { e.preventDefault(); if (done) return; c = Math.max(0, c - 0.12); vib(8); });
    const stop = loop(dt => {
      t += dt;
      c = Math.min(1, c + (0.2 + t * 0.012) * dt);
      if (c >= 0.97) sleep += dt;
      rows.style.transform = `translateY(${-(t * 30) % 22}px)`;
      lt.style.height = lb.style.height = (c * 52) + '%';
      scene.style.filter = `blur(${c * 4}px)`;
      hint.textContent = c > 0.8 ? 'zZ… 톡톡!!' : '톡톡! 눈 떠!';
      let warnOn = false, bossOn = false;
      visits.forEach(v => {
        if (t >= v.at - 1.1 && t < v.at) warnOn = true;
        if (t >= v.at && t < v.at + 1.7) {
          bossOn = true;
          if (!v.hit && t > v.at + 0.35 && c > 0.55) {
            v.hit = true; caught++; flash.classList.add('on'); toast(g, pick(['자네 지금 자나?', '보고서는 다 됐나?', '피곤한가 봐?']));
            vib(200); setTimeout(() => flash.classList.remove('on'), 500);
          }
        }
      });
      warn.classList.toggle('on', warnOn); boss.classList.toggle('in', bossOn);
      bar.style.width = Math.max(0, 100 - t / DUR * 100) + '%';
      setClock(14 * 60 + 30 + t * 5);
      if (t >= DUR) {
        done = true;
        setTimeout(() => end({ score: clamp(Math.round(100 - caught * 35 - sleep * 6), 0, 100), caught, sleep: Math.round(sleep) }), 300);
        return false;
      }
    });
    return () => { done = true; stop(); };
  },
  line(r) {
    return [r.caught ? '오후에 졸았지만 들키진 않았다.' : '오후 내내 눈 뜨고 일했다. 대단하다.',
      `부장님께 조는 걸 ${r.caught}번 들켰다.`, `부장님께 ${r.caught}번 들켰다. "자네 지금 자나?"`][grade(r.score)];
  },
};

/* ───────── 5. 18:00 칼퇴 눈치싸움 ───────── */
const LEAVE = {
  key: 'leave', clock: 18 * 60, icon: '🏃', title: '칼퇴 눈치싸움',
  howto: '버튼을 꾹 누르고 있으면 문 쪽으로 살금살금!\n"흠흠" 하면 부장님이 돌아봐요.\n그때 움직이면 걸려요. (3번 걸리면 야근)',
  play(el, end) {
    el.innerHTML = `<div class="g-leave"><div class="win"></div><div class="floor">
        <div class="bossdesk"><div class="bmon"></div><div class="bfig"><div class="bh"></div><div class="bb"></div></div><div class="bsay"></div></div>
        <div class="track"></div><div class="door"></div><div class="me"><span class="fig">🧑‍💼</span><span class="tag">나</span></div></div>
      <div class="strikes">걸림 0/3</div>
      <div class="tip">부장님이 모니터 볼 때만 움직여요</div>
      <button class="hold">꾹 눌러서 살금살금 🤫</button></div>`;
    const g = $('.g-leave', el), me = $('.me', g), fig = $('.bfig', g), say = $('.bsay', g), hold = $('.hold', g),
      sEl = $('.strikes', g), tip = $('.tip', g);
    let pos = 0, t = 0, strikes = 0, pressing = false, state = 'work', stT = rnd(1.6, 2.6), lookFor = 0, done = false, grace = 0, stun = 0;
    const down = e => { e.preventDefault(); pressing = true; hold.classList.add('on'); };
    const up = e => { e.preventDefault(); pressing = false; hold.classList.remove('on'); };
    hold.addEventListener('pointerdown', down); hold.addEventListener('pointerup', up);
    hold.addEventListener('pointercancel', up); hold.addEventListener('pointerleave', up);
    const LINES = ['어디 가나?', '벌써 가게?', '이것 좀 보고 가.', '내일 회의 자료는?'];
    function setSay(txt) { say.textContent = txt; say.classList.toggle('on', !!txt); }
    function finish(escaped) {
      done = true; stop(); pressing = false;
      const at = escaped ? 18 * 60 + t * 1.5 : 22 * 60;
      setTimeout(() => end({ score: escaped ? clamp(100 - strikes * 25 - Math.max(0, t - 16) * 2, 30, 100) : 10, escaped, strikes, leftAt: hm(at) }), 600);
    }
    const stop = loop(dt => {
      t += dt; stT -= dt; grace -= dt; stun -= dt;
      if (stT <= 0) {
        if (state === 'work') { state = 'cough'; stT = rnd(0.45, 0.65); setSay('흠흠…'); vib(30); }
        else if (state === 'cough') {
          if (Math.random() < 0.22) { state = 'work'; stT = rnd(0.8, 1.6); setSay(''); }
          else { state = 'look'; stT = rnd(1.1, 1.9); grace = 0.18; fig.classList.add('look'); setSay(''); }
        } else { state = 'work'; stT = rnd(1.0, 2.6); fig.classList.remove('look'); setSay(''); }
      }
      if (pressing && stun <= 0) {
        pos = Math.min(1, pos + 0.13 * dt);
        if (state === 'look' && grace <= 0) {
          strikes++; sEl.textContent = `걸림 ${strikes}/3`; setSay(pick(LINES)); vib(200); shakeEl(me);
          pos = Math.max(0, pos - 0.15); stun = 0.9; state = 'look'; stT = Math.max(stT, 1.0);
          if (strikes >= 3) { tip.textContent = '오늘은 야근이다…'; return finish(false), false; }
        }
      }
      me.style.left = `calc(10% + ${pos * 66}%)`;
      me.firstChild.textContent = pressing && stun <= 0 ? '🚶' : stun > 0 ? '😱' : '🧑‍💼';
      setClock(18 * 60 + t * 1.5);
      if (pos >= 1) { tip.textContent = '칼퇴 성공!! 🎉'; finish(true); return false; }
      if (t >= 30) { tip.textContent = '눈치 보다 시간이…'; finish(false); return false; }
    });
    return () => { done = true; stop(); };
  },
  line(r) {
    if (!r.escaped) return '결국 야근했다. 22시에 퇴근했다.';
    return [r.strikes ? `${r.leftAt} 칼퇴 성공! 한 번 들킬 뻔했다.` : `${r.leftAt} 칼퇴 성공! 아무도 몰랐다.`,
      `${r.leftAt} 퇴근. "내일 회의 자료는?"을 들었다.`, `간신히 퇴근했다. 등 뒤가 따가웠다.`][grade(r.score)];
  },
};

const STAGES = [ALARM, SUBWAY, LUNCH, DOZE, LEAVE];
const REACT = {
  alarm: [['오늘 좀 부지런한데? ☀️'], ['그래도 지각은 아니겠지…?'], ['뛰어! 지금 뛰면 돼! 🏃']],
  subway: [['지옥철 장인 🧘'], ['조금 휘청였지만 무사히 도착'], ['주변 분들께 사과드립니다 🙇']],
  lunch: [['점심 메뉴 센스왕 👑'], ['반은 맞혔다…!'], ['오늘 점심은 청국장 확정…']],
  doze: [['커피의 힘 ☕'], ['부장님 눈빛이 따갑다…'], ['자네… 지금 자나? 😠']],
  leave: [['칼퇴 성공!! 🎉'], ['퇴근은 했는데 찜찜…'], ['야근 확정… 🌙']],
};

/* ───────── 화면 흐름 ───────── */
let results = {}, idx = 0, cleanup = null, clockEl = null;
function setClock(min) { if (clockEl) clockEl.textContent = hm(min); }
function hud(i) {
  return `<div class="hud"><span class="clock">${hm(STAGES[i].clock)}</span>
    <span class="dots">${STAGES.map((s, j) => `<i class="${j < i ? 'd' : j === i ? 'c' : ''}"></i>`).join('')}</span><span>${i + 1}/5</span></div>`;
}
function titleScreen() {
  const d = new Date(), days = '일월화수목금토';
  app.innerHTML = `<div class="title">
    <div class="date">${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일</div>
    <h1>오늘의<br>그림일기<small>미니게임 5개로 버티는 하루</small></h1>
    <ul class="timeline">${STAGES.map(s => `<li><b>${hm(s.clock)}</b>${s.icon} ${s.title}</li>`).join('')}</ul>
    <div class="note">하루를 버티면 그림일기가 완성돼요.<br>망친 하루일수록 일기가 웃겨요.</div>
    <button class="btn" id="go">출근 준비 시작 ⏰</button></div>`;
  $('#go').onclick = () => { results = {}; idx = 0; intro(); };
}
function intro() {
  const s = STAGES[idx];
  app.innerHTML = hud(idx) + `<div class="intro"><div class="big">${s.icon}</div><h2>${s.title}</h2><p>${s.howto}</p>
    <button class="btn" id="go">시작!</button></div>`;
  clockEl = $('.clock', app);
  $('#go').onclick = play;
}
function play() {
  const s = STAGES[idx];
  app.innerHTML = hud(idx) + `<div class="stage"></div>`;
  clockEl = $('.clock', app);
  const el = $('.stage', app);
  cleanup = s.play(el, r => { cleanup && cleanup(); cleanup = null; results[s.key] = r; after(r); });
}
function after(r) {
  const s = STAGES[idx], g = grade(r.score);
  app.innerHTML = hud(idx) + `<div class="after"><div class="big" style="font-size:72px">${s.icon}</div>
    <div class="grade g${g}">${['잘 버텼다!', '그럭저럭…', '망했다…'][g]}</div>
    <div class="line">${pick(REACT[s.key][g])}</div>
    <div class="line" style="font-size:22px;opacity:.75">${s.line(r)}</div>
    <button class="btn" id="go">${idx < STAGES.length - 1 ? '다음 →' : '오늘의 그림일기 보기 📔'}</button></div>`;
  clockEl = $('.clock', app);
  $('#go').onclick = () => { idx++; if (idx < STAGES.length) intro(); else showDiary(); };
}
async function showDiary() {
  app.innerHTML = `<div class="loading">그림일기 그리는 중… ✏️</div>`;
  const lines = STAGES.map(s => s.line(results[s.key]));
  const canvas = await Diary.render(results, lines);
  const url = canvas.toDataURL('image/png');
  app.innerHTML = `<div class="diary"><img alt="오늘의 그림일기" src="${url}">
    <div class="row"><button class="btn" id="share">일기 공유하기 📤</button></div>
    <div class="row"><button class="btn sub" id="save">그림 저장</button><button class="btn sub" id="again">다시 하기</button></div>
    <div class="msg"></div></div>`;
  const msg = $('.msg', app);
  const blobP = new Promise(res => canvas.toBlob(res, 'image/png'));
  const fname = `오늘의그림일기_${new Date().toISOString().slice(0, 10)}.png`;
  function save(blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '그림을 저장했어요.';
  }
  $('#save').onclick = async () => save(await blobP);
  $('#share').onclick = async () => {
    const blob = await blobP, file = new File([blob], fname, { type: 'image/png' });
    const text = '오늘 내 하루는 이랬다… 너도 버텨 봐!';
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, url: location.href }); return; }
      if (navigator.share) { await navigator.share({ title: '오늘의 그림일기', text, url: location.href }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(location.href); msg.textContent = '링크를 복사했어요! 그림은 [그림 저장]으로 받아 주세요.'; }
    catch (e) { save(blob); }
  };
  $('#again').onclick = titleScreen;
}

titleScreen();
// 테스트용: ?demo=0~2 로 바로 일기 보기
(() => {
  const q = new URLSearchParams(location.search).get('demo');
  if (q === null) return;
  const g = Number(q) || 0;
  const S = [[100, 0], [55, 1], [10, 2]][g];
  results = {
    alarm: { score: [100, 55, 10][g], late: [6, 18, 42], snoozes: [0, 2, 5][g], wakeAt: ['07:06', '07:18', '07:42'][g] },
    subway: { score: [100, 50, 15][g], falls: [0, 2, 4][g] },
    lunch: { score: [100, 67, 0][g], right: [3, 2, 0][g], food: '청국장' },
    doze: { score: [100, 65, 0][g], caught: [0, 1, 3][g], sleep: 0 },
    leave: { score: [100, 50, 10][g], escaped: g < 2, strikes: [0, 2, 3][g], leftAt: ['18:14', '18:30', '22:00'][g] },
  };
  void S; showDiary();
})();
