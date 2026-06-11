/*
 * effects.js — Efeitos manipuláveis aplicados sobre qualquer SVG gerado, ao
 * vivo (sem re-rodar o gerador). Mantém as regiões pintáveis.
 *
 * fx = {
 *   espessura: 1,        // multiplicador da espessura do traço (0.3..3)
 *   corTraco: "#1b1b1b",
 *   corFundo: "#ffffff",
 *   rascunho: 0,         // 0..3 — traço irregular (feTurbulence + displacement)
 *   ondular: 0,          // 0..3 — distorção orgânica
 *   simetria: "none",    // none | h | v | quad | radial6 | radial8
 * }
 */
window.Effects = (function () {
  "use strict";

  const PADRAO = { espessura: 1, corTraco: "#1b1b1b", corFundo: "#ffffff", rascunho: 0, ondular: 0, simetria: "none" };

  function novo() { return Object.assign({}, PADRAO); }

  /* Extrai viewBox, fundo e conteúdo interno do SVG gerado (estrutura fixa do wrap). */
  function desmontar(svg) {
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const W = vb ? +vb[1] : 720, H = vb ? +vb[2] : 720;
    const gOpen = svg.match(/<g fill="#ffffff" stroke="#1b1b1b"[^>]*>/);
    let inner = "", bg = "#ffffff";
    if (gOpen) {
      const start = svg.indexOf(gOpen[0]) + gOpen[0].length;
      const end = svg.lastIndexOf("</g></svg>");
      inner = svg.slice(start, end >= 0 ? end : undefined);
    }
    const bgm = svg.match(/<rect class="bg"[^>]*fill="([^"]+)"/);
    if (bgm) bg = bgm[1];
    return { W: W, H: H, inner: inner, bg: bg };
  }

  function aplicar(svg, fx) {
    if (!fx) return svg;
    const d = desmontar(svg);
    if (!d.inner) return svg;
    const W = d.W, H = d.H, cx = W / 2, cy = H / 2;
    const sw = (2.2 * (fx.espessura || 1)).toFixed(2);
    const stroke = fx.corTraco || "#1b1b1b";
    const bg = fx.corFundo || d.bg || "#ffffff";

    // filtro de traço irregular / ondulação
    let defs = "", filtro = "";
    const amp = (fx.rascunho || 0) * 2.2 + (fx.ondular || 0) * 6;
    if (amp > 0.1) {
      const freq = (fx.ondular > 0 ? 0.006 + fx.ondular * 0.004 : 0.03 + (fx.rascunho || 0) * 0.01).toFixed(4);
      defs = '<defs><filter id="fx" x="-15%" y="-15%" width="130%" height="130%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="2" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + amp.toFixed(1) + '" xChannelSelector="R" yChannelSelector="G"/>' +
        "</filter></defs>";
      filtro = ' filter="url(#fx)"';
    }

    // grupos com simetria (cópias espelhadas/radiais do conteúdo)
    const estilo = 'fill="#ffffff" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"';
    const corpo = (transform) => "<g" + (transform ? ' transform="' + transform + '"' : "") + ">" + d.inner + "</g>";
    let conteudo = "";
    const sim = fx.simetria || "none";
    if (sim === "h") conteudo = corpo() + corpo("matrix(-1,0,0,1," + W + ",0)");
    else if (sim === "v") conteudo = corpo() + corpo("matrix(1,0,0,-1,0," + H + ")");
    else if (sim === "quad") conteudo = corpo() + corpo("matrix(-1,0,0,1," + W + ",0)") + corpo("matrix(1,0,0,-1,0," + H + ")") + corpo("matrix(-1,0,0,-1," + W + "," + H + ")");
    else if (sim === "radial6" || sim === "radial8") {
      const k = sim === "radial6" ? 6 : 8;
      const copias = [];
      for (let i = 0; i < k; i++) copias.push(corpo("rotate(" + ((360 / k) * i).toFixed(2) + " " + cx + " " + cy + ")"));
      conteudo = copias.join("");
    } else conteudo = d.inner;

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' +
      defs +
      '<rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '" fill="' + bg + '"/>' +
      "<g " + estilo + filtro + ">" + conteudo + "</g></svg>";
  }

  return { novo: novo, aplicar: aplicar, desmontar: desmontar, PADRAO: PADRAO };
})();
