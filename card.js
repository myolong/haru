// 엔딩 카드: 황금 붕어빵 트로피를 든 사장님 그림 + 기록. 저장·공유용 PNG.
window.EndCard = (function () {
  const CW = 600, CH = 840;

  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 붕어빵 모양 (오른쪽이 꼬리)
  function fish(c, cx, cy, w, h) {
    c.beginPath();
    c.moveTo(cx - w * .5, cy);
    c.bezierCurveTo(cx - w * .5, cy - h * .55, cx + w * .1, cy - h * .6, cx + w * .28, cy - h * .12);
    c.lineTo(cx + w * .5, cy - h * .45);
    c.quadraticCurveTo(cx + w * .42, cy, cx + w * .5, cy + h * .45);
    c.lineTo(cx + w * .28, cy + h * .12);
    c.bezierCurveTo(cx + w * .1, cy + h * .6, cx - w * .5, cy + h * .55, cx - w * .5, cy);
    c.closePath();
  }
  function goldFish(c, cx, cy, w, h) {
    const g = c.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(.45, '#f5c431'); g.addColorStop(1, '#c98a0c');
    fish(c, cx, cy, w, h); c.fillStyle = g; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#9a6406'; c.stroke();
    // 비늘
    c.strokeStyle = 'rgba(150,95,5,.6)'; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) {
      c.beginPath(); c.arc(cx - w * .05 + i * w * .1, cy + j * h * .2, h * .12, -1.2, 1.2); c.stroke();
    }
    c.fillStyle = '#5a3a06'; c.beginPath(); c.arc(cx - w * .33, cy - h * .1, h * .07, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(cx - w * .2, cy - h * .25, w * .12, h * .06, -.3, 0, 7); c.fill();
  }

  function draw(cv, d) {
    cv.width = CW; cv.height = CH;
    const c = cv.getContext('2d');
    // 배경
    const bg = c.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, d.kind === 'global' ? '#1d3a6e' : '#3a1d5e'); bg.addColorStop(1, '#10152b');
    rr(c, 0, 0, CW, CH, 36); c.fillStyle = bg; c.fill();
    c.save(); rr(c, 0, 0, CW, CH, 36); c.clip();
    // 빛줄기
    c.translate(CW / 2, 380);
    for (let i = 0; i < 16; i++) {
      c.rotate(Math.PI / 8);
      c.fillStyle = i % 2 ? 'rgba(255,220,120,.10)' : 'rgba(255,255,255,.04)';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, -520); c.lineTo(70, -520); c.closePath(); c.fill();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    // 색종이
    const cols = ['#ff5a4a', '#ffd34a', '#5ad46a', '#5ab4ff', '#ff8ad8', '#ffffff'];
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 70; i++) {
      c.save(); c.translate(rnd() * CW, rnd() * 560); c.rotate(rnd() * 6);
      c.fillStyle = cols[i % cols.length]; c.globalAlpha = .85; c.fillRect(-5, -2.5, 10, 5); c.restore();
    }
    c.restore();
    // 테두리
    c.lineWidth = 8; c.strokeStyle = '#e9a514'; rr(c, 10, 10, CW - 20, CH - 20, 30); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,230,160,.6)'; rr(c, 22, 22, CW - 44, CH - 44, 24); c.stroke();

    // 리본 제목
    c.fillStyle = '#c0392b';
    c.beginPath(); c.moveTo(60, 40); c.lineTo(CW - 60, 40); c.lineTo(CW - 80, 70); c.lineTo(CW - 60, 100); c.lineTo(60, 100); c.lineTo(80, 70); c.closePath(); c.fill();
    c.fillStyle = '#fff6e4'; c.font = 'bold 36px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(d.title, CW / 2, 71);

    // ===== 캐릭터 =====
    const cx = CW / 2, by = 560;
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, by + 20, 120, 18, 0, 0, 7); c.fill();
    // 다리
    c.fillStyle = '#3a2a22'; rr(c, cx - 42, by - 40, 30, 60, 12); c.fill(); rr(c, cx + 12, by - 40, 30, 60, 12); c.fill();
    // 몸 (흰 조리복 + 앞치마)
    c.fillStyle = '#fbf6ec'; rr(c, cx - 78, by - 170, 156, 150, 52); c.fill();
    c.fillStyle = '#d9541e'; rr(c, cx - 56, by - 120, 112, 104, 18); c.fill();
    c.fillStyle = '#fff3d6'; c.font = 'bold 22px sans-serif'; c.fillText('🐟', cx, by - 72);
    // 팔 (트로피를 위로 듦)
    c.strokeStyle = '#fbf6ec'; c.lineWidth = 30; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - 62, by - 140); c.lineTo(cx - 92, by - 262); c.stroke();
    c.beginPath(); c.moveTo(cx + 62, by - 140); c.lineTo(cx + 92, by - 262); c.stroke();
    // 머리
    const hy = by - 212;
    c.fillStyle = '#f6d3b3'; c.beginPath(); c.arc(cx, hy, 62, 0, 7); c.fill();
    c.fillStyle = '#2b1d16'; c.beginPath(); c.arc(cx, hy - 10, 64, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    // 머리띠(두건)
    c.fillStyle = '#c0392b'; rr(c, cx - 66, hy - 46, 132, 22, 11); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + 30, hy - 35, 4, 0, 7); c.arc(cx - 20, hy - 35, 4, 0, 7); c.fill();
    // 얼굴: 감격한 웃음
    c.strokeStyle = '#2a1a12'; c.lineWidth = 5;
    c.beginPath(); c.arc(cx - 22, hy + 6, 9, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.beginPath(); c.arc(cx + 22, hy + 6, 9, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.fillStyle = '#8a2a1a'; c.beginPath(); c.arc(cx, hy + 24, 16, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(255,120,120,.45)'; c.beginPath(); c.arc(cx - 38, hy + 22, 10, 0, 7); c.arc(cx + 38, hy + 22, 10, 0, 7); c.fill();
    // 반짝 눈물
    c.fillStyle = '#9fd8ff'; c.beginPath(); c.ellipse(cx - 40, hy + 8, 4, 7, 0, 0, 7); c.fill();
    // 손
    c.fillStyle = '#f6d3b3'; c.beginPath(); c.arc(cx - 90, by - 268, 17, 0, 7); c.arc(cx + 90, by - 268, 17, 0, 7); c.fill();

    // ===== 트로피 =====
    const ty = 0;
    c.save(); c.translate(cx, 222); c.scale(.82, .82); c.translate(-cx, 0);
    // 손잡이
    c.strokeStyle = '#e0a514'; c.lineWidth = 12;
    c.beginPath(); c.arc(cx - 70, ty - 10, 26, Math.PI * .5, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(cx + 70, ty - 10, 26, -Math.PI * .5, Math.PI * .5); c.stroke();
    // 컵
    const cg = c.createLinearGradient(cx - 70, 0, cx + 70, 0);
    cg.addColorStop(0, '#c98a0c'); cg.addColorStop(.4, '#ffe27a'); cg.addColorStop(1, '#b97a06');
    c.fillStyle = cg;
    c.beginPath(); c.moveTo(cx - 76, ty - 44); c.lineTo(cx + 76, ty - 44); c.quadraticCurveTo(cx + 70, ty + 40, cx + 14, ty + 52); c.lineTo(cx - 14, ty + 52); c.quadraticCurveTo(cx - 70, ty + 40, cx - 76, ty - 44); c.fill();
    c.fillRect(cx - 12, ty + 50, 24, 26);
    c.fillStyle = '#8a5a06'; rr(c, cx - 50, ty + 72, 100, 20, 6); c.fill();
    c.fillStyle = '#fff3d6'; c.font = 'bold 14px sans-serif'; c.fillText('No.1', cx, ty + 83);
    c.fillStyle = '#9a6406'; c.font = 'bold 22px sans-serif'; c.fillText(d.kind === 'global' ? 'WORLD' : '1등', cx, ty + 2);
    // 컵 위의 황금 붕어빵
    goldFish(c, cx, ty - 82, 150, 82);
    // 반짝이
    c.fillStyle = '#fff';
    for (const [sx, sy, r] of [[cx - 110, ty - 120, 9], [cx + 115, ty - 90, 7], [cx + 70, ty - 150, 6], [cx - 60, ty - 145, 5]]) {
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * .3 : r; c.lineTo(sx + Math.cos(a) * rr2, sy + Math.sin(a) * rr2); } c.closePath(); c.fill();
    }
    c.restore();

    // ===== 기록판 =====
    c.fillStyle = '#fff6e4'; rr(c, 44, 596, CW - 88, 186, 22); c.fill();
    c.strokeStyle = '#c9883f'; c.lineWidth = 3; rr(c, 44, 596, CW - 88, 186, 22); c.stroke();
    c.fillStyle = '#8a3b12'; c.font = 'bold 26px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    c.fillText(d.headline, CW / 2, 630);
    c.font = '20px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    d.lines.forEach((ln, i) => {
      c.fillStyle = '#5a3b22'; c.textAlign = 'left'; c.fillText(ln[0], 76, 674 + i * 31);
      c.fillStyle = '#3a2414'; c.textAlign = 'right'; c.font = 'bold 20px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif'; c.fillText(ln[1], CW - 76, 674 + i * 31);
      c.font = '20px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    });
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,240,210,.75)'; c.font = '16px sans-serif';
    c.fillText('🐟 붕어빵 사장님 · myolong.github.io/haru', CW / 2, CH - 26);
  }

  function blob(cv) { return new Promise(res => cv.toBlob(res, 'image/png')); }
  async function save(cv, name) {
    const b = await blob(cv);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function share(cv, name, text) {
    try {
      const b = await blob(cv);
      const f = new File([b], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
    await save(cv, name); return false;
  }
  return { draw, save, share };
})();
