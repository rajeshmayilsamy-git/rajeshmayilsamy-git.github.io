/* ============================================================
   Potential flow past an arbitrary 2D body — Hess–Smith panel method.

   The body is a closed polygon of N panels. Each panel carries a
   constant source strength σ_j, and the whole body carries one
   vortex strength γ spread over its surface. The unknowns are fixed by

     · no flow through the surface:  (U + Σ induced)·n_i = 0  at every panel centre
     · Kutta condition at the trailing edge (panel 0 and panel N-1 leave
       the TE with equal speed), applied with weight w ∈ [0,1].

   w = 0 gives the plain non-lifting flow past a bluff body (sphere, square,
   wedge, rhombus); w = 1 gives the lifting flow past an airfoil, where the
   air leaves the sharp trailing edge smoothly. Values in between are used
   while the body morphs, so circulation fades in and out with the shape.

   Everything is in units of the sphere radius, freestream U = (1, 0),
   y pointing up. Panel 0 starts at the trailing-edge vertex and runs
   counter-clockwise.
   ============================================================ */

export const M = 240;                 // points per shape (drawing)
export const N = 120;                 // panels used by the solver (every STEP-th point)
export const STEP = M / N;
const INV2PI = 1 / (2 * Math.PI), INV4PI = 1 / (4 * Math.PI);

/* ---------------- shapes: closed polylines, uniform arc length ---------------- */
export function resample(pts) {
  const n = pts.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const total = cum[n], out = new Float64Array(2 * M);
  let j = 0;
  for (let m = 0; m < M; m++) {
    const s = total * m / M;
    while (j < n - 1 && cum[j + 1] < s) j++;
    const a = pts[j], b = pts[(j + 1) % n], span = cum[j + 1] - cum[j] || 1, f = (s - cum[j]) / span;
    out[2 * m] = a[0] + (b[0] - a[0]) * f;
    out[2 * m + 1] = a[1] + (b[1] - a[1]) * f;
  }
  return out;
}

function circle() {
  const pts = [];
  for (let i = 0; i < 720; i++) { const t = 2 * Math.PI * i / 720; pts.push([Math.cos(t), Math.sin(t)]); }
  return resample(pts);
}

/* Joukowski airfoil: z = ζ + 1/ζ with the circle centre offset by MU (thickness, camber),
   pitched nose-up by AOA. Starts at the trailing edge. */
export const MU = [-0.09, 0.07];
export const AOA = 6 * Math.PI / 180;
function airfoil() {
  const a = Math.hypot(1 - MU[0], MU[1]), t0 = Math.atan2(-MU[1], 1 - MU[0]);
  const ca = Math.cos(AOA), sa = Math.sin(AOA), pts = [];
  for (let i = 0; i < 2000; i++) {
    const t = t0 + 2 * Math.PI * i / 2000;
    const zx = MU[0] + a * Math.cos(t), zy = MU[1] + a * Math.sin(t), r2 = zx * zx + zy * zy;
    const X = zx + zx / r2, Y = zy - zy / r2;
    pts.push([X * ca + Y * sa, -X * sa + Y * ca]);          // rotate by −α
  }
  return resample(pts);
}

/* shift a polyline so its bounding box is centred on the origin */
export function centred(pts) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return pts.map(([x, y]) => [x - cx, y - cy]);
}

/* NACA-style half-thickness at chord fraction x, for max thickness t (closed trailing edge) */
const naca = (x, t) => 5 * t * (.2969 * Math.sqrt(x) - .1260 * x - .3516 * x * x + .2843 * x ** 3 - .1036 * x ** 4);

/* turbine / compressor blade: thick rounded nose, circular-arc camber, sharp trailing edge,
   set at stagger so the trailing edge points downward and the blade turns the flow */
