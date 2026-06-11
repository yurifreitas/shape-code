# Desenhos para Pintar · Estímulo Cerebral

App web (offline, sem instalação) que **gera, monta, pinta, imprime e salva**
desenhos vetoriais infantis para colorir. Cada tipo de desenho é catalogado em
um **dataset JSON** com as **áreas do cérebro** que estimula — foco
pesquisa/educacional.

## Como usar

Basta **abrir o `index.html`** com duplo-clique (Chrome, Edge ou Firefox).
Não precisa de servidor nem internet.

> **Geradores baseados em algoritmos reais** (portados de `Documents/code`):
> - 🦠 **Reação-Difusão (Turing)** — solver Gray-Scott (`fractal/HyperSpectralEngine`,
>   `tetramath/gray_scott_2d_etdrk4`) → marching squares → contornos SVG. Gera
>   páginas orgânicas como os "Turing 4D".
> - 🌀 **Geometria Sagrada** — campo de fluxo Fibonacci+simetria
>   (`fractal/main.py get_sacred_flow`) → marching squares → SVG.
>
> - 🌊 **Campo Acoplado** — sistema de PDEs ρ–Φ–v com termo baroclínico
>   (`simulation/src/engine.js`, JS puro) → contornos SVG. Vórtices e densidade.
>
> Os geradores de campo vivem em `js/fields.js`. São síncronos e pesados (~1s);
> o app mostra um spinner durante a geração.

### Montar Cena (∞) e variedade infinita
- **`js/elements.js`** — biblioteca de **60+ elementos vetoriais paramétricos**
  (cada um varia sozinho: nº de janelas, pétalas, manchas, andares…) + um
  **compositor procedural** com 9 temas (campo, cidade, praia, floresta,
  fazenda, jardim, mar, espaço, fantasia). Tema + densidade + variação +
  semente nova a cada clique = combinações praticamente infinitas.
- **Caleidoscópio** e **Roseta** (em `js/generators.js`) — variedade infinita
  por simetria/camadas + semente.

Prévias geradas na pasta: `preview_*.svg`.

> Os dados ficam em `data/dataset.js` (carregado pela página) e são espelhados
> em `data/dataset.json` (cópia portátil/canônica do dataset).

### Na tela "Criar"
1. Escolha o **tipo de desenho** (11 geradores).
2. Ajuste os **parâmetros**.
3. Clique em **↻ Gerar nova variação** para um desenho único.
4. Escolha uma **cor** e **clique nas regiões** do desenho para pintar.
5. **Salvar na coleção**, **Imprimir**, ou baixar como **PNG/SVG**.

### Editor da cena "Montar Cena (∞)"
Ao escolher *Montar Cena*, aparece a barra do editor (`js/editor.js`):
- **✋ Editar / 🖌 Pintar** — alterna entre compor e colorir.
- **Arraste** qualquer elemento para reposicionar (encaixa no chão/céu/água).
- Selecionado: **⊕/⊖** escala, **⟲/⟳** gira, **⬆/⬇** camadas, **⧉** duplica,
  **🗑** exclui.
- **＋ Adicionar** — paleta com os 60+ elementos por categoria.
- **⊞ Auto-alinhar** — distribui tudo com espaçamento uniforme e mesma base.
- **🎲 Embaralhar** — re-sorteia posições mantendo os elementos.

### Geração em massa (revisar)
Botão **⚃ Gerar 50 (revisar)** abre uma galeria que gera N variações
(12/24/50/100) do gerador atual com sementes diferentes (`js/batch.js`),
preenchendo incrementalmente sem travar. Clique numa miniatura para **abrir**
no editor, **♥** salva na coleção, **PNG** baixa.

### Na tela "Minha Coleção"
Seus desenhos salvos (no navegador, via `localStorage`). Reabra, baixe ou exclua.

## Estrutura

```
Desenhos para pintar/
├─ index.html            App (abra este arquivo)
├─ css/styles.css        Estilos
├─ js/
│  ├─ generators.js      Geradores procedurais de SVG
│  ├─ storage.js         Coleção (localStorage) + export PNG/SVG
│  └─ app.js             Interface
└─ data/
   ├─ dataset.js         Dataset usado pela página
   └─ dataset.json       Mesmo dataset, formato portátil (pesquisa)
```

## O dataset (pesquisa/educacional)

`data/dataset.json` contém:

- **`areasCerebro`** — marco teórico com 8 funções/regiões (córtex visual,
  coordenação motora, raciocínio espacial, criatividade, atenção, padrões,
  linguagem, regulação emocional), cada uma com região cerebral, cor e
  descrição do estímulo.
- **`geradores`** — cada desenho com: faixa etária, áreas estimuladas
  (`areas[]`), justificativa pedagógica (`porque`) e parâmetros.

Isso permite consultar, por exemplo, *"quais desenhos estimulam o raciocínio
espacial?"* ou montar trilhas por idade/função cognitiva.

### Sobre a "hiperdimensionalidade"
O gerador **Hiperespaço (4D)** projeta figuras de dimensões superiores
(hipercubo/*tesseract*, hipercubo aninhado e politopo) de 4D → 3D → 2D com
rotação nos planos X-W e Y-Z. Pintar essas projeções desafia a rotação mental e
a imaginação espacial além do mundo físico.

## Como crescer o dataset

Adicione um novo gerador em **dois lugares**:
1. Uma função em `js/generators.js` registrada em `window.GENERATORS`.
2. Uma entrada em `data/dataset.js` (e `dataset.json`) com `id` igual ao nome
   da função e os metadados (`areas`, `params`, `faixaEtaria`, `porque`).
# shape-code
