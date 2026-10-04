const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('#yr').textContent = new Date().getFullYear();

/* ---------- rotating role text ---------- */
(() => {
  const spans = $$('#roles span');
  if (spans.length < 2) return;
  let i = 0;
  setInterval(() => {
    const cur = spans[i]; i = (i + 1) % spans.length; const nxt = spans[i];
    cur.classList.remove('on'); cur.classList.add('off');
    nxt.classList.remove('off'); nxt.classList.add('on');
    setTimeout(() => cur.classList.remove('off'), 900);
  }, 2800);
})();

/* ---------- reveal, counters, tilt ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .1 });
$$('.rv').forEach(el => io.observe(el));

const co = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, end = +el.dataset.count; let n = 0;
  const t = setInterval(() => { el.textContent = ++n; if (n >= end) clearInterval(t); }, 1000 / Math.max(end, 4) / 2 + 60);
  co.unobserve(el);
}), { threshold: .6 });
$$('[data-count]').forEach(el => co.observe(el));

$$('.tilt').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.transform = `rotateY(${(px - .5) * 9}deg) rotateX(${(.5 - py) * 9}deg) translateZ(6px)`;
    card.style.setProperty('--gx', px * 100 + '%');
    card.style.setProperty('--gy', py * 100 + '%');
  });
  card.addEventListener('pointerleave', () => card.style.transform = '');
});

/* ---------- pointer + scroll state ---------- */
const ptr = { x: 0, y: 0, px: innerWidth * .5, py: innerHeight * .5, active: false };
addEventListener('pointermove', e => {
  ptr.x = (e.clientX / innerWidth) * 2 - 1;
  ptr.y = -((e.clientY / innerHeight) * 2 - 1);
  ptr.px = e.clientX; ptr.py = e.clientY; ptr.active = true;
}, { passive: true });

/* the sphere drifts and bobs; the flow field below reads its position each frame */
const orb = $('#orb');
(() => {
  if (!orb || reduce) return;
  let x = 0, y = 0, t0 = -1;
  (function drift(now) {
    if (t0 < 0) t0 = now;
    const t = (now - t0) / 1000;
    x += (ptr.x * 22 - x) * .05;
    y += (ptr.y * -16 + Math.sin(t * .7) * 10 - y) * .05;
    orb.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    requestAnimationFrame(drift);
  })(performance.now());
})();

/* ============================================================
   Background: potential flow past the sphere.

   Each obstacle is a doublet in a uniform stream — the textbook
   flow past a cylinder. Potential flow is linear, so the two
   obstacles (the sphere, and a smaller one at the cursor) are
   just superposed.
   ============================================================ */
(() => {
  const cv = $('#flow'), ctx = cv.getContext('2d');
  let parts = [];
  const U = 2.4, CURSOR_R = 55;
  const spawn = any => ({
    x: any ? Math.random() * innerWidth : -10,
    y: Math.random() * innerHeight,
    life: Math.random() * 300
  });
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a080d'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    parts = Array.from({ length: Math.min(1100, Math.floor(innerWidth * innerHeight / 1800)) }, () => spawn(true));
  }
  addEventListener('resize', resize); resize();

  // the sphere's live position on screen, re-read each frame so it tracks
  // the drift, the bob and the page scroll
  const ball = { x: -9999, y: -9999, r: 0 };
  function readBall() {
    if (!orb) return;
    const b = orb.getBoundingClientRect();
    if (b.width === 0 || b.bottom < -200 || b.top > innerHeight + 200) { ball.r = 0; return; }
    ball.x = b.left + b.width / 2;
    ball.y = b.top + b.height / 2;
    ball.r = b.width * .48;
  }

  let cx = innerWidth * .5, cy = innerHeight * .5;
  (function draw() {
    readBall();
    cx += (ptr.px - cx) * .14; cy += (ptr.py - cy) * .14;

    ctx.fillStyle = 'rgba(10,8,13,.085)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.lineWidth = 1;

    for (const p of parts) {
      let u = U, v = 0, inside = false;

      if (ball.r > 0) {
        const dx = p.x - ball.x, dy = p.y - ball.y, r2 = dx * dx + dy * dy;
        if (r2 < ball.r * ball.r) inside = true;
        else { const k = ball.r * ball.r / (r2 * r2); u -= U * k * (dx * dx - dy * dy); v -= U * k * 2 * dx * dy; }
      }
      if (ptr.active && !inside) {
        const dx = p.x - cx, dy = p.y - cy, r2 = dx * dx + dy * dy;
        if (r2 < CURSOR_R * CURSOR_R) inside = true;
        else { const k = CURSOR_R * CURSOR_R / (r2 * r2); u -= U * k * (dx * dx - dy * dy); v -= U * k * 2 * dx * dy; }
      }
      if (inside) { Object.assign(p, spawn(false), { life: 0 }); continue; }

      const nx = p.x + u, ny = p.y + v;
      const sp = Math.min(Math.hypot(u, v) / U, 2);
      ctx.strokeStyle = `hsla(${268 + sp * 34},95%,${64 + sp * 6}%,${.16 + sp * .2})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny;

      if (p.x > innerWidth + 10 || p.y < -10 || p.y > innerHeight + 10 || ++p.life > 700) {
        Object.assign(p, spawn(false), { life: 0 });
      }
    }
    requestAnimationFrame(draw);
  })();
})();
