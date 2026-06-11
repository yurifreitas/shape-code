/*
 * batch.js — Geração em massa por RECEITA: o usuário monta uma lista
 * "5× Gerador A, 3× Gerador B…", gera tudo (sementes aleatórias) numa galeria
 * para revisar, e exporta o lote inteiro em PDF ou separado (PNG/SVG).
 */
window.Batch = (function () {
  "use strict";
  let cancel = false, rodando = false, resultados = [];

  // cfg: { receita:[{gid, genFn, baseOpts, n, heavy}], grid, status, onOpen, onSave }
  function runRecipe(cfg) {
    cancel = false; rodando = true; resultados = [];
    cfg.grid.innerHTML = "";
    const tasks = [];
    cfg.receita.forEach((r) => { for (let i = 0; i < r.n; i++) tasks.push(r); });
    let done = 0;

    function step(i) {
      if (cancel || i >= tasks.length) {
        rodando = false;
        cfg.status.textContent = cancel ? "Cancelado — " + done + " gerados" : "Pronto — " + done + " desenhos. Exporte em PDF ou separado.";
        return;
      }
      const r = tasks[i], seed = (Math.random() * 1e9) | 0;
      const opts = Object.assign({}, r.baseOpts, { seed: seed });
      let svg = null;
      try { svg = r.genFn(opts); } catch (e) { svg = null; }
      if (svg) { resultados.push({ svg: svg, gid: r.gid, seed: seed }); addCard(svg, opts, r.gid, cfg); }
      done++;
      cfg.status.textContent = "Gerando " + done + "/" + tasks.length + "…";
      setTimeout(function () { step(i + 1); }, r.heavy ? 8 : 0);
    }
    step(0);
  }

  function addCard(svg, opts, gid, cfg) {
    const card = document.createElement("div");
    card.className = "batch-card";
    const thumb = document.createElement("div");
    thumb.className = "batch-thumb"; thumb.innerHTML = svg; thumb.title = gid;
    thumb.onclick = function () { cfg.onOpen(svg, opts, gid); };
    const acoes = document.createElement("div");
    acoes.className = "batch-acoes";
    const bSave = botao("♥", "Salvar na coleção", function () { cfg.onSave(svg, opts, gid); bSave.classList.add("feito"); bSave.textContent = "✓"; });
    acoes.appendChild(botao("Abrir", "Abrir", function () { cfg.onOpen(svg, opts, gid); }));
    acoes.appendChild(bSave);
    acoes.appendChild(botao("PNG", "Baixar PNG", function () { window.STORAGE.baixarPNG(svg, gid + "-" + opts.seed); }));
    const tag = document.createElement("span"); tag.className = "batch-tag"; tag.textContent = gid;
    card.appendChild(thumb); card.appendChild(tag); card.appendChild(acoes);
    cfg.grid.appendChild(card);
  }

  // Exporta o lote inteiro como PDF (janela de impressão, 1 desenho por página).
  function exportarPDF() {
    if (!resultados.length) return;
    const w = window.open("", "_blank");
    const paginas = resultados.map((r) => '<div class="pg">' + r.svg + "</div>").join("");
    w.document.write('<html><head><title>Lote de desenhos</title><style>@page{margin:8mm}body{margin:0}.pg{page-break-after:always;display:flex;align-items:center;justify-content:center;min-height:96vh}svg{width:100%;max-width:185mm;height:auto}</style></head><body>' + paginas + "<scr" + "ipt>window.onload=function(){window.print();}</scr" + "ipt></body></html>");
    w.document.close();
  }

  // Baixa cada desenho separado (downloads espaçados p/ não serem bloqueados).
  function baixarTodos(fmt) {
    resultados.forEach((r, i) => setTimeout(function () {
      const nome = r.gid + "-" + r.seed;
      if (fmt === "svg") window.STORAGE.baixarSVG(r.svg, nome); else window.STORAGE.baixarPNG(r.svg, nome);
    }, i * 350));
  }

  function botao(txt, title, fn) { const b = document.createElement("button"); b.textContent = txt; b.title = title; b.onclick = fn; return b; }
  function stop() { cancel = true; }
  function ativo() { return rodando; }
  function temResultados() { return resultados.length; }

  return { runRecipe: runRecipe, exportarPDF: exportarPDF, baixarTodos: baixarTodos, stop: stop, ativo: ativo, temResultados: temResultados };
})();