function turbineBlade() {
  const L = 3.2, t = 0.18, tanP0 = 0.55, a = -16 * Math.PI / 180;
  const R = Math.sqrt(0.25 + (0.5 / tanP0) ** 2);
  const root = x => Math.sqrt(R * R - (x - .5) ** 2);
  const yc = x => root(x) - Math.sqrt(R * R - .25);
  const phi = x => Math.atan((.5 - x) / root(x));
  const up = [], lo = [], ca = Math.cos(a), sa = Math.sin(a);
  const rot = (X, Y) => [(X - .5) * ca - Y * sa, (X - .5) * sa + Y * ca];
  for (let i = 0; i <= 400; i++) {
    const x = (1 + Math.cos(Math.PI * i / 400)) / 2, yt = naca(x, t), f = phi(x);
    up.push(rot(x - yt * Math.sin(f), yc(x) + yt * Math.cos(f)));
    lo.push(rot(x + yt * Math.sin(f), yc(x) - yt * Math.cos(f)));
  }
  const pts = [...up, ...lo.slice(1, -1).reverse()].map(([x, y]) => [x * L, y * L]);   // TE -> upper -> LE -> lower
  return resample(centred(pts));
}

/* Formula 1 car, side view: the outer outline traced from a supplied black-and-white side-view
   silhouette. Only the outer contour is used: the interior lines (wheel rims, body creases) are
   filled in, the ground shadow is cut off, and hairline slots are closed, because the flow solver
   needs one solid body. 420 points, 4 units (sphere radii) long, counter-clockwise, starting at
   the right-most point of the rear wing. */
