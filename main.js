import { Body, SHAPES, LIFT, NAMES, blend, M } from './flow.js?v=33';

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

/* ---------- visit analytics: GoatCounter (free, no cookies, no personal data) ----------
   Paste your GoatCounter site code between the quotes to switch it on, e.g. 'rajesh' for
   rajesh.goatcounter.com. While it is empty the page makes no analytics requests at all.
   To show the visit total in the footer, also enable "Allow adding visitor counts on your
   website" in the GoatCounter settings. */
const GOATCOUNTER = '';
if (GOATCOUNTER) {
  const s = document.createElement('script');
  s.async = true; s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  document.head.appendChild(s);
  const priv = $('.how-priv'); if (priv) priv.hidden = false;
  fetch(`https://${GOATCOUNTER}.goatcounter.com/counter/TOTAL.json`)
    .then(r => r.ok ? r.json() : null)
    .then(j => { const el = $('#visits'); if (j && j.count && el) { el.textContent = `${j.count} visits`; el.hidden = false; } })
    .catch(() => {});                                     // blocked or not enabled: show nothing
}

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
   Background: potential flow past a body that morphs
   sphere -> airfoil -> turbine blade -> engine nacelle -> rocket -> F1 car -> rhombus -> wedge -> sphere.

   The air is the exact potential flow around whatever shape is on
   screen, re-solved every frame while it morphs (a panel method —
   see flow.js). Circulation is applied only while the body is an
   airfoil (the Kutta condition), so the flow leaves its sharp
   trailing edge smoothly, and fades out as it becomes a bluff body.
   The cursor adds a small cylinder on top (superposition).
   ============================================================ */
