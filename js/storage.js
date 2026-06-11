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

  /* Baixa uma string SVG como arquivo .svg */
  function baixarSVG(svgString, nome) {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(URL.createObjectURL(blob), (nome || "desenho") + ".svg");
  }

  /* Rasteriza o SVG em PNG (alta resolução) e baixa */
  function baixarPNG(svgString, nome, escala) {
    escala = escala || 2;
    const img = new Image();
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * escala;
      canvas.height = img.height * escala;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        triggerDownload(URL.createObjectURL(blob), (nome || "desenho") + ".png");
      }, "image/png");
    };
    img.src = svg64;
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

  window.STORAGE = { salvar, remover, listar, baixarSVG, baixarPNG };
})();