const F1_TRACE = [
  [2.000,0.187],[1.997,0.206],[1.973,0.202],[1.948,0.198],[1.924,0.193],[1.902,0.201],
  [1.902,0.225],[1.912,0.247],[1.920,0.270],[1.897,0.274],[1.872,0.274],[1.847,0.274],
  [1.823,0.274],[1.798,0.274],[1.774,0.274],[1.749,0.274],[1.724,0.274],[1.700,0.274],
  [1.675,0.274],[1.650,0.274],[1.626,0.274],[1.607,0.262],[1.595,0.240],[1.572,0.235],
  [1.548,0.236],[1.523,0.236],[1.498,0.236],[1.482,0.220],[1.472,0.197],[1.463,0.175],
  [1.453,0.152],[1.443,0.129],[1.433,0.107],[1.425,0.084],[1.420,0.060],[1.400,0.046],
  [1.380,0.031],[1.357,0.027],[1.332,0.032],[1.308,0.037],[1.292,0.055],[1.305,0.075],
  [1.324,0.091],[1.318,0.105],[1.294,0.112],[1.270,0.117],[1.247,0.124],[1.223,0.130],
  [1.199,0.136],[1.175,0.141],[1.151,0.148],[1.127,0.154],[1.103,0.160],[1.079,0.166],
  [1.056,0.172],[1.032,0.178],[1.008,0.184],[0.984,0.190],[0.960,0.196],[0.936,0.202],
  [0.912,0.208],[0.889,0.214],[0.865,0.220],[0.841,0.226],[0.817,0.232],[0.793,0.238],
  [0.769,0.245],[0.745,0.251],[0.722,0.256],[0.698,0.263],[0.674,0.268],[0.650,0.275],
  [0.626,0.281],[0.602,0.286],[0.578,0.292],[0.554,0.296],[0.529,0.299],[0.505,0.300],
  [0.480,0.302],[0.460,0.294],[0.443,0.278],[0.418,0.280],[0.394,0.282],[0.369,0.285],
  [0.345,0.289],[0.330,0.307],[0.335,0.331],[0.348,0.352],[0.352,0.374],[0.327,0.378],
  [0.303,0.382],[0.279,0.387],[0.254,0.386],[0.230,0.384],[0.217,0.365],[0.211,0.341],
  [0.202,0.319],[0.183,0.302],[0.180,0.278],[0.180,0.254],[0.180,0.229],[0.183,0.204],
  [0.194,0.183],[0.204,0.161],[0.198,0.138],[0.196,0.115],[0.173,0.106],[0.149,0.110],
  [0.132,0.126],[0.119,0.140],[0.095,0.143],[0.070,0.147],[0.046,0.149],[0.021,0.154],
  [-0.003,0.158],[-0.027,0.163],[-0.051,0.167],[-0.075,0.174],[-0.095,0.188],[-0.119,0.193],
  [-0.143,0.199],[-0.167,0.204],[-0.191,0.208],[-0.215,0.213],[-0.240,0.216],[-0.264,0.220],
  [-0.288,0.222],[-0.306,0.206],[-0.329,0.200],[-0.354,0.200],[-0.378,0.197],[-0.402,0.191],
  [-0.425,0.182],[-0.448,0.172],[-0.469,0.161],[-0.490,0.148],[-0.511,0.134],[-0.531,0.120],
  [-0.551,0.106],[-0.571,0.090],[-0.590,0.075],[-0.594,0.052],[-0.613,0.038],[-0.637,0.037],
  [-0.662,0.037],[-0.687,0.037],[-0.711,0.035],[-0.736,0.035],[-0.761,0.034],[-0.785,0.032],
  [-0.810,0.032],[-0.834,0.030],[-0.859,0.029],[-0.883,0.029],[-0.908,0.026],[-0.932,0.024],
  [-0.957,0.021],[-0.981,0.017],[-1.005,0.015],[-1.025,0.031],[-1.044,0.046],[-1.065,0.058],
  [-1.087,0.069],[-1.110,0.079],[-1.134,0.085],[-1.158,0.089],[-1.183,0.091],[-1.207,0.091],
  [-1.232,0.088],[-1.256,0.083],[-1.279,0.076],[-1.302,0.067],[-1.324,0.055],[-1.345,0.042],
  [-1.364,0.027],[-1.382,0.010],[-1.398,-0.009],[-1.413,-0.028],[-1.426,-0.049],[-1.442,-0.067],
  [-1.465,-0.076],[-1.489,-0.083],[-1.513,-0.089],[-1.537,-0.095],[-1.561,-0.099],[-1.577,-0.082],
  [-1.591,-0.070],[-1.615,-0.073],[-1.640,-0.073],[-1.665,-0.073],[-1.689,-0.073],[-1.714,-0.073],
  [-1.739,-0.073],[-1.763,-0.073],[-1.788,-0.076],[-1.808,-0.089],[-1.827,-0.105],[-1.847,-0.120],
  [-1.867,-0.135],[-1.886,-0.150],[-1.905,-0.166],[-1.924,-0.181],[-1.930,-0.202],[-1.942,-0.223],
  [-1.964,-0.232],[-1.987,-0.241],[-2.000,-0.259],[-2.000,-0.284],[-1.999,-0.308],[-1.999,-0.333],
  [-1.979,-0.345],[-1.955,-0.349],[-1.930,-0.349],[-1.905,-0.349],[-1.881,-0.349],[-1.856,-0.349],
  [-1.831,-0.349],[-1.807,-0.349],[-1.782,-0.346],[-1.758,-0.346],[-1.733,-0.346],[-1.708,-0.346],
  [-1.683,-0.346],[-1.659,-0.345],[-1.634,-0.343],[-1.610,-0.343],[-1.585,-0.343],[-1.560,-0.343],
  [-1.546,-0.335],[-1.558,-0.314],[-1.559,-0.289],[-1.550,-0.266],[-1.528,-0.258],[-1.503,-0.255],
  [-1.479,-0.251],[-1.455,-0.251],[-1.438,-0.268],[-1.428,-0.290],[-1.416,-0.312],[-1.402,-0.332],
  [-1.386,-0.351],[-1.368,-0.368],[-1.349,-0.384],[-1.325,-0.387],[-1.301,-0.387],[-1.276,-0.385],
  [-1.252,-0.387],[-1.227,-0.387],[-1.202,-0.387],[-1.178,-0.387],[-1.153,-0.387],[-1.128,-0.386],
  [-1.104,-0.387],[-1.079,-0.387],[-1.055,-0.387],[-1.032,-0.381],[-1.013,-0.365],[-0.996,-0.347],
  [-0.981,-0.328],[-0.966,-0.307],[-0.955,-0.286],[-0.944,-0.263],[-0.937,-0.240],[-0.931,-0.216],
  [-0.928,-0.191],[-0.918,-0.170],[-0.895,-0.164],[-0.871,-0.161],[-0.846,-0.161],[-0.821,-0.161],
  [-0.797,-0.159],[-0.772,-0.159],[-0.750,-0.167],[-0.750,-0.189],[-0.772,-0.197],[-0.797,-0.197],
  [-0.799,-0.218],[-0.791,-0.241],[-0.782,-0.264],[-0.776,-0.288],[-0.782,-0.312],[-0.794,-0.333],
  [-0.814,-0.347],[-0.838,-0.354],[-0.862,-0.354],[-0.883,-0.364],[-0.862,-0.371],[-0.837,-0.371],
  [-0.813,-0.373],[-0.788,-0.373],[-0.764,-0.373],[-0.739,-0.373],[-0.714,-0.374],[-0.690,-0.376],
  [-0.665,-0.376],[-0.640,-0.376],[-0.616,-0.376],[-0.591,-0.376],[-0.567,-0.376],[-0.542,-0.379],
  [-0.517,-0.379],[-0.493,-0.379],[-0.468,-0.379],[-0.443,-0.379],[-0.419,-0.382],[-0.394,-0.382],
  [-0.370,-0.387],[-0.346,-0.387],[-0.321,-0.387],[-0.296,-0.387],[-0.272,-0.387],[-0.247,-0.387],
  [-0.222,-0.387],[-0.198,-0.387],[-0.173,-0.387],[-0.148,-0.387],[-0.124,-0.387],[-0.099,-0.387],
  [-0.074,-0.387],[-0.050,-0.387],[-0.025,-0.387],[-0.000,-0.387],[0.024,-0.387],[0.049,-0.387],
  [0.074,-0.387],[0.098,-0.387],[0.123,-0.387],[0.148,-0.387],[0.172,-0.387],[0.197,-0.387],
  [0.222,-0.387],[0.246,-0.387],[0.271,-0.387],[0.296,-0.387],[0.320,-0.387],[0.345,-0.387],
  [0.370,-0.387],[0.394,-0.387],[0.419,-0.387],[0.444,-0.387],[0.468,-0.387],[0.491,-0.378],
  [0.515,-0.376],[0.540,-0.373],[0.564,-0.373],[0.589,-0.371],[0.614,-0.371],[0.638,-0.368],
  [0.663,-0.368],[0.687,-0.366],[0.712,-0.365],[0.736,-0.364],[0.761,-0.362],[0.785,-0.361],
  [0.810,-0.360],[0.835,-0.360],[0.859,-0.357],[0.884,-0.357],[0.908,-0.356],[0.933,-0.354],
  [0.958,-0.353],[0.982,-0.351],[1.007,-0.351],[1.031,-0.351],[1.056,-0.349],[1.081,-0.349],
  [1.105,-0.346],[1.130,-0.346],[1.154,-0.343],[1.179,-0.343],[1.203,-0.343],[1.228,-0.340],
  [1.252,-0.340],[1.277,-0.340],[1.302,-0.338],[1.326,-0.338],[1.348,-0.348],[1.365,-0.365],
  [1.384,-0.382],[1.407,-0.387],[1.432,-0.387],[1.457,-0.386],[1.481,-0.387],[1.506,-0.387],
  [1.530,-0.387],[1.555,-0.387],[1.580,-0.387],[1.604,-0.387],[1.629,-0.386],[1.653,-0.387],
  [1.678,-0.387],[1.702,-0.383],[1.721,-0.368],[1.738,-0.350],[1.754,-0.331],[1.768,-0.311],
  [1.780,-0.290],[1.791,-0.267],[1.799,-0.244],[1.805,-0.220],[1.808,-0.196],[1.809,-0.171],
  [1.810,-0.147],[1.826,-0.130],[1.851,-0.128],[1.875,-0.128],[1.898,-0.123],[1.900,-0.099],
  [1.900,-0.074],[1.900,-0.049],[1.903,-0.025],[1.911,-0.002],[1.908,0.022],[1.918,0.042],
  [1.940,0.052],[1.951,0.074],[1.960,0.097],[1.970,0.119],[1.980,0.142],[1.990,0.165]
];

