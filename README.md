# mapa-mental-widget

Widget de mapa mental interativo em **vanilla JS**. Layout de árvore com zoom/pan, collapse/expand, filtro por cor, fullscreen e suporte touch.

Zero dependências. Qualquer navegador moderno.

## Install

```bash
npm install mapa-mental-widget
# ou local:
npm install file:../mapa-mental-widget
```

## Uso básico

```html
<link rel="stylesheet" href="./node_modules/mapa-mental-widget/src/mindmap.css">

<div id="mapa" style="height:calc(100vh - 140px)"></div>
<div id="legenda"></div>

<script src="./node_modules/mapa-mental-widget/src/mindmap.js"></script>
<script>
  var treeData = {
    text: 'Produção',
    children: [
      { text: 'Cliente A', children: [
          { text: 'Pedido 123', children: [
              { text: 'Aço 6.35', _cor: '#cbd5e1' }
          ]}
      ]}
    ]
  };

  var mm = new MindMap(document.getElementById('mapa'), treeData);

  // Legenda (opcional)
  mm.renderLegend(document.getElementById('legenda'), [
    { cor: '#cbd5e1', label: 'Pendente' },
    { cor: '#bbf7d0', label: 'Finalizado' }
  ]);
</script>
```

## API

### `new MindMap(container, treeData, opts?)`

Cria instância. Renderiza automaticamente.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `container` | HTMLElement | sim | Elemento que receberá o mapa |
| `treeData` | Object | sim | Árvore com `{ text, children?, _cor? }` (ver formato abaixo) |
| `opts` | Object | não | Configurações (ver abaixo) |

#### Opções

| Opção | Default | Descrição |
|---|---|---|
| `directions` | `{ 0: 'coluna', 1: 'linha' }` | Direção dos filhos por profundidade: `'coluna'` ou `'linha'` |
| `nodeColors` | `{ 0: {...}, 1: {...}, 2: {...}, default: {...} }` | Cores por profundidade: `{ bg, color, border }` |
| `config` | `{}` | Override de estilo global (`shape`, `fontSize`, `shadow`, `padding`, ...) |
| `fullscreenEl` | `container` | Elemento que recebe `.mw-fullscreen` ao maximizar |

#### `opts.directions`

```js
directions: {
  0: 'coluna',           // profundidade 0 → coluna
  1: 'linha',            // profundidade 1 → linha
  default: 'coluna'      // fallback
}
```

#### `opts.nodeColors`

```js
nodeColors: {
  0: { bg: '#1e293b', color: '#ffffff', border: '#334155' },
  1: { bg: '#f8fafc', color: '#1e293b', border: '#94a3b8' },
  default: { bg: '#fefce8', color: '#1e293b', border: '#eab308' }
}
```

#### `opts.config`

```js
config: {
  shape: 'rounded-rect',   // 'rounded-rect' | 'rect' | 'circle' | 'diamond' | 'cloud'
  fontSize: 14,
  fontWeight: 'normal',
  shadow: false,
  padding: '4px 10px',
  bgColor: '#3a6ea5',
  color: '#ffffff',
  borderColor: '#2a5a8a',
  borderWidth: 2
}
```

### Métodos

| Método | Descrição |
|---|---|
| `.render()` | Renderiza/atualiza. Chamado automaticamente no constructor |
| `.destroy()` | Remove eventos e limpa o DOM |
| `.expandAll()` | Expande todos os nós |
| `.collapseAll()` | Colapsa todos os nós |
| `.centerView()` | Centraliza a visualização |
| `.setFilter(cor)` | Filtra nós por cor hex (ou `null` pra limpar) |
| `.renderLegend(el, grupos?)` | Renderiza legenda interativa. `grupos: [{ cor, label }]` — se omitido, só mostra cores que aparecem |
| `.renderControls(el)` | Renderiza botões de zoom/controle |
| `.getState()` | Retorna `{ scale, offsetX, offsetY, collapsed, activeFilter }` |

### Formato do treeData

```js
{
  text: "Raiz",                        // label do nó (obrigatório)
  _cor: "#cbd5e1",                     // cor opcional — sobrescreve nodeColors
  children: [{
    text: "Filho",
    children: [{
      text: "Folha",
      _cor: "#bbf7d0"                  // cor só na folha
    }]
  }]
}
```

Nós sem `_cor` usam `nodeColors` pela profundidade.

## Licença MIT
