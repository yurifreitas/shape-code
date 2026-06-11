/*
 * editor.js — Editor da cena "Montar": selecionar, arrastar, escalar, girar,
 * camadas, duplicar, excluir, adicionar e auto-alinhar elementos.
 *
 * Opera sobre uma cena estruturada (window.buildScene) e re-desenha via
 * window.renderScene. Cada elemento tem semente própria, então move/escala
 * sem mudar a aparência.
 */
window.SceneEditor = (function () {
  "use strict";
  let scene = null, host = null, sel = -1, onChange = null, active = false, drag = null;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function mount(hostEl, sc, cb) {
    scene = sc; host = hostEl; sel = -1; onChange = cb || null; active = true;
    render();
  }
  function unmount() { active = false; drag = null; }
  function getScene() { return scene; }
  function setScene(sc) { scene = sc; sel = -1; render(); }
  function getSVG() { const s = svgEl(); return s ? s.outerHTML : null; }
  function temSelecao() { return sel >= 0; }
  function svgEl() { return host && host.querySelector("svg"); }

  function render() {
    if (!host) return;
    host.innerHTML = window.renderScene(scene, sel);
    if (active) bind();
    if (onChange) onChange();
  }

  function bind() {
    const svg = svgEl();
    if (!svg) return;
    svg.style.touchAction = "none";
    svg.addEventListener("pointerdown", onDown);
  }

  function toSvg(svg, ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function onDown(ev) {
    const svg = svgEl();
    const g = ev.target.closest(".elemento");
    if (!g) { if (sel !== -1) { sel = -1; render(); } return; }
    const i = +g.getAttribute("data-i");
    if (scene.placements[i] && scene.placements[i].travado) { if (sel !== -1) { sel = -1; render(); } return; }
    sel = i;
    svg.querySelectorAll(".elemento.sel").forEach((e) => e.classList.remove("sel"));
    g.classList.add("sel");
    if (onChange) onChange();
    const start = toSvg(svg, ev);
    drag = { g: g, i: i, sx: start.x, sy: start.y, moved: false };
    try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag) return;
    const svg = svgEl();
    const cur = toSvg(svg, ev);
    const dx = cur.x - drag.sx, dy = cur.y - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const p = scene.placements[drag.i];
    drag.g.setAttribute("transform", "translate(" + dx.toFixed(2) + " " + dy.toFixed(2) + ")" + (p.rot ? " rotate(" + p.rot + " " + p.x + " " + p.y + ")" : ""));
  }
  function onUp(ev) {
    const svg = svgEl();
    if (drag) {
      const cur = toSvg(svg, ev);
      const p = scene.placements[drag.i];
      p.x += cur.x - drag.sx; p.y += cur.y - drag.sy;
      snap(p);
      drag = null;
      render();
    }
    if (svg) { svg.removeEventListener("pointermove", onMove); svg.removeEventListener("pointerup", onUp); }
  }

  function snap(p) {
    const gy = scene.groundY, W = scene.W, H = scene.H;
    p.x = clamp(p.x, 18, W - 18);
    if (p.cat === "ceu") p.y = clamp(p.y, 40, gy - 130);
    else if (p.cat === "agua") p.y = clamp(p.y, gy + 8, H - 24);
    else p.y = clamp(p.y, gy - 14, gy + 80); // chão: encaixa na linha do solo
    p.sortY = p.y;
  }

  function op(fn) { if (sel < 0) return; fn(scene.placements[sel]); render(); }
  function escalar(f) { op((p) => { p.s = clamp(p.s * f, 0.2, 3.2); }); }
  function girar(d) { op((p) => { p.rot = (p.rot + d) % 360; }); }
  function excluir() { if (sel < 0) return; scene.placements.splice(sel, 1); sel = -1; render(); }
  function duplicar() {
    if (sel < 0) return;
    const c = Object.assign({}, scene.placements[sel]);
    c.x += 28; c.y += 8; c.seed = (Math.random() * 1e9) | 0; snap(c);
    scene.placements.splice(sel + 1, 0, c); sel += 1; render();
  }
  function frente() { if (sel < 0) return; const p = scene.placements.splice(sel, 1)[0]; scene.placements.push(p); sel = scene.placements.length - 1; render(); }
  function tras() { if (sel < 0) return; const p = scene.placements.splice(sel, 1)[0]; scene.placements.unshift(p); sel = 0; render(); }

  function adicionar(id) {
    if (!window.ELEMENTS[id]) return;
    const gy = scene.groundY, cat = window.ELEMENTS[id].cat;
    const y = cat === "ceu" ? 120 : cat === "agua" ? gy + 60 : gy;
    const p = window.novoPlacement(id, scene.W / 2 + (Math.random() - 0.5) * 120, y);
    scene.placements.push(p); sel = scene.placements.length - 1; render();
  }

  /* Auto-alinhar: empacotamento 1D com GAPS IGUAIS (ponto fixo da relaxação de
     Lloyd em 1D) respeitando a largura real de cada elemento → distribuição
     matematicamente uniforme e sem sobreposição. Se não couber, reduz a escala
     proporcionalmente (auto-ajuste). */
  function packRow(arr, y, jitterY) {
    if (!arr.length) return;
    const W = scene.W, m = 46, span = W - 2 * m;
    let total = arr.reduce((s, p) => s + 2 * (p.rad || 40), 0);
    if (total > span * 0.94) { // não cabe: encolhe tudo proporcionalmente
      const f = (span * 0.9) / total;
      arr.forEach((p) => { p.s *= f; p.rad = (p.rad || 40) * f; });
      total = arr.reduce((s, p) => s + 2 * (p.rad || 40), 0);
    }
    const gap = Math.max(6, (span - total) / (arr.length + 1));
    let x = m + gap;
    arr.forEach((p, k) => {
      p.x = x + (p.rad || 40); x += 2 * (p.rad || 40) + gap;
      p.y = y + (jitterY ? (k % 2 ? jitterY : 0) : 0);
      p.sortY = p.y;
    });
  }
  function autoArranjar() {
    const gy = scene.groundY;
    const cats = { ceu: [], chao: [], agua: [] };
    scene.placements.forEach((p) => (cats[p.cat] || cats.chao).push(p));
    cats.chao.sort((a, b) => b.rad - a.rad); // maiores ao fundo (profundidade)
    packRow(cats.chao, gy, 0);
    packRow(cats.ceu, 112, 54);
    packRow(cats.agua, gy + 46, 38);
    scene.placements = cats.ceu.concat(cats.chao, cats.agua); // z: céu→chão→água
    sel = -1; render();
  }

  /* Separar: empurra elementos sobrepostos até não se tocarem (relaxação). */
  function centroCol(p) { return { x: p.x, y: p.cat === "chao" ? p.y - (p.rad || 40) * 0.55 : p.y }; }
  function separar() {
    const pl = scene.placements;
    for (let it = 0; it < 30; it++) {
      let mexeu = false;
      for (let i = 0; i < pl.length; i++) {
        for (let j = i + 1; j < pl.length; j++) {
          const a = pl[i], b = pl[j], ca = centroCol(a), cb = centroCol(b);
          let dx = cb.x - ca.x, dy = cb.y - ca.y;
          const ambosChao = a.cat === "chao" && b.cat === "chao";
          if (ambosChao) dy = 0; // no chão, empurra só na horizontal (mantém base)
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const min = (a.rad || 40) + (b.rad || 40) - 6;
          if (d < min) {
            const push = (min - d) / 2; dx /= d; dy /= d;
            a.x -= dx * push; a.y -= dy * push;
            b.x += dx * push; b.y += dy * push;
            mexeu = true;
          }
        }
      }
      pl.forEach(snap);
      if (!mexeu) break;
    }
    sel = -1; render();
  }

  /* Embaralhar mantém ids/temas, só re-sorteia posições/escala/rotação. */
  function embaralhar() {
    const W = scene.W, gy = scene.groundY, H = scene.H;
    scene.placements.forEach((p) => {
      if (p.cat === "ceu") { p.x = 70 + Math.random() * (W - 140); p.y = 50 + Math.random() * (gy - 220); }
      else if (p.cat === "agua") { p.x = 60 + Math.random() * (W - 120); p.y = gy + 20 + Math.random() * (H - gy - 50); }
      else { const d = Math.random(); p.x = 40 + Math.random() * (W - 80); p.y = gy - 6 + d * 70; p.s = (0.55 + d * 0.75) * (window.ELEMENTS[p.id].scale || 1); p.rot = (Math.random() - 0.5) * 18; }
      p.sortY = p.y;
    });
    scene.placements.sort((a, b) => a.sortY - b.sortY);
    sel = -1; render();
  }

  // ----- camadas -----
  function getPlacements() { return scene ? scene.placements : []; }
  function selIndice() { return sel; }
  function selecionarIndice(i) { sel = i; render(); }
  function setOculto(i, val) { if (scene.placements[i]) { scene.placements[i].oculto = val; render(); } }
  function setTravado(i, val) { if (scene.placements[i]) { scene.placements[i].travado = val; render(); } }
  function moverCamada(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= scene.placements.length) return;
    const tmp = scene.placements[i]; scene.placements[i] = scene.placements[j]; scene.placements[j] = tmp;
    if (sel === i) sel = j; else if (sel === j) sel = i;
    render();
  }

  return {
    mount, unmount, getScene, setScene, getSVG, render, temSelecao,
    escalar, girar, excluir, duplicar, frente, tras, adicionar, autoArranjar, embaralhar, separar,
    getPlacements, selIndice, selecionarIndice, setOculto, setTravado, moverCamada,
  };
})();
