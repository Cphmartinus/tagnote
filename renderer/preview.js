/* TagNote – forhåndsvisning, visuel redigering og markering */
(function () {
  'use strict';
  const { $, $$, api, t, state, ed, esc } = TN;
  const wrap = $('#pvscroll'), stage = $('#stage'), inner = $('#stageInner'), selbox = $('#selbox'), selTag = $('#selTag'), crumbs = $('#crumbs');

  const token = Math.random().toString(36).slice(2, 10);
  let A = $('#pv');
  const B = A.cloneNode(false); B.id = 'pv2'; inner.append(B);
  let cur = A, other = B, seq = 0, busy = false, pending = false, scale = 1, commitT = 0, suppress = false, renderT = 0, dirtyVisual = false, renderDue = false;
  B.style.visibility = 'hidden';

  const offMode = () => state.js === 'off';
  const sandboxFor = (js) => (js === 'off' ? 'allow-same-origin' : 'allow-scripts');
  const activeDoc = () => { try { return offMode() ? cur.contentDocument : null; } catch (_) { return null; } };
  const activeWin = () => { try { return offMode() ? cur.contentWindow : null; } catch (_) { return null; } };

  /* ---------- hjælpescript, der kun lægges i "Til"-tilstand (rulleposition) ---------- */
  const HELPER = '<script data-tn-inject>(function(){addEventListener("message",function(e){if(e.data&&e.data.tn==="scroll")scrollTo(0,e.data.y)});var t;addEventListener("scroll",function(){clearTimeout(t);t=setTimeout(function(){parent.postMessage({tn:"scroll",y:scrollY},"*")},80)});})();<\/script>';
  const inject = (html) => (/<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, HELPER + '</body>') : html + HELPER);
  let lastY = 0;
  window.addEventListener('message', (e) => {
    if (e.source !== cur.contentWindow || !e.data || e.data.tn !== 'scroll') return;
    lastY = e.data.y || 0;
  });

  function load(frame, url) {
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; frame.onload = null; res(); };
      frame.onload = fin;
      setTimeout(fin, 10000);
      frame.src = url;
    });
  }

  async function renderOnce() {
    renderDue = false; clearTimeout(renderT);
    /* Ugemte rettelser fra visningen skrives til koden først, så de ikke går tabt */
    if (dirtyVisual) commit();
    const html = ed.value, js = state.js;
    let send = html, csp = js === 'off' ? "script-src 'none'; object-src 'none'" : '';
    if (js === 'known') {
      const urls = TN.fw ? TN.fw.knownScripts(html) : [];
      csp = "script-src " + (urls.length ? urls.join(' ') : "'none'");
    }
    if (js === 'on') send = inject(html);
    const url = await api.previewSet({ token, html: send, docPath: state.path, csp });
    if (!url) return;
    /* husk det markerede element, så markeringen bevares, når siden tegnes igen */
    let key = null;
    if (sel.el && sel.el.isConnected && activeDoc() && sel.el.ownerDocument === activeDoc()) { const tg = sel.el.tagName.toLowerCase(); key = { tag: tg, idx: Array.prototype.indexOf.call(activeDoc().querySelectorAll(tg), sel.el) }; }
    let y = 0;
    const w0 = activeWin(); if (w0) { try { y = w0.scrollY; } catch (_) {} } else y = lastY;
    other.setAttribute('sandbox', sandboxFor(js));
    await load(other, url + '?v=' + (++seq));
    /* Har man skrevet i visningen, mens den nye side blev indlæst, beholdes den gamle, og der tegnes igen */
    if (dirtyVisual) { pending = true; return; }
    if (offMode()) {
      try { other.contentWindow.scrollTo(0, y); } catch (_) {}
    } else if (js === 'on') { try { other.contentWindow.postMessage({ tn: 'scroll', y }, '*'); } catch (_) {} }
    other.style.visibility = 'visible'; cur.style.visibility = 'hidden';
    [cur, other] = [other, cur];
    try { cur.contentWindow.scrollTo(0, y); } catch (_) {}
    attach(key);
    updateNote();
    TN.hooks.rendered && TN.hooks.rendered();
  }

  async function render(force) {
    if (state.mode === 'raw' && !force) return;
    if (busy) { pending = true; return; }
    busy = true;
    try { do { pending = false; await renderOnce(); } while (pending); } finally { busy = false; }
  }
  function schedule(delay) {
    if (suppress) return;
    clearTimeout(renderT);
    renderDue = true;
    renderT = setTimeout(() => render(), delay != null ? delay : offMode() ? 220 : 700);
  }

  /* ---------- redigering i visningen ---------- */
  function attach(key) {
    const doc = activeDoc(), win = activeWin();
    if (!doc || !win) { TN.sel.clear(); return; }
    if (state.edit) {
      try { doc.designMode = 'on'; doc.execCommand('styleWithCSS', false, false); doc.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
    }
    doc.addEventListener('input', () => { dirtyVisual = true; scheduleCommit(); });
    doc.addEventListener('selectionchange', () => { if (state.edit) selectionChanged(); });
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', (e) => { if (TN.onKey && TN.onKey(e, 'preview')) return; });
    doc.addEventListener('contextmenu', onContext);
    doc.addEventListener('dblclick', (e) => { if (e.target.tagName === 'IMG' && TN.blocks) { e.preventDefault(); TN.sel.set(e.target); TN.blocks.changeImage(e.target); } });
    doc.addEventListener('mousedown', (e) => {
      TN.focusPane = 'preview';
      /* Koden er ændret, men visningen er ikke tegnet igen endnu: tegn den nu, så man ikke retter i en gammel udgave */
      if (renderDue && !dirtyVisual) { e.preventDefault(); render(); }
    });
    win.addEventListener('scroll', positionSelBox);
    win.addEventListener('resize', positionSelBox);
    // Genfind markeringen i det nye dokument: samme element som før, ellers ud fra kodens markør
    if (sel.el && sel.el.ownerDocument !== doc) { sel.el = null; selbox.hidden = true; crumbs.innerHTML = ''; if (TN.hooks.boxMoved) TN.hooks.boxMoved(null); }
    const again = key && key.idx >= 0 ? doc.querySelectorAll(key.tag)[key.idx] : null;
    if (again) { sel.el = again; positionSelBox(); renderCrumbs(); fire(); }
    else if (TN.sel.fromSourceOnRender && TN.focusPane !== 'preview') TN.sel.fromSource();
  }

  function onClick(e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && (e.ctrlKey || e.metaKey || !state.edit)) { e.preventDefault(); openLink(a.getAttribute('href')); return; }
    if (a || !state.edit) e.preventDefault();
    TN.sel.set(e.target, 'preview');
    if (state.edit) setTimeout(selectionChanged, 0);
  }
  async function openLink(href) {
    if (!href) return;
    if (href[0] === '#') { const d = activeDoc(); const el = d && d.getElementById(decodeURIComponent(href.slice(1))); if (el) el.scrollIntoView(); return; }
    if (/^(https?:|mailto:)/i.test(href)) { api.openExternal(href); return; }
    if (state.path && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      const base = state.path.replace(/[\\/][^\\/]*$/, '');
      const rel = decodeURIComponent(href.split('#')[0].split('?')[0]);
      if (/\.(html?|xhtml)$/i.test(rel)) { const sep = state.path.includes('\\') ? '\\' : '/'; TN.openPath && TN.openPath(base + sep + rel.replace(/\//g, sep)); }
    }
  }
  if (api.onPreviewNavigate) api.onPreviewNavigate((file) => { if (TN.openPath) TN.openPath(file); });


  /* ---------- tilbage til kildekoden ---------- */
  function serialize(doc, original) {
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll('[data-tn-inject]').forEach((n) => n.remove());
    const isFull = /<html[\s>]|<!doctype|<head[\s>]|<body[\s>]/i.test(original);
    let out;
    if (isFull) {
      out = clone.outerHTML;
      const dt = /^\s*(<!doctype[^>]*>)/i.exec(original);
      out = (dt ? dt[1] + '\n' : '') + out;
    } else {
      const head = clone.querySelector('head'), body = clone.querySelector('body');
      out = (head ? head.innerHTML.trim() : '');
      if (out) out += '\n';
      out += body ? body.innerHTML : '';
    }
    if (/\n$/.test(original) && !/\n$/.test(out)) out += '\n';
    return out;
  }
  function scheduleCommit() { dirtyVisual = true; clearTimeout(commitT); commitT = setTimeout(commit, 350); }
  /* Skriver visningens indhold tilbage til koden, men kun hvis der er rettet i visningen.
     Ellers kunne en visning, der endnu ikke er tegnet igen, overskrive nye ændringer i koden. */
  function commit(force) {
    clearTimeout(commitT);
    if (!dirtyVisual && !force) return false;
    dirtyVisual = false;
    const doc = activeDoc(); if (!doc) return false;
    const text = serialize(doc, ed.value);
    if (text === ed.value) return false;
    const hadFocus = document.activeElement === cur; // man skriver i siden: behold fokus der
    suppress = true;
    try { TN.src.setAll(text); } finally { suppress = false; }
    ed.blur();
    if (hadFocus) { try { cur.focus(); cur.contentWindow.focus(); } catch (_) {} }
    return true;
  }

  /* ---------- markering (valgt element) ---------- */
  const sel = (TN.sel = { el: null, fromSourceOnRender: true });
  sel.refresh = () => { positionSelBox(); renderCrumbs(); };
  sel.forget = () => { sel.el = null; selbox.hidden = true; crumbs.innerHTML = ''; if (TN.hooks.boxMoved) TN.hooks.boxMoved(null); };
  sel.clear = () => { sel.el = null; selbox.hidden = true; crumbs.innerHTML = ''; if (TN.hooks.boxMoved) TN.hooks.boxMoved(null); fire(); };
  sel.set = (el, from) => {
    if (!el || el.nodeType !== 1) return;
    const doc = activeDoc();
    if (!doc || el.ownerDocument !== doc) return;
    if (el === doc.documentElement) el = doc.body || el;
    sel.el = el;
    positionSelBox(); renderCrumbs(); fire();
    if (from === 'preview' && TN.map) TN.map.revealInSource(el);
  };
  sel.parent = () => { const p = sel.el && sel.el.parentElement; if (p && p !== p.ownerDocument.documentElement) sel.set(p, 'preview'); };
  const fire = () => { for (const f of TN.hooks.onSelect || []) try { f(sel.el); } catch (_) {} };
  function selectionChanged() {
    const doc = activeDoc(); if (!doc) return;
    const s = doc.getSelection(); let n = s && s.anchorNode; if (!n) return;
    if (n.nodeType === 3) n = n.parentElement;
    if (n && n !== sel.el) sel.set(n, 'preview');
  }
  sel.fromSource = () => {
    const doc = activeDoc(); if (!doc || !TN.map) return;
    const info = TN.map.elementAt(ed.value, ed.selectionStart, doc);
    if (info && info !== sel.el) { sel.el = info; positionSelBox(); renderCrumbs(); fire(); }
  };

  function labelOf(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
    if (c.length) s += '.' + c.slice(0, 2).join('.') + (c.length > 2 ? '…' : '');
    return s;
  }
  TN.labelOf = labelOf;
  /* I Enkel vises venlige navne (Knap, Overskrift …) i stedet for tags og klasser */
  const simple = () => TN.level && TN.level() === 'simple';
  const nameOf = (el) => (simple() && TN.friendly ? TN.friendly(el) : labelOf(el));
  function positionSelBox() {
    const el = sel.el, doc = activeDoc();
    if (!el || !doc || !el.isConnected || state.mode === 'raw') { selbox.hidden = true; if (TN.hooks.boxMoved) TN.hooks.boxMoved(null); return; }
    const r = el.getBoundingClientRect(), fr = cur.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    /* rammen klippes til den synlige del af siden */
    const fx0 = fr.left - wr.left, fy0 = fr.top - wr.top, fx1 = fx0 + fr.width, fy1 = fy0 + fr.height;
    const x0 = Math.max(fx0, fx0 + r.left * scale), y0 = Math.max(fy0, fy0 + r.top * scale);
    const x1 = Math.min(fx1, fx0 + r.right * scale), y1 = Math.min(fy1, fy0 + r.bottom * scale);
    if (x1 - x0 < 1 || y1 - y0 < 1) { selbox.hidden = true; if (TN.hooks.boxMoved) TN.hooks.boxMoved(null); return; }
    selbox.hidden = false;
    Object.assign(selbox.style, { left: x0 + 'px', top: y0 + 'px', width: Math.max(2, x1 - x0) + 'px', height: Math.max(2, y1 - y0) + 'px' });
    selTag.textContent = nameOf(el);
    selbox.classList.toggle('flip', y0 - fy0 < 22);
    if (TN.hooks.boxMoved) TN.hooks.boxMoved({ left: parseFloat(selbox.style.left), top: parseFloat(selbox.style.top), width: parseFloat(selbox.style.width), height: parseFloat(selbox.style.height) }, el);
  }
  function renderCrumbs() {
    crumbs.innerHTML = '';
    const el = sel.el; if (!el) return;
    const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
    if (simple()) { while (chain.length && /^(HTML|HEAD)$/.test(chain[0].tagName)) chain.shift(); }
    const shown = chain.length > 9 ? [chain[0], null, ...chain.slice(-7)] : chain;
    shown.forEach((n, i) => {
      if (i) crumbs.append(Object.assign(document.createElement('span'), { className: 'cr-sep', textContent: '›' }));
      if (!n) { crumbs.append(Object.assign(document.createElement('span'), { className: 'cr-sep', textContent: '…' })); return; }
      const b = document.createElement('button'); b.className = 'cr' + (n === el ? ' on' : ''); b.textContent = nameOf(n); if (simple()) b.title = labelOf(n);
      b.onclick = () => sel.set(n, 'preview');
      crumbs.append(b);
    });
  }

  /* ---------- højreklik i visningen ---------- */
  function onContext(e) {
    e.preventDefault();
    const doc = activeDoc(); if (!doc) return;
    const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (el) sel.set(el, 'preview');
    const fr = cur.getBoundingClientRect();
    const a = { getBoundingClientRect: () => ({ left: fr.left + e.clientX * scale, bottom: fr.top + e.clientY * scale, top: fr.top + e.clientY * scale, right: fr.left + e.clientX * scale }) };
    const hasSel = !doc.getSelection().isCollapsed;
    const simpleMenu = TN.level && TN.level() === 'simple';
    const items = [
      { label: 'Klip', icon: 'cut', hint: 'Ctrl+X', disabled: !hasSel, onClick: () => { cur.contentWindow.focus(); doc.execCommand('cut'); } },
      { label: 'Kopiér', icon: 'copy', hint: 'Ctrl+C', disabled: !hasSel, onClick: () => { cur.contentWindow.focus(); doc.execCommand('copy'); } },
      { label: 'Indsæt som ren tekst', icon: 'pastetext', onClick: async () => { const r = await api.readClipboard(); if (r && r.text) { cur.contentWindow.focus(); doc.execCommand('insertText', false, r.text); } } },
      '-',
      { label: 'Fed', icon: 'bold', hint: 'Ctrl+B', onClick: () => TN.cmds.bold && TN.cmds.bold() },
      { label: 'Link…', icon: 'link', hint: 'Ctrl+K', onClick: () => TN.cmds.link && TN.cmds.link() },
      '-',
      { label: simpleMenu ? 'Markér det, der er omkring' : 'Vælg overordnet element', icon: 'up', onClick: () => sel.parent() },
      { label: simpleMenu ? 'Kopiér' : 'Dublér element', icon: 'copy', onClick: () => TN.elOps.duplicate() },
      { label: 'Flyt op', icon: 'up', onClick: () => TN.elOps.move(-1) },
      { label: 'Flyt ned', icon: 'down', onClick: () => TN.elOps.move(1) },
      { label: simpleMenu ? 'Slet' : 'Fjern element', icon: 'trash', onClick: () => TN.elOps.remove() },
      '-',
      simpleMenu ? { label: 'Udseende…', icon: 'sliders', onClick: () => TN.look && TN.look.toggle(true) } : { label: 'Stilpanel…', icon: 'sliders', onClick: () => TN.cmds.inspector && TN.cmds.inspector(true) },
      ...(simpleMenu ? [] : [{ label: 'Vis i koden', icon: 'raw', onClick: () => TN.map && sel.el && TN.map.revealInSource(sel.el, true) }]),
    ];
    TN.popMenu(a, items);
  }

  /* ---------- operationer på elementer ---------- */
  TN.elOps = {
    duplicate() { const el = sel.el; if (!el || /^(HTML|BODY|HEAD)$/.test(el.tagName)) return; const c = el.cloneNode(true); el.after(c); sel.set(c); commit(true); },
    move(d) { const el = sel.el; if (!el) return; const sib = d < 0 ? el.previousElementSibling : el.nextElementSibling; if (!sib) return; if (d < 0) sib.before(el); else sib.after(el); positionSelBox(); commit(true); },
    remove() { const el = sel.el; if (!el || /^(HTML|BODY|HEAD)$/.test(el.tagName)) return; const p = el.parentElement; el.remove(); sel.set(p); commit(true); },
    setClass(cls) { const el = sel.el; if (!el) return; if (cls) el.setAttribute('class', cls); else el.removeAttribute('class'); commit(true); positionSelBox(); renderCrumbs(); fire(); },
    setAttr(name, val) { const el = sel.el; if (!el) return; if (val == null || val === '') el.removeAttribute(name); else el.setAttribute(name, val); commit(true); positionSelBox(); renderCrumbs(); fire(); },
  };

  /* ---------- formatering i visningen ---------- */
  function exec(cmd, val) {
    const doc = activeDoc(); if (!doc || !state.edit) return false;
    cur.contentWindow.focus();
    const ok = doc.execCommand(cmd, false, val);
    dirtyVisual = true; scheduleCommit();
    return ok;
  }
  const insertHtml = (html) => exec('insertHTML', html);
  const queryState = (cmd) => { const doc = activeDoc(); try { return doc ? doc.queryCommandState(cmd) : false; } catch (_) { return false; } };
  const queryValue = (cmd) => { const doc = activeDoc(); try { return doc ? doc.queryCommandValue(cmd) : ''; } catch (_) { return ''; } };

  /* ---------- skærmbredde og layout ---------- */
  function layout() {
    const bw = wrap.clientWidth, bh = wrap.clientHeight, W = state.width;
    if (!W) { Object.assign(inner.style, { width: '100%', height: '100%', transform: 'none' }); Object.assign(stage.style, { width: '100%', height: '100%', margin: '0' }); stage.classList.remove('device'); scale = 1; }
    else {
      scale = Math.min(1, (bw - 40) / W);
      const h = bh - 40;
      Object.assign(inner.style, { width: W + 'px', height: h / scale + 'px', transform: 'scale(' + scale + ')' });
      Object.assign(stage.style, { width: W * scale + 'px', height: h + 'px', margin: '20px auto' });
      stage.classList.add('device');
    }
    $('#pvInfo').textContent = W ? t('{0} px bred', W) + (scale < 1 ? ' · ' + Math.round(scale * 100) + ' %' : '') : t('Fuld bredde');
    positionSelBox();
  }
  window.addEventListener('resize', layout);
  new ResizeObserver(layout).observe(wrap);

  function updateNote() {
    const n = $('#pvNote');
    if (state.js === 'off') { n.hidden = true; return; }
    n.hidden = false;
    n.textContent = state.js === 'known' ? t('Kun kendte scripts kører · visuel redigering er slået fra') : t('JavaScript er slået til · visuel redigering er slået fra');
  }

  $('#pvReload').onclick = () => render(true);

  TN.preview = {
    render, schedule, commit, exec, insertHtml, queryState, queryValue, layout, updateNote, positionSelBox, attach,
    doc: activeDoc, win: activeWin, scheduleCommit,
    /* venter, til visningen er tegnet færdig */
    whenIdle: () => new Promise((res) => { const chk = () => (busy || renderDue ? setTimeout(chk, 40) : res()); chk(); }),
    frame: () => cur,
    suppress: (v) => { suppress = v; },
    setEdit(on) {
      state.edit = on;
      const doc = activeDoc(); if (doc) { try { doc.designMode = on ? 'on' : 'off'; } catch (_) {} }
    },
    scrollRatio(r) {
      const w = activeWin(), d = activeDoc(); if (!w || !d) return;
      const max = d.documentElement.scrollHeight - w.innerHeight;
      if (max > 0) w.scrollTo(0, r * max);
    },
    focusPane() { const w = activeWin(); if (w) w.focus(); },
  };
})();
