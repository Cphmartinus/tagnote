/* TagNote – stilpanel: ret CSS for det markerede element */
(function () {
  'use strict';
  const { $, $$, t, state, ed, el, esc } = TN;
  const panel = $('#insp');
  let open = false, targetSel = 'inline';
  const fields = [];

  const toHex = (c) => {
    const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/i.exec(c || '');
    if (!m) return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#000000';
    return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
  };
  const isTransparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

  /* ---------- skriv til CSS ---------- */
  function splitBlocks(css) {
    const out = []; let i = 0, depth = 0, start = 0, selStart = 0;
    while (i < css.length) {
      const c = css[i];
      if (css.startsWith('/*', i)) { const j = css.indexOf('*/', i + 2); i = j < 0 ? css.length : j + 2; continue; }
      if (c === '{') { if (depth === 0) selStart = i; depth++; }
      else if (c === '}') { depth--; if (depth === 0) { out.push({ sel: css.slice(start, selStart).trim(), body: css.slice(selStart + 1, i), nested: /\{/.test(css.slice(selStart + 1, i)) }); start = i + 1; } }
      i++;
    }
    const tail = css.slice(start).trim();
    return { blocks: out, tail };
  }
  function decls(body) { return body.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const k = s.indexOf(':'); return k < 0 ? [s, ''] : [s.slice(0, k).trim(), s.slice(k + 1).trim()]; }); }
  function cssUpdate(css, selector, prop, val) {
    const { blocks, tail } = splitBlocks(css);
    let b = blocks.find((x) => x.sel === selector && !x.nested);
    if (!b) { if (val === '' || val == null) return css; b = { sel: selector, body: '', nested: false }; blocks.push(b); }
    const d = decls(b.body).filter(([k]) => k !== prop);
    if (val !== '' && val != null) d.push([prop, val]);
    b.body = d.map(([k, v]) => '\n  ' + k + ': ' + v + ';').join('') + '\n';
    const keep = blocks.filter((x) => x.nested || decls(x.body).length);
    return '\n' + keep.map((x) => x.sel + ' {' + (x.nested ? x.body : x.body) + '}').join('\n\n') + '\n' + (tail ? tail + '\n' : '');
  }
  function selectorFor(el, mode) {
    if (mode === 'class') { const c = (el.getAttribute('class') || '').trim().split(/\s+/)[0]; return c ? '.' + CSS.escape(c) : null; }
    if (mode === 'id') return el.id ? '#' + CSS.escape(el.id) : null;
    if (mode === 'tag') return el.tagName.toLowerCase();
    return null;
  }
  function setProp(prop, val) {
    const doc = TN.preview.doc(), e = TN.sel.el; if (!doc || !e) return;
    if (targetSel === 'inline') {
      if (val === '' || val == null) e.style.removeProperty(prop); else e.style.setProperty(prop, val);
      if (!e.getAttribute('style')) e.removeAttribute('style');
    } else {
      const sel = selectorFor(e, targetSel);
      if (!sel) { TN.toast(targetSel === 'id' ? t('Elementet har intet id. Giv det et id under Egenskaber.') : t('Elementet har ingen klasse. Giv det en klasse under Egenskaber.'), 4200); return; }
      let st = doc.getElementById('tn-css');
      if (!st) { st = doc.createElement('style'); st.id = 'tn-css'; (doc.head || doc.documentElement).append(st); }
      st.textContent = cssUpdate(st.textContent, sel, prop, val);
    }
    TN.preview.scheduleCommit();
    TN.preview.positionSelBox();
  }

  /* ---------- felter ---------- */
  function section(title, ...kids) {
    const d = el('details', 'isec'); d.open = true; d.append(el('summary', '', esc(t(title))));
    const b = el('div', 'ibody'); b.append(...kids); d.append(b); return d;
  }
  function field(label, ctl) { const r = el('div', 'ifield'); r.append(Object.assign(el('label'), { textContent: t(label) }), ctl); return r; }
  function reg(prop, read, write) { fields.push({ prop, read, write }); }

  function colorField(label, prop) {
    const w = el('div', 'icolor'); const c = el('input'); c.type = 'color'; const h = el('input'); h.type = 'text'; h.spellcheck = false; h.placeholder = '—';
    const x = el('button', 'ix'); x.textContent = '✕'; x.title = t('Fjern');
    c.oninput = () => { h.value = c.value; setProp(prop, c.value); };
    h.onchange = () => { const v = h.value.trim(); if (/^#[0-9a-f]{3,8}$/i.test(v) || /^[a-z]+$/i.test(v) || /^(rgb|hsl|oklch)/i.test(v)) { setProp(prop, v); refresh(); } };
    x.onclick = () => { setProp(prop, ''); refresh(); };
    w.append(c, h, x);
    reg(prop, (cs) => { const v = cs.getPropertyValue(prop); c.value = toHex(v); h.value = isTransparent(v) ? '' : toHex(v); });
    return field(label, w);
  }
  function textField(label, prop, ph) {
    const i = el('input'); i.type = 'text'; i.spellcheck = false; if (ph) i.placeholder = ph;
    i.onchange = () => setProp(prop, i.value.trim());
    i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); };
    reg(prop, (cs) => { i.value = cs.getPropertyValue(prop); });
    return field(label, i);
  }
  function selectField(label, prop, opts) {
    const s = el('select', 'sel sm'); s.add(new Option('—', '')); for (const o of opts) s.add(new Option(typeof o === 'string' ? o : o[1], typeof o === 'string' ? o : o[0]));
    s.onchange = () => setProp(prop, s.value);
    reg(prop, (cs) => { const v = cs.getPropertyValue(prop); if (![...s.options].some((o) => o.value === v)) s.add(new Option(v, v)); s.value = v; });
    return field(label, s);
  }
  function rangeField(label, prop, min, max, step, unit) {
    const w = el('div', 'irange'); const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; const o = el('span', 'muted');
    r.oninput = () => { o.textContent = r.value + unit; setProp(prop, r.value + unit); };
    reg(prop, (cs) => { const v = parseFloat(cs.getPropertyValue(prop)); r.value = isNaN(v) ? 0 : v; o.textContent = (isNaN(v) ? 0 : +v.toFixed(2)) + unit; });
    w.append(r, o); return field(label, w);
  }
  function segField(label, prop, opts) {
    const w = el('div', 'iseg'); const btns = [];
    for (const [v, ic, tip] of opts) { const b = el('button', 'rb sm'); b.innerHTML = ic.length > 3 ? window.WDicon(ic) : ic; b.title = t(tip); b.onclick = () => { setProp(prop, cur === v ? '' : v); refresh(); }; b.dataset.v = v; btns.push(b); w.append(b); }
    let cur = '';
    reg(prop, (cs) => { cur = cs.getPropertyValue(prop); const norm = { start: 'left', end: 'right' }[cur] || cur; btns.forEach((b) => b.classList.toggle('on', b.dataset.v === norm)); });
    return field(label, w);
  }
  function boxField(label, base) {
    const w = el('div', 'ibox4'); const ins = [];
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const i = el('input'); i.type = 'text'; i.spellcheck = false; i.title = t({ top: 'Top', right: 'Højre', bottom: 'Bund', left: 'Venstre' }[side]); i.placeholder = side[0].toUpperCase();
      i.onchange = () => setProp(base + '-' + side, i.value.trim());
      i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); };
      ins.push(i); w.append(i);
      reg(base + '-' + side, (cs) => { i.value = cs.getPropertyValue(base + '-' + side); });
    }
    return field(label, w);
  }
  function attrField(label, name, ph) {
    const i = el('input'); i.type = 'text'; i.spellcheck = false; if (ph) i.placeholder = ph;
    i.onchange = () => { TN.target.setAttr(name, i.value.trim()); };
    i.onkeydown = (e) => { if (e.key === 'Enter') i.blur(); };
    fields.push({ attr: name, read: () => { i.value = TN.target.getAttr(name); } });
    return field(label, i);
  }
  const ATTRS_BY_TAG = { a: [['href', 'href'], ['target', 'target'], ['rel', 'rel']], img: [['src', 'src'], ['alt', 'alt'], ['width', 'width'], ['height', 'height']], input: [['type', 'type'], ['name', 'name'], ['placeholder', 'placeholder']], button: [['type', 'type']], label: [['for', 'for']], form: [['action', 'action'], ['method', 'method']], iframe: [['src', 'src'], ['title', 'title']], video: [['src', 'src'], ['poster', 'poster']], meta: [['name', 'name'], ['content', 'content']], link: [['rel', 'rel'], ['href', 'href']] };

  /* ---------- opbygning ---------- */
  function build() {
    fields.length = 0; panel.innerHTML = '';
    const head = el('div', 'ihead');
    head.innerHTML = '<b>' + esc(t('Stilpanel')) + '</b><button class="ix" id="inspClose" title="' + esc(t('Luk')) + '">✕</button>';
    const lab = el('div', 'ielem'); lab.id = 'inspElem';
    const tg = el('select', 'sel sm'); tg.id = 'inspTarget';
    for (const [v, l] of [['inline', 'Skriv til: elementets style'], ['class', 'Skriv til: regel for første klasse'], ['id', 'Skriv til: regel for id'], ['tag', 'Skriv til: regel for tagget']]) tg.add(new Option(t(l), v));
    tg.value = targetSel; tg.onchange = () => { targetSel = tg.value; TN.store.set('inspTarget', targetSel); };
    const note = el('div', 'inote'); note.id = 'inspNote';
    const body = el('div', 'ibodywrap'); body.id = 'inspBody';
    body.append(
      section('Egenskaber', attrField('id', 'id'), attrField('class', 'class'), attrField('title', 'title'), Object.assign(el('div', 'iattrs'), { id: 'inspAttrs' })),
      section('Tekst',
        colorField('Farve', 'color'),
        textField('Størrelse', 'font-size', 'fx 1.25rem'),
        selectField('Vægt', 'font-weight', ['100', '200', '300', '400', '500', '600', '700', '800', '900']),
        selectField('Skrift', 'font-family', [['system-ui, sans-serif', 'System'], ['Georgia, serif', 'Georgia'], ['"Times New Roman", serif', 'Times'], ['Arial, Helvetica, sans-serif', 'Arial'], ['"Segoe UI", sans-serif', 'Segoe UI'], ['ui-monospace, Consolas, monospace', 'Monospace']]),
        segField('Justering', 'text-align', [['left', 'alignl', 'Venstre'], ['center', 'alignc', 'Centreret'], ['right', 'alignr', 'Højre'], ['justify', 'alignj', 'Lige margener']]),
        textField('Linjehøjde', 'line-height', 'fx 1.6'),
        textField('Bogstavafstand', 'letter-spacing', 'fx 0.02em'),
        selectField('Pynt', 'text-decoration-line', ['none', 'underline', 'line-through', 'overline']),
        selectField('Versaler', 'text-transform', ['none', 'uppercase', 'lowercase', 'capitalize'])),
      section('Boks',
        textField('Bredde', 'width', 'fx 50% eller 320px'), textField('Højde', 'height', 'auto'), textField('Maks. bredde', 'max-width', 'none'),
        boxField('Margen', 'margin'), boxField('Padding', 'padding'),
        selectField('Visning', 'display', ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none'])),
      section('Baggrund og kant',
        colorField('Baggrund', 'background-color'),
        rangeField('Gennemsigtighed', 'opacity', 0, 1, 0.05, ''),
        textField('Kantlinje', 'border', 'fx 1px solid #ccc'),
        colorField('Kantfarve', 'border-color'),
        rangeField('Afrunding', 'border-radius', 0, 60, 1, 'px'),
        textField('Skygge', 'box-shadow', 'fx 0 4px 12px rgb(0 0 0 / .15)')),
      section('Layout',
        selectField('Flex-retning', 'flex-direction', ['row', 'row-reverse', 'column', 'column-reverse']),
        selectField('Flex: ombryd', 'flex-wrap', ['nowrap', 'wrap', 'wrap-reverse']),
        selectField('Justér (hovedakse)', 'justify-content', ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']),
        selectField('Justér (tværakse)', 'align-items', ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']),
        textField('Afstand (gap)', 'gap', 'fx 1rem'),
        selectField('Position', 'position', ['static', 'relative', 'absolute', 'fixed', 'sticky']),
        textField('z-index', 'z-index', 'auto'),
        selectField('Overløb', 'overflow', ['visible', 'hidden', 'scroll', 'auto'])));
    panel.append(head, lab, tg, note, body);
    $('#inspClose').onclick = () => toggle(false);
  }

  function refresh() {
    if (!open) return;
    const doc = TN.preview.doc(), e = TN.sel.el;
    const note = $('#inspNote'), body = $('#inspBody'), lab = $('#inspElem');
    let msg = '';
    if (state.js !== 'off') msg = t('Stilpanelet kræver, at JavaScript i visningen er Fra.');
    else if (state.mode === 'raw') msg = t('Skift til Kode + visning eller Visning for at bruge stilpanelet.');
    else if (!e || !doc) msg = t('Markér et element i visningen, eller sæt markøren i koden.');
    note.textContent = msg; note.hidden = !msg; body.classList.toggle('off', !!msg);
    lab.textContent = e ? TN.labelOf(e) : '';
    if (msg) return;
    const cs = doc.defaultView.getComputedStyle(e);
    for (const f of fields) { try { f.read(cs); } catch (_) {} }
    // attributter, der kun gælder bestemte tags
    const box = $('#inspAttrs'); box.innerHTML = '';
    const list = ATTRS_BY_TAG[e.tagName.toLowerCase()] || [];
    for (const [label, name] of list) {
      const i = el('input'); i.type = 'text'; i.spellcheck = false; i.value = e.getAttribute(name) || '';
      i.onchange = () => TN.target.setAttr(name, i.value.trim());
      i.onkeydown = (ev) => { if (ev.key === 'Enter') i.blur(); };
      box.append(field(label, i));
    }
  }

  function toggle(force) {
    open = force === undefined ? !open : !!force;
    panel.hidden = !open; TN.store.set('inspector', open);
    $$('[data-cmd="inspector"]').forEach((b) => b.classList.toggle('on', open));
    if (open) { if (!panel.firstChild) build(); refresh(); }
    TN.preview && TN.preview.layout();
  }
  TN.cmds.inspector = (f) => toggle(f === true ? true : undefined);
  TN.cmds.selectParent = () => TN.sel.parent();
  TN.cmds.copySelector = async () => {
    const e = TN.sel.el; if (!e) { TN.toast(t('Markér et element først.')); return; }
    const parts = []; for (let n = e; n && n.nodeType === 1 && n.tagName !== 'HTML'; n = n.parentElement) { let s = n.tagName.toLowerCase(); if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; } const c = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0]; if (c) s += '.' + CSS.escape(c); parts.unshift(s); if (parts.length >= 4) break; }
    const sel = parts.join(' > '); await TN.copy(sel); TN.toast(t('Kopieret: {0}', sel), 3500);
  };
  TN.hooks.onSelect = (TN.hooks.onSelect || []).concat([refresh]);
  TN.hooks.rendered = ((old) => () => { old && old(); refresh(); })(TN.hooks.rendered);
  targetSel = TN.store.get('inspTarget', 'inline');
  TN.inspector = { refresh, toggle };
  TN.ready.push(() => { if (TN.store.get('inspector', false)) toggle(true); });
})();