const f1Car = () => resample(F1_TRACE);

export const NAMES = ['sphere', 'airfoil', 'blade', 'f1', 'rhombus', 'wedge'];
export const LIFT = [0, 1, 1, 0, 0, 0];          // bodies with a sharp trailing edge carry circulation (Kutta)
export const SHAPES = [
  circle(),
  airfoil(),
  turbineBlade(),
  f1Car(),
  resample([[1.01, 0], [0, .64], [-1.01, 0], [0, -.64]]),                   // rhombus (75 % size)
  resample([[.66, 0], [.66, .77], [-.66, 0], [.66, -.77]])                  // small wedge, apex into the wind
];

export function blend(a, b, k, out) {
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * k;
  return out;
}

/* ---------------- the solver ---------------- */
export class Body {
  constructor() {
    const f = n => new Float64Array(n);
    this.px = f(N); this.py = f(N); this.mx = f(N); this.my = f(N);
    this.Lp = f(N); this.cs = f(N); this.sn = f(N); this.nx = f(N); this.ny = f(N);
    this.sig = f(N); this.gam = 0; this.rb2 = 1; this.u = 1; this.v = 0;
    this._A = f(N * N); this._lu = f(N * N); this._bg = f(N);
    this._T0 = f(N); this._T1 = f(N); this._r0 = f(N); this._r1 = f(N); this._x0 = f(N); this._x1 = f(N);
  }

