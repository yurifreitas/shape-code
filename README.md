# 🎨 Desenhos para Pintar · Estímulo Cerebral

Aplicativo web **offline, sem instalação e sem build** para **gerar, desenhar,
montar, pintar, imprimir, salvar e compartilhar** desenhos vetoriais (SVG)
infantis. Cada tipo de desenho é catalogado em um **dataset JSON** com as
**áreas do cérebro** que estimula — foco em uso pedagógico/pesquisa.

> **Abra o `index.html`** com duplo‑clique (Chrome, Edge ou Firefox) ou acesse a
> versão publicada no GitHub Pages. Não precisa de servidor nem internet.

---

## ✨ As 4 telas

### 🎨 Criar
Escolha um dos **26 geradores**, ajuste os parâmetros e **clique em "↻ Gerar
nova variação"** para um desenho único. Depois:

- **Pinte** clicando nas regiões. Com **zoom/pan e tela cheia** (⛶) para detalhes.
- **🎨 Estúdio de Cores** (botão 🎨 no fim da paleta): paletas grandes (Vibrantes, Pastéis,
  Terra), **arco‑íris** (matiz + brilho), **misturar 2 cores**, **pintura em
  degradê (A→B)**, **conta‑gotas** e **texturas** (listrado, bolinhas, xadrez).
- **✨ Efeitos manipuláveis** (ao vivo, sem regenerar): escala, rotação,
  inclinação, espessura, traço irregular, ondular, **simetria/caleidoscópio**
  (espelho/radial), cor do traço e **fundo branco ou transparente**.
- **💾 Salvar & Exportar** (1 botão → menu): salvar na coleção, compartilhar,
  copiar, PNG, SVG, imprimir e **gerar lote** misto ("5× de um, 3× de outro…",
  exporta em PDF ou separado).

### ✏️ Desenhar
Desenhador vetorial **à mão livre** (funciona com o dedo/caneta no celular):

- **Pincéis**: lápis, caneta, marcador, **pincel caligráfico** (largura variável
  pela velocidade), giz, **neon** (brilho), spray e borracha.
- **Formas**: linha, retângulo, elipse, triângulo, estrela, polígono, coração.
- Cor, tamanho, opacidade; **fundo** branco/transparente/decalque (mostra o
  desenho da aba Criar por baixo para contornar).
- Desfazer / Refazer / Limpar; salvar e exportar.

### 🧩 Estúdio (Scratch de imagens)
**Camadas infinitas**, cada uma com uma **fonte** (qualquer gerador) e uma
**pilha de blocos** executada de cima para baixo — como um Scratch:

- **Laços/Lógica**: Repetir, Grade, Radial (encadear = laços aninhados).
- **Mover/Escalar**: Mover, Escalar, **Esticar X/Y**, **Inclinar**, **Inverter**, Girar.
- **Aparência**: Espelhar, Traço, Ondular.
- **Animação (SMIL)**: Girar, Pulsar, Flutuar, Balançar (com play/pause).
- Por camada: **cor de preenchimento/traço**, **escala/rotação/posição**,
  opacidade e modo de mistura (blend). Fundo branco ou transparente.

### 📁 Coleção
Tudo que você salvou (no navegador). Para cada item há um **identificador**.
Você pode **selecionar** itens e:

- **🖨 Imprimir tudo** junto (1 por página → vira PDF).
- **📦 Exportar coleção** (.json) e **📥 Importar** (mescla, sem duplicar).
- **📤 Compartilhar coleção** inteira (menu nativo do celular).
- **☑ Sem cor**: gera só o traço (linha para colorir à mão).

> Fluxo: você exporta/compartilha → alguém colore alguns e devolve o `.json` →
> você importa e imprime tudo junto.

---

## 🧠 Os 26 geradores

