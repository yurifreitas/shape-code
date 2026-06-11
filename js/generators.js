/*
 * generators.js — Geradores procedurais de desenhos vetoriais (SVG) para pintar.
 *
 * Cada gerador retorna uma STRING de SVG completa. Regiões pintáveis recebem a
 * classe "region" (fill branco). O app anexa cliques nelas para colorir.
 *
 * Tela padrão: 720 x 720 (quadrado, bom para impressão A4/A5 e tela).
 */
(function () {
  "use strict";

  const W = 720, H = 720;

  /* RNG determinístico (mulberry32) para que a mesma "semente" gere o mesmo desenho. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const n = (v) => Number(v).toFixed(2);

  /* Envolve o conteúdo em um SVG com fundo branco e estilo de linha-arte. */
  function wrap(inner, w, h) {
    w = w || W; h = h || H;
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
      '" width="' + w + '" height="' + h + '">' +
      '<rect class="bg" x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      '<g fill="#ffffff" stroke="#1b1b1b" stroke-width="2.4" ' +
      'stroke-linejoin="round" stroke-linecap="round">' +
      inner +
      "</g></svg>"
    );
  }

  const region = (d) => '<path class="region" d="' + d + '"/>';
  const ln = (x1, y1, x2, y2) => '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"/>';
  const poly = (pts) =>
    '<polygon class="region" points="' +
    pts.map((p) => n(p[0]) + "," + n(p[1])).join(" ") + '"/>';

  /* Setor de anel (célula entre dois raios e dois ângulos). */
  function ringCell(cx, cy, r0, r1, a0, a1) {
    const x = (a, r) => cx + Math.cos(a) * r;
    const y = (a, r) => cy + Math.sin(a) * r;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return (
      "M " + n(x(a0, r0)) + " " + n(y(a0, r0)) +
      " L " + n(x(a0, r1)) + " " + n(y(a0, r1)) +
      " A " + n(r1) + " " + n(r1) + " 0 " + large + " 1 " + n(x(a1, r1)) + " " + n(y(a1, r1)) +
      " L " + n(x(a1, r0)) + " " + n(y(a1, r0)) +
      " A " + n(r0) + " " + n(r0) + " 0 " + large + " 0 " + n(x(a0, r0)) + " Z"
    );
  }

  // ───────────────────────────── MANDALA ─────────────────────────────
  function mandala(opts) {
    const seed = opts.seed | 0;
    const r = rng(seed);
    const complexidade = +opts.complexidade || 3;
    const petalas = +opts.petalas || 10;
    const cx = W / 2, cy = H / 2;
    const aneis = 2 + complexidade;
    const parts = [];

    parts.push('<circle class="region" cx="' + cx + '" cy="' + cy + '" r="26"/>');

    const ringMax = 320;
    const step = (ringMax - 40) / aneis;
    for (let k = 0; k < aneis; k++) {
      const r0 = 36 + k * step;
      const r1 = r0 + step - 6;
      const segs = petalas * (k % 2 === 0 ? 1 : 1); // pétalas constantes p/ simetria
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        parts.push(region(ringCell(cx, cy, r0, r1, a0, a1)));
        // detalhe decorativo: pétala/ponto no meio da célula em anéis alternados
        const am = (a0 + a1) / 2;
        const rm = (r0 + r1) / 2;
        if (k % 2 === 1) {
          const px = cx + Math.cos(am) * rm;
          const py = cy + Math.sin(am) * rm;
          const rad = Math.min(step, ((a1 - a0) * rm)) * 0.22;
          parts.push('<circle class="region" cx="' + n(px) + '" cy="' + n(py) + '" r="' + n(Math.max(4, rad)) + '"/>');
        } else if (complexidade >= 3) {
          // pequenas pétalas radiais
          const p1x = cx + Math.cos(am) * r0, p1y = cy + Math.sin(am) * r0;
          const p2x = cx + Math.cos(am) * r1, p2y = cy + Math.sin(am) * r1;
          const ox = Math.cos(am + Math.PI / 2) * (step * 0.18);
          const oy = Math.sin(am + Math.PI / 2) * (step * 0.18);
          parts.push(region(
            "M " + n(p1x) + " " + n(p1y) +
            " Q " + n((p1x + p2x) / 2 + ox) + " " + n((p1y + p2y) / 2 + oy) + " " + n(p2x) + " " + n(p2y) +
            " Q " + n((p1x + p2x) / 2 - ox) + " " + n((p1y + p2y) / 2 - oy) + " " + n(p1x) + " " + n(p1y) + " Z"
          ));
        }
      }
    }
    // borda externa
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n(36 + aneis * step) + '" fill="none"/>');
    void r;
    return wrap(parts.join(""));
  }

  // ──────────────────────────── TESSELAÇÃO ───────────────────────────
  function tesselacao(opts) {
    const tipo = opts.tipo || "hexagonos";
    const densidade = +opts.densidade || 6;
    const parts = [];
    const m = 40; // margem
    const area = W - m * 2;

    if (tipo === "triangulos") {
      const cols = densidade + 2;
      const s = area / cols;
      const h = (s * Math.sqrt(3)) / 2;
      const rows = Math.ceil(area / h);
      for (let row = 0; row < rows; row++) {
        const y0 = m + row * h;
        const y1 = y0 + h;
        for (let col = 0; col < cols; col++) {
          const x0 = m + col * s + (row % 2 ? s / 2 : 0);
          // triângulo para cima
          parts.push(poly([[x0, y1], [x0 + s, y1], [x0 + s / 2, y0]]));
          // triângulo para baixo
          parts.push(poly([[x0 + s / 2, y0], [x0 + s + s / 2, y0], [x0 + s, y1]]));
        }
      }
    } else if (tipo === "losangos") {
      const cols = densidade + 1;
      const s = area / cols;
      const rows = Math.ceil(area / s);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = m + col * s + (row % 2 ? s / 2 : 0) + s / 2;
          const cy = m + row * s + s / 2;
          parts.push(poly([[cx, cy - s / 2], [cx + s / 2, cy], [cx, cy + s / 2], [cx - s / 2, cy]]));
        }
      }
    } else {
      // hexágonos
      const cols = densidade;
      const R = area / (cols * 1.5);
      const w = Math.sqrt(3) * R;
      const rows = Math.ceil(area / (R * 1.5)) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols + 1; col++) {
          const cx = m + col * w + (row % 2 ? w / 2 : 0);
          const cy = m + R + row * R * 1.5;
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 180) * (60 * i - 90);
            pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
          }
          if (cx > m - R && cx < W - m + R && cy < H - m + R) parts.push(poly(pts));
        }
      }
    }
    // moldura
    parts.push('<rect x="' + m + '" y="' + m + '" width="' + area + '" height="' + area + '" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ───────────────────────── HIPERESPAÇO (4D) ────────────────────────
  // Politopos regulares de 4 dimensões e variedades curvas (toro de Clifford,
  // fibração de Hopf) — projetados 4D→3D→2D. "Formas ao limite."
  const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  function rot4(v, i, j, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), r = v.slice();
    r[i] = v[i] * c - v[j] * s; r[j] = v[i] * s + v[j] * c;
    return r;
  }
  // Rotação dupla isoclínica (planos X-W e Y-Z) + perspectiva 4D→3D→2D.
  function project4D(v, t) {
    let p = rot4(v, 0, 3, t * Math.PI * 2);
    p = rot4(p, 1, 2, t * Math.PI * 2 * 0.62);
    const k4 = 1 / (2.5 - p[3]);
    const x = p[0] * k4, y = p[1] * k4, z = p[2] * k4;
    const k3 = 1 / (2.8 - z);
    return [x * k3, y * k3];
  }
  // Projeção estereográfica de S³ (para Clifford/Hopf) com giro.
  function stereo4(v, t) {
    let p = rot4(v, 0, 3, t * Math.PI * 2);
    p = rot4(p, 1, 2, t * Math.PI);
    const k = 1 / (1.25 - p[3]);
    const x = p[0] * k, y = p[1] * k, z = p[2] * k;
    const k3 = 1 / (2.6 - z);
    return [x * k3 * 0.62, y * k3 * 0.62];
  }

  // 4-simplex (5-célula): 5 vértices via embedding em R^5 → base ortonormal 4D.
  function cell5() {
    const nD = 5, e = [];
    for (let i = 0; i < nD; i++) { const v = [0, 0, 0, 0, 0]; v[i] = 1; e.push(v); }
    const c = 1 / nD;
    const sh = e.map((v) => v.map((x) => x - c));
    const basis = [];
    const dotN = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
    for (let i = 0; i < nD && basis.length < nD - 1; i++) {
      let u = sh[i].slice();
      for (const b of basis) { const d = dotN(u, b); u = u.map((x, k) => x - d * b[k]); }
      const nm = Math.sqrt(dotN(u, u));
      if (nm > 1e-9) basis.push(u.map((x) => x / nm));
    }
    const verts = sh.map((v) => basis.map((b) => dotN(v, b)));
    const faces = [];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let d = b + 1; d < 5; d++) faces.push([a, b, d]);
    return { verts: verts, faces: faces };
  }
  // 16-célula (hiperoctaedro): vértices ±e_i, 32 faces triangulares.
  function cell16() {
    const verts = [], idx = {};
    for (let a = 0; a < 4; a++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[a] = s; idx[a + "_" + s] = verts.length; verts.push(v); }
    const faces = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (let k = j + 1; k < 4; k++)
      for (const si of [1, -1]) for (const sj of [1, -1]) for (const sk of [1, -1])
        faces.push([idx[i + "_" + si], idx[j + "_" + sj], idx[k + "_" + sk]]);
    return { verts: verts, faces: faces };
  }
  // 24-célula: vértices = permutações de (±1,±1,0,0); faces = triângulos adjacentes.
  function cell24() {
    const verts = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (const si of [1, -1]) for (const sj of [1, -1]) {
      const v = [0, 0, 0, 0]; v[i] = si; v[j] = sj; verts.push(v);
    }
    const d2 = (a, b) => { let s = 0; for (let k = 0; k < 4; k++) { const d = a[k] - b[k]; s += d * d; } return s; };
    const faces = [];
    for (let a = 0; a < verts.length; a++) for (let b = a + 1; b < verts.length; b++) {
      if (d2(verts[a], verts[b]) !== 2) continue;
      for (let c = b + 1; c < verts.length; c++) if (d2(verts[a], verts[c]) === 2 && d2(verts[b], verts[c]) === 2) faces.push([a, b, c]);
    }
    return { verts: verts, faces: faces };
  }
  // Tesseract (8-célula): 16 vértices, 24 faces quadradas.
  function cell8() {
    const verts = [];
    for (let i = 0; i < 16; i++) verts.push([(i & 1 ? 1 : -1), (i & 2 ? 1 : -1), (i & 4 ? 1 : -1), (i & 8 ? 1 : -1)]);
    const faces = [];
    for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) {
      const diff = a ^ b; let bits = 0, d = diff; while (d) { bits += d & 1; d >>= 1; }
      if (bits !== 2) continue;
      const lo = diff & -diff, hi = diff ^ lo, c1 = a ^ lo, c2 = a ^ hi;
      if (a < c1 && a < c2 && a < b) faces.push([a, c1, b, c2]);
    }
    return { verts: verts, faces: faces };
  }
  // Toro de Clifford: (cosθ, sinθ, cosφ, sinφ)/√2 em S³ — malha de quadriláteros.
  function cliffordTorus() {
    const Nu = 12, Nv = 16, verts = [], grid = [];
    for (let i = 0; i < Nu; i++) {
      grid[i] = [];
      for (let j = 0; j < Nv; j++) {
        const u = (i / Nu) * Math.PI * 2, vv = (j / Nv) * Math.PI * 2;
        grid[i][j] = verts.length;
        verts.push([Math.cos(u) / Math.SQRT2, Math.sin(u) / Math.SQRT2, Math.cos(vv) / Math.SQRT2, Math.sin(vv) / Math.SQRT2]);
      }
    }
    const faces = [];
    for (let i = 0; i < Nu; i++) for (let j = 0; j < Nv; j++)
      faces.push([grid[i][j], grid[(i + 1) % Nu][j], grid[(i + 1) % Nu][(j + 1) % Nv], grid[i][(j + 1) % Nv]]);
    return { verts: verts, faces: faces, stereo: true };
  }

  function hiperespaco(opts) {
    const figura = opts.figura || "tesseract";
    const t = (+opts.rotacao || 30) / 100;
    const cx = W / 2, cy = H / 2, scale = 330;
    const parts = [];

    if (figura === "hopf") {
      // Fibração de Hopf: S³ → S². Cada fibra é um círculo (great circle) que,
      // projetado estereograficamente, vira um laço fechado pintável. Fibras
      // distribuídas pelo ângulo áureo.
      const golden = Math.PI * (3 - Math.sqrt(5));
      const fibras = 16, passos = 64;
      for (let f = 0; f < fibras; f++) {
        const eta = (0.12 + 0.76 * (f / fibras)) * (Math.PI / 2);
        const phi = f * golden;
        const pts = [];
        for (let s = 0; s <= passos; s++) {
          const a = (s / passos) * Math.PI * 2;
          const v = [Math.cos(eta) * Math.cos(a + phi), Math.cos(eta) * Math.sin(a + phi), Math.sin(eta) * Math.cos(a), Math.sin(eta) * Math.sin(a)];
          const p = stereo4(v, t);
          pts.push([cx + p[0] * scale, cy + p[1] * scale]);
        }
        let d = "M " + n(pts[0][0]) + " " + n(pts[0][1]);
        for (let i = 1; i < pts.length; i++) d += " L " + n(pts[i][0]) + " " + n(pts[i][1]);
        parts.push(region(d + " Z"));
      }
      return wrap(parts.join(""));
    }

    if (figura === "hipercubo-aninhado") {
      const squares = [1, 0.62, 0.34].map((s) => [[cx - s * 300, cy - s * 300], [cx + s * 300, cy - s * 300], [cx + s * 300, cy + s * 300], [cx - s * 300, cy + s * 300]]);
      for (let q = 0; q < squares.length - 1; q++) { const A = squares[q], B = squares[q + 1]; for (let i = 0; i < 4; i++) parts.push(poly([A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]])); }
      const c = squares[2], mid = [cx, cy];
      for (let i = 0; i < 4; i++) parts.push(poly([c[i], c[(i + 1) % 4], mid]));
      return wrap(parts.join(""));
    }

    const tabela = { "5-celula": cell5, "16-celula": cell16, "24-celula": cell24, "tesseract": cell8, "clifford": cliffordTorus };
    const M = (tabela[figura] || cell8)();
    const proj = M.stereo ? stereo4 : project4D;
    const pts = M.verts.map((v) => { const p = proj(v, t); return [cx + p[0] * scale, cy + p[1] * scale]; });
    M.faces.forEach((f) => parts.push(poly(f.map((i) => pts[i]))));
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="350" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ───────────────────────── ÁRVORE FRACTAL ──────────────────────────
  function fractal(opts) {
    const seed = opts.seed | 0;
    const r = rng(seed || 7);
    const profundidade = +opts.profundidade || 6;
    const abertura = ((+opts.angulo || 28) * Math.PI) / 180;
    const parts = [];
    // tronco como região (retângulo afilando)
    function branch(x, y, ang, len, depth, width) {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      // galho como quadrilátero fino (região pintável)
      const px = Math.cos(ang + Math.PI / 2) * width;
      const py = Math.sin(ang + Math.PI / 2) * width;
      const w2 = width * 0.7;
      const px2 = Math.cos(ang + Math.PI / 2) * w2;
      const py2 = Math.sin(ang + Math.PI / 2) * w2;
      parts.push(poly([[x + px, y + py], [x - px, y - py], [x2 - px2, y2 - py2], [x2 + px2, y2 + py2]]));
      if (depth <= 1) {
        // folha/flor
        const fr = 14 + r() * 10;
        if (r() > 0.4) {
          parts.push('<circle class="region" cx="' + n(x2) + '" cy="' + n(y2) + '" r="' + n(fr) + '"/>');
        } else {
          // florzinha de 5 pétalas
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            parts.push('<circle class="region" cx="' + n(x2 + Math.cos(a) * fr * 0.6) +
              '" cy="' + n(y2 + Math.sin(a) * fr * 0.6) + '" r="' + n(fr * 0.5) + '"/>');
          }
        }
        return;
      }
      const nl = len * (0.7 + r() * 0.08);
      branch(x2, y2, ang - abertura - (r() - 0.5) * 0.2, nl, depth - 1, w2);
      branch(x2, y2, ang + abertura + (r() - 0.5) * 0.2, nl, depth - 1, w2);
      if (depth > profundidade - 2 || r() > 0.6) {
        branch(x2, y2, ang + (r() - 0.5) * 0.3, nl * 0.9, depth - 1, w2);
      }
    }
    branch(W / 2, H - 30, -Math.PI / 2, 130, profundidade, 18);
    // chão
    parts.push('<path class="region" d="M 0 ' + (H - 24) + ' L ' + W + " " + (H - 24) +
      " L " + W + " " + H + " L 0 " + H + ' Z"/>');
    return wrap(parts.join(""));
  }

  // ───────────────────────── BORBOLETA SIMÉTRICA ─────────────────────
  // Simetria bilateral exata: cada motivo é desenhado dos dois lados a partir
  // dos MESMOS parâmetros (sorteados uma vez). Padrões: venação, ocelos em
  // sequência decrescente e escamas na borda.
  function borboleta(opts) {
    const r = rng((opts.seed | 0) || 1);
    const detalhe = +opts.detalhe || 4;
    const cx = W / 2, cy = H / 2;
    const parts = [];
    const mirror = (fn) => { parts.push(fn(1)); parts.push(fn(-1)); };

    // ---- corpo central (simétrico por construção) ----
    const bodyLen = 150, segs = 5 + detalhe;
    for (let i = 0; i < segs; i++) {
      const yy = cy - bodyLen * 0.5 + i * (bodyLen / segs);
      const rx = 15 * (1 - (Math.abs(i - segs / 2) / segs) * 0.6);
      parts.push('<ellipse class="region" cx="' + cx + '" cy="' + n(yy) + '" rx="' + n(rx) + '" ry="' + n((bodyLen / segs) * 0.62) + '"/>');
    }
    const headY = cy - bodyLen * 0.5 - 18;
    parts.push('<circle class="region" cx="' + cx + '" cy="' + n(headY) + '" r="18"/>');

    // ---- antenas ----
    const antL = 66 + r() * 34, antBend = 36 + r() * 30;
    mirror((s) =>
      '<path fill="none" d="M ' + n(cx + s * 6) + " " + n(headY - 10) + " Q " + n(cx + s * antBend) + " " + n(headY - 70) + " " + n(cx + s * antL) + " " + n(headY - 96) + '"/>' +
      '<circle class="region" cx="' + n(cx + s * antL) + '" cy="' + n(headY - 96) + '" r="6"/>');

    // ---- asas (parâmetros sorteados UMA vez → simetria perfeita) ----
    const uwx = 180 + r() * 70, uwy = 210 + r() * 60, ucurl = 120 + r() * 40;
    const lwx = 130 + r() * 60, lwy = 205 + r() * 55, recorte = r() > 0.4;
    mirror((s) => region(
      "M " + n(cx) + " " + n(cy - 80) +
      " C " + n(cx + s * uwx) + " " + n(cy - uwy) + " " + n(cx + s * (uwx + 90)) + " " + n(cy - ucurl) + " " + n(cx + s * (uwx - 30)) + " " + n(cy - 30) +
      (recorte ? " Q " + n(cx + s * (uwx - 70)) + " " + n(cy - 4) + " " + n(cx + s * 70) + " " + n(cy - 18) : " C " + n(cx + s * 90) + " " + n(cy - 10) + " " + n(cx + s * 30) + " " + n(cy - 40)) +
      " " + n(cx) + " " + n(cy - 80) + " Z"));
    mirror((s) => region(
      "M " + n(cx) + " " + n(cy + 12) +
      " C " + n(cx + s * lwx) + " " + n(cy + 40) + " " + n(cx + s * (lwx + 30)) + " " + n(cy + lwy) + " " + n(cx + s * 90) + " " + n(cy + lwy + 20) +
      " C " + n(cx + s * 40) + " " + n(cy + lwy + 10) + " " + n(cx + s * 20) + " " + n(cy + 90) + " " + n(cx) + " " + n(cy + 12) + " Z"));

    // ---- venação ----
    const veins = 2 + detalhe;
    mirror((s) => { let o = ""; for (let i = 0; i < veins; i++) { const a = i / (veins - 1 || 1); o += ln(cx + s * 10, cy - 64, cx + s * (56 + a * uwx), cy - uwy * 0.42 - a * 56); } return o; });

    // ---- ocelos da asa superior (raio decrescente, com íris) ----
    const oc = 2 + detalhe;
    mirror((s) => { let o = ""; for (let i = 0; i < oc; i++) { const x = cx + s * (74 + i * 34), y = cy - 150 + i * 30, rad = 22 - i * 2.4; o += '<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(Math.max(4, rad)) + '"/>'; if (rad > 10) o += '<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(rad * 0.45) + '"/>'; } return o; });
    // ocelos da asa inferior
    mirror((s) => { let o = ""; const m = Math.max(2, detalhe - 1); for (let i = 0; i < m; i++) { const x = cx + s * (55 + i * 30), y = cy + 104 + i * 30; o += '<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(Math.max(4, 16 - i * 1.6)) + '"/>'; } return o; });

    // ---- escamas na borda da asa superior ----
    if (detalhe >= 4) mirror((s) => { let o = ""; const k = 4 + detalhe; for (let i = 0; i < k; i++) { const a = (i + 0.5) / k; o += '<circle class="region" cx="' + n(cx + s * (uwx * 0.45 + a * uwx * 0.5)) + '" cy="' + n(cy - uwy * 0.55 + a * uwy * 0.35) + '" r="6"/>'; } return o; });

    return wrap(parts.join(""));
  }

  // ──────────────────────────── MONTAR CENA ──────────────────────────
  const elementos = {
    sol: (x, y, s) => {
      let o = '<circle class="region" cx="' + x + '" cy="' + y + '" r="' + 40 * s + '"/>';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x1 = x + Math.cos(a) * 50 * s, y1 = y + Math.sin(a) * 50 * s;
        const x2 = x + Math.cos(a) * 78 * s, y2 = y + Math.sin(a) * 78 * s;
        o += '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"/>';
      }
      return o;
    },
    nuvem: (x, y, s) =>
      region("M " + n(x - 60 * s) + " " + n(y) +
        " a " + n(30 * s) + " " + n(30 * s) + " 0 0 1 " + n(40 * s) + " " + n(-26 * s) +
        " a " + n(34 * s) + " " + n(34 * s) + " 0 0 1 " + n(60 * s) + " " + n(4 * s) +
        " a " + n(26 * s) + " " + n(26 * s) + " 0 0 1 " + n(20 * s) + " " + n(22 * s) +
        " Z"),
    montanha: (x, y, s) =>
      poly([[x - 110 * s, y], [x - 30 * s, y - 130 * s], [x + 20 * s, y - 60 * s], [x + 60 * s, y - 150 * s], [x + 130 * s, y]]),
    casa: (x, y, s) => {
      let o = poly([[x - 70 * s, y], [x - 70 * s, y - 80 * s], [x + 70 * s, y - 80 * s], [x + 70 * s, y]]); // parede
      o += poly([[x - 85 * s, y - 80 * s], [x, y - 150 * s], [x + 85 * s, y - 80 * s]]); // telhado
      o += '<rect class="region" x="' + n(x - 25 * s) + '" y="' + n(y - 55 * s) + '" width="' + n(50 * s) + '" height="' + n(55 * s) + '"/>'; // porta
      o += '<rect class="region" x="' + n(x + 30 * s) + '" y="' + n(y - 70 * s) + '" width="' + n(30 * s) + '" height="' + n(30 * s) + '"/>'; // janela
      return o;
    },
    arvore: (x, y, s) => {
      let o = '<rect class="region" x="' + n(x - 14 * s) + '" y="' + n(y - 70 * s) + '" width="' + n(28 * s) + '" height="' + n(70 * s) + '"/>';
      o += '<circle class="region" cx="' + n(x) + '" cy="' + n(y - 110 * s) + '" r="' + n(60 * s) + '"/>';
      o += '<circle class="region" cx="' + n(x - 45 * s) + '" cy="' + n(y - 80 * s) + '" r="' + n(38 * s) + '"/>';
      o += '<circle class="region" cx="' + n(x + 45 * s) + '" cy="' + n(y - 80 * s) + '" r="' + n(38 * s) + '"/>';
      return o;
    },
    flor: (x, y, s) => {
      let o = "";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        o += '<circle class="region" cx="' + n(x + Math.cos(a) * 26 * s) + '" cy="' + n(y + Math.sin(a) * 26 * s) + '" r="' + n(20 * s) + '"/>';
      }
      o += '<circle class="region" cx="' + x + '" cy="' + y + '" r="' + 18 * s + '"/>';
      o += '<line x1="' + x + '" y1="' + n(y + 40 * s) + '" x2="' + x + '" y2="' + n(y + 140 * s) + '"/>';
      return o;
    },
    gato: (x, y, s) => {
      let o = '<circle class="region" cx="' + x + '" cy="' + y + '" r="' + 55 * s + '"/>'; // cabeça
      o += poly([[x - 50 * s, y - 35 * s], [x - 20 * s, y - 75 * s], [x - 12 * s, y - 35 * s]]); // orelha
      o += poly([[x + 50 * s, y - 35 * s], [x + 20 * s, y - 75 * s], [x + 12 * s, y - 35 * s]]); // orelha
      o += '<circle class="region" cx="' + n(x - 20 * s) + '" cy="' + n(y - 8 * s) + '" r="' + n(8 * s) + '"/>';
      o += '<circle class="region" cx="' + n(x + 20 * s) + '" cy="' + n(y - 8 * s) + '" r="' + n(8 * s) + '"/>';
      o += poly([[x, y + 6 * s], [x - 8 * s, y + 16 * s], [x + 8 * s, y + 16 * s]]); // nariz
      return o;
    },
    peixe: (x, y, s) => {
      let o = '<ellipse class="region" cx="' + x + '" cy="' + y + '" rx="' + 70 * s + '" ry="' + 40 * s + '"/>';
      o += poly([[x + 60 * s, y], [x + 110 * s, y - 35 * s], [x + 110 * s, y + 35 * s]]); // cauda
      o += '<circle class="region" cx="' + n(x - 35 * s) + '" cy="' + n(y - 8 * s) + '" r="' + n(8 * s) + '"/>';
      return o;
    },
    estrela: (x, y, s) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 22 * s : 52 * s;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      return poly(pts);
    },
    passaro: (x, y, s) => {
      let o = '<ellipse class="region" cx="' + x + '" cy="' + y + '" rx="' + 42 * s + '" ry="' + 30 * s + '"/>'; // corpo
      o += '<circle class="region" cx="' + n(x + 38 * s) + '" cy="' + n(y - 18 * s) + '" r="' + n(20 * s) + '"/>'; // cabeça
      o += poly([[x + 55 * s, y - 22 * s], [x + 80 * s, y - 16 * s], [x + 55 * s, y - 8 * s]]); // bico
      o += poly([[x - 40 * s, y], [x - 80 * s, y - 24 * s], [x - 60 * s, y + 16 * s]]); // cauda
      o += region("M " + n(x - 6 * s) + " " + n(y - 6 * s) + " q " + n(20 * s) + " " + n(-30 * s) + " " + n(40 * s) + " 0 q " + n(-20 * s) + " " + n(18 * s) + " " + n(-40 * s) + " 0 Z"); // asa
      return o;
    },
  };

  // Compositor procedural infinito vive em elements.js (window.composeCena).
  function cena(opts) {
    if (window.composeCena) return window.composeCena(opts);
    return cenaSimples(opts);
  }

  function cenaSimples(opts) {
    const sel = (opts.elementos && opts.elementos.length) ? opts.elementos : ["sol", "casa", "arvore", "flor"];
    const parts = [];
    // linha do chão
    const chao = H - 130;
    parts.push('<line x1="0" y1="' + chao + '" x2="' + W + '" y2="' + chao + '"/>');

    // posicionamento simples: céu (sol/nuvem/estrela/passaro) e solo (resto)
    const ceu = ["sol", "nuvem", "estrela", "passaro"];
    const noCeu = sel.filter((e) => ceu.includes(e));
    const noChao = sel.filter((e) => !ceu.includes(e));

    noCeu.forEach((e, i) => {
      const x = 120 + (i * (W - 240)) / Math.max(1, noCeu.length - 1 || 1);
      parts.push(elementos[e](noCeu.length === 1 ? W / 2 : x, 130, 1));
    });
    noChao.forEach((e, i) => {
      const x = 130 + (i * (W - 260)) / Math.max(1, noChao.length - 1 || 1);
      const s = e === "flor" || e === "gato" || e === "peixe" ? 0.9 : 1;
      parts.push(elementos[e](noChao.length === 1 ? W / 2 : x, chao - 4, s));
    });
    // moldura
    parts.push('<rect x="14" y="14" width="' + (W - 28) + '" height="' + (H - 28) + '" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ──────────────────────────── CALEIDOSCÓPIO ────────────────────────
  // Formas aleatórias num setor, replicadas por rotação + reflexão → simetria.
  function ngon(cx, cy, rad, lados, rot) {
    const pts = [];
    for (let i = 0; i < lados; i++) {
      const a = rot + (i / lados) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    return poly(pts);
  }
  function caleidoscopio(opts) {
    const r = rng((opts.seed | 0) || 1);
    const sym = +opts.simetria || 8;
    const cx = W / 2, cy = H / 2, maxR = 320;
    const wedge = (Math.PI * 2) / sym;
    const nShapes = 4 + Math.floor(r() * 6);
    const shapes = [];
    for (let i = 0; i < nShapes; i++) {
      shapes.push({
        ang: r() * wedge,
        rr: 26 + r() * (maxR - 50),
        size: 10 + r() * 42,
        type: Math.floor(r() * 3),
        lados: 3 + Math.floor(r() * 5),
        rot: r() * Math.PI,
      });
    }
    const parts = [];
    parts.push('<circle class="region" cx="' + cx + '" cy="' + cy + '" r="' + n(18 + r() * 18) + '"/>');
    for (let k = 0; k < sym; k++) {
      const base = k * wedge;
      for (let mir = 0; mir < 2; mir++) {
        shapes.forEach((sh) => {
          const a = base + (mir ? wedge - sh.ang : sh.ang);
          const x = cx + Math.cos(a) * sh.rr, y = cy + Math.sin(a) * sh.rr;
          if (sh.type === 0) parts.push('<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(sh.size) + '"/>');
          else if (sh.type === 1) parts.push(ngon(x, y, sh.size, sh.lados, a + sh.rot));
          else parts.push(region("M " + n(x) + " " + n(y) + " m " + n(-sh.size) + " 0 a " + n(sh.size) + " " + n(sh.size) + " 0 0 1 " + n(sh.size * 2) + " 0 Z"));
        });
      }
    }
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (maxR + 20) + '" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ──────────────────────────────── ROSETA ───────────────────────────
  // Camadas concêntricas de pétalas (gota) — rosácea infinita.
  function roseta(opts) {
    const r = rng((opts.seed | 0) || 1);
    const cx = W / 2, cy = H / 2;
    const petalas = +opts.petalas || 10;
    const camadas = +opts.camadas || 4;
    const parts = [];
    const maxR = 320;
    for (let c = camadas - 1; c >= 0; c--) {
      const rOut = 70 + (c / Math.max(1, camadas - 1)) * (maxR - 70);
      const rIn = c === 0 ? 0 : 70 + ((c - 1) / Math.max(1, camadas - 1)) * (maxR - 70);
      const offset = (c % 2) * (Math.PI / petalas);
      const wid = (Math.PI / petalas) * (0.7 + r() * 0.5);
      for (let i = 0; i < petalas; i++) {
        const a = offset + (i / petalas) * Math.PI * 2;
        const tip = [cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut];
        const b1 = [cx + Math.cos(a - wid) * (rIn + (rOut - rIn) * 0.5), cy + Math.sin(a - wid) * (rIn + (rOut - rIn) * 0.5)];
        const b2 = [cx + Math.cos(a + wid) * (rIn + (rOut - rIn) * 0.5), cy + Math.sin(a + wid) * (rIn + (rOut - rIn) * 0.5)];
        const base = [cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn];
        parts.push(region(
          "M " + n(base[0]) + " " + n(base[1]) +
          " Q " + n(b1[0]) + " " + n(b1[1]) + " " + n(tip[0]) + " " + n(tip[1]) +
          " Q " + n(b2[0]) + " " + n(b2[1]) + " " + n(base[0]) + " " + n(base[1]) + " Z"
        ));
      }
    }
    parts.push('<circle class="region" cx="' + cx + '" cy="' + cy + '" r="28"/>');
    return wrap(parts.join(""));
  }

  // ─────────────────────── SUPERFÓRMULA (Gielis) ─────────────────────
  // r(θ) = (|cos(mθ/4)|^n2 + |sin(mθ/4)|^n3)^(−1/n1) — uma equação que gera
  // flores, estrelas, polígonos e formas orgânicas. Cada camada é pintável.
  function polarRegion(radiusFn, steps, target, rot) {
    const cx = W / 2, cy = H / 2, rs = [];
    let maxR = 0;
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      let rr = radiusFn(th);
      if (!isFinite(rr) || rr < 0) rr = 0;
      rs.push([th, rr]); if (rr > maxR) maxR = rr;
    }
    const f = maxR > 0 ? target / maxR : 1;
    let d = "";
    rs.forEach((p, i) => { d += (i ? " L " : "M ") + n(cx + Math.cos(p[0] + rot) * p[1] * f) + " " + n(cy + Math.sin(p[0] + rot) * p[1] * f); });
    return region(d + " Z");
  }
  function superformula(opts) {
    const r = rng((opts.seed | 0) || 1);
    const m = +opts.simetria || 6;
    const n1 = (+opts.forma || 4) / 10; // 0.2 .. 1.2
    const camadas = +opts.camadas || 4;
    const parts = [];
    for (let c = 0; c < camadas; c++) {
      const n2 = 0.3 + r() * 1.6, n3 = 0.3 + r() * 1.6;
      const target = 320 * (1 - c / (camadas + 0.6));
      parts.push(polarRegion((th) => {
        const t = (m * th) / 4;
        const part = Math.pow(Math.abs(Math.cos(t)), n2) + Math.pow(Math.abs(Math.sin(t)), n3);
        return Math.pow(part, -1 / n1);
      }, 260, target, c * 0.18));
    }
    parts.push('<circle class="region" cx="' + W / 2 + '" cy="' + H / 2 + '" r="22"/>');
    return wrap(parts.join(""));
  }

  // ─────────────────────────── ESPIRÓGRAFO ───────────────────────────
  // Hipotrocoide: x=a·cosθ + d·cos(aθ), y=a·sinθ − d·sin(aθ). Curvas fechadas
  // em pétalas — cada camada é uma região pintável.
  function paramRegion(ptFn, steps, target, rot) {
    const cx = W / 2, cy = H / 2, ps = [];
    let maxR = 0;
    for (let i = 0; i <= steps; i++) {
      const p = ptFn((i / steps) * Math.PI * 2), rr = Math.hypot(p[0], p[1]);
      if (rr > maxR) maxR = rr; ps.push(p);
    }
    const f = maxR > 0 ? target / maxR : 1, cr = Math.cos(rot), sr = Math.sin(rot);
    let d = "";
    ps.forEach((p, i) => { const x = p[0] * f, y = p[1] * f; d += (i ? " L " : "M ") + n(cx + x * cr - y * sr) + " " + n(cy + x * sr + y * cr); });
    return region(d + " Z");
  }
  function espirografo(opts) {
    const r = rng((opts.seed | 0) || 1);
    const lobos = +opts.lobos || 6;
    const prof = (+opts.profundidade || 5) / 10;
    const camadas = +opts.camadas || 4;
    const parts = [];
    for (let c = 0; c < camadas; c++) {
      const a = lobos - 1 + c;
      const d = prof * a * (0.7 + r() * 0.5);
      const target = 320 * (1 - c / (camadas + 1));
      parts.push(paramRegion((th) => [a * Math.cos(th) + d * Math.cos(a * th), a * Math.sin(th) - d * Math.sin(a * th)], 420, target, c * 0.12));
    }
    return wrap(parts.join(""));
  }

  // ═══════════ ESTADO DA ARTE: algoritmos clássicos de arte generativa ═══════════

  // Recorte de polígono por semiplano (Sutherland–Hodgman). Mantém o lado cujo
  // produto escalar com a normal é ≥ 0.
  function clipHP(pol, px, py, nx, ny) {
    const out = [];
    for (let i = 0; i < pol.length; i++) {
      const A = pol[i], B = pol[(i + 1) % pol.length];
      const da = (A[0] - px) * nx + (A[1] - py) * ny;
      const db = (B[0] - px) * nx + (B[1] - py) * ny;
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
    }
    return out;
  }
  function centroide(pol) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pol.length; i++) {
      const A = pol[i], B = pol[(i + 1) % pol.length], cr = A[0] * B[1] - B[0] * A[1];
      a += cr; cx += (A[0] + B[0]) * cr; cy += (A[1] + B[1]) * cr;
    }
    if (Math.abs(a) < 1e-6) { let mx = 0, my = 0; pol.forEach((p) => { mx += p[0]; my += p[1]; }); return [mx / pol.length, my / pol.length]; }
    return [cx / (3 * a), cy / (3 * a)];
  }

  // ───────────────── VITRAL (Voronoi + relaxação de Lloyd) ────────────────
  function vitral(opts) {
    const r = rng((opts.seed | 0) || 1);
    const N = +opts.celulas || 28, relax = +opts.relaxar || 2, pad = 18;
    const box = [[pad, pad], [W - pad, pad], [W - pad, H - pad], [pad, H - pad]];
    let sites = [];
    for (let i = 0; i < N; i++) sites.push([pad + r() * (W - 2 * pad), pad + r() * (H - 2 * pad)]);
    const cellFor = (s) => {
      let cell = box.map((p) => p.slice());
      for (const t of sites) {
        if (t === s) continue;
        const mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
        cell = clipHP(cell, mx, my, s[0] - t[0], s[1] - t[1]);
        if (cell.length < 3) break;
      }
      return cell;
    };
    for (let pass = 0; pass < relax; pass++) sites = sites.map((s) => centroide(cellFor(s))); // Lloyd
    const parts = [];
    sites.forEach((s) => { const c = cellFor(s); if (c.length >= 3) parts.push(poly(c)); });
    return wrap(parts.join(""));
  }

  // ───────────────── LOW-POLY (Delaunay, Bowyer–Watson) ───────────────────
  function delaunay(pts) {
    const big = 1e6;
    const P = pts.concat([[-big, -big], [big * 2, -big], [-big, big * 2]]);
    const sup = pts.length;
    let tris = [[sup, sup + 1, sup + 2]];
    const circum = (a, b, c) => {
      const ax = P[a][0], ay = P[a][1], bx = P[b][0], by = P[b][1], cx = P[c][0], cy = P[c][1];
      const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      if (Math.abs(d) < 1e-9) return null;
      const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
      const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
      const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
      return { x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
    };
    for (let i = 0; i < pts.length; i++) {
      const bad = [], edges = {};
      tris = tris.filter((t) => {
        const cc = circum(t[0], t[1], t[2]);
        const inside = cc && (P[i][0] - cc.x) * (P[i][0] - cc.x) + (P[i][1] - cc.y) * (P[i][1] - cc.y) <= cc.r2 + 1e-6;
        if (inside) { bad.push(t); return false; }
        return true;
      });
      bad.forEach((t) => { [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach((e) => { const k = Math.min(e[0], e[1]) + "_" + Math.max(e[0], e[1]); edges[k] = edges[k] ? edges[k] + 1 : 1; edges[k + "v"] = e; }); });
      Object.keys(edges).forEach((k) => { if (k.endsWith("v") || edges[k] !== 1) return; const e = edges[k + "v"]; tris.push([e[0], e[1], i]); });
    }
    return tris.filter((t) => t[0] < sup && t[1] < sup && t[2] < sup);
  }
  function lowpoly(opts) {
    const r = rng((opts.seed | 0) || 1);
    const N = +opts.pontos || 40, pad = 6;
    const pts = [[pad, pad], [W - pad, pad], [W - pad, H - pad], [pad, H - pad]];
    for (let i = 1; i < 6; i++) { pts.push([pad + (i / 6) * (W - 2 * pad), pad]); pts.push([pad + (i / 6) * (W - 2 * pad), H - pad]); pts.push([pad, pad + (i / 6) * (H - 2 * pad)]); pts.push([W - pad, pad + (i / 6) * (H - 2 * pad)]); }
    for (let i = 0; i < N; i++) pts.push([30 + r() * (W - 60), 30 + r() * (H - 60)]);
    const parts = delaunay(pts).map((t) => poly([pts[t[0]], pts[t[1]], pts[t[2]]]));
    return wrap(parts.join(""));
  }

  // ──────────────────────────── TRUCHET ──────────────────────────────────
  function truchet(opts) {
    const r = rng((opts.seed | 0) || 1);
    const g = +opts.grade || 8, tipo = opts.tipo || "arcos", pad = 20;
    const size = (W - 2 * pad) / g, R = size / 2;
    const parts = [];
    const arc = (x1, y1, x2, y2, sweep) => "A " + n(R) + " " + n(R) + " 0 0 " + sweep + " " + n(x2) + " " + n(y2);
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const x = pad + i * size, y = pad + j * size, tA = r() < 0.5;
      if (tipo === "diagonais") {
        if (tA) { parts.push(poly([[x, y], [x + size, y], [x + size, y + size]])); parts.push(poly([[x, y], [x + size, y + size], [x, y + size]])); }
        else { parts.push(poly([[x, y], [x + size, y], [x, y + size]])); parts.push(poly([[x + size, y], [x + size, y + size], [x, y + size]])); }
      } else {
        if (tA) {
          parts.push(region("M " + n(x) + " " + n(y) + " L " + n(x + R) + " " + n(y) + " " + arc(x + R, y, x, y + R, 1) + " Z"));
          parts.push(region("M " + n(x + size) + " " + n(y + size) + " L " + n(x + size - R) + " " + n(y + size) + " " + arc(x + size - R, y + size, x + size, y + size - R, 1) + " Z"));
          parts.push(region("M " + n(x + R) + " " + n(y) + " L " + n(x + size) + " " + n(y) + " L " + n(x + size) + " " + n(y + size - R) + " " + arc(x + size, y + size - R, x + size - R, y + size, 0) + " L " + n(x) + " " + n(y + size) + " L " + n(x) + " " + n(y + R) + " " + arc(x, y + R, x + R, y, 0) + " Z"));
        } else {
          parts.push(region("M " + n(x + size) + " " + n(y) + " L " + n(x + size - R) + " " + n(y) + " " + arc(x + size - R, y, x + size, y + R, 0) + " Z"));
          parts.push(region("M " + n(x) + " " + n(y + size) + " L " + n(x + R) + " " + n(y + size) + " " + arc(x + R, y + size, x, y + size - R, 0) + " Z"));
          parts.push(region("M " + n(x + size - R) + " " + n(y) + " L " + n(x) + " " + n(y) + " L " + n(x) + " " + n(y + size - R) + " " + arc(x, y + size - R, x + R, y + size, 1) + " L " + n(x + size) + " " + n(y + size) + " L " + n(x + size) + " " + n(y + R) + " " + arc(x + size, y + R, x + size - R, y, 1) + " Z"));
        }
      }
    }
    parts.push('<rect x="' + pad + '" y="' + pad + '" width="' + (size * g) + '" height="' + (size * g) + '" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ─────────────── EMPACOTAMENTO DE CÍRCULOS (Apollonian) ─────────────────
  function circulos(opts) {
    const r = rng((opts.seed | 0) || 1);
    const alvo = +opts.quantidade || 160, pad = 14, minR = 5, maxR = 130, tries = alvo * 18;
    const placed = [];
    for (let t = 0; t < tries && placed.length < alvo; t++) {
      const x = pad + r() * (W - 2 * pad), y = pad + r() * (H - 2 * pad);
      let m = Math.min(x - pad, W - pad - x, y - pad, H - pad - y);
      for (const c of placed) { const dd = Math.hypot(x - c[0], y - c[1]) - c[2]; if (dd < m) m = dd; }
      if (m >= minR) placed.push([x, y, Math.min(maxR, m)]);
    }
    const parts = [];
    placed.forEach((c) => {
      parts.push('<circle class="region" cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + n(c[2]) + '"/>');
      if (c[2] > 26) parts.push('<circle class="region" cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + n(c[2] * 0.55) + '"/>');
      if (c[2] > 60) parts.push('<circle class="region" cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + n(c[2] * 0.26) + '"/>');
    });
    return wrap(parts.join(""));
  }

  // ───────────────── PENROSE (ladrilhamento P3 por deflação) ──────────────
  function penrose(opts) {
    const depth = +opts.profundidade || 5;
    const phi = (1 + Math.sqrt(5)) / 2, ig = 1 / phi;
    const cx = W / 2, cy = H / 2, scale = 380, rot = ((+opts.seed || 0) % 36) * Math.PI / 180;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let tris = [];
    for (let i = 0; i < 10; i++) {
      let b = [Math.cos((2 * i - 1) * Math.PI / 10), Math.sin((2 * i - 1) * Math.PI / 10)];
      let c = [Math.cos((2 * i + 1) * Math.PI / 10), Math.sin((2 * i + 1) * Math.PI / 10)];
      if (i % 2 === 0) { const tmp = b; b = c; c = tmp; }
      tris.push([0, [0, 0], b, c]);
    }
    for (let d = 0; d < depth; d++) {
      const res = [];
      for (const tr of tris) {
        const col = tr[0], A = tr[1], B = tr[2], C = tr[3];
        if (col === 0) { const P = lerp(A, B, ig); res.push([0, C, P, B]); res.push([1, P, C, A]); }
        else { const Q = lerp(B, A, ig), Rr = lerp(B, C, ig); res.push([1, Rr, C, A]); res.push([1, Q, Rr, B]); res.push([0, Rr, Q, A]); }
      }
      tris = res;
    }
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const T = (p) => [cx + (p[0] * cr - p[1] * sr) * scale, cy + (p[0] * sr + p[1] * cr) * scale];
    const parts = tris.map((tr) => poly([T(tr[1]), T(tr[2]), T(tr[3])]));
    return wrap(parts.join(""));
  }

  // ───────────────── FORMAS SIMPLES E CURVAS (p/ os laços) ────────────────
  function forma(opts) {
    const tipo = opts.tipo || "circulo";
    const R = 210 * ((+opts.tamanho || 100) / 100);
    const cx = W / 2, cy = H / 2;
    const circ = (x, y, r) => '<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '"/>';
    let o = "";
    if (tipo === "circulo") o = circ(cx, cy, R);
    else if (tipo === "quadrado") { const s = R * 0.85; o = '<rect class="region" x="' + n(cx - s) + '" y="' + n(cy - s) + '" width="' + n(2 * s) + '" height="' + n(2 * s) + '"/>'; }
    else if (tipo === "triangulo") o = ngon(cx, cy, R, 3, -Math.PI / 2);
    else if (tipo === "hexagono") o = ngon(cx, cy, R, 6, -Math.PI / 2);
    else if (tipo === "estrela") { const p = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R * 0.42 : R; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } o = poly(p); }
    else if (tipo === "coracao") o = region("M " + n(cx) + " " + n(cy + R * 0.62) + " C " + n(cx - R) + " " + n(cy - R * 0.1) + " " + n(cx - R * 0.5) + " " + n(cy - R * 0.85) + " " + n(cx) + " " + n(cy - R * 0.25) + " C " + n(cx + R * 0.5) + " " + n(cy - R * 0.85) + " " + n(cx + R) + " " + n(cy - R * 0.1) + " " + n(cx) + " " + n(cy + R * 0.62) + " Z");
    else if (tipo === "gota") o = region("M " + n(cx) + " " + n(cy - R) + " C " + n(cx + R * 0.9) + " " + n(cy - R * 0.1) + " " + n(cx + R * 0.6) + " " + n(cy + R * 0.7) + " " + n(cx) + " " + n(cy + R * 0.7) + " C " + n(cx - R * 0.6) + " " + n(cy + R * 0.7) + " " + n(cx - R * 0.9) + " " + n(cy - R * 0.1) + " " + n(cx) + " " + n(cy - R) + " Z");
    else if (tipo === "folha") o = region("M " + n(cx) + " " + n(cy + R) + " C " + n(cx - R * 0.8) + " " + n(cy) + " " + n(cx - R * 0.5) + " " + n(cy - R) + " " + n(cx) + " " + n(cy - R) + " C " + n(cx + R * 0.5) + " " + n(cy - R) + " " + n(cx + R * 0.8) + " " + n(cy) + " " + n(cx) + " " + n(cy + R) + " Z") + ln(cx, cy + R, cx, cy - R);
    else if (tipo === "flor") { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; o += circ(cx + Math.cos(a) * R * 0.52, cy + Math.sin(a) * R * 0.52, R * 0.42); } o += circ(cx, cy, R * 0.34); }
    else if (tipo === "anel") o = circ(cx, cy, R) + circ(cx, cy, R * 0.5);
    else if (tipo === "onda") {
      const x0 = cx - R, w = 2 * R, steps = 14; let d = "M " + n(x0) + " " + n(cy);
      for (let i = 0; i <= steps; i++) d += " L " + n(x0 + (i / steps) * w) + " " + n(cy + Math.sin((i / steps) * Math.PI * 4) * R * 0.28);
      for (let i = steps; i >= 0; i--) d += " L " + n(x0 + (i / steps) * w) + " " + n(cy + R * 0.45 + Math.sin((i / steps) * Math.PI * 4) * R * 0.28);
      o = region(d + " Z");
    } else o = circ(cx, cy, R);
    return wrap(o);
  }

  // ───────────────── PADRÃO ISLÂMICO (estrelas geométricas) ─────────────────
  // Malha de estrelas de 8 pontas + losangos — geometria sagrada islâmica.
  function islamico(opts) {
    const g = +opts.grade || 5, pad = 28;
    const cell = (W - 2 * pad) / g, parts = [];
    const estrela = (cx, cy, R) => {
      const pts = [];
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8 - Math.PI / 2; const rr = (k % 2) ? R * 0.42 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      return pts;
    };
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const cx = pad + cell * (i + 0.5), cy = pad + cell * (j + 0.5), R = cell * 0.5;
      parts.push(poly(estrela(cx, cy, R)));
      parts.push(poly(estrela(cx, cy, R * 0.5))); // estrela interna
      parts.push('<circle class="region" cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(R * 0.16) + '"/>');
    }
    // losangos nas interseções da grade
    for (let i = 1; i < g; i++) for (let j = 1; j < g; j++) {
      const cx = pad + cell * i, cy = pad + cell * j, s = cell * 0.2;
      parts.push(poly([[cx, cy - s], [cx + s, cy], [cx, cy + s], [cx - s, cy]]));
    }
    parts.push('<rect x="' + pad + '" y="' + pad + '" width="' + (cell * g) + '" height="' + (cell * g) + '" fill="none"/>');
    return wrap(parts.join(""));
  }

  // ───────────────── SISTEMA-L (Lindenmayer) — plantas fractais ─────────────────
  function lsystem(opts) {
    const sistemas = {
      samambaia: { axiom: "X", regras: { X: "F-[[X]+X]+F[+FX]-X", F: "FF" }, ang: 22 },
      arbusto: { axiom: "F", regras: { F: "FF+[+F-F-F]-[-F+F+F]" }, ang: 23 },
      erva: { axiom: "F", regras: { F: "F[+F]F[-F][F]" }, ang: 25 },
    };
    const s = sistemas[opts.tipo] || sistemas.samambaia;
    const it = Math.max(1, +opts.iteracoes || 4);
    let str = s.axiom;
    for (let i = 0; i < it; i++) { let nx = ""; for (let c = 0; c < str.length; c++) nx += s.regras[str[c]] || str[c]; str = nx; if (str.length > 120000) break; }
    const segs = [], folhas = [], st = [];
    let x = 0, y = 0, ang = -90; const step = 8, rad = (d) => (d * Math.PI) / 180;
    for (let c = 0; c < str.length; c++) {
      const ch = str[c];
      if (ch === "F") { const x2 = x + Math.cos(rad(ang)) * step, y2 = y + Math.sin(rad(ang)) * step; segs.push([x, y, x2, y2, Math.max(1.5, 8 - st.length)]); x = x2; y = y2; if (segs.length > 4000) break; }
      else if (ch === "+") ang += s.ang;
      else if (ch === "-") ang -= s.ang;
      else if (ch === "[") st.push([x, y, ang]);
      else if (ch === "]") { folhas.push([x, y]); const p = st.pop(); if (p) { x = p[0]; y = p[1]; ang = p[2]; } }
    }
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    const upd = (px, py) => { if (px < mnx) mnx = px; if (px > mxx) mxx = px; if (py < mny) mny = py; if (py > mxy) mxy = py; };
    segs.forEach((g) => { upd(g[0], g[1]); upd(g[2], g[3]); }); folhas.forEach((p) => upd(p[0], p[1]));
    const bw = mxx - mnx || 1, bh = mxy - mny || 1, pad = 44, sc = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
    const tx = (px) => pad + (px - mnx) * sc, ty = (py) => pad + (py - mny) * sc;
    const parts = [];
    segs.forEach((g) => {
      const x1 = tx(g[0]), y1 = ty(g[1]), x2 = tx(g[2]), y2 = ty(g[3]), w = g[4] * 0.5;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, px = (-dy / len) * w, py = (dx / len) * w;
      parts.push(poly([[x1 + px, y1 + py], [x1 - px, y1 - py], [x2 - px * 0.7, y2 - py * 0.7], [x2 + px * 0.7, y2 + py * 0.7]]));
    });
    folhas.forEach((p) => parts.push('<ellipse class="region" cx="' + n(tx(p[0])) + '" cy="' + n(ty(p[1])) + '" rx="5.5" ry="9"/>'));
    return wrap(parts.join(""));
  }

  // ─────────────── GASKET DE APOLLONIUS (teorema de Descartes) ───────────────
  function gasket(opts) {
    const prof = +opts.profundidade || 3;
    const minRad = [0.07, 0.045, 0.028, 0.017, 0.011][Math.min(4, prof - 1)] || 0.03;
    const C = {
      add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
      mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], scale: (a, s) => [a[0] * s, a[1] * s],
      abs: (a) => Math.hypot(a[0], a[1]),
      sqrt: (a) => { const m = Math.hypot(a[0], a[1]); const re = Math.sqrt(Math.max(0, (m + a[0]) / 2)); let im = Math.sqrt(Math.max(0, (m - a[0]) / 2)); if (a[1] < 0) im = -im; return [re, im]; },
    };
    const all = [{ k: -1, c: [0, 0] }, { k: 2, c: [-0.5, 0] }, { k: 2, c: [0.5, 0] }];
    const fila = [[all[0], all[1], all[2]]];
    const tang = (a, b) => { const d = C.abs(C.sub(a.c, b.c)), ra = 1 / Math.abs(a.k), rb = 1 / Math.abs(b.k), tol = 0.02 * Math.min(ra, rb) + 1e-4; return Math.abs(d - Math.abs(ra - rb)) < tol || Math.abs(d - (ra + rb)) < tol; };
    let guard = 0;
    while (fila.length && all.length < 600 && guard++ < 6000) {
      const t = fila.shift(), a = t[0], b = t[1], cc = t[2];
      const s = a.k + b.k + cc.k, root = 2 * Math.sqrt(Math.abs(a.k * b.k + b.k * cc.k + cc.k * a.k));
      [s + root, s - root].forEach((k4) => {
        if (!isFinite(k4) || k4 === 0) return;
        if (1 / Math.abs(k4) < minRad) return;
        const bz1 = C.scale(a.c, a.k), bz2 = C.scale(b.c, b.k), bz3 = C.scale(cc.c, cc.k);
        const inner = C.add(C.add(C.mul(bz1, bz2), C.mul(bz2, bz3)), C.mul(bz3, bz1));
        const rt = C.scale(C.sqrt(inner), 2), sum = C.add(C.add(bz1, bz2), bz3);
        [C.scale(C.add(sum, rt), 1 / k4), C.scale(C.sub(sum, rt), 1 / k4)].forEach((ctr) => {
          const nc = { k: k4, c: ctr };
          if (!(tang(nc, a) && tang(nc, b) && tang(nc, cc))) return;
          if (all.some((o) => Math.abs(o.k - k4) < 1e-3 && C.abs(C.sub(o.c, ctr)) < 1e-3)) return;
          all.push(nc); fila.push([a, b, nc], [a, cc, nc], [b, cc, nc]);
        });
      });
    }
    const cx = W / 2, cy = H / 2, scale = 320, parts = [];
    all.forEach((o) => { const R = (1 / Math.abs(o.k)) * scale; if (R < 1.5) return; parts.push('<circle class="region" cx="' + n(cx + o.c[0] * scale) + '" cy="' + n(cy + o.c[1] * scale) + '" r="' + n(R) + '"/>'); });
    return wrap(parts.join(""));
  }

  // ─────────────────── LABIRINTO (backtracker recursivo) ───────────────────
  function labirinto(opts) {
    const r = rng((opts.seed | 0) || 1), N = +opts.tamanho || 12, pad = 24, cell = (W - 2 * pad) / N;
    const idx = (i, j) => j * N + i;
    const cells = []; for (let k = 0; k < N * N; k++) cells.push({ w: [1, 1, 1, 1], v: false });
    const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    const stack = [[0, 0]]; cells[0].v = true;
    while (stack.length) {
      const cur = stack[stack.length - 1], ci = cur[0], cj = cur[1];
      const ok = dirs.filter((d) => { const ni = ci + d[0], nj = cj + d[1]; return ni >= 0 && ni < N && nj >= 0 && nj < N && !cells[idx(ni, nj)].v; });
      if (!ok.length) { stack.pop(); continue; }
      const d = ok[Math.floor(r() * ok.length)], ni = ci + d[0], nj = cj + d[1];
      cells[idx(ci, cj)].w[d[2]] = 0; cells[idx(ni, nj)].w[d[3]] = 0; cells[idx(ni, nj)].v = true; stack.push([ni, nj]);
    }
    // entrada e saída
    cells[idx(0, 0)].w[0] = 0; cells[idx(N - 1, N - 1)].w[2] = 0;
    const parts = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) parts.push('<rect class="region" x="' + n(pad + i * cell) + '" y="' + n(pad + j * cell) + '" width="' + n(cell) + '" height="' + n(cell) + '" stroke="none"/>');
    const linhas = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = cells[idx(i, j)], x = pad + i * cell, y = pad + j * cell;
      if (c.w[0]) linhas.push(ln(x, y, x + cell, y));
      if (c.w[3]) linhas.push(ln(x, y, x, y + cell));
      if (i === N - 1 && c.w[1]) linhas.push(ln(x + cell, y, x + cell, y + cell));
      if (j === N - 1 && c.w[2]) linhas.push(ln(x, y + cell, x + cell, y + cell));
    }
    parts.push('<g stroke-width="' + n(Math.max(2.5, cell * 0.16)) + '" stroke-linecap="square">' + linhas.join("") + "</g>");
    return wrap(parts.join(""));
  }

  // Registro público
  window.GENERATORS = {
    forma: forma,
    islamico: islamico,
    lsystem: lsystem,
    gasket: gasket,
    labirinto: labirinto,
    superformula: superformula,
    espirografo: espirografo,
    vitral: vitral,
    lowpoly: lowpoly,
    truchet: truchet,
    circulos: circulos,
    penrose: penrose,
    mandala: mandala,
    tesselacao: tesselacao,
    hiperespaco: hiperespaco,
    fractal: fractal,
    borboleta: borboleta,
    caleidoscopio: caleidoscopio,
    roseta: roseta,
    cena: cena,
  };
})();
