// mapa-mental-widget — MindMap class (vanilla JS, zero dependencies)
// eslint-disable-next-line no-unused-vars
var MindMap = (function() {
  'use strict';

  var CONFIG = {
    levelSpacing: 35, nodeSpacing: 30, treeIndent: 30, siblingGap: 4, maxPerRow: 9,
    defaultStyle: {
      bgColor: '#3a6ea5', color: '#ffffff', shape: 'rounded-rect',
      fontSize: 14, fontWeight: 'normal', borderColor: '#2a5a8a',
      borderWidth: 2, icon: '', shadow: false, padding: '4px 10px',
    },
    nodeColors: {
      root:    { bg: '#1e293b', color: '#ffffff', border: '#334155' },
      client:  { bg: '#f8fafc', color: '#1e293b', border: '#94a3b8' },
      pedido:  { bg: '#f8fafc', color: '#1e293b', border: '#94a3b8' },
      material:{ bg: '#fefce8', color: '#1e293b', border: '#eab308' },
    },
  };

  // ── Helpers ──────────────────────────────────────────────
  function randId() { return Math.random().toString(36).slice(2, 8); }
  function escHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  // ── Constructor ───────────────────────────────────────────
  function MindMap(container, data, opts) {
    if (!(this instanceof MindMap)) return new MindMap(container, data, opts);
    if (!container) throw new Error('MindMap: container element required');
    this.container = container;
    this.data = data;
    this.opts = opts || {};
    this._state = {
      tree: null, scale: 1, offsetX: 0, offsetY: 0,
      collapsed: new Set(), activeFilter: null
    };
    this._els = {};   // cached DOM refs
    this._listeners = []; // track added listeners for destroy
    this._init();
  }

  // ── Prototype ─────────────────────────────────────────────
  MindMap.prototype = {
    // ── Internal: init ────────────────────────────────────
    _init: function() {
      this._buildDOM();
      this._attachEvents();
      this.render();
    },

    _buildDOM: function() {
      var c = this.container;
      c.classList.add('mw-container');

      var viewer = document.createElement('div');
      viewer.className = 'mw-viewer';
      viewer.id = this._uid('viewer');
      c.appendChild(viewer);

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'mw-svg-conns');
      svg.setAttribute('id', this._uid('svg'));
      viewer.appendChild(svg);

      var nodes = document.createElement('div');
      nodes.className = 'mw-nodes-layer';
      nodes.setAttribute('id', this._uid('nodes'));
      viewer.appendChild(nodes);

      var overlay = document.createElement('div');
      overlay.className = 'mw-zoomwin-overlay';
      overlay.setAttribute('id', this._uid('overlay'));
      c.appendChild(overlay);

      var loading = document.createElement('div');
      loading.className = 'mw-loading';
      loading.setAttribute('id', this._uid('loading'));
      loading.innerHTML = '<div class="mw-spinner"></div><span>Carregando mapa...</span>';
      c.appendChild(loading);

      this._els.viewer = viewer;
      this._els.svg = svg;
      this._els.nodes = nodes;
      this._els.overlay = overlay;
      this._els.loading = loading;
      this._fullscreenTarget = this.opts.fullscreenEl || this.container;
    },

    _uid: function(prefix) {
      return 'mw-' + prefix + '-' + randId();
    },

    _q: function(sel) {
      return this.container.querySelector(sel);
    },

    _qa: function(sel) {
      return this.container.querySelectorAll(sel);
    },

    _on: function(el, evt, fn, opts) {
      el.addEventListener(evt, fn, opts || false);
      this._listeners.push({ el: el, evt: evt, fn: fn, opts: opts });
    },

    // ── Public: render ──────────────────────────────────────
    render: function() {
      var data = this.data;
      var s = this._state;

      this._q('.mw-loading').style.display = 'none';

      if (!data || !data.treeData || !data.treeData.children || data.treeData.children.length === 0) {
        this._els.nodes.innerHTML = '<div style="color:#667;padding:20px">Nenhum dado disponivel</div>';
        return;
      }

      var adapted = this._adaptTree(data.treeData);
      var tree = this._normalizeTree(adapted);
      s.tree = tree;
      this._renderTree(tree);
    },

    // ── Public: destroy ─────────────────────────────────────
    destroy: function() {
      for (var i = 0; i < this._listeners.length; i++) {
        var l = this._listeners[i];
        l.el.removeEventListener(l.evt, l.fn, l.opts);
      }
      this._listeners = [];
      this.container.innerHTML = '';
      this.container.classList.remove('mw-container');
      this._state.tree = null;
    },

    // ── Public: controls ────────────────────────────────────
    expandAll: function() {
      this._state.collapsed.clear();
      if (this._state.tree) this._renderTree(this._state.tree);
    },

    collapseAll: function() {
      if (!this._state.tree) return;
      this._state.collapsed.clear();
      var that = this;
      function collect(n) {
        if (n.children && n.children.length > 0) {
          that._state.collapsed.add(n._id);
          n.children.forEach(collect);
        }
      }
      if (this._state.tree.children) this._state.tree.children.forEach(collect);
      this._renderTree(this._state.tree);
    },

    centerView: function() {
      if (!this._state.tree) return;
      this._renderTree(this._state.tree);
    },

    setFilter: function(cor) {
      this._state.activeFilter = cor;
      this._applyFilter(cor);
    },

    getState: function() {
      return {
        scale: this._state.scale,
        offsetX: this._state.offsetX,
        offsetY: this._state.offsetY,
        collapsed: this._state.collapsed,
        activeFilter: this._state.activeFilter
      };
    },

    // ── Public: render legend into given container ──────────
    renderLegend: function(containerEl, contagem) {
      if (!containerEl) return;
      var cores = [
        { cor: '#cbd5e1', label: 'Pendente' },
        { cor: '#7dd3fc', label: 'Estoque' },
        { cor: '#fed7aa', label: 'Programado' },
        { cor: '#f59e0b', label: 'Dobra' },
        { cor: '#93c5fd', label: 'Expedição' },
        { cor: '#bbf7d0', label: 'Finalizado' },
      ];
      var total = 0;
      if (contagem) {
        for (var k in contagem) if (contagem.hasOwnProperty(k)) total += contagem[k];
      }

      var html = '<div class="mw-legend" id="' + this._uid('legend') + '">';
      html += '<span class="mw-legend-todos" id="' + this._uid('todos') + '">';
      html += '<span class="mw-dot" style="background:transparent;border:2px solid var(--text2,#5a5a5a);display:inline-block;width:16px;height:16px;border-radius:50%;margin-right:4px;vertical-align:middle"></span> Todos <span class="mw-legend-total-cnt">' + (total ? '(' + total + ')' : '') + '</span></span>';
      for (var i = 0; i < cores.length; i++) {
        var c = cores[i];
        var cnt = contagem && contagem[c.cor] ? contagem[c.cor] : 0;
        html += '<span data-cor="' + c.cor + '"><span class="mw-dot" style="background:' + c.cor + '"></span> ' + c.label + ' <span class="mw-legend-cnt">(' + cnt + ')</span></span>';
      }
      html += '</div>';
      containerEl.innerHTML = html;

      var that = this;
      containerEl.querySelectorAll('[data-cor]').forEach(function(el) {
        that._on(el, 'click', function() {
          var cor = this.getAttribute('data-cor');
          if (this.classList.contains('is-active')) {
            this.classList.remove('is-active');
            that._state.activeFilter = null;
            that._applyFilter(null);
          } else {
            containerEl.querySelectorAll('[data-cor]').forEach(function(s) { s.classList.remove('is-active'); });
            this.classList.add('is-active');
            that._state.activeFilter = cor;
            that._applyFilter(cor);
          }
        });
      });

      var todos = containerEl.querySelector('.mw-legend-todos');
      if (todos) {
        this._on(todos, 'click', function() {
          containerEl.querySelectorAll('[data-cor].is-active').forEach(function(s) { s.classList.remove('is-active'); });
          that._state.activeFilter = null;
          that._applyFilter(null);
        });
      }
    },

    // ── Public: render controls into given container ────────
    renderControls: function(containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML =
        '<label style="font-size:var(--fs-sm);color:var(--text2,#5a5a5a);display:flex;align-items:center;gap:4px;flex-shrink:0">Zoom <span class="mw-zoom-label" id="' + this._uid('zoomLabel') + '">100%</span></label>' +
        '<button class="mw-btn zoom-win-btn" style="white-space:nowrap">🔍 Janela</button>' +
        '<button class="mw-btn center-btn" style="white-space:nowrap">⛶ Centralizar</button>' +
        '<button class="mw-btn expand-btn" style="white-space:nowrap">⊞ Expandir</button>' +
        '<button class="mw-btn collapse-btn" style="white-space:nowrap">⊟ Contrair</button>' +
        '<button class="mw-btn fullscreen-btn" style="white-space:nowrap">⛶ Tela cheia</button>';

      var that = this;
      var zoomLabel = containerEl.querySelector('.mw-zoom-label');
      var zoomWinBtn = containerEl.querySelector('.zoom-win-btn');
      var centerBtn = containerEl.querySelector('.center-btn');
      var expandBtn = containerEl.querySelector('.expand-btn');
      var collapseBtn = containerEl.querySelector('.collapse-btn');
      var fullscreenBtn = containerEl.querySelector('.fullscreen-btn');

      if (zoomLabel) {
        this._els.zoomLabel = zoomLabel;
        this._on(zoomLabel, 'click', function() {
          var input = document.createElement('input');
          input.type = 'number';
          input.className = 'mw-zoom-input';
          input.value = Math.round(that._state.scale * 100);
          input.min = 20; input.max = 200;
          var label = this;
          label.parentNode.replaceChild(input, label);
          input.focus(); input.select();
          function done() {
            var val = parseInt(input.value);
            var span = document.createElement('span');
            span.className = 'mw-zoom-label';
            input.parentNode.replaceChild(span, input);
            if (!isNaN(val) && val >= 20 && val <= 200) that._updateZoom(val);
            span.textContent = Math.round(that._state.scale * 100) + '%';
            that._on(span, 'click', arguments.callee);
          }
          that._on(input, 'blur', done);
          that._on(input, 'keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { done(); }
          });
        });
      }

      if (zoomWinBtn) this._on(zoomWinBtn, 'click', function() { that._toggleZoomWin(zoomWinBtn); });
      if (centerBtn) this._on(centerBtn, 'click', function() { that.centerView(); });
      if (expandBtn) this._on(expandBtn, 'click', function() { that.expandAll(); });
      if (collapseBtn) this._on(collapseBtn, 'click', function() { that.collapseAll(); });
      if (fullscreenBtn) this._on(fullscreenBtn, 'click', function() { that._toggleFullscreen(fullscreenBtn); });
    },

    // ── Internal: adaptTree ─────────────────────────────────
    _adaptTree: function(node, depth) {
      depth = depth || 0;
      if (!node || typeof node !== 'object') return { text: String(node || ''), children: [] };
      var that = this;
      var n = { text: node.content || node.text || node.name || '(sem texto)', children: [] };
      if (depth === 0) n._direction = 'coluna';
      else if (depth === 1) n._direction = 'linha';
      if (node._cor) n._cor = node._cor;
      if (node.children && node.children.length) {
        n.children = node.children.map(function(c) { return that._adaptTree(c, depth + 1); });
      }
      return n;
    },

    // ── Internal: normalizeTree ─────────────────────────────
    _normalizeTree: function(raw, depth) {
      depth = depth || 0;
      if (depth > 50) throw new Error('Profundidade maxima excedida');
      if (!raw || typeof raw !== 'object') {
        return { text: String(raw || ''), children: [], _depth: depth, _id: randId() };
      }
      var that = this;
      var node = {
        text: raw.text || raw.title || raw.name || '(sem texto)',
        children: [], _depth: depth, _id: randId(),
      };
      if (raw._direction === 'linha' || raw._direction === 'coluna') node._direction = raw._direction;
      if (raw._cor) node._cor = raw._cor;
      if (raw.children && Array.isArray(raw.children)) {
        node.children = raw.children.map(function(c) { return that._normalizeTree(c, depth + 1); });
      }
      return node;
    },

    // ── Internal: config style resolution ───────────────────
    _resolveConfigStyle: function() {
      var s = {};
      for (var k in CONFIG.defaultStyle) s[k] = CONFIG.defaultStyle[k];
      var globalConfig = this.opts.config;
      if (globalConfig) {
        if (globalConfig.bgColor !== undefined) s.bgColor = globalConfig.bgColor;
        if (globalConfig.color !== undefined) s.color = globalConfig.color;
        if (globalConfig.shape !== undefined) s.shape = globalConfig.shape;
        if (globalConfig.fontSize !== undefined) s.fontSize = globalConfig.fontSize;
        if (globalConfig.fontWeight !== undefined) s.fontWeight = globalConfig.fontWeight;
        if (globalConfig.borderColor !== undefined) s.borderColor = globalConfig.borderColor;
        if (globalConfig.borderWidth !== undefined) s.borderWidth = globalConfig.borderWidth;
        if (globalConfig.shadow !== undefined) s.shadow = globalConfig.shadow;
        if (globalConfig.padding !== undefined) s.padding = globalConfig.padding;
      }
      var shapeMap = { 'rounded-rect':'rounded-rect','rounded':'rounded-rect','rect':'rect','rectangle':'rect','circle':'circle','circular':'circle','diamond':'diamond','cloud':'cloud' };
      s.shape = shapeMap[s.shape] || 'rounded-rect';
      return s;
    },

    // ── Internal: text measurement ──────────────────────────
    _getTextWidth: function(text, fontSize, fontWeight) {
      if (!this._textCanvas) { this._textCanvas = document.createElement('canvas'); }
      var ctx = this._textCanvas.getContext('2d');
      ctx.font = (fontWeight || 'normal') + ' ' + (fontSize || 14) + 'px "Segoe UI", system-ui, sans-serif';
      return ctx.measureText(text || '').width;
    },

    // ── Internal: layout engine ─────────────────────────────
    _layoutTree: function(node) {
      if (!node) return;
      var s = this._state;
      var that = this;

      function measure(nd) {
        var style = that._resolveConfigStyle();
        var fs = style.fontSize || 14;
        var pad = (style.padding || '10px 18px').split(/\s+/);
        var padH = parseInt(pad[1] || pad[0]) * 2;
        var padV = parseInt(pad[0]) * 2;
        var txtW = that._getTextWidth(nd.text, fs, style.fontWeight);
        nd._w = Math.max(txtW + padH, 40);
        nd._h = Math.max(fs * 1.6 + padV, 28);
        if (style.shape === 'circle' || style.shape === 'diamond') {
          var m = Math.max(nd._w, nd._h);
          nd._w = m + 10; nd._h = m + 10;
        }
        return style;
      }

      function layoutNode(nd, depth, parentDir) {
        nd._depth = depth;
        measure(nd);
        var dir = nd._direction || parentDir || 'coluna';
        if (!nd.children || nd.children.length === 0 || s.collapsed.has(nd._id)) {
          nd._sw = nd._w; nd._sh = nd._h;
          nd._extentTop = -nd._h / 2;
          nd._extentBottom = nd._h / 2;
          return;
        }
        for (var i = 0; i < nd.children.length; i++) {
          layoutNode(nd.children[i], depth + 1, dir);
        }
        if (dir === 'linha') arrangeLinha(nd);
        else arrangeColuna(nd);
      }

      function arrangeLinha(nd) {
        var indent = CONFIG.treeIndent;
        var sp = CONFIG.levelSpacing;
        var sg = CONFIG.siblingGap;
        var y = sp;
        for (var i = 0; i < nd.children.length; i++) {
          var ch = nd.children[i];
          ch._ox = indent + ch._w / 2;
          ch._oy = y;
          y += ch._sh + (i < nd.children.length - 1 ? sg : 0);
        }
        var maxB = nd._h / 2, minT = -nd._h / 2, maxR = nd._w / 2, minL = -nd._w / 2;
        for (var i = 0; i < nd.children.length; i++) {
          var ch = nd.children[i];
          var t = ch._oy + ch._extentTop, b = ch._oy + ch._extentBottom;
          if (t < minT) minT = t; if (b > maxB) maxB = b;
          var l = ch._ox - ch._sw / 2, r = ch._ox + ch._sw / 2;
          if (l < minL) minL = l; if (r > maxR) maxR = r;
        }
        nd._sh = maxB - minT; nd._sw = maxR - minL;
        nd._extentTop = minT; nd._extentBottom = maxB;
      }

      function arrangeColuna(nd) {
        var sp = CONFIG.nodeSpacing;
        var lvlSp = CONFIG.levelSpacing;
        var mpr = CONFIG.maxPerRow;
        var rows = [], curRow = [];
        for (var i = 0; i < nd.children.length; i++) {
          curRow.push(nd.children[i]);
          if (curRow.length >= mpr) { rows.push(curRow); curRow = []; }
        }
        if (curRow.length > 0) rows.push(curRow);
        var y = lvlSp;
        var totalW = 0;
        rows.forEach(function(row) {
          var rowW = row.reduce(function(acc, ch) { return acc + ch._sw; }, 0) + (row.length - 1) * sp;
          if (rowW > totalW) totalW = rowW;
        });
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          var rowW = row.reduce(function(acc, ch) { return acc + ch._sw; }, 0) + (row.length - 1) * sp;
          var x = -rowW / 2;
          var rowH = 0;
          for (var i = 0; i < row.length; i++) {
            row[i]._ox = x + row[i]._sw / 2;
            row[i]._oy = y;
            x += row[i]._sw + sp;
            if (row[i]._sh > rowH) rowH = row[i]._sh;
          }
          y += rowH + lvlSp;
        }
        var maxB = nd._h / 2, minT = -nd._h / 2, maxR = nd._w / 2, minL = -nd._w / 2;
        for (var i = 0; i < nd.children.length; i++) {
          var ch = nd.children[i];
          var t = ch._oy + ch._extentTop, b = ch._oy + ch._extentBottom;
          if (t < minT) minT = t; if (b > maxB) maxB = b;
          var l = ch._ox - ch._sw / 2, r = ch._ox + ch._sw / 2;
          if (l < minL) minL = l; if (r > maxR) maxR = r;
        }
        nd._sh = maxB - minT; nd._sw = maxR - minL;
        nd._extentTop = minT; nd._extentBottom = maxB;
      }

      function position(nd, px, py) {
        px = px || 0; py = py || 0;
        nd._x = px + (nd._ox || 0);
        nd._y = py + (nd._oy || 0);
        if (nd.children && !s.collapsed.has(nd._id)) {
          for (var i = 0; i < nd.children.length; i++) {
            position(nd.children[i], px, py);
          }
        }
      }

      var dir = node._direction || 'coluna';
      layoutNode(node, 0, dir);
      node._ox = 0; node._oy = 0;
      position(node, 0, 0);
    },

    // ── Internal: calc bounding box ─────────────────────────
    _calcBBox: function(node) {
      var s = this._state;
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      function walk(n) {
        var hw = n._w / 2, hh = n._h / 2;
        minX = Math.min(minX, n._x - hw); minY = Math.min(minY, n._y - hh);
        maxX = Math.max(maxX, n._x + hw); maxY = Math.max(maxY, n._y + hh);
        if (n.children && !s.collapsed.has(n._id)) n.children.forEach(walk);
      }
      walk(node);
      return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
    },

    // ── Internal: render tree ───────────────────────────────
    _renderTree: function(root) {
      var nodesLayer = this._els.nodes;
      var svgConns = this._els.svg;
      nodesLayer.innerHTML = '';
      svgConns.innerHTML = '';
      this._layoutTree(root);
      var box = this._calcBBox(root);
      var ox = -box.minX, oy = -box.minY;
      var s = this._state;
      var that = this;

      function renderNode(nd) {
        var style = that._resolveConfigStyle();
        var nc;
        if (nd._depth === 0) nc = CONFIG.nodeColors.root;
        else if (nd._depth === 1) nc = CONFIG.nodeColors.client;
        else if (nd._depth === 2) nc = CONFIG.nodeColors.pedido;
        else nc = CONFIG.nodeColors.material;
        nc = nc || { bg: '#f8fafc', color: '#1e293b', border: '#94a3b8' };
        var el = document.createElement('div');
        el.className = 'mw-node';
        el.style.left = (nd._x - nd._w / 2 + ox) + 'px';
        el.style.top = (nd._y - nd._h / 2 + oy) + 'px';
        el.style.width = nd._w + 'px';
        el.style.height = nd._h + 'px';
        el.style.backgroundColor = nc.bg;
        el.style.color = nc.color;
        el.style.fontSize = style.fontSize + 'px';
        el.style.fontWeight = style.fontWeight;
        el.style.border = style.borderWidth + 'px solid ' + nc.border;
        el.style.padding = style.padding;
        el.style.borderRadius = (style.shape === 'rounded-rect' ? '10px' : style.shape === 'rect' ? '2px' : style.shape === 'circle' || style.shape === 'diamond' ? '50%' : '12px 12px 12px 4px');
        if (style.shadow) el.style.boxShadow = '0 4px 16px rgba(0,0,0,.35)';
        if (style.shape === 'diamond') {
          el.style.transform = 'rotate(45deg)';
          el.style.clipPath = 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)';
        }
        el.innerHTML = '<span class="mw-node-text">' + escHtml(nd.text) + '</span>';
        if (nd._cor) {
          el.style.backgroundColor = nd._cor;
          el.style.color = '#1e293b';
          el.style.borderColor = nd._cor;
        }
        el.dataset.cor = nd._cor || '';
        if (nd.children && nd.children.length > 0) {
          var btn = document.createElement('div');
          btn.className = 'mw-collapse-btn';
          btn.textContent = s.collapsed.has(nd._id) ? '+' : '-';
          btn.onclick = function(e) { e.stopPropagation(); that._toggleCollapse(nd._id, root); };
          el.appendChild(btn);
        }
        el.onclick = function(e) {
          if (nd.children && nd.children.length > 0 && !e.target.classList.contains('mw-collapse-btn')) {
            that._toggleCollapse(nd._id, root);
          }
        };
        nodesLayer.appendChild(el);
        if (nd.children && !s.collapsed.has(nd._id)) {
          nd.children.forEach(function(c) { renderNode(c); });
        }
      }

      function renderConns(nd) {
        if (!nd.children || s.collapsed.has(nd._id)) return;
        var dir = nd._direction || 'coluna';
        if (dir === 'coluna') {
          var x1 = nd._x + ox, y1 = nd._y + nd._h / 2 + oy;
          var mpr = CONFIG.maxPerRow;
          var rows = [];
          for (var i = 0; i < nd.children.length; i++) {
            var ri = Math.floor(i / mpr);
            if (!rows[ri]) rows[ri] = [];
            rows[ri].push(nd.children[i]);
          }
          var prevY = y1;
          for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (row.length === 0) continue;
            var yTop = row[0]._y - row[0]._h / 2 + oy;
            var midY = prevY + (yTop - prevY) / 2;
            if (r === 0) addPath(x1, prevY, x1, midY);
            var firstX = row[0]._x + ox;
            var lastX = row[row.length - 1]._x + ox;
            addPath(Math.min(x1, firstX), midY, Math.max(x1, lastX), midY);
            for (var i2 = 0; i2 < row.length; i2++) {
              var ch = row[i2];
              var cx = ch._x + ox;
              var cy = ch._y - ch._h / 2 + oy;
              addPath(cx, midY, cx, cy);
            }
            var yBottom = -Infinity;
            for (var i2 = 0; i2 < row.length; i2++) {
              var b = row[i2]._y + row[i2]._extentBottom + oy;
              if (b > yBottom) yBottom = b;
            }
            if (r < rows.length - 1) addPath(x1, midY, x1, yBottom);
            prevY = yBottom;
          }
          nd.children.forEach(renderConns);
        } else {
          var x1 = nd._x + ox, y1 = nd._y + nd._h / 2 + oy;
          var trunkEnd = y1;
          for (var i = 0; i < nd.children.length; i++) {
            var ch = nd.children[i], cy = ch._y + oy;
            if (cy > trunkEnd) trunkEnd = cy;
          }
          addPath(x1, y1, x1, trunkEnd);
          for (var i = 0; i < nd.children.length; i++) {
            var ch = nd.children[i], cy = ch._y + oy, cx = ch._x + ox - ch._w / 2;
            addPath(x1, cy, cx, cy);
          }
          nd.children.forEach(renderConns);
        }
      }

      function addPath(x1, y1, x2, y2) {
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2);
        p.setAttribute('stroke', '#555');
        p.setAttribute('stroke-width', '2');
        p.setAttribute('fill', 'none');
        p.setAttribute('opacity', '0.5');
        svgConns.appendChild(p);
      }

      renderNode(root);
      renderConns(root);
      this._autoCenter(box);
      if (s.activeFilter) this._applyFilter(s.activeFilter);
    },

    // ── Internal: toggle collapse ───────────────────────────
    _toggleCollapse: function(id, tree) {
      var s = this._state;
      if (s.collapsed.has(id)) s.collapsed.delete(id);
      else s.collapsed.add(id);
      s.tree = tree;
      this._renderTree(tree);
    },

    // ── Internal: zoom / center ─────────────────────────────
    _autoCenter: function(box) {
      var panel = this.container;
      var pw = panel.clientWidth, ph = panel.clientHeight;
      var tw = box.w + 80, th = box.h + 80;
      var sx = pw / tw, sy = ph / th;
      var s = this._state;
      s.scale = Math.max(0.15, Math.min(sx, sy, 1.5));
      s.offsetX = (pw - tw * s.scale) / 2;
      s.offsetY = (ph - th * s.scale) / 2;
      this._applyViewTransform();
      this._updateZoomLabel();
    },

    _applyViewTransform: function() {
      var s = this._state;
      this._els.viewer.style.transform = 'translate(' + s.offsetX + 'px, ' + s.offsetY + 'px) scale(' + s.scale + ')';
    },

    _updateZoom: function(val) {
      this._state.scale = val / 100;
      this._applyViewTransform();
      this._updateZoomLabel();
    },

    _updateZoomLabel: function() {
      var label = this._els.zoomLabel;
      if (label) label.textContent = Math.round(this._state.scale * 100) + '%';
    },

    // ── Internal: filter ────────────────────────────────────
    _applyFilter: function(cor) {
      var nodes = this._els.nodes;
      if (!cor) {
        nodes.querySelectorAll('.mw-node-dimmed,.mw-node-highlight').forEach(function(el) {
          el.classList.remove('mw-node-dimmed', 'mw-node-highlight');
        });
        return;
      }
      nodes.querySelectorAll('.mw-node').forEach(function(el) {
        var nc = el.dataset.cor;
        if (nc === cor) {
          el.classList.remove('mw-node-dimmed');
          el.classList.add('mw-node-highlight');
        } else {
          el.classList.remove('mw-node-highlight');
          el.classList.add('mw-node-dimmed');
        }
      });
    },

    // ── Internal: toggle zoom-win mode ──────────────────────
    _toggleZoomWin: function(btn) {
      this._zoomWin = !this._zoomWin;
      btn.classList.toggle('is-active', this._zoomWin);
      var viewer = this._els.viewer;
      viewer.style.cursor = this._zoomWin ? 'crosshair' : 'grab';
      this._els.overlay.style.display = 'none';
    },

    // ── Internal: toggle fullscreen ─────────────────────────
    _toggleFullscreen: function(btn) {
      var target = this._fullscreenTarget;
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(){});
        this._fullscreenTarget.classList.add('mw-fullscreen');
        btn.textContent = '✕ Sair';
      } else {
        document.exitFullscreen().catch(function(){});
        this._fullscreenTarget.classList.remove('mw-fullscreen');
        btn.textContent = '⛶ Tela cheia';
      }
      var that = this;
      setTimeout(function() {
        if (that._state.tree) that._renderTree(that._state.tree);
      }, 80);
    },

    // ── Internal: attach events ─────────────────────────────
    _attachEvents: function() {
      var that = this;
      var s = this._state;
      var viewer = this._els.viewer;
      var panel = this.container;

      // Pan via mouse
      var isPan = false, sx, sy, ox, oy;
      this._on(viewer, 'mousedown', function(e) {
        if (that._zoomWin) return;
        if (e.target.closest('.mw-node') || e.target.closest('.mw-btn') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        isPan = true; sx = e.clientX; sy = e.clientY; ox = s.offsetX; oy = s.offsetY;
        viewer.style.cursor = 'grabbing';
      });
      this._on(window, 'mousemove', function(e) {
        if (!isPan) return;
        s.offsetX = ox + (e.clientX - sx);
        s.offsetY = oy + (e.clientY - sy);
        that._applyViewTransform();
      });
      this._on(window, 'mouseup', function() {
        if (isPan) { isPan = false; viewer.style.cursor = 'grab'; }
      });

      // Zoom via scroll
      this._on(panel, 'wheel', function(e) {
        e.preventDefault();
        var rect = panel.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var worldX = (mx - s.offsetX) / s.scale;
        var worldY = (my - s.offsetY) / s.scale;
        var factor = e.deltaY > 0 ? 0.88 : 1.12;
        var ns = Math.max(0.2, Math.min(4, s.scale * factor));
        s.offsetX = mx - worldX * ns;
        s.offsetY = my - worldY * ns;
        s.scale = ns;
        that._applyViewTransform();
        that._updateZoomLabel();
      }, { passive: false });

      // Zoom window
      this._initZoomWindow();

      // Touch pan
      var ti = null, tX, tY, tOX, tOY;
      this._on(viewer, 'touchstart', function(e) {
        if (e.touches.length === 1) {
          ti = e.touches[0].identifier;
          tX = e.touches[0].clientX; tY = e.touches[0].clientY;
          tOX = s.offsetX; tOY = s.offsetY;
        }
      }, { passive: true });
      this._on(viewer, 'touchmove', function(e) {
        if (e.touches.length === 1 && e.touches[0].identifier === ti) {
          e.preventDefault();
          s.offsetX = tOX + (e.touches[0].clientX - tX);
          s.offsetY = tOY + (e.touches[0].clientY - tY);
          that._applyViewTransform();
        }
      }, { passive: false });

      // Ctrl+Z center
      this._on(document, 'keydown', function(e) {
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); that.centerView(); }
      });

      // Fullscreen change
      this._on(document, 'fullscreenchange', function() {
        if (!document.fullscreenElement) {
          that._fullscreenTarget.classList.remove('mw-fullscreen');
          var btn = that.container.querySelector('.fullscreen-btn');
          if (btn) btn.textContent = '⛶ Tela cheia';
          setTimeout(function() {
            if (that._state.tree) that._renderTree(that._state.tree);
          }, 80);
        }
      });
    },

    // ── Internal: zoom window logic ─────────────────────────
    _initZoomWindow: function() {
      var that = this;
      var s = this._state;
      var viewer = this._els.viewer;
      var overlay = this._els.overlay;
      var panel = this.container;
      var zwStartX, zwStartY;

      this._on(viewer, 'mousedown', function(e) {
        if (!that._zoomWin) return;
        if (e.target.closest('.mw-btn') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        var r = panel.getBoundingClientRect();
        zwStartX = e.clientX - r.left;
        zwStartY = e.clientY - r.top;
        overlay.style.left = zwStartX + 'px';
        overlay.style.top = zwStartY + 'px';
        overlay.style.width = '0px';
        overlay.style.height = '0px';
        overlay.style.display = 'block';
        e.preventDefault();
      });

      this._on(viewer, 'mousemove', function(e) {
        if (!that._zoomWin || overlay.style.display === 'none') return;
        var r = panel.getBoundingClientRect();
        var cx = e.clientX - r.left, cy = e.clientY - r.top;
        var l = Math.min(zwStartX, cx), t = Math.min(zwStartY, cy);
        var w = Math.abs(cx - zwStartX), h = Math.abs(cy - zwStartY);
        overlay.style.left = l + 'px';
        overlay.style.top = t + 'px';
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';
      });

      this._on(viewer, 'mouseup', function(e) {
        if (!that._zoomWin || overlay.style.display === 'none') return;
        overlay.style.display = 'none';
        var r = panel.getBoundingClientRect();
        var cx = e.clientX - r.left, cy = e.clientY - r.top;
        var l = Math.min(zwStartX, cx), t = Math.min(zwStartY, cy);
        var w = Math.abs(cx - zwStartX), h = Math.abs(cy - zwStartY);
        if (w < 10 || h < 10) return;
        var worldL = (l - s.offsetX) / s.scale;
        var worldT = (t - s.offsetY) / s.scale;
        var worldR = (l + w - s.offsetX) / s.scale;
        var worldB = (t + h - s.offsetY) / s.scale;
        var worldW = worldR - worldL, worldH = worldB - worldT;
        var pw = panel.clientWidth, ph = panel.clientHeight;
        var pad = 40;
        var sx2 = (pw - pad * 2) / worldW;
        var sy2 = (ph - pad * 2) / worldH;
        s.scale = Math.max(0.2, Math.min(sx2, sy2, 4));
        var worldCX = (worldL + worldR) / 2;
        var worldCY = (worldT + worldB) / 2;
        s.offsetX = pw / 2 - worldCX * s.scale;
        s.offsetY = ph / 2 - worldCY * s.scale;
        that._applyViewTransform();
        that._updateZoomLabel();
        that._zoomWin = false;
        var btn = panel.querySelector('.zoom-win-btn');
        if (btn) btn.classList.remove('is-active');
        viewer.style.cursor = 'grab';
      });
    },
  };

  return MindMap;
})();
