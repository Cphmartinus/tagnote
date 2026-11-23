/* TagNote – design for hele siden, Udseende-panelet og minibjælken (Enkel) */
(function () {
  'use strict';
  const { $, $$, t, state, ed, el, esc, store, api } = TN;

  /* ======================= farvetemaer, skrift, form ======================= */
  // navn, primær, tekst på primær, baggrund, flade, flade 2, tekst, overskrift
  const PALETTES = {
    hav: ['Hav', '#1f6fb2', '#ffffff', '#f6f9fc', '#ffffff', '#e8f0f8', '#1c2b3a', '#12324f'],
    skov: ['Skov', '#2f7d4f', '#ffffff', '#f6f8f4', '#ffffff', '#e7f0e5', '#1f2a22', '#1d4a30'],
    solnedgang: ['Solnedgang', '#c24a1f', '#ffffff', '#fff8f3', '#ffffff', '#fce8dc', '#2b1d17', '#7d2c10'],
    lyng: ['Lyng', '#7b4fa0', '#ffffff', '#faf7fc', '#ffffff', '#efe6f5', '#261d2e', '#47285f'],
    sand: ['Sand', '#93633a', '#ffffff', '#fbf7f1', '#ffffff', '#f2e8d9', '#2e261d', '#5a3c1e'],
    kirsebaer: ['Kirsebær', '#c02a55', '#ffffff', '#fff7f9', '#ffffff', '#fbe3ea', '#2b1a20', '#6e1530'],
    grafit: ['Grafit', '#2f3640', '#ffffff', '#f4f5f7', '#ffffff', '#e7e9ed', '#1d2025', '#111418'],
    nat: ['Nat', '#5aa9ff', '#0b1220', '#0f1724', '#172235', '#1b2840', '#dfe7f2', '#ffffff'],
  };
  const SYS = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const FONTS = {
    moderne: ['Moderne', SYS, SYS, 'Ren og let at læse på skærm'],
    klassisk: ['Klassisk', 'Georgia, "Times New Roman", serif', 'Georgia, "Times New Roman", serif', 'Som en bog eller et magasin'],
    avis: ['Avis', 'Georgia, "Times New Roman", serif', SYS, 'Klassiske overskrifter og moderne tekst'],
    venlig: ['Venlig', '"Trebuchet MS", "Segoe UI", sans-serif', '"Trebuchet MS", "Segoe UI", sans-serif', 'Blød og imødekommende'],
    elegant: ['Elegant', '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', SYS, 'Fin og eksklusiv'],
    kraftig: ['Kraftig', '"Arial Black", "Segoe UI Black", Impact, sans-serif', SYS, 'Store, tunge overskrifter'],
  };
  const DEFAULTS = { farver: 'hav', skrift: 'moderne', luft: 'normal', hjorner: 'let', skygge: 'lille', bredde: 'normal', tekst: 'normal' };
  const LUFT = { taet: 16, normal: 24, luftig: 36 };
  const HJORNER = { skarpe: 0, let: 8, runde: 16, meget: 28 };
  const SKYGGE = { ingen: 'none', lille: '0 1px 2px rgb(0 0 0 / .06), 0 4px 14px rgb(0 0 0 / .07)', stor: '0 2px 4px rgb(0 0 0 / .06), 0 14px 36px rgb(0 0 0 / .14)' };
  const BREDDE = { smal: 720, normal: 980, bred: 1200 };
  const TEKST = { normal: 17, stor: 19 };

  function designCss(d) {
    d = Object.assign({}, DEFAULTS, d);
    const p = PALETTES[d.farver] || PALETTES.hav, f = FONTS[d.skrift] || FONTS.moderne;
    return '/* tagnote-design ' + JSON.stringify(d) + ' */\n' +
      ':root {\n  --tn-primaer: ' + p[1] + ';\n  --tn-paa-primaer: ' + p[2] + ';\n  --tn-baggrund: ' + p[3] + ';\n  --tn-flade: ' + p[4] + ';\n  --tn-flade-2: ' + p[5] + ';\n  --tn-tekst: ' + p[6] + ';\n  --tn-overskrift: ' + p[7] + ';\n' +
      '  --tn-overskrift-skrift: ' + f[1] + ';\n  --tn-tekst-skrift: ' + f[2] + ';\n  --tn-luft: ' + LUFT[d.luft] + 'px;\n  --tn-hjorner: ' + HJORNER[d.hjorner] + 'px;\n  --tn-skygge: ' + SKYGGE[d.skygge] + ';\n  --tn-bredde: ' + BREDDE[d.bredde] + 'px;\n}\n' +
      'body {\n  margin: 0;\n  background: var(--tn-baggrund);\n  color: var(--tn-tekst);\n  font-family: var(--tn-tekst-skrift);\n  font-size: ' + TEKST[d.tekst] + 'px;\n  line-height: 1.65;\n}\n' +
      'h1, h2, h3, h4 {\n  font-family: var(--tn-overskrift-skrift);\n  color: var(--tn-overskrift);\n  line-height: 1.2;\n}\n' +
      'a { color: var(--tn-primaer); }';
  }
  function readDesign() {
    const css = TN.src.styleText('tn-design');
    const m = /tagnote-design (\{[^]*?\}) \*\//.exec(css);
    try { return m ? Object.assign({}, DEFAULTS, JSON.parse(m[1])) : null; } catch (_) { return null; }
  }
  let applyT = 0;
  function applyDesign(d, now) {
    clearTimeout(applyT);
    const go = () => TN.src.styleBlock('tn-design', designCss(d), 'replace');
    if (now) go(); else applyT = setTimeout(go, 120);
  }
  TN.design = { css: designCss, read: readDesign, PALETTES, FONTS, DEFAULTS };

  /* Åbn en designdialog, der ændrer siden mens man vælger; Annuller sætter det gamle tilbage */
  async function designDialog(title, intro, build) {
    if (!(await ensureEditable())) return;
    const had = /<style[^>]*\sid=["']tn-design["']/i.test(ed.value);
    const before = ed.value;
    const d = readDesign() || Object.assign({}, DEFAULTS);
    const body = el('div', 'designdlg');
    if (intro) body.append(Object.assign(el('p', 'muted'), { textContent: t(intro) }));
    build(body, d, (patch) => { Object.assign(d, patch); applyDesign(d); });
    if (!had) TN.toast(t('Siden får nu sine egne farver og skrift. Du kan altid ændre dem igen her.'), 4500);
    const ok = await TN.modal({ title: t(title), body, wide: true, buttons: [{ text: t('Annuller') }, { text: t('OK'), primary: true, value: () => true }] });
    clearTimeout(applyT);
    if (!ok) { if (ed.value !== before) TN.src.setAll(before); return; }
    applyDesign(d, true);
  }
  const thumbFor = (p) => '<div class="gthumb" style="background:' + p[3] + '"><i style="height:14px;background:' + p[1] + '"></i><i style="height:8px;width:70%;background:' + p[7] + '"></i><i style="height:6px;width:90%;background:' + p[6] + ';opacity:.35"></i><i style="height:6px;width:80%;background:' + p[6] + ';opacity:.35"></i><i style="height:16px;width:42%;background:' + p[1] + ';border-radius:8px"></i></div>';
  TN.cmds.designColors = () => designDialog('Farver', 'Klik på et farvetema. Siden skifter med det samme, så du kan se, hvordan det ser ud.', (body, d, set) => {
    const g = el('div', 'gallery');
    for (const [id, p] of Object.entries(PALETTES)) {
      const c = el('button', 'gcard' + (d.farver === id ? ' on' : '')); c.innerHTML = thumbFor(p) + '<b>' + esc(t(p[0])) + '</b>';
      c.onclick = () => { $$('.gcard', g).forEach((x) => x.classList.toggle('on', x === c)); set({ farver: id }); };
      g.append(c);
    }
    body.append(g);
  });
  TN.cmds.designFonts = () => designDialog('Skrift', 'Vælg skrift til overskrifter og tekst. Alle skrifttyper findes på Windows, så siden ser ens ud for alle.', (body, d, set) => {
    const g = el('div', 'gallery');
    for (const [id, f] of Object.entries(FONTS)) {
      const c = el('button', 'gcard' + (d.skrift === id ? ' on' : ''));
      c.innerHTML = '<span class="fontsample" style="font-family:' + esc(f[1]) + '">' + esc(t('Overskrift')) + '</span><span style="font-family:' + esc(f[2]) + '">' + esc(t('Her er et stykke brødtekst.')) + '</span><b>' + esc(t(f[0])) + '</b><small>' + esc(t(f[3])) + '</small>';
      c.onclick = () => { $$('.gcard', g).forEach((x) => x.classList.toggle('on', x === c)); set({ skrift: id }); };
      g.append(c);
    }
    body.append(g);
  });
  TN.cmds.designShape = () => designDialog('Luft og form', 'Bestem hvor luftig siden er, hvor runde hjørnerne er, og hvor bred teksten må blive.', (body, d, set) => {
    const grid = el('div', 'shape-grid');
    const seg = (label, key, opts, note) => {
      const s = el('div', 'lk-seg');
      for (const [v, l] of opts) { const b = el('button', d[key] === v ? 'on' : ''); b.textContent = t(l); b.onclick = () => { $$('button', s).forEach((x) => x.classList.toggle('on', x === b)); set({ [key]: v }); }; s.append(b); }
      grid.append(Object.assign(el('span'), { textContent: t(label) }), s);
      if (note) grid.append(Object.assign(el('span', 'shape-note'), { textContent: t(note) }));
    };
    seg('Luft', 'luft', [['taet', 'Tæt'], ['normal', 'Normal'], ['luftig', 'Luftig']], 'Afstanden mellem afsnit, kort og kolonner.');
    seg('Hjørner', 'hjorner', [['skarpe', 'Skarpe'], ['let', 'Let runde'], ['runde', 'Runde'], ['meget', 'Meget runde']], 'Gælder knapper, billeder og kort.');
    seg('Skygge', 'skygge', [['ingen', 'Ingen'], ['lille', 'Lille'], ['stor', 'Stor']], 'Skyggen under kort.');
    seg('Sidebredde', 'bredde', [['smal', 'Smal'], ['normal', 'Normal'], ['bred', 'Bred']], 'Hvor bred teksten må blive på en stor skærm.');
    seg('Tekststørrelse', 'tekst', [['normal', 'Normal'], ['stor', 'Større']]);
    body.append(grid);
  });

  /* Siden skal kunne redigeres: visningen fremme og JavaScript slukket */
  async function ensureEditable() {
    if (state.mode === 'raw') TN.setMode(TN.level() === 'simple' ? 'read' : 'split');
    if (state.js !== 'off') TN.setJs('off');
    await TN.preview.render(true); await TN.preview.whenIdle();
    return true;
  }
  TN.ensureEditable = ensureEditable;

  /* ======================= stil på det markerede element ======================= */
  function setStyle(node, prop, val) {
    if (!node) return;
    if (val === '' || val == null) node.style.removeProperty(prop); else node.style.setProperty(prop, val);
    if (!node.getAttribute('style')) node.removeAttribute('style');
  }
  function commitStyle() { TN.preview.commit(true); TN.preview.positionSelBox(); if (look.open) look.render(); }
  TN.styleEl = (prop, val) => { const e = TN.sel.el; if (!e) return; setStyle(e, prop, val); commitStyle(); };

  const pageColors = () => {
    const d = readDesign(); const p = d ? PALETTES[d.farver] : null;
    const base = p ? [p[1], p[7], p[6], p[5]] : ['#1f6fb2', '#12324f', '#1c2b3a', '#e8f0f8'];
    return Array.from(new Set([...base, '#000000', '#ffffff', '#6b7280', '#c62828', '#2e7d32', '#f9a825']));
  };
  const TEXTY = /^(H[1-6]|P|LI|A|BUTTON|BLOCKQUOTE|FIGCAPTION|TD|TH|SPAN|STRONG|EM|LABEL|SMALL)$/;

  /* ======================= Udseende-panelet ======================= */
  const look = (TN.look = { open: false });
  const panel = $('#look');
  look.toggle = (force) => {
    look.open = force === undefined ? !look.open : !!force;
    panel.hidden = !look.open;
    $$('[data-cmd="appearance"]').forEach((b) => b.classList.toggle('on', look.open));
    if (look.open) look.render();
    TN.preview.layout();
  };
  TN.cmds.appearance = () => { if (TN.level() !== 'simple') { TN.cmds.inspector && TN.cmds.inspector(true); return; } look.toggle(); };
  look.render = () => {
    if (!look.open) return;
    panel.innerHTML = '';
    const e = TN.sel.el, doc = TN.preview.doc();
    const head = el('div', 'lk-head'); head.innerHTML = '<b>' + esc(e ? TN.friendly(e) : t('Udseende')) + '</b>';
    const x = el('button', 'ix'); x.textContent = '✕'; x.title = t('Luk'); x.onclick = () => look.toggle(false); head.append(x);
    panel.append(head);
    if (!doc || !e || /^(HTML|BODY)$/.test(e.tagName)) {
      panel.append(Object.assign(el('div', 'lk-empty'), { textContent: state.js !== 'off' ? t('Siden kører lige nu. Klik på Ret i siden igen øverst for at ændre udseendet.') : t('Klik på noget i siden, fx en overskrift, et billede eller en knap. Så kan du ændre udseendet her.') }));
      return;
    }
    panel.append(Object.assign(el('div', 'lk-sub'), { textContent: t('Ændringerne gælder kun det, du har markeret. Vil du ændre hele siden, så brug Design.') }));
    const cs = doc.defaultView.getComputedStyle(e);
    const sec = (title) => { const s = el('div', 'lk-sec'); s.append(Object.assign(el('h4'), { textContent: t(title) })); panel.append(s); return s; };
    const row = (s, label, ctl) => { const r = el('div', 'lk-row'); r.append(Object.assign(el('span'), { textContent: t(label) }), ctl); s.append(r); };
    const seg = (opts, cur, fn) => { const g = el('div', 'lk-seg'); for (const [v, l] of opts) { const b = el('button', v === cur ? 'on' : ''); b.textContent = t(l); b.onclick = () => fn(v); g.append(b); } return g; };
    const sw = (prop, allowNone) => {
      const g = el('div', 'lk-sw'); const cur = e.style.getPropertyValue(prop);
      if (allowNone) { const n = el('button', 'none' + (!cur ? ' on' : '')); n.title = t('Standard'); n.onclick = () => TN.styleEl(prop, ''); g.append(n); }
      for (const c of pageColors()) { const b = el('button', cur && sameColor(cur, c) ? 'on' : ''); b.style.background = c; b.title = c; b.onclick = () => TN.styleEl(prop, c); g.append(b); }
      const ci = el('input'); ci.type = 'color'; ci.title = t('Vælg en anden farve'); ci.value = toHex(cs.getPropertyValue(prop)); ci.oninput = () => TN.styleEl(prop, ci.value); g.append(ci);
      return g;
    };
    const tag = e.tagName;
    if (TEXTY.test(tag) || e.textContent.trim()) {
      const s = sec('Tekst');
      row(s, 'Farve', sw('color', true));
      const fs = e.style.fontSize;
      row(s, 'Størrelse', seg([['0.85em', 'Mindre'], ['', 'Standard'], ['1.25em', 'Større'], ['1.6em', 'Meget større']], fs, (v) => TN.styleEl('font-size', v)));
      const bold = e.style.fontWeight;
      row(s, 'Tykkelse', seg([['', 'Standard'], ['700', 'Fed'], ['400', 'Tynd']], bold, (v) => TN.styleEl('font-weight', v)));
      row(s, 'Placering', seg([['', 'Standard'], ['left', 'Venstre'], ['center', 'Midt'], ['right', 'Højre']], e.style.textAlign, (v) => TN.styleEl('text-align', v)));
    }
    const s2 = sec('Baggrund og form');
    row(s2, 'Baggrund', sw('background-color', true));
    row(s2, 'Hjørner', seg([['', 'Standard'], ['0', 'Skarpe'], ['12px', 'Runde'], ['999px', 'Pille']], e.style.borderRadius, (v) => TN.styleEl('border-radius', v)));
    row(s2, 'Skygge', seg([['', 'Ingen'], [SKYGGE.lille, 'Lille'], [SKYGGE.stor, 'Stor']], e.style.boxShadow ? (e.style.boxShadow.includes('36px') ? SKYGGE.stor : SKYGGE.lille) : '', (v) => TN.styleEl('box-shadow', v)));
    row(s2, 'Kant', seg([['', 'Ingen'], ['1px solid rgb(0 0 0 / .15)', 'Tynd'], ['3px solid var(--tn-primaer, #2b579a)', 'Tyk']], e.style.border ? (/3px/.test(e.style.border) ? '3px solid var(--tn-primaer, #2b579a)' : '1px solid rgb(0 0 0 / .15)') : '', (v) => TN.styleEl('border', v)));
    const s3 = sec('Luft');
    const pad = e.style.padding, mar = e.style.marginTop;
    row(s3, 'Luft indeni', seg([['', 'Standard'], ['0', 'Ingen'], ['12px', 'Lidt'], ['28px', 'Meget']], pad, (v) => TN.styleEl('padding', v)));
    row(s3, 'Luft udenom', seg([['', 'Standard'], ['8px', 'Lidt'], ['32px', 'Meget']], mar, (v) => { setStyle(e, 'margin-top', v); setStyle(e, 'margin-bottom', v); commitStyle(); }));
    if (/^(IMG|DIV|FIGURE|TABLE|IFRAME|VIDEO|SECTION|ARTICLE|BLOCKQUOTE|P|UL|OL)$/.test(tag)) {
      row(s3, 'Bredde', seg([['', 'Standard'], ['50%', 'Halv'], ['100%', 'Hel']], e.style.width, (v) => TN.styleEl('width', v)));
    }
    if (tag === 'IMG') {
      const s = sec('Billede');
      const b = el('button', 'btn'); b.textContent = t('Skift billede…'); b.onclick = () => TN.blocks && TN.blocks.changeImage(e);
      s.append(b);
      const alt = el('input'); alt.type = 'text'; alt.value = e.getAttribute('alt') || ''; alt.placeholder = t('Fx: Smilende barista bag disken');
      alt.onchange = () => TN.elOps.setAttr('alt', alt.value.trim());
      row(s, 'Beskrivelse', alt);
      s.append(Object.assign(el('div', 'lk-sub'), { textContent: t('Beskrivelsen læses op for blinde og bruges af Google. Skriv kort, hvad billedet viser.'), style: 'padding:0' }));
    }
    const link = e.closest('a');
    if (link) {
      const s = sec('Link');
      const h = el('input'); h.type = 'text'; h.value = link.getAttribute('href') || '';
      h.onchange = () => { const v = TN.blocks ? TN.blocks.normalizeHref(h.value) : h.value; if (v) { link.setAttribute('href', v); TN.preview.commit(true); look.render(); } };
      row(s, 'Fører hen til', h);
      s.append(Object.assign(el('div', 'lk-sub'), { textContent: t('Skriv en webadresse, en e-mailadresse eller et telefonnummer.'), style: 'padding:0' }));
    }
    const foot = el('div', 'lk-foot');
    const reset = el('button', 'btn'); reset.textContent = t('Nulstil udseende'); reset.onclick = () => { e.removeAttribute('style'); commitStyle(); };
    const adv = el('button', 'btn'); adv.textContent = t('Flere muligheder…'); adv.title = t('Skifter til Avanceret og åbner stilpanelet');
    adv.onclick = () => { look.toggle(false); TN.setLevel('advanced'); TN.cmds.inspector(true); };
    foot.append(reset, adv); panel.append(foot);
  };
  function toHex(c) { const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : '#000000'; }
  function sameColor(a, b) { const probe = (c) => { const s = document.createElement('span'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }; return probe(a) === probe(b); }

  /* ======================= minibjælken ======================= */
  const bar = $('#minibar');
  const mb = (TN.minibar = {});
  const on = () => TN.level() === 'simple' && store.get('minibar', true) && state.js === 'off' && state.mode !== 'raw';
  function btn(content, tip, fn, cls) {
    const b = el('button', cls || ''); b.innerHTML = ICONS.has(content) ? window.WDicon(content) : esc(content); b.title = t(tip);
    b.onmousedown = (ev) => ev.preventDefault(); b.onclick = (ev) => { ev.stopPropagation(); fn(b); }; return b;
  }
  const ICONS = new Set(['palette', 'alignl', 'alignc', 'alignr', 'image', 'link', 'sliders', 'up', 'down', 'copy', 'trash']);
  const sep = () => el('span', 'mb-sep');
  function wholeIfCollapsed(e) {
    const doc = TN.preview.doc(); const s = doc.getSelection();
    if (!s.rangeCount || s.isCollapsed || !e.contains(s.anchorNode)) { const r = doc.createRange(); r.selectNodeContents(e); s.removeAllRanges(); s.addRange(r); }
  }
  function build(e) {
    bar.innerHTML = '';
    bar.append(Object.assign(el('span', 'mb-name'), { textContent: TN.friendly(e) }));
    const tag = e.tagName;
    if (TEXTY.test(tag) || (e.textContent.trim() && !/^(IMG|DIV|SECTION|MAIN|HEADER|FOOTER|ARTICLE|NAV|UL|OL|TABLE)$/.test(tag))) {
      bar.append(btn('B', 'Fed', () => { wholeIfCollapsed(e); TN.preview.exec('bold'); }), btn('I', 'Kursiv', () => { wholeIfCollapsed(e); TN.preview.exec('italic'); }), sep());
      bar.append(btn('A−', 'Mindre tekst', () => scaleFont(e, 1 / 1.15)), btn('A+', 'Større tekst', () => scaleFont(e, 1.15)));
      bar.append(btn('palette', 'Tekstfarve', (b) => colorPop(b, 'color')));
      const al = e.style.textAlign || 'left';
      bar.append(btn({ left: 'alignl', center: 'alignc', right: 'alignr' }[al] || 'alignl', 'Placering: venstre, midt eller højre', () => { const nx = { left: 'center', center: 'right', right: 'left' }[al] || 'center'; TN.styleEl('text-align', nx === 'left' ? '' : nx); build(e); }), sep());
    }
    if (tag === 'IMG') bar.append(btn('image', 'Skift billede', () => TN.blocks && TN.blocks.changeImage(e)), sep());
    if (e.closest('a')) bar.append(btn('link', 'Ret link', () => TN.blocks && TN.blocks.editLink(e.closest('a'))), sep());
    bar.append(btn('sliders', 'Udseende: farver, luft og hjørner', () => look.toggle(true)), sep());
    bar.append(btn('up', 'Flyt op', () => TN.elOps.move(-1)), btn('down', 'Flyt ned', () => TN.elOps.move(1)), btn('copy', 'Kopiér', () => TN.elOps.duplicate()), btn('trash', 'Slet', () => TN.elOps.remove()));
  }
  function scaleFont(e, k) {
    const doc = TN.preview.doc(); const px = parseFloat(doc.defaultView.getComputedStyle(e).fontSize) || 16;
    TN.styleEl('font-size', Math.round(px * k) + 'px');
  }
  function colorPop(anchor, prop) {
    const m = TN.popMenu(anchor, [], { cls: 'swatchmenu' });
    const g = el('div', 'swatches');
    const none = el('button', 'none'); none.title = t('Standard'); none.onclick = () => { TN.styleEl(prop, ''); TN.closeMenu(); }; g.append(none);
    for (const c of pageColors()) { const b = el('button'); b.style.background = c; b.title = c; b.onclick = () => { TN.styleEl(prop, c); TN.closeMenu(); }; g.append(b); }
    const cu = el('label', 'custom'); const ci = el('input'); ci.type = 'color'; ci.oninput = () => TN.styleEl(prop, ci.value); cu.append(ci, ' ' + t('Anden farve…')); g.append(cu);
    m.append(g);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.min(innerWidth - m.offsetWidth - 6, r.left) + 'px'; m.style.top = r.bottom + 4 + 'px';
  }
  let lastEl = null;
  TN.hooks.boxMoved = (rect, e) => {
    if (!rect || !e || !on() || /^(HTML|BODY|MAIN)$/.test(e.tagName)) { bar.hidden = true; lastEl = null; return; }
    if (e !== lastEl) { build(e); lastEl = e; }
    bar.hidden = false;
    const wrap = $('#pvscroll'); const h = bar.offsetHeight, w = bar.offsetWidth;
    let top = rect.top - h - 26; if (top < 4) top = rect.top + rect.height + 8;
    if (top + h > wrap.clientHeight - 4) top = Math.max(4, rect.top + 4);
    bar.style.top = top + 'px'; bar.style.left = Math.max(4, Math.min(wrap.clientWidth - w - 4, rect.left)) + 'px';
  };
  mb.update = () => { lastEl = null; TN.preview.positionSelBox(); };
  TN.hooks.onSelect = (TN.hooks.onSelect || []).concat([() => { lastEl = null; if (look.open) look.render(); }]);
})();
