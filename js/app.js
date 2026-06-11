/*
 * app.js — Controlador da interface.
 * Liga o dataset (window.COLORING_DATASET), os geradores (window.GENERATORS)
 * e o armazenamento (window.STORAGE).
 */
(function () {
  "use strict";

  const DATA = window.COLORING_DATASET;
  // Registro unificado: geradores procedurais + geradores de campo (algoritmos do usuário)
  const GEN = Object.assign({}, window.GENERATORS, window.FIELD_GENERATORS || {});
  const PESADOS = { reacaodifusao: 1, geometriasagrada: 1, campovetorial: 1 }; // exigem overlay (síncronos lentos)
  const $ = (id) => document.getElementById(id);

  const PALETA = [
    "#e63946", "#f4a261", "#ffbe0b", "#ffd166", "#06d6a0", "#2a9d8f",
    "#3a86ff", "#4361ee", "#9b5de5", "#ff6392", "#7f5539", "#000000",
    "#ffffff", "#8d99ae",
  ];

  const estado = {
    geradorId: DATA.geradores[0].id,
    params: {},
    seed: 12345,
    cor: "#e63946",
    modo: "pintar", // pintar | borracha
    scene: null, // cena estruturada atual (gerador "cena")
    cenaModo: "editar", // editar | pintar (só p/ cena)
    fx: window.Effects ? window.Effects.novo() : null, // efeitos manipuláveis
    baseSVG: null, // SVG gerado antes dos efeitos (p/ reaplicar ao vivo)
    corA: "#e63946", corB: "#3a86ff", slot: "A", degrade: false, textura: "solido", // mistura de cores
  };

  // paletas grandes p/ exploração infantil
  const PALETAS = {
    "Vibrantes": ["#e63946", "#ff6b35", "#f4a261", "#ffbe0b", "#ffd166", "#06d6a0", "#2a9d8f", "#1d9bf0", "#3a86ff", "#4361ee", "#7209b7", "#9b5de5", "#ff6392", "#ff85a1"],
    "Pastéis": ["#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff", "#bdb2ff", "#ffc6ff", "#fcd5ce", "#d8f3dc"],
    "Terra & Neutros": ["#7f5539", "#9c6644", "#582f0e", "#386641", "#6a994e", "#bc6c25", "#283618", "#6c757d", "#000000", "#ffffff"],
  };

  // ───────── utilidades de cor ─────────
  function hslParaHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
    return "#" + to(c(0)) + to(c(8)) + to(c(4));
  }
  function hexParaRgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function misturarHex(a, b) { const x = hexParaRgb(a), y = hexParaRgb(b); const to = (v) => Math.round(v).toString(16).padStart(2, "0"); return "#" + to((x[0] + y[0]) / 2) + to((x[1] + y[1]) / 2) + to((x[2] + y[2]) / 2); }
  function garantirGradiente(svg, a, b) {
    const NS = "http://www.w3.org/2000/svg";
    const id = "grad_" + a.replace("#", "") + "_" + b.replace("#", "");
    let defs = svg.querySelector("defs");
    if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
    if (!defs.querySelector("#" + id)) {
      const lg = document.createElementNS(NS, "linearGradient");
      lg.setAttribute("id", id); lg.setAttribute("x1", "0"); lg.setAttribute("y1", "0"); lg.setAttribute("x2", "1"); lg.setAttribute("y2", "1");
      [[0, a], [1, b]].forEach((st) => { const s = document.createElementNS(NS, "stop"); s.setAttribute("offset", st[0]); s.setAttribute("stop-color", st[1]); lg.appendChild(s); });
      defs.appendChild(lg);
    }
    return id;
  }
  function garantirTextura(svg, tipo, fg) {
    const NS = "http://www.w3.org/2000/svg";
    const id = "tex_" + tipo + "_" + fg.replace("#", "");
    let defs = svg.querySelector("defs");
    if (!defs) { defs = document.createElementNS(NS, "defs"); svg.insertBefore(defs, svg.firstChild); }
    if (!defs.querySelector("#" + id)) {
      let inner = "";
      if (tipo === "listrado") inner = '<rect width="12" height="12" fill="#ffffff"/><rect width="6" height="12" fill="' + fg + '"/>';
      else if (tipo === "bolinhas") inner = '<rect width="16" height="16" fill="#ffffff"/><circle cx="8" cy="8" r="4" fill="' + fg + '"/>';
      else inner = '<rect width="20" height="20" fill="#ffffff"/><rect width="10" height="10" fill="' + fg + '"/><rect x="10" y="10" width="10" height="10" fill="' + fg + '"/>';
      const size = tipo === "xadrez" ? 20 : (tipo === "bolinhas" ? 16 : 12);
      const p = document.createElementNS(NS, "pattern");
      p.setAttribute("id", id); p.setAttribute("width", size); p.setAttribute("height", size); p.setAttribute("patternUnits", "userSpaceOnUse");
      if (tipo === "listrado") p.setAttribute("patternTransform", "rotate(45)");
      p.innerHTML = inner;
      defs.appendChild(p);
    }
    return id;
  }
  const ehCena = () => estado.geradorId === "cena" && window.SceneEditor;
  let layersVisivel = false;

  // Aplica os efeitos sobre o SVG-base e injeta no palco (mantém regiões pintáveis).
  function mostrarSVG(baseSvg) {
    estado.baseSVG = baseSvg;
    const out = window.Effects ? window.Effects.aplicar(baseSvg, estado.fx) : baseSvg;
    const host = $("svg-host");
    host.innerHTML = out;
    ligarRegioes(host.querySelector("svg"));
  }
  // Reaplica efeitos sem re-rodar o gerador (rápido). Não age na edição da cena.
  function reaplicarEfeitos() {
    if (ehCena() && estado.cenaModo === "editar") return;
    if (estado.baseSVG) mostrarSVG(estado.baseSVG);
  }

  function dataISO() {
    // Date pode ser usado no navegador (a restrição é só p/ workflows).
    return new Date().toISOString();
  }

  // ───────────────────────────── ÁREAS / CHIPS ─────────────────────────
  function chipArea(chave) {
    const a = DATA.areasCerebro[chave];
    if (!a) return "";
    return '<span class="chip" style="--c:' + a.cor + '" title="' + a.regiao + " — " + a.estimulo + '">' + a.nome + "</span>";
  }

  // ───────────────────────── LISTA DE GERADORES ────────────────────────
  function renderGeradores() {
    const box = $("lista-geradores");
    box.innerHTML = "";
    DATA.geradores.forEach((g) => {
      const card = document.createElement("button");
      card.className = "gerador-card" + (g.id === estado.geradorId ? " ativo" : "");
      card.innerHTML =
        '<span class="g-icone">' + g.icone + "</span>" +
        '<span class="g-nome">' + g.nome + "</span>";
      card.onclick = () => {
        estado.geradorId = g.id;
        estado.params = {};
        renderGeradores();
        renderPainel();
        gerar(true);
      };
      box.appendChild(card);
    });
  }

  function geradorAtual() {
    return DATA.geradores.find((g) => g.id === estado.geradorId);
  }

  // ─────────────────────────── PAINEL DE PARÂMETROS ─────────────────────
  function renderPainel() {
    const g = geradorAtual();
    $("g-titulo").textContent = g.icone + "  " + g.nome;
    $("g-descricao").textContent = g.descricao;
    $("g-faixa").textContent = "Idade " + g.faixaEtaria + " anos";
    $("g-porque").textContent = g.porque;
    $("g-algoritmo").innerHTML = g.algoritmo ? "⚙️ Algoritmo: <code>" + escapeHtml(g.algoritmo) + "</code>" : "";
    $("g-algoritmo").style.display = g.algoritmo ? "block" : "none";
    $("g-areas").innerHTML = g.areas.map(chipArea).join("");

    const box = $("painel-params");
    box.innerHTML = "";
    Object.keys(g.params || {}).forEach((nome) => {
      const p = g.params[nome];
      if (estado.params[nome] === undefined) estado.params[nome] = p.padrao;
      const wrap = document.createElement("div");
      wrap.className = "campo";

      if (p.tipo === "range") {
        wrap.innerHTML =
          '<label>' + p.rotulo + ' <b id="v-' + nome + '">' + estado.params[nome] + "</b></label>";
        const inp = document.createElement("input");
        inp.type = "range";
        inp.min = p.min; inp.max = p.max; inp.value = estado.params[nome];
        inp.oninput = () => {
          estado.params[nome] = +inp.value;
          $("v-" + nome).textContent = inp.value;
          gerar(false);
        };
        wrap.appendChild(inp);
      } else if (p.tipo === "select") {
        wrap.innerHTML = "<label>" + p.rotulo + "</label>";
        const sel = document.createElement("select");
        p.opcoes.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o; opt.textContent = o;
          if (o === estado.params[nome]) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { estado.params[nome] = sel.value; gerar(false); };
        wrap.appendChild(sel);
      } else if (p.tipo === "multi") {
        wrap.innerHTML = "<label>" + p.rotulo + "</label>";
        const grid = document.createElement("div");
        grid.className = "multi-grid";
        if (!Array.isArray(estado.params[nome])) estado.params[nome] = p.padrao.slice();
        p.opcoes.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "multi-btn" + (estado.params[nome].includes(o) ? " on" : "");
          b.textContent = o;
          b.onclick = () => {
            const arr = estado.params[nome];
            const i = arr.indexOf(o);
            if (i >= 0) arr.splice(i, 1); else arr.push(o);
            b.classList.toggle("on");
            gerar(false);
          };
          grid.appendChild(b);
        });
        wrap.appendChild(grid);
      }
      box.appendChild(wrap);
    });
  }

  // ───────────────────────────── GERAR DESENHO ─────────────────────────
  function gerar(novaSemente) {
    if (novaSemente) estado.seed = Math.floor(Math.random() * 1e9);
    const g = geradorAtual();
    const opts = Object.assign({ seed: estado.seed }, estado.params);

    // Cena: monta estrutura editável e abre no editor (ou modo pintar)
    if (ehCena() && window.buildScene) {
      mostrarCenaTools(true);
      estado.scene = window.buildScene(opts);
      $("carregando").style.display = "none";
      aplicarCenaModo();
      return;
    }
    mostrarCenaTools(false);

    const render = () => {
      mostrarSVG(GEN[g.id](opts));
      $("carregando").style.display = "none";
    };
    if (PESADOS[g.id]) {
      $("carregando").style.display = "flex";
      setTimeout(render, 30);
    } else {
      render();
    }
  }

  // ───────────────────────── EDITOR DE CENA ────────────────────────────
  function mostrarCenaTools(mostrar) {
    $("cena-tools").style.display = mostrar ? "" : "none";
    if (!mostrar) {
      if (window.SceneEditor) window.SceneEditor.unmount();
      layersVisivel = false;
      $("layers-panel").style.display = "none";
      $("add-panel").style.display = "none";
    }
  }

  function onCenaChange() {
    atualizarSelInfo();
    if (layersVisivel) renderCamadas();
  }

  function aplicarCenaModo() {
    const ed = window.SceneEditor;
    $("modo-editar").classList.toggle("ativo", estado.cenaModo === "editar");
    $("modo-pintar").classList.toggle("ativo", estado.cenaModo === "pintar");
    $("edit-acoes").style.display = estado.cenaModo === "editar" ? "" : "none";
    if (estado.cenaModo === "editar") {
      ed.mount($("svg-host"), estado.scene, onCenaChange);
    } else {
      ed.unmount();
      mostrarSVG(window.renderScene(estado.scene, -1)); // pintar: aplica efeitos
      $("add-panel").style.display = "none";
      $("layers-panel").style.display = "none";
    }
  }

  function atualizarSelInfo() {
    const tem = window.SceneEditor.temSelecao();
    $("sel-info").textContent = tem ? "Elemento selecionado — arraste para mover" : "Toque num elemento para selecionar";
    $("edit-acoes").classList.toggle("tem-sel", tem);
  }

  // ───────────────────────── PAINEL DE CAMADAS ─────────────────────────
  function renderCamadas() {
    const box = $("layers-panel");
    const pl = window.SceneEditor.getPlacements();
    const sel = window.SceneEditor.selIndice();
    if (!pl.length) { box.innerHTML = '<div class="vazia-mini">Sem elementos na cena</div>'; return; }
    let html = "";
    for (let i = pl.length - 1; i >= 0; i--) { // topo = frente (fim do array)
      const p = pl[i], nome = (window.ELEMENTS[p.id] || {}).nome || p.id;
      html += '<div class="layer-row' + (i === sel ? " sel" : "") + '" data-i="' + i + '">' +
        '<button data-act="vis" title="Mostrar/ocultar">' + (p.oculto ? "🙈" : "👁") + "</button>" +
        '<button data-act="lock" title="Travar">' + (p.travado ? "🔒" : "🔓") + "</button>" +
        '<span data-act="sel" class="ly-nome">' + escapeHtml(nome) + "</span>" +
        '<button data-act="up" title="Subir">▲</button>' +
        '<button data-act="down" title="Descer">▼</button></div>';
    }
    box.innerHTML = html;
    box.querySelectorAll(".layer-row").forEach((row) => {
      const i = +row.getAttribute("data-i");
      row.querySelector('[data-act="vis"]').onclick = () => window.SceneEditor.setOculto(i, !pl[i].oculto);
      row.querySelector('[data-act="lock"]').onclick = () => window.SceneEditor.setTravado(i, !pl[i].travado);
      row.querySelector('[data-act="sel"]').onclick = () => window.SceneEditor.selecionarIndice(i);
      row.querySelector('[data-act="up"]').onclick = () => window.SceneEditor.moverCamada(i, 1);
      row.querySelector('[data-act="down"]').onclick = () => window.SceneEditor.moverCamada(i, -1);
    });
  }

  // ───────────────────────── EFEITOS (UI) ──────────────────────────────
  function bindEfeitos() {
    const fx = estado.fx;
    $("fx-escala").oninput = function () { fx.escala = +this.value / 100; $("fx-escala-v").textContent = fx.escala.toFixed(1); reaplicarEfeitos(); };
    $("fx-rotacao").oninput = function () { fx.rotacao = +this.value; $("fx-rotacao-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-inclinar").oninput = function () { fx.inclinar = +this.value; $("fx-inclinar-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-espessura").oninput = function () { fx.espessura = +this.value / 100; $("fx-espessura-v").textContent = fx.espessura.toFixed(1); reaplicarEfeitos(); };
    $("fx-simetria").onchange = function () { fx.simetria = this.value; reaplicarEfeitos(); };
    $("fx-rascunho").oninput = function () { fx.rascunho = +this.value; $("fx-rascunho-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-ondular").oninput = function () { fx.ondular = +this.value; $("fx-ondular-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-cor-traco").oninput = function () { fx.corTraco = this.value; reaplicarEfeitos(); };
    $("fx-fundo").onchange = function () { fx.fundo = this.value; reaplicarEfeitos(); };
    $("fx-reset").onclick = function () { estado.fx = window.Effects.novo(); sincronizarEfeitosUI(); reaplicarEfeitos(); };
    sincronizarEfeitosUI();
  }
  function sincronizarEfeitosUI() {
    const fx = estado.fx;
    $("fx-escala").value = Math.round((fx.escala == null ? 1 : fx.escala) * 100); $("fx-escala-v").textContent = (fx.escala == null ? 1 : fx.escala).toFixed(1);
    $("fx-rotacao").value = fx.rotacao || 0; $("fx-rotacao-v").textContent = fx.rotacao || 0;
    $("fx-inclinar").value = fx.inclinar || 0; $("fx-inclinar-v").textContent = fx.inclinar || 0;
    $("fx-espessura").value = Math.round(fx.espessura * 100); $("fx-espessura-v").textContent = fx.espessura.toFixed(1);
    $("fx-simetria").value = fx.simetria;
    $("fx-rascunho").value = fx.rascunho; $("fx-rascunho-v").textContent = fx.rascunho;
    $("fx-ondular").value = fx.ondular; $("fx-ondular-v").textContent = fx.ondular;
    $("fx-cor-traco").value = fx.corTraco; $("fx-fundo").value = fx.fundo || "branco";
  }

  function renderAddPanel() {
    const box = $("add-panel");
    if (box.dataset.feito) return;
    const cats = { ceu: "☁️ Céu", chao: "🌳 Chão", agua: "🌊 Água" };
    const grupos = { ceu: [], chao: [], agua: [] };
    Object.keys(window.ELEMENTS).forEach((id) => { const e = window.ELEMENTS[id]; (grupos[e.cat] || grupos.chao).push(e); });
    let html = "";
    Object.keys(cats).forEach((c) => {
      html += '<div class="add-cat"><b>' + cats[c] + "</b><div class=\"add-grid\">";
      grupos[c].forEach((e) => { html += '<button data-add="' + e.id + '">' + e.nome + "</button>"; });
      html += "</div></div>";
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-add]").forEach((b) => {
      b.onclick = () => window.SceneEditor.adicionar(b.getAttribute("data-add"));
    });
    box.dataset.feito = "1";
  }

  function ligarRegioes(svg) {
    if (!svg) return;
    svg.querySelectorAll(".region").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (estado.modo === "conta-gotas") {
          const fAt = el.getAttribute("fill") || "#ffffff";
          if (fAt.indexOf("url(") < 0 && fAt !== "none") { estado.cor = fAt; estado.degrade = false; estado.textura = "solido"; }
          estado.modo = "pintar"; toast("Cor capturada: " + (fAt.indexOf("url(") < 0 ? fAt : "—")); return;
        }
        if (estado.modo === "borracha") { el.setAttribute("fill", "#ffffff"); return; }
        if (estado.textura && estado.textura !== "solido") { el.setAttribute("fill", "url(#" + garantirTextura(svg, estado.textura, estado.cor) + ")"); return; }
        if (estado.degrade) { el.setAttribute("fill", "url(#" + garantirGradiente(svg, estado.corA, estado.corB) + ")"); return; }
        el.setAttribute("fill", estado.cor);
      });
    });
  }

  function svgAtual() {
    // Cena em edição: exporta render limpo (sem destaque) + efeitos
    if (ehCena() && estado.scene && estado.cenaModo === "editar") {
      const limpo = window.renderScene(estado.scene, -1);
      return window.Effects ? window.Effects.aplicar(limpo, estado.fx) : limpo;
    }
    const svg = $("svg-host").querySelector("svg");
    return svg ? svg.outerHTML : null; // já tem efeitos + pintura aplicados
  }

  // ───────────────────────────── PALETA ────────────────────────────────
  function renderPaleta() {
    const box = $("paleta");
    box.innerHTML = "";
    PALETA.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch" + (c === estado.cor ? " sel" : "");
      b.style.background = c;
      b.title = c;
      if (c === "#ffffff") b.style.border = "2px solid #ccc";
      b.onclick = () => {
        estado.cor = c;
        estado.modo = "pintar";
        document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
        b.classList.add("sel");
        $("btn-borracha").classList.remove("ativo");
      };
      box.appendChild(b);
    });
    // botão "mais cores / misturar" — leva ao estúdio de cores, onde se pinta
    const mais = document.createElement("button");
    mais.className = "swatch swatch-mais"; mais.textContent = "🎨"; mais.title = "Mais cores e misturar";
    mais.onclick = () => abrirSheet();
    box.appendChild(mais);
    // seletor de cor personalizada
    const custom = $("cor-custom");
    custom.value = "#e63946";
    custom.oninput = () => {
      estado.cor = custom.value;
      estado.modo = "pintar";
      document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
      $("btn-borracha").classList.remove("ativo");
    };
  }

  // ───────────────────────────── COLEÇÃO ───────────────────────────────
  function renderColecao() {
    const box = $("colecao-grid");
    const itens = window.STORAGE.listar();
    $("colecao-vazia").style.display = itens.length ? "none" : "block";
    box.innerHTML = "";
    itens.forEach((item) => {
      const card = document.createElement("div");
      card.className = "col-card";
      card.innerHTML =
        '<div class="col-thumb">' + item.svg +
        '<label class="col-sel"><input type="checkbox" class="col-check" value="' + item.id + '"></label></div>' +
        '<div class="col-meta"><b>' + escapeHtml(item.nome) + "</b>" +
        '<code class="col-id">#' + escapeHtml(String(item.id)) + "</code>" +
        '<div class="col-areas">' + (item.areas || []).map(chipArea).join("") + "</div></div>" +
        '<div class="col-acoes">' +
        '<button data-act="abrir">Abrir</button>' +
        '<button data-act="png">PNG</button>' +
        '<button data-act="svg">SVG</button>' +
        '<button data-act="del" class="perigo">Excluir</button>' +
        "</div>";
      card.querySelector(".col-check").onchange = atualizarColInfo;
      card.querySelector('[data-act="abrir"]').onclick = () => {
        mostrarCenaTools(false);
        estado.scene = null;
        estado.baseSVG = item.svg;
        $("svg-host").innerHTML = item.svg;
        ligarRegioes($("svg-host").querySelector("svg"));
        trocarAba("criar");
      };
      card.querySelector('[data-act="png"]').onclick = () => window.STORAGE.baixarPNG(item.svg, item.nome);
      card.querySelector('[data-act="svg"]').onclick = () => window.STORAGE.baixarSVG(item.svg, item.nome);
      card.querySelector('[data-act="del"]').onclick = () => {
        if (confirm("Excluir “" + item.nome + "”?")) { window.STORAGE.remover(item.id); renderColecao(); }
      };
      box.appendChild(card);
    });
    atualizarColInfo();
  }

  // ───────────────── COLEÇÃO: exportar / importar / imprimir tudo ─────────────
  function semCor(svg) {
    const div = document.createElement("div");
    div.innerHTML = svg;
    div.querySelectorAll(".region").forEach((el) => el.setAttribute("fill", "#ffffff"));
    div.querySelectorAll("g[fill]").forEach((g) => { const f = (g.getAttribute("fill") || "").toLowerCase(); if (f && f !== "none" && f !== "#ffffff" && f !== "#fff") g.setAttribute("fill", "#ffffff"); });
    const s = div.querySelector("svg");
    return s ? s.outerHTML : svg;
  }
  function itensAlvo() {
    const todos = window.STORAGE.listar();
    const marcados = Array.from(document.querySelectorAll("#colecao-grid .col-check:checked")).map((c) => c.value);
    if (!marcados.length) return todos;
    const ids = new Set(marcados);
    return todos.filter((x) => ids.has(x.id));
  }
  function svgsProntos(itens) {
    const sc = $("col-semcor").checked;
    return itens.map((it) => (sc ? semCor(it.svg) : it.svg));
  }
  function atualizarColInfo() {
    const n = document.querySelectorAll("#colecao-grid .col-check:checked").length;
    const tot = window.STORAGE.listar().length;
    $("col-info").textContent = n ? n + " selecionados" : tot + " desenho(s)";
  }
  function marcarTodos() {
    const checks = Array.from(document.querySelectorAll("#colecao-grid .col-check"));
    const todos = checks.length && checks.every((c) => c.checked);
    checks.forEach((c) => { c.checked = !todos; });
    atualizarColInfo();
  }
  function imprimirColecao() {
    const itens = itensAlvo();
    if (!itens.length) { toast("Coleção vazia"); return; }
    const svgs = svgsProntos(itens);
    const win = window.open("", "_blank");
    const pgs = svgs.map((s) => '<div class="pg">' + s + "</div>").join("");
    win.document.write('<html><head><title>Coleção</title><style>@page{margin:8mm}body{margin:0}.pg{page-break-after:always;display:flex;align-items:center;justify-content:center;min-height:96vh}svg{width:100%;max-width:185mm;height:auto}</style></head><body>' + pgs + "<scr" + "ipt>window.onload=function(){window.print();}</scr" + "ipt></body></html>");
    win.document.close();
  }
  function pacoteColecao() {
    const itens = itensAlvo();
    const sc = $("col-semcor").checked;
    const out = sc ? itens.map((it) => Object.assign({}, it, { svg: semCor(it.svg) })) : itens;
    return { tipo: "colecao-desenhos", versao: 1, exportadoEm: dataISO(), itens: out };
  }
  function exportarColecao() {
    const pkg = pacoteColecao();
    if (!pkg.itens.length) { toast("Coleção vazia"); return; }
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "colecao-desenhos.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(pkg.itens.length + " desenhos exportados");
  }
  function compartilharColecao() {
    const pkg = pacoteColecao();
    if (!pkg.itens.length) { toast("Coleção vazia"); return; }
    const file = new File([JSON.stringify(pkg)], "colecao-desenhos.json", { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Minha coleção de desenhos", text: "Pinte alguns e me devolva 🙂" }).catch(() => {});
    } else { exportarColecao(); }
  }
  function importarColecao(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        const itens = Array.isArray(data) ? data : (data.itens || []);
        const n = window.STORAGE.importar(itens);
        renderColecao();
        toast(n + " desenho(s) importado(s) ✓");
      } catch (e) { toast("Arquivo inválido"); }
    };
    fr.readAsText(file);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ───────────────────────────── ABAS ──────────────────────────────────
  function trocarAba(aba) {
    $("view-criar").style.display = aba === "criar" ? "" : "none";
    $("view-desenhar").style.display = aba === "desenhar" ? "" : "none";
    $("view-studio").style.display = aba === "studio" ? "" : "none";
    $("view-colecao").style.display = aba === "colecao" ? "" : "none";
    $("tab-criar").classList.toggle("ativo", aba === "criar");
    $("tab-desenhar").classList.toggle("ativo", aba === "desenhar");
    $("tab-studio").classList.toggle("ativo", aba === "studio");
    $("tab-colecao").classList.toggle("ativo", aba === "colecao");
    atualizarNav(aba);
    if (aba !== "criar") fecharSheet();
    if (aba === "colecao") renderColecao();
    if (aba === "studio" && window.Studio) window.Studio.init();
    if (aba === "desenhar" && window.Draw) window.Draw.init();
  }

  // ───────────────── MOBILE: seções recolhíveis + gaveta de cores ──────────────
  function tornarColapsavel(painel) {
    if (!painel) return;
    const filhos = Array.from(painel.children);
    for (let i = 0; i < filhos.length; i++) {
      const h = filhos[i];
      if (!(h.classList && h.classList.contains("secao"))) continue;
      const corpo = document.createElement("div");
      corpo.className = "secao-corpo";
      let j = i + 1;
      while (j < filhos.length && !(filhos[j].classList && filhos[j].classList.contains("secao"))) { corpo.appendChild(filhos[j]); j++; }
      h.after(corpo);
      h.classList.add("secao-tog");
      h.onclick = () => { const f = h.classList.toggle("fechado"); corpo.style.display = f ? "none" : ""; };
    }
  }

  // Define a cor escolhida (no slot ativo se estiver misturando) e sai do modo borracha.
  function escolherCor(c) {
    estado.modo = "pintar";
    $("btn-borracha").classList.remove("ativo");
    if (estado.degrade) { estado["cor" + estado.slot] = c; if (estado.slot === "A") estado.cor = c; }
    else estado.cor = c;
    document.querySelectorAll("#paleta .swatch").forEach((s) => s.classList.remove("sel"));
    renderColorStudio();
  }

  function renderColorStudio() {
    const box = $("sheet-cores");
    box.innerHTML = "";
    const corAtiva = estado.degrade ? estado["cor" + estado.slot] : estado.cor;

    // 1) Paletas grandes agrupadas
    Object.keys(PALETAS).forEach((grupo) => {
      const h = document.createElement("div"); h.className = "cor-grupo-tit"; h.textContent = grupo; box.appendChild(h);
      const linha = document.createElement("div"); linha.className = "cor-linha";
      PALETAS[grupo].forEach((c) => {
        const b = document.createElement("button"); b.className = "swatch-g" + (c === corAtiva ? " sel" : ""); b.style.background = c;
        if (c === "#ffffff") b.style.border = "2px solid #ccc";
        b.onclick = () => escolherCor(c);
        linha.appendChild(b);
      });
      box.appendChild(linha);
    });

    // 2) Arco-íris (matiz + brilho)
    const tit2 = document.createElement("div"); tit2.className = "cor-grupo-tit"; tit2.textContent = "🌈 Escolher do arco-íris"; box.appendChild(tit2);
    const wrapHue = document.createElement("div"); wrapHue.className = "cor-arco";
    const hue = document.createElement("input"); hue.type = "range"; hue.min = 0; hue.max = 360; hue.value = 200; hue.className = "slider-hue";
    const luz = document.createElement("input"); luz.type = "range"; luz.min = 15; luz.max = 85; luz.value = 50; luz.className = "slider-luz";
    const prev = document.createElement("button"); prev.className = "cor-preview"; prev.textContent = "usar";
    const att = () => { const c = hslParaHex(+hue.value, 85, +luz.value); prev.style.background = c; prev.dataset.cor = c; };
    hue.oninput = att; luz.oninput = att; att();
    prev.onclick = () => escolherCor(prev.dataset.cor);
    wrapHue.appendChild(hue); wrapHue.appendChild(luz); wrapHue.appendChild(prev);
    box.appendChild(wrapHue);

    // 3) Misturar duas cores
    const tit3 = document.createElement("div"); tit3.className = "cor-grupo-tit"; tit3.textContent = "🎨 Misturar duas cores"; box.appendChild(tit3);
    const mix = document.createElement("div"); mix.className = "cor-mix";
    const slotBtn = (slot) => { const b = document.createElement("button"); b.className = "mix-slot" + (estado.slot === slot && estado.degrade ? " ativo" : ""); b.style.background = estado["cor" + slot]; b.title = "Cor " + slot; b.textContent = slot; b.onclick = () => { estado.degrade = true; estado.slot = slot; renderColorStudio(); }; return b; };
    const mais = document.createElement("span"); mais.className = "mix-op"; mais.textContent = "+";
    const igual = document.createElement("span"); igual.className = "mix-op"; igual.textContent = "=";
    const result = document.createElement("button"); result.className = "mix-result"; const cm = misturarHex(estado.corA, estado.corB); result.style.background = cm; result.title = "Usar mistura"; result.onclick = () => { estado.degrade = false; escolherCor(cm); };
    mix.appendChild(slotBtn("A")); mix.appendChild(mais); mix.appendChild(slotBtn("B")); mix.appendChild(igual); mix.appendChild(result);
    box.appendChild(mix);
    const degLabel = document.createElement("label"); degLabel.className = "cor-degrade";
    const degChk = document.createElement("input"); degChk.type = "checkbox"; degChk.checked = estado.degrade;
    degChk.onchange = () => { estado.degrade = degChk.checked; renderColorStudio(); };
    degLabel.appendChild(degChk); degLabel.appendChild(document.createTextNode(" Pintar em degradê (A→B)"));
    box.appendChild(degLabel);

    // 3.5) Texturas de preenchimento
    const tit4 = document.createElement("div"); tit4.className = "cor-grupo-tit"; tit4.textContent = "🧩 Textura ao pintar"; box.appendChild(tit4);
    const texRow = document.createElement("div"); texRow.className = "cor-textura";
    [["solido", "Sólido"], ["listrado", "Listrado"], ["bolinhas", "Bolinhas"], ["xadrez", "Xadrez"]].forEach((t) => {
      const b = document.createElement("button"); b.className = "tex-btn" + (estado.textura === t[0] ? " sel" : ""); b.textContent = t[1];
      b.onclick = () => { estado.textura = t[0]; renderColorStudio(); };
      texRow.appendChild(b);
    });
    box.appendChild(texRow);

    // 4) ações
    const acoes = document.createElement("div"); acoes.className = "cor-acoes";
    const cg = document.createElement("button"); cg.className = "sheet-acao"; cg.textContent = "💧 Conta-gotas";
    cg.onclick = () => { estado.modo = "conta-gotas"; $("btn-borracha").classList.remove("ativo"); fecharSheet(); toast("Toque numa cor do desenho para capturá-la"); };
    const er = document.createElement("button"); er.className = "sheet-acao"; er.textContent = "⌫ Borracha";
    er.onclick = () => { estado.modo = "borracha"; estado.degrade = false; estado.textura = "solido"; $("btn-borracha").classList.add("ativo"); fecharSheet(); };
    const lp = document.createElement("button"); lp.className = "sheet-acao"; lp.textContent = "✕ Limpar tudo";
    lp.onclick = () => { $("svg-host").querySelectorAll(".region").forEach((el) => el.setAttribute("fill", "#ffffff")); fecharSheet(); };
    const ok = document.createElement("button"); ok.className = "sheet-acao primario"; ok.textContent = "Pronto ✓"; ok.onclick = fecharSheet;
    acoes.appendChild(cg); acoes.appendChild(er); acoes.appendChild(lp); acoes.appendChild(ok);
    box.appendChild(acoes);
  }
  const renderSheetPaleta = renderColorStudio;
  function abrirSheet() { renderColorStudio(); $("sheet-paleta").classList.add("aberto"); }
  function fecharSheet() { $("sheet-paleta").classList.remove("aberto"); }

  function bindMobileBar() {
    document.querySelectorAll("#mobile-bar [data-nav]").forEach((b) => { b.onclick = () => trocarAba(b.getAttribute("data-nav")); });
    document.querySelectorAll("#mobile-bar [data-mb]").forEach((b) => { b.onclick = () => { if (b.getAttribute("data-mb") === "cores") { renderColorStudio(); $("sheet-paleta").classList.toggle("aberto"); } }; });
  }
  function atualizarNav(aba) {
    document.querySelectorAll("#mobile-bar [data-nav]").forEach((b) => b.classList.toggle("ativo", b.getAttribute("data-nav") === aba));
  }

  // ───────────────────────────── IMPRESSÃO ─────────────────────────────
  function imprimir() {
    const svg = svgAtual();
    if (!svg) return;
    const win = window.open("", "_blank");
    win.document.write(
      "<html><head><title>Imprimir desenho</title><style>" +
      "@page{margin:10mm} body{margin:0;display:flex;align-items:center;justify-content:center}" +
      "svg{width:100%;max-width:190mm;height:auto}</style></head><body>" + svg +
      "<script>window.onload=function(){window.print();}<\/script></body></html>"
    );
    win.document.close();
  }

  // ───────────────────────────── INICIALIZAÇÃO ─────────────────────────
  function init() {
    renderGeradores();
    renderPainel();
    renderPaleta();
    if (window.Effects) bindEfeitos();
    gerar(true);
    tornarColapsavel($("view-criar").querySelector(".painel"));
    renderColorStudio();
    bindMobileBar();
    atualizarNav("criar");

    $("tab-criar").onclick = () => trocarAba("criar");
    $("tab-desenhar").onclick = () => trocarAba("desenhar");
    $("tab-studio").onclick = () => trocarAba("studio");
    $("tab-colecao").onclick = () => trocarAba("colecao");
    // controles do desenhador
    $("d-tam").oninput = function () { $("d-tam-v").textContent = this.value; if (window.Draw) window.Draw.setTam(+this.value); };
    $("d-op").oninput = function () { $("d-op-v").textContent = this.value; if (window.Draw) window.Draw.setOpac(+this.value / 100); };
    $("d-fundo").onchange = function () { if (window.Draw) window.Draw.setFundo(this.value, this.value === "atual" ? (estado.baseSVG || svgAtual()) : null); };
    $("d-desfazer").onclick = () => window.Draw && window.Draw.desfazer();
    $("d-refazer").onclick = () => window.Draw && window.Draw.refazer();
    $("d-limpar").onclick = () => window.Draw && window.Draw.limpar();
    $("col-imprimir").onclick = imprimirColecao;
    $("col-exportar").onclick = exportarColecao;
    $("col-compartilhar").onclick = compartilharColecao;
    $("col-marcar").onclick = marcarTodos;
    $("col-importar-btn").onclick = () => $("col-importar").click();
    $("col-importar").onchange = (e) => { if (e.target.files[0]) importarColecao(e.target.files[0]); e.target.value = ""; };
    $("st-nova").onclick = () => window.Studio && window.Studio.novaCamada();

    $("g-info-btn").onclick = () => { const e = $("g-edu"); e.style.display = e.style.display === "none" ? "" : "none"; };
    $("btn-novo").onclick = () => gerar(true);
    $("btn-limpar").onclick = () => {
      $("svg-host").querySelectorAll(".region").forEach((el) => el.setAttribute("fill", "#ffffff"));
    };

    // ----- editor de cena -----
    $("modo-editar").onclick = () => { estado.cenaModo = "editar"; aplicarCenaModo(); };
    $("modo-pintar").onclick = () => { estado.cenaModo = "pintar"; aplicarCenaModo(); };
    $("btn-adicionar").onclick = () => {
      renderAddPanel();
      const p = $("add-panel");
      p.style.display = p.style.display === "none" ? "" : "none";
    };
    $("btn-camadas").onclick = () => {
      layersVisivel = !layersVisivel;
      $("layers-panel").style.display = layersVisivel ? "" : "none";
      if (layersVisivel) renderCamadas();
    };
    const edFns = {
      maior: () => window.SceneEditor.escalar(1.15),
      menor: () => window.SceneEditor.escalar(1 / 1.15),
      largo: () => window.SceneEditor.esticarX(1.15),
      alto: () => window.SceneEditor.esticarY(1.15),
      "flip-h": () => window.SceneEditor.flipH(),
      "flip-v": () => window.SceneEditor.flipV(),
      "girar-e": () => window.SceneEditor.girar(-15),
      "girar-d": () => window.SceneEditor.girar(15),
      frente: () => window.SceneEditor.frente(),
      tras: () => window.SceneEditor.tras(),
      duplicar: () => window.SceneEditor.duplicar(),
      excluir: () => window.SceneEditor.excluir(),
      separar: () => window.SceneEditor.separar(),
      alinhar: () => window.SceneEditor.autoArranjar(),
      embaralhar: () => window.SceneEditor.embaralhar(),
    };
    document.querySelectorAll("[data-ed]").forEach((b) => {
      b.onclick = () => { const f = edFns[b.getAttribute("data-ed")]; if (f) f(); };
    });

    // ----- geração em massa -----
    $("batch-fechar").onclick = () => { window.Batch.stop(); $("batch-modal").style.display = "none"; };
    $("batch-gerar").onclick = rodarMassa;
    $("batch-parar").onclick = () => window.Batch.stop();
    $("batch-add-gen").onclick = () => { estado.receita.push({ gid: DATA.geradores[Math.floor(Math.random() * DATA.geradores.length)].id, n: 3 }); renderReceita(); };
    $("batch-pdf").onclick = () => window.Batch.exportarPDF();
    $("batch-todos-png").onclick = () => window.Batch.baixarTodos("png");
    $("batch-todos-svg").onclick = () => window.Batch.baixarTodos("svg");
    $("btn-borracha").onclick = function () {
      estado.modo = estado.modo === "borracha" ? "pintar" : "borracha";
      this.classList.toggle("ativo", estado.modo === "borracha");
    };
    $("btn-foco").onclick = () => { document.body.classList.toggle("foco"); };
    // menu único: Salvar & Exportar
    $("btn-export").onclick = () => { $("menu-export").style.display = "flex"; };
    $("menu-export-x").onclick = () => { $("menu-export").style.display = "none"; };
    $("menu-export").onclick = (ev) => { if (ev.target === $("menu-export")) $("menu-export").style.display = "none"; };
    document.querySelectorAll("#menu-export [data-ex]").forEach((b) => {
      b.onclick = () => {
        const a = b.getAttribute("data-ex");
        $("menu-export").style.display = "none";
        if (a === "salvar") acaoSalvar();
        else if (a === "compartilhar") acaoCompartilhar();
        else if (a === "copiar") acaoCopiar();
        else if (a === "png") acaoPng();
        else if (a === "svg") acaoSvg();
        else if (a === "imprimir") imprimir();
        else if (a === "lote") abrirMassa();
      };
    });
  }

  // ───────────────────────── LOTE MISTO (receita) ──────────────────────
  function genFnFor(gid) { return gid === "cena" ? window.composeCena : GEN[gid]; }
  function baseOptsFor(gid) {
    const g = DATA.geradores.find((x) => x.id === gid), o = {};
    for (const k in (g.params || {})) if (g.params[k].tipo !== "multi") o[k] = g.params[k].padrao;
    return o;
  }

  function abrirMassa() {
    if (!estado.receita || !estado.receita.length) {
      const g = geradorAtual();
      estado.receita = [{ gid: g.id, n: PESADOS[g.id] ? 6 : 12 }];
    }
    $("batch-modal").style.display = "flex";
    $("batch-status").textContent = "";
    $("batch-grid").innerHTML = "";
    renderReceita();
  }

  function renderReceita() {
    const box = $("batch-receita");
    box.innerHTML = "";
    estado.receita.forEach((row, idx) => {
      const r = document.createElement("div"); r.className = "receita-row";
      const qtd = document.createElement("input");
      qtd.type = "number"; qtd.min = 1; qtd.max = 100; qtd.value = row.n; qtd.className = "receita-qtd";
      qtd.oninput = () => { row.n = Math.max(1, Math.min(100, +qtd.value || 1)); };
      const x = document.createElement("span"); x.className = "receita-x-lab"; x.textContent = "×";
      const sel = document.createElement("select"); sel.className = "st-sel";
      DATA.geradores.forEach((g) => { const o = document.createElement("option"); o.value = g.id; o.textContent = (g.icone || "") + " " + g.nome; if (g.id === row.gid) o.selected = true; sel.appendChild(o); });
      sel.onchange = () => { row.gid = sel.value; };
      const del = document.createElement("button"); del.className = "receita-del"; del.textContent = "🗑"; del.title = "Remover";
      del.onclick = () => { estado.receita.splice(idx, 1); if (!estado.receita.length) estado.receita.push({ gid: DATA.geradores[0].id, n: 5 }); renderReceita(); };
      r.appendChild(qtd); r.appendChild(x); r.appendChild(sel); r.appendChild(del);
      box.appendChild(r);
    });
    const total = estado.receita.reduce((s, r) => s + r.n, 0);
    $("batch-status").textContent = "Total: " + total + " desenhos";
  }

  function rodarMassa() {
    const receita = estado.receita.map((row) => ({ gid: row.gid, n: row.n, genFn: genFnFor(row.gid), baseOpts: baseOptsFor(row.gid), heavy: !!PESADOS[row.gid] }));
    window.Batch.runRecipe({
      receita: receita, grid: $("batch-grid"), status: $("batch-status"),
      onOpen: (svg) => {
        $("batch-modal").style.display = "none";
        mostrarCenaTools(false); estado.scene = null; estado.baseSVG = svg;
        $("svg-host").innerHTML = svg; ligarRegioes($("svg-host").querySelector("svg"));
        trocarAba("criar");
      },
      onSave: (svg, opts, gid) => {
        const g = DATA.geradores.find((x) => x.id === gid) || {};
        window.STORAGE.salvar({ nome: (g.nome || gid) + " #" + String(opts.seed).slice(-4), gerador: gid, areas: g.areas || [], params: opts, svg: svg, dataISO: dataISO() });
        toast("Salvo na coleção ✓");
      },
    });
  }

  function nomeArquivo() {
    return geradorAtual().id + "-" + Date.now();
  }

  // ───────────── ações de salvar/exportar (usadas pelo menu único) ─────────────
  function acaoSvg() { const s = svgAtual(); if (s) window.STORAGE.baixarSVG(s, nomeArquivo()); }
  function acaoPng() { const s = svgAtual(); if (s) window.STORAGE.baixarPNG(s, nomeArquivo(), 3); }
  function acaoCompartilhar() { const s = svgAtual(); if (!s) return; toast("Preparando…"); window.STORAGE.compartilhar(s, nomeArquivo()).then((r) => toast(r === "compartilhado" ? "Compartilhado ✓" : r === "baixado" ? "Baixado" : "Não deu pra compartilhar")); }
  function acaoCopiar() { const s = svgAtual(); if (!s) return; window.STORAGE.copiarImagem(s).then((r) => toast(r === "copiado" ? "Imagem copiada ✓" : "Cópia indisponível neste navegador")); }
  function acaoSalvar() {
    const s = svgAtual(); if (!s) return;
    const g = geradorAtual();
    const nome = prompt("Nome do desenho:", g.nome + " " + new Date().toLocaleDateString("pt-BR"));
    if (nome === null) return;
    window.STORAGE.salvar({ nome: nome || g.nome, gerador: g.id, areas: g.areas, params: JSON.parse(JSON.stringify(estado.params)), svg: s, dataISO: dataISO() });
    toast("Salvo na sua coleção ✓");
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1800);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
