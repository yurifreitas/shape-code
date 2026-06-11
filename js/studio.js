/*
 * studio.js — "Estúdio": camadas infinitas e editáveis, cada uma com um
 * PROGRAMA DE BLOCOS (estilo Scratch para imagens). A fonte é um dos geradores
 * e os blocos (repetir, grade, radial, mover, girar, espelhar, cor, ondular)
 * são executados em sequência transformando a geometria — encadear blocos de
 * repetição equivale a laços aninhados.
 *
 * Documento: { camadas: [ { id, nome, fonte, params, seed, visivel, travado,
 *   opacidade, blend, blocos: [ {tipo, ...params} ], _base } ] }
 */
window.Studio = (function () {
  "use strict";
  const W = 720, H = 720, CX = 360, CY = 360, CAP = 1.3e6;
  const $ = (id) => document.getElementById(id);

  // ───────── catálogo de blocos (lógica + transformações + aparência) ─────────
  const BLOCOS = {
    repetir: { nome: "🔁 Repetir", cat: "logica", params: { vezes: [2, 24, 6], dx: [-200, 200, 0], dy: [-200, 200, 0], rot: [-180, 180, 30], escala: [50, 130, 100] } },
    grade: { nome: "▦ Grade", cat: "logica", params: { colunas: [1, 10, 3], linhas: [1, 10, 3], espX: [20, 240, 120], espY: [20, 240, 120] } },
    radial: { nome: "✺ Radial", cat: "logica", params: { vezes: [2, 24, 8], raio: [0, 300, 0], girar: [0, 1, 1] } },
    mover: { nome: "↔ Mover", cat: "mov", params: { dx: [-300, 300, 0], dy: [-300, 300, 0] } },
    escalar: { nome: "⤢ Escalar", cat: "mov", params: { pct: [20, 200, 100] } },
    girar: { nome: "⟳ Girar", cat: "mov", params: { graus: [-180, 180, 0] } },
    espelhar: { nome: "🪞 Espelhar", cat: "apar", params: { eixo: { sel: ["h", "v", "quad"], padrao: "h" } } },
    cor: { nome: "🖊 Traço", cat: "apar", params: { espessura: [30, 300, 100], traco: { cor: "#1b1b1b" } } },
    ondular: { nome: "〰 Ondular", cat: "apar", params: { qtd: [0, 30, 8] } },
    // ── animação (SMIL nativo, suave) ──
    animgirar: { nome: "🌀 Girar (anim)", cat: "anim", params: { velocidade: [1, 20, 6], sentido: { sel: ["horario", "anti"], padrao: "horario" } } },
    animpulsar: { nome: "💓 Pulsar", cat: "anim", params: { intensidade: [5, 80, 25], velocidade: [1, 20, 6] } },
    animflutuar: { nome: "🍃 Flutuar", cat: "anim", params: { distancia: [5, 140, 40], velocidade: [1, 20, 6] } },
    animbalancar: { nome: "🤸 Balançar", cat: "anim", params: { angulo: [2, 45, 15], velocidade: [1, 20, 6] } },
  };
  const CAT_COR = { logica: "#f4a261", mov: "#3a86ff", apar: "#9b5de5", anim: "#06d6a0" };
  const EASE = ' calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"';

  const PALETA = ["#e63946", "#f4a261", "#ffbe0b", "#06d6a0", "#2a9d8f", "#3a86ff", "#9b5de5", "#ff6392", "#7f5539", "#000000", "#ffffff"];

  let doc = null, sel = 0, host = null, corAtual = "#e63946", contador = 1, iniciado = false;

  function gensDisponiveis() {
    const all = Object.assign({}, window.GENERATORS, window.FIELD_GENERATORS || {});
    return Object.keys(all).filter((id) => id !== "cena");
  }
  function dadosGerador(id) { return window.COLORING_DATASET.geradores.find((g) => g.id === id); }

  // ───────── execução dos blocos (string SVG → string SVG) ─────────
  function wrapG(tr, inner) { return '<g transform="' + tr + '">' + inner + "</g>"; }
  function applyBloco(b, content, ctx) {
    const t = b.tipo;
    if (t === "repetir") {
      let o = "";
      for (let i = 0; i < b.vezes; i++) {
        const sc = Math.pow((b.escala || 100) / 100, i);
        const tr = "translate(" + (b.dx * i) + " " + (b.dy * i) + ") rotate(" + (b.rot * i) + " " + CX + " " + CY + ") translate(" + CX + " " + CY + ") scale(" + sc.toFixed(4) + ") translate(" + (-CX) + " " + (-CY) + ")";
        o += wrapG(tr, content);
        if (o.length > CAP) break;
      }
      return o;
    }
    if (t === "grade") {
      let o = ""; const cmid = (b.colunas - 1) / 2, lmid = (b.linhas - 1) / 2;
      for (let r = 0; r < b.linhas; r++) for (let c = 0; c < b.colunas; c++) {
        o += wrapG("translate(" + ((c - cmid) * b.espX) + " " + ((r - lmid) * b.espY) + ")", content);
        if (o.length > CAP) return o;
      }
      return o;
    }
    if (t === "radial") {
      let o = "";
      for (let i = 0; i < b.vezes; i++) {
        const ang = (360 / b.vezes) * i;
        const giro = b.girar ? "" : " rotate(" + (-ang) + " " + CX + " " + CY + ")";
        o += wrapG("rotate(" + ang + " " + CX + " " + CY + ") translate(0 " + (-b.raio) + ")" + giro, content);
        if (o.length > CAP) break;
      }
      return o;
    }
    if (t === "mover") return wrapG("translate(" + b.dx + " " + b.dy + ")", content);
    if (t === "escalar") { const s = b.pct / 100; return wrapG("translate(" + CX + " " + CY + ") scale(" + s + ") translate(" + (-CX) + " " + (-CY) + ")", content); }
    if (t === "girar") return wrapG("rotate(" + b.graus + " " + CX + " " + CY + ")", content);
    if (t === "espelhar") {
      if (b.eixo === "v") return content + wrapG("matrix(1,0,0,-1,0," + H + ")", content);
      if (b.eixo === "quad") return content + wrapG("matrix(-1,0,0,1," + W + ",0)", content) + wrapG("matrix(1,0,0,-1,0," + H + ")", content) + wrapG("matrix(-1,0,0,-1," + W + "," + H + ")", content);
      return content + wrapG("matrix(-1,0,0,1," + W + ",0)", content);
    }
    if (t === "cor") return '<g stroke="' + (b.traco || "#1b1b1b") + '" stroke-width="' + (2.2 * (b.espessura || 100) / 100).toFixed(2) + '">' + content + "</g>";
    if (t === "ondular") {
      if (!b.qtd) return content;
      const id = "wv" + ctx.defs.length;
      const freq = (0.005 + b.qtd * 0.0016).toFixed(4);
      ctx.defs.push('<filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="' + b.qtd + '" xChannelSelector="R" yChannelSelector="G"/></filter>');
      return '<g filter="url(#' + id + ')">' + content + "</g>";
    }
    // ── animação (SMIL) ──
    if (t === "animgirar") {
      const dur = (28 / b.velocidade).toFixed(2), de = b.sentido === "anti" ? 360 : 0, ate = b.sentido === "anti" ? 0 : 360;
      return '<g><animateTransform attributeName="transform" type="rotate" from="' + de + " " + CX + " " + CY + '" to="' + ate + " " + CX + " " + CY + '" dur="' + dur + 's" repeatCount="indefinite"/>' + content + "</g>";
    }
    if (t === "animpulsar") {
      const dur = (14 / b.velocidade).toFixed(2), k = (1 + b.intensidade / 100).toFixed(3);
      return '<g transform="translate(' + CX + " " + CY + ')"><g><animateTransform attributeName="transform" type="scale" values="1;' + k + ';1" keyTimes="0;0.5;1" dur="' + dur + 's" repeatCount="indefinite"' + EASE + '/><g transform="translate(' + (-CX) + " " + (-CY) + ')">' + content + "</g></g></g>";
    }
    if (t === "animflutuar") {
      const dur = (12 / b.velocidade).toFixed(2), d = b.distancia;
      return '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ' + (-d) + ";0 0" + '" keyTimes="0;0.5;1" dur="' + dur + 's" repeatCount="indefinite"' + EASE + '/>' + content + "</g>";
    }
    if (t === "animbalancar") {
      const dur = (10 / b.velocidade).toFixed(2), a = b.angulo;
      return '<g><animateTransform attributeName="transform" type="rotate" values="' + (-a) + " " + CX + " " + CY + ";" + a + " " + CX + " " + CY + ";" + (-a) + " " + CX + " " + CY + '" keyTimes="0;0.5;1" dur="' + dur + 's" repeatCount="indefinite"' + EASE + '/>' + content + "</g>";
    }
    return content;
  }

  function recomputeBase(layer) {
    const all = Object.assign({}, window.GENERATORS, window.FIELD_GENERATORS || {});
    const fn = all[layer.fonte];
    try {
      const full = fn(Object.assign({ seed: layer.seed }, layer.params));
      layer._base = window.Effects.desmontar(full).inner;
    } catch (e) { layer._base = ""; }
  }

  function processarCamada(layer, ctx) {
    let content = layer._base || "";
    for (const b of layer.blocos) {
      content = applyBloco(b, content, ctx);
      if (content.length > CAP) break;
    }
    const op = (layer.opacidade == null ? 100 : layer.opacidade) / 100;
    return '<g fill="#ffffff" stroke="#1b1b1b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity="' + op + '" style="mix-blend-mode:' + (layer.blend || "normal") + '">' + content + "</g>";
  }

  function compor() {
    const ctx = { defs: [] };
    const corpos = [];
    doc.camadas.forEach((l) => { if (l.visivel !== false) corpos.push(processarCamada(l, ctx)); });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' +
      '<rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
      (ctx.defs.length ? "<defs>" + ctx.defs.join("") + "</defs>" : "") +
      corpos.join("") + "</svg>";
  }

  function recompositar() {
    const svg = compor();
    host.innerHTML = svg;
    const s = host.querySelector("svg");
    if (s) s.querySelectorAll(".region").forEach((el) => { el.style.cursor = "pointer"; el.addEventListener("click", (ev) => { ev.stopPropagation(); el.setAttribute("fill", corAtual); }); });
  }

  // ───────── camadas: criar/clonar ─────────
  function novaCamada(fonte) {
    fonte = fonte || "superformula";
    const g = dadosGerador(fonte), params = {};
    for (const k in (g.params || {})) if (g.params[k].tipo !== "multi") params[k] = g.params[k].padrao;
    const l = { id: "c" + contador, nome: "Camada " + contador, fonte: fonte, params: params, seed: (Math.random() * 1e9) | 0, visivel: true, opacidade: 100, blend: "normal", blocos: [] };
    contador++;
    recomputeBase(l);
    return l;
  }

  // ═══════════════════════ INTERFACE ═══════════════════════
  function init() {
    if (iniciado) { recompositar(); return; }
    iniciado = true;
    host = $("st-host");
    doc = { camadas: [] };
    const l1 = novaCamada("penrose"); l1.nome = "Fundo"; l1.opacidade = 45; l1.blocos = [{ tipo: "animgirar", velocidade: 2, sentido: "anti" }];
    const l2 = novaCamada("forma"); l2.nome = "Pétalas"; l2.params = { tipo: "gota", tamanho: 80 };
    l2.blocos = [{ tipo: "radial", vezes: 8, raio: 130, girar: 1 }, { tipo: "animgirar", velocidade: 5, sentido: "horario" }];
    recomputeBase(l2);
    const l3 = novaCamada("forma"); l3.nome = "Coração"; l3.params = { tipo: "coracao", tamanho: 60 };
    l3.blocos = [{ tipo: "animpulsar", intensidade: 30, velocidade: 7 }];
    recomputeBase(l3);
    doc.camadas = [l1, l2, l3]; sel = 1;
    montarToolbar();
    montarAcoes();
    renderCamadas();
    renderPrograma();
    recompositar();
  }

  function montarToolbar() {
    const tb = $("st-toolbar"); tb.innerHTML = "";
    const pal = document.createElement("div"); pal.className = "paleta";
    PALETA.forEach((c) => { const b = document.createElement("button"); b.className = "swatch" + (c === corAtual ? " sel" : ""); b.style.background = c; if (c === "#ffffff") b.style.border = "2px solid #ccc"; b.onclick = () => { corAtual = c; tb.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel")); b.classList.add("sel"); }; pal.appendChild(b); });
    tb.appendChild(pal);
    const sep = document.createElement("span"); sep.className = "sep"; tb.appendChild(sep);
    const play = document.createElement("button"); play.className = "btn icone"; play.textContent = "⏸ Pausar";
    play.onclick = () => { const s = host.querySelector("svg"); if (!s) return; if (play.dataset.p) { s.unpauseAnimations(); play.textContent = "⏸ Pausar"; play.dataset.p = ""; } else { s.pauseAnimations(); play.textContent = "▶ Tocar"; play.dataset.p = "1"; } };
    tb.appendChild(play);
    const limpar = document.createElement("button"); limpar.className = "btn icone"; limpar.textContent = "✕ Limpar pintura";
    limpar.onclick = () => host.querySelectorAll(".region").forEach((el) => el.setAttribute("fill", "#ffffff"));
    tb.appendChild(limpar);
  }
  function montarAcoes() {
    const ac = $("st-acoes"); ac.innerHTML = "";
    const mk = (txt, fn, cls) => { const b = document.createElement("button"); b.className = "btn" + (cls ? " " + cls : ""); b.textContent = txt; b.onclick = fn; return b; };
    ac.appendChild(mk("💾 Salvar", () => { const nome = prompt("Nome:", "Composição " + new Date().toLocaleDateString("pt-BR")); if (nome === null) return; window.STORAGE.salvar({ nome: nome || "Composição", gerador: "studio", areas: ["criativa", "espacial", "padroes", "atencao"], params: {}, svg: compor(), dataISO: new Date().toISOString() }); toast("Salvo na coleção ✓"); }, "primario"));
    ac.appendChild(mk("🖨 Imprimir", () => imprimir(compor())));
    ac.appendChild(mk("⬇ PNG", () => window.STORAGE.baixarPNG(compor(), "estudio")));
    ac.appendChild(mk("⬇ SVG", () => window.STORAGE.baixarSVG(compor(), "estudio")));
  }

  function renderCamadas() {
    const box = $("st-lista"); box.innerHTML = "";
    for (let i = doc.camadas.length - 1; i >= 0; i--) {
      const l = doc.camadas[i];
      const row = document.createElement("div");
      row.className = "st-camada" + (i === sel ? " sel" : "");
      row.innerHTML =
        '<button data-a="vis" title="Mostrar/ocultar">' + (l.visivel === false ? "🙈" : "👁") + "</button>" +
        '<span data-a="sel" class="st-cam-nome">' + escapeHtml(l.nome) + ' <small>(' + l.fonte + ")</small></span>" +
        '<button data-a="up" title="Subir">▲</button>' +
        '<button data-a="down" title="Descer">▼</button>' +
        '<button data-a="dup" title="Duplicar">⧉</button>' +
        '<button data-a="del" class="perigo" title="Excluir">🗑</button>';
      const act = (a) => row.querySelector('[data-a="' + a + '"]');
      act("vis").onclick = () => { l.visivel = l.visivel === false; renderCamadas(); recompositar(); };
      act("sel").onclick = () => { sel = i; renderCamadas(); renderPrograma(); };
      act("up").onclick = () => moverCamada(i, 1);
      act("down").onclick = () => moverCamada(i, -1);
      act("dup").onclick = () => { const c = JSON.parse(JSON.stringify(l)); c.id = "c" + contador; c.nome = l.nome + " cópia"; c.seed = (Math.random() * 1e9) | 0; contador++; recomputeBase(c); doc.camadas.splice(i + 1, 0, c); sel = i + 1; renderCamadas(); renderPrograma(); recompositar(); };
      act("del").onclick = () => { if (doc.camadas.length <= 1) return; doc.camadas.splice(i, 1); sel = Math.max(0, sel - (i <= sel ? 1 : 0)); renderCamadas(); renderPrograma(); recompositar(); };
      box.appendChild(row);
    }
  }
  function moverCamada(i, dir) { const j = i + dir; if (j < 0 || j >= doc.camadas.length) return; const t = doc.camadas[i]; doc.camadas[i] = doc.camadas[j]; doc.camadas[j] = t; if (sel === i) sel = j; else if (sel === j) sel = i; renderCamadas(); recompositar(); }

  // ----- programa da camada selecionada (fonte + opacidade/blend + blocos) -----
  function renderPrograma() {
    const l = doc.camadas[sel];
    const fonteBox = $("st-fonte"); fonteBox.innerHTML = "";
    if (!l) { $("st-blocos").innerHTML = ""; $("st-add-bloco").innerHTML = ""; return; }

    // nome
    const nomeIn = ctrlTexto("Nome", l.nome, (v) => { l.nome = v; renderCamadas(); });
    fonteBox.appendChild(nomeIn);
    // fonte (gerador)
    const selFonte = document.createElement("select"); selFonte.className = "st-sel";
    gensDisponiveis().forEach((id) => { const o = document.createElement("option"); o.value = id; o.textContent = (dadosGerador(id).icone || "") + " " + dadosGerador(id).nome; if (id === l.fonte) o.selected = true; selFonte.appendChild(o); });
    selFonte.onchange = () => { l.fonte = selFonte.value; const g = dadosGerador(l.fonte); l.params = {}; for (const k in (g.params || {})) if (g.params[k].tipo !== "multi") l.params[k] = g.params[k].padrao; recomputeBase(l); renderPrograma(); renderCamadas(); recompositar(); };
    fonteBox.appendChild(rotulado("Fonte (gerador)", selFonte));
    // semente
    const novaSeed = document.createElement("button"); novaSeed.className = "btn largo"; novaSeed.textContent = "🎲 Nova variação (semente)";
    novaSeed.onclick = () => { l.seed = (Math.random() * 1e9) | 0; recomputeBase(l); recompositar(); };
    fonteBox.appendChild(novaSeed);
    // params da fonte
    const g = dadosGerador(l.fonte);
    Object.keys(g.params || {}).forEach((k) => {
      const p = g.params[k]; if (p.tipo === "multi") return;
      if (p.tipo === "select") fonteBox.appendChild(rotulado(p.rotulo, ctrlSelect(p.opcoes, l.params[k], (v) => { l.params[k] = v; recomputeBase(l); recompositar(); })));
      else fonteBox.appendChild(ctrlRange(p.rotulo, p.min, p.max, l.params[k], (v) => { l.params[k] = v; recomputeBase(l); recompositar(); }));
    });
    // opacidade + blend
    fonteBox.appendChild(ctrlRange("Opacidade", 10, 100, l.opacidade, (v) => { l.opacidade = v; recompositar(); }));
    fonteBox.appendChild(rotulado("Mistura (blend)", ctrlSelect(["normal", "multiply", "screen", "overlay", "difference"], l.blend, (v) => { l.blend = v; recompositar(); })));

    // adicionar bloco
    const add = $("st-add-bloco"); add.innerHTML = "";
    const selB = document.createElement("select"); selB.className = "st-sel";
    selB.innerHTML = '<option value="">＋ Adicionar bloco…</option>' + Object.keys(BLOCOS).map((t) => '<option value="' + t + '">' + BLOCOS[t].nome + "</option>").join("");
    selB.onchange = () => { if (!selB.value) return; l.blocos.push(novoBloco(selB.value)); selB.value = ""; renderPrograma(); recompositar(); };
    add.appendChild(selB);

    // pilha de blocos
    const bx = $("st-blocos"); bx.innerHTML = "";
    if (!l.blocos.length) bx.innerHTML = '<div class="vazia-mini">Sem blocos — a fonte aparece direta. Adicione Repetir, Radial, Grade…</div>';
    l.blocos.forEach((b, bi) => bx.appendChild(cardBloco(l, b, bi)));
  }

  function novoBloco(tipo) {
    const def = BLOCOS[tipo].params, b = { tipo: tipo };
    for (const k in def) { const d = def[k]; b[k] = Array.isArray(d) ? d[2] : (d.sel ? d.padrao : (d.cor || 0)); }
    return b;
  }
  function cardBloco(l, b, bi) {
    const def = BLOCOS[b.tipo];
    const card = document.createElement("div"); card.className = "st-bloco"; card.style.setProperty("--c", CAT_COR[def.cat]);
    const top = document.createElement("div"); top.className = "st-bloco-top";
    top.innerHTML = "<b>" + def.nome + "</b>";
    const ferr = document.createElement("span");
    const mk = (txt, fn) => { const x = document.createElement("button"); x.textContent = txt; x.onclick = fn; return x; };
    ferr.appendChild(mk("▲", () => { if (bi > 0) { const t = l.blocos[bi - 1]; l.blocos[bi - 1] = b; l.blocos[bi] = t; renderPrograma(); recompositar(); } }));
    ferr.appendChild(mk("▼", () => { if (bi < l.blocos.length - 1) { const t = l.blocos[bi + 1]; l.blocos[bi + 1] = b; l.blocos[bi] = t; renderPrograma(); recompositar(); } }));
    ferr.appendChild(mk("✕", () => { l.blocos.splice(bi, 1); renderPrograma(); recompositar(); }));
    top.appendChild(ferr); card.appendChild(top);
    Object.keys(def.params).forEach((k) => {
      const d = def.params[k];
      if (Array.isArray(d)) card.appendChild(ctrlRange(k, d[0], d[1], b[k], (v) => { b[k] = v; recompositar(); }, true));
      else if (d.sel) card.appendChild(rotulado(k, ctrlSelect(d.sel, b[k], (v) => { b[k] = v; recompositar(); })));
      else if (d.cor !== undefined) card.appendChild(rotulado(k, ctrlCor(b[k], (v) => { b[k] = v; recompositar(); })));
    });
    return card;
  }

  // ───────── controles utilitários ─────────
  function rotulado(rotulo, el) { const w = document.createElement("div"); w.className = "campo"; const l = document.createElement("label"); l.textContent = rotulo; w.appendChild(l); w.appendChild(el); return w; }
  function ctrlRange(rotulo, min, max, val, onChange, mini) {
    const w = document.createElement("div"); w.className = "campo" + (mini ? " mini" : "");
    const lab = document.createElement("label"); const b = document.createElement("b"); b.textContent = val;
    lab.textContent = rotulo + " "; lab.appendChild(b); w.appendChild(lab);
    const inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.value = val;
    inp.oninput = () => { b.textContent = inp.value; onChange(+inp.value); }; w.appendChild(inp); return w;
  }
  function ctrlSelect(opcoes, val, onChange) { const s = document.createElement("select"); s.className = "st-sel"; opcoes.forEach((o) => { const op = document.createElement("option"); op.value = o; op.textContent = o; if (o === val) op.selected = true; s.appendChild(op); }); s.onchange = () => onChange(s.value); return s; }
  function ctrlCor(val, onChange) { const i = document.createElement("input"); i.type = "color"; i.value = val || "#1b1b1b"; i.oninput = () => onChange(i.value); return i; }
  function ctrlTexto(rotulo, val, onChange) { const w = rotulado(rotulo, (function () { const i = document.createElement("input"); i.type = "text"; i.className = "st-sel"; i.value = val; i.oninput = () => onChange(i.value); return i; })()); return w; }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function imprimir(svg) { const w = window.open("", "_blank"); w.document.write('<html><head><title>Imprimir</title><style>@page{margin:10mm}body{margin:0;display:flex;align-items:center;justify-content:center}svg{width:100%;max-width:190mm;height:auto}</style></head><body>' + svg + "<scr" + "ipt>window.onload=function(){window.print();}</scr" + "ipt></body></html>"); w.document.close(); }
  function toast(m) { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); }

  function novaCamadaUI() { const l = novaCamada(gensDisponiveis()[Math.floor(Math.random() * 6)]); doc.camadas.push(l); sel = doc.camadas.length - 1; renderCamadas(); renderPrograma(); recompositar(); }

  return {
    init: init, novaCamada: novaCamadaUI, recompositar: () => recompositar(),
    _engine: { novaCamada: novaCamada, recomputeBase: recomputeBase, processarCamada: processarCamada, applyBloco: applyBloco, BLOCOS: BLOCOS },
  };
})();
