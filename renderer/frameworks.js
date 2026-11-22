/* TagNote – framework-faner (Bootstrap, Tailwind CSS, Bulma, Pico) */
(function () {
  'use strict';
  const { $, $$, api, t, state, ed, esc, el } = TN;
  const rng = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const pre = (p, list) => list.map((v) => p + v);

  /* ======================= mål: valgt element i visningen eller ved markøren i koden ======================= */
  const target = (TN.target = {
    mode() { return state.mode !== 'raw' && TN.sel.el && TN.preview.doc() ? 'dom' : ed.value.trim() ? 'src' : null; },
    srcEl() { const st = TN.map.stackAt(ed.value, ed.selectionStart); return st[st.length - 1] || null; },
    tag() { const m = this.mode(); if (m === 'dom') return TN.sel.el.tagName.toLowerCase(); const e = m === 'src' ? this.srcEl() : null; return e ? e.name : ''; },
    getAttr(n) {
      const m = this.mode();
      if (m === 'dom') return TN.sel.el.getAttribute(n) || '';
      const e = m === 'src' ? this.srcEl() : null; return e ? attrOfSrc(e, n) : '';
    },
    setAttr(n, v) {
      const m = this.mode();
      if (m === 'dom') TN.elOps.setAttr(n, v);
      else if (m === 'src') setAttrSrc(n, v);
    },
    getClass() { return this.getAttr('class'); },
    setClass(v) { this.setAttr('class', v.trim().replace(/\s+/g, ' ')); },
    classes() { return new Set(this.getClass().split(/\s+/).filter(Boolean)); },
    label() {
      const m = this.mode();
      if (m === 'dom') return TN.labelOf(TN.sel.el);
      const e = m === 'src' ? this.srcEl() : null;
      return e ? TN.map.pathAt(ed.value, ed.selectionStart).slice(-1)[0] : '';
    },
  });
  function attrOfSrc(e, n) {
    const open = ed.value.slice(e.pos, e.end);
    const m = new RegExp('\\s' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(open);
    return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : '';
  }
  function setAttrSrc(n, v) {
    const e = target.srcEl(); if (!e) return;
    let open = ed.value.slice(e.pos, e.end);
    const re = new RegExp('(\\s' + n + '\\s*=\\s*)(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
    if (!v) open = open.replace(new RegExp('\\s' + n + '\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i'), '');
    else if (re.test(open)) open = open.replace(re, (_m, a) => a + '"' + String(v).replace(/"/g, '&quot;') + '"');
    else open = open.replace(/\s*\/?>$/, (m) => ' ' + n + '="' + String(v).replace(/"/g, '&quot;') + '"' + m);
    const caret = ed.selectionStart;
    TN.src.replace(e.pos, e.end, open, e.pos + Math.min(open.length - 1, Math.max(1, caret - e.pos)));
  }
  /* attribut på <html> */
  TN.htmlAttr = function (name, val) {
    const m = /<html\b[^>]*>/i.exec(ed.value);
    if (!m) { TN.toast(t('Siden har ingen <html>-tag.')); return false; }
    let open = m[0];
    const re = new RegExp('\\s' + name + '\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
    if (!val) open = open.replace(re, '');
    else if (re.test(open)) open = open.replace(re, ' ' + name + '="' + val + '"');
    else open = open.replace(/>$/, ' ' + name + '="' + val + '">');
    TN.src.replace(m.index, m.index + m[0].length, open);
    return true;
  };

  /* ======================= indsæt kode ======================= */
  TN.insert = function (html, caret) {
    if (state.mode !== 'raw' && TN.focusPane === 'preview' && TN.preview.doc() && state.edit) { TN.preview.insertHtml(html); return; }
    if (state.mode === 'read') TN.setMode('split');
    TN.src.insertBlock(html, caret);
  };

  /* ======================= ribbon-byggeklodser ======================= */
  const grp = (label, ...kids) => { const g = el('div', 'group'); const it = el('div', 'items'); it.append(...kids); g.append(it, Object.assign(el('div', 'label'), { textContent: t(label) })); return g; };
  const col = (...kids) => { const c = el('div', 'items col'); c.append(...kids); return c; };
  const row = (...kids) => { const r = el('div', 'row'); r.append(...kids); return r; };
  const big = (icon, label, onClick, tip) => {
    const b = el('button', 'rb big'); b.innerHTML = window.WDicon(icon) + '<span>' + esc(t(label)) + '</span>';
    if (tip) b.dataset.tip = tip; b.onclick = (e) => onClick(b, e); return b;
  };
  const menuBtn = (icon, label, items, tip) => big(icon, label + ' ▾', (b) => TN.popMenu(b, items()), tip);
  const smallBtn = (label, onClick, tip) => { const b = el('button', 'rb sm txt'); b.textContent = label; if (tip) b.dataset.tip = tip; b.onclick = onClick; return b; };
  const snipItems = (list) => list.map(([label, html, hint]) => (label === '-' ? '-' : { label, hint, onClick: () => TN.insert(html) }));

  /* ======================= klassemotor ======================= */
  const ctrls = [];
  let twVariant = '';
  /* list: ét valg af flere (erstatter gruppens øvrige klasser); multi: tænd/sluk */
  function listCtrl(ph, classes, opt = {}) {
    const s = el('select', 'sel sm'); s.dataset.ph = ph;
    const fill = () => {
      s.innerHTML = '';
      s.add(new Option(t(ph), ''));
      for (const c of classes) s.add(new Option(c, c));
    };
    fill();
    const p = () => (opt.variants ? twVariant : '');
    const refresh = (set) => {
      if (opt.multi) { s.value = ''; return; }
      const hit = classes.find((c) => set.has(p() + c));
      s.value = hit || '';
      s.classList.toggle('set', !!hit);
    };
    s.onchange = () => {
      const v = s.value; const set = target.classes();
      if (opt.multi) {
        const full = p() + v; if (!v) return;
        if (set.has(full)) set.delete(full); else set.add(full);
        s.value = '';
      } else {
        for (const c of classes) set.delete(p() + c);
        if (v) set.add(p() + v);
      }
      target.setClass(Array.from(set).join(' '));
      refreshCtrls();
    };
    if (opt.multi) { for (const o of Array.from(s.options)) if (o.value) o.textContent = o.value; }
    ctrls.push({ refresh, s, when: opt.when });
    return s;
  }
  /* pair: familie + nuance (Tailwind-farver) */
  function pairCtrl(phA, phB, prefix, families, shades, solids) {
    const a = el('select', 'sel sm'), b = el('select', 'sel sm narrow');
    a.title = t(phA); b.title = t(phB);
    a.add(new Option(t(phA), '')); for (const f of families) a.add(new Option(prefix + '-' + f, f)); for (const f of solids) a.add(new Option(prefix + '-' + f, f));
    b.add(new Option(phB, '')); for (const s of shades) b.add(new Option(s, s));
    const re = new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '-(?:(' + [...families, ...solids].join('|') + ')(?:-(\\d+))?)$');
    const refresh = (set) => {
      let hit = null;
      for (const c of set) { if (!c.startsWith(twVariant)) continue; const m = re.exec(c.slice(twVariant.length)); if (m) { hit = m; break; } }
      a.value = hit ? hit[1] : ''; b.value = hit && hit[2] ? hit[2] : ''; a.classList.toggle('set', !!hit);
    };
    const apply = () => {
      const set = target.classes();
      for (const c of Array.from(set)) if (c.startsWith(twVariant) && re.test(c.slice(twVariant.length))) set.delete(c);
      if (a.value) set.add(twVariant + prefix + '-' + a.value + (solids.includes(a.value) ? '' : '-' + (b.value || '500')));
      target.setClass(Array.from(set).join(' ')); refreshCtrls();
    };
    a.onchange = apply; b.onchange = apply;
    ctrls.push({ refresh, s: a });
    const w = row(a, b); return w;
  }
  /* variant-vælger (Tailwind) */
  function variantCtrl(list) {
    const s = el('select', 'sel sm variant'); for (const v of list) s.add(new Option(v ? v + '…' : t('Variant: ingen'), v));
    s.onchange = () => { twVariant = s.value; refreshCtrls(); };
    s.value = twVariant; return s;
  }
  function refreshCtrls() {
    const set = target.classes(); const tag = target.tag();
    for (const c of ctrls) {
      c.refresh(set);
      if (c.when) c.s.style.display = c.when(set, tag) ? '' : 'none';
    }
    const l = $('#fwSelLabel'); if (l) l.textContent = target.label() || t('Intet element valgt');
  }
  /* afstandspanel (margin og padding pr. side) */
  function spacingPanel(anchor, def) {
    const set = target.classes();
    const wrapEl = el('div', 'spacing');
    const mk = (kind) => {
      const box = el('div', 'sp-box ' + kind); box.append(Object.assign(el('div', 'sp-title'), { textContent: t(kind === 'margin' ? 'Margen' : 'Padding') }));
      const sides = def[kind];
      const pos = { top: 'sp-t', right: 'sp-r', bottom: 'sp-b', left: 'sp-l' };
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const s = el('select', 'sel sm ' + pos[side]); s.add(new Option('–', ''));
        for (const c of sides[side]) s.add(new Option(c, c));
        s.value = sides[side].find((c) => set.has(c)) || '';
        s.onchange = () => {
          const cur = target.classes(); for (const c of sides[side]) cur.delete(c);
          if (s.value) cur.add(s.value);
          target.setClass(Array.from(cur).join(' ')); refreshCtrls();
        };
        box.append(s);
      }
      return box;
    };
    const m = mk('margin'), p = mk('padding'); p.classList.add('inner'); m.append(p); wrapEl.append(m);
    TN.popMenu(anchor, [], { cls: 'spacingmenu' });
    const menu = document.querySelector('.popmenu.spacingmenu'); menu.append(wrapEl);
    const r = anchor.getBoundingClientRect(); menu.style.left = Math.min(innerWidth - menu.offsetWidth - 6, r.left) + 'px'; menu.style.top = Math.min(innerHeight - menu.offsetHeight - 6, r.bottom + 2) + 'px';
  }
  /* klasseeditor med forslag */
  async function classDialog(fwId) {
    if (!target.mode()) { TN.toast(t('Markér et element i visningen eller sæt markøren i koden.')); return; }
    const cat = await loadCatalog(fwId);
    const cur = Array.from(target.classes());
    const body = el('div', 'clsdlg');
    const chips = el('div', 'chips'); const inp = el('input'); inp.type = 'text'; inp.placeholder = t('Skriv en klasse og tryk Enter'); inp.spellcheck = false; inp.setAttribute('list', 'clslist');
    const dl = el('datalist'); dl.id = 'clslist'; if (cat) for (const c of cat.classes.slice(0, 4000)) dl.append(Object.assign(document.createElement('option'), { value: c }));
    let list = cur.slice();
    const draw = () => {
      chips.innerHTML = '';
      for (const c of list) { const b = el('button', 'chip'); b.textContent = c + '  ✕'; const unk = cat && !cat.set.has(c) && !/[:\[]/.test(c); if (unk) b.classList.add('unk'); b.onclick = () => { list = list.filter((x) => x !== c); draw(); }; chips.append(b); }
      if (!list.length) chips.append(Object.assign(el('span', 'muted'), { textContent: t('Ingen klasser endnu.') }));
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const v = inp.value.trim(); if (v) { for (const c of v.split(/\s+/)) if (!list.includes(c)) list.push(c); inp.value = ''; draw(); } } };
    draw();
    body.append(Object.assign(el('p', 'muted'), { textContent: t('Elementet: {0}', target.label()) }), chips, inp, dl);
    if (cat) body.append(Object.assign(el('p', 'muted small'), { textContent: t('{0} klasser kendes i {1} {2}. Ukendte klasser vises med en stiplet kant.', cat.classes.length, cat.name, cat.version) }));
    const r = await TN.modal({ title: t('Klasser'), body, buttons: [{ text: t('Annuller') }, { text: t('Anvend'), primary: true, value: () => ({ list: list.concat(inp.value.trim() ? inp.value.trim().split(/\s+/) : []) }) }] });
    if (r) { target.setClass(Array.from(new Set(r.list)).join(' ')); refreshCtrls(); }
  }
  const catCache = {};
  function loadCatalog(id) {
    if (id !== 'bootstrap' && id !== 'bulma' && id !== 'pico') return Promise.resolve(null);
    if (catCache[id]) return Promise.resolve(catCache[id]);
    return new Promise((res) => {
      const done = () => { const c = window.TN_CATALOG && window.TN_CATALOG[id]; if (!c) { res(null); return; } catCache[id] = { name: FW[id].name, version: c.version, classes: c.classes, set: new Set(c.classes) }; res(catCache[id]); };
      if (window.TN_CATALOG && window.TN_CATALOG[id]) return done();
      const s = document.createElement('script'); s.src = 'catalog/' + id + '.js'; s.onload = done; s.onerror = () => res(null); document.head.append(s);
    });
  }

  /* ======================= rækker og kolonner (dialog) ======================= */
  async function gridDialog(kind) {
    const r = await TN.ask({ title: kind === 'tailwind' ? 'Gitter' : kind === 'bulma' ? 'Kolonner' : 'Række og kolonner', fields: [
      { id: 'n', label: 'Antal kolonner', type: 'number', value: 3, min: 1, max: 12 },
      { id: 'bp', label: 'Bliver til kolonner fra', type: 'select', options: kind === 'bulma' ? [{ value: 'desktop', label: 'Skrivebord' }, { value: 'tablet', label: 'Tablet' }, { value: 'mobile', label: 'Altid' }] : [{ value: 'sm', label: 'Lille (sm)' }, { value: 'md', label: 'Mellem (md)' }, { value: 'lg', label: 'Stor (lg)' }, { value: 'xl', label: 'Ekstra stor (xl)' }], value: kind === 'bulma' ? 'tablet' : 'md' },
      { id: 'gap', label: 'Afstand mellem kolonner', type: 'select', options: ['0', '1', '2', '3', '4', '5'], value: '3' },
    ] });
    if (!r) return;
    const n = Math.max(1, Math.min(12, +r.n || 3));
    const cell = (i) => (kind === 'tailwind' ? '  <div class="p-4 bg-gray-100 rounded">Kolonne ' + i + '</div>' : kind === 'bulma' ? '  <div class="column">\n    <div class="box">Kolonne ' + i + '</div>\n  </div>' : '  <div class="' + (12 % n === 0 ? 'col-12 col-' + r.bp + '-' + 12 / n : 'col-12 col-' + r.bp) + '">\n    <div class="p-3 border bg-light">Kolonne ' + i + '</div>\n  </div>');
    const cells = Array.from({ length: n }, (_, i) => cell(i + 1)).join('\n');
    let html;
    if (kind === 'tailwind') { const g = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '6' }[r.gap]; html = '<div class="grid grid-cols-1 ' + r.bp + ':grid-cols-' + Math.min(n, 12) + ' gap-' + g + '">\n' + cells + '\n</div>'; }
    else if (kind === 'bulma') html = '<div class="columns' + (r.bp === 'mobile' ? ' is-mobile' : r.bp === 'desktop' ? ' is-desktop' : '') + ' is-variable is-' + Math.min(+r.gap + 1, 8) + '">\n' + cells + '\n</div>';
    else html = '<div class="row g-' + r.gap + '">\n' + cells + '\n</div>';
    TN.insert(html);
  }

  /* ======================= brudpunkter ======================= */
  const bpGroup = (list) => grp('Brudpunkter', col(row(...list.slice(0, 3).map(([n, w]) => smallBtn(n + ' ' + w, () => TN.setWidth(w), t('Sæt visningens bredde til {0} px', w)))), row(...list.slice(3).map(([n, w]) => smallBtn(n + ' ' + w, () => TN.setWidth(w), t('Sæt visningens bredde til {0} px', w))))));

  /* ======================= CDN-adresser ======================= */
  const V = { bootstrap: '5.3.9', bulma: '1.0.4', pico: '2.1.1', tailwind: '4.3.5' };
  const CDN = {
    bootstrapCss: 'https://cdn.jsdelivr.net/npm/bootstrap@' + V.bootstrap + '/dist/css/bootstrap.min.css',
    bootstrapJs: 'https://cdn.jsdelivr.net/npm/bootstrap@' + V.bootstrap + '/dist/js/bootstrap.bundle.min.js',
    bulmaCss: 'https://cdn.jsdelivr.net/npm/bulma@' + V.bulma + '/css/bulma.min.css',
    picoCss: (v) => 'https://cdn.jsdelivr.net/npm/@picocss/pico@' + V.pico + '/css/pico' + (v ? '.' + v : '') + '.min.css',
    tailwindJs: 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@' + V.tailwind,
  };
  const PICO_COLORS = ['azure', 'amber', 'blue', 'cyan', 'fuchsia', 'green', 'grey', 'indigo', 'jade', 'lime', 'orange', 'pink', 'pumpkin', 'purple', 'red', 'sand', 'slate', 'violet', 'yellow', 'zinc'];

  /* scripts der må køre i tilstanden "Kun kendte scripts" */
  const KNOWN = [
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@[\d.]+\/dist\/js\/bootstrap(?:\.bundle)?(?:\.min)?\.js$/,
    /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?:twitter-bootstrap|bootstrap)\/[\d.]+\/js\/bootstrap(?:\.bundle)?(?:\.min)?\.js$/,
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@popperjs\/core@[\d.]+\/dist\/umd\/popper(?:\.min)?\.js$/,
    /^https:\/\/cdn\.tailwindcss\.com(?:\/[\d.]+)?$/,
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@[\d.]+(?:\/dist\/index\.global\.js)?$/,
    /^https:\/\/code\.jquery\.com\/jquery-[\d.]+(?:\.slim)?(?:\.min)?\.js$/,
    /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jquery\/[\d.]+\/jquery(?:\.slim)?(?:\.min)?\.js$/,
  ];
  function knownScripts(html) {
    const out = [];
    for (const m of html.matchAll(/<script\b[^>]*\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) {
      const u = (m[1] || m[2] || '').trim();
      if (KNOWN.some((r) => r.test(u)) && !out.includes(u)) out.push(u);
    }
    return out;
  }

  /* ======================= framework: Bootstrap ======================= */
  const BC = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
  const bsSide = (p, s) => ({ top: pre(p + 't-', ['0', '1', '2', '3', '4', '5', ...(p === 'm' ? ['auto'] : [])]), right: pre(p + 'e-', ['0', '1', '2', '3', '4', '5', ...(p === 'm' ? ['auto'] : [])]), bottom: pre(p + 'b-', ['0', '1', '2', '3', '4', '5', ...(p === 'm' ? ['auto'] : [])]), left: pre(p + 's-', ['0', '1', '2', '3', '4', '5', ...(p === 'm' ? ['auto'] : [])]) });
  const bsSnip = {
    layout: [
      ['Container', '<div class="container">\n  \n</div>'],
      ['Fuld bredde (container-fluid)', '<div class="container-fluid">\n  \n</div>'],
      ['Kort (card)', '<div class="card" style="width: 18rem;">\n  <img src="billede.jpg" class="card-img-top" alt="Beskrivelse">\n  <div class="card-body">\n    <h5 class="card-title">Korttitel</h5>\n    <p class="card-text">Kort tekst om indholdet.</p>\n    <a href="#" class="btn btn-primary">Læs mere</a>\n  </div>\n</div>'],
      ['Hero-sektion', '<div class="px-4 py-5 my-5 text-center">\n  <h1 class="display-5 fw-bold text-body-emphasis">Stor overskrift</h1>\n  <div class="col-lg-6 mx-auto">\n    <p class="lead mb-4">Kort og klar tekst, der forklarer, hvad siden handler om.</p>\n    <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">\n      <button type="button" class="btn btn-primary btn-lg px-4 gap-3">Kom i gang</button>\n      <button type="button" class="btn btn-outline-secondary btn-lg px-4">Læs mere</button>\n    </div>\n  </div>\n</div>'],
      ['Accordion', '<div class="accordion" id="accordionEksempel">\n  <div class="accordion-item">\n    <h2 class="accordion-header">\n      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#punkt1" aria-expanded="true" aria-controls="punkt1">Punkt 1</button>\n    </h2>\n    <div id="punkt1" class="accordion-collapse collapse show" data-bs-parent="#accordionEksempel">\n      <div class="accordion-body">Indhold til punkt 1.</div>\n    </div>\n  </div>\n  <div class="accordion-item">\n    <h2 class="accordion-header">\n      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#punkt2" aria-expanded="false" aria-controls="punkt2">Punkt 2</button>\n    </h2>\n    <div id="punkt2" class="accordion-collapse collapse" data-bs-parent="#accordionEksempel">\n      <div class="accordion-body">Indhold til punkt 2.</div>\n    </div>\n  </div>\n</div>'],
      ['Liste (list-group)', '<ul class="list-group">\n  <li class="list-group-item active" aria-current="true">Første punkt</li>\n  <li class="list-group-item">Andet punkt</li>\n  <li class="list-group-item">Tredje punkt</li>\n</ul>'],
      ['Tabel', '<table class="table table-striped table-hover">\n  <thead>\n    <tr><th scope="col">#</th><th scope="col">Navn</th><th scope="col">Værdi</th></tr>\n  </thead>\n  <tbody>\n    <tr><th scope="row">1</th><td>Alfa</td><td>10</td></tr>\n    <tr><th scope="row">2</th><td>Beta</td><td>20</td></tr>\n  </tbody>\n</table>'],
    ],
    nav: [
      ['Navbar', '<nav class="navbar navbar-expand-lg bg-body-tertiary">\n  <div class="container-fluid">\n    <a class="navbar-brand" href="#">Navn</a>\n    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#hovedmenu" aria-controls="hovedmenu" aria-expanded="false" aria-label="Vis menu">\n      <span class="navbar-toggler-icon"></span>\n    </button>\n    <div class="collapse navbar-collapse" id="hovedmenu">\n      <ul class="navbar-nav me-auto mb-2 mb-lg-0">\n        <li class="nav-item"><a class="nav-link active" href="#">Forside</a></li>\n        <li class="nav-item"><a class="nav-link" href="#">Om os</a></li>\n        <li class="nav-item"><a class="nav-link" href="#">Kontakt</a></li>\n      </ul>\n    </div>\n  </div>\n</nav>'],
      ['Faner (tabs)', '<ul class="nav nav-tabs" id="faner" role="tablist">\n  <li class="nav-item" role="presentation"><button class="nav-link active" id="fane1-tab" data-bs-toggle="tab" data-bs-target="#fane1" type="button" role="tab" aria-controls="fane1" aria-selected="true">Fane 1</button></li>\n  <li class="nav-item" role="presentation"><button class="nav-link" id="fane2-tab" data-bs-toggle="tab" data-bs-target="#fane2" type="button" role="tab" aria-controls="fane2" aria-selected="false">Fane 2</button></li>\n</ul>\n<div class="tab-content" id="fanerIndhold">\n  <div class="tab-pane fade show active" id="fane1" role="tabpanel" aria-labelledby="fane1-tab" tabindex="0">Indhold 1</div>\n  <div class="tab-pane fade" id="fane2" role="tabpanel" aria-labelledby="fane2-tab" tabindex="0">Indhold 2</div>\n</div>'],
      ['Brødkrumme', '<nav aria-label="breadcrumb">\n  <ol class="breadcrumb">\n    <li class="breadcrumb-item"><a href="#">Forside</a></li>\n    <li class="breadcrumb-item"><a href="#">Bibliotek</a></li>\n    <li class="breadcrumb-item active" aria-current="page">Data</li>\n  </ol>\n</nav>'],
      ['Paginering', '<nav aria-label="Sider">\n  <ul class="pagination">\n    <li class="page-item disabled"><a class="page-link" href="#">Forrige</a></li>\n    <li class="page-item active"><a class="page-link" href="#">1</a></li>\n    <li class="page-item"><a class="page-link" href="#">2</a></li>\n    <li class="page-item"><a class="page-link" href="#">Næste</a></li>\n  </ul>\n</nav>'],
    ],
    content: [
      ['Knap', '<button type="button" class="btn btn-primary">Knap</button>'],
      ['Knapgruppe', '<div class="btn-group" role="group" aria-label="Valg">\n  <button type="button" class="btn btn-primary">Venstre</button>\n  <button type="button" class="btn btn-primary">Midt</button>\n  <button type="button" class="btn btn-primary">Højre</button>\n</div>'],
      ['Besked (alert)', '<div class="alert alert-primary" role="alert">\n  En vigtig besked.\n</div>'],
      ['Badge', '<span class="badge text-bg-primary">Ny</span>'],
      ['Fremdriftsbjælke', '<div class="progress" role="progressbar" aria-label="Fremdrift" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">\n  <div class="progress-bar" style="width: 60%">60 %</div>\n</div>'],
      ['Spinner', '<div class="spinner-border" role="status">\n  <span class="visually-hidden">Indlæser…</span>\n</div>'],
      ['Karrusel', '<div id="karrusel" class="carousel slide" data-bs-ride="carousel">\n  <div class="carousel-inner">\n    <div class="carousel-item active"><img src="billede1.jpg" class="d-block w-100" alt="Billede 1"></div>\n    <div class="carousel-item"><img src="billede2.jpg" class="d-block w-100" alt="Billede 2"></div>\n  </div>\n  <button class="carousel-control-prev" type="button" data-bs-target="#karrusel" data-bs-slide="prev"><span class="carousel-control-prev-icon" aria-hidden="true"></span><span class="visually-hidden">Forrige</span></button>\n  <button class="carousel-control-next" type="button" data-bs-target="#karrusel" data-bs-slide="next"><span class="carousel-control-next-icon" aria-hidden="true"></span><span class="visually-hidden">Næste</span></button>\n</div>'],
    ],
    overlay: [
      ['Modal (dialog)', '<button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#minModal">Åbn dialog</button>\n\n<div class="modal fade" id="minModal" tabindex="-1" aria-labelledby="minModalLabel" aria-hidden="true">\n  <div class="modal-dialog">\n    <div class="modal-content">\n      <div class="modal-header">\n        <h1 class="modal-title fs-5" id="minModalLabel">Titel</h1>\n        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Luk"></button>\n      </div>\n      <div class="modal-body">Indhold.</div>\n      <div class="modal-footer">\n        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Luk</button>\n        <button type="button" class="btn btn-primary">Gem</button>\n      </div>\n    </div>\n  </div>\n</div>'],
      ['Dropdown', '<div class="dropdown">\n  <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Menu</button>\n  <ul class="dropdown-menu">\n    <li><a class="dropdown-item" href="#">Handling</a></li>\n    <li><a class="dropdown-item" href="#">Anden handling</a></li>\n  </ul>\n</div>'],
      ['Offcanvas (sidepanel)', '<button class="btn btn-primary" type="button" data-bs-toggle="offcanvas" data-bs-target="#sidepanel" aria-controls="sidepanel">Åbn panel</button>\n<div class="offcanvas offcanvas-start" tabindex="-1" id="sidepanel" aria-labelledby="sidepanelLabel">\n  <div class="offcanvas-header">\n    <h5 class="offcanvas-title" id="sidepanelLabel">Panel</h5>\n    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Luk"></button>\n  </div>\n  <div class="offcanvas-body">Indhold.</div>\n</div>'],
      ['Tooltip', '<button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-title="Hjælpetekst">Hold musen over</button>'],
    ],
    form: [
      ['Formular', '<form>\n  <div class="mb-3">\n    <label for="mail" class="form-label">E-mail</label>\n    <input type="email" class="form-control" id="mail" aria-describedby="mailHjaelp">\n    <div id="mailHjaelp" class="form-text">Vi deler aldrig din adresse.</div>\n  </div>\n  <div class="mb-3 form-check">\n    <input type="checkbox" class="form-check-input" id="husk">\n    <label class="form-check-label" for="husk">Husk mig</label>\n  </div>\n  <button type="submit" class="btn btn-primary">Send</button>\n</form>'],
      ['Tekstfelt med label', '<div class="mb-3">\n  <label for="felt" class="form-label">Tekst</label>\n  <input type="text" class="form-control" id="felt">\n</div>'],
      ['Valgliste', '<select class="form-select" aria-label="Vælg">\n  <option selected>Vælg…</option>\n  <option value="1">Et</option>\n  <option value="2">To</option>\n</select>'],
      ['Kontakt (switch)', '<div class="form-check form-switch">\n  <input class="form-check-input" type="checkbox" role="switch" id="kontakt">\n  <label class="form-check-label" for="kontakt">Aktiv</label>\n</div>'],
    ],
  };
  const bsGroups = () => {
    const c = BC;
    return {
      textColor: pre('text-', [...c, 'white', 'black', 'body', 'body-secondary', 'body-emphasis', 'muted']),
      bg: [...pre('bg-', [...c, 'white', 'body', 'body-secondary', 'body-tertiary', 'transparent']), ...pre('text-bg-', c)],
      btn: [...pre('btn-', c), ...pre('btn-outline-', c), 'btn-link'],
      btnSize: ['btn-sm', 'btn-lg'],
      align: ['text-start', 'text-center', 'text-end'],
      weight: ['fw-light', 'fw-normal', 'fw-medium', 'fw-semibold', 'fw-bold', 'fw-bolder'],
      size: [...pre('fs-', rng(1, 6)), ...pre('display-', rng(1, 6)), 'lead', 'small'],
      display: ['d-none', 'd-block', 'd-inline', 'd-inline-block', 'd-flex', 'd-inline-flex', 'd-grid', 'd-sm-none', 'd-md-none', 'd-lg-none', 'd-md-block', 'd-lg-block', 'd-md-flex'],
      flex: ['flex-row', 'flex-column', 'flex-row-reverse', 'flex-column-reverse', 'flex-wrap', 'flex-nowrap'],
      justify: pre('justify-content-', ['start', 'center', 'end', 'between', 'around', 'evenly']),
      items: pre('align-items-', ['start', 'center', 'end', 'baseline', 'stretch']),
      gap: pre('gap-', rng(0, 5)),
      border: ['border', 'border-0', 'border-top', 'border-end', 'border-bottom', 'border-start', ...pre('border-', rng(1, 5)), ...pre('border-', c)],
      rounded: ['rounded-0', 'rounded-1', 'rounded-2', 'rounded', 'rounded-3', 'rounded-4', 'rounded-5', 'rounded-pill', 'rounded-circle'],
      shadow: ['shadow-none', 'shadow-sm', 'shadow', 'shadow-lg'],
      width: ['w-25', 'w-50', 'w-75', 'w-100', 'w-auto', 'mw-100'],
      height: ['h-25', 'h-50', 'h-75', 'h-100', 'h-auto', 'min-vh-100'],
      container: ['container', 'container-fluid', 'container-sm', 'container-md', 'container-lg', 'container-xl', 'container-xxl'],
      col: ['col', 'col-auto', ...pre('col-', rng(1, 12))],
      colMd: pre('col-md-', rng(1, 12)),
      colLg: pre('col-lg-', rng(1, 12)),
    };
  };

  /* ======================= framework: Tailwind ======================= */
  const TW_SCALE = ['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'];
  const TW_FAM = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone'];
  const TW_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  const TW_VARIANTS = ['', 'sm:', 'md:', 'lg:', 'xl:', '2xl:', 'hover:', 'focus:', 'active:', 'dark:', 'md:hover:', 'lg:hover:', 'dark:hover:'];
  const twSpace = (p, extra = []) => ({ top: pre(p + 't-', [...TW_SCALE, ...extra]), right: pre(p + 'r-', [...TW_SCALE, ...extra]), bottom: pre(p + 'b-', [...TW_SCALE, ...extra]), left: pre(p + 'l-', [...TW_SCALE, ...extra]) });
  const twSnip = [
    ['Hero', '<section class="bg-white">\n  <div class="mx-auto max-w-5xl px-6 py-24 text-center">\n    <h1 class="text-5xl font-bold tracking-tight text-gray-900">Stor overskrift</h1>\n    <p class="mt-6 text-lg text-gray-600">Kort og klar tekst, der forklarer, hvad siden handler om.</p>\n    <div class="mt-10 flex items-center justify-center gap-4">\n      <a href="#" class="rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">Kom i gang</a>\n      <a href="#" class="text-sm font-semibold text-gray-900">Læs mere →</a>\n    </div>\n  </div>\n</section>'],
    ['Kort', '<div class="max-w-sm overflow-hidden rounded-xl bg-white shadow-md">\n  <img class="h-48 w-full object-cover" src="billede.jpg" alt="Beskrivelse">\n  <div class="p-6">\n    <h3 class="text-xl font-semibold text-gray-900">Korttitel</h3>\n    <p class="mt-2 text-gray-600">Kort tekst om indholdet.</p>\n    <a href="#" class="mt-4 inline-block text-indigo-600 hover:underline">Læs mere</a>\n  </div>\n</div>'],
    ['Knap', '<button type="button" class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600">Knap</button>'],
    ['Menu (navbar)', '<nav class="flex items-center justify-between bg-white px-6 py-4 shadow">\n  <a href="#" class="text-xl font-bold text-gray-900">Navn</a>\n  <ul class="flex gap-6 text-sm font-medium text-gray-700">\n    <li><a href="#" class="hover:text-indigo-600">Forside</a></li>\n    <li><a href="#" class="hover:text-indigo-600">Om os</a></li>\n    <li><a href="#" class="hover:text-indigo-600">Kontakt</a></li>\n  </ul>\n</nav>'],
    ['Besked', '<div class="rounded-md border-l-4 border-blue-500 bg-blue-50 p-4 text-blue-800">En vigtig besked.</div>'],
    ['Formularfelt', '<div>\n  <label for="mail" class="block text-sm font-medium text-gray-900">E-mail</label>\n  <input type="email" id="mail" class="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none">\n</div>'],
    ['Prisliste', '<div class="grid gap-6 md:grid-cols-3">\n  <div class="rounded-xl border border-gray-200 p-6">\n    <h3 class="text-lg font-semibold">Basis</h3>\n    <p class="mt-4 text-4xl font-bold">0 kr.</p>\n    <ul class="mt-6 space-y-2 text-gray-600"><li>Funktion A</li><li>Funktion B</li></ul>\n  </div>\n  <div class="rounded-xl border-2 border-indigo-600 p-6">\n    <h3 class="text-lg font-semibold">Pro</h3>\n    <p class="mt-4 text-4xl font-bold">99 kr.</p>\n    <ul class="mt-6 space-y-2 text-gray-600"><li>Alt i Basis</li><li>Funktion C</li></ul>\n  </div>\n  <div class="rounded-xl border border-gray-200 p-6">\n    <h3 class="text-lg font-semibold">Team</h3>\n    <p class="mt-4 text-4xl font-bold">299 kr.</p>\n    <ul class="mt-6 space-y-2 text-gray-600"><li>Alt i Pro</li><li>Funktion D</li></ul>\n  </div>\n</div>'],
  ];

  /* ======================= framework: Bulma ======================= */
  const BU = ['primary', 'link', 'info', 'success', 'warning', 'danger', 'dark', 'light', 'white', 'black', 'text'];
  const buSpace = (p) => ({ top: pre(p + 't-', ['0', '1', '2', '3', '4', '5', '6', 'auto']), right: pre(p + 'r-', ['0', '1', '2', '3', '4', '5', '6', 'auto']), bottom: pre(p + 'b-', ['0', '1', '2', '3', '4', '5', '6', 'auto']), left: pre(p + 'l-', ['0', '1', '2', '3', '4', '5', '6', 'auto']) });
  const buSnip = {
    el: [
      ['Knap', '<button class="button is-primary">Knap</button>'],
      ['Boks (box)', '<div class="box">\n  Indhold i en boks.\n</div>'],
      ['Meddelelse (notification)', '<div class="notification is-info">\n  <button class="delete"></button>\n  En vigtig besked.\n</div>'],
      ['Tag', '<span class="tag is-primary is-light">Mærkat</span>'],
      ['Titel og undertitel', '<h1 class="title">Titel</h1>\n<h2 class="subtitle">Undertitel</h2>'],
      ['Fremdriftsbjælke', '<progress class="progress is-primary" value="60" max="100">60%</progress>'],
      ['Tabel', '<table class="table is-striped is-hoverable is-fullwidth">\n  <thead>\n    <tr><th>#</th><th>Navn</th><th>Værdi</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>1</td><td>Alfa</td><td>10</td></tr>\n    <tr><td>2</td><td>Beta</td><td>20</td></tr>\n  </tbody>\n</table>'],
      ['Billede', '<figure class="image is-4by3">\n  <img src="billede.jpg" alt="Beskrivelse">\n</figure>'],
    ],
    comp: [
      ['Navbar', '<nav class="navbar" role="navigation" aria-label="main navigation">\n  <div class="navbar-brand">\n    <a class="navbar-item" href="#"><strong>Navn</strong></a>\n    <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false" data-target="hovedmenu">\n      <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>\n    </a>\n  </div>\n  <div id="hovedmenu" class="navbar-menu">\n    <div class="navbar-start">\n      <a class="navbar-item" href="#">Forside</a>\n      <a class="navbar-item" href="#">Om os</a>\n      <a class="navbar-item" href="#">Kontakt</a>\n    </div>\n  </div>\n</nav>'],
      ['Kort (card)', '<div class="card">\n  <div class="card-image">\n    <figure class="image is-4by3"><img src="billede.jpg" alt="Beskrivelse"></figure>\n  </div>\n  <div class="card-content">\n    <p class="title is-4">Korttitel</p>\n    <div class="content">Kort tekst om indholdet.</div>\n  </div>\n  <footer class="card-footer">\n    <a href="#" class="card-footer-item">Læs mere</a>\n  </footer>\n</div>'],
      ['Modal', '<div class="modal is-active">\n  <div class="modal-background"></div>\n  <div class="modal-card">\n    <header class="modal-card-head">\n      <p class="modal-card-title">Titel</p>\n      <button class="delete" aria-label="close"></button>\n    </header>\n    <section class="modal-card-body">Indhold.</section>\n    <footer class="modal-card-foot">\n      <div class="buttons">\n        <button class="button is-success">Gem</button>\n        <button class="button">Annuller</button>\n      </div>\n    </footer>\n  </div>\n</div>'],
      ['Dropdown', '<div class="dropdown is-hoverable">\n  <div class="dropdown-trigger">\n    <button class="button" aria-haspopup="true" aria-controls="dropdown-menu"><span>Menu</span></button>\n  </div>\n  <div class="dropdown-menu" id="dropdown-menu" role="menu">\n    <div class="dropdown-content">\n      <a href="#" class="dropdown-item">Handling</a>\n      <a href="#" class="dropdown-item">Anden handling</a>\n    </div>\n  </div>\n</div>'],
      ['Besked (message)', '<article class="message is-info">\n  <div class="message-header"><p>Information</p></div>\n  <div class="message-body">Tekst i beskeden.</div>\n</article>'],
      ['Faner (tabs)', '<div class="tabs is-boxed">\n  <ul>\n    <li class="is-active"><a>Fane 1</a></li>\n    <li><a>Fane 2</a></li>\n    <li><a>Fane 3</a></li>\n  </ul>\n</div>'],
      ['Brødkrumme', '<nav class="breadcrumb" aria-label="breadcrumbs">\n  <ul>\n    <li><a href="#">Forside</a></li>\n    <li><a href="#">Bibliotek</a></li>\n    <li class="is-active"><a href="#" aria-current="page">Data</a></li>\n  </ul>\n</nav>'],
      ['Paginering', '<nav class="pagination" role="navigation" aria-label="pagination">\n  <a class="pagination-previous">Forrige</a>\n  <a class="pagination-next">Næste</a>\n  <ul class="pagination-list">\n    <li><a class="pagination-link is-current" aria-current="page">1</a></li>\n    <li><a class="pagination-link">2</a></li>\n    <li><a class="pagination-link">3</a></li>\n  </ul>\n</nav>'],
    ],
    layout: [
      ['Section og container', '<section class="section">\n  <div class="container">\n    \n  </div>\n</section>'],
      ['Hero', '<section class="hero is-primary is-medium">\n  <div class="hero-body">\n    <p class="title">Stor overskrift</p>\n    <p class="subtitle">Kort og klar tekst.</p>\n  </div>\n</section>'],
      ['Fixed grid', '<div class="fixed-grid has-3-cols">\n  <div class="grid">\n    <div class="cell">Celle 1</div>\n    <div class="cell">Celle 2</div>\n    <div class="cell">Celle 3</div>\n  </div>\n</div>'],
      ['Footer', '<footer class="footer">\n  <div class="content has-text-centered">\n    <p>&copy; 2026</p>\n  </div>\n</footer>'],
      ['Level', '<nav class="level">\n  <div class="level-left"><div class="level-item"><p>Venstre</p></div></div>\n  <div class="level-right"><div class="level-item"><p>Højre</p></div></div>\n</nav>'],
    ],
    form: [
      ['Tekstfelt', '<div class="field">\n  <label class="label" for="felt">Navn</label>\n  <div class="control">\n    <input class="input" id="felt" type="text" placeholder="Skriv her">\n  </div>\n</div>'],
      ['Valgliste', '<div class="field">\n  <div class="control">\n    <div class="select">\n      <select aria-label="Vælg"><option>Valg A</option><option>Valg B</option></select>\n    </div>\n  </div>\n</div>'],
      ['Tekstområde', '<div class="field">\n  <label class="label" for="besked">Besked</label>\n  <div class="control"><textarea class="textarea" id="besked"></textarea></div>\n</div>'],
      ['Afkrydsning', '<div class="field">\n  <label class="checkbox"><input type="checkbox"> Jeg accepterer</label>\n</div>'],
      ['Send og annuller', '<div class="field is-grouped">\n  <div class="control"><button class="button is-link">Send</button></div>\n  <div class="control"><button class="button is-link is-light">Annuller</button></div>\n</div>'],
    ],
  };

  /* ======================= framework: Pico ======================= */
  const picoSnip = [
    ['Beholder (main)', '<main class="container">\n  \n</main>'],
    ['Kort (article)', '<article>\n  <header>Overskrift</header>\n  Indhold i kortet.\n  <footer>Bund</footer>\n</article>'],
    ['Accordion (details)', '<details>\n  <summary>Overskrift</summary>\n  <p>Skjult tekst.</p>\n</details>'],
    ['Navigation', '<nav>\n  <ul>\n    <li><strong>Navn</strong></li>\n  </ul>\n  <ul>\n    <li><a href="#">Forside</a></li>\n    <li><a href="#">Om os</a></li>\n    <li><a href="#" role="button">Kontakt</a></li>\n  </ul>\n</nav>'],
    ['Dialog (modal)', '<dialog open>\n  <article>\n    <header>\n      <button aria-label="Luk" rel="prev"></button>\n      <p><strong>Titel</strong></p>\n    </header>\n    <p>Indhold.</p>\n    <footer>\n      <button class="secondary">Annuller</button>\n      <button>Bekræft</button>\n    </footer>\n  </article>\n</dialog>'],
    ['Dropdown', '<details class="dropdown">\n  <summary>Vælg</summary>\n  <ul>\n    <li><a href="#">Valg A</a></li>\n    <li><a href="#">Valg B</a></li>\n  </ul>\n</details>'],
    ['Grid', '<div class="grid">\n  <div>Kolonne 1</div>\n  <div>Kolonne 2</div>\n  <div>Kolonne 3</div>\n</div>'],
    ['Formular', '<form>\n  <label>\n    Navn\n    <input type="text" name="navn" placeholder="Navn">\n  </label>\n  <label>\n    <input type="checkbox" role="switch" name="aktiv" checked>\n    Aktiv\n  </label>\n  <button type="submit">Send</button>\n</form>'],
    ['Fremdrift', '<progress value="60" max="100"></progress>'],
    ['Indlæser', '<article aria-busy="true">Indlæser…</article>'],
  ];

  /* ======================= definitioner ======================= */
  const FW = {};
  FW.bootstrap = {
    id: 'bootstrap', name: 'Bootstrap', color: '#7952b3', bp: [['sm', 576], ['md', 768], ['lg', 992], ['xl', 1200], ['xxl', 1400]],
    detect: (doc, text) => {
      let s = 0;
      if (/bootstrap(?:\.min)?\.css|bootstrap@|\/bootstrap\//i.test(text.match(/<link[^>]+>/gi)?.join('') || '')) s += 10;
      if (/bootstrap(?:\.bundle)?(?:\.min)?\.js|bootstrap@[\d.]+\/dist\/js/i.test(text)) s += 4;
      const sig = /^(btn(-(primary|secondary|success|danger|warning|info|light|dark|outline-\w+))?|col(-(sm|md|lg|xl|xxl))?(-\d+)?|row|navbar(-\w+)?|card(-\w+)?|d-(flex|none|block|grid|inline)|[mp][tbxyse]?-\d|justify-content-\w+|text-(center|start|end)|container(-fluid)?|form-(control|label|select)|alert(-\w+)?|badge)$/;
      const seen = new Set();
      doc.querySelectorAll('[class]').forEach((e) => e.classList.forEach((c) => { if (sig.test(c)) seen.add(c); }));
      s += Math.min(seen.size, 8);
      return s;
    },
    version: (text) => (/bootstrap@(\d+\.\d+\.\d+)/i.exec(text) || /bootstrap\/(\d+\.\d+\.\d+)/i.exec(text) || [])[1] || '',
    build(P) {
      const G = bsGroups();
      P.build.append(
        grp('Komponenter',
          menuBtn('layout', 'Layout', () => snipItems(bsSnip.layout), 'Container, kort, accordion, liste og tabel'),
          menuBtn('nav', 'Navigation', () => snipItems(bsSnip.nav), 'Navbar, faner, brødkrumme og paginering'),
          menuBtn('card', 'Indhold', () => snipItems(bsSnip.content), 'Knapper, beskeder, badges, fremdrift og karrusel'),
          menuBtn('window', 'Overlay', () => snipItems(bsSnip.overlay), 'Modal, dropdown, sidepanel og tooltip'),
          menuBtn('form', 'Formular', () => snipItems(bsSnip.form), 'Formularer og felter')),
        grp('Gitter', big('grid', 'Række og kolonner…', () => gridDialog('bootstrap'), 'Lav en række med kolonner, der skifter layout efter skærmbredde')),
        bpGroup(this.bp),
        grp('Opsætning',
          col(row(Object.assign(el('span', 'muted'), { id: 'fwVer', textContent: '' })),
            row(smallBtn(t('Tilføj JavaScript'), () => addScript(CDN.bootstrapJs), t('Modaler, dropdowns og faner kræver Bootstrap JavaScript'))),
            row(modeSelect()))));
      function modeSelect() {
        const s = el('select', 'sel sm'); for (const [v, l] of [['', 'Farvetilstand'], ['light', 'Lys'], ['dark', 'Mørk'], ['auto', 'Auto']]) s.add(new Option(t(l), v));
        s.onchange = () => TN.htmlAttr('data-bs-theme', s.value === 'auto' ? '' : s.value); return s;
      }
      styleCommon(P, this, [
        grp('Farve', col(listCtrl('Tekstfarve', G.textColor), listCtrl('Baggrund', G.bg), listCtrl('Knap', G.btn, { when: (s, tag) => s.has('btn') || tag === 'button' }))),
        grp('Tekst', col(listCtrl('Justering', G.align), listCtrl('Vægt', G.weight), listCtrl('Størrelse', G.size))),
        grp('Afstand', big('spacing', 'Afstand…', (b) => spacingPanel(b, { margin: bsSide('m'), padding: bsSide('p') }), 'Margen og padding for hver side')),
        grp('Layout', col(listCtrl('Visning', G.display), listCtrl('Flex', G.flex), listCtrl('Justér', [...G.justify, ...G.items]))),
        grp('Kant', col(listCtrl('Kant', G.border, { multi: true }), listCtrl('Afrunding', G.rounded), listCtrl('Skygge', G.shadow))),
        grp('Størrelse', col(listCtrl('Bredde', G.width), listCtrl('Højde', G.height), listCtrl('Beholder', G.container))),
        grp('Gitter', col(listCtrl('Kolonne', G.col), listCtrl('Fra md', G.colMd), listCtrl('Fra lg', G.colLg))),
      ]);
    },
    css: CDN.bootstrapCss, js: CDN.bootstrapJs,
  };

  FW.tailwind = {
    id: 'tailwind', name: 'Tailwind', color: '#0ea5b7', bp: [['sm', 640], ['md', 768], ['lg', 1024], ['xl', 1280], ['2xl', 1536]],
    detect: (doc, text) => {
      let s = 0;
      if (/cdn\.tailwindcss\.com|@tailwindcss\/browser|tailwind(?:css)?(?:\.min)?\.css|type\s*=\s*["']text\/tailwindcss["']/i.test(text)) s += 12;
      const sig = /^((sm|md|lg|xl|2xl|hover|focus|dark):.+|p[xytblr]?-\d+(\.\d+)?|m[xytblr]?-\d+(\.\d+)?|text-(xs|sm|base|lg|xl|\dxl)|bg-[a-z]+-\d{2,3}|text-[a-z]+-\d{2,3}|rounded(-\w+)?|shadow(-\w+)?|flex|grid|grid-cols-\d+|items-\w+|justify-\w+|gap-\d+|w-(full|screen|\d+)|h-(full|screen|\d+)|font-(bold|semibold|medium)|space-[xy]-\d+|max-w-\w+)$/;
      const seen = new Set();
      doc.querySelectorAll('[class]').forEach((e) => e.classList.forEach((c) => { if (sig.test(c)) seen.add(c); }));
      if (seen.size >= 5) s += seen.size;
      return s;
    },
    version: (text) => (/tailwindcss\/browser@(\d+\.\d+\.\d+)/i.exec(text) || /cdn\.tailwindcss\.com\/(\d+\.\d+\.\d+)/i.exec(text) || [])[1] || '',
    build(P) {
      P.build.append(
        grp('Mønstre', menuBtn('layout', 'Mønstre', () => snipItems(twSnip), 'Færdige blokke bygget af Tailwind-klasser')),
        grp('Gitter', big('grid', 'Gitter…', () => gridDialog('tailwind'), 'grid med kolonner, der skifter efter skærmbredde')),
        bpGroup(this.bp),
        grp('Tema', col(row(smallBtn(t('Ny farve…'), () => themeToken('color'), t('Tilføj en farve til @theme, fx --color-brand'))), row(smallBtn(t('Ny skrifttype…'), () => themeToken('font'), t('Tilføj en skrifttype til @theme'))), row(smallBtn(t('Mørk tilstand med klasse'), darkClass, t('Slå dark: til via klassen .dark på <html> i stedet for systemets indstilling'))))),
        grp('Opsætning', col(row(Object.assign(el('span', 'muted'), { id: 'fwVer', textContent: '' })), row(Object.assign(el('span', 'muted small'), { textContent: t('Kører via browser-scriptet. Slå JavaScript til eller Kendte i Visning.') })))));
      const fam = TW_FAM; const sh = TW_SHADES;
      const G = {
        size: pre('text-', ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']),
        weight: pre('font-', ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']),
        align: ['text-left', 'text-center', 'text-right', 'text-justify'],
        display: ['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'hidden', 'contents'],
        flex: ['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse', 'flex-wrap', 'flex-nowrap'],
        justify: pre('justify-', ['start', 'center', 'end', 'between', 'around', 'evenly']),
        items: pre('items-', ['start', 'center', 'end', 'baseline', 'stretch']),
        gap: pre('gap-', TW_SCALE), cols: pre('grid-cols-', rng(1, 12)),
        w: [...pre('w-', TW_SCALE), 'w-full', 'w-screen', 'w-auto', 'w-1/2', 'w-1/3', 'w-2/3', 'w-1/4', 'w-3/4', 'w-fit', 'w-min', 'w-max'],
        h: [...pre('h-', TW_SCALE), 'h-full', 'h-screen', 'h-auto', 'h-fit', 'min-h-screen'],
        maxw: pre('max-w-', ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen-lg', 'prose']),
        rounded: pre('rounded-', ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full']),
        shadow: pre('shadow-', ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner']),
        border: ['border', 'border-0', 'border-2', 'border-4', 'border-8', 'border-t', 'border-b', 'border-l', 'border-r', 'border-dashed', 'border-solid'],
        opacity: pre('opacity-', ['0', '5', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '90', '95', '100']),
        transform: ['uppercase', 'lowercase', 'capitalize', 'normal-case', 'italic', 'not-italic', 'underline', 'no-underline', 'truncate'],
      };
      styleCommon(P, this, [
        grp('Variant', col(variantCtrl(TW_VARIANTS), Object.assign(el('span', 'muted small tw-note'), { textContent: t('Gælder valg i denne fane') }))),
        grp('Farve', col(pairCtrl('Tekstfarve', 'Nuance', 'text', fam, sh, ['black', 'white', 'transparent']), pairCtrl('Baggrund', 'Nuance', 'bg', fam, sh, ['black', 'white', 'transparent']), pairCtrl('Kantfarve', 'Nuance', 'border', fam, sh, ['black', 'white', 'transparent']))),
        grp('Tekst', col(listCtrl('Størrelse', G.size, { variants: true }), listCtrl('Vægt', G.weight, { variants: true }), listCtrl('Justering', G.align, { variants: true }))),
        grp('Afstand', big('spacing', 'Afstand…', (b) => spacingPanel(b, { margin: twSpace('m', ['auto']), padding: twSpace('p') }), 'Margen og padding for hver side')),
        grp('Layout', col(listCtrl('Visning', G.display, { variants: true }), listCtrl('Flex', G.flex, { variants: true }), listCtrl('Justér', [...G.justify, ...G.items], { variants: true }))),
        grp('Gitter', col(listCtrl('Kolonner', G.cols, { variants: true }), listCtrl('Afstand', G.gap, { variants: true }), listCtrl('Stil', G.transform, { multi: true, variants: true }))),
        grp('Størrelse', col(listCtrl('Bredde', G.w, { variants: true }), listCtrl('Højde', G.h, { variants: true }), listCtrl('Maks. bredde', G.maxw, { variants: true }))),
        grp('Kant og effekt', col(listCtrl('Afrunding', G.rounded, { variants: true }), listCtrl('Kant', G.border, { multi: true, variants: true }), listCtrl('Skygge', G.shadow, { variants: true }))),
      ]);
    },
    css: null, js: CDN.tailwindJs,
  };

  FW.bulma = {
    id: 'bulma', name: 'Bulma', color: '#00b89c', bp: [['mobile', 768], ['tablet', 769], ['desktop', 1024], ['widescreen', 1216], ['fullhd', 1408]],
    detect: (doc, text) => {
      let s = 0;
      if (/bulma(?:\.min)?\.css|bulma@/i.test(text)) s += 10;
      const sig = /^(columns?|column|button|is-(primary|link|info|success|warning|danger|dark|light|small|medium|large|half|fullwidth|flex|active)|has-text-\w+|has-background-\w+|navbar(-\w+)?|notification|box|hero(-body)?|section|title|subtitle|tag|field|control|input|card(-\w+)?|content)$/;
      const seen = new Set();
      doc.querySelectorAll('[class]').forEach((e) => e.classList.forEach((c) => { if (sig.test(c)) seen.add(c); }));
      const strong = ['columns', 'column', 'navbar-brand', 'notification', 'has-text-centered'].filter((x) => seen.has(x)).length;
      if (strong >= 2 || (seen.size >= 5 && Array.from(seen).some((c) => c.startsWith('is-')))) s += seen.size;
      return s;
    },
    version: (text) => (/bulma@(\d+\.\d+\.\d+)/i.exec(text) || [])[1] || '',
    build(P) {
      P.build.append(
        grp('Elementer', menuBtn('card', 'Element', () => snipItems(buSnip.el), 'Knapper, bokse, beskeder, tags, tabeller og billeder'),),
        grp('Komponenter', menuBtn('nav', 'Komponent', () => snipItems(buSnip.comp), 'Navbar, kort, modal, dropdown, faner og paginering')),
        grp('Layout', menuBtn('layout', 'Layout', () => snipItems(buSnip.layout), 'Section, hero, grid og footer'), big('grid', 'Kolonner…', () => gridDialog('bulma'), 'En række kolonner, der bliver til kolonner fra en valgt skærmbredde')),
        grp('Formular', menuBtn('form', 'Formular', () => snipItems(buSnip.form), 'Felter, valglister og knapper')),
        bpGroup(this.bp),
        grp('Opsætning', col(row(Object.assign(el('span', 'muted'), { id: 'fwVer', textContent: '' })), row(Object.assign(el('span', 'muted small'), { textContent: t('Bulma bruger ingen JavaScript.') })))));
      const colors = pre('is-', BU.filter((c) => c !== 'text'));
      const G = {
        color: colors, size: ['is-small', 'is-normal', 'is-medium', 'is-large'],
        variant: ['is-light', 'is-dark', 'is-outlined', 'is-inverted', 'is-rounded', 'is-fullwidth', 'is-loading', 'is-static', 'is-hovered', 'is-focused', 'is-active'],
        txt: pre('has-text-', ['primary', 'link', 'info', 'success', 'warning', 'danger', 'white', 'black', 'dark', 'light', 'grey']),
        bg: pre('has-background-', ['primary', 'link', 'info', 'success', 'warning', 'danger', 'white', 'black', 'dark', 'light']),
        align: ['has-text-left', 'has-text-centered', 'has-text-right', 'has-text-justified'],
        weight: pre('has-text-weight-', ['light', 'normal', 'medium', 'semibold', 'bold']),
        sz: pre('is-size-', rng(1, 7)),
        flex: ['is-flex', 'is-flex-direction-row', 'is-flex-direction-column', 'is-flex-wrap-wrap', 'is-inline-flex'],
        justify: pre('is-justify-content-', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']),
        items: pre('is-align-items-', ['flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        hidden: ['is-hidden', 'is-hidden-mobile', 'is-hidden-tablet', 'is-hidden-desktop', 'is-invisible', 'is-sr-only'],
        colw: ['is-full', 'is-four-fifths', 'is-three-quarters', 'is-two-thirds', 'is-three-fifths', 'is-half', 'is-two-fifths', 'is-one-third', 'is-one-quarter', 'is-one-fifth', ...pre('is-', rng(1, 12))],
        offset: pre('is-offset-', rng(1, 11)), narrow: ['is-narrow', 'is-narrow-mobile', 'is-narrow-tablet', 'is-narrow-desktop'],
      };
      styleCommon(P, this, [
        grp('Farve', col(listCtrl('Farve', G.color), listCtrl('Tekstfarve', G.txt), listCtrl('Baggrund', G.bg))),
        grp('Størrelse og variant', col(listCtrl('Størrelse', G.size), listCtrl('Variant', G.variant, { multi: true }))),
        grp('Tekst', col(listCtrl('Justering', G.align), listCtrl('Vægt', G.weight), listCtrl('Skriftstørrelse', G.sz))),
        grp('Afstand', big('spacing', 'Afstand…', (b) => spacingPanel(b, { margin: buSpace('m'), padding: buSpace('p') }), 'Margen og padding for hver side')),
        grp('Layout', col(listCtrl('Flex', G.flex), listCtrl('Justér', [...G.justify, ...G.items]), listCtrl('Skjul', G.hidden))),
        grp('Kolonne', col(listCtrl('Bredde', G.colw), listCtrl('Forskudt', G.offset), listCtrl('Smal', G.narrow))),
      ]);
    },
    css: CDN.bulmaCss, js: null,
  };

  FW.pico = {
    id: 'pico', name: 'Pico', color: '#3b82f6', bp: [['sm', 576], ['md', 768], ['lg', 1024], ['xl', 1280], ['xxl', 1536]],
    detect: (doc, text) => {
      let s = 0;
      if (/pico(?:\.[a-z.]+)?(?:\.min)?\.css|@picocss\/pico/i.test(text)) s += 12;
      return s;
    },
    version: (text) => (/@picocss\/pico@(\d+\.\d+\.\d+)/i.exec(text) || [])[1] || '',
    single: true,
    build(P) {
      const theme = el('select', 'sel sm'); for (const c of PICO_COLORS) theme.add(new Option(c, c));
      const cur = /pico\.(?:classless\.)?(?:conditional\.)?([a-z]+)\.min\.css/i.exec(ed.value); theme.value = cur && PICO_COLORS.includes(cur[1]) ? cur[1] : 'azure';
      const classless = el('label', 'chk'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = /pico\.classless/i.test(ed.value); classless.append(cb, ' ' + t('Klasseløs'));
      const swap = () => {
        const url = CDN.picoCss(''); const v = theme.value === 'azure' ? '' : theme.value;
        const file = 'pico' + (cb.checked ? '.classless' : '') + (v ? '.' + v : '') + '.min.css';
        const base = 'https://cdn.jsdelivr.net/npm/@picocss/pico@' + V.pico + '/css/' + file;
        const re = /(<link[^>]*href=["'])([^"']*pico[^"']*\.css)(["'][^>]*>)/i; const m = re.exec(ed.value);
        if (m) { const at = m.index + m[1].length; TN.src.replace(at, at + m[2].length, base); } else addStylesheet(base);
      };
      theme.onchange = swap; cb.onchange = swap;
      P.build.append(
        grp('Tema', col(row(theme), row(classless))),
        grp('Komponenter', menuBtn('card', 'Komponenter', () => snipItems(picoSnip), 'Kort, accordion, navigation, dialog, dropdown, grid og formular')),
        grp('Valgt element', col(listCtrl('Stil', ['secondary', 'contrast', 'outline', 'outline secondary', 'outline contrast'], { when: () => true, single: true }), listCtrl('Beholder', ['container', 'container-fluid'], {}))),
        bpGroup(this.bp),
        grp('Opsætning', col(row(Object.assign(el('span', 'muted'), { id: 'fwVer', textContent: '' })), row(Object.assign(el('span', 'muted small'), { textContent: t('Pico stiler almindelig HTML næsten uden klasser.') })))));
      // "Stil"-valget tæller kun hele klassestrenge; erstat med enkel logik for sammensatte værdier
      const c = ctrls[ctrls.length - 2]; if (c) {
        const opts = ['secondary', 'contrast', 'outline', 'outline secondary', 'outline contrast'];
        c.refresh = (set) => { const hit = opts.slice().reverse().find((o) => o.split(' ').every((x) => set.has(x))); c.s.value = hit || ''; c.s.classList.toggle('set', !!hit); };
        c.s.onchange = () => { const set = target.classes(); for (const x of ['secondary', 'contrast', 'outline']) set.delete(x); if (c.s.value) c.s.value.split(' ').forEach((x) => set.add(x)); target.setClass(Array.from(set).join(' ')); refreshCtrls(); };
      }
    },
    css: CDN.picoCss(''), js: null,
  };

  /* ======================= fælles for Stil-fanen ======================= */
  function styleCommon(P, def, groups) {
    P.style.append(
      grp('Valgt element', col(row(Object.assign(el('span', 'fwsel'), { id: 'fwSelLabel', textContent: '' })), row(smallBtn(t('Klasser…'), () => classDialog(def.id), t('Ret elementets klasser med forslag')), smallBtn(t('Ryd'), () => { target.setClass(''); refreshCtrls(); }, t('Fjern alle klasser fra elementet'))))),
      ...groups);
  }

  /* ======================= hjælpere til opsætning ======================= */
  function addStylesheet(url) {
    if (ed.value.includes(url)) { TN.toast(t('Linket findes allerede.')); return; }
    TN.src.headInsert('<link rel="stylesheet" href="' + url + '">');
  }
  function addScript(url, attrs) {
    if (ed.value.includes(url)) { TN.toast(t('Scriptet findes allerede.')); return; }
    const tag = '<script src="' + url + '"' + (attrs ? ' ' + attrs : '') + '><\/script>';
    const m = /<\/body\s*>/i.exec(ed.value);
    if (m) { const ls = ed.value.lastIndexOf('\n', m.index - 1) + 1; const ind = /^[ \t]*/.exec(ed.value.slice(ls, m.index))[0]; const line = ed.value.slice(ls, m.index).trim() === ''; src_insert(line ? ls : m.index, ind + '  ' + tag + '\n' + (line ? '' : ind)); }
    else TN.src.headInsert(tag);
    if (state.js === 'off') TN.toast(t('Scriptet er tilføjet. Slå JavaScript til eller Kendte i Visning for at se det virke.'), 5000);
  }
  const src_insert = (at, text) => TN.src.replace(at, at, text);
  function themeToken(kind) {
    TN.ask({ title: kind === 'color' ? 'Ny farve' : 'Ny skrifttype', fields: kind === 'color'
      ? [{ id: 'n', label: 'Navn (fx brand)', value: 'brand' }, { id: 'v', label: 'Farve', type: 'color', value: '#4f46e5' }]
      : [{ id: 'n', label: 'Navn (fx display)', value: 'display' }, { id: 'v', label: 'Skrifttyper', value: '"Georgia", serif' }] }).then((r) => {
      if (!r || !r.n) return;
      const line = '  --' + kind + '-' + r.n.replace(/[^\w-]/g, '') + ': ' + r.v + ';';
      const m = /<style[^>]*type\s*=\s*["']text\/tailwindcss["'][^>]*>([\s\S]*?)<\/style>/i.exec(ed.value);
      if (m && /@theme\s*\{/.test(m[1])) { const at = m.index + m[0].indexOf('@theme') + m[0].slice(m[0].indexOf('@theme')).indexOf('{') + 1; TN.src.replace(at, at, '\n' + line); }
      else TN.src.headInsert('<style type="text/tailwindcss">\n  @theme {\n' + line.replace(/^/, '  ') + '\n  }\n</style>');
      TN.toast(t('Tilføjet. Brug den som {0}.', kind === 'color' ? 'bg-' + r.n + ', text-' + r.n : 'font-' + r.n));
    });
  }
  function darkClass() {
    const m = /<style[^>]*type\s*=\s*["']text\/tailwindcss["'][^>]*>/i.exec(ed.value);
    const rule = '@custom-variant dark (&:where(.dark, .dark *));';
    if (ed.value.includes('@custom-variant dark')) { TN.toast(t('Findes allerede.')); return; }
    if (m) { const at = m.index + m[0].length; TN.src.replace(at, at, '\n  ' + rule); } else TN.src.headInsert('<style type="text/tailwindcss">\n  ' + rule + '\n</style>');
    TN.toast(t('Tilføj klassen dark på <html> for at slå mørk tilstand til.'));
  }

  /* ======================= framework-menuen i Design ======================= */
  function addMenu(anchor) {
    const item = (label, hint, fn) => ({ label, hint, raw: true, onClick: fn });
    TN.popMenu(anchor, [
      { head: 'Tilføj via CDN (kræver internet)' },
      item('Bootstrap ' + V.bootstrap, 'CSS + JavaScript', () => { addStylesheet(CDN.bootstrapCss); addScript(CDN.bootstrapJs); }),
      item('Bootstrap ' + V.bootstrap, 'kun CSS', () => addStylesheet(CDN.bootstrapCss)),
      item('Tailwind CSS ' + V.tailwind, 'browser-script', () => addScript(CDN.tailwindJs)),
      item('Bulma ' + V.bulma, 'CSS', () => addStylesheet(CDN.bulmaCss)),
      item('Pico ' + V.pico, 'CSS (azure)', () => addStylesheet(CDN.picoCss(''))),
      item('Pico ' + V.pico, 'CSS, klasseløs', () => addStylesheet('https://cdn.jsdelivr.net/npm/@picocss/pico@' + V.pico + '/css/pico.classless.min.css')),
    ]);
  }

  /* ======================= lint: ukendte klasser ======================= */
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  function lint(doc, add, text) {
    const id = fw.current; if (!id || !catCache[id]) return;
    const cat = catCache[id];
    const own = new Set(); for (const m of text.matchAll(/\.([A-Za-z_-][\w-]*)/g)) own.add(m[1]);
    const seen = new Set(); let n = 0;
    doc.querySelectorAll('[class]').forEach((e) => e.classList.forEach((c) => {
      if (cat.set.has(c) || own.has(c) || seen.has(c) || n > 15) return; seen.add(c);
      let best = null, bd = 3; for (const k of cat.classes) { if (Math.abs(k.length - c.length) > 2) continue; const d = lev(c, k); if (d < bd) { bd = d; best = k; } }
      if (best) { n++; add('info', 'Ukendt {0}-klasse "{1}". Mente du "{2}"?', [cat.name, c, best], e); }
    }));
  }

  /* ======================= registrering, faner og kontakt ======================= */
  const fw = (TN.fw = { current: null, FW, knownScripts, lint, addMenu, refresh: () => refreshCtrls(), CDN, V });
  let detectT = 0, last = '';
  fw.reset = () => { last = ''; detect(); };
  fw.detectSoon = () => { clearTimeout(detectT); detectT = setTimeout(detect, 350); };
  function detect() {
    const text = ed.value;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    let best = null, bs = 0;
    for (const f of Object.values(FW)) { const s = f.detect(doc, text); if (s > bs) { bs = s; best = f; } }
    if (bs < 5) best = null;
    const id = best ? best.id : null;
    const ver = best ? best.version(text) : '';
    const key = (id || '') + '|' + ver;
    if (best) loadCatalog(best.id);
    if (key === last) { const v = $('#fwVer'); if (v && best) v.textContent = versionText(best, ver); return; }
    last = key; fw.current = id; rebuild(best, ver);
  }
  const versionText = (f, ver) => (ver ? f.name + ' ' + ver : t('{0} fundet i siden', f.name));

  function rebuild(f, ver) {
    const tabs = $('#fwTabs'); tabs.innerHTML = '';
    const P = { build: $('[data-panel="fw-build"]'), style: $('[data-panel="fw-style"]') };
    P.build.innerHTML = ''; P.style.innerHTML = ''; ctrls.length = 0;
    const was = TN.store.get('tab', 'home');
    if (!f) { if (/^fw-/.test(TN.curTab)) TN.showTab('home'); document.body.classList.remove('has-fw'); return; }
    document.body.classList.add('has-fw');
    document.documentElement.style.setProperty('--fw-color', f.color);
    f.build(P);
    const mk = (id, label) => { const b = el('button', 'tab fwtab'); b.dataset.tab = id; b.setAttribute('role', 'tab'); b.innerHTML = '<i class="dot"></i>' + esc(label); b.onclick = () => TN.showTab(id); return b; };
    tabs.append(mk('fw-build', f.id === 'tailwind' ? f.name + ' · ' + t('Tema') : f.single ? f.name : f.name + ' · ' + t('Byg')));
    if (!f.single) tabs.append(mk('fw-style', f.name + ' · ' + t('Stil')));
    if (window.WDi18n) window.WDi18n.apply($('#ribbon'));
    const v = $('#fwVer'); if (v) v.textContent = versionText(f, ver);
    if (TN.curTab && /^fw-/.test(TN.curTab)) TN.showTab(f.single && TN.curTab === 'fw-style' ? 'fw-build' : TN.curTab);
    refreshCtrls();
    for (const b of $$('.tab', tabs)) b.classList.toggle('active', b.dataset.tab === TN.curTab);
    TN.fwToast && TN.fwToast(f);
  }
  TN.hooks.onSelect = (TN.hooks.onSelect || []).concat([() => refreshCtrls()]);
  TN.hooks.cursor = () => { if (state.mode === 'raw' || !TN.sel.el) refreshCtrls(); };
  TN.cmds.menuFrameworks = () => addMenu($('[data-cmd="menuFrameworks"]'));
})();
