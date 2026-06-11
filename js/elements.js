/*
 * elements.js — Biblioteca grande de elementos vetoriais paramétricos +
 * compositor de cena procedural (montar infinito).
 *
 * Cada elemento é uma função draw(x, y, s, r) que retorna SVG com regiões
 * pintáveis (.region). 'r' é um RNG (0..1) — cada chamada varia sozinha
 * (nº de janelas, pétalas, manchas, etc.), então as combinações são infinitas.
 *
 * Convenção de âncora:
 *   anchor 'base'   → (x,y) é o ponto de contato com o chão (base inferior).
 *   anchor 'centro' → (x,y) é o centro do elemento (céu / água).
 */
(function () {
  "use strict";

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const n = (v) => (+v).toFixed(2);
  const reg = (d) => '<path class="region" d="' + d + '"/>';
  const poly = (p) => '<polygon class="region" points="' + p.map((a) => n(a[0]) + "," + n(a[1])).join(" ") + '"/>';
  const circ = (x, y, r) => '<circle class="region" cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '"/>';
  const ell = (x, y, rx, ry) => '<ellipse class="region" cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(rx) + '" ry="' + n(ry) + '"/>';
  const rect = (x, y, w, h) => '<rect class="region" x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"/>';
  const ln = (x1, y1, x2, y2) => '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"/>';
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ════════════════════════════ ELEMENTOS ════════════════════════════
  const E = {};
  const def = (id, nome, cat, anchor, scale, draw) => { E[id] = { id, nome, cat, anchor, scale, draw }; };

  // ───────── CÉU ─────────
  def("sol", "Sol", "ceu", "centro", 1, (x, y, s, r) => {
    let o = circ(x, y, 40 * s);
    const raios = ri(r, 10, 16);
    for (let i = 0; i < raios; i++) {
      const a = (i / raios) * Math.PI * 2;
      o += ln(x + Math.cos(a) * 48 * s, y + Math.sin(a) * 48 * s, x + Math.cos(a) * (66 + r() * 16) * s, y + Math.sin(a) * (66 + r() * 16) * s);
    }
    return o;
  });
  def("lua", "Lua", "ceu", "centro", 1, (x, y, s) =>
    reg("M " + n(x + 30 * s) + " " + n(y - 38 * s) + " A " + n(42 * s) + " " + n(42 * s) + " 0 1 0 " + n(x + 30 * s) + " " + n(y + 38 * s) +
      " A " + n(54 * s) + " " + n(54 * s) + " 0 0 1 " + n(x + 30 * s) + " " + n(y - 38 * s) + " Z"));
  def("nuvem", "Nuvem", "ceu", "centro", 1, (x, y, s, r) => {
    const k = 0.8 + r() * 0.6;
    return reg("M " + n(x - 60 * s) + " " + n(y + 14 * s) +
      " a " + n(28 * s * k) + " " + n(28 * s * k) + " 0 0 1 " + n(36 * s) + " " + n(-26 * s) +
      " a " + n(34 * s) + " " + n(34 * s) + " 0 0 1 " + n(58 * s) + " " + n(2 * s) +
      " a " + n(26 * s) + " " + n(26 * s) + " 0 0 1 " + n(24 * s) + " " + n(24 * s) + " Z");
  });
  def("estrela", "Estrela", "ceu", "centro", 1, (x, y, s, r) => {
    const pts = [], pontas = ri(r, 5, 7), ri2 = 0.38 + r() * 0.12;
    for (let i = 0; i < pontas * 2; i++) {
      const a = (i / (pontas * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = (i % 2 ? ri2 : 1) * 46 * s;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    return poly(pts);
  });
  def("arcoiris", "Arco-íris", "ceu", "centro", 1, (x, y, s) => {
    let o = "";
    for (let i = 0; i < 4; i++) {
      const R = (90 - i * 18) * s;
      o += reg("M " + n(x - R) + " " + n(y) + " A " + n(R) + " " + n(R) + " 0 0 1 " + n(x + R) + " " + n(y) +
        " L " + n(x + R - 14 * s) + " " + n(y) + " A " + n(R - 14 * s) + " " + n(R - 14 * s) + " 0 0 0 " + n(x - R + 14 * s) + " " + n(y) + " Z");
    }
    return o;
  });
  def("balao", "Balão", "ceu", "centro", 1.2, (x, y, s) => {
    let o = circ(x, y - 30 * s, 46 * s);
    o += poly([[x - 22 * s, y + 4 * s], [x + 22 * s, y + 4 * s], [x + 14 * s, y + 24 * s], [x - 14 * s, y + 24 * s]]);
    o += rect(x - 18 * s, y + 24 * s, 36 * s, 26 * s);
    o += ln(x - 18 * s, y + 8 * s, x - 14 * s, y + 24 * s) + ln(x + 18 * s, y + 8 * s, x + 14 * s, y + 24 * s);
    return o;
  });
  def("pipa", "Pipa", "ceu", "centro", 1, (x, y, s) => {
    let o = poly([[x, y - 50 * s], [x + 34 * s, y], [x, y + 50 * s], [x - 34 * s, y]]);
    o += ln(x, y - 50 * s, x, y + 50 * s) + ln(x - 34 * s, y, x + 34 * s, y);
    let d = "M " + n(x) + " " + n(y + 50 * s);
    for (let i = 1; i <= 4; i++) d += " q " + n(12 * s) + " " + n(14 * s) + " 0 " + n(28 * s);
    o += '<path fill="none" d="' + d + '"/>';
    return o;
  });
  def("foguete", "Foguete", "ceu", "centro", 1, (x, y, s) => {
    let o = reg("M " + n(x) + " " + n(y - 56 * s) + " q " + n(24 * s) + " " + n(34 * s) + " 0 " + n(72 * s) + " q " + n(-24 * s) + " " + n(-38 * s) + " 0 " + n(-72 * s) + " Z");
    o += circ(x, y - 14 * s, 11 * s);
    o += poly([[x - 16 * s, y + 6 * s], [x - 32 * s, y + 28 * s], [x - 16 * s, y + 18 * s]]);
    o += poly([[x + 16 * s, y + 6 * s], [x + 32 * s, y + 28 * s], [x + 16 * s, y + 18 * s]]);
    return o;
  });
  def("planeta", "Planeta", "ceu", "centro", 1, (x, y, s) => {
    let o = circ(x, y, 38 * s);
    o += '<ellipse class="region" transform="rotate(-20 ' + n(x) + " " + n(y) + ')" cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(66 * s) + '" ry="' + n(16 * s) + '" fill="none"/>';
    return o;
  });
  def("ovni", "OVNI", "ceu", "centro", 1, (x, y, s) => {
    let o = ell(x, y, 56 * s, 18 * s);
    o += reg("M " + n(x - 26 * s) + " " + n(y - 6 * s) + " a " + n(26 * s) + " " + n(20 * s) + " 0 0 1 " + n(52 * s) + " 0 Z");
    for (let i = -1; i <= 1; i++) o += circ(x + i * 26 * s, y + 12 * s, 5 * s);
    return o;
  });
  def("aviao", "Avião", "ceu", "centro", 1, (x, y, s) => {
    let o = ell(x, y, 56 * s, 16 * s);
    o += poly([[x - 6 * s, y], [x - 30 * s, y - 30 * s], [x - 14 * s, y - 30 * s], [x + 6 * s, y]]);
    o += poly([[x + 40 * s, y - 4 * s], [x + 58 * s, y - 24 * s], [x + 50 * s, y - 2 * s]]);
    o += circ(x - 30 * s, y - 2 * s, 5 * s);
    return o;
  });
  def("passaro", "Pássaro", "ceu", "centro", 0.8, (x, y, s) =>
    '<path fill="none" d="M ' + n(x - 34 * s) + " " + n(y) + " q " + n(17 * s) + " " + n(-22 * s) + " " + n(34 * s) + " 0 q " + n(17 * s) + " " + n(-22 * s) + " " + n(34 * s) + ' 0"/>');
  def("borboleta", "Borboleta", "ceu", "centro", 0.95, (x, y, s, r) => {
    // muitas variações: formato das asas, ocelos, corpo, antenas
    const corpoSeg = ri(r, 3, 5);
    let o = "";
    for (let i = 0; i < corpoSeg; i++) o += ell(x, y - 24 * s + i * (48 * s / corpoSeg), 5 * s, (48 * s / corpoSeg) * 0.62);
    o += circ(x, y - 30 * s, 7 * s); // cabeça
    const curl = (r() - 0.5) * 22 * s;
    o += '<path fill="none" d="M ' + n(x - 3 * s) + " " + n(y - 36 * s) + " q " + n(-18 * s) + " " + n(-24 * s) + " " + n(-26 * s + curl) + " " + n(-38 * s) + '"/>';
    o += '<path fill="none" d="M ' + n(x + 3 * s) + " " + n(y - 36 * s) + " q " + n(18 * s) + " " + n(-24 * s) + " " + n(26 * s - curl) + " " + n(-38 * s) + '"/>';
    const ux = 40 + r() * 20, uy = 42 + r() * 18, lw = 28 + r() * 18, noc = ri(r, 2, 5), recorte = r() > 0.5;
    [-1, 1].forEach((d) => {
      // asa superior — formato e recorte variam
      if (recorte) {
        o += reg("M " + n(x) + " " + n(y - 8 * s) + " C " + n(x + d * ux * s) + " " + n(y - uy * s) + " " + n(x + d * (ux + 14) * s) + " " + n(y - 14 * s) + " " + n(x + d * (ux - 4) * s) + " " + n(y - 2 * s) + " Q " + n(x + d * (ux - 18) * s) + " " + n(y + 4 * s) + " " + n(x + d * 16 * s) + " " + n(y) + " Z");
      } else {
        o += reg("M " + n(x) + " " + n(y - 8 * s) + " C " + n(x + d * ux * s) + " " + n(y - uy * s) + " " + n(x + d * (ux + 10) * s) + " " + n(y - 6 * s) + " " + n(x + d * 18 * s) + " " + n(y) + " Z");
      }
      // asa inferior
      o += reg("M " + n(x) + " " + n(y + 6 * s) + " C " + n(x + d * lw * s) + " " + n(y + 12 * s) + " " + n(x + d * (lw + 8) * s) + " " + n(y + 42 * s) + " " + n(x + d * 12 * s) + " " + n(y + 22 * s) + " Z");
      // ocelos (número/tamanho variáveis)
      for (let i = 0; i < noc; i++) o += circ(x + d * (20 + i * 12) * s, y - 16 * s + i * 8 * s, (8 - i * 1.1) * s * (0.7 + r() * 0.6));
      if (r() > 0.5) for (let i = 0; i < 2; i++) o += circ(x + d * (18 + i * 14) * s, y + 16 * s + i * 9 * s, (6 - i * 1.4) * s);
    });
    return o;
  });
  def("abelha", "Abelha", "ceu", "centro", 0.7, (x, y, s, r) => {
    let o = ell(x, y, 26 * s, 18 * s);
    for (let i = -1; i <= 1; i++) o += ln(x + i * 9 * s, y - 15 * s, x + i * 9 * s, y + 15 * s);
    o += circ(x - 24 * s, y - 2 * s, 12 * s);
    o += ell(x - 2 * s, y - 16 * s, 12 * s, 8 * s) + ell(x + 10 * s, y - 16 * s, 12 * s, 8 * s);
    o += poly([[x + 24 * s, y], [x + 38 * s, y - 7 * s], [x + 34 * s, y + 6 * s]]);
    return o;
  });

  // ───────── NATUREZA ─────────
  def("arvore", "Árvore", "chao", "base", 1, (x, y, s, r) => {
    let o = rect(x - 12 * s, y - 70 * s, 24 * s, 70 * s);
    const folhas = ri(r, 3, 5);
    for (let i = 0; i < folhas; i++) {
      o += circ(x + (r() - 0.5) * 90 * s, y - (90 + r() * 50) * s, (34 + r() * 22) * s);
    }
    return o;
  });
  def("pinheiro", "Pinheiro", "chao", "base", 1, (x, y, s) => {
    let o = rect(x - 8 * s, y - 18 * s, 16 * s, 18 * s);
    for (let i = 0; i < 3; i++) {
      const yy = y - 18 * s - i * 34 * s, w = (50 - i * 12) * s;
      o += poly([[x - w, yy], [x + w, yy], [x, yy - 46 * s]]);
    }
    return o;
  });
  def("palmeira", "Palmeira", "chao", "base", 1.1, (x, y, s) => {
    let o = reg("M " + n(x - 8 * s) + " " + n(y) + " q " + n(-6 * s) + " " + n(-70 * s) + " " + n(14 * s) + " " + n(-110 * s) + " l " + n(8 * s) + " 4 q " + n(-16 * s) + " " + n(40 * s) + " " + n(-6 * s) + " " + n(106 * s) + " Z");
    for (let i = 0; i < 5; i++) {
      const a = (-Math.PI / 2) + (i - 2) * 0.5;
      o += reg("M " + n(x + 6 * s) + " " + n(y - 110 * s) + " q " + n(Math.cos(a) * 50 * s) + " " + n(Math.sin(a) * 40 * s) + " " + n(Math.cos(a) * 78 * s) + " " + n(Math.sin(a) * 30 * s) + " q " + n(-Math.cos(a) * 30 * s) + " " + n(10 * s) + " " + n(-Math.cos(a) * 76 * s) + " " + n(-Math.sin(a) * 30 * s) + " Z");
    }
    return o;
  });
  def("arbusto", "Arbusto", "chao", "base", 0.8, (x, y, s, r) => {
    let o = "";
    const k = ri(r, 3, 5);
    for (let i = 0; i < k; i++) o += circ(x - 40 * s + i * 80 * s / (k - 1 || 1), y - (22 + r() * 16) * s, (24 + r() * 10) * s);
    return o;
  });
  def("flor", "Flor", "chao", "base", 0.7, (x, y, s, r) => {
    const petalas = ri(r, 5, 8), R = 24 * s, pr = 16 * s, cy = y - 110 * s;
    let o = ln(x, y, x, cy);
    for (let i = 0; i < petalas; i++) {
      const a = (i / petalas) * Math.PI * 2;
      o += circ(x + Math.cos(a) * R, cy + Math.sin(a) * R, pr);
    }
    o += circ(x, cy, 16 * s);
    return o;
  });
  def("girassol", "Girassol", "chao", "base", 0.8, (x, y, s, r) => {
    const petalas = ri(r, 12, 18), cy = y - 120 * s;
    let o = ln(x, y, x, cy);
    for (let i = 0; i < petalas; i++) {
      const a = (i / petalas) * Math.PI * 2;
      o += poly([[x + Math.cos(a) * 24 * s, cy + Math.sin(a) * 24 * s], [x + Math.cos(a + 0.2) * 46 * s, cy + Math.sin(a + 0.2) * 46 * s], [x + Math.cos(a - 0.2) * 46 * s, cy + Math.sin(a - 0.2) * 46 * s]]);
    }
    o += circ(x, cy, 22 * s);
    return o;
  });
  def("tulipa", "Tulipa", "chao", "base", 0.7, (x, y, s) => {
    const cy = y - 100 * s;
    let o = ln(x, y, x, cy);
    o += reg("M " + n(x - 22 * s) + " " + n(cy) + " q 0 " + n(-30 * s) + " " + n(22 * s) + " " + n(-30 * s) + " q " + n(22 * s) + " 0 " + n(22 * s) + " " + n(30 * s) + " q " + n(-11 * s) + " " + n(14 * s) + " " + n(-22 * s) + " 0 q " + n(-11 * s) + " " + n(14 * s) + " " + n(-22 * s) + " 0 Z");
    return o;
  });
  def("cogumelo", "Cogumelo", "chao", "base", 0.7, (x, y, s, r) => {
    let o = reg("M " + n(x - 36 * s) + " " + n(y - 30 * s) + " a " + n(36 * s) + " " + n(30 * s) + " 0 0 1 " + n(72 * s) + " 0 Z");
    o += rect(x - 12 * s, y - 32 * s, 24 * s, 32 * s);
    const k = ri(r, 2, 4);
    for (let i = 0; i < k; i++) o += circ(x - 18 * s + r() * 36 * s, y - (40 + r() * 12) * s, (4 + r() * 4) * s);
    return o;
  });
  def("cacto", "Cacto", "chao", "base", 0.9, (x, y, s) => {
    let o = reg("M " + n(x - 12 * s) + " " + n(y) + " l 0 " + n(-70 * s) + " q 0 " + n(-14 * s) + " " + n(12 * s) + " " + n(-14 * s) + " q " + n(12 * s) + " 0 " + n(12 * s) + " " + n(14 * s) + " l 0 " + n(70 * s) + " Z");
    o += reg("M " + n(x - 12 * s) + " " + n(y - 40 * s) + " q " + n(-22 * s) + " 0 " + n(-22 * s) + " " + n(-20 * s) + " q 0 " + n(-12 * s) + " " + n(10 * s) + " " + n(-12 * s) + " q " + n(12 * s) + " 0 " + n(12 * s) + " " + n(14 * s) + " Z");
    return o;
  });
  def("montanha", "Montanha", "chao", "base", 1.4, (x, y, s) => {
    let o = poly([[x - 110 * s, y], [x - 20 * s, y - 130 * s], [x + 70 * s, y]]);
    o += poly([[x + 10 * s, y], [x + 70 * s, y - 96 * s], [x + 120 * s, y]]);
    o += poly([[x - 48 * s, y - 86 * s], [x - 20 * s, y - 130 * s], [x + 8 * s, y - 86 * s], [x - 6 * s, y - 74 * s], [x - 34 * s, y - 74 * s]]);
    return o;
  });
  def("colina", "Colina", "chao", "base", 1.4, (x, y, s) =>
    reg("M " + n(x - 120 * s) + " " + n(y) + " q " + n(120 * s) + " " + n(-100 * s) + " " + n(240 * s) + " 0 Z"));
  def("pedra", "Pedra", "chao", "base", 0.7, (x, y, s, r) =>
    poly([[x - 40 * s, y], [x - 30 * s, y - (26 + r() * 14) * s], [x + 4 * s, y - (34 + r() * 12) * s], [x + 34 * s, y - 20 * s], [x + 42 * s, y]]));

  // ───────── CONSTRUÇÕES ─────────
  def("casa", "Casa", "chao", "base", 1, (x, y, s, r) => {
    let o = rect(x - 60 * s, y - 80 * s, 120 * s, 80 * s);
    o += poly([[x - 72 * s, y - 80 * s], [x, y - 140 * s], [x + 72 * s, y - 80 * s]]);
    o += rect(x - 18 * s, y - 50 * s, 36 * s, 50 * s);
    const jan = ri(r, 1, 2);
    for (let i = 0; i < jan; i++) o += rect(x + (24 + i * 0) * s, y - 66 * s, 26 * s, 26 * s);
    if (r() > 0.5) o += rect(x - 50 * s, y - 66 * s, 24 * s, 24 * s);
    return o;
  });
  def("castelo", "Castelo", "chao", "base", 1.1, (x, y, s) => {
    let o = rect(x - 64 * s, y - 90 * s, 128 * s, 90 * s);
    [-64, -20, 20, 64].forEach((dx) => { o += rect(x + dx * s - 12 * s, y - 120 * s, 24 * s, 36 * s); o += poly([[x + dx * s - 14 * s, y - 120 * s], [x + dx * s, y - 144 * s], [x + dx * s + 14 * s, y - 120 * s]]); });
    o += reg("M " + n(x - 18 * s) + " " + n(y) + " l 0 " + n(-44 * s) + " a " + n(18 * s) + " " + n(18 * s) + " 0 0 1 " + n(36 * s) + " 0 l 0 " + n(44 * s) + " Z");
    return o;
  });
  def("predio", "Prédio", "chao", "base", 1.1, (x, y, s, r) => {
    const andares = ri(r, 4, 7), larg = 90 * s, alt = andares * 26 * s;
    let o = rect(x - larg / 2, y - alt, larg, alt);
    for (let a = 0; a < andares; a++) for (let c = 0; c < 3; c++) o += rect(x - larg / 2 + 10 * s + c * 26 * s, y - alt + 8 * s + a * 26 * s, 16 * s, 16 * s);
    return o;
  });
  def("igreja", "Igreja", "chao", "base", 1, (x, y, s) => {
    let o = rect(x - 44 * s, y - 90 * s, 88 * s, 90 * s);
    o += poly([[x - 50 * s, y - 90 * s], [x, y - 130 * s], [x + 50 * s, y - 90 * s]]);
    o += rect(x - 10 * s, y - 168 * s, 20 * s, 78 * s);
    o += poly([[x - 12 * s, y - 168 * s], [x, y - 196 * s], [x + 12 * s, y - 168 * s]]);
    o += ln(x, y - 196 * s, x, y - 210 * s) + ln(x - 8 * s, y - 204 * s, x + 8 * s, y - 204 * s);
    o += reg("M " + n(x - 12 * s) + " " + n(y) + " l 0 " + n(-40 * s) + " a " + n(12 * s) + " " + n(12 * s) + " 0 0 1 " + n(24 * s) + " 0 l 0 " + n(40 * s) + " Z");
    return o;
  });
  def("moinho", "Moinho", "chao", "base", 1, (x, y, s) => {
    let o = reg("M " + n(x - 40 * s) + " " + n(y) + " L " + n(x - 28 * s) + " " + n(y - 96 * s) + " L " + n(x + 28 * s) + " " + n(y - 96 * s) + " L " + n(x + 40 * s) + " " + n(y) + " Z");
    o += poly([[x - 34 * s, y - 96 * s], [x, y - 124 * s], [x + 34 * s, y - 96 * s]]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; o += poly([[x, y - 96 * s], [x + Math.cos(a) * 60 * s, y - 96 * s + Math.sin(a) * 60 * s], [x + Math.cos(a + 0.25) * 56 * s, y - 96 * s + Math.sin(a + 0.25) * 56 * s]]); }
    return o;
  });
  def("farol", "Farol", "chao", "base", 1, (x, y, s) => {
    let o = reg("M " + n(x - 30 * s) + " " + n(y) + " L " + n(x - 18 * s) + " " + n(y - 110 * s) + " L " + n(x + 18 * s) + " " + n(y - 110 * s) + " L " + n(x + 30 * s) + " " + n(y) + " Z");
    o += rect(x - 22 * s, y - 80 * s, 44 * s, 14 * s);
    o += rect(x - 22 * s, y - 40 * s, 44 * s, 14 * s);
    o += rect(x - 18 * s, y - 134 * s, 36 * s, 24 * s);
    o += poly([[x - 22 * s, y - 134 * s], [x, y - 154 * s], [x + 22 * s, y - 134 * s]]);
    return o;
  });
  def("tenda", "Tenda", "chao", "base", 0.9, (x, y, s) => {
    let o = poly([[x - 60 * s, y], [x, y - 100 * s], [x + 60 * s, y]]);
    o += poly([[x, y - 100 * s], [x + 8 * s, y], [x - 8 * s, y]]);
    o += ln(x, y - 100 * s, x, y - 116 * s) + poly([[x, y - 116 * s], [x + 18 * s, y - 110 * s], [x, y - 104 * s]]);
    return o;
  });
  def("cerca", "Cerca", "chao", "base", 0.7, (x, y, s) => {
    let o = "";
    for (let i = -2; i <= 2; i++) o += poly([[x + i * 26 * s - 7 * s, y], [x + i * 26 * s - 7 * s, y - 40 * s], [x + i * 26 * s, y - 50 * s], [x + i * 26 * s + 7 * s, y - 40 * s], [x + i * 26 * s + 7 * s, y]]);
    o += ln(x - 60 * s, y - 30 * s, x + 60 * s, y - 30 * s) + ln(x - 60 * s, y - 14 * s, x + 60 * s, y - 14 * s);
    return o;
  });

  // ───────── ANIMAIS ─────────
  function olhos(x, y, s, r) { return circ(x - 9 * s, y, 4 * s) + circ(x + 9 * s, y, 4 * s); }
  def("gato", "Gato", "chao", "base", 0.8, (x, y, s, r) => {
    const cy = y - 40 * s;
    let o = ell(x, cy + 10 * s, 34 * s, 30 * s);
    o += circ(x, cy - 26 * s, 30 * s);
    o += poly([[x - 28 * s, cy - 36 * s], [x - 14 * s, cy - 62 * s], [x - 6 * s, cy - 36 * s]]);
    o += poly([[x + 28 * s, cy - 36 * s], [x + 14 * s, cy - 62 * s], [x + 6 * s, cy - 36 * s]]);
    o += olhos(x, cy - 26 * s, s, r) + poly([[x, cy - 20 * s], [x - 6 * s, cy - 12 * s], [x + 6 * s, cy - 12 * s]]);
    o += '<path fill="none" d="M ' + n(x + 30 * s) + " " + n(cy + 20 * s) + " q " + n(40 * s) + " " + n(-10 * s) + " " + n(20 * s) + " " + n(-44 * s) + '"/>';
    return o;
  });
  def("cachorro", "Cachorro", "chao", "base", 0.8, (x, y, s, r) => {
    const cy = y - 38 * s;
    let o = ell(x, cy + 12 * s, 36 * s, 28 * s);
    o += circ(x, cy - 22 * s, 28 * s);
    o += ell(x - 30 * s, cy - 18 * s, 10 * s, 22 * s) + ell(x + 30 * s, cy - 18 * s, 10 * s, 22 * s);
    o += olhos(x, cy - 24 * s, s, r) + circ(x, cy - 12 * s, 6 * s);
    for (let i = -1; i <= 1; i += 2) o += rect(x + i * 18 * s - 5 * s, y - 16 * s, 10 * s, 16 * s);
    return o;
  });
  def("coelho", "Coelho", "chao", "base", 0.8, (x, y, s, r) => {
    const cy = y - 36 * s;
    let o = ell(x, cy + 14 * s, 26 * s, 28 * s);
    o += circ(x, cy - 16 * s, 24 * s);
    o += ell(x - 12 * s, cy - 54 * s, 9 * s, 30 * s) + ell(x + 12 * s, cy - 54 * s, 9 * s, 30 * s);
    o += olhos(x, cy - 18 * s, s, r) + circ(x, cy - 8 * s, 4 * s);
    return o;
  });
  def("ovelha", "Ovelha", "chao", "base", 0.8, (x, y, s, r) => {
    const cy = y - 34 * s; let o = "";
    const k = ri(r, 5, 8);
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2; o += circ(x + Math.cos(a) * 30 * s, cy + Math.sin(a) * 26 * s, 16 * s); }
    o += ell(x, cy, 30 * s, 24 * s);
    o += ell(x - 24 * s, cy - 18 * s, 14 * s, 18 * s);
    o += olhos(x - 24 * s, cy - 20 * s, s * 0.7, r);
    for (let i = -1; i <= 1; i += 2) o += rect(x + i * 14 * s - 4 * s, y - 14 * s, 8 * s, 14 * s);
    return o;
  });
  def("vaca", "Vaca", "chao", "base", 0.9, (x, y, s, r) => {
    const cy = y - 40 * s; let o = ell(x, cy, 44 * s, 30 * s);
    o += ell(x - 40 * s, cy - 16 * s, 20 * s, 18 * s);
    o += poly([[x - 54 * s, cy - 30 * s], [x - 48 * s, cy - 44 * s], [x - 40 * s, cy - 30 * s]]);
    o += olhos(x - 40 * s, cy - 18 * s, s * 0.8, r);
    const manchas = ri(r, 2, 4); for (let i = 0; i < manchas; i++) o += circ(x - 10 * s + r() * 40 * s, cy - 10 * s + r() * 20 * s, (8 + r() * 6) * s);
    for (let i = -1; i <= 1; i += 2) o += rect(x + i * 24 * s - 5 * s, y - 16 * s, 10 * s, 16 * s);
    return o;
  });
  def("galinha", "Galinha", "chao", "base", 0.6, (x, y, s, r) => {
    const cy = y - 26 * s; let o = ell(x, cy, 28 * s, 24 * s);
    o += circ(x - 20 * s, cy - 22 * s, 14 * s);
    o += poly([[x - 26 * s, cy - 34 * s], [x - 20 * s, cy - 46 * s], [x - 14 * s, cy - 34 * s]]);
    o += poly([[x - 32 * s, cy - 22 * s], [x - 44 * s, cy - 18 * s], [x - 32 * s, cy - 14 * s]]);
    o += olhos(x - 20 * s, cy - 24 * s, s * 0.6, r);
    for (let i = -1; i <= 1; i += 2) o += ln(x + i * 8 * s, y, x + i * 8 * s, y - 12 * s);
    return o;
  });
  def("urso", "Urso", "chao", "base", 0.9, (x, y, s, r) => {
    const cy = y - 44 * s; let o = ell(x, cy + 14 * s, 38 * s, 32 * s);
    o += circ(x, cy - 22 * s, 28 * s);
    o += circ(x - 24 * s, cy - 44 * s, 12 * s) + circ(x + 24 * s, cy - 44 * s, 12 * s);
    o += olhos(x, cy - 24 * s, s, r) + circ(x, cy - 12 * s, 7 * s);
    return o;
  });
  def("coruja", "Coruja", "chao", "base", 0.8, (x, y, s, r) => {
    const cy = y - 40 * s; let o = reg("M " + n(x - 30 * s) + " " + n(cy - 20 * s) + " q 0 " + n(-30 * s) + " " + n(30 * s) + " " + n(-30 * s) + " q " + n(30 * s) + " 0 " + n(30 * s) + " " + n(30 * s) + " l 0 " + n(54 * s) + " q 0 " + n(20 * s) + " " + n(-30 * s) + " " + n(20 * s) + " q " + n(-30 * s) + " 0 " + n(-30 * s) + " " + n(-20 * s) + " Z");
    o += circ(x - 13 * s, cy - 16 * s, 12 * s) + circ(x + 13 * s, cy - 16 * s, 12 * s);
    o += circ(x - 13 * s, cy - 16 * s, 4 * s) + circ(x + 13 * s, cy - 16 * s, 4 * s);
    o += poly([[x, cy - 12 * s], [x - 5 * s, cy - 4 * s], [x + 5 * s, cy - 4 * s]]);
    o += poly([[x - 26 * s, cy - 38 * s], [x - 16 * s, cy - 52 * s], [x - 10 * s, cy - 36 * s]]);
    o += poly([[x + 26 * s, cy - 38 * s], [x + 16 * s, cy - 52 * s], [x + 10 * s, cy - 36 * s]]);
    return o;
  });
  def("caracol", "Caracol", "chao", "base", 0.6, (x, y, s) => {
    let o = reg("M " + n(x - 40 * s) + " " + n(y) + " q " + n(-6 * s) + " " + n(-20 * s) + " " + n(14 * s) + " " + n(-22 * s) + " l " + n(30 * s) + " 0 q 8 0 8 8 Z");
    let d = "M " + n(x + 6 * s) + " " + n(y - 14 * s);
    for (let i = 0; i < 16; i++) { const a = i * 0.7, rr = (2 + i) * 1.4 * s; d += " L " + n(x + 6 * s + Math.cos(a) * rr) + " " + n(y - 14 * s + Math.sin(a) * rr); }
    o += '<path fill="none" d="' + d + '"/>';
    o += ln(x - 40 * s, y - 12 * s, x - 50 * s, y - 22 * s) + ln(x - 34 * s, y - 14 * s, x - 40 * s, y - 26 * s);
    return o;
  });
  def("joaninha", "Joaninha", "chao", "base", 0.5, (x, y, s, r) => {
    const cy = y - 16 * s; let o = ell(x, cy, 28 * s, 24 * s);
    o += ln(x, cy - 24 * s, x, cy + 24 * s);
    o += reg("M " + n(x - 22 * s) + " " + n(cy - 14 * s) + " a 16 16 0 0 1 " + n(44 * s) + " 0 Z");
    const k = ri(r, 4, 7); for (let i = 0; i < k; i++) o += circ(x - 16 * s + r() * 32 * s, cy - 8 * s + r() * 26 * s, 4 * s);
    return o;
  });
  def("tartaruga", "Tartaruga", "chao", "base", 0.7, (x, y, s, r) => {
    const cy = y - 22 * s; let o = reg("M " + n(x - 44 * s) + " " + n(cy) + " a " + n(44 * s) + " " + n(34 * s) + " 0 0 1 " + n(88 * s) + " 0 Z");
    o += circ(x + 50 * s, cy - 4 * s, 13 * s);
    for (let i = -1; i <= 1; i += 2) { o += ell(x + i * 34 * s, y - 4 * s, 9 * s, 6 * s); }
    const k = ri(r, 4, 6); for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI; o += poly([[x + Math.cos(a) * 30 * s, cy - 4 * s], [x + Math.cos(a) * 30 * s - 8 * s, cy - 22 * s], [x + Math.cos(a) * 30 * s + 8 * s, cy - 22 * s]]); }
    return o;
  });

  // ───────── ÁGUA ─────────
  def("peixe", "Peixe", "agua", "centro", 0.9, (x, y, s, r) => {
    let o = ell(x, y, 40 * s, 26 * s);
    o += poly([[x + 32 * s, y], [x + 62 * s, y - 22 * s], [x + 62 * s, y + 22 * s]]);
    o += circ(x - 22 * s, y - 6 * s, 5 * s);
    const k = ri(r, 2, 4); for (let i = 0; i < k; i++) o += circ(x - 6 * s + i * 14 * s, y, 5 * s);
    return o;
  });
  def("baleia", "Baleia", "agua", "centro", 1.1, (x, y, s) => {
    let o = reg("M " + n(x - 56 * s) + " " + n(y) + " q 0 " + n(-34 * s) + " " + n(56 * s) + " " + n(-30 * s) + " q " + n(40 * s) + " " + n(2 * s) + " " + n(56 * s) + " " + n(30 * s) + " q " + n(-40 * s) + " " + n(20 * s) + " " + n(-112 * s) + " 0 Z");
    o += poly([[x + 50 * s, y - 22 * s], [x + 74 * s, y - 40 * s], [x + 62 * s, y - 12 * s]]);
    o += circ(x - 34 * s, y - 8 * s, 5 * s);
    o += '<path fill="none" d="M ' + n(x - 30 * s) + " " + n(y - 28 * s) + " q " + n(-6 * s) + " " + n(-22 * s) + " " + n(8 * s) + " " + n(-26 * s) + '"/>';
    return o;
  });
  def("polvo", "Polvo", "agua", "centro", 0.9, (x, y, s, r) => {
    let o = reg("M " + n(x - 34 * s) + " " + n(y) + " a " + n(34 * s) + " " + n(34 * s) + " 0 0 1 " + n(68 * s) + " 0 Z");
    o += olhos(x, y - 8 * s, s, r);
    for (let i = 0; i < 6; i++) { const dx = (i - 2.5) * 12 * s; o += '<path fill="none" d="M ' + n(x + dx) + " " + n(y) + " q " + n(4 * s) + " " + n(26 * s) + " " + n((r() - 0.5) * 16 * s) + " " + n(34 * s) + '"/>'; }
    return o;
  });
  def("caranguejo", "Caranguejo", "agua", "centro", 0.8, (x, y, s, r) => {
    let o = ell(x, y, 38 * s, 24 * s);
    o += circ(x - 12 * s, y - 6 * s, 5 * s) + circ(x + 12 * s, y - 6 * s, 5 * s);
    for (let i = -1; i <= 1; i += 2) { o += reg("M " + n(x + i * 36 * s) + " " + n(y - 4 * s) + " q " + n(i * 22 * s) + " " + n(-18 * s) + " " + n(i * 16 * s) + " " + n(-26 * s) + " q " + n(i * 10 * s) + " " + n(6 * s) + " " + n(-i * 6 * s) + " " + n(16 * s) + " Z"); }
    for (let i = 0; i < 3; i++) { o += ln(x - 30 * s, y + 6 * s, x - 44 * s, y + 14 * s + i * 6 * s); o += ln(x + 30 * s, y + 6 * s, x + 44 * s, y + 14 * s + i * 6 * s); }
    return o;
  });
  def("estrelamar", "Estrela-do-mar", "agua", "centro", 0.8, (x, y, s, r) => {
    const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = (i % 2 ? 18 : 44) * s; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    let o = poly(pts); const k = ri(r, 5, 9); for (let i = 0; i < k; i++) o += circ(x + (r() - 0.5) * 40 * s, y + (r() - 0.5) * 40 * s, 3 * s);
    return o;
  });
  def("concha", "Concha", "agua", "centro", 0.6, (x, y, s) => {
    let o = reg("M " + n(x) + " " + n(y + 30 * s) + " a " + n(36 * s) + " " + n(36 * s) + " 0 0 1 " + n(-36 * s) + " " + n(-30 * s) + " q " + n(36 * s) + " " + n(-22 * s) + " " + n(72 * s) + " 0 a " + n(36 * s) + " " + n(36 * s) + " 0 0 1 " + n(-36 * s) + " " + n(30 * s) + " Z");
    for (let i = -2; i <= 2; i++) o += ln(x, y + 28 * s, x + i * 16 * s, y - 18 * s);
    return o;
  });
  def("barco", "Barco", "agua", "centro", 1, (x, y, s, r) => {
    let o = reg("M " + n(x - 50 * s) + " " + n(y) + " L " + n(x + 50 * s) + " " + n(y) + " L " + n(x + 36 * s) + " " + n(y + 26 * s) + " L " + n(x - 36 * s) + " " + n(y + 26 * s) + " Z");
    o += ln(x, y, x, y - 50 * s);
    o += poly([[x, y - 50 * s], [x, y - 6 * s], [x + 40 * s, y - 14 * s]]);
    return o;
  });
  def("veleiro", "Veleiro", "agua", "centro", 1, (x, y, s) => {
    let o = reg("M " + n(x - 54 * s) + " " + n(y) + " q " + n(54 * s) + " " + n(22 * s) + " " + n(108 * s) + " 0 Z");
    o += ln(x - 6 * s, y - 4 * s, x - 6 * s, y - 70 * s);
    o += poly([[x - 6 * s, y - 68 * s], [x - 6 * s, y - 6 * s], [x - 44 * s, y - 6 * s]]);
    o += poly([[x + 2 * s, y - 60 * s], [x + 2 * s, y - 6 * s], [x + 40 * s, y - 6 * s]]);
    return o;
  });

  // ───────── VEÍCULOS ─────────
  def("carro", "Carro", "chao", "base", 0.9, (x, y, s, r) => {
    let o = reg("M " + n(x - 60 * s) + " " + n(y - 18 * s) + " l " + n(16 * s) + " " + n(-26 * s) + " q " + n(4 * s) + " " + n(-6 * s) + " " + n(12 * s) + " " + n(-6 * s) + " l " + n(48 * s) + " 0 q " + n(8 * s) + " 0 " + n(14 * s) + " " + n(8 * s) + " l " + n(20 * s) + " " + n(24 * s) + " Z");
    o += rect(x - 60 * s, y - 18 * s, 120 * s, 18 * s);
    o += rect(x - 34 * s, y - 40 * s, 26 * s, 18 * s) + rect(x + 4 * s, y - 40 * s, 26 * s, 18 * s);
    o += circ(x - 32 * s, y, 14 * s) + circ(x + 32 * s, y, 14 * s);
    return o;
  });
  def("caminhao", "Caminhão", "chao", "base", 1, (x, y, s) => {
    let o = rect(x - 64 * s, y - 50 * s, 80 * s, 50 * s);
    o += reg("M " + n(x + 16 * s) + " " + n(y) + " l 0 " + n(-34 * s) + " l " + n(20 * s) + " 0 l " + n(16 * s) + " " + n(18 * s) + " l 0 " + n(16 * s) + " Z");
    o += rect(x + 36 * s, y - 30 * s, 16 * s, 12 * s);
    o += circ(x - 34 * s, y, 14 * s) + circ(x + 30 * s, y, 14 * s);
    return o;
  });
  def("trem", "Trem", "chao", "base", 1, (x, y, s) => {
    let o = reg("M " + n(x - 60 * s) + " " + n(y - 12 * s) + " l 0 " + n(-44 * s) + " q 0 " + n(-8 * s) + " " + n(8 * s) + " " + n(-8 * s) + " l " + n(44 * s) + " 0 l " + n(20 * s) + " " + n(20 * s) + " l 0 " + n(32 * s) + " Z");
    o += rect(x - 50 * s, y - 50 * s, 22 * s, 18 * s);
    o += rect(x + 18 * s, y - 28 * s, 14 * s, 14 * s);
    o += ln(x - 60 * s, y - 12 * s, x + 32 * s, y - 12 * s);
    o += circ(x - 38 * s, y, 12 * s) + circ(x + 6 * s, y, 12 * s);
    return o;
  });
  def("bicicleta", "Bicicleta", "chao", "base", 0.9, (x, y, s) => {
    let o = circ(x - 34 * s, y - 18 * s, 20 * s) + circ(x + 34 * s, y - 18 * s, 20 * s);
    o += ln(x - 34 * s, y - 18 * s, x, y - 18 * s) + ln(x, y - 18 * s, x + 34 * s, y - 18 * s);
    o += ln(x, y - 18 * s, x - 8 * s, y - 54 * s) + ln(x - 34 * s, y - 18 * s, x - 8 * s, y - 54 * s);
    o += ln(x - 14 * s, y - 56 * s, x, y - 56 * s) + ln(x + 34 * s, y - 18 * s, x + 30 * s, y - 50 * s);
    return o;
  });

  // ───────── FORMAS ─────────
  def("coracao", "Coração", "ceu", "centro", 0.9, (x, y, s) =>
    reg("M " + n(x) + " " + n(y + 36 * s) + " C " + n(x - 50 * s) + " " + n(y) + " " + n(x - 40 * s) + " " + n(y - 40 * s) + " " + n(x) + " " + n(y - 14 * s) + " C " + n(x + 40 * s) + " " + n(y - 40 * s) + " " + n(x + 50 * s) + " " + n(y) + " " + n(x) + " " + n(y + 36 * s) + " Z"));
  def("diamante", "Diamante", "ceu", "centro", 0.9, (x, y, s) => {
    let o = poly([[x, y - 40 * s], [x + 30 * s, y - 14 * s], [x, y + 44 * s], [x - 30 * s, y - 14 * s]]);
    o += ln(x - 30 * s, y - 14 * s, x + 30 * s, y - 14 * s) + ln(x, y - 40 * s, x, y - 14 * s) + ln(x - 14 * s, y - 14 * s, x, y + 44 * s) + ln(x + 14 * s, y - 14 * s, x, y + 44 * s);
    return o;
  });
  def("espiral", "Espiral", "ceu", "centro", 0.9, (x, y, s) => {
    let d = "M " + n(x) + " " + n(y);
    for (let i = 0; i < 60; i++) { const a = i * 0.4, rr = i * 0.9 * s; d += " L " + n(x + Math.cos(a) * rr) + " " + n(y + Math.sin(a) * rr); }
    return '<path fill="none" d="' + d + '"/>';
  });
  def("cristal", "Cristal", "chao", "base", 0.7, (x, y, s) => {
    let o = "";
    for (let i = -1; i <= 1; i++) { const bx = x + i * 22 * s, h = (60 + Math.abs(i) * -16) * s; o += poly([[bx - 12 * s, y], [bx - 12 * s, y - h * 0.7], [bx, y - h], [bx + 12 * s, y - h * 0.7], [bx + 12 * s, y]]); }
    return o;
  });

  // ───────── ORGÂNICOS (matemática antiga: filotaxia / ângulo áureo) ─────────
  // Flor com sementes em espiral de Fibonacci (ângulo áureo 137,5°) — cada
  // semente é uma região pintável. Mesma lei das pinhas, girassóis e abacaxis.
  def("florvogel", "Flor de Fibonacci", "chao", "base", 0.85, (x, y, s, r) => {
    const cy = y - 122 * s;
    let o = ln(x, y, x, cy);
    const pet = ri(r, 12, 20);
    for (let i = 0; i < pet; i++) {
      const a = (i / pet) * Math.PI * 2;
      o += poly([[x + Math.cos(a) * 26 * s, cy + Math.sin(a) * 26 * s], [x + Math.cos(a + 0.16) * (48 + r() * 8) * s, cy + Math.sin(a + 0.16) * 48 * s], [x + Math.cos(a - 0.16) * 48 * s, cy + Math.sin(a - 0.16) * 48 * s]]);
    }
    const golden = Math.PI * (3 - Math.sqrt(5));
    const ns = ri(r, 50, 90), c = 3.0 * s;
    for (let i = 0; i < ns; i++) {
      const a = i * golden, rr = c * Math.sqrt(i);
      if (rr > 24 * s) break;
      o += circ(x + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.2 * s);
    }
    o += circ(x, cy, 26 * s);
    return o;
  });
  def("samambaia", "Samambaia", "chao", "base", 0.85, (x, y, s, r) => {
    const segs = ri(r, 8, 12), bend = (r() - 0.5) * 70 * s;
    let o = '<path fill="none" d="M ' + n(x) + " " + n(y) + " Q " + n(x + bend * 0.4) + " " + n(y - 80 * s) + " " + n(x + bend) + " " + n(y - 150 * s) + '"/>';
    for (let i = 1; i <= segs; i++) {
      const t = i / (segs + 1), px = x + bend * t * t, py = y - 150 * s * t, sz = (16 - t * 10) * s;
      [-1, 1].forEach((dir) => {
        o += '<ellipse class="region" transform="rotate(' + n(dir * 42) + " " + n(px) + " " + n(py) + ')" cx="' + n(px + dir * sz) + '" cy="' + n(py) + '" rx="' + n(sz) + '" ry="' + n(sz * 0.5) + '"/>';
      });
    }
    return o;
  });
  def("folha", "Folha", "chao", "base", 0.7, (x, y, s, r) => {
    const tip = y - (130 + r() * 30) * s, wid = 36 + r() * 12;
    let o = reg("M " + n(x) + " " + n(y) + " C " + n(x - wid * s) + " " + n(y - 50 * s) + " " + n(x - (wid - 8) * s) + " " + n(tip + 30 * s) + " " + n(x) + " " + n(tip) + " C " + n(x + (wid - 8) * s) + " " + n(tip + 30 * s) + " " + n(x + wid * s) + " " + n(y - 50 * s) + " " + n(x) + " " + n(y) + " Z");
    o += ln(x, y, x, tip);
    const veias = ri(r, 3, 5);
    for (let i = 1; i <= veias; i++) { const yy = y - ((y - tip) * i) / (veias + 1); o += ln(x, yy, x - 16 * s, yy - 12 * s) + ln(x, yy, x + 16 * s, yy - 12 * s); }
    return o;
  });

  // ════════════════════════════ TEMAS ════════════════════════════
  const THEMES = {
    campo: { ground: "grama", pool: ["arvore", "arbusto", "flor", "florvogel", "girassol", "tulipa", "folha", "cogumelo", "casa", "cerca", "montanha", "colina", "gato", "cachorro", "coelho", "ovelha", "vaca", "galinha", "joaninha", "borboleta", "abelha", "caracol", "pedra"] },
    cidade: { ground: "pedra", pool: ["predio", "casa", "igreja", "carro", "caminhao", "bicicleta", "arvore", "cerca", "gato", "cachorro"] },
    praia: { ground: "areia", pool: ["palmeira", "concha", "estrelamar", "caranguejo", "pedra", "tenda", "farol", "barco", "veleiro", "peixe", "polvo", "baleia"], agua: true },
    floresta: { ground: "grama", pool: ["arvore", "pinheiro", "arbusto", "samambaia", "folha", "cogumelo", "flor", "florvogel", "borboleta", "coruja", "coelho", "urso", "caracol", "pedra", "montanha"] },
    fazenda: { ground: "grama", pool: ["casa", "moinho", "cerca", "arvore", "girassol", "vaca", "ovelha", "galinha", "gato", "cachorro", "tenda", "colina"] },
    jardim: { ground: "grama", pool: ["flor", "florvogel", "girassol", "tulipa", "folha", "samambaia", "arbusto", "cogumelo", "borboleta", "abelha", "joaninha", "caracol", "cerca", "passaro"] },
    mar: { ground: "areia", pool: ["barco", "veleiro", "peixe", "baleia", "polvo", "caranguejo", "estrelamar", "concha", "farol", "palmeira"], agua: true },
    espaco: { ground: "pedra", pool: ["foguete", "planeta", "ovni", "estrela", "cristal", "diamante"], espaco: true },
    fantasia: { ground: "grama", pool: ["castelo", "arvore", "cogumelo", "flor", "estrela", "coracao", "diamante", "cristal", "arcoiris", "balao", "pinheiro"] },
  };

  // ════════════════════════ COMPOSITOR DE CENA ════════════════════════
  function jitterRot(r, amount, id) {
    // só gira o que parece natural girado
    if (id && ["casa", "predio", "carro", "trem", "caminhao", "igreja", "castelo", "farol", "moinho"].indexOf(id) >= 0) return 0;
    return (r() - 0.5) * 24 * amount;
  }

  const SKY = { top: 56 };

  // Raio aproximado de colisão por elemento (px @ s=1) — usado p/ não sobrepor.
  const RAD = {
    montanha: 120, colina: 120, castelo: 92, predio: 80, igreja: 96, farol: 78, moinho: 84, casa: 78, arvore: 72,
    palmeira: 92, pinheiro: 64, baleia: 96, caminhao: 74, trem: 72, carro: 54, barco: 60, veleiro: 62, girassol: 62,
    foguete: 60, balao: 62, arcoiris: 96, planeta: 60, sol: 66, lua: 52, nuvem: 58, arbusto: 54, vaca: 58, urso: 56,
    flor: 30, florvogel: 42, tulipa: 28, cogumelo: 30, joaninha: 22, concha: 26, estrelamar: 38, caracol: 30,
    borboleta: 44, abelha: 26, estrela: 38, coracao: 38, diamante: 36, cristal: 40, pedra: 38, cacto: 40, folha: 36,
    samambaia: 60, passaro: 30, polvo: 44, caranguejo: 42, peixe: 46, gato: 48, cachorro: 50, coelho: 42, ovelha: 48,
    galinha: 36, coruja: 46, tartaruga: 46, cerca: 70, tenda: 60, bicicleta: 52, ovni: 60,
  };
  function radOf(id) { return RAD[id] || 46; }

  /* Constrói uma CENA estruturada (editável): fundo + lista de elementos.
     Posicionamento por EMPACOTAMENTO sem sobreposição (rejeição por colisão);
     arranjos alternativos usam ângulo áureo / filotaxia (matemática antiga). */
  function buildScene(opts) {
    const W = 720, H = 720;
    const r = rng((opts.seed | 0) || 1);
    const temaNome = opts.tema || "campo";
    const tema = THEMES[temaNome] || THEMES.campo;
    const densidade = +opts.densidade || 10;
    const jitter = (opts.variar == null ? 40 : +opts.variar) / 100;
    const arranjo = opts.arranjo || "cena";
    const escolhidos = opts.elementos && opts.elementos.length ? opts.elementos.filter((e) => E[e]) : null;
    const groundY = H - 130 - Math.floor(r() * 50);

    const placements = [];
    const placed = []; // círculos de colisão {cx,cy,rad}
    const centerY = (id, y, rad) => (E[id].cat === "chao" ? y - rad * 0.55 : y);
    function overlaps(cx, cy, rad) {
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i], dx = cx - p.cx, dy = cy - p.cy, m = rad + p.rad - 6;
        if (dx * dx + dy * dy < m * m) return true;
      }
      return false;
    }
    const add = (id, x, y, s, rot, sortY) => {
      const rad = radOf(id) * s;
      placed.push({ cx: x, cy: centerY(id, y, rad), rad: rad });
      placements.push({ id: id, x: x, y: y, s: s, rot: rot || 0, seed: (r() * 1e9) | 0, cat: E[id].cat, rad: rad, sortY: sortY == null ? y : sortY });
    };
    // posiciona sem sobrepor (rejeição); retorna {x,y} ou null
    function place(id, s, z, tries) {
      tries = tries || 60;
      const rad = radOf(id) * s;
      for (let t = 0; t < tries; t++) {
        const x = z.x0 + r() * (z.x1 - z.x0), y = z.y0 + r() * (z.y1 - z.y0);
        if (!overlaps(x, centerY(id, y, rad), rad)) return { x: x, y: y };
      }
      return null;
    }

    // ----- fundo (não editável) — só na cena semântica -----
    const bd = [];
    if (arranjo === "cena") {
      if (tema.espaco) for (let i = 0; i < 44; i++) bd.push(circ(r() * W, r() * groundY, 1.4 + r() * 2));
      if (tema.agua) {
        bd.push(rect(0, groundY, W, H - groundY));
        for (let i = 0; i < 6; i++) { const wx = n(r() * W), wy = n(groundY + 20 + r() * (H - groundY - 30)); bd.push('<path fill="none" d="M ' + wx + ' ' + wy + ' q 16 -8 32 0 q 16 8 32 0"/>'); }
      } else {
        bd.push(ln(0, groundY, W, groundY));
        if (tema.ground === "grama") for (let i = 0; i < 32; i++) { const gx = r() * W; bd.push(ln(gx, groundY, gx - 4, groundY - 8 - r() * 8) + ln(gx, groundY, gx + 4, groundY - 8 - r() * 8)); }
      }
    }

    const pool = escolhidos || tema.pool;

    if (arranjo !== "cena") {
      placePadrao(arranjo, pool, { W: W, H: H, r: r, add: add, place: place, densidade: densidade });
    } else {
      // decoração de céu
      if (!tema.espaco) {
        add(pick(r, ["sol", "sol", "lua"]), 80 + r() * 120, 80 + r() * 50, 0.9, 0, -10);
        const nuvens = ri(r, 1, 3);
        for (let i = 0; i < nuvens; i++) { const cs = 0.8 + r() * 0.5; const pos = place("nuvem", cs, { x0: 120, x1: W - 120, y0: 60, y1: 150 }); if (pos) add("nuvem", pos.x, pos.y, cs, 0, -8); }
      } else add("planeta", W - 120 - r() * 80, 110 + r() * 40, 0.8, 0, -10);

      const ceu = pool.filter((id) => E[id] && E[id].cat === "ceu");
      const chao = pool.filter((id) => E[id] && E[id].cat === "chao");
      const agua = pool.filter((id) => E[id] && E[id].cat === "agua");

      const skyZone = { x0: 60, x1: W - 60, y0: SKY.top, y1: Math.max(SKY.top + 50, groundY - 200) };
      const nCeu = ri(r, 1, Math.max(1, Math.min(4, Math.round(densidade / 4))));
      for (let i = 0; i < nCeu && ceu.length; i++) {
        const id = pick(r, ceu), s = 0.7 + r() * 0.5, pos = place(id, s, skyZone);
        if (pos) add(id, pos.x, pos.y, s, jitterRot(r, jitter, id), -5 + i);
      }
      if (agua.length && tema.agua) {
        const nAgua = ri(r, 2, Math.max(2, Math.round(densidade / 2))), wz = { x0: 60, x1: W - 60, y0: groundY + 24, y1: H - 30 };
        for (let i = 0; i < nAgua; i++) { const id = pick(r, agua), s = 0.6 + r() * 0.5, pos = place(id, s, wz); if (pos) add(id, pos.x, pos.y, s, 0, pos.y); }
      }
      const gz = { x0: 46, x1: W - 46, y0: groundY - 4, y1: groundY + 28 };
      const nChao = chao.length ? densidade : 0;
      for (let i = 0; i < nChao; i++) {
        const id = pick(r, chao), depth = r(), s = (0.55 + depth * 0.75) * (E[id].scale || 1), pos = place(id, s, gz);
        if (pos) add(id, pos.x, pos.y, s, jitterRot(r, jitter * 0.5, id), pos.y);
      }
    }

    placements.sort((a, b) => a.sortY - b.sortY);
    return { W: W, H: H, groundY: groundY, tema: temaNome, backdrop: bd.join(""), placements: placements };
  }

  /* Arranjos decorativos baseados em matemática antiga (sem sobreposição). */
  function placePadrao(arranjo, pool, ctx) {
    const W = ctx.W, H = ctx.H, r = ctx.r, add = ctx.add, densidade = ctx.densidade;
    const cx = W / 2, cy = H / 2;
    const yAdj = (id, s) => (E[id].cat === "chao" ? radOf(id) * s * 0.55 : 0); // centra base no ponto

    if (arranjo === "espiral") {
      // Filotaxia de Vogel: ângulo áureo 137,5°, raio ∝ √i (girassol).
      const golden = Math.PI * (3 - Math.sqrt(5));
      const targetR = 24 + (densidade < 10 ? 8 : 0);
      const spacing = 2.5 * targetR, maxR = Math.min(W, H) / 2 - 46;
      for (let i = 0; i < 220; i++) {
        const rr = spacing * Math.sqrt(i + 0.6);
        if (rr > maxR) break;
        const a = i * golden, id = pick(r, pool), s = targetR / radOf(id);
        add(id, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + yAdj(id, s), s, (r() - 0.5) * 18, cy + Math.sin(a) * rr);
      }
    } else if (arranjo === "grade") {
      const cols = Math.max(3, Math.round(Math.sqrt(densidade * 1.7))), rows = cols, m = 72;
      const gw = (W - 2 * m) / (cols - 1 || 1), gh = (H - 2 * m) / (rows - 1 || 1), cell = Math.min(gw, gh);
      for (let ry = 0; ry < rows; ry++) for (let cxi = 0; cxi < cols; cxi++) {
        const id = pick(r, pool), s = Math.min(1.1, (cell * 0.42) / radOf(id)), py = m + ry * gh;
        add(id, m + cxi * gw, py + yAdj(id, s), s, 0, py);
      }
    } else {
      // anel: anéis concêntricos com espaçamento angular uniforme
      const aneis = Math.max(1, Math.round(densidade / 5)), cid = pick(r, pool), cs = Math.min(1.2, 34 / radOf(cid));
      add(cid, cx, cy + yAdj(cid, cs), cs, 0, cy);
      for (let k = 1; k <= aneis; k++) {
        const R = (k * (Math.min(W, H) / 2 - 50)) / aneis, per = Math.max(6, Math.round((2 * Math.PI * R) / 74));
        for (let i = 0; i < per; i++) {
          const a = (i / per) * Math.PI * 2 + (k % 2) * 0.3, id = pick(r, pool), s = Math.min(1, 28 / radOf(id));
          add(id, cx + Math.cos(a) * R, cy + Math.sin(a) * R + yAdj(id, s), s, 0, cy + Math.sin(a) * R);
        }
      }
    }
  }

  /* Desenha uma cena estruturada. sel = índice selecionado (destaque). */
  function renderScene(scene, sel) {
    const parts = [scene.backdrop];
    scene.placements.forEach((p, i) => {
      if (p.oculto) return; // camada invisível
      const inner = E[p.id].draw(p.x, p.y, p.s, rng(p.seed || 1));
      const fx = p.fx == null ? 1 : p.fx, fy = p.fy == null ? 1 : p.fy;
      let tr = "";
      if (p.rot || fx !== 1 || fy !== 1) {
        tr = ' transform="translate(' + n(p.x) + " " + n(p.y) + ") rotate(" + n(p.rot || 0) + ") scale(" + n(fx) + " " + n(fy) + ") translate(" + n(-p.x) + " " + n(-p.y) + ')"';
      }
      parts.push('<g class="elemento' + (i === sel ? " sel" : "") + '" data-i="' + i + '"' + tr + ">" + inner + "</g>");
    });
    parts.push('<rect class="moldura" x="14" y="14" width="' + (scene.W - 28) + '" height="' + (scene.H - 28) + '" fill="none"/>');
    return svgWrap(parts.join(""), scene.W, scene.H);
  }

  function composeCena(opts) { return renderScene(buildScene(opts), -1); }

  function novoPlacement(id, x, y, s) {
    s = s || (E[id].scale || 1);
    return { id: id, x: x, y: y, s: s, rot: 0, seed: (Math.random() * 1e9) | 0, cat: E[id].cat, rad: radOf(id) * s, sortY: y };
  }

  function svgWrap(inner, w, h) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h +
      '"><rect class="bg" x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      '<g fill="#ffffff" stroke="#1b1b1b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">' +
      inner + "</g></svg>";
  }

  // exporta
  window.ELEMENTS = E;
  window.ELEMENT_THEMES = THEMES;
  window.composeCena = composeCena;
  window.buildScene = buildScene;
  window.renderScene = renderScene;
  window.novoPlacement = novoPlacement;
})();
