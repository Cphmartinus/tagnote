/* TagNote – fælles hjælpere */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const api = window.api || {};
  const { t } = window.WDi18n;
  const TN = (window.TN = { $, $$, api, t, cmds: {}, hooks: {}, ready: [] });

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  Object.assign(TN, { esc, escAttr });

  /* ---------- indstillinger ---------- */
  TN.store = {
    get(k, d) { try { const v = localStorage.getItem('tn.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('tn.' + k, JSON.stringify(v)); } catch (_) {} },
  };

  TN.toast = function toast(msg, ms = 2600) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), ms);
  };

  TN.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  TN.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    try { if (api.copyText) { await api.copyText(text); return true; } } catch (_) {}
    return false;
  };

  /* ---------- dialoger ---------- */
  TN.modal = function modal({ title, body, buttons, wide, cls }) {
    return new Promise((resolve) => {
      const root = $('#modalRoot');
      const ov = document.createElement('div');
      ov.className = 'overlay';
      const dlg = document.createElement('div');
      dlg.className = 'dlg' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
      dlg.setAttribute('role', 'dialog');
      const h = document.createElement('h3'); h.textContent = title;
      const bd = document.createElement('div'); bd.className = 'body'; bd.append(body);
      const ft = document.createElement('div'); ft.className = 'foot';
      const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      let okBtn = null;
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName) && !e.target.closest('.lst')) { e.preventDefault(); e.stopPropagation(); okBtn && okBtn.click(); }
      };
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.text;
        el.onclick = () => close(b.value ? b.value() : null);
        if (b.primary) okBtn = el;
        ft.append(el);
      }
      dlg.append(h, bd, ft); ov.append(dlg); root.append(ov);
      ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(null); });
      document.addEventListener('keydown', onKey, true);
      const first = dlg.querySelector('input:not([type=range]):not([type=checkbox]),select,textarea');
      if (first) { first.focus(); if (first.select && first.type !== 'color') first.select(); }
      if (window.WDi18n) window.WDi18n.apply(dlg);
    });
  };

  /* Formular med forskellige feltyper. fields: [{id,label,type,value,options,placeholder,min,max,step,browse}] */
  TN.ask = function ask({ title, fields, okText, intro }) {
    const body = document.createElement('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    if (intro) { const p = document.createElement('p'); p.style.margin = '0'; p.className = 'muted'; p.textContent = intro; body.append(p); }
    const els = {};
    for (const f of fields) {
      const l = document.createElement('label'); l.className = 'f'; l.append(t(f.label));
      let i;
      if (f.type === 'select') {
        i = document.createElement('select');
        for (const o of f.options) i.add(new Option(typeof o === 'string' ? o : t(o.label), typeof o === 'string' ? o : o.value));
        i.value = f.value != null ? f.value : i.options[0].value;
      } else if (f.type === 'textarea') {
        i = document.createElement('textarea'); i.rows = f.rows || 4; i.value = f.value || ''; i.spellcheck = false;
      } else if (f.type === 'checkbox') {
        l.className = 'chk'; l.textContent = ''; i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!f.value; l.append(i, ' ' + t(f.label));
      } else {
        i = document.createElement('input'); i.type = f.type || 'text'; i.value = f.value != null ? f.value : ''; i.spellcheck = false;
        if (f.placeholder) i.placeholder = t(f.placeholder);
        for (const k of ['min', 'max', 'step']) if (f[k] != null) i[k] = f[k];
      }
      els[f.id] = i;
      if (f.browse) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px';
        const br = document.createElement('button'); br.className = 'btn'; br.textContent = t('Gennemse…'); br.style.flex = 'none';
        br.onclick = async () => { const r = await api.pickImage(TN.docPath && TN.docPath()); if (r && r[0]) i.value = r[0]; };
        row.append(i, br); l.append(row);
      } else if (f.type !== 'checkbox') l.append(i);
      body.append(l);
    }
    return TN.modal({ title: t(title), body, buttons: [
      { text: t('Annuller') },
      { text: okText || t('OK'), primary: true, value: () => Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.type === 'checkbox' ? v.checked : v.value.trim()])) }] });
  };

  /* ---------- pop-op-menu ---------- */
  let openMenu = null;
  TN.closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', onDocDown, true); document.removeEventListener('keydown', onMenuKey, true); } };
  const onDocDown = (e) => { if (openMenu && !openMenu.contains(e.target)) TN.closeMenu(); };
  const onMenuKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); TN.closeMenu(); } };
  TN.popMenu = function (anchor, items, opts = {}) {
    TN.closeMenu();
    const m = TN.el('div', 'popmenu' + (opts.cls ? ' ' + opts.cls : ''));
    for (const it of items) {
      if (it === '-' || it.sep) { m.append(TN.el('div', 'pm-sep')); continue; }
      if (it.head) { m.append(TN.el('div', 'pm-head', esc(t(it.head)))); continue; }
      const b = TN.el('button', 'pm-item' + (it.on ? ' on' : ''));
      b.innerHTML = '<span class="pm-ic">' + (it.icon ? window.WDicon(it.icon) : it.on ? '✓' : '') + '</span><span class="pm-lb">' + esc(it.raw ? it.label : t(it.label)) + '</span>' + (it.hint ? '<span class="pm-hint">' + esc(it.raw ? it.hint : t(it.hint)) + '</span>' : '');
      if (it.disabled) b.disabled = true;
      b.onclick = () => { TN.closeMenu(); it.onClick && it.onClick(); };
      m.append(b);
    }
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(innerWidth - m.offsetWidth - 6, r.left)) + 'px';
    m.style.top = Math.min(innerHeight - m.offsetHeight - 6, r.bottom + 2) + 'px';
    openMenu = m;
    setTimeout(() => { document.addEventListener('mousedown', onDocDown, true); document.addEventListener('keydown', onMenuKey, true); }, 0);
    return m;
  };

  /* ---------- redigering af kildekoden (tekstfeltet) ---------- */
  const ed = (TN.ed = $('#ed'));
  TN.hl = $('#hl');
  TN.state = { path: null, saved: '', mode: 'split', theme: 'light', lastSnap: '', untitled: 'Side1', untitledNo: 1, js: 'off', width: 0, edit: true, encodingNote: false };

  const src = (TN.src = {});
  /* Erstat intervallet [a,b) med tekst via execCommand, så Fortryd virker */
  src.replace = function (a, b, text, selA, selB) {
    ed.focus();
    ed.setSelectionRange(a, b);
    if (!document.execCommand('insertText', false, text)) { ed.setRangeText(text, a, b, 'end'); ed.dispatchEvent(new Event('input', { bubbles: true })); }
    if (selA != null) ed.setSelectionRange(selA, selB != null ? selB : selA);
  };
  src.insertText = (text) => { ed.focus(); if (!document.execCommand('insertText', false, text)) { const a = ed.selectionStart; ed.setRangeText(text, a, ed.selectionEnd, 'end'); ed.dispatchEvent(new Event('input', { bubbles: true })); } };
  src.setAll = function (text) {
    const keepTop = ed.scrollTop;
    ed.focus(); ed.setSelectionRange(0, ed.value.length);
    if (!document.execCommand('insertText', false, text)) { ed.value = text; ed.dispatchEvent(new Event('input', { bubbles: true })); }
    ed.scrollTop = keepTop;
  };
  src.sel = () => ({ a: ed.selectionStart, b: ed.selectionEnd, text: ed.value.slice(ed.selectionStart, ed.selectionEnd) });
  /* Indsæt en blok på en ny linje, indrykket som nuværende linje */
  src.insertBlock = function (text, caretIn) {
    const v = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    const indent = /^[ \t]*/.exec(v.slice(ls, a))[0];
    const lineEmptyBefore = v.slice(ls, a).trim() === '';
    const body = text.split('\n').map((l, i) => (i ? indent + l : l)).join('\n');
    const pre = lineEmptyBefore ? '' : '\n' + indent;
    const out = pre + body;
    src.replace(a, b, out);
    if (caretIn != null) { const p = a + pre.length + caretIn + (body.slice(0, caretIn).split('\n').length - 1) * indent.length; ed.setSelectionRange(p, p); }
  };
  /* Find ud af, om der er et <head>; indsæt kode før </head> (opret om nødvendigt) */
  src.headInsert = function (fragment) {
    const v = ed.value;
    const m = /<\/head\s*>/i.exec(v);
    if (m) {
      const ls = v.lastIndexOf('\n', m.index - 1) + 1;
      const indent = /^[ \t]*/.exec(v.slice(ls, m.index))[0];
      const line = v.slice(ls, m.index).trim() === '';
      const pad = line ? indent : '';
      const base = line ? ls : m.index;
      const inner = fragment.split('\n').map((l) => (l ? pad + '  ' + l : l)).join('\n');
      src.replace(base, base, (line ? '' : '\n') + inner + '\n' + (line ? '' : pad));
      return;
    }
    const h = /<head[^>]*>/i.exec(v);
    if (h) { const at = h.index + h[0].length; src.replace(at, at, '\n' + fragment + '\n'); return; }
    const hm = /<html[^>]*>/i.exec(v);
    if (hm) { const at = hm.index + hm[0].length; src.replace(at, at, '\n<head>\n' + fragment + '\n</head>'); return; }
    src.replace(0, 0, fragment + '\n');
  };
  /* Læg CSS i et <style id="…">-element i head (opret eller udvid) */
  src.styleBlock = function (id, css, mode) {
    const v = ed.value;
    const re = new RegExp('<style[^>]*\\sid=["\']' + id + '["\'][^>]*>([\\s\\S]*?)</style>', 'i');
    const m = re.exec(v);
    if (m) {
      const open = m[0].slice(0, m[0].indexOf('>') + 1);
      const start = m.index + open.length;
      const end = start + m[1].length;
      const inner = mode === 'replace' ? '\n' + css + '\n' : m[1].replace(/\s+$/, '') + '\n\n' + css + '\n';
      src.replace(start, end, inner);
      return;
    }
    src.headInsert('<style id="' + id + '">\n' + css + '\n</style>');
  };
  src.styleText = (id) => { const m = new RegExp('<style[^>]*\\sid=["\']' + id + '["\'][^>]*>([\\s\\S]*?)</style>', 'i').exec(ed.value); return m ? m[1] : ''; };
  src.hasStylesheet = (re) => re.test(ed.value);

  TN.docPath = () => TN.state.path;
  TN.localeStr = () => window.WDi18n.locale();
})();
