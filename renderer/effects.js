/* TagNote – Effekter og CSS-hjælp: scroll-animationer, gradienter, skygger, clamp() m.m. */
(function () {
  'use strict';
  const { $, $$, t, state, ed, el, esc, api } = TN;

  /* ---------- fælles dialog: felter til venstre, live demo til højre, kode nederst ---------- */
  function fieldEl(f, onChange) {
    const l = el('label', 'f fxf'); const cap = el('span', 'fxcap'); cap.textContent = t(f.label); let i;
    if (f.type === 'select') { i = el('select'); for (const o of f.options) i.add(new Option(typeof o === 'string' ? o : t(o[1]), typeof o === 'string' ? o : o[0])); i.value = f.value; }
    else if (f.type === 'range') { i = el('input'); i.type = 'range'; i.min = f.min; i.max = f.max; i.step = f.step || 1; i.value = f.value; const o = el('span', 'fxout'); o.textContent = i.value + (f.unit || ''); i.addEventListener('input', () => { o.textContent = i.value + (f.unit || ''); }); l.append(cap, i, o); i.addEventListener('input', onChange); return { l, i }; }
    else if (f.type === 'color') { i = el('input'); i.type = 'color'; i.value = f.value; }
    else if (f.type === 'checkbox') { l.className = 'chk fxf'; i = el('input'); i.type = 'checkbox'; i.checked = !!f.value; l.append(i, cap); i.addEventListener('change', onChange); return { l, i }; }
    else { i = el('input'); i.type = f.type || 'text'; i.value = f.value; i.spellcheck = false; for (const k of ['min', 'max', 'step']) if (f[k] != null) i[k] = f[k]; }
    i.addEventListener('input', onChange); i.addEventListener('change', onChange);
    l.append(cap, i); return { l, i };
  }
  const val = (i) => (i.type === 'checkbox' ? i.checked : i.type === 'range' || i.type === 'number' ? +i.value : i.value);

  function defaultSelector(fallback) {
    const c = TN.target.mode() ? TN.target.getClass().trim().split(/\s+/).filter(Boolean)[0] : '';
    return c ? '.' + c : fallback;
  }

  async function fxDialog(def) {
    /* I Enkel gives effekten til det markerede element; man skal ikke skrive en CSS-vælger */
    const simple = TN.level && TN.level() === 'simple' && def.sel && def.simpleTarget !== false;
    let target = null, simpleSel = null;
    if (simple) {
      target = TN.sel.el;
      if (!target || !TN.preview.doc() || /^(HTML|BODY|HEAD)$/.test(target.tagName)) { TN.toast(t('Klik først på det i siden, der skal have effekten.'), 4000); return; }
      simpleSel = '.tn-' + def.title.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    }
    const wrapEl = el('div', 'fxdlg');
    const left = el('div', 'fxleft'), right = el('div', 'fxright');
    const els = {};
    const redraw = () => {
      const v = {}; for (const k of Object.keys(els)) v[k] = val(els[k]);
      const sel = simpleSel || (els.__sel ? els.__sel.value.trim() || def.sel : null);
      const css = def.css(v, sel);
      code.value = css;
      demoStyle.textContent = def.css(v, '.fxdemo ' + (def.demoSel || '.it'));
      demoBox.innerHTML = def.demo(v);
      if (def.onDraw) def.onDraw(demoBox, v);
    };
    const intro = simple && def.simpleIntro ? def.simpleIntro : def.intro;
    if (intro) left.append(Object.assign(el('p', 'muted small'), { textContent: t(intro) }));
    for (const f of def.fields) { const { l, i } = fieldEl(f, redraw); els[f.id] = i; left.append(l); }
    if (def.sel && !simple) {
      const { l, i } = fieldEl({ label: 'Vælger (hvem rammes)', type: 'text', value: defaultSelector(def.sel) }, redraw); els.__sel = i; l.classList.add('adv'); left.append(l);
    }
    if (simple) left.append(Object.assign(el('p', 'muted small'), { textContent: t('Effekten gives til: {0}', TN.friendly(target)) }));
    const demoBox = el('div', 'fxdemo' + (def.demoCls ? ' ' + def.demoCls : '')); const demoStyle = el('style');
    right.append(Object.assign(el('div', 'fxcap2'), { textContent: t('Eksempel') }), demoBox, demoStyle);
    const code = el('textarea', 'dg-code fxcode'); code.readOnly = true; code.rows = 9; code.spellcheck = false;
    const cp = el('button', 'btn'); cp.textContent = t('Kopiér CSS'); cp.onclick = async () => { const ok = await TN.copy(code.value); TN.toast(ok ? t('CSS kopieret') : t('Kunne ikke kopiere')); };
    const ci = el('button', 'btn'); ci.textContent = t('Slå op på Can I use ↗'); ci.onclick = () => api.openExternal('https://caniuse.com/?search=' + encodeURIComponent(def.caniuse || def.title));
    const foot = el('div', 'fxfoot'); foot.append(cp);
    if (def.caniuse) foot.append(ci);
    if (def.note) foot.append(Object.assign(el('span', 'muted small fxnote'), { textContent: t(def.note) }));
    const main = el('div', 'fxmain'); main.append(left, right);
    wrapEl.append(main, code, foot);
    redraw();
    const r = await TN.modal({ title: t(simple && SIMPLE_TITLES[def.title] || def.title), body: wrapEl, cls: 'fxwin', buttons: [{ text: t('Annuller') }, { text: t('Indsæt i siden'), primary: true, value: () => ({ css: code.value, sel: els.__sel ? els.__sel.value.trim() : '', v: Object.fromEntries(Object.keys(els).map((k) => [k, val(els[k])])) }) }] });
    if (!r) return;
    if (simple) {
      const cls = simpleSel.slice(1);
      if (target.isConnected && !target.classList.contains(cls)) { target.classList.add(cls); TN.preview.commit(true); }
      TN.src.styleBlock('tn-effects', r.css);
    } else if (def.apply) await def.apply(r); else TN.src.styleBlock('tn-effects', r.css);
    TN.toast(t('CSS indsat i <style id="tn-effects">'), 3200);
  }
  const SIMPLE_TITLES = { 'Scroll-animation': 'Glid ind ved rulning', 'Overgang ved hover': 'Når musen er over', Animation: 'Gentaget bevægelse', Gradient: 'Farveovergang', 'Fastholdt element': 'Fastgør øverst', 'Læsefremgang': 'Læsebjælke', Glaseffekt: 'Glas' };
  const reduce = (inner) => '@media (prefers-reduced-motion: no-preference) {\n' + inner.replace(/^/gm, '  ') + '\n}';
  const items = (n, cls = 'it') => Array.from({ length: n }, (_, i) => '<div class="' + cls + '">' + t('Element') + ' ' + (i + 1) + '</div>').join('');

  /* ======================= scroll-animation ======================= */
  const SCROLL_FX = {
    fade: ['Tone ind', 'opacity: 0;', 'opacity: 1;'],
    up: ['Glid op og tone ind', 'opacity: 0; transform: translateY(var(--d));', 'opacity: 1; transform: none;'],
    left: ['Glid ind fra venstre', 'opacity: 0; transform: translateX(calc(var(--d) * -1));', 'opacity: 1; transform: none;'],
    right: ['Glid ind fra højre', 'opacity: 0; transform: translateX(var(--d));', 'opacity: 1; transform: none;'],
    scale: ['Skalér ind', 'opacity: 0; transform: scale(0.8);', 'opacity: 1; transform: none;'],
    rotate: ['Drej ind', 'opacity: 0; transform: rotate(-8deg) scale(0.9);', 'opacity: 1; transform: none;'],
    blur: ['Fra sløret til skarp', 'opacity: 0; filter: blur(12px);', 'opacity: 1; filter: none;'],
    parallax: ['Parallakse (bevæger sig langsommere)', 'transform: translateY(calc(var(--d) * -1));', 'transform: translateY(var(--d));'],
    focus: ['Fremhæv, når midt i billedet', 'opacity: 0.35; transform: scale(0.92);', 'opacity: 1; transform: scale(1);'],
  };
  function scrollCss(v, sel) {
    const fx = SCROLL_FX[v.fx];
    const name = 'tn-scroll-' + v.fx;
    const range = v.fx === 'parallax' ? 'cover 0% cover 100%' : v.fx === 'focus' ? 'cover 0% cover 100%' : 'entry ' + v.from + '% entry ' + v.to + '%';
    const frames = v.fx === 'focus' ? '  0% { ' + fx[1] + ' }\n  50% { ' + fx[2] + ' }\n  100% { ' + fx[1] + ' }' : '  from { ' + fx[1] + ' }\n  to { ' + fx[2] + ' }';
    return '/* Scroll-animation: ' + t(fx[0]) + ' */\n@supports (animation-timeline: view()) {\n  @keyframes ' + name + ' {\n' + frames.replace(/^/gm, '  ') + '\n  }\n  @media (prefers-reduced-motion: no-preference) {\n    ' + sel + ' {\n      --d: ' + v.dist + 'px;\n      animation: ' + name + ' ' + (v.ease === 'linear' ? 'linear' : v.ease) + ' both;\n      animation-timeline: view();\n      animation-range: ' + range + ';\n    }\n  }\n}';
  }
  function scrollDemo() { return '<div class="fxscroll"><p class="muted small">' + esc(t('Rul i boksen for at se effekten')) + '</p>' + items(6) + '<p class="muted small">' + esc(t('Slut')) + '</p></div>'; }
  TN.cmds.fxScroll = () => fxDialog({
    title: 'Scroll-animation', sel: '.reveal', simpleIntro: 'Det markerede glider eller toner ind, når man ruller ned til det.', demoSel: '.it', caniuse: 'animation-timeline', demoCls: 'scrolldemo',
    intro: 'Elementet animeres, mens man ruller forbi det. Ren CSS uden JavaScript. Browsere uden støtte viser bare elementet som normalt.',
    fields: [
      { id: 'fx', label: 'Effekt', type: 'select', options: Object.entries(SCROLL_FX).map(([k, a]) => [k, a[0]]), value: 'up' },
      { id: 'dist', label: 'Afstand', type: 'range', min: 10, max: 160, step: 5, value: 48, unit: ' px' },
      { id: 'from', label: 'Starter, når elementet er kommet', type: 'range', min: 0, max: 90, step: 5, value: 0, unit: ' %' },
      { id: 'to', label: 'Færdig, når elementet er kommet', type: 'range', min: 10, max: 100, step: 5, value: 50, unit: ' %' },
      { id: 'ease', label: 'Kurve', type: 'select', options: [['linear', 'Lineær (følger fingeren)'], ['ease-out', 'Blød afslutning'], ['ease-in-out', 'Blød start og slut']], value: 'linear' },
    ],
    css: (v, sel) => scrollCss(v, sel), demo: scrollDemo,
    apply: async (r) => {
      TN.src.styleBlock('tn-effects', r.css);
      if (r.sel && r.sel[0] === '.' && TN.target.mode()) {
        const cl = r.sel.slice(1); const set = TN.target.classes();
        if (!set.has(cl)) { set.add(cl); TN.target.setClass(Array.from(set).join(' ')); TN.toast(t('Klassen {0} er givet til det markerede element.', cl), 4200); }
      }
    },
  });

  /* ======================= hover ======================= */
  const HOVER = {
    lift: ['Løft', 'transform: translateY(-4px); box-shadow: 0 12px 24px rgb(0 0 0 / .18);', 'transform, box-shadow'],
    grow: ['Forstør', 'transform: scale(1.06);', 'transform'],
    tilt: ['Vip', 'transform: rotate(-2deg) scale(1.03);', 'transform'],
    color: ['Farveskift', 'background-color: var(--to); color: var(--on);', 'background-color, color'],
    fade: ['Tone', 'opacity: .65;', 'opacity'],
    outline: ['Ramme', 'outline-color: var(--to); outline-offset: 6px;', 'outline-color, outline-offset'],
  };
  TN.cmds.fxHover = () => fxDialog({
    title: 'Overgang ved hover', sel: '.card', demoSel: '.it', caniuse: 'css-transitions',
    fields: [
      { id: 'fx', label: 'Effekt', type: 'select', options: Object.entries(HOVER).map(([k, a]) => [k, a[0]]), value: 'lift' },
      { id: 'ms', label: 'Varighed', type: 'range', min: 80, max: 800, step: 20, value: 240, unit: ' ms' },
      { id: 'ease', label: 'Kurve', type: 'select', options: ['ease', 'ease-out', 'ease-in-out', 'cubic-bezier(.2,.8,.2,1)'], value: 'cubic-bezier(.2,.8,.2,1)' },
      { id: 'to', label: 'Farve (til farveskift og ramme)', type: 'color', value: '#2b579a' },
    ],
    css: (v, sel) => {
      const h = HOVER[v.fx];
      return '/* Hover: ' + t(h[0]) + ' */\n' + sel + ' {\n  transition: ' + h[2].split(', ').map((p) => p + ' ' + v.ms + 'ms ' + v.ease).join(', ') + ';\n  --to: ' + v.to + ';\n  --on: #fff;\n}\n' + sel + ':hover,\n' + sel + ':focus-visible {\n  ' + h[1] + '\n}\n@media (prefers-reduced-motion: reduce) {\n  ' + sel + ' { transition: none; }\n}';
    },
    demo: () => '<div class="fxrow">' + items(2) + '</div>',
  });

  /* ======================= animation ======================= */
  const KEY = {
    pulse: ['Puls', '0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); }'],
    float: ['Svæv', '0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); }'],
    shake: ['Ryst', '0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); }'],
    spin: ['Rotér', 'to { transform: rotate(360deg); }'],
    blink: ['Blink', '0%, 100% { opacity: 1; } 50% { opacity: .2; }'],
    bounce: ['Hop', '0%, 100% { transform: translateY(0); animation-timing-function: ease-out; } 50% { transform: translateY(-22px); animation-timing-function: ease-in; }'],
    swing: ['Gyngen', '0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); }'],
    shine: ['Skinnende', '0% { background-position: -200% 0; } 100% { background-position: 200% 0; }'],
  };
  TN.cmds.fxKeyframes = () => fxDialog({
    title: 'Animation', sel: '.animeret', demoSel: '.it', caniuse: 'css-animation',
    fields: [
      { id: 'fx', label: 'Animation', type: 'select', options: Object.entries(KEY).map(([k, a]) => [k, a[0]]), value: 'pulse' },
      { id: 's', label: 'Varighed', type: 'range', min: 0.3, max: 6, step: 0.1, value: 1.6, unit: ' s' },
      { id: 'n', label: 'Gentagelser', type: 'select', options: [['infinite', 'Uendeligt'], ['1', 'Én gang'], ['3', 'Tre gange']], value: 'infinite' },
      { id: 'ease', label: 'Kurve', type: 'select', options: ['ease-in-out', 'linear', 'ease', 'ease-out'], value: 'ease-in-out' },
    ],
    css: (v, sel) => {
      const k = KEY[v.fx]; const shine = v.fx === 'shine' ? '\n  background-image: linear-gradient(110deg, transparent 30%, rgb(255 255 255 / .55) 50%, transparent 70%);\n  background-size: 200% 100%;' : '';
      return '/* Animation: ' + t(k[0]) + ' */\n@keyframes tn-' + v.fx + ' {\n  ' + k[1] + '\n}\n' + reduce(sel + ' {\n  animation: tn-' + v.fx + ' ' + v.s + 's ' + v.ease + ' ' + v.n + ';' + shine + '\n}');
    },
    demo: () => '<div class="fxrow">' + items(1) + '</div>',
  });

  /* ======================= gradient ======================= */
  TN.cmds.fxGradient = () => fxDialog({
    title: 'Gradient', sel: '.gradient', demoSel: '.big', caniuse: 'css-gradients', demoCls: 'fxbig',
    fields: [
      { id: 'type', label: 'Type', type: 'select', options: [['linear', 'Lige (fra side til side)'], ['radial', 'Rund (fra midten)'], ['conic', 'Rundt om (som et farvehjul)']], value: 'linear' },
      { id: 'angle', label: 'Vinkel', type: 'range', min: 0, max: 360, step: 5, value: 135, unit: '°' },
      { id: 'c1', label: 'Farve 1', type: 'color', value: '#2b579a' },
      { id: 'c2', label: 'Farve 2', type: 'color', value: '#7bc4e8' },
      { id: 'c3', label: 'Farve 3 (valgfri)', type: 'color', value: '#ffffff' },
      { id: 'use3', label: 'Brug farve 3', type: 'checkbox', value: false },
      { id: 'text', label: 'Brug som tekstfarve', type: 'checkbox', value: false },
    ],
    css: (v, sel) => {
      const stops = [v.c1, v.c2].concat(v.use3 ? [v.c3] : []).join(', ');
      const g = v.type === 'linear' ? 'linear-gradient(' + v.angle + 'deg, ' + stops + ')' : v.type === 'radial' ? 'radial-gradient(circle at center, ' + stops + ')' : 'conic-gradient(from ' + v.angle + 'deg, ' + stops + ', ' + v.c1 + ')';
      return sel + ' {\n  background: ' + v.c1 + ';\n  background-image: ' + g + ';' + (v.text ? '\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;' : '') + '\n}';
    },
    demo: () => '<div class="big">' + esc(t('Gradient')) + '</div>',
  });

  /* ======================= skygge ======================= */
  const SH = { soft: ['Blød', [[0, 1, 2, 0, 0.08], [0, 4, 12, 0, 0.1], [0, 12, 28, 0, 0.1]]], hard: ['Kraftig', [[0, 2, 0, 0, 0.25], [0, 10, 30, -4, 0.35]]], glow: ['Glød', [[0, 0, 24, 2, 0.45]]], inset: ['Indlejret', [[0, 2, 6, 0, 0.35, 1]]], layered: ['Lagdelt', [[0, 1, 1, 0, 0.12], [0, 2, 2, 0, 0.12], [0, 4, 4, 0, 0.12], [0, 8, 8, 0, 0.12], [0, 16, 16, 0, 0.12]]] };
  TN.cmds.fxShadow = () => fxDialog({
    title: 'Skygge', sel: '.skygge', demoSel: '.big', caniuse: 'box-shadow', demoCls: 'fxbig',
    fields: [
      { id: 'p', label: 'Udgangspunkt', type: 'select', options: Object.entries(SH).map(([k, a]) => [k, a[0]]), value: 'soft' },
      { id: 'k', label: 'Styrke', type: 'range', min: 0.2, max: 2.5, step: 0.1, value: 1, unit: '×' },
      { id: 'c', label: 'Farve', type: 'color', value: '#1b2a4a' },
    ],
    css: (v, sel) => {
      const hex = v.c; const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
      const layers = SH[v.p][1].map(([x, y, b, s, a, inset]) => (inset ? 'inset ' : '') + Math.round(x * v.k) + 'px ' + Math.round(y * v.k) + 'px ' + Math.round(b * v.k) + 'px ' + Math.round(s * v.k) + 'px rgb(' + rgb + ' / ' + Math.min(1, +(a * (v.p === 'glow' ? 1 : Math.min(1.4, v.k))).toFixed(2)) + ')');
      return sel + ' {\n  box-shadow:\n    ' + layers.join(',\n    ') + ';\n}';
    },
    demo: () => '<div class="big plain">' + esc(t('Skygge')) + '</div>',
  });

  /* ======================= glas ======================= */
  TN.cmds.fxGlass = () => fxDialog({
    title: 'Glaseffekt', sel: '.glas', demoSel: '.glass', caniuse: 'css-backdrop-filter', demoCls: 'fxglassbox',
    intro: 'Frostet baggrund, der slører det, der ligger bagved.',
    fields: [
      { id: 'blur', label: 'Sløring', type: 'range', min: 0, max: 40, step: 1, value: 14, unit: ' px' },
      { id: 'sat', label: 'Farvemætning', type: 'range', min: 80, max: 220, step: 5, value: 160, unit: ' %' },
      { id: 'a', label: 'Hvidt lag', type: 'range', min: 0, max: 80, step: 1, value: 22, unit: ' %' },
      { id: 'r', label: 'Afrunding', type: 'range', min: 0, max: 40, step: 1, value: 18, unit: ' px' },
    ],
    css: (v, sel) => sel + ' {\n  background: rgb(255 255 255 / ' + v.a + '%);\n  -webkit-backdrop-filter: blur(' + v.blur + 'px) saturate(' + v.sat + '%);\n  backdrop-filter: blur(' + v.blur + 'px) saturate(' + v.sat + '%);\n  border: 1px solid rgb(255 255 255 / .35);\n  border-radius: ' + v.r + 'px;\n}',
    demo: () => '<div class="glass">' + esc(t('Frostet glas')) + '</div>',
  });

  /* ======================= scroll-snap ======================= */
  TN.cmds.fxSnap = () => fxDialog({
    title: 'Scroll-snap', sel: '.rulleboks', demoSel: '.snap', caniuse: 'css-snappoints', demoCls: 'fxsnapbox',
    intro: 'Vælgeren er beholderen. Dens direkte børn låser sig fast, når man ruller.',
    fields: [
      { id: 'dir', label: 'Retning', type: 'select', options: [['x', 'Vandret'], ['y', 'Lodret']], value: 'x' },
      { id: 'strict', label: 'Strenghed', type: 'select', options: [['mandatory', 'Altid (mandatory)'], ['proximity', 'Når man er tæt på (proximity)']], value: 'mandatory' },
      { id: 'al', label: 'Justering', type: 'select', options: [['start', 'Start'], ['center', 'Midten']], value: 'start' },
    ],
    css: (v, sel) => sel + ' {\n  display: flex;\n  ' + (v.dir === 'x' ? 'overflow-x: auto;\n  scroll-snap-type: x ' : 'flex-direction: column;\n  overflow-y: auto;\n  scroll-snap-type: y ') + v.strict + ';\n  scroll-behavior: smooth;\n}\n' + sel + ' > * {\n  flex: 0 0 ' + (v.dir === 'x' ? '80%' : '100%') + ';\n  scroll-snap-align: ' + v.al + ';\n}',
    demo: (v) => '<div class="snap">' + ['A', 'B', 'C', 'D'].map((x) => '<div class="it">' + x + '</div>').join('') + '</div>',
  });

  /* ======================= sticky ======================= */
  TN.cmds.fxSticky = () => fxDialog({
    title: 'Fastholdt element', sel: 'header', demoSel: '.stick', caniuse: 'css-sticky', demoCls: 'fxstickybox',
    fields: [
      { id: 'top', label: 'Afstand fra toppen', type: 'range', min: 0, max: 80, step: 2, value: 0, unit: ' px' },
      { id: 'blur', label: 'Glas bag elementet', type: 'checkbox', value: true },
    ],
    css: (v, sel) => sel + ' {\n  position: sticky;\n  top: ' + v.top + 'px;\n  z-index: 10;\n  background: ' + (v.blur ? 'rgb(255 255 255 / .8);\n  backdrop-filter: blur(10px)' : 'white') + ';\n}',
    demo: () => '<div class="scrollpane"><div class="stick">' + esc(t('Menu')) + '</div>' + items(6, 'it') + '</div>',
  });

  /* ======================= læsefremgang ======================= */
  TN.cmds.fxProgress = () => fxDialog({
    title: 'Læsefremgang', sel: '.fremgang', simpleTarget: false, demoSel: '.bar', caniuse: 'animation-timeline', demoCls: 'fxprogressbox',
    intro: 'En bjælke øverst, der vokser, mens man ruller. Ren CSS. Elementet <div class="fremgang"></div> indsættes øverst i siden.',
    fields: [
      { id: 'c', label: 'Farve', type: 'color', value: '#2b579a' },
      { id: 'h', label: 'Højde', type: 'range', min: 2, max: 12, step: 1, value: 4, unit: ' px' },
    ],
    css: (v, sel) => '@supports (animation-timeline: scroll()) {\n  @keyframes tn-fremgang {\n    from { transform: scaleX(0); }\n    to { transform: scaleX(1); }\n  }\n  ' + sel + ' {\n    position: fixed;\n    inset: 0 0 auto 0;\n    height: ' + v.h + 'px;\n    background: ' + v.c + ';\n    transform-origin: 0 50%;\n    transform: scaleX(0);\n    animation: tn-fremgang linear both;\n    animation-timeline: scroll(root);\n    z-index: 100;\n  }\n}',
    demo: () => '<div class="scrollpane"><div class="bar"></div>' + items(6, 'it') + '</div>',
    onDraw: (box) => { const bar = box.querySelector('.bar'); const pane = box.querySelector('.scrollpane'); if (bar && pane) { const upd = () => { const m = pane.scrollHeight - pane.clientHeight; bar.style.transform = 'scaleX(' + (m ? pane.scrollTop / m : 0) + ')'; }; pane.addEventListener('scroll', upd); upd(); } },
    apply: async (r) => {
      TN.src.styleBlock('tn-effects', r.css);
      const cl = (r.sel || '.fremgang').replace(/^\./, '');
      if (!new RegExp('class="[^"]*\\b' + cl + '\\b').test(ed.value)) {
        const m = /<body[^>]*>/i.exec(ed.value);
        if (m) { const at = m.index + m[0].length; TN.src.replace(at, at, '\n  <div class="' + cl + '" aria-hidden="true"></div>'); }
      }
    },
  });

  /* ======================= flydende størrelse (clamp) ======================= */
  TN.cmds.fluid = () => fxDialog({
    title: 'Flydende størrelse', sel: 'h1', demoSel: '.it', caniuse: 'css-math-functions',
    intro: 'Beregner clamp(), så en størrelse vokser jævnt mellem to skærmbredder.',
    fields: [
      { id: 'prop', label: 'Egenskab', type: 'select', options: ['font-size', 'padding', 'margin', 'gap', 'width', 'line-height'], value: 'font-size' },
      { id: 'min', label: 'Mindste størrelse (px)', type: 'number', value: 24, min: 0, step: 1 },
      { id: 'max', label: 'Største størrelse (px)', type: 'number', value: 56, min: 0, step: 1 },
      { id: 'vmin', label: 'Fra skærmbredde (px)', type: 'number', value: 360, min: 200, step: 10 },
      { id: 'vmax', label: 'Til skærmbredde (px)', type: 'number', value: 1280, min: 400, step: 10 },
    ],
    css: (v, sel) => {
      const slope = (v.max - v.min) / (v.vmax - v.vmin), inter = v.min - slope * v.vmin;
      const f = (n) => +(n).toFixed(4);
      const expr = 'clamp(' + f(v.min / 16) + 'rem, ' + f(inter / 16) + 'rem + ' + f(slope * 100) + 'vw, ' + f(v.max / 16) + 'rem)';
      return sel + ' {\n  ' + v.prop + ': ' + expr + ';\n}';
    },
    demo: (v) => {
      const slope = (v.max - v.min) / (v.vmax - v.vmin), inter = v.min - slope * v.vmin;
      const at = (w) => Math.round(Math.min(v.max, Math.max(v.min, inter + slope * w)) * 10) / 10;
      return '<table class="fxtab"><tr><th>' + esc(t('Skærmbredde')) + '</th><th>' + esc(v.prop) + '</th></tr>' + [360, 480, 768, 1024, 1280, 1600].map((w) => '<tr><td>' + w + ' px</td><td>' + at(w) + ' px</td></tr>').join('') + '</table>';
    },
  });

  /* ======================= farvepalet (OKLCH) ======================= */
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  function hexToOklch(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
  }
  const SH_L = { 50: 0.975, 100: 0.945, 200: 0.89, 300: 0.82, 400: 0.73, 500: 0.64, 600: 0.55, 700: 0.47, 800: 0.39, 900: 0.31, 950: 0.23 };
  TN.cmds.palette = () => fxDialog({
    title: 'Farvepalet', sel: ':root', demoSel: '.sw', caniuse: 'css-color-function', demoCls: 'fxpal',
    intro: 'Vælg en grundfarve og få elleve nuancer fra lys til mørk som CSS-variabler i OKLCH.',
    fields: [
      { id: 'name', label: 'Navn', type: 'text', value: 'brand' },
      { id: 'c', label: 'Grundfarve', type: 'color', value: '#2b579a' },
      { id: 'chroma', label: 'Farvemætning', type: 'range', min: 40, max: 140, step: 5, value: 100, unit: ' %' },
    ],
    css: (v, sel) => {
      const o = hexToOklch(v.c); const lines = Object.entries(SH_L).map(([k, L]) => {
        const edge = 1 - Math.abs(L - 0.6) * 1.1; const C = Math.max(0.01, o.C * (v.chroma / 100) * Math.min(1, Math.max(0.25, edge)));
        return '  --' + (v.name || 'brand') + '-' + k + ': oklch(' + L.toFixed(3) + ' ' + C.toFixed(3) + ' ' + o.H.toFixed(1) + ');';
      });
      return sel + ' {\n' + lines.join('\n') + '\n}';
    },
    demo: (v) => { const o = hexToOklch(v.c); return '<div class="swrow">' + Object.entries(SH_L).map(([k, L]) => { const edge = 1 - Math.abs(L - 0.6) * 1.1; const C = Math.max(0.01, o.C * (v.chroma / 100) * Math.min(1, Math.max(0.25, edge))); return '<div class="sw" style="background:oklch(' + L + ' ' + C.toFixed(3) + ' ' + o.H.toFixed(1) + ')"><span>' + k + '</span></div>'; }).join('') + '</div>'; },
  });

  /* ======================= CSS-variabler ======================= */
  TN.cmds.vars = async () => {
    const text = ed.value; const found = [];
    for (const m of text.matchAll(/(:root|html|body)\s*\{([^{}]*)\}/g)) {
      const base = m.index + m[0].indexOf('{') + 1;
      for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;{}]+?)\s*(;|$)/g)) found.push({ name: d[1], value: d[2], at: base + d.index + d[0].indexOf(':') + 1, len: d[0].length - d[0].indexOf(':') - 1 - d[3].length });
    }
    if (!found.length) { TN.toast(t('Siden har ingen CSS-variabler på :root. Brug Farvepalet til at lave nogle.'), 4500); return; }
    const body = el('div', 'varlist'); const inputs = [];
    for (const f of found) {
      const row = el('div', 'varrow'); const isColor = /^(#[0-9a-f]{3,8}|rgb|hsl|oklch)/i.test(f.value);
      const lab = Object.assign(el('code'), { textContent: f.name }); const i = el('input'); i.type = 'text'; i.value = f.value; i.spellcheck = false;
      row.append(lab, i);
      if (isColor) { const c = el('input'); c.type = 'color'; const probe = el('span'); probe.style.color = f.value; document.body.append(probe); const rgb = getComputedStyle(probe).color; probe.remove(); const mm = /(\d+)\D+(\d+)\D+(\d+)/.exec(rgb); if (mm) c.value = '#' + [mm[1], mm[2], mm[3]].map((x) => (+x).toString(16).padStart(2, '0')).join(''); c.oninput = () => { i.value = c.value; }; row.append(c); }
      body.append(row); inputs.push([f, i]);
    }
    const r = await TN.modal({ title: t('CSS-variabler'), body, wide: true, buttons: [{ text: t('Annuller') }, { text: t('Anvend'), primary: true, value: () => inputs.map(([f, i]) => ({ f, v: i.value.trim() })) }] });
    if (!r) return;
    let out = text;
    for (const { f, v } of r.sort((a, b) => b.f.at - a.f.at)) if (v && v !== f.value) out = out.slice(0, f.at) + ' ' + v + out.slice(f.at + f.len);
    if (out !== text) TN.src.setAll(out);
  };

  /* ======================= skrifttyper ======================= */
  const FONT_PAIRS = [['Inter', 'Space Grotesk', 'sans-serif'], ['Source Sans 3', 'Playfair Display', 'serif'], ['Open Sans', 'Merriweather', 'serif'], ['Lora', 'Poppins', 'sans-serif'], ['DM Sans', 'DM Serif Display', 'serif'], ['Roboto', 'Roboto Slab', 'serif'], ['Libre Baskerville', 'Work Sans', 'sans-serif'], ['Fira Sans', 'Fira Code', 'monospace']];
  TN.cmds.menuFonts = () => TN.popMenu($('[data-cmd="menuFonts"]'), [{ head: 'Skrifttypepar (Google Fonts, kræver internet)' }].concat(FONT_PAIRS.map(([body, head, fall]) => ({
    label: head + ' + ' + body, raw: true, hint: t('overskrift + tekst'), onClick: () => {
      const fam = (n) => 'family=' + n.replace(/ /g, '+') + ':wght@400;600;700';
      TN.src.headInsert('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?' + fam(head) + '&' + fam(body) + '&display=swap" rel="stylesheet">');
      TN.src.styleBlock('tn-effects', 'body {\n  font-family: "' + body + '", system-ui, sans-serif;\n}\nh1, h2, h3, h4 {\n  font-family: "' + head + '", ' + (head === 'Fira Code' ? 'monospace' : 'serif') + ';\n}');
      TN.toast(t('Skrifttyper tilføjet.'));
    } }))));

  /* ======================= kontrol ======================= */
  const frameworkLoad = (id) => (TN.fw ? TN.fw.refresh : null);
  /* Kontrol af siden: almindeligt dansk i Enkel, og "Ret" til det, TagNote kan rette selv */
  const PLAIN = {
    'Mangler <!DOCTYPE html>. Browseren går i quirks-tilstand, og layoutet kan opføre sig anderledes.': 'Siden mangler en startlinje, der fortæller browseren, at den er moderne. Uden den kan siden se forkert ud.',
    'Mangler lang på <html>. Skærmlæsere og oversættelse har brug for sproget.': 'Siden fortæller ikke, hvilket sprog den er skrevet på. Det har skærmlæsere og oversættelse brug for.',
    'Mangler <meta charset="utf-8">. Specialtegn kan blive vist forkert.': 'Siden fortæller ikke, hvordan æ, ø og å skal vises. De kan blive til mærkelige tegn.',
    'Mangler <meta name="viewport">. Siden vises som en zoomet skrivebordsside på telefoner.': 'Siden er ikke sat op til telefoner, så den bliver meget lille på en mobil.',
    'Mangler <title> eller titlen er tom.': 'Siden har ingen titel. Titlen vises i browserens fane og i Google.',
    'Mangler <meta name="description">. Søgemaskiner bruger den som beskrivelse.': 'Siden har ingen beskrivelse til Google.',
    'Billedet mangler alt-tekst: {0}': 'Et billede mangler en beskrivelse: {0}',
    'Link uden href.': 'Et link fører ingen steder hen.',
    'Link uden mål (href er tom eller #).': 'Et link fører ingen steder hen.',
    'Linket har ingen tekst, som skærmlæsere kan læse op.': 'Et link har ingen tekst.',
    'target="_blank" bør have rel="noopener".': 'Et link åbner et nyt vindue på en måde, der ikke er helt sikker.',
    'Knappen har ingen tekst eller aria-label.': 'En knap har ingen tekst.',
    'Formularfeltet har ingen label.': 'Et felt i en formular har intet navn.',
    'id="{0}" bruges flere gange.': 'To dele af siden har samme navn ({0}). Links til dem kan hoppe forkert.',
    'Siden har ingen <h1>.': 'Siden har ingen hovedoverskrift.',
    'Siden har {0} <h1>-overskrifter.': 'Siden har {0} hovedoverskrifter. Normalt har en side kun én.',
    'Overskriftsniveau springes over: <h{0}> efterfølges af <h{1}>.': 'En overskrift springer et niveau over. Det gør siden sværere at overskue for skærmlæsere.',
    '<{0}> er forældet. Brug CSS i stedet.': 'Siden bruger gammel kode (<{0}>), som ikke bør bruges mere.',
  };
  const K = { doctype: 'Mangler <!DOCTYPE html>. Browseren går i quirks-tilstand, og layoutet kan opføre sig anderledes.', lang: 'Mangler lang på <html>. Skærmlæsere og oversættelse har brug for sproget.', charset: 'Mangler <meta charset="utf-8">. Specialtegn kan blive vist forkert.', viewport: 'Mangler <meta name="viewport">. Siden vises som en zoomet skrivebordsside på telefoner.', title: 'Mangler <title> eller titlen er tom.', desc: 'Mangler <meta name="description">. Søgemaskiner bruger den som beskrivelse.', alt: 'Billedet mangler alt-tekst: {0}', blank: 'target="_blank" bør have rel="noopener".' };
  async function domEl(x) {
    await TN.ensureEditable();
    const d = TN.preview.doc(); return d ? d.querySelectorAll(x.tag)[x.idx] : null;
  }
  const FIX = {
    [K.doctype]: async () => TN.src.replace(0, 0, '<!DOCTYPE html>\n'),
    [K.lang]: async () => TN.htmlAttr('lang', window.WDi18n.lang()),
    [K.charset]: async () => TN.src.headInsert('<meta charset="utf-8">'),
    [K.viewport]: async () => TN.src.headInsert('<meta name="viewport" content="width=device-width, initial-scale=1">'),
    [K.title]: async () => {
      const r = await TN.ask({ title: 'Sidens titel', intro: t('Titlen vises i browserens fane og som overskrift i Google. Skriv fx navnet på din forretning.'), fields: [{ id: 'v', label: 'Titel', value: '' }] });
      if (!r || !r.v) return;
      const m = /(<title[^>]*>)([^<]*)(<\/title>)/i.exec(ed.value);
      if (m) TN.src.replace(m.index + m[1].length, m.index + m[1].length + m[2].length, esc(r.v)); else TN.src.headInsert('<title>' + esc(r.v) + '</title>');
    },
    [K.desc]: async () => {
      const r = await TN.ask({ title: 'Beskrivelse til Google', intro: t('Skriv en eller to sætninger om, hvad siden handler om. Google viser den under titlen.'), fields: [{ id: 'v', label: 'Beskrivelse', type: 'textarea', value: '' }] });
      if (r && r.v) TN.src.headInsert('<meta name="description" content="' + TN.escAttr(r.v) + '">');
    },
    [K.alt]: async (x) => {
      const e = await domEl(x); if (!e) return;
      TN.sel.set(e); e.scrollIntoView({ block: 'center' });
      const r = await TN.ask({ title: 'Beskriv billedet', intro: t('Skriv kort, hvad billedet viser. Beskrivelsen læses op for blinde og bruges af Google.'), fields: [{ id: 'v', label: 'Beskrivelse', value: '' }] });
      if (r && r.v) TN.elOps.setAttr('alt', r.v);
    },
    [K.blank]: async (x) => { const e = await domEl(x); if (e) { TN.sel.set(e); TN.elOps.setAttr('rel', 'noopener'); } },
  };
  function lintRows(body, close) {
    body.innerHTML = '';
    const simple = TN.level && TN.level() === 'simple';
    const list = TN.lint(ed.value).filter((x) => !(simple && /^Ukendt /.test(x.key)));
    const counts = { fejl: 0, advarsel: 0, info: 0 }; for (const x of list) counts[x.level]++;
    const head = el('p', 'lintsum');
    head.textContent = !list.length ? t('Ingen fund. Siden består kontrollen.') : simple ? t('TagNote fandt {0} ting, der kan forbedres.', list.length) : t('{0} fejl · {1} advarsler · {2} bemærkninger', counts.fejl, counts.advarsel, counts.info);
    body.append(head);
    for (const x of list) {
      const r = el('div', 'lintrow ' + x.level);
      const label = simple ? { fejl: 'Vigtigt', advarsel: 'Bør rettes', info: 'Godt at vide' }[x.level] : { fejl: 'Fejl', advarsel: 'Advarsel', info: 'Info' }[x.level];
      r.innerHTML = '<i class="lv">' + esc(t(label)) + '</i><span></span><span class="lintbtns"></span>';
      r.querySelector('span').textContent = t(simple && PLAIN[x.key] ? PLAIN[x.key] : x.key, ...(x.args || []));
      const btns = r.querySelector('.lintbtns');
      if (FIX[x.key]) { const b = el('button', 'btn primary'); b.textContent = t('Ret'); b.onclick = async () => { await FIX[x.key](x); setTimeout(() => lintRows(body, close), 350); }; btns.append(b); }
      if (x.tag) {
        const b = el('button', 'btn'); b.textContent = t('Vis');
        b.onclick = async () => {
          if (simple) { const e = await domEl(x); if (e) { close(); TN.sel.set(e); e.scrollIntoView({ block: 'center' }); } return; }
          const rg = TN.map.rangeOf(ed.value, x.tag, x.idx);
          if (rg) { close(); if (state.mode === 'read') TN.setMode('split'); ed.focus(); ed.setSelectionRange(rg.start, rg.openEnd); TN.map.scrollToOffset(rg.start); }
        };
        btns.append(b);
      }
      body.append(r);
    }
  }
  TN.cmds.lint = async () => {
    const body = el('div', 'lintlist');
    const close = () => { const o = document.querySelector('#modalRoot .overlay'); if (o) o.querySelector('.foot .btn').click(); };
    lintRows(body, close);
    await TN.modal({ title: t(TN.level && TN.level() === 'simple' ? 'Tjek siden' : 'Kontrol af siden'), body, wide: true, buttons: [{ text: t('Luk'), primary: true }] });
  };

  /* ======================= støtteoplysning ======================= */
  TN.ready.push(() => {
    const ua = /Chrome\/(\d+)/.exec(navigator.userAgent); const v = ua ? ua[1] : '?';
    const ok = (q) => { try { return CSS.supports(q); } catch (_) { return false; } };
    const feats = [['scroll-animationer', ok('animation-timeline: view()')], [':has()', ok('selector(:has(a))')], ['container queries', ok('container-type: inline-size')], ['anchor positioning', ok('anchor-name: --a')], ['oklch()', ok('color: oklch(0.6 0.1 200)')]];
    const box = $('#fxSupport'); if (!box) return;
    box.innerHTML = esc(t('Visningen bruger Chromium {0}.', v)) + '<br>' + feats.map(([n, y]) => '<span class="' + (y ? 'okk' : 'nok') + '">' + (y ? '✓ ' : '✗ ') + esc(n) + '</span>').join(' · ');
  });
})();
