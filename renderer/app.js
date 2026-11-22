/* TagNote – hovedprogram */
(function () {
  'use strict';
  const { $, $$, api, t, state, ed, esc, el, store } = TN;
  const hl = TN.hl;
  const workspace = $('#workspace');
  const loc = () => window.WDi18n.locale();
  const I18N = window.WDi18n;

  /* ======================= farvemarkering + statistik ======================= */
  let rT = 0;
  function onChange() {
    hl.innerHTML = TN.highlight(ed.value) + '\n';
    syncScroll(); updateDirty(); updateStats();
    TN.preview.schedule();
    if (TN.fw) TN.fw.detectSoon();
    if (!$('#nav').hidden) { clearTimeout(rT); rT = setTimeout(buildNav, 300); }
  }
  const syncScroll = () => { hl.scrollTop = ed.scrollTop; hl.scrollLeft = ed.scrollLeft; };
  ed.addEventListener('input', onChange);
  let scrollRaf = 0;
  ed.addEventListener('scroll', () => {
    syncScroll();
    if (state.mode === 'split' && $('#optSync').checked && TN.focusPane !== 'preview') {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => { const max = ed.scrollHeight - ed.clientHeight; if (max > 0) TN.preview.scrollRatio(ed.scrollTop / max); });
    }
  });
  ed.addEventListener('focus', () => { TN.focusPane = 'ed'; });

  function updateStats() {
    const text = TN.toPlainText ? ed.value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/g, ' ') : ed.value;
    const words = (text.trim().match(/\S+/g) || []).length;
    $('#stWords').textContent = t('{0} ord', words.toLocaleString(loc()));
    $('#stChars').textContent = t('{0} tegn i koden', ed.value.length.toLocaleString(loc()));
  }
  let posT = 0;
  function updatePos() {
    const a = ed.selectionStart, before = ed.value.slice(0, a);
    const ln = before.split('\n').length, col = a - before.lastIndexOf('\n');
    const sel = ed.selectionEnd - a;
    $('#stPos').textContent = t('Ln {0}, Kol {1}', ln, col) + (sel ? ' ' + t('({0} valgt)', sel) : '');
    clearTimeout(posT);
    posT = setTimeout(() => {
      const p = TN.map.pathAt(ed.value, a);
      $('#stPath').textContent = p.slice(-5).join(' › ');
      if (TN.focusPane !== 'preview') { TN.sel.fromSource(); if (state.mode === 'raw') TN.fw && TN.fw.refresh(); }
      updateBlockSel();
    }, 90);
  }
  ['keyup', 'click', 'select', 'focus'].forEach((ev) => ed.addEventListener(ev, updatePos));
  ed.addEventListener('mouseup', () => { TN.focusPane = 'ed'; });

  /* ======================= titel / dirty ======================= */
  const docName = () => (state.path ? state.path.split(/[\\/]/).pop() : state.untitled);
  const isDirty = () => ed.value !== state.saved;
  function updateDirty() {
    const d = isDirty();
    const full = docName() + (d ? ' *' : '') + ' – TagNote';
    document.title = full; $('#doctitle').textContent = full;
    $('#savedState').textContent = d ? t('Ikke gemt') : state.path ? t('Gemt') : '';
    renderTabs();
  }

  /* ======================= filer ======================= */
  function loadDoc(content, path) {
    ed.value = content; state.path = path || null; state.saved = content; state.lastSnap = content;
    ed.scrollTop = 0; ed.setSelectionRange(0, 0);
    state.js = path ? store.get('js:' + path, 'off') : 'off';
    applyJs(state.js, true);
    onChange(); updatePos(); buildNav();
    TN.preview.render(true);
  }
  async function confirmDiscard() {
    if (!isDirty()) return true;
    const r = await api.confirm({ message: t('Vil du gemme ændringerne i "{0}"?', docName()), detail: t('Dine ændringer går tabt, hvis du ikke gemmer dem.'), buttons: [t('Gem'), t('Gem ikke'), t('Annuller')] });
    if (r === 0) return await save(false);
    if (r === 1) { snapshot(true); return true; }
    return false;
  }
  async function save(as) {
    TN.preview.commit();
    const r = await api.saveFile({ path: state.path, content: ed.value, saveAs: !!as, suggested: state.untitled });
    if (!r) return false;
    if (r.error) { TN.toast(t('Kunne ikke gemme: {0}', r.error), 5000); return false; }
    const was = state.path; state.path = r.path; state.saved = ed.value;
    if (was !== r.path) { store.set('js:' + r.path, state.js); TN.preview.render(true); }
    updateDirty(); snapshot(true); TN.toast(t('Gemt'));
    return true;
  }
  TN.docPath = () => state.path;

  /* ---------- dokumentfaner ---------- */
  let nextId = 1, untitledN = 1; const docs = []; let curId = 0;
  const newDoc = () => ({ id: nextId++, path: null, untitled: t('Side') + untitledN, untitledNo: untitledN++, text: '', saved: '', lastSnap: '', sel: [0, 0], scroll: 0, js: 'off' });
  const current = () => docs.find((d) => d.id === curId);
  function stash() { const d = current(); if (!d) return; Object.assign(d, { path: state.path, untitled: state.untitled, untitledNo: state.untitledNo, saved: state.saved, lastSnap: state.lastSnap, text: ed.value, sel: [ed.selectionStart, ed.selectionEnd], scroll: ed.scrollTop, js: state.js }); }
  function restore(d) {
    curId = d.id; Object.assign(state, { path: d.path, untitled: d.untitled, untitledNo: d.untitledNo, saved: d.saved, lastSnap: d.lastSnap, js: d.js || 'off' });
    ed.value = d.text; applyJs(state.js, true); onChange(); buildNav(); ed.scrollTop = d.scroll;
    try { ed.setSelectionRange(d.sel[0], d.sel[1]); } catch (_) {}
    syncScroll(); updatePos(); updateDirty(); TN.preview.render(true);
    if (state.mode !== 'read') ed.focus();
  }
  const docDirty = (d) => (d.id === curId ? isDirty() : d.text !== d.saved);
  const docLabel = (d) => (d.id === curId ? docName() : d.path ? d.path.split(/[\\/]/).pop() : d.untitled);
  function activate(id) { if (id === curId) return; const d = docs.find((x) => x.id === id); if (!d) return; stash(); restore(d); }
  function newTab(text) { stash(); const d = newDoc(); docs.push(d); restore(d); if (text != null) { loadDoc(text, null); } return d; }
  const isPristine = () => !state.path && ed.value === state.saved && (ed.value === '' || ed.value === WELCOME);
  function openInTab(content, path) {
    const existing = path && (docs.find((d) => d.id !== curId && d.path === path) || (state.path === path ? current() : null));
    if (existing) { activate(existing.id); return false; }
    if (!isPristine()) newTab();
    loadDoc(content, path);
    return true;
  }
  function renderTabs() {
    const box = $('#doctabs'); if (!box) return; box.innerHTML = '';
    for (const d of docs) {
      const tab = document.createElement('div'); tab.className = 'dtab' + (d.id === curId ? ' active' : '');
      const full = d.id === curId ? state.path : d.path; tab.title = full || docLabel(d);
      const n = document.createElement('span'); n.className = 'dn'; n.textContent = docLabel(d);
      const dirty = docDirty(d);
      const x = document.createElement('button'); x.className = 'dx'; x.title = t('Luk fane') + ' (Ctrl+W)'; x.textContent = dirty ? '●' : '✕'; if (dirty) x.classList.add('dirty');
      x.onclick = (e) => { e.stopPropagation(); closeTab(d.id); };
      tab.onmousedown = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(d.id); } };
      tab.onclick = () => activate(d.id);
      tab.append(n, x); box.append(tab);
    }
    const plus = document.createElement('button'); plus.className = 'dplus'; plus.title = t('Nyt dokument') + ' (Ctrl+N)'; plus.textContent = '+'; plus.onclick = () => newTab();
    box.append(plus);
    const a = box.querySelector('.dtab.active'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  async function closeTab(id) {
    const d = docs.find((x) => x.id === id); if (!d) return false;
    if (docDirty(d)) { activate(id); if (!(await confirmDiscard())) return false; }
    const i = docs.findIndex((x) => x.id === id); docs.splice(i, 1);
    if (!docs.length) { const nd = newDoc(); docs.push(nd); curId = -1; restore(nd); return true; }
    if (id === curId) { const next = docs[Math.min(i, docs.length - 1)]; curId = -1; restore(next); } else renderTabs();
    return true;
  }
  const switchBy = (n) => { if (docs.length < 2) return; const i = docs.findIndex((x) => x.id === curId); activate(docs[(i + n + docs.length) % docs.length].id); };
  async function confirmAllDocs() {
    stash();
    for (const d of docs.slice()) { if (d.text !== d.saved) { activate(d.id); if (!(await confirmDiscard())) return false; } }
    return true;
  }
  function applyOpened(r) {
    if (!r) return;
    if (r.error) { TN.toast(t('Kunne ikke åbne: {0}', r.error), 5000); return; }
    openInTab(r.content, r.path);
    if (r.converted) TN.toast(t('Filen var ikke gemt som UTF-8 og er konverteret. Gem for at beholde ændringen.'), 6000);
  }
  async function cmdOpen() { applyOpened(await api.openFile()); }
  async function openPath(p) { applyOpened(await api.readFile(p)); }
  TN.openPath = openPath;
  async function snapshot(quiet) {
    const text = ed.value;
    if (!text.trim() || text === state.lastSnap) { if (!quiet) TN.toast(t('Ingen ændringer siden sidste snapshot')); return; }
    const id = await api.snapSave({ key: state.path || 'untitled', content: text });
    if (id) { state.lastSnap = text; if (!quiet) TN.toast(t('Snapshot gemt')); }
  }
  setInterval(() => { if (isDirty()) snapshot(true); }, 60000);

  /* ======================= JavaScript-tilstand ======================= */
  const JS_LABEL = { off: 'Slukket', known: 'Kendte', on: 'Tændt' };
  function applyJs(mode, silent) {
    state.js = mode;
    $$('#jsSeg button').forEach((b) => b.classList.toggle('on', b.dataset.js === mode));
    $('#stJs').textContent = t('JS: {0}', t(JS_LABEL[mode])); $('#stJs').classList.toggle('warn', mode !== 'off');
    $('#optEdit').disabled = mode !== 'off';
    $('#optJsFile').checked = !!(state.path && store.get('jsfile:' + state.path, false));
    if (!silent) TN.preview.render(true);
    TN.preview.updateNote();
    if (TN.inspector) TN.inspector.refresh();
    if (TN.sel && mode !== 'off') TN.sel.clear();
  }
  async function setJs(mode) {
    if (mode === state.js) return;
    if (mode === 'on' && !store.get('jsWarned', false)) {
      const body = el('div'); body.innerHTML = '<p>' + esc(t('Med JavaScript til kører alle scripts i siden. En side fra en andens hånd kan indeholde kode, der gør noget, du ikke forventer, fx at hente indhold fra internettet.')) + '</p><p>' + esc(t('Siden kører stadig i en isoleret ramme uden adgang til dine filer eller til programmet. Visuel redigering og stilpanelet er slået fra, mens JavaScript er til.')) + '</p>';
      const ok = await TN.modal({ title: t('Slå JavaScript til i visningen?'), body, buttons: [{ text: t('Annuller') }, { text: t('Slå til'), primary: true, value: () => true }] });
      if (!ok) return;
      store.set('jsWarned', true);
    }
    applyJs(mode);
    if (state.path && $('#optJsFile').checked) store.set('js:' + state.path, mode);
    if (mode === 'on') TN.toast(t('JavaScript er slået til i visningen.'));
  }
  $$('#jsSeg button').forEach((b) => (b.onclick = () => setJs(b.dataset.js)));
  $('#stJs').onclick = () => setJs({ off: 'known', known: 'on', on: 'off' }[state.js]);
  $('#optJsFile').addEventListener('change', (e) => { if (!state.path) { e.target.checked = false; TN.toast(t('Gem filen først.')); return; } store.set('jsfile:' + state.path, e.target.checked); store.set('js:' + state.path, e.target.checked ? state.js : 'off'); });

  /* ======================= tilstande, bredde, temaer, zoom ======================= */
  function setMode(m) {
    state.mode = m; store.set('mode', m);
    workspace.className = 'mode-' + m;
    $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    if (m !== 'raw') { TN.focusPane = m === 'read' ? 'preview' : TN.focusPane; TN.preview.render(true); TN.preview.layout(); }
    if (m === 'read') { TN.preview.focusPane(); TN.focusPane = 'preview'; } else ed.focus();
    if (TN.inspector) TN.inspector.refresh();
  }
  TN.setMode = setMode;
  function setWidth(w) {
    state.width = +w || 0; store.set('width', state.width);
    $$('.dev').forEach((b) => b.classList.toggle('on', +b.dataset.w === state.width));
    if (state.width) $('#devW').value = state.width;
    TN.preview.layout();
    if (state.mode === 'raw') setMode('split');
  }
  TN.setWidth = setWidth;
  $$('.dev').forEach((b) => (b.onclick = () => setWidth(b.dataset.w)));
  $('#devW').addEventListener('change', (e) => setWidth(Math.max(240, Math.min(3000, +e.target.value || 1024))));
  function setTheme(th) {
    state.theme = th; store.set('theme', th); document.documentElement.dataset.theme = th;
    $$('[data-set-theme]').forEach((b) => b.classList.toggle('on', b.dataset.setTheme === th));
    if (api.setOverlay) { const cs = getComputedStyle(document.documentElement); api.setOverlay({ color: cs.getPropertyValue('--chrome').trim() || '#2b579a', symbol: cs.getPropertyValue('--chrome-text').trim() || '#ffffff' }); }
  }
  function setZoom(z) {
    z = Math.min(200, Math.max(60, z)); workspace.style.setProperty('--zoom', z / 100);
    $('#zoom').value = $('#zoom2').value = z; $('#zoomVal').textContent = $('#zoomVal2').textContent = z + ' %'; store.set('zoom', z);
    TN.preview.layout();
  }
  function setWrap(on) { ed.wrap = on ? 'soft' : 'off'; hl.style.whiteSpace = on ? 'pre-wrap' : 'pre'; store.set('wrap', on); syncScroll(); }
  function showTab(name) {
    TN.curTab = name;
    $$('.tab[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === 'file') loadRecent();
    if (!/^fw-/.test(name)) store.set('tab', name);
  }
  TN.showTab = showTab;
  function toggleRibbon(force) {
    const r = $('#ribbon'); const c = force === undefined ? !r.classList.contains('collapsed') : force;
    r.classList.toggle('collapsed', c); $('#collapseBtn svg').style.transform = c ? 'rotate(180deg)' : ''; store.set('collapsed', c); setTimeout(TN.preview.layout, 30);
  }
  async function loadRecent() {
    const box = $('#recentList'); const list = (api.recent && (await api.recent())) || []; box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<span class="muted">' + esc(t('Ingen seneste filer')) + '</span>'; return; }
    for (const p of list.slice(0, 8)) { const b = document.createElement('button'); b.textContent = p; b.title = p; b.onclick = () => openPath(p); box.append(b); }
  }

  /* ======================= disposition ======================= */
  function buildNav() {
    if ($('#nav').hidden) return;
    const items = TN.outline(ed.value); const list = $('#navList'); list.innerHTML = '';
    if (!items.length) { list.append(Object.assign(el('div', 'empty'), { textContent: t('Ingen overskrifter eller sektioner') })); return; }
    for (const it of items) {
      const a = document.createElement('a'); a.href = '#';
      a.innerHTML = '<i class="nt ' + (it.h ? 'h' : 'l') + '">' + esc(it.h ? 'H' + it.h : it.tag) + '</i>' + esc(it.label || (it.h ? t('(tom)') : ''));
      a.style.paddingLeft = 10 + it.depth * 12 + 'px'; if (it.h && it.h <= 2) a.style.fontWeight = '600';
      a.onclick = (e) => {
        e.preventDefault();
        const r = TN.map.rangeOf(ed.value, it.tag, it.idx);
        if (r) { ed.setSelectionRange(r.start, r.openEnd); TN.map.scrollToOffset(r.start); }
        const d = TN.preview.doc();
        if (d) { const list2 = d.querySelectorAll(it.tag); const target = list2[it.idx]; if (target) { target.scrollIntoView({ block: 'start' }); TN.sel.set(target); } }
      };
      list.append(a);
    }
  }

  /* ======================= find og erstat ======================= */
  const fi = $('#findIn');
  function reFind() { let s = fi.value; if (!s) return null; if (!$('#fRegex').checked) s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if ($('#fWord').checked) s = '\\b' + s + '\\b'; try { return new RegExp(s, 'gm' + ($('#fCase').checked ? '' : 'i')); } catch (_) { return false; } }
  function matches() { const re = reFind(); if (!re) return re; const out = []; let m; const v = ed.value; while ((m = re.exec(v)) && out.length < 50000) { if (m[0] === '') { re.lastIndex++; continue; } out.push({ i: m.index, len: m[0].length }); } return out; }
  function updateCount() { const m = matches(); $('#fCount').textContent = m === false ? t('Ugyldigt udtryk') : m ? (m.length ? t('{0} fundet', m.length) : t('Ingen resultater')) : ''; return m; }
  function ensureSource() { if (state.mode === 'read') setMode('split'); }
  function gotoMatch(m) { ensureSource(); ed.focus(); ed.setSelectionRange(m.i, m.i + m.len); TN.map.scrollToOffset(m.i); updatePos(); }
  function findNext(dir = 1) {
    if (!fi.value) { openFind(false); return; }
    const m = updateCount(); if (!m || !m.length) return;
    const a = ed.selectionStart, b = ed.selectionEnd; let x;
    if (dir > 0) x = m.find((q) => q.i >= b) || m[0]; else x = [...m].reverse().find((q) => q.i < a) || m[m.length - 1];
    gotoMatch(x);
  }
  function openFind(withReplace) { ensureSource(); $('#findbar').hidden = false; $('#replaceRow').hidden = !withReplace; const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd); if (sel && !sel.includes('\n')) fi.value = sel; fi.focus(); fi.select(); updateCount(); }
  function closeFind() { $('#findbar').hidden = true; ed.focus(); }
  function replaceOne() {
    const re = reFind(); if (!re) return; const a = ed.selectionStart, b = ed.selectionEnd, sel = ed.value.slice(a, b);
    const one = new RegExp(re.source, re.flags.replace('g', '')); const mm = one.exec(sel);
    if (mm && mm[0] === sel && sel) { const rep = $('#fRegex').checked ? sel.replace(one, $('#replIn').value) : $('#replIn').value; TN.src.replace(a, b, rep, a, a + rep.length); }
    findNext(1);
  }
  function replaceAll() {
    const re = reFind(); if (!re) return; const m = matches(); if (!m || !m.length) return; const rv = $('#replIn').value;
    TN.src.setAll(ed.value.replace(re, $('#fRegex').checked ? rv : () => rv)); ed.setSelectionRange(0, 0);
    TN.toast(t('{0} forekomster erstattet', m.length)); updateCount();
  }
  fi.addEventListener('input', updateCount);
  fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); } });
  $('#replIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } });
  ['fRegex', 'fCase', 'fWord'].forEach((id) => $('#' + id).addEventListener('change', updateCount));
  $('#fNext').onclick = () => findNext(1); $('#fPrev').onclick = () => findNext(-1); $('#fRepl').onclick = replaceOne; $('#fReplAll').onclick = replaceAll; $('#fClose').onclick = closeFind;

  /* ======================= formatering (kode eller visning) ======================= */
  const visual = () => state.mode !== 'raw' && TN.focusPane === 'preview' && !!TN.preview.doc() && state.edit;
  function wrapSrc(open, close, ph) {
    const v = ed.value, a = ed.selectionStart, b = ed.selectionEnd, tag = /^<(\w+)/.exec(open)[1];
    const sel = v.slice(a, b);
    // fjern mærket, hvis markeringen allerede er omsluttet
    const before = v.slice(Math.max(0, a - open.length), a), after = v.slice(b, b + close.length);
    if (before === open && after === close) { TN.src.replace(a - open.length, b + close.length, sel, a - open.length, a - open.length + sel.length); return; }
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) { const inner = sel.slice(open.length, sel.length - close.length); TN.src.replace(a, b, inner, a, a + inner.length); return; }
    const text = sel || ph || '';
    TN.src.replace(a, b, open + text + close, a + open.length, a + open.length + text.length);
  }
  function mapLines(fn) {
    const v = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
    const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', b); if (le < 0) le = v.length;
    const lines = v.slice(ls, le).split('\n'); const out = fn(lines).join('\n');
    TN.src.replace(ls, le, out, ls, ls + out.length);
  }
  function setBlockSrc(tag) {
    mapLines((lines) => {
      const ind = /^\s*/.exec(lines[0])[0];
      const body = lines.map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^<(p|h[1-6]|div)(?:\s[^>]*)?>([\s\S]*)<\/\1>$/i, '$2'));
      if (!body.length) body.push(tag === 'div' ? '' : t('Tekst'));
      return body.map((l) => ind + '<' + tag + '>' + l + '</' + tag + '>');
    });
  }
  function listSrc(kind) {
    mapLines((lines) => {
      const ind = /^\s*/.exec(lines[0])[0]; const body = lines.map((l) => l.trim()).filter(Boolean);
      if (!body.length) body.push(t('Punkt'));
      return [ind + '<' + kind + '>', ...body.map((l) => ind + '  ' + (/^<li[\s>]/i.test(l) ? l : '<li>' + l + '</li>')), ind + '</' + kind + '>'];
    });
  }
  function styleMerge(prop, val) {
    const cur = TN.target.getAttr('style'); const d = cur.split(';').map((s) => s.trim()).filter(Boolean).filter((s) => s.split(':')[0].trim() !== prop);
    if (val) d.push(prop + ': ' + val); TN.target.setAttr('style', d.join('; ') + (d.length ? ';' : ''));
  }
  const F = {
    bold: () => (visual() ? TN.preview.exec('bold') : wrapSrc('<strong>', '</strong>', t('tekst'))),
    italic: () => (visual() ? TN.preview.exec('italic') : wrapSrc('<em>', '</em>', t('tekst'))),
    underline: () => (visual() ? TN.preview.exec('underline') : wrapSrc('<u>', '</u>', t('tekst'))),
    strike: () => (visual() ? TN.preview.exec('strikeThrough') : wrapSrc('<s>', '</s>', t('tekst'))),
    sub: () => (visual() ? TN.preview.exec('subscript') : wrapSrc('<sub>', '</sub>', '2')),
    sup: () => (visual() ? TN.preview.exec('superscript') : wrapSrc('<sup>', '</sup>', '2')),
    ul: () => (visual() ? TN.preview.exec('insertUnorderedList') : listSrc('ul')),
    ol: () => (visual() ? TN.preview.exec('insertOrderedList') : listSrc('ol')),
    indent: () => (visual() ? TN.preview.exec('indent') : mapLines((l) => l.map((x) => '  ' + x))),
    outdent: () => (visual() ? TN.preview.exec('outdent') : mapLines((l) => l.map((x) => x.replace(/^ {1,2}|^\t/, '')))),
    alignLeft: () => align('left'), alignCenter: () => align('center'), alignRight: () => align('right'), alignJustify: () => align('justify'),
    quote: () => (visual() ? TN.preview.exec('formatBlock', '<blockquote>') : mapLines((l) => ['<blockquote>', ...l.map((x) => '  ' + x.trim()), '</blockquote>'])),
    code: () => {
      if (visual()) { const s = String(TN.preview.doc().getSelection()); TN.preview.insertHtml('<code>' + esc(s || t('kode')) + '</code>'); } else wrapSrc('<code>', '</code>', t('kode'));
    },
    codeblock: () => {
      if (visual()) { const s = String(TN.preview.doc().getSelection()); TN.preview.insertHtml('<pre><code>' + esc(s || t('kode')) + '</code></pre>'); }
      else { const s = TN.src.sel().text; TN.src.replace(ed.selectionStart, ed.selectionEnd, '<pre><code>' + (s || t('kode')) + '</code></pre>'); }
    },
    clearFmt: () => {
      if (visual()) { TN.preview.exec('removeFormat'); return; }
      const { a, b, text } = TN.src.sel(); if (!text) return;
      const out = text.replace(/<\/?(?:b|strong|i|em|u|s|strike|span|font|mark|small|big|sub|sup)(?:\s[^>]*)?>/gi, ''); TN.src.replace(a, b, out, a, a + out.length);
    },
    heading: (v) => { if (visual()) TN.preview.exec('formatBlock', '<' + v + '>'); else setBlockSrc(v); },
    hr: () => TN.insert('<hr>'),
    button: () => TN.insert('<button type="button">' + t('Knap') + '</button>'),
    comment: () => { if (visual()) return; const { a, b, text } = TN.src.sel(); const out = '<!-- ' + (text || t('kommentar')) + ' -->'; TN.src.replace(a, b, out, a + 5, a + out.length - 4); },
    toggleComment: () => {
      let { a, b, text } = TN.src.sel();
      if (!text) { const v = ed.value; const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', a); if (le < 0) le = v.length; a = ls; b = le; text = v.slice(ls, le); }
      const m = /^(\s*)<!--\s?([\s\S]*?)\s?-->(\s*)$/.exec(text);
      const out = m ? m[1] + m[2] + m[3] : (/^\s*/.exec(text)[0]) + '<!-- ' + text.trim() + ' -->';
      TN.src.replace(a, b, out, a, a + out.length);
    },
    beautify: () => {
      TN.preview.commit(); const s = TN.src.sel();
      if (s.text && s.text.includes('<') && s.b - s.a < ed.value.length) { const out = TN.beautify(s.text).replace(/\n$/, ''); TN.src.replace(s.a, s.b, out); }
      else { const out = TN.beautify(ed.value); if (out !== ed.value) { TN.src.setAll(out); TN.toast(t('Koden er formateret.')); } else TN.toast(t('Koden var allerede pæn.')); }
    },
    wrapTag: async () => {
      const r = await TN.ask({ title: 'Omslut med tag', fields: [{ id: 'tag', label: 'Tag (fx div, section, span)', value: 'div' }, { id: 'cls', label: 'class (valgfri)', value: '' }] });
      if (!r || !/^[a-z][a-z0-9-]*$/i.test(r.tag)) return;
      const open = '<' + r.tag + (r.cls ? ' class="' + r.cls + '"' : '') + '>';
      if (visual()) { const s = String(TN.preview.doc().getSelection()); TN.preview.insertHtml(open + esc(s) + '</' + r.tag + '>'); } else { const { a, b, text } = TN.src.sel(); TN.src.replace(a, b, open + text + '</' + r.tag + '>', a + open.length, a + open.length + text.length); }
    },
  };
  function align(v) {
    if (visual()) { TN.preview.exec({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }[v]); return; }
    if (!TN.target.mode()) return; styleMerge('text-align', v);
  }
  $('#headingSel').addEventListener('change', (e) => { F.heading(e.target.value); });
  function pickColor(id, cmd, srcStyle) {
    const i = $(id);
    i.addEventListener('input', () => {
      if (visual()) TN.preview.exec(cmd, i.value);
      else { const { a, b, text } = TN.src.sel(); const open = '<span style="' + srcStyle + ': ' + i.value + '">'; TN.src.replace(a, b, open + (text || t('tekst')) + '</span>'); }
    });
  }
  pickColor('#textColor', 'foreColor', 'color'); pickColor('#bgColor', 'hiliteColor', 'background-color');
  function updateBlockSel() {
    const sel = $('#headingSel'); let v = 'p';
    if (visual() || (state.mode !== 'raw' && TN.sel.el)) { let n = TN.sel.el; while (n && n.nodeType === 1) { const tg = n.tagName.toLowerCase(); if (/^h[1-6]$/.test(tg) || tg === 'p' || tg === 'div') { v = tg; break; } n = n.parentElement; } }
    else { const st = TN.map.stackAt(ed.value, ed.selectionStart); for (let k = st.length - 1; k >= 0; k--) if (/^(h[1-6]|p|div)$/.test(st[k].name)) { v = st[k].name; break; } }
    sel.value = v;
    const doc = TN.preview.doc();
    if (doc && state.edit) for (const [cmd, c] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strike', 'strikeThrough']]) { const b = $('[data-cmd="' + cmd + '"]'); if (b) b.classList.toggle('on', TN.preview.queryState(c)); }
  }
  TN.hooks.onSelect = (TN.hooks.onSelect || []).concat([updateBlockSel]);

  /* ======================= indsæt ======================= */
  async function cmdTable() {
    const r = await TN.ask({ title: 'Tabel', fields: [{ id: 'rows', label: 'Rækker', type: 'number', value: 3, min: 1, max: 50 }, { id: 'cols', label: 'Kolonner', type: 'number', value: 3, min: 1, max: 20 }, { id: 'head', label: 'Overskriftsrække', type: 'checkbox', value: true }, { id: 'cap', label: 'Tabeltitel (caption)', type: 'checkbox', value: false }] });
    if (!r) return; TN.insert(TN.snip.table(Math.max(1, +r.rows), Math.max(1, +r.cols), r.head, r.cap));
  }
  async function cmdLink() {
    const sel = visual() ? String(TN.preview.doc().getSelection()) : TN.src.sel().text;
    const r = await TN.ask({ title: 'Link', fields: [{ id: 'url', label: 'Adresse', value: 'https://' }, { id: 'text', label: 'Tekst', value: sel || '' }, { id: 'blank', label: 'Åbn i nyt vindue', type: 'checkbox', value: false }] });
    if (!r || !r.url) return;
    const attrs = ' href="' + TN.escAttr(r.url) + '"' + (r.blank ? ' target="_blank" rel="noopener"' : '');
    const html = '<a' + attrs + '>' + esc(r.text || r.url) + '</a>';
    if (visual()) TN.preview.insertHtml(html); else { const { a, b } = TN.src.sel(); TN.src.replace(a, b, html); }
  }
  async function cmdImage(preset) {
    const r = await TN.ask({ title: 'Billede', fields: [{ id: 'src', label: 'Billedfil eller adresse', value: preset || '', browse: true }, { id: 'alt', label: 'Alternativ tekst (alt)', value: '' }] });
    if (!r || !r.src) return; TN.insert('<img src="' + TN.escAttr(r.src) + '" alt="' + TN.escAttr(r.alt) + '">');
  }
  async function cmdMeta() {
    const v = ed.value; const g = (re) => (re.exec(v) || [])[1] || '';
    const r = await TN.ask({ title: 'Metatags', fields: [
      { id: 'title', label: 'Titel', value: g(/<title[^>]*>([\s\S]*?)<\/title>/i) }, { id: 'desc', label: 'Beskrivelse', value: g(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) },
      { id: 'lang', label: 'Sprog (fx da, en)', value: g(/<html[^>]*\slang=["']([^"']*)["']/i) || 'da' }, { id: 'theme', label: 'Browserens farve (theme-color)', type: 'color', value: '#2b579a' },
      { id: 'vp', label: 'Tilpas til mobil (viewport)', type: 'checkbox', value: !/name=["']viewport["']/i.test(v) }, { id: 'cs', label: 'Tegnsæt UTF-8', type: 'checkbox', value: !/<meta[^>]+charset/i.test(v) }] });
    if (!r) return;
    const lines = [];
    if (r.cs) lines.push('<meta charset="utf-8">'); if (r.vp) lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    if (r.desc && !/name=["']description["']/i.test(v)) lines.push('<meta name="description" content="' + TN.escAttr(r.desc) + '">');
    if (!/name=["']theme-color["']/i.test(v)) lines.push('<meta name="theme-color" content="' + r.theme + '">');
    if (r.title && !/<title/i.test(v)) lines.push('<title>' + esc(r.title) + '</title>');
    if (lines.length) TN.src.headInsert(lines.join('\n'));
    if (r.title && /<title[^>]*>[\s\S]*?<\/title>/i.test(ed.value)) { const m = /(<title[^>]*>)([\s\S]*?)(<\/title>)/i.exec(ed.value); if (m && m[2] !== r.title) TN.src.replace(m.index + m[1].length, m.index + m[1].length + m[2].length, esc(r.title)); }
    if (r.desc && /name=["']description["']/i.test(ed.value)) { const m = /(<meta\s+name=["']description["']\s+content=["'])([^"']*)/i.exec(ed.value); if (m && m[2] !== r.desc) TN.src.replace(m.index + m[1].length, m.index + m[1].length + m[2].length, TN.escAttr(r.desc)); }
    if (r.lang) TN.htmlAttr('lang', r.lang);
  }
  async function cmdStylesheet() { const r = await TN.ask({ title: 'Stilark', fields: [{ id: 'href', label: 'Adresse eller filnavn', value: 'style.css' }] }); if (r && r.href) TN.src.headInsert('<link rel="stylesheet" href="' + TN.escAttr(r.href) + '">'); }
  async function cmdScript() { const r = await TN.ask({ title: 'Script', fields: [{ id: 'src', label: 'Adresse eller filnavn', value: 'script.js' }, { id: 'defer', label: 'Indlæs efter siden (defer)', type: 'checkbox', value: true }] }); if (r && r.src) TN.src.headInsert('<script src="' + TN.escAttr(r.src) + '"' + (r.defer ? ' defer' : '') + '><\/script>'); }
  async function cmdSkeleton() {
    if (ed.value.trim() && ed.value !== WELCOME) { const ok = await TN.modal({ title: t('Erstat hele siden?'), body: Object.assign(el('p'), { textContent: t('Den nuværende kode erstattes af en tom HTML5-side. Du kan fortryde med Ctrl+Z.') }), buttons: [{ text: t('Annuller') }, { text: t('Erstat'), primary: true, value: () => true }] }); if (!ok) return; }
    TN.src.setAll(TN.snip.skeleton(t('Min side'), I18N.lang())); ed.setSelectionRange(0, 0);
  }
  function symbolMenu(anchor) { TN.popMenu(anchor, TN.snip.symbols.map(([e, l]) => ({ label: l, raw: true, hint: e, onClick: () => TN.insert(e) })), { cls: 'symmenu' }); }
  const menuFrom = (anchor, list) => TN.popMenu(anchor, Object.entries(list).map(([k, html]) => ({ label: k, raw: true, onClick: () => TN.insert(html) })));
  const NAMES = { sections: { header: 'header – sidehoved', nav: 'nav – menu', main: 'main – hovedindhold', section: 'section – afsnit', article: 'article – artikel', aside: 'aside – sidebemærkning', footer: 'footer – sidefod', div: 'div – boks', figure: 'figure – billede med tekst', details: 'details – fold ud' }, forms: { form: 'Komplet formular', text: 'Tekstfelt', email: 'E-mail', password: 'Adgangskode', number: 'Tal', date: 'Dato', textarea: 'Tekstområde', select: 'Valgliste', checkbox: 'Afkrydsning', radio: 'Valgknapper', range: 'Skyder' }, media: { video: 'Video', audio: 'Lyd', picture: 'Billede med formater', iframe: 'Indlejret side (iframe)' } };
  function snipMenu(anchor, kind) { TN.popMenu(anchor, Object.entries(TN.snip[kind]).map(([k, html]) => ({ label: NAMES[kind][k] || k, raw: false, onClick: () => TN.insert(html) }))); }

  /* ======================= eksport ======================= */
  async function doExport(kind) {
    TN.preview.commit();
    const base = { kind, docPath: state.path };
    let payload;
    if (kind === 'pdf') payload = { html: ed.value };
    else if (kind === 'html') payload = { html: TN.beautify(ed.value) };
    else if (kind === 'md') payload = { text: TN.toMarkdown(ed.value) };
    else payload = { text: TN.toPlainText(ed.value) };
    const r = await api.exportAs(Object.assign(base, payload));
    if (!r) return;
    if (r.error) TN.toast(t('Eksport mislykkedes: {0}', r.error), 6000); else TN.toast(t('Eksporteret: {0}', r.path.split(/[\\/]/).pop()), 3500);
  }

  /* ======================= historik, hjælp, om ======================= */
  async function cmdHistory() {
    await snapshot(true);
    const key = state.path || 'untitled'; const list = await api.snapList(key);
    const wrapEl = el('div', 'hist'); const lst = el('div', 'lst'); const pre = el('pre');
    pre.textContent = list.length ? t('Vælg en version til venstre.') : t('Ingen tidligere versioner endnu. Der gemmes automatisk et snapshot hvert minut, når du har ændret noget, og hver gang du gemmer.');
    let selText = null;
    const fmt = (id) => { const d = new Date(id.replace(/T(\d+)-(\d+)-(\d+)-\d+Z/, 'T$1:$2:$3Z')); return isNaN(d) ? id : d.toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'medium' }); };
    for (const s of list) {
      const b = document.createElement('button'); b.textContent = fmt(s.id) + '  ·  ' + Math.max(1, Math.round(s.size / 1024)) + ' kB';
      b.onclick = async () => { $$('button', lst).forEach((x) => x.classList.remove('on')); b.classList.add('on'); selText = await api.snapRead(key, s.id); pre.textContent = selText || t('(kunne ikke læses)'); };
      lst.append(b);
    }
    wrapEl.append(lst, pre);
    const r = await TN.modal({ title: t('Versionshistorik') + ' – ' + docName(), body: wrapEl, wide: true, buttons: [{ text: t('Luk') }, { text: t('Gendan valgt version'), primary: true, value: () => (selText !== null ? { text: selText } : null) }] });
    if (r && r.text !== undefined) { ensureSource(); TN.src.setAll(r.text); ed.setSelectionRange(0, 0); TN.toast(t('Version gendannet (kan fortrydes med Ctrl+Z)')); }
  }
  const supportHtml = () => t('Spørgsmål og fejl kan rapporteres som en sag på {0}.', '<a href="https://github.com/Cphmartinus/tagnote/issues" class="maillink">GitHub Issues</a>');
  async function showHtml(title, html) {
    const b = el('div', 'help'); b.innerHTML = html;
    b.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); api.openExternal && api.openExternal(a.getAttribute('href')); } });
    await TN.modal({ title, body: b, wide: true, buttons: [{ text: t('Luk'), primary: true }] });
  }
  const li = (k) => '<li>' + t(k) + '</li>';
  const helpHtml = () => '<h4>' + t('Kom i gang') + '</h4><ul>' + li('Åbn en .html-fil, eller skriv direkte i koden til venstre. Siden vises til højre og opdateres, mens du skriver.') + li('Under Visning vælger du Kode, Kode + visning eller Visning, og hvor bred siden skal vises.') + li('Klik på et element i visningen, og det markeres. Brødkrummerne under visningen viser, hvor du er i siden.') + li('Ret tekst direkte i visningen. Ændringerne skrives tilbage til koden.') + '</ul>' +
    '<h4>' + t('JavaScript i visningen') + '</h4><p>' + t('Som standard kører ingen scripts i visningen. Det er sikkert, når du åbner filer fra andre, og det giver visuel redigering. Kendte slår kun scripts fra kendte biblioteker (Bootstrap, Tailwind m.fl.) til. Til kører alle scripts, men uden visuel redigering.') + '</p>' +
    '<h4>' + t('Design og Effekter') + '</h4><ul>' + li('Stilpanelet retter farver, tekst, afstande, kanter og layout for det markerede element.') + li('Effekter laver scroll-animationer, gradienter, skygger, glas og flydende størrelser som almindelig CSS.') + li('Når TagNote finder Bootstrap, Tailwind, Bulma eller Pico i siden, dukker ekstra faner op med komponenter og klasser.') + '</ul>' +
    '<h4>' + t('Gemmer') + '</h4><p>' + t('Dokumenter gemmes som helt almindelige .html-filer. Visuel redigering omskriver koden i standardformat for de dele, du retter.') + '</p><p>' + supportHtml() + '</p>';
  const shortcutsHtml = () => '<table><tr><th>' + t('Genvej') + '</th><th>' + t('Funktion') + '</th></tr>' +
    [['Ctrl+N / O / S', 'Ny, åbn, gem'], ['Ctrl+Shift+S', 'Gem som'], ['Ctrl+W', 'Luk fane'], ['Ctrl+B / I / U', 'Fed, kursiv, understreget'], ['Ctrl+K', 'Link'], ['Ctrl+E', 'Indlejret kode'], ['Ctrl+/', 'Kommentér ind/ud'], ['Ctrl+Shift+F', 'Formatér kode'], ['Ctrl+Shift+T', 'Omslut med tag'], ['Alt+↑', 'Vælg overordnet element'], ['Ctrl+F / Ctrl+H', 'Find, erstat'], ['F3 / Shift+F3', 'Find næste, forrige'], ['Ctrl+Tab', 'Næste fane'], ['Ctrl+ + / - / 0', 'Zoom'], ['Ctrl+F1', 'Skjul båndet'], ['Ctrl+P', 'Eksportér til PDF'], ['Tab / Shift+Tab', 'Indryk, fjern indrykning']].map(([k, f]) => '<tr><td><kbd>' + k + '</kbd></td><td>' + t(f) + '</td></tr>').join('') + '</table>';
  async function cmdAbout() {
    const b = el('div');
    b.innerHTML = '<p><b>TagNote</b> – ' + t('HTML-editor og -viser i Microsoft Word-stil.') + '</p><p>' + t('Dokumenter gemmes som helt almindelige .html-filer. Hold musen over en knap for at se genvej og HTML-kode.') + '</p><p>' + supportHtml() + '</p>';
    if (api.appVersion) { const v = el('p', 'muted'); v.textContent = t('Version {0}', api.appVersion) + ' · MIT'; b.prepend(v); }
    await TN.modal({ title: t('Om TagNote'), body: b, buttons: [{ text: t('Luk'), primary: true }] });
  }

  /* ======================= opdateringer ======================= */
  let updInfo = null;
  function showUpdateBar(info) { updInfo = info; $('#updText').textContent = t('TagNote {0} er tilgængelig', info.latest); $('#updatebar').hidden = false; }
  $('#updShow').onclick = () => { if (updInfo) showUpdateDialog(updInfo); };
  $('#updSkip').onclick = () => { if (updInfo) store.set('skipVersion', updInfo.latest); $('#updatebar').hidden = true; };
  $('#updClose').onclick = () => { $('#updatebar').hidden = true; };
  async function checkForUpdates(silent) {
    if (!api.updateCheck) return;
    if (!silent) TN.toast(t('Søger efter opdateringer…'), 2000);
    const info = await api.updateCheck(); store.set('lastUpdateCheck', Date.now());
    if (!info || info.error) { if (!silent) TN.toast(t('Kunne ikke søge efter opdateringer: {0}', info ? info.error : '?'), 6000); return; }
    if (!info.newer) { if (!silent) TN.toast(t('Du har den nyeste version ({0}).', info.current), 3500); return; }
    if (silent) { if (store.get('skipVersion', '') !== info.latest) showUpdateBar(info); } else showUpdateDialog(info);
  }
  async function showUpdateDialog(info) {
    $('#updatebar').hidden = true;
    const body = el('div'); const p = el('p'); p.style.margin = '0';
    p.textContent = t('Du har version {0}.', info.current) + (info.portable ? ' ' + t('Du bruger den bærbare udgave. Hent den nye version på udgivelsessiden, og erstat den gamle fil.') : ''); body.append(p);
    if (info.notes.trim()) { const notes = el('div', 'upd-notes'); notes.textContent = info.notes; body.append(notes); }
    const buttons = [{ text: t('Senere') }, { text: t('Åbn udgivelsessiden'), primary: !info.canInstall, value: () => 'page' }];
    if (info.canInstall) buttons.push({ text: t('Hent og installer'), primary: true, value: () => 'install' });
    const r = await TN.modal({ title: t('TagNote {0} er tilgængelig', info.latest), body, wide: true, buttons });
    if (r === 'page') api.openExternal && api.openExternal(info.url);
    if (r === 'install') downloadAndInstall(info);
  }
  async function downloadAndInstall(info) {
    const box = el('div'); const txt = el('p'); txt.style.margin = '0 0 8px'; txt.textContent = t('Henter opdatering… {0} %', 0);
    const bar = el('div', 'upd-progress'); bar.append(el('i')); box.append(txt, bar);
    const ov = el('div', 'overlay'); const dlg = el('div', 'dlg'); const h = el('h3'); h.textContent = t('TagNote {0} er tilgængelig', info.latest);
    const bd = el('div', 'body'); bd.append(box); dlg.append(h, bd); ov.append(dlg); $('#modalRoot').append(ov);
    if (api.onUpdateProgress && !downloadAndInstall.hooked) { downloadAndInstall.hooked = true; api.onUpdateProgress((pct) => { const f = $('.upd-progress i'); if (f) f.style.width = pct + '%'; const tx = f && f.closest('.body').querySelector('p'); if (tx) tx.textContent = t('Henter opdatering… {0} %', pct); }); }
    const res = await api.updateDownload(info.setup); ov.remove();
    if (!res || res.error) { TN.toast(res && res.error === 'checksum' ? t('Den hentede fil er beskadiget. Prøv igen.') : t('Opdateringen kunne ikke hentes: {0}', res ? res.error : '?'), 6000); return; }
    const go = await TN.modal({ title: t('TagNote {0} er tilgængelig', info.latest), body: Object.assign(el('p'), { textContent: t('Opdateringen er hentet og klar til at blive installeret. TagNote lukker, og installationen starter.') }), buttons: [{ text: t('Senere') }, { text: t('Installer nu'), primary: true, value: () => true }] });
    if (go && (await confirmAllDocs())) api.updateInstall();
  }

  /* ======================= sprog ======================= */
  const sysLang = I18N.detect(api.systemLocale || navigator.language);
  const resolveLang = (pref) => (pref === 'auto' ? sysLang : I18N.LANGS[pref] ? pref : sysLang);
  function fillLangSel() {
    const pref = store.get('lang', 'auto');
    for (const sel of [$('#langSel'), $('#langSel2')]) { sel.innerHTML = ''; sel.add(new Option(t('Automatisk (Windows)') + ' – ' + I18N.LANGS[sysLang], 'auto')); for (const [c, n] of Object.entries(I18N.LANGS)) sel.add(new Option(n, c)); sel.value = pref; }
  }
  function applyLanguage(pref) {
    store.set('lang', pref);
    const code = I18N.setLang(resolveLang(pref));
    document.body.dataset.drop = t('Slip filen for at åbne / indsætte');
    $('#langSel').title = t('Sprog'); fillLangSel();
    $('#verLabel').textContent = api.appVersion ? t('Version {0}', api.appVersion) : '';
    api.setLang && api.setLang({ spell: I18N.SPELL[code], lang: code, strings: { openTitle: t('Åbn dokument'), saveTitle: t('Gem dokument'), filterAll: t('Alle filer'), exportTitle: t('Eksportér'), imageTitle: t('Indsæt billede'), imageFilter: t('Billeder') } });
    for (const d of docs) if (d.untitledNo != null && !d.path) d.untitled = t('Side') + d.untitledNo;
    if (state.untitledNo != null && !state.path) state.untitled = t('Side') + state.untitledNo;
    const wasWelcome = !state.path && ed.value === WELCOME && state.saved === WELCOME;
    WELCOME = welcomeHtml();
    if (wasWelcome) { loadDoc(WELCOME, null); }
    updateStats(); updatePos(); updateDirty(); buildNav();
    $('#pvInfo') && TN.preview.layout();
    TN.preview.updateNote(); applyJs(state.js, true);
    if (TN.fw && TN.fw.reset) TN.fw.reset();
  }
  const onLangPick = (e) => { applyLanguage(e.target.value); $('#langSel').value = $('#langSel2').value = e.target.value; };
  $('#langSel').addEventListener('change', onLangPick); $('#langSel2').addEventListener('change', onLangPick);
  I18N.setLang(resolveLang(store.get('lang', 'auto')));

  /* ======================= kommandoer ======================= */
  Object.assign(TN.cmds, {
    new: () => newTab(), open: cmdOpen, save: () => save(false), saveAs: () => save(true),
    undo: () => { if (visual()) TN.preview.exec('undo'); else { ed.focus(); document.execCommand('undo'); } },
    redo: () => { if (visual()) TN.preview.exec('redo'); else { ed.focus(); document.execCommand('redo'); } },
    toggleRibbon: () => toggleRibbon(), reveal: () => state.path && api.showInFolder(state.path), about: cmdAbout,
    table: cmdTable, link: cmdLink, image: () => cmdImage(), metaTags: cmdMeta, stylesheet: cmdStylesheet, script: cmdScript, skeleton: cmdSkeleton,
    symbol: () => symbolMenu($('[data-cmd="symbol"]')),
    menuSections: () => snipMenu($('[data-cmd="menuSections"]'), 'sections'), menuForms: () => snipMenu($('[data-cmd="menuForms"]'), 'forms'), menuMedia: () => snipMenu($('[data-cmd="menuMedia"]'), 'media'),
    find: () => openFind(false), replace: () => openFind(true), history: cmdHistory, snapshot: () => snapshot(false),
    exportPdf: () => doExport('pdf'), exportHtml: () => doExport('html'), exportMd: () => doExport('md'), exportTxt: () => doExport('txt'),
    help: () => showHtml(t('Hjælp') + ' – TagNote', helpHtml()), shortcuts: () => showHtml(t('Genveje'), shortcutsHtml()),
    reportIssue: () => api.openExternal('https://github.com/Cphmartinus/tagnote/issues'), projectPage: () => api.openExternal('https://github.com/Cphmartinus/tagnote'),
    checkUpdate: () => checkForUpdates(false),
  });
  for (const k of Object.keys(F)) if (k !== 'heading') TN.cmds[k] = F[k];
  function run(cmd) { const f = TN.cmds[cmd]; if (f) f(); }
  document.addEventListener('mousedown', (e) => { if (e.target.closest('.rb, .qb')) e.preventDefault(); }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]'); if (b && !b.disabled) { e.preventDefault(); run(b.dataset.cmd); }
    const tab = e.target.closest('.tab[data-tab]'); if (tab && !tab.classList.contains('fwtab')) showTab(tab.dataset.tab);
    const m = e.target.closest('[data-mode]'); if (m) setMode(m.dataset.mode);
    const th = e.target.closest('[data-set-theme]'); if (th) setTheme(th.dataset.setTheme);
    const a = e.target.closest('.maillink'); if (a) { e.preventDefault(); api.openExternal && api.openExternal(a.getAttribute('href')); }
  });
  $('#zoom').addEventListener('input', (e) => setZoom(+e.target.value)); $('#zoom2').addEventListener('input', (e) => setZoom(+e.target.value));
  $('#optNav').addEventListener('change', (e) => { $('#nav').hidden = !e.target.checked; store.set('nav', e.target.checked); buildNav(); TN.preview.layout(); });
  $('#optSync').addEventListener('change', (e) => store.set('sync', e.target.checked));
  $('#optWrap').addEventListener('change', (e) => setWrap(e.target.checked));
  $('#optEdit').addEventListener('change', (e) => { TN.preview.setEdit(e.target.checked); store.set('edit', e.target.checked); });
  $('#optUpdates').addEventListener('change', (e) => store.set('autoUpdate', e.target.checked));
  if (api.onOpenPath) api.onOpenPath(openPath);
  if (api.onRequestClose) api.onRequestClose(async () => { if (await confirmAllDocs()) api.closeConfirmed(); });

  /* ======================= tastatur ======================= */
  TN.onKey = function (e, from) {
    const ctrl = e.ctrlKey || e.metaKey; const key = e.key.toLowerCase(); const code = e.code;
    const go = (fn) => { e.preventDefault(); e.stopPropagation(); fn(); return true; };
    if (key === 'f1' && !ctrl) return go(() => run('help'));
    if (key === 'f1' && ctrl) return go(() => toggleRibbon());
    if (key === 'f3') return go(() => findNext(e.shiftKey ? -1 : 1));
    if (key === 'escape' && !$('#findbar').hidden) return go(closeFind);
    if (e.altKey && !ctrl && key === 'arrowup' && TN.sel.el) return go(() => TN.sel.parent());
    if (!ctrl) return false;
    /* Ctrl+Alt er AltGr på mange tastaturer ({ [ ] } @ m.fl.), så den kombination bruges aldrig til genveje */
    if (e.altKey || (e.getModifierState && e.getModifierState('AltGraph'))) return false;
    if (from === 'preview' && ['b', 'i', 'u', 'z', 'y', 'a', 'c', 'x', 'v'].includes(key) && !e.shiftKey) return false;
    if (key === 'tab' || code === 'PageDown' || code === 'PageUp') return go(() => switchBy(key === 'tab' ? (e.shiftKey ? -1 : 1) : code === 'PageUp' ? -1 : 1));
    if (e.shiftKey) {
      if (key === '/') return go(() => run('toggleComment')); // Ctrl+/ på danske og nordiske tastaturer
      if (key === 't') return go(() => run('wrapTag'));
      if (code === 'Digit7') return go(() => run('ol')); if (code === 'Digit8') return go(() => run('ul'));
      if (key === 's') return go(() => run('saveAs')); if (key === 'x') return go(() => run('strike')); if (key === 'q') return go(() => run('quote'));
      if (key === 'e') return go(() => run('codeblock')); if (key === 'f') return go(() => run('beautify'));
      return false;
    }
    switch (key) {
      case 'n': return go(() => run('new')); case 'w': return go(() => closeTab(curId)); case 'o': return go(() => run('open')); case 's': return go(() => run('save'));
      case 'b': return go(() => run('bold')); case 'i': return go(() => run('italic')); case 'u': return go(() => run('underline')); case 'k': return go(() => run('link')); case 'e': return go(() => run('code'));
      case 'f': return go(() => run('find')); case 'h': return go(() => run('replace')); case '/': return go(() => run('toggleComment'));
      case '=': case '+': return go(() => setZoom(+$('#zoom').value + 10)); case '-': return go(() => setZoom(+$('#zoom').value - 10)); case '0': return go(() => setZoom(100));
      case 'p': return go(() => run('exportPdf'));
    }
    return false;
  };
  document.addEventListener('keydown', (e) => { TN.onKey(e, 'app'); }, true);

  /* ---------- redigering i tekstfeltet: Tab, Enter, afslut tags ---------- */
  const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  ed.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) { e.preventDefault(); if (ed.selectionStart === ed.selectionEnd && !e.shiftKey) TN.src.insertText('  '); else mapLines((l) => l.map((x) => (e.shiftKey ? x.replace(/^ {1,2}|^\t/, '') : '  ' + x))); return; }
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && ed.selectionStart === ed.selectionEnd) {
      const v = ed.value, pos = ed.selectionStart; const ls = v.lastIndexOf('\n', pos - 1) + 1; const before = v.slice(ls, pos);
      const ind = /^[ \t]*/.exec(before)[0]; const open = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/.exec(before.trimEnd()); const after = v.slice(pos);
      const extra = open && !VOID.has(open[1].toLowerCase()) && !/\/>$/.test(before.trimEnd()) ? '  ' : '';
      e.preventDefault();
      if (extra && new RegExp('^</' + open[1] + '\\s*>', 'i').test(after)) { const t1 = '\n' + ind + '  \n' + ind; TN.src.replace(pos, pos, t1, pos + 1 + ind.length + 2); }
      else TN.src.insertText('\n' + ind + extra);
      return;
    }
  });
  ed.addEventListener('keypress', (e) => {
    if (e.key !== '>' || e.ctrlKey || e.altKey || ed.selectionStart !== ed.selectionEnd) return;
    const pos = ed.selectionStart; const before = ed.value.slice(Math.max(0, pos - 300), pos);
    const m = /<([a-zA-Z][\w:-]*)(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*)?$/.exec(before);
    if (!m || VOID.has(m[1].toLowerCase()) || /\/$/.test(before)) return;
    const st = TN.map.stackAt(ed.value, pos); const top = st[st.length - 1];
    if (top && /^(script|style)$/.test(top.name) && pos >= top.end) return; // ikke i JavaScript eller CSS
    e.preventDefault(); const close = '</' + m[1] + '>'; TN.src.replace(pos, pos, '>' + close, pos + 1);
  });
  ed.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const has = ed.selectionStart !== ed.selectionEnd; const a = { getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY, top: e.clientY, right: e.clientX }) };
    TN.popMenu(a, [
      { label: 'Klip', icon: 'cut', hint: 'Ctrl+X', disabled: !has, onClick: () => api.editAction('cut') }, { label: 'Kopiér', icon: 'copy', hint: 'Ctrl+C', disabled: !has, onClick: () => api.editAction('copy') },
      { label: 'Indsæt', icon: 'paste', hint: 'Ctrl+V', onClick: () => api.editAction('paste') }, { label: 'Markér alt', icon: 'selectall', hint: 'Ctrl+A', onClick: () => api.editAction('selectAll') }, '-',
      { label: 'Kommentér ind/ud', icon: 'comment', hint: 'Ctrl+/', onClick: () => run('toggleComment') }, { label: 'Omslut med tag…', icon: 'tag', hint: 'Ctrl+Shift+T', onClick: () => run('wrapTag') }, { label: 'Formatér kode', icon: 'wand', hint: 'Ctrl+Shift+F', onClick: () => run('beautify') },
    ]);
  });

  /* ---------- træk og slip ---------- */
  let dragN = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; document.body.classList.add('dropping'); } });
  window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('dropping'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault(); dragN = 0; document.body.classList.remove('dropping');
    for (const f of [...(e.dataTransfer ? e.dataTransfer.files : [])]) {
      const p = api.pathForFile ? api.pathForFile(f) : ''; if (!p) continue;
      if (/\.(html?|xhtml|shtml|txt)$/i.test(p)) { await openPath(p); break; }
      if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(p)) { const rel = await api.imageRel(p, state.path); if (rel) await cmdImage(rel); }
    }
  });
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(+$('#zoom').value + (e.deltaY < 0 ? 10 : -10)); } }, { passive: false });

  /* ---------- værktøjstips ---------- */
  const tip = $('#tip'); let tipT = 0;
  document.addEventListener('mouseover', (e) => {
    const x = e.target.closest('[data-tip]'); clearTimeout(tipT);
    if (!x) { tip.hidden = true; return; }
    tipT = setTimeout(() => {
      const parts = x.dataset.tip.split('|');
      tip.innerHTML = ''; const tt = document.createElement('b'); tt.textContent = t(parts[0]); tip.append(tt);
      if (parts[1]) { const k = document.createElement('div'); k.className = 'k'; k.textContent = t(parts[1]); tip.append(k); }
      if (parts[2]) { const d = document.createElement('div'); d.append('HTML: '); const c = document.createElement('code'); c.textContent = parts[2]; d.append(c); tip.append(d); }
      tip.hidden = false; const r = x.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left)) + 'px'; tip.style.top = Math.min(innerHeight - tip.offsetHeight - 6, r.bottom + 6) + 'px';
    }, 450);
  });
  document.addEventListener('mousedown', () => { tip.hidden = true; clearTimeout(tipT); });

  /* ======================= velkomstside ======================= */
  const welcomeHtml = () => `<!DOCTYPE html>
<html lang="${I18N.lang()}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t('Velkommen til TagNote'))}</title>
  <style>
    :root { --ink: #1c2b45; --paper: #f6f8fc; --blue: #2b579a; --sky: #dbe7f7; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: var(--ink); background: var(--paper); line-height: 1.6; }
    header { padding: 56px 24px 40px; background: linear-gradient(135deg, #2b579a, #5b8bd0); color: #fff; text-align: center; }
    header h1 { margin: 0 0 8px; font-size: clamp(1.8rem, 1rem + 3vw, 3rem); letter-spacing: -.02em; }
    header p { margin: 0 auto; max-width: 36rem; opacity: .92; }
    main { max-width: 56rem; margin: 0 auto; padding: 32px 24px 64px; display: grid; gap: 20px; }
    .card { background: #fff; border-radius: 12px; padding: 22px 24px; box-shadow: 0 1px 2px rgb(20 40 80 / .08), 0 8px 24px rgb(20 40 80 / .06); transition: transform .25s ease, box-shadow .25s ease; }
    .card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgb(20 40 80 / .14); }
    .card h2 { margin: 0 0 6px; font-size: 1.15rem; color: var(--blue); }
    .card p { margin: 0; }
    code { background: var(--sky); padding: 1px 6px; border-radius: 4px; font-size: .92em; }
    .reveal { animation: tn-up linear both; animation-timeline: view(); animation-range: entry 0% entry 55%; }
    @keyframes tn-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .reveal { animation: none; } }
  </style>
</head>
<body>
  <header>
    <h1>${esc(t('Velkommen til TagNote'))}</h1>
    <p>${esc(t('Skriv HTML til venstre og se siden med det samme til højre. Brug båndet foroven, som du kender det fra Word.'))}</p>
  </header>
  <main>
    <section class="card reveal">
      <h2>${esc(t('Ret direkte i siden'))}</h2>
      <p>${esc(t('Klik i en tekst her til højre, og skriv. Ændringen skrives tilbage til koden.'))}</p>
    </section>
    <section class="card reveal">
      <h2>${esc(t('Stilpanel og effekter'))}</h2>
      <p>${esc(t('Markér et element, og ret farver, afstande og kanter under'))} <code>Design</code> ${esc(t('eller lav en scroll-animation under'))} <code>Effekter</code>.</p>
    </section>
    <section class="card reveal">
      <h2>${esc(t('Sikker som standard'))}</h2>
      <p>${esc(t('Scripts i siden kører ikke, før du selv slår JavaScript til under Visning.'))}</p>
    </section>
  </main>
</body>
</html>
`;
  let WELCOME = '';

  /* ======================= start ======================= */
  $('#optEdit').checked = store.get('edit', true); state.edit = $('#optEdit').checked;
  setTheme(store.get('theme', 'light')); setZoom(store.get('zoom', 100));
  $('#optSync').checked = store.get('sync', true); $('#optNav').checked = store.get('nav', false); $('#nav').hidden = !$('#optNav').checked;
  $('#optWrap').checked = store.get('wrap', true); setWrap($('#optWrap').checked);
  showTab(store.get('tab', 'home') === 'file' ? 'home' : store.get('tab', 'home'));
  if (store.get('collapsed', false)) toggleRibbon(true);
  setMode(['raw', 'split', 'read'].includes(store.get('mode', 'split')) ? store.get('mode', 'split') : 'split');
  setWidth(store.get('width', 0));
  { const d0 = newDoc(); docs.push(d0); curId = d0.id; state.untitled = d0.untitled; state.untitledNo = d0.untitledNo; }
  WELCOME = welcomeHtml(); loadDoc(WELCOME, null); state.lastSnap = WELCOME; updateDirty(); ed.setSelectionRange(0, 0); ed.focus();
  applyLanguage(store.get('lang', 'auto'));
  $('#optUpdates').checked = store.get('autoUpdate', true);
  if (store.get('autoUpdate', true) && Date.now() - store.get('lastUpdateCheck', 0) > 20 * 3600 * 1000) setTimeout(() => checkForUpdates(true), 5000);
  for (const f of TN.ready) try { f(); } catch (_) {}
  if (window.WDi18n) window.WDi18n.apply(document.body);
  window.__tn = { state, setMode, setWidth, setJs, run, loadDoc, newTab, applyLanguage, showTab, setTheme, openInTab };
})();
