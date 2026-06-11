/*
 * fields.js — Motor de campos contínuos + extração de contornos vetoriais.
 *
 * Porta para JS dos algoritmos desenvolvidos pelo usuário em Documents/code:
 *   • Gray-Scott (reação-difusão / padrões de Turing) — de fractal/ e tetramath/
 *   • Campo de fluxo "Geometria Sagrada" (Fibonacci + simetria) — de fractal/main.py
 *   • Ruído fractal multi-oitava — de simulation/src/operators.js
 *
 * A técnica de saída replica o pipeline Turing→SVG (matplotlib QuadContourSet):
 * o campo escalar é convertido em CONTORNOS fechados via marching squares e
 * exportado como <path> pintáveis — gerando páginas para colorir orgânicas.
 */
(function () {
  "use strict";

  /* ───────── RNG determinístico (mulberry32) ───────── */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const idx = (x, y, N) => y * N + x;
  const wrap = (i, N) => (i < 0 ? i + N : i >= N ? i - N : i);

  /* ───────── Laplaciano 5 pontos toroidal (de fractal: def lap(U)) ───────── */
  function laplacian(A, out, N) {
    for (let y = 0; y < N; y++) {
      const yU = wrap(y + 1, N), yD = wrap(y - 1, N);
      for (let x = 0; x < N; x++) {
        const xR = wrap(x + 1, N), xL = wrap(x - 1, N), c = idx(x, y, N);
        out[c] = A[idx(xR, y, N)] + A[idx(xL, y, N)] +
                 A[idx(x, yU, N)] + A[idx(x, yD, N)] - 4 * A[c];
      }
    }
  }

  /* ───────── Gray-Scott (reação-difusão) — regimes clássicos de Turing ─────────
     Equações (idênticas ao tetramath/gray_scott e fractal HyperSpectralEngine):
       U' = Du·∇²U − U·V² + f·(1−U)
       V' = Dv·∇²V + U·V² − (f+k)·V
  */
  const REGIMES = {
    coral:     { f: 0.0545, k: 0.0620 },
    labirinto: { f: 0.0290, k: 0.0570 },
    celulas:   { f: 0.0367, k: 0.0649 }, // f do HyperSpectralEngine do usuário
    pontos:    { f: 0.0250, k: 0.0600 },
    teia:      { f: 0.0780, k: 0.0610 },
  };

  function graySocttField(opts) {
    const N = opts.N || 120;
    const steps = opts.steps || 2400;
    const r = rng(opts.seed | 0);
    const reg = REGIMES[opts.regime] || REGIMES.coral;
    const f = reg.f, k = reg.k;
    const Du = 0.16, Dv = 0.08, dt = 1.0;

    const size = N * N;
    let U = new Float32Array(size).fill(1);
    let V = new Float32Array(size).fill(0);
    const lapU = new Float32Array(size);
    const lapV = new Float32Array(size);

    // sementes: manchas aleatórias de V (perturbação)
    const nSeeds = 8 + Math.floor(r() * 10);
    for (let s = 0; s < nSeeds; s++) {
      const cx = Math.floor(r() * N), cy = Math.floor(r() * N);
      const rad = 3 + Math.floor(r() * 5);
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy > rad * rad) continue;
          const c = idx(wrap(cx + dx, N), wrap(cy + dy, N), N);
          U[c] = 0.5; V[c] = 0.25;
        }
      }
    }

    for (let step = 0; step < steps; step++) {
      laplacian(U, lapU, N);
      laplacian(V, lapV, N);
      for (let i = 0; i < size; i++) {
        const u = U[i], v = V[i], uvv = u * v * v;
        U[i] = u + (Du * lapU[i] - uvv + f * (1 - u)) * dt;
        V[i] = v + (Dv * lapV[i] + uvv - (f + k) * v) * dt;
      }
    }
    return { field: V, N: N };
  }

  /* ───────── Campo "Geometria Sagrada" (de fractal/main.py: get_sacred_flow) ─────────
     Acumula densidade de partículas advectadas por um campo de fluxo com
     simetria radial + espiral de Fibonacci. Retorna densidade como campo escalar.
  */
  function sacredField(opts) {
    const N = opts.N || 140;
    const r = rng(opts.seed | 0);
    const symmetry = opts.simetria || [3, 4, 5, 6, 8, 12][Math.floor(r() * 6)];
    const freqA = 0.02 + r() * 0.06;
    const freqB = 0.01 + r() * 0.04;
    const phi = (1 + Math.sqrt(5)) / 2;
    const nParticles = opts.particulas || 9000;
    const steps = 90;
    const cx = N / 2, cy = N / 2;

    const dens = new Float32Array(N * N);
    const px = new Float32Array(nParticles);
    const py = new Float32Array(nParticles);
    for (let p = 0; p < nParticles; p++) { px[p] = r() * N; py[p] = r() * N; }

    for (let s = 0; s < steps; s++) {
      for (let p = 0; p < nParticles; p++) {
        const dx = px[p] - cx, dy = py[p] - cy;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy) + 1e-5;
        const sAng = Math.sin(angle * symmetry);
        let vx = Math.cos(angle * phi + sAng) * Math.sin(dist * freqA);
        let vy = Math.sin(angle * phi - sAng) * Math.cos(dist * freqB);
        vx -= (dx / dist) * 0.2;
        vy -= (dy / dist) * 0.2;
        let nx = px[p] + vx * 1.4, ny = py[p] + vy * 1.4;
        nx = ((nx % N) + N) % N; ny = ((ny % N) + N) % N;
        px[p] = nx; py[p] = ny;
        dens[idx(nx | 0, ny | 0, N)] += 1;
      }
    }
    // suaviza um pouco para contornos limpos
    const sm = new Float32Array(N * N);
    laplacian(dens, sm, N);
    for (let i = 0; i < dens.length; i++) dens[i] = dens[i] + 0.18 * sm[i];
    return { field: dens, N: N };
  }

  /* ───────── Gradiente e divergência toroidais (de simulation/operators.js) ───────── */
  function grad(P, gx, gy, N) {
    for (let y = 0; y < N; y++) {
      const yU = wrap(y + 1, N), yD = wrap(y - 1, N);
      for (let x = 0; x < N; x++) {
        const xR = wrap(x + 1, N), xL = wrap(x - 1, N), c = idx(x, y, N);
        gx[c] = 0.5 * (P[idx(xR, y, N)] - P[idx(xL, y, N)]);
        gy[c] = 0.5 * (P[idx(x, yU, N)] - P[idx(x, yD, N)]);
      }
    }
  }
  function divergence(Ax, Ay, out, N) {
    for (let y = 0; y < N; y++) {
      const yU = wrap(y + 1, N), yD = wrap(y - 1, N);
      for (let x = 0; x < N; x++) {
        const xR = wrap(x + 1, N), xL = wrap(x - 1, N), c = idx(x, y, N);
        out[c] = 0.5 * (Ax[idx(xR, y, N)] - Ax[idx(xL, y, N)]) + 0.5 * (Ay[idx(x, yU, N)] - Ay[idx(x, yD, N)]);
      }
    }
  }

  /* ───────── Campo acoplado ρ–Φ–v (porta de simulation/src/engine.js) ─────────
     ρ_t + ∇·(ρv) = D_ρ∇²ρ;  v_t = -∇Φ - kDiss·v + ν∇²v + β·perp(∇ρ);
     Φ_t = kDiff∇²Φ + α(ρ-ρ0) - λΦ + forçamento fractal.
     O termo baroclínico β·perp(∇ρ) injeta vorticidade (sem ele, v=-∇Φ é gradiente puro). */
  function coupledField(opts) {
    const N = opts.N || 108;
    const steps = opts.steps || 420;
    const r = rng((opts.seed | 0) || 1);
    const size = N * N;
    // dt pequeno + clamps = estabilidade (equivalente ao limite CFL do engine original)
    const Drho = 0.14, nu = 0.12, kDiss = 0.04, kDiff = 0.18, alpha = 0.5, lambda = 0.03, beta = 0.5, rho0 = 1, dt = 0.05;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    const rho = new Float32Array(size), Vx = new Float32Array(size), Vy = new Float32Array(size), Phi = new Float32Array(size);
    // forçamento fractal fixo (ruído suavizado multi-oitava)
    const force = new Float32Array(size), tmp = new Float32Array(size);
    for (let i = 0; i < size; i++) { force[i] = r() - 0.5; rho[i] = 1 + (r() - 0.5) * 0.1; }
    for (let pass = 0; pass < 6; pass++) { laplacian(force, tmp, N); for (let i = 0; i < size; i++) force[i] += 0.2 * tmp[i]; }
    for (let i = 0; i < size; i++) force[i] *= 0.35;

    const gpx = new Float32Array(size), gpy = new Float32Array(size);
    const grx = new Float32Array(size), gry = new Float32Array(size);
    const lap = new Float32Array(size), lapVx = new Float32Array(size), lapVy = new Float32Array(size);
    const rvx = new Float32Array(size), rvy = new Float32Array(size), divF = new Float32Array(size);

    for (let step = 0; step < steps; step++) {
      grad(Phi, gpx, gpy, N);
      grad(rho, grx, gry, N);
      laplacian(Phi, lap, N);
      for (let i = 0; i < size; i++) Phi[i] = clamp(Phi[i] + dt * (kDiff * lap[i] + alpha * (rho[i] - rho0) - lambda * Phi[i] + force[i]), -4, 4);

      laplacian(Vx, lapVx, N); laplacian(Vy, lapVy, N);
      for (let i = 0; i < size; i++) {
        Vx[i] = clamp(Vx[i] + dt * (-gpx[i] - kDiss * Vx[i] + nu * lapVx[i] + beta * (-gry[i])), -1.5, 1.5);
        Vy[i] = clamp(Vy[i] + dt * (-gpy[i] - kDiss * Vy[i] + nu * lapVy[i] + beta * (grx[i])), -1.5, 1.5);
      }
      for (let i = 0; i < size; i++) { rvx[i] = rho[i] * Vx[i]; rvy[i] = rho[i] * Vy[i]; }
      divergence(rvx, rvy, divF, N);
      laplacian(rho, lap, N);
      for (let i = 0; i < size; i++) rho[i] = clamp(rho[i] + dt * (-divF[i] + Drho * lap[i]), 0, 4);
    }
    return { field: rho, N: N };
  }

  /* ───────── Normaliza campo para 0..1 (com recorte de percentil) ───────── */
  function normalize(field) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < field.length; i++) {
      if (field[i] < lo) lo = field[i];
      if (field[i] > hi) hi = field[i];
    }
    const out = new Float32Array(field.length);
    const span = hi - lo || 1;
    for (let i = 0; i < field.length; i++) out[i] = (field[i] - lo) / span;
    return out;
  }

  /* ───────── Marching squares: campo → polilinhas de contorno ─────────
     Réplica vetorial do QuadContourSet (matplotlib) usado no pipeline do usuário.
     Para um nível 't', extrai segmentos e os encadeia em polilinhas.
  */
  function contourSegments(field, N, t) {
    const segs = [];
    const V = (x, y) => field[idx(x, y, N)];
    const interp = (va, vb) => (t - va) / (vb - va);
    for (let y = 0; y < N - 1; y++) {
      for (let x = 0; x < N - 1; x++) {
        const tl = V(x, y), tr = V(x + 1, y), br = V(x + 1, y + 1), bl = V(x, y + 1);
        let c = 0;
        if (tl > t) c |= 8;
        if (tr > t) c |= 4;
        if (br > t) c |= 2;
        if (bl > t) c |= 1;
        if (c === 0 || c === 15) continue;
        // pontos nas arestas
        const top = [x + interp(tl, tr), y];
        const right = [x + 1, y + interp(tr, br)];
        const bottom = [x + interp(bl, br), y + 1];
        const left = [x, y + interp(tl, bl)];
        const push = (a, b) => segs.push([a, b]);
        switch (c) {
          case 1: case 14: push(left, bottom); break;
          case 2: case 13: push(bottom, right); break;
          case 3: case 12: push(left, right); break;
          case 4: case 11: push(top, right); break;
          case 5: push(left, top); push(bottom, right); break;
          case 6: case 9: push(top, bottom); break;
          case 7: case 8: push(left, top); break;
          case 10: push(top, right); push(left, bottom); break;
          default: break;
        }
      }
    }
    return segs;
  }

  /* Encadeia segmentos em polilinhas casando extremidades (hash com tolerância). */
  function chainSegments(segs) {
    const key = (p) => (Math.round(p[0] * 100) / 100) + "_" + (Math.round(p[1] * 100) / 100);
    const map = new Map(); // key -> [segIndices]
    segs.forEach((s, i) => {
      [key(s[0]), key(s[1])].forEach((kk) => {
        if (!map.has(kk)) map.set(kk, []);
        map.get(kk).push(i);
      });
    });
    const used = new Array(segs.length).fill(false);
    const polylines = [];

    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const line = [segs[i][0].slice(), segs[i][1].slice()];
      // estende pela frente
      let extended = true;
      while (extended) {
        extended = false;
        const tail = line[line.length - 1];
        const cand = map.get(key(tail)) || [];
        for (const j of cand) {
          if (used[j]) continue;
          const s = segs[j];
          if (key(s[0]) === key(tail)) { line.push(s[1].slice()); used[j] = true; extended = true; break; }
          if (key(s[1]) === key(tail)) { line.push(s[0].slice()); used[j] = true; extended = true; break; }
        }
      }
      polylines.push(line);
    }
    return polylines;
  }

  /* ───────── Campo → SVG pintável (contornos em vários níveis) ───────── */
  function fieldToSVG(res, opts) {
    const N = res.N;
    const field = normalize(res.field);
    const niveis = opts.niveis || 7;
    const W = 720, H = 720, pad = 24;
    const sc = (W - pad * 2) / (N - 1);
    const T = (p) => (pad + p[0] * sc).toFixed(2) + " " + (pad + p[1] * sc).toFixed(2);
    const minLen = 5;
    const parts = [];

    for (let lvl = 1; lvl <= niveis; lvl++) {
      const t = lvl / (niveis + 1);
      const polys = chainSegments(contourSegments(field, N, t));
      polys.forEach((pl) => {
        if (pl.length < minLen) return;
        const fechado =
          Math.abs(pl[0][0] - pl[pl.length - 1][0]) < 0.5 &&
          Math.abs(pl[0][1] - pl[pl.length - 1][1]) < 0.5;
        let d = "M " + T(pl[0]);
        for (let i = 1; i < pl.length; i++) d += " L " + T(pl[i]);
        if (fechado) {
          d += " Z";
          parts.push('<path class="region" d="' + d + '"/>');
        } else {
          parts.push('<path class="contorno" fill="none" d="' + d + '"/>');
        }
      });
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H +
      '" width="' + W + '" height="' + H + '">' +
      '<rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
      '<g fill="#ffffff" stroke="#1b1b1b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' +
      parts.join("") +
      '<rect x="' + pad + '" y="' + pad + '" width="' + (W - pad * 2) +
      '" height="' + (H - pad * 2) + '" fill="none"/>' +
      "</g></svg>"
    );
  }

  /* ───────── Geradores expostos ───────── */
  function reacaodifusao(opts) {
    const res = graySocttField({
      seed: opts.seed | 0,
      regime: opts.regime || "coral",
      N: 120,
      steps: 2000 + ((+opts.detalhe || 3) * 400),
    });
    return fieldToSVG(res, { niveis: 4 + (+opts.linhas || 3) });
  }

  function geometriasagrada(opts) {
    const res = sacredField({
      seed: opts.seed | 0,
      simetria: +opts.simetria || 6,
      N: 140,
      particulas: 9000,
    });
    return fieldToSVG(res, { niveis: 5 + (+opts.linhas || 3) });
  }

  function campovetorial(opts) {
    const res = coupledField({ seed: opts.seed | 0, N: 108, steps: 200 + ((+opts.detalhe || 3) * 45) });
    return fieldToSVG(res, { niveis: 4 + (+opts.linhas || 4) });
  }

  // ───────────────── QUASICRISTAL (soma de ondas planas) ─────────────────
  // f(x,y) = Σ cos(k·(x·cosθᵢ + y·sinθᵢ) + φᵢ), θᵢ = πi/N — padrão quasi-periódico
  // de simetria N (nunca se repete). Clássico da arte matemática na web.
  function quasicristalField(opts) {
    const grid = 132, sym = +opts.simetria || 5;
    const freq = 0.05 + ((+opts.frequencia || 30) / 100) * 0.35;
    const r = rng((opts.seed | 0) || 1);
    const fases = []; for (let i = 0; i < sym; i++) fases.push(r() * Math.PI * 2);
    const field = new Float32Array(grid * grid);
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        let s = 0;
        for (let i = 0; i < sym; i++) { const a = (Math.PI * i) / sym; s += Math.cos(freq * (x * Math.cos(a) + y * Math.sin(a)) + fases[i]); }
        field[y * grid + x] = s;
      }
    }
    return { field: field, N: grid };
  }
  function quasicristal(opts) {
    return fieldToSVG(quasicristalField(opts), { niveis: 4 + (+opts.linhas || 4) });
  }

  // ───────────────── CHLADNI (cimática — padrões de vibração) ─────────────────
  // Linhas nodais de uma placa vibrando: cos(nπx)cos(mπy) − cos(mπx)cos(nπy).
  function chladniField(opts) {
    const grid = 150, n = +opts.n || 4, m = +opts.m || 3;
    const sinal = n === m ? 1 : -1; // n==m com "−" daria campo zero (placa em branco)
    const field = new Float32Array(grid * grid);
    for (let y = 0; y < grid; y++) {
      const v = y / (grid - 1);
      for (let x = 0; x < grid; x++) {
        const u = x / (grid - 1);
        field[y * grid + x] = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) + sinal * Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
      }
    }
    return { field: field, N: grid };
  }
  function chladni(opts) {
    return fieldToSVG(chladniField(opts), { niveis: 3 + (+opts.linhas || 3) });
  }

  window.FIELD_GENERATORS = {
    reacaodifusao: reacaodifusao,
    geometriasagrada: geometriasagrada,
    campovetorial: campovetorial,
    quasicristal: quasicristal,
    chladni: chladni,
  };
})();
