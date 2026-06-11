/*
 * storage.js — Coleção salva (localStorage) e exportação de arquivos.
 */
(function () {
  "use strict";
  const KEY = "desenhos_para_pintar_v1";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function persist(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function salvar(item) {
    // item: { nome, gerador, areas, params, svg, dataISO }
    const list = load();
    item.id = "d" + list.length + "_" + item.dataISO.replace(/[^0-9]/g, "").slice(0, 14);
    list.unshift(item);
    persist(list);
    return item.id;
  }
  function remover(id) {
    persist(load().filter((x) => x.id !== id));
  }
  function listar() {
    return load();
  }

  /* Importa itens de uma coleção (mescla; regenera id em caso de conflito). */
  function importar(itens) {
    if (!Array.isArray(itens)) return 0;
    const list = load();
    const ids = new Set(list.map((x) => x.id));
    let add = 0;
    itens.forEach((it) => {
      if (!it || !it.svg) return;
      let id = it.id || "imp_" + add + "_" + (it.dataISO || "").replace(/[^0-9]/g, "").slice(0, 12);
      while (ids.has(id)) id = id + "x";
      it.id = id; ids.add(id);
      list.unshift(it); add++;
    });
    persist(list);
    return add;
  }

  /* Baixa uma string SVG como arquivo .svg */
  function baixarSVG(svgString, nome) {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(URL.createObjectURL(blob), (nome || "desenho") + ".svg");
  }

  /* Rasteriza um SVG em PNG (alta resolução) e devolve um Blob (Promise). */
  function svgParaBlobPng(svgString, escala) {
    escala = escala || 2;
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        // sem fundo forçado: o próprio SVG traz o fundo (branco ou transparente)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("blob nulo")); }, "image/png");
      };
      img.onerror = reject;
      img.src = svg64;
    });
  }

  /* Baixa o SVG como PNG (escala 2 = boa qualidade; 3 = alta). */
  function baixarPNG(svgString, nome, escala) {
    svgParaBlobPng(svgString, escala || 2).then(function (blob) {
      triggerDownload(URL.createObjectURL(blob), (nome || "desenho") + ".png");
    });
  }

  /* Compartilha o desenho (PNG) via menu nativo do sistema (ótimo no celular).
     Sem suporte → baixa o PNG. Retorna Promise<"compartilhado"|"baixado"|"erro">. */
  function compartilhar(svgString, nome) {
    return svgParaBlobPng(svgString, 2).then(function (blob) {
      const file = new File([blob], (nome || "desenho") + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: "Meu desenho", text: "Feito no Desenhos para Pintar" }).then(function () { return "compartilhado"; });
      }
      triggerDownload(URL.createObjectURL(blob), (nome || "desenho") + ".png");
      return "baixado";
    }).catch(function () { return "erro"; });
  }

  /* Copia a imagem (PNG) para a área de transferência. */
  function copiarImagem(svgString) {
    if (!navigator.clipboard || !window.ClipboardItem) return Promise.resolve("erro");
    return svgParaBlobPng(svgString, 2).then(function (blob) {
      return navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(function () { return "copiado"; });
    }).catch(function () { return "erro"; });
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  window.STORAGE = { salvar, remover, listar, importar, baixarSVG, baixarPNG, compartilhar, copiarImagem };
})();