  /** Solve for the flow around `poly` (Float64Array of M x,y pairs). w = Kutta weight. */
  set(poly, w) {
    const { px, py, mx, my, Lp, cs, sn, nx, ny, sig } = this;
    let rb2 = 0;
    for (let i = 0; i < N; i++) {
      px[i] = poly[2 * i * STEP]; py[i] = poly[2 * i * STEP + 1];
      rb2 = Math.max(rb2, px[i] * px[i] + py[i] * py[i]);
    }
    this.rb2 = rb2;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, dx = px[j] - px[i], dy = py[j] - py[i], L = Math.hypot(dx, dy);
      Lp[i] = L; cs[i] = dx / L; sn[i] = dy / L;
      mx[i] = (px[i] + px[j]) / 2; my[i] = (py[i] + py[j]) / 2;
      nx[i] = sn[i]; ny[i] = -cs[i];                         // outward normal for a CCW body
    }

    // influence of every panel on every control point (nudged just outside the surface)
    const A = this._A, bg = this._bg, T0 = this._T0, T1 = this._T1, eps = 1e-6;
    let C0 = 0, C1 = 0;
    for (let i = 0; i < N; i++) {
      const X = mx[i] + eps * nx[i], Y = my[i] + eps * ny[i];
      let sumVN = 0;
      for (let j = 0; j < N; j++) {
        const rx = X - px[j], ry = Y - py[j], c = cs[j], s = sn[j], L = Lp[j];
        const xl = rx * c + ry * s, yl = -rx * s + ry * c, xm = xl - L;
        const r1 = xl * xl + yl * yl, r2 = Math.max(xm * xm + yl * yl, 1e-14);
        const Aa = Math.log(r1 / r2) * INV4PI;                // unit-source local u
        const Bb = Math.atan2(yl * L, r1 - xl * L) * INV2PI;  // unit-source local v
        const su = Aa * c - Bb * s, sv = Aa * s + Bb * c;     // source, global
        const vu = -Bb * c - Aa * s, vv = -Bb * s + Aa * c;   // unit vortex, global
        A[i * N + j] = su * nx[i] + sv * ny[i];
        sumVN += vu * nx[i] + vv * ny[i];
        if (i === 0) { T0[j] = su * cs[0] + sv * sn[0]; C0 += vu * cs[0] + vv * sn[0]; }
        else if (i === N - 1) { T1[j] = su * cs[N - 1] + sv * sn[N - 1]; C1 += vu * cs[N - 1] + vv * sn[N - 1]; }
      }
      bg[i] = sumVN;
    }

