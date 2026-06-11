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
  };
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
    $("fx-espessura").oninput = function () { fx.espessura = +this.value / 100; $("fx-espessura-v").textContent = fx.espessura.toFixed(1); reaplicarEfeitos(); };
    $("fx-simetria").onchange = function () { fx.simetria = this.value; reaplicarEfeitos(); };
    $("fx-rascunho").oninput = function () { fx.rascunho = +this.value; $("fx-rascunho-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-ondular").oninput = function () { fx.ondular = +this.value; $("fx-ondular-v").textContent = this.value; reaplicarEfeitos(); };
    $("fx-cor-traco").oninput = function () { fx.corTraco = this.value; reaplicarEfeitos(); };
    $("fx-cor-fundo").oninput = function () { fx.corFundo = this.value; reaplicarEfeitos(); };
    $("fx-reset").onclick = function () { estado.fx = window.Effects.novo(); sincronizarEfeitosUI(); reaplicarEfeitos(); };
    sincronizarEfeitosUI();
  }
  function sincronizarEfeitosUI() {
    const fx = estado.fx;
    $("fx-espessura").value = Math.round(fx.espessura * 100); $("fx-espessura-v").textContent = fx.espessura.toFixed(1);
    $("fx-simetria").value = fx.simetria;
    $("fx-rascunho").value = fx.rascunho; $("fx-rascunho-v").textContent = fx.rascunho;
    $("fx-ondular").value = fx.ondular; $("fx-ondular-v").textContent = fx.ondular;
    $("fx-cor-traco").value = fx.corTraco; $("fx-cor-fundo").value = fx.corFundo;
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
        const cor = estado.modo === "borracha" ? "#ffffff" : estado.cor;
        el.setAttribute("fill", cor);
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
        '<div class="col-thumb">' + item.svg + "</div>" +
        '<div class="col-info"><b>' + escapeHtml(item.nome) + "</b>" +
        '<div class="col-areas">' + (item.areas || []).map(chipArea).join("") + "</div></div>" +
        '<div class="col-acoes">' +
        '<button data-act="abrir">Abrir</button>' +
        '<button data-act="png">PNG</button>' +
        '<button data-act="svg">SVG</button>' +
        '<button data-act="del" class="perigo">Excluir</button>' +
        "</div>";
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
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ───────────────────────────── ABAS ──────────────────────────────────
  function trocarAba(aba) {
    $("view-criar").style.display = aba === "criar" ? "" : "none";
    $("view-studio").style.display = aba === "studio" ? "" : "none";
    $("view-colecao").style.display = aba === "colecao" ? "" : "none";
    $("tab-criar").classList.toggle("ativo", aba === "criar");
    $("tab-studio").classList.toggle("ativo", aba === "studio");
    $("tab-colecao").classList.toggle("ativo", aba === "colecao");
    $("mobile-bar").classList.toggle("on", aba === "criar"); // barra mobile só na Criar
    if (aba !== "criar") fecharSheet();
    if (aba === "colecao") renderColecao();
    if (aba === "studio" && window.Studio) window.Studio.init();
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

  function renderSheetPaleta() {
    const box = $("sheet-cores");
    box.innerHTML = "";
    PALETA.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = c;
      if (c === "#ffffff") b.style.border = "2px solid #ccc";
      b.onclick = () => {
        estado.cor = c; estado.modo = "pintar";
        $("btn-borracha").classList.remove("ativo");
        document.querySelectorAll("#paleta .swatch").forEach((s) => s.classList.toggle("sel", s.style.background === b.style.background));
        fecharSheet();
      };
      box.appendChild(b);
    });
    const er = document.createElement("button"); er.className = "sheet-acao"; er.textContent = "⌫ Borracha";
    er.onclick = () => { estado.modo = "borracha"; $("btn-borracha").classList.add("ativo"); fecharSheet(); };
    box.appendChild(er);
    const lp = document.createElement("button"); lp.className = "sheet-acao"; lp.textContent = "✕ Limpar";
    lp.onclick = () => { $("svg-host").querySelectorAll(".region").forEach((el) => el.setAttribute("fill", "#ffffff")); fecharSheet(); };
    box.appendChild(lp);
  }
  function fecharSheet() { $("sheet-paleta").classList.remove("aberto"); }

  function bindMobileBar() {
    document.querySelectorAll("#mobile-bar [data-mb]").forEach((b) => {
      b.onclick = () => {
        const a = b.getAttribute("data-mb");
        if (a === "gerar") gerar(true);
        else if (a === "cores") { $("sheet-paleta").classList.toggle("aberto"); }
        else if (a === "salvar") $("btn-salvar").click();
        else if (a === "compartilhar") $("btn-compartilhar").click();
        else if (a === "foco") document.body.classList.toggle("foco");
      };
    });
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
    renderSheetPaleta();
    bindMobileBar();
    $("mobile-bar").classList.add("on"); // começa na Criar

    $("tab-criar").onclick = () => trocarAba("criar");
    $("tab-studio").onclick = () => trocarAba("studio");
    $("tab-colecao").onclick = () => trocarAba("colecao");
    $("st-nova").onclick = () => window.Studio && window.Studio.novaCamada();

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
    $("btn-massa").onclick = abrirMassa;
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
    $("btn-imprimir").onclick = imprimir;
    $("btn-svg").onclick = () => { const s = svgAtual(); if (s) window.STORAGE.baixarSVG(s, nomeArquivo()); };
    $("btn-png").onclick = () => { const s = svgAtual(); if (s) window.STORAGE.baixarPNG(s, nomeArquivo(), 3); };
    $("btn-foco").onclick = () => { document.body.classList.toggle("foco"); };
    $("btn-compartilhar").onclick = () => {
      const s = svgAtual(); if (!s) return;
      toast("Preparando…");
      window.STORAGE.compartilhar(s, nomeArquivo()).then((r) => toast(r === "compartilhado" ? "Compartilhado ✓" : r === "baixado" ? "Baixado (compartilhar indisponível)" : "Não foi possível compartilhar"));
    };
    $("btn-copiar").onclick = () => {
      const s = svgAtual(); if (!s) return;
      window.STORAGE.copiarImagem(s).then((r) => toast(r === "copiado" ? "Imagem copiada ✓" : "Cópia indisponível neste navegador"));
    };
    $("btn-salvar").onclick = () => {
      const s = svgAtual();
      if (!s) return;
      const g = geradorAtual();
      const nome = prompt("Nome do desenho:", g.nome + " " + new Date().toLocaleDateString("pt-BR"));
      if (nome === null) return;
      window.STORAGE.salvar({
        nome: nome || g.nome,
        gerador: g.id,
        areas: g.areas,
        params: JSON.parse(JSON.stringify(estado.params)),
        svg: s,
        dataISO: dataISO(),
      });
      toast("Salvo na sua coleção ✓");
    };
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

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1800);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
