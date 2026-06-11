/*
 * zoom.js — Zoom e pan (arrastar) sobre o canvas, para pintar/desenhar de perto.
 * Aplica transform CSS no alvo. Pinça com 2 dedos (zoom+pan), roda do mouse,
 * botões (+/−/reset) e um modo "mover" (✋). Enquanto move/pinça, marca
 * window.__zoomPanning para a pintura não disparar sem querer.
 */
window.ZoomPan = (function () {
  "use strict";
  function attach(container, target) {
    let scale = 1, tx = 0, ty = 0, panMode = false;
    const pts = new Map();
    let pinch = 0, last = null;

    function apply() { target.style.transformOrigin = "center center"; target.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + scale.toFixed(3) + ")"; }
    function clamp() { scale = Math.max(1, Math.min(6, scale)); if (scale === 1) { tx = 0; ty = 0; } }
    function zoom(f) { scale *= f; clamp(); apply(); }
    function reset() { scale = 1; tx = 0; ty = 0; apply(); }
    function setPan(v) { panMode = v; container.style.cursor = v ? "grab" : ""; }
    function dist() { const a = Array.from(pts.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    function mid() { const a = Array.from(pts.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; }

    container.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    container.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { pinch = dist(); last = mid(); window.__zoomPanning = true; }
      else if (panMode) { last = { x: e.clientX, y: e.clientY }; window.__zoomPanning = true; container.style.cursor = "grabbing"; }
    });
    container.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const d = dist(); if (pinch) { zoom(d / pinch); pinch = d; }
        const m = mid(); if (last) { tx += m.x - last.x; ty += m.y - last.y; apply(); } last = m;
      } else if (panMode && last) { tx += e.clientX - last.x; ty += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; apply(); }
    });
    function end(e) {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (pts.size === 0) { last = null; if (panMode) container.style.cursor = "grab"; setTimeout(() => { window.__zoomPanning = false; }, 60); }
    }
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);
    container.addEventListener("pointerleave", end);
    apply();

    return {
      zoomIn: () => zoom(1.25), zoomOut: () => zoom(1 / 1.25), reset: reset,
      togglePan: () => { setPan(!panMode); return panMode; }, setPan: setPan,
      get scale() { return scale; },
    };
  }
  return { attach: attach };
})();