| Grupo | Geradores |
|---|---|
| **Formas & simetria** | Forma simples · Mandala · Caleidoscópio · Roseta · Borboleta simétrica · Tesselação |
| **Matemática** | Superfórmula (Gielis) · Espirógrafo · **Hiperespaço 4D** (tesseract, 5/16/24‑célula, Clifford, Hopf) · **Penrose** · **Quasicristal** · **Padrão Islâmico** · **Planta Fractal (L‑System)** · **Gasket de Apollonius** (Descartes) · **Fractal de Julia** |
| **Estado da arte** | **Vitral** (Voronoi + Lloyd) · **Low‑Poly** (Delaunay) · **Truchet** · **Círculos** (packing) · **Labirinto** (backtracker) |
| **Campos / física** | **Reação‑Difusão** (Gray‑Scott) · **Geometria Sagrada** (filotaxia) · **Campo Acoplado** (PDEs ρ–Φ–v) · **Cimática (Chladni)** · Árvore Fractal |
| **Montar** | **Montar Cena (∞)**: 60+ elementos paramétricos, 9 temas, arranjos (cena, espiral áurea, grade, anel) — sem sobreposição |

Três geradores de campo são portados de algoritmos próprios (Gray‑Scott,
filotaxia e PDEs acopladas) → contornos via *marching squares*.

---

## 📂 Estrutura

```
Desenhos para pintar/
├─ index.html            App (abra este arquivo)
├─ css/styles.css        Estilos (responsivo / mobile)
├─ js/
│  ├─ generators.js      Geradores procedurais + matemáticos + estado‑da‑arte
│  ├─ elements.js        60+ elementos de "Montar Cena" + compositor + editor de cena
│  ├─ editor.js          Editor da cena (arrastar, escalar, camadas, alinhar…)
│  ├─ fields.js          Reação‑difusão / campos → marching squares → SVG
│  ├─ effects.js         Efeitos manipuláveis (transform, simetria, filtros, fundo)
│  ├─ studio.js          Estúdio de blocos (camadas + lógica + animação)
│  ├─ draw.js            Desenhador à mão livre (pincéis, formas, toque)
│  ├─ batch.js           Geração em massa por receita (lote misto)
│  ├─ storage.js         Coleção (localStorage), export PNG/SVG, compartilhar, importar
│  └─ app.js             Interface, navegação, pintura, estúdio de cores
└─ data/
   ├─ dataset.js         Dataset usado pela página
   └─ dataset.json       Mesmo dataset, formato portátil (pesquisa)
```

---

## 📊 O dataset (pesquisa/educacional)

`data/dataset.json` contém:

- **`areasCerebro`** — marco teórico com 8 funções/regiões (córtex visual,
  coordenação motora, raciocínio espacial, criatividade, atenção, padrões,
  linguagem, regulação emocional), cada uma com região cerebral, cor e descrição.
- **`geradores`** — cada desenho com faixa etária, áreas estimuladas (`areas[]`),
  justificativa pedagógica (`porque`), algoritmo e parâmetros.

Permite consultar, por exemplo, *"quais desenhos estimulam o raciocínio
espacial?"* ou montar trilhas por idade/função cognitiva.

### Adicionar um gerador
1. Uma função em `js/generators.js` registrada em `window.GENERATORS`.
2. Uma entrada em `data/dataset.js` **e** `dataset.json` com `id` igual ao nome
   da função e os metadados (`areas`, `params`, `faixaEtaria`, `porque`).

---

## 📱 Mobile

- Abas com ícone + **barra de navegação inferior** (toque no polegar).
- **Botão 🎨** (no fim da paleta) e o item **Cores** da barra abrem o estúdio de cores.
- Canvas grande, toque para pintar/desenhar, alvos de toque ampliados, modais em
  tela cheia, **modo Foco ⛶** (esconde os painéis).

## 🔗 Exportar e compartilhar

PNG (alta resolução), SVG (vetorial), **fundo transparente**, impressão/PDF,
**compartilhamento nativo** (Web Share) e **copiar imagem**. A coleção inteira
pode ser exportada/importada como `.json`.

---

Feito para uma criança explorar formas, cores e lógica — e para educadores
ligarem cada atividade a uma função cognitiva.