    // solve A σ = rhs for two right-hand sides at once: the freestream and a unit vortex
    const a = this._lu, r0 = this._r0, r1v = this._r1, x0 = this._x0, x1 = this._x1;
    a.set(A);
    for (let i = 0; i < N; i++) { r0[i] = -nx[i]; r1v[i] = -bg[i]; }
    for (let k = 0; k < N; k++) {
      let p = k, best = Math.abs(a[k * N + k]);
      for (let i = k + 1; i < N; i++) { const v = Math.abs(a[i * N + k]); if (v > best) { best = v; p = i; } }
      if (p !== k) {
        for (let j = 0; j < N; j++) { const t = a[k * N + j]; a[k * N + j] = a[p * N + j]; a[p * N + j] = t; }
        let t = r0[k]; r0[k] = r0[p]; r0[p] = t; t = r1v[k]; r1v[k] = r1v[p]; r1v[p] = t;
      }
      const piv = a[k * N + k];
      for (let i = k + 1; i < N; i++) {
        const f = a[i * N + k] / piv;
        if (f === 0) continue;
        for (let j = k + 1; j < N; j++) a[i * N + j] -= f * a[k * N + j];
        r0[i] -= f * r0[k]; r1v[i] -= f * r1v[k];
      }
    }
    for (let i = N - 1; i >= 0; i--) {
      let s0 = r0[i], s1 = r1v[i];
      for (let j = i + 1; j < N; j++) { const aij = a[i * N + j]; s0 -= aij * x0[j]; s1 -= aij * x1[j]; }
      x0[i] = s0 / a[i * N + i]; x1[i] = s1 / a[i * N + i];
    }

    // Kutta: tangential speeds on the two panels meeting the trailing edge must cancel
    let Tinf = cs[0] + cs[N - 1], Tg = C0 + C1;
    for (let j = 0; j < N; j++) { const t = T0[j] + T1[j]; Tinf += t * x0[j]; Tg += t * x1[j]; }
    this.gammaKutta = Math.abs(Tg) > 1e-9 ? -Tinf / Tg : 0;
    const gam = w * this.gammaKutta;
    for (let j = 0; j < N; j++) sig[j] = x0[j] + gam * x1[j];
    this.gam = gam;
    return this;
  }

  inside(x, y) {
    const { px, py } = this;
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      if ((py[i] > y) !== (py[j] > y) && x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i]) + px[i]) c = !c;
    }
    return c;
  }

  /** Velocity at (x, y) in body units. Returns false if the point is inside the body. */
  vel(x, y) {
    if (x * x + y * y < this.rb2 * 1.0001 && this.inside(x, y)) return false;
    const { px, py, cs, sn, Lp, sig, gam } = this;
    let u = 1, v = 0;
    for (let j = 0; j < N; j++) {
      const rx = x - px[j], ry = y - py[j], c = cs[j], s = sn[j], L = Lp[j];
      const xl = rx * c + ry * s, yl = -rx * s + ry * c, xm = xl - L;
      const r1 = xl * xl + yl * yl, r2 = Math.max(xm * xm + yl * yl, 1e-14);
      const Aa = Math.log(r1 / r2) * INV4PI, Bb = Math.atan2(yl * L, r1 - xl * L) * INV2PI;
      const ul = sig[j] * Aa - gam * Bb, vl = sig[j] * Bb + gam * Aa;
      u += ul * c - vl * s; v += ul * s + vl * c;
    }
    const s2 = u * u + v * v;                                  // tame the corner singularities
    if (s2 > 9) { const k = 3 / Math.sqrt(s2); u *= k; v *= k; }
    this.u = u; this.v = v;
    return true;
  }
}
