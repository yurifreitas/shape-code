/*
 * draw.js — "Desenhar": desenhador vetorial à mão livre, com vários pincéis e
 * formas complexas, otimizado para toque (mobile). Produz SVG (vetorial),
 * integrado com salvar/exportar/compartilhar.
 */
window.Draw = (function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const W = 720, H = 720;
  const $ = (id) => document.getElementById(id);
  const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);

  const CORES = ["#000000", "#e63946", "#f4a261", "#ffbe0b", "#ffd166", "#06d6a0", "#2a9d8f", "#3a86ff", "#4361ee", "#9b5de5", "#ff6392", "#7f5539", "#8d99ae", "#ffffff"];

  // tipo: traco (linha) | ribbon (caligráfico, largura variável) | spray | borracha
  const PINCEIS = {
    lapis: { nome: "✏️ Lápis", tipo: "traco", w: 3, cap: "round", op: 0.9 },
    caneta: { nome: "🖊️ Caneta", tipo: "traco", w: 6, cap: "round", op: 1 },
    marcador: { nome: "🖍️ Marcador", tipo: "traco", w: 20, cap: "round", op: 0.45 },
    pincel: { nome: "🖌️ Pincel", tipo: "ribbon" },
    giz: { nome: "🩹 Giz", tipo: "traco", w: 9, cap: "round", op: 0.85, dash: "0.1 7" },
    neon: { nome: "✨ Neon", tipo: "traco", w: 5, cap: "round", op: 1, glow: true },
    spray: { nome: "💨 Spray", tipo: "spray" },
    borracha: { nome: "⌫ Borracha", tipo: "borracha" },
  };
  const FORMAS = {
    linha: "╱ Linha", retangulo: "▭ Retângulo", elipse: "◯ Elipse",
    triangulo: "△ Triângulo", estrela: "★ Estrela", poligono: "⬡ Polígono", coracao: "♥ Coração",
  };

  let host, svg, gFundo, gDesenho;
  let cor = "#1b1b1b", tam = 8, opac = 1, fundo = "branco", fundoSvg = "";
  let ferramenta = { classe: "pincel", id: "caneta" };
  let pts = [], atual = null, desenhando = false;
  const undoOps = [], redoOps = [];
  let iniciado = false;

  function init() {
    if (iniciado) return;
    iniciado = true;
    host = $("d-host");
    host.innerHTML =
      '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' +
      '<defs><filter id="d-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<g class="fundo"></g><g class="desenho"></g></svg>';
    svg = host.querySelector("svg");
    gFundo = svg.querySelector(".fundo");
    gDesenho = svg.querySelector(".desenho");
    svg.style.touchAction = "none";
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointerleave", onUp);
    renderFundo();
    montarPinceis(); montarFormas(); montarCores(); montarAcoes();
  }

  function ptSvg(ev) {
    const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    const m = p.matrixTransform(svg.getScreenCTM().inverse());
    return [m.x, m.y];
  }

  // ───────────────── pincéis: criação e atualização ─────────────────
  function novoEl(tag) { return document.createElementNS(NS, tag); }
  function iniciarTraco(p) {
    const b = PINCEIS[ferramenta.id];
    const el = novoEl("path");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", cor);
    el.setAttribute("stroke-width", (b.tipo === "ribbon" ? 1 : (b.w || tam)) * (b.fixo ? 1 : tam / 8));
    el.setAttribute("stroke-linecap", b.cap || "round");
    el.setAttribute("stroke-linejoin", "round");
    el.setAttribute("opacity", (b.op == null ? 1 : b.op) * opac);
    if (b.dash) el.setAttribute("stroke-dasharray", scaleDash(b.dash, tam));
    if (b.glow) el.setAttribute("filter", "url(#d-glow)");
    if (b.tipo === "ribbon") { el.setAttribute("fill", cor); el.setAttribute("stroke", "none"); }
    gDesenho.appendChild(el);
    return el;
  }
  function scaleDash(d, t) { return d.split(" ").map((x) => (+x * t).toFixed(1)).join(" "); }
  function pathFromPoints(p) {
    if (p.length < 2) return "M " + f(p[0]) + " L " + (p[0][0] + 0.1).toFixed(1) + " " + p[0][1].toFixed(1);
    let d = "M " + f(p[0]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; d += " Q " + p[i][0].toFixed(1) + " " + p[i][1].toFixed(1) + " " + mx.toFixed(1) + " " + my.toFixed(1); }
    return d + " L " + f(p[p.length - 1]);
  }
  function ribbonFromPoints(p, baseW) {
    if (p.length < 2) { const r = baseW / 2; return "M " + (p[0][0] - r).toFixed(1) + " " + p[0][1].toFixed(1) + " a " + r + " " + r + " 0 1 0 " + (2 * r) + " 0 a " + r + " " + r + " 0 1 0 " + (-2 * r) + " 0 Z"; }
    const L = [], R = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const nx = -dy, ny = dx;
      const w = Math.max(baseW * 0.22, baseW * (1 - Math.min(1, len / 38) * 0.7)) / 2;
      L.push([p[i][0] + nx * w, p[i][1] + ny * w]); R.push([p[i][0] - nx * w, p[i][1] - ny * w]);
    }
    let d = "M " + f(L[0]); for (let i = 1; i < L.length; i++) d += " L " + f(L[i]);
    for (let i = R.length - 1; i >= 0; i--) d += " L " + f(R[i]);
    return d + " Z";
  }
  function sprayDots(g, p) {
    const n = 5 + Math.floor(tam / 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * tam;
      const c = novoEl("circle");
      c.setAttribute("cx", (p[0] + Math.cos(a) * r).toFixed(1)); c.setAttribute("cy", (p[1] + Math.sin(a) * r).toFixed(1));
      c.setAttribute("r", (0.6 + Math.random() * 1.2).toFixed(1)); c.setAttribute("fill", cor); c.setAttribute("opacity", 0.7 * opac);
      g.appendChild(c);
    }
  }

  // ───────────────── formas ─────────────────
  function criarForma() {
    const id = ferramenta.id;
    const tag = id === "elipse" ? "ellipse" : (id === "retangulo" ? "rect" : (id === "linha" ? "line" : (id === "coracao" ? "path" : "polygon")));
    const el = novoEl(tag);
    el.setAttribute("fill", id === "linha" ? "none" : "#ffffff");
    el.setAttribute("stroke", cor);
    el.setAttribute("stroke-width", Math.max(2, tam));
    el.setAttribute("stroke-linejoin", "round"); el.setAttribute("stroke-linecap", "round");
    el.setAttribute("opacity", opac);
    gDesenho.appendChild(el);
    return el;
  }
  function atualizarForma(el, a, b) {
    const id = ferramenta.id;
    const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = w / 2, ry = h / 2;
    if (id === "linha") { el.setAttribute("x1", a[0]); el.setAttribute("y1", a[1]); el.setAttribute("x2", b[0]); el.setAttribute("y2", b[1]); }
    else if (id === "retangulo") { el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("width", w); el.setAttribute("height", h); }
    else if (id === "elipse") { el.setAttribute("cx", cx); el.setAttribute("cy", cy); el.setAttribute("rx", rx); el.setAttribute("ry", ry); }
    else if (id === "coracao") { const R = Math.max(rx, ry); el.setAttribute("d", "M " + cx + " " + (cy + R * 0.6) + " C " + (cx - R) + " " + (cy - R * 0.1) + " " + (cx - R * 0.5) + " " + (cy - R * 0.85) + " " + cx + " " + (cy - R * 0.25) + " C " + (cx + R * 0.5) + " " + (cy - R * 0.85) + " " + (cx + R) + " " + (cy - R * 0.1) + " " + cx + " " + (cy + R * 0.6) + " Z"); }
    else { // poligonos
      const lados = id === "triangulo" ? 3 : (id === "estrela" ? 10 : 6);
      const R = Math.max(rx, ry), pts2 = [];
      for (let i = 0; i < lados; i++) { const ang = (i / lados) * Math.PI * 2 - Math.PI / 2; const rr = (id === "estrela" && i % 2) ? R * 0.45 : R; pts2.push((cx + Math.cos(ang) * rr).toFixed(1) + "," + (cy + Math.sin(ang) * rr).toFixed(1)); }
      el.setAttribute("points", pts2.join(" "));
    }
  }

  // ───────────────── eventos ─────────────────
  function onDown(ev) {
    ev.preventDefault();
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    const p = ptSvg(ev);
    if (ferramenta.classe === "borracha") { desenhando = true; apagarEm(ev); return; }
    desenhando = true; pts = [p];
    if (ferramenta.classe === "forma") { atual = criarForma(); atual.__a = p; atualizarForma(atual, p, p); return; }
    const b = PINCEIS[ferramenta.id];
    if (b.tipo === "spray") { atual = novoEl("g"); gDesenho.appendChild(atual); sprayDots(atual, p); }
    else { atual = iniciarTraco(p); atualizarTraco(); }
  }
  function onMove(ev) {
    if (!desenhando) return;
    const p = ptSvg(ev);
    if (ferramenta.classe === "borracha") { apagarEm(ev); return; }
    if (ferramenta.classe === "forma") { atualizarForma(atual, atual.__a, p); return; }
    pts.push(p);
    const b = PINCEIS[ferramenta.id];
    if (b.tipo === "spray") sprayDots(atual, p);
    else atualizarTraco();
  }
  function atualizarTraco() {
    const b = PINCEIS[ferramenta.id];
    if (b.tipo === "ribbon") atual.setAttribute("d", ribbonFromPoints(pts, Math.max(4, tam * 1.6)));
    else atual.setAttribute("d", pathFromPoints(pts));
  }
  function onUp(ev) {
    if (!desenhando) return;
    desenhando = false;
    if (atual) { undoOps.push({ tipo: "add", el: atual }); redoOps.length = 0; atualizarAcoes(); }
    atual = null; pts = [];
  }

  function apagarEm(ev) {
    const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!alvo) return;
    let n = alvo;
    while (n && n.parentNode && !(n.parentNode.classList && n.parentNode.classList.contains("desenho"))) n = n.parentNode;
    if (n && n.parentNode && n.parentNode.classList.contains("desenho")) {
      const next = n.nextSibling;
      n.parentNode.removeChild(n);
      undoOps.push({ tipo: "del", el: n, next: next }); redoOps.length = 0; atualizarAcoes();
    }
  }

  // ───────────────── desfazer / refazer / limpar ─────────────────
  function aplicar(op, desfazer) {
    const add = (op.tipo === "add") === !desfazer;
    if (add) { if (op.next && op.next.parentNode === gDesenho) gDesenho.insertBefore(op.el, op.next); else gDesenho.appendChild(op.el); }
    else { if (op.el.parentNode) op.el.parentNode.removeChild(op.el); }
  }
  function desfazer() { const op = undoOps.pop(); if (!op) return; aplicar(op, true); redoOps.push(op); atualizarAcoes(); }
  function refazer() { const op = redoOps.pop(); if (!op) return; aplicar(op, false); undoOps.push(op); atualizarAcoes(); }
  function limpar() { if (!gDesenho.childNodes.length) return; if (!confirm("Limpar todo o desenho?")) return; gDesenho.innerHTML = ""; undoOps.length = 0; redoOps.length = 0; atualizarAcoes(); }

  // ───────────────── fundo ─────────────────
  function setFundo(modo, svgString) {
    fundo = modo; if (svgString != null) fundoSvg = svgString;
    renderFundo();
  }
  function renderFundo() {
    let html = "";
    if (fundo !== "transparente") html += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    if (fundo === "atual" && fundoSvg) {
      const inner = window.Effects ? window.Effects.desmontar(fundoSvg).inner : "";
      html += '<g opacity="0.28" fill="#ffffff" stroke="#9aa0ad" stroke-width="2" style="pointer-events:none">' + inner + "</g>";
    }
    gFundo.innerHTML = html;
  }

  // ───────────────── UI ─────────────────
  function montarPinceis() {
    const box = $("d-pinceis"); box.innerHTML = "";
    Object.keys(PINCEIS).forEach((id) => {
      const b = document.createElement("button");
      b.className = "d-tool" + (ferramenta.classe === "pincel" && ferramenta.id === id || (id === "borracha" && ferramenta.classe === "borracha") ? " sel" : "");
      b.textContent = PINCEIS[id].nome;
      b.onclick = () => { ferramenta = { classe: id === "borracha" ? "borracha" : "pincel", id: id }; marcarSel(); };
      box.appendChild(b);
    });
  }
  function montarFormas() {
    const box = $("d-formas"); box.innerHTML = "";
    Object.keys(FORMAS).forEach((id) => {
      const b = document.createElement("button"); b.className = "d-tool";
      b.textContent = FORMAS[id];
      b.onclick = () => { ferramenta = { classe: "forma", id: id }; marcarSel(); };
      box.appendChild(b);
    });
  }
  function marcarSel() {
    [$("d-pinceis"), $("d-formas")].forEach((box) => box.querySelectorAll(".d-tool").forEach((b) => b.classList.remove("sel")));
    const ativo = ferramenta.classe === "borracha" ? PINCEIS.borracha.nome : (PINCEIS[ferramenta.id] ? PINCEIS[ferramenta.id].nome : FORMAS[ferramenta.id]);
    [$("d-pinceis"), $("d-formas")].forEach((box) => box.querySelectorAll(".d-tool").forEach((b) => { if (b.textContent === ativo) b.classList.add("sel"); }));
  }
  function montarCores() {
    const box = $("d-cores"); box.innerHTML = "";
    CORES.forEach((c) => { const b = document.createElement("button"); b.className = "swatch" + (c === cor ? " sel" : ""); b.style.background = c; if (c === "#ffffff") b.style.border = "2px solid #ccc"; b.onclick = () => { cor = c; box.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel")); b.classList.add("sel"); }; box.appendChild(b); });
    const ci = document.createElement("input"); ci.type = "color"; ci.className = "st-color"; ci.value = "#1b1b1b"; ci.title = "Cor personalizada";
    ci.oninput = () => { cor = ci.value; box.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel")); };
    box.appendChild(ci);
  }
  function montarAcoes() {
    const ac = $("d-acoes"); ac.innerHTML = "";
    const mk = (t, fn, cls) => { const b = document.createElement("button"); b.className = "btn" + (cls ? " " + cls : ""); b.textContent = t; b.onclick = fn; return b; };
    ac.appendChild(mk("💾 Salvar", () => { const nome = prompt("Nome:", "Meu desenho"); if (nome === null) return; window.STORAGE.salvar({ nome: nome || "Meu desenho", gerador: "desenho", areas: ["criativa", "motora", "visual"], params: {}, svg: getSVG(), dataISO: new Date().toISOString() }); toast("Salvo na coleção ✓"); }, "primario"));
    ac.appendChild(mk("📤 Compartilhar", () => { toast("Preparando…"); window.STORAGE.compartilhar(getSVG(), "desenho").then((r) => toast(r === "compartilhado" ? "Compartilhado ✓" : r === "baixado" ? "Baixado" : "Indisponível")); }));
    ac.appendChild(mk("⬇ PNG", () => window.STORAGE.baixarPNG(getSVG(), "desenho", 3)));
    ac.appendChild(mk("⬇ SVG", () => window.STORAGE.baixarSVG(getSVG(), "desenho")));
  }
  function atualizarAcoes() {
    if ($("d-desfazer")) $("d-desfazer").disabled = !undoOps.length;
    if ($("d-refazer")) $("d-refazer").disabled = !redoOps.length;
  }
  function getSVG() { return svg ? svg.outerHTML : null; }
  function setCor(c) { cor = c; }
  function setTam(t) { tam = t; }
  function setOpac(o) { opac = o; }
  function toast(m) { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1600); }

  return { init: init, desfazer: desfazer, refazer: refazer, limpar: limpar, setFundo: setFundo, setCor: setCor, setTam: setTam, setOpac: setOpac, getSVG: getSVG };
})();
