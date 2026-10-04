import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = THREE.MathUtils.lerp;

$('#yr').textContent = new Date().getFullYear();

/* ---------- rotating role text ---------- */
(() => {
  const spans = $$('#roles span'); let i = 0;
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

/* ---------- shared pointer state ---------- */
const ptr = { x: 0, y: 0, px: innerWidth * .5, py: innerHeight * .5, active: false };
addEventListener('pointermove', e => {
  ptr.x = (e.clientX / innerWidth) * 2 - 1;
  ptr.y = -((e.clientY / innerHeight) * 2 - 1);
  ptr.px = e.clientX; ptr.py = e.clientY; ptr.active = true;
}, { passive: true });
let scrollY = 0, lastScroll = 0, scrollVel = 0;
addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

/* ============================================================
   Interactive background: potential flow around the cursor
   ============================================================ */
(() => {
  const cv = $('#flow'), ctx = cv.getContext('2d');
  let parts = [], R = 80, ox = innerWidth * .5, oy = innerHeight * .5;
  const spawn = any => ({ x: any ? Math.random() * innerWidth : -10, y: Math.random() * innerHeight, life: Math.random() * 300 });
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a080d'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    parts = Array.from({ length: Math.min(1100, Math.floor(innerWidth * innerHeight / 1800)) }, () => spawn(true));
  }
  addEventListener('resize', resize); resize();
  const U = 2.4;
  (function draw() {
    ox += (ptr.px - ox) * .14; oy += (ptr.py - oy) * .14;
    ctx.fillStyle = 'rgba(10,8,13,.085)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.lineWidth = 1;
    for (const p of parts) {
      const dx = p.x - ox, dy = p.y - oy, r2 = dx * dx + dy * dy;
      let u = U, v = 0;
      if (ptr.active) {
        if (r2 < R * R * .55) { u = 0; v = 0; }
        else { const k = R * R / (r2 * r2); u = U * (1 - k * (dx * dx - dy * dy)); v = -U * k * 2 * dx * dy; }
      }
      const nx = p.x + u, ny = p.y + v;
      const sp = Math.min(Math.hypot(u, v) / U, 2);
      ctx.strokeStyle = `hsla(${268 + sp * 34},95%,${64 + sp * 6}%,${.16 + sp * .2})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny;
      if (p.x > innerWidth + 10 || p.y < -10 || p.y > innerHeight + 10 || ++p.life > 700) Object.assign(p, spawn(false), { life: 0 });
    }
    requestAnimationFrame(draw);
  })();
})();

/* ============================================================
   WebGL: photo-mapped 3D head + turbofan halo
   ============================================================ */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (e) { $('#loader').classList.add('done'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.z = 7;

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xcfc2ff, 0x2a1450, 0.55));
const key = new THREE.DirectionalLight(0xfff3e8, 1.35); key.position.set(1.6, 2.2, 5); scene.add(key);
const rimL = new THREE.PointLight(0xa066ff, 55, 12); rimL.position.set(-3.2, 1, -.4); scene.add(rimL);
const rimR = new THREE.PointLight(0xff6bd6, 30, 12); rimR.position.set(3.2, .5, -.4); scene.add(rimR);

const hideLoader = () => {
  const el = $('#loader');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 1200);
};
setTimeout(hideLoader, 4000);                        // never let the loader get stuck

/* ---------- portrait: key the white studio backdrop out of the photo ---------- */
const portrait = $('#portrait'), cut = $('#cut');
let cutReady = false, cutT0 = -1;      // the fade-in runs on the rAF clock, not a CSS transition
(() => {
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    cut.width = w; cut.height = h;
    const c = cut.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, w, h), p = d.data;
    // backdrop pixels are near-white in every channel; ramp the alpha so edges stay soft
    for (let i = 0; i < p.length; i += 4) {
      const mn = Math.min(p[i], p[i + 1], p[i + 2]);
      if (mn > 238) p[i + 3] = 0;
      else if (mn > 198) p[i + 3] = Math.round(255 * (1 - (mn - 198) / 40));
    }
    // dissolve the bottom of the shirt instead of ending on the photo's hard edge
    const fade = Math.round(h * .18);
    for (let y = h - fade; y < h; y++) {
      const k = 1 - (y - (h - fade)) / fade;
      const e = k * k * (3 - 2 * k);
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4 + 3; p[i] = Math.round(p[i] * e); }
    }
    c.putImageData(d, 0, 0);
    cutReady = true;
    hideLoader();
  };
  img.onerror = hideLoader;
  img.src = 'assets/photo.jpg';
})();

/* ---------- glow sprites (aura + orb) ---------- */
function glowTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(150,90,255,.75)', 'rgba(150,90,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
aura.scale.set(7, 5, 1); aura.position.set(0, -1.4, -3.4); scene.add(aura);

const orb = new THREE.Group();
orb.add(new THREE.Mesh(new THREE.SphereGeometry(.2, 40, 32), new THREE.MeshBasicMaterial({ color: 0xe3d3ff })));
const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(210,170,255,.9)', 'rgba(150,90,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
orbGlow.scale.set(1.5, 1.5, 1); orb.add(orbGlow);
orb.add(new THREE.PointLight(0xc9a6ff, 30, 6));
scene.add(orb);

/* ---------- turbofan halo ---------- */
const fan = new THREE.Group();
const metal = new THREE.MeshStandardMaterial({ color: 0xb8a4ff, metalness: 1, roughness: .26, envMapIntensity: 1.3 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1c1235, metalness: .9, roughness: .35 });
const bladeShape = new THREE.Shape();
bladeShape.moveTo(0, 0);
bladeShape.bezierCurveTo(.22, .15, .3, .55, .16, 1);
bladeShape.lineTo(-.02, 1);
bladeShape.bezierCurveTo(.05, .6, -.06, .25, -.07, 0);
const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: .035, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 2, curveSegments: 18 });
const NB = 16, R0 = .5, R1 = 1.85;
for (let i = 0; i < NB; i++) {
  const pivot = new THREE.Object3D(), b = new THREE.Mesh(bladeGeo, metal);
  b.scale.set(1, R1 - R0, 1); b.position.y = R0; b.rotation.y = .75;
  pivot.add(b); pivot.rotation.z = (i / NB) * Math.PI * 2; fan.add(pivot);
}
const hub = new THREE.Mesh(new THREE.CylinderGeometry(.5, .56, .22, 48), dark); hub.rotation.x = Math.PI / 2; fan.add(hub);
const cone = new THREE.Mesh(new THREE.ConeGeometry(.38, .5, 48), metal); cone.rotation.x = Math.PI / 2; cone.position.z = .3; fan.add(cone);
fan.add(new THREE.Mesh(new THREE.TorusGeometry(1.95, .028, 16, 160),
  new THREE.MeshStandardMaterial({ color: 0xb69cff, emissive: 0x8b5cf6, emissiveIntensity: 1.4, metalness: .6, roughness: .3 })));
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.25, .012, 8, 160), new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: .5 }));
fan.add(ring2);
const fanGroup = new THREE.Group(); fanGroup.add(fan); scene.add(fanGroup);

/* ---------- layout ---------- */
let visW = 1, visH = 1, narrow = false;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  visW = visH * camera.aspect; narrow = innerWidth < 900;
}
addEventListener('resize', resize); resize();

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let hx = 0, hy = 0, spin = 0, s = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  s = lerp(s, clamp(scrollY / (innerHeight * .8), 0, 1), .08);
  scrollVel = lerp(scrollVel, (scrollY - lastScroll) / Math.max(dt, .001) * .0004, .1); lastScroll = scrollY;

  let tx = ptr.x, ty = ptr.y;
  if (!ptr.active) { tx = Math.sin(t * .6) * .35; ty = Math.cos(t * .45) * .15; }

  hx = lerp(hx, tx, .07); hy = lerp(hy, ty, .07);

  if (cutReady) {
    if (cutT0 < 0) cutT0 = t;
    cut.style.opacity = clamp((t - cutT0) / .9, 0, 1).toFixed(3);
  }

  // the portrait leans towards the cursor and drifts away as the page scrolls
  if (portrait) {
    portrait.style.transform =
      `translateX(-50%) translate3d(${(hx * 16).toFixed(1)}px,${(hy * -10 - s * 140).toFixed(1)}px,0)` +
      ` rotateY(${(hx * 7).toFixed(2)}deg) rotateX(${(hy * 4).toFixed(2)}deg) scale(${(1 - s * .12).toFixed(3)})`;
    portrait.style.opacity = (1 - s * 1.4).toFixed(2);
  }

  const baseY = narrow ? -.76 : .22;       // world height of the head in the cut-out photo
  aura.position.y = lerp(-1.4, -4, s);

  spin += dt * (.5 + Math.abs(scrollVel) * 4);
  fan.rotation.z = -spin; ring2.rotation.z = spin * .4;
  fanGroup.scale.setScalar(lerp(narrow ? .37 : .86, .5, s));
  fanGroup.position.set(lerp(0, narrow ? 0 : visW * .36, s) - ptr.x * .2, lerp(baseY, -visH * .18, s) - ptr.y * .12, lerp(-1.9, -3.2, s));
  fanGroup.rotation.set(hy * -.3 + .12 * s, hx * .4, 0);

  orb.position.set((narrow ? .5 : visW * .31) + ptr.x * .25, (narrow ? -visH * .3 : -visH * .22) + Math.sin(t * 1.3) * .08 + ptr.y * .15, .4);
  orb.visible = s < .7;

  rimL.position.x = -3.2 + ptr.x * 2; rimR.position.y = .5 + ptr.y * 1.5;
  renderer.render(scene, camera);
  if (!reduce || t < 1.5) requestAnimationFrame(frame);
}
frame();
