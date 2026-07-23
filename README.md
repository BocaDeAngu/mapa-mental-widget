# mapa-mental-widget

Widget de mapa mental interativo em JS puro (vanilla). Engine de layout de árvore com zoom/pan, collapse/expand, legenda, fullscreen e touch.

Zero dependências. Funciona em qualquer navegador moderno.

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
<div id="controles"></div>

<script src="./node_modules/mapa-mental-widget/src/mindmap.js"></script>
<script>
  var data = {
    treeData: { content: 'Produção', children: [/* ... */] },
    contagem: { '#cbd5e1': 5, '#7dd3fc': 12, '#fed7aa': 3, '#f59e0b': 0, '#93c5fd': 7, '#bbf7d0': 15 },
    totalClientes: 8
  };

  var mm = new MindMap(document.getElementById('mapa'), data);

  // Legend and controls are optional
  mm.renderLegend(document.getElementById('legenda'), data.contagem);
  mm.renderControls(document.getElementById('controles'));
</script>
```

## API

### new MindMap(containerEl, data, options?)

Cria instância do mapa mental. Renderiza automaticamente no constructor.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `containerEl` | HTMLElement | sim | Elemento que receberá o mapa |
| `data` | Object | sim | `{ treeData, contagem, totalClientes }` — mesma estrutura do `mapa-mental-core` |
| `options` | Object | não | Opções de configuração (ver abaixo) |

#### Opções

| Opção | Default | Descrição |
|---|---|---|
| `fullscreenEl` | `containerEl` | Elemento que recebe classe `.mw-fullscreen` ao maximizar |
| `config` | `null` | Override de estilo global (bgColor, color, shape, fontSize, etc.) |

### Métodos

| Método | Descrição |
|---|---|
| `.render()` | Renderiza/atualiza o mapa. Chamado automaticamente no constructor |
| `.destroy()` | Remove eventos e limpa DOM |
| `.expandAll()` | Expande todos os nós |
| `.collapseAll()` | Colapsa todos os nós (exceto raiz) |
| `.centerView()` | Centraliza a visualização |
| `.setFilter(cor)` | Filtra nós por cor hex (ou `null` para limpar) |
| `.renderLegend(containerEl, contagem)` | Renderiza legenda interativa em um elemento |
| `.renderControls(containerEl)` | Renderiza botões de zoom/controle em um elemento |
| `.getState()` | Retorna `{ scale, offsetX, offsetY, collapsed, activeFilter }` |

### Formato do treeData

```js
{
  treeData: {
    content: "Produção",
    children: [{
      content: "Cliente X",          // depth=1
      children: [{
        content: "12345",            // depth=2
        children: [{
          content: "Aço 6.35",       // depth=3
          _cor: "#cbd5e1"           // cor do pior status
        }]
      }]
    }]
  },
  totalClientes: 12,
  contagem: { "#cbd5e1": 5, "#7dd3fc": 12, "#fed7aa": 3, "#f59e0b": 0, "#93c5fd": 7, "#bbf7d0": 15 }
}
```

## Licença MIT