(() => {
  const cv = $('#flow'), ctx = cv.getContext('2d');
  const bc = $('#body'), bx = bc.getContext('2d');
  let parts = [];
  const U = 2.4, CURSOR_R = 55, TRAIL = 14;

  // Each particle keeps its own short trail and the canvases are cleared every
  // frame. (Fading with a translucent overlay instead leaves permanent faint
  // streaks: 8-bit colour can't decay the last few levels to true black.)
  const spawn = any => {
    const x = any ? Math.random() * innerWidth : -10, y = Math.random() * innerHeight;
    return { x, y, life: Math.random() * 300, tx: new Float32Array(TRAIL).fill(x), ty: new Float32Array(TRAIL).fill(y), head: 0, sp: 1 };
  };
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const [c, x] of [[cv, ctx], [bc, bx]]) {
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    parts = Array.from({ length: Math.min(800, Math.floor(innerWidth * innerHeight / 2200)) }, () => spawn(true));
  }
  addEventListener('resize', resize); resize();

  /* ---- timeline: hold each shape, then ease into the next ---- */
  const body = new Body(), cur = new Float64Array(2 * M);
  const HOLD = 2000, MORPH = 1800, HOLD0 = 1400, SEG = HOLD + MORPH, COUNT = SHAPES.length;
  const T0 = performance.now() + (HOLD0 - HOLD);   // the first hold (sphere) lasts HOLD0, not HOLD
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  let lastIdx = -1, lastK = -1, halfW = 1;
  function update(now) {
    let idx = 1, k = 0, w = 1;                                    // reduced motion: hold the airfoil
    if (!reduce) {
      const t = Math.max(now - T0, 0), l = t % SEG;
      idx = Math.floor(t / SEG) % COUNT;
      k = l < HOLD ? 0 : ease((l - HOLD) / MORPH);
      const a = LIFT[idx], b = LIFT[(idx + 1) % COUNT];
      w = a + (b - a) * k;                                        // circulation only on sharp-trailing-edge bodies
    }
    if (idx === lastIdx && k === lastK) return;
    lastIdx = idx; lastK = k;
    blend(SHAPES[idx], SHAPES[(idx + 1) % COUNT], k, cur);
    body.set(cur, w);
    halfW = 0; for (let i = 0; i < M; i++) halfW = Math.max(halfW, Math.abs(cur[2 * i]));
  }

  /* ---- where the body sits on screen (re-read each frame: drift, bob, scroll) ---- */
  const g = { x: 0, y: 0, c: 1, on: false };
  function place() {
    g.on = false;
    if (!orb) return;
    const b = orb.getBoundingClientRect();
    if (b.width === 0 || b.bottom < -300 || b.top > innerHeight + 300) return;
    g.c = b.width / 2; g.x = b.left + g.c; g.y = b.top + b.height / 2; g.on = true;
  }

  /* ---- hover note: what is this shape? ----
     Hovering the glowing body (or tapping it on a touch screen) shows its name and a one-line note.
     The pointer is tested against the live outline, so it also works mid-morph. */
  const INFO = {
    sphere:  ['Sphere', 'The textbook starting point: the air splits at the front and rejoins behind it, and there is no lift.'],
    airfoil: ['Airfoil (a wing section)', 'A Joukowski airfoil at 6° to the wind. The air leaves the sharp back edge smoothly, which is what creates lift.'],
    blade:   ['Turbine blade', 'A curved, thick-nosed blade like those in a compressor or turbine. It turns the air, and like the wing it carries lift.'],
    nacelle: ['Jet-engine nacelle', 'The outer cowl of a turbofan engine, hanging from its pylon. Only the outside is modelled, not the intake or the bypass duct.'],
    rocket:  ['Rocket with a bell nozzle', 'Pointed nose cone, tail fins, and the flared bell of the engine. The air parts at the nose and closes up behind the bell.'],
    f1:      ['Formula 1 car', 'Side view, traced from a drawing. The tyres stick out above and below the bodywork, as on the real car.'],
    rhombus: ['Rhombus (a diamond)', 'A sharp-cornered body. The air speeds up as it goes round the side corners.'],
    wedge:   ['Wedge (a triangle)', 'Pointed into the wind with a flat back. The air speeds up round the back corners.']
  };
  const tip = $('#shapeTip'), tipTitle = tip && tip.querySelector('b'), tipNote = tip && tip.querySelector('span');
  const canHover = matchMedia('(hover: hover)').matches;
  let tapUntil = 0, tipKey = '', tipW = 0, tipH = 0;
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    ptr.px = e.clientX; ptr.py = e.clientY; ptr.active = true; tapUntil = performance.now() + 2800;
  }, { passive: true });
  function hoverTip(now) {
    if (!tip) return;
    let show = false;
    if (g.on && ptr.active && scrollY < innerHeight * .6 && (canHover || now < tapUntil)) {
      const bx = (ptr.px - g.x) / g.c, by = (g.y - ptr.py) / g.c, d = 5 / g.c;      // a few pixels of slack round the edge
      show = body.inside(bx, by) || body.inside(bx + d, by) || body.inside(bx - d, by) || body.inside(bx, by + d) || body.inside(bx, by - d);
      if (show) {                                                                  // not if something on the page sits on top of it
        const el = document.elementFromPoint(ptr.px, ptr.py);
        if (el && el.closest('.glass, .card, a, button, nav, header, footer, aside, summary')) show = false;
      }
    }
    document.documentElement.classList.toggle('shape-hover', show);
    tip.classList.toggle('on', show);
    if (!show) return;
    const a = lastIdx, b = (lastIdx + 1) % COUNT, k = lastK;
    let title, note;
    if (k < .08) [title, note] = INFO[NAMES[a]];
    else if (k > .92) [title, note] = INFO[NAMES[b]];
    else { title = `${INFO[NAMES[a]][0]} → ${INFO[NAMES[b]][0]}`; note = 'Morphing: the air is worked out again around every in-between shape.'; }
    const key = title;
    if (key !== tipKey) { tipKey = key; tipTitle.textContent = title; tipNote.textContent = note; tipW = tip.offsetWidth; tipH = tip.offsetHeight; }
    const x = Math.min(ptr.px + 18, innerWidth - tipW - 12), y = ptr.py + 22 + tipH > innerHeight - 8 ? ptr.py - tipH - 14 : ptr.py + 22;
    tip.style.transform = `translate3d(${Math.max(12, x).toFixed(0)}px,${Math.max(8, y).toFixed(0)}px,0)`;
  }

  function drawBody() {
    bx.clearRect(0, 0, innerWidth, innerHeight);
    if (!g.on) return;
    const c = g.c;
    bx.beginPath();
    for (let i = 0; i < M; i++) {
      const X = g.x + cur[2 * i] * c, Y = g.y - cur[2 * i + 1] * c;
      i ? bx.lineTo(X, Y) : bx.moveTo(X, Y);
    }
    bx.closePath();
    const spread = Math.min(Math.max(halfW - 1, 0), 1);
    const grad = bx.createRadialGradient(g.x - c * .35, g.y - c * .45, 0, g.x - c * .2, g.y - c * .2, c * (1.4 + 1.7 * spread));
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(.12, 'rgba(233,224,255,.96)');
    grad.addColorStop(.38, 'rgba(183,156,255,.92)');
    grad.addColorStop(.66, 'rgba(118,78,214,.9)');
    grad.addColorStop(1, 'rgba(58,30,124,.95)');
    bx.save();
    bx.shadowColor = 'rgba(139,92,246,.75)';
    bx.shadowBlur = 70;
    bx.fillStyle = grad;
    bx.fill();
    bx.restore();
  }

  let mx = innerWidth * .5, my = innerHeight * .5;
  (function draw(now) {
    update(now);
    place();
    hoverTip(now);
    mx += (ptr.px - mx) * .14; my += (ptr.py - my) * .14;

    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    for (const p of parts) {
      let u = U, v = 0, inside = false;
      if (g.on) {
        if (body.vel((p.x - g.x) / g.c, (g.y - p.y) / g.c)) { u = body.u * U; v = -body.v * U; }
        else inside = true;
      }
      if (ptr.active && !inside) {
        const dx = p.x - mx, dy = p.y - my, r2 = dx * dx + dy * dy;
        if (r2 < CURSOR_R * CURSOR_R) inside = true;
        else { const k = CURSOR_R * CURSOR_R / (r2 * r2); u -= U * k * (dx * dx - dy * dy); v -= U * k * 2 * dx * dy; }
      }
      if (inside) { Object.assign(p, spawn(false), { life: 0 }); continue; }

      p.x += u; p.y += v;
      p.head = (p.head + 1) % TRAIL;
      p.tx[p.head] = p.x; p.ty[p.head] = p.y;
      p.sp += (Math.min(Math.hypot(u, v) / U, 2) - p.sp) * .2;

      ctx.strokeStyle = `hsla(${268 + p.sp * 34},95%,${64 + p.sp * 6}%,${.14 + p.sp * .18})`;
      ctx.beginPath();
      let i = (p.head + 1) % TRAIL;
      ctx.moveTo(p.tx[i], p.ty[i]);
      for (let k = 1; k < TRAIL; k++) { i = (i + 1) % TRAIL; ctx.lineTo(p.tx[i], p.ty[i]); }
      ctx.stroke();

      if (p.x > innerWidth + 10 || p.y < -10 || p.y > innerHeight + 10 || ++p.life > 700) {
        Object.assign(p, spawn(false), { life: 0 });
      }
    }
    drawBody();
    requestAnimationFrame(draw);
  })(performance.now());
})();
