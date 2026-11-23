/* TagNote – Enkel tilstand: niveau, indstillinger, beskeder, hjælp og rundvisning */
(function () {
  'use strict';
  const { $, $$, t, state, ed, el, esc, store, api } = TN;
  const level = () => document.body.dataset.level || 'simple';
  TN.level = level;

  /* ======================= niveau ======================= */
  function setLevel(l, quiet) {
    document.body.dataset.level = l;
    store.set('level', l);
    if (l === 'simple') {
      TN.setMode(store.get('simpleCode', false) ? 'split' : 'read');
      if (!state.edit) { $('#optEdit').checked = true; TN.preview.setEdit(true); store.set('edit', true); }
      if (TN.inspector) TN.inspector.toggle(false);
      if (/^(tools|fw-)/.test(TN.curTab || '')) TN.showTab('home');
    } else {
      TN.setMode(store.get('advMode', 'split'));
      if (TN.look) TN.look.toggle(false);
    }
    updateCodeBtn();
    TN.preview.layout(); TN.preview.positionSelBox();
    updateBanner();
    if (!quiet) TN.toast(l === 'simple' ? t('Enkel: koden og de tekniske værktøjer er skjult.') : t('Avanceret: koden og alle værktøjer er fremme.'), 3500);
  }
  TN.setLevel = setLevel;
  function updateCodeBtn() {
    const b = $('#codeToggle'); if (!b) return;
    const shown = state.mode !== 'read';
    b.classList.toggle('on', shown);
    b.querySelector('span').textContent = shown ? t('Skjul koden') : t('Vis koden');
  }
  TN.updateCodeBtn = updateCodeBtn;

  /* ======================= kommandoer ======================= */
  const needSel = () => { if (TN.sel.el && TN.preview.doc()) return true; TN.toast(t('Klik først på noget i siden.'), 3000); return false; };
  Object.assign(TN.cmds, {
    toggleLevel: () => setLevel(level() === 'simple' ? 'advanced' : 'simple'),
    toggleCode: () => { TN.setMode(state.mode === 'read' ? 'split' : 'read'); updateCodeBtn(); },
    moveUp: () => needSel() && TN.elOps.move(-1),
    moveDown: () => needSel() && TN.elOps.move(1),
    duplicate: () => needSel() && TN.elOps.duplicate(),
    removeEl: () => needSel() && TN.elOps.remove(),
    settings: () => settingsDialog(),
    tour: () => tour(0),
  });

  /* ======================= indstillinger ======================= */
  async function settingsDialog() {
    const body = el('div', 'settings');
    const sec = (title) => { const h = el('h4', 'set-h'); h.textContent = t(title); body.append(h); };
    sec('Hvor meget vil du se?');
    const lv = el('div', 'gallery two');
    let chosen = level();
    const card = (id, title, text) => {
      const b = el('button', 'gcard' + (chosen === id ? ' on' : ''));
      b.innerHTML = '<b>' + esc(t(title)) + '</b><small>' + esc(t(text)) + '</small>';
      b.onclick = () => { chosen = id; $$('.gcard', lv).forEach((x) => x.classList.toggle('on', x === b)); };
      lv.append(b);
    };
    card('simple', 'Enkel', 'Til dig, der vil lave en side uden at kende kode. Koden og de tekniske værktøjer er skjult.');
    card('advanced', 'Avanceret', 'Viser koden og alle værktøjer: frameworks, JavaScript, CSS-hjælp og flere eksportformater.');
    body.append(lv);
    sec('Programmets farver');
    const th = el('div', 'set-themes');
    for (const [id, name] of [['light', 'Lys'], ['dark', 'Mørk'], ['sepia', 'Sepia'], ['wordblue', 'Word Blue']]) {
      const b = el('button', 'rb big theme' + (state.theme === id ? ' on' : '')); b.innerHTML = '<i class="sw sw-' + { light: 'light', dark: 'dark', sepia: 'sepia', wordblue: 'blue' }[id] + '"></i><span>' + esc(t(name)) + '</span>';
      b.onclick = () => { TN.setTheme(id); $$('.rb', th).forEach((x) => x.classList.toggle('on', x === b)); };
      th.append(b);
    }
    body.append(th);
    sec('Sprog');
    const lang = $('#langSel2').cloneNode(true); lang.id = 'setLang'; lang.value = $('#langSel2').value; lang.className = 'sel wide'; body.append(lang);
    sec('Andet');
    const chk = (label, val) => { const l = el('label', 'chk'); const i = el('input'); i.type = 'checkbox'; i.checked = val; l.append(i, ' ' + t(label)); body.append(l); return i; };
    const mb = chk('Vis den lille værktøjslinje, når jeg klikker på noget i siden', store.get('minibar', true));
    const up = chk('Søg automatisk efter nye versioner af TagNote', $('#optUpdates').checked);
    const again = el('button', 'btn'); again.textContent = t('Vis rundvisningen igen'); again.style.alignSelf = 'flex-start';
    let runTour = false; again.onclick = () => { runTour = true; document.querySelector('#modalRoot .overlay .btn.primary').click(); };
    body.append(again);
    const ok = await TN.modal({ title: t('Indstillinger'), body, wide: true, buttons: [{ text: t('Annuller') }, { text: t('OK'), primary: true, value: () => true }] });
    if (!ok) return;
    store.set('minibar', mb.checked);
    $('#optUpdates').checked = up.checked; store.set('autoUpdate', up.checked);
    if (lang.value !== $('#langSel2').value) { $('#langSel2').value = lang.value; $('#langSel2').dispatchEvent(new Event('change')); }
    if (chosen !== level()) setLevel(chosen);
    if (TN.minibar) TN.minibar.update();
    if (runTour) setTimeout(() => tour(0), 200);
  }

  /* ======================= besked i visningen ======================= */
  const dismissed = new Set();
  function scriptInfo() {
    const tags = [...ed.value.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/data-tn-inject|type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/tailwindcss)/i.test(m[1]));
    const known = TN.fw ? TN.fw.knownScripts(ed.value) : [];
    return { count: tags.length, allKnown: tags.length > 0 && tags.length === known.length };
  }
  function banner(msg, actions) {
    const b = $('#pvBanner'); b.innerHTML = '';
    const m = el('span', 'msg'); m.textContent = msg; b.append(m);
    for (const [label, fn, primary] of actions) { const x = el('button', 'btn' + (primary ? ' primary' : '')); x.textContent = label; x.onclick = fn; b.append(x); }
    b.hidden = false;
  }
  function updateBanner() {
    const b = $('#pvBanner');
    if (level() !== 'simple' || state.mode === 'raw') { b.hidden = true; return; }
    if (state.js !== 'off') { banner(t('Siden kører nu, så du kan prøve menuer og knapper. Du kan ikke rette i siden imens.'), [[t('Ret i siden igen'), () => TN.setJs('off'), true]]); return; }
    const info = scriptInfo(); const key = state.path || 'ny';
    if (info.count && !dismissed.has(key)) {
      banner(t('Siden har funktioner, der først virker, når siden køres, fx menuer der folder ud.'), [
        [t('Prøv siden'), () => TN.setJs(info.allKnown ? 'known' : 'on'), true],
        [t('Skjul'), () => { dismissed.add(key); updateBanner(); }],
      ]);
      return;
    }
    b.hidden = true;
  }
  TN.updateBanner = updateBanner;
  TN.hooks.rendered = ((old) => () => { old && old(); updateBanner(); updateCodeBtn(); })(TN.hooks.rendered);

  /* ======================= hjælp på grupperne ======================= */
  const HELP = {
    document: ['Ny, åbn og gem', 'Ny giver dig en færdig side at starte fra. Gem lægger siden i en mappe på computeren, sammen med dens billeder.'],
    share: ['Del og gendan', 'Gem som PDF laver en kopi, du kan sende eller udskrive. Tidligere versioner henter en ældre udgave af siden tilbage. TagNote gemmer en kopi hvert minut.'],
    text: ['Tekst', 'Markér noget tekst i siden, og gør den fed, kursiv eller farvet. I listen øverst vælger du, om teksten er almindelig tekst eller en overskrift.'],
    paragraph: ['Afsnit', 'Lav punktlister og nummererede lister, og vælg om teksten står til venstre, i midten eller til højre.'],
    selected: ['Det markerede', 'Klik på noget i siden, fx en overskrift, et billede eller en knap. Så kan du ændre udseendet, flytte det op eller ned, kopiere eller slette det.'],
    insertText: ['Tekst', 'Klik det sted i siden, hvor det nye skal stå. Så kommer det lige under. Bagefter kan du skrive direkte i det.'],
    insertMedia: ['Billeder og video', 'Billeder kopieres med ind i hjemmesidens mappe, så de altid virker. Videoer indsættes med et link fra YouTube eller Vimeo.'],
    insertLinks: ['Knapper og links', 'En knap eller et link fører til en anden side, en hjemmeside, en e-mailadresse eller et telefonnummer.'],
    insertLayout: ['Opsætning', 'Kolonner og kort sætter ting ved siden af hinanden. På en telefon kommer de automatisk under hinanden.'],
    devices: ['Se siden som på', 'Se, hvordan siden ser ud på en computer, en tablet og en telefon. Fuld bruger hele vinduet.'],
    code: ['Kode', 'En hjemmeside er skrevet i HTML-kode. Du behøver ikke at bruge den, men du kan se, hvordan dine ændringer bliver til kode.'],
    designPage: ['Hele siden', 'Vælg farver og skrift til hele siden på én gang, og hvor meget luft og hvor runde hjørner der skal være.'],
    motion: ['Bevægelse', 'Klik først på det i siden, der skal bevæge sig. Vælg så en bevægelse, fx at det glider ind, når man ruller ned.'],
    surface: ['Overflade', 'Giv det markerede en farveovergang, en skygge eller en frostet glaseffekt.'],
    scrolling: ['Rulning', 'Fastgør fx menuen, så den bliver øverst, når man ruller, eller vis en bjælke, der viser, hvor langt man er nået.'],
    check: ['Tjek siden', 'Finder ting, der kan gøre siden svær at bruge, fx billeder uden beskrivelse eller en side uden titel.'],
  };
  const BY_CMD = { new: 'document', exportPdf: 'share', bold: 'text', ul: 'paragraph', fxScroll: 'motion', fxGradient: 'surface', fxSticky: 'scrolling', lint: 'check' };
  function addGroupHelp() {
    for (const [cmd, key] of Object.entries(BY_CMD)) { const b = $('.panel [data-cmd="' + cmd + '"]'); const g = b && b.closest('.group'); if (g && !g.dataset.help) g.dataset.help = key; }
    const dev = $('.dev'); if (dev) dev.closest('.group').dataset.help = 'devices';
    for (const g of $$('.group[data-help]')) {
      const lab = g.querySelector('.label'); if (!lab || lab.querySelector('.ghelp')) continue;
      const b = el('button', 'ghelp simple'); b.textContent = '?'; b.title = t('Hvad er dette?');
      b.onclick = (e) => { e.stopPropagation(); showHelp(b, HELP[g.dataset.help]); };
      lab.append(b);
    }
  }
  let pop = null;
  function showHelp(anchor, h) {
    if (pop) pop.remove();
    if (!h) return;
    pop = el('div', 'helppop'); pop.innerHTML = '<b>' + esc(t(h[0])) + '</b>' + esc(t(h[1]));
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left - 20)) + 'px';
    pop.style.top = r.bottom + 8 + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off() { if (pop) pop.remove(); pop = null; document.removeEventListener('mousedown', off); }), 0);
  }

  /* ======================= rundvisning ======================= */
  const STEPS = [
    ['#previewWrap', 'Her er din side', 'Klik i teksten, og skriv, som du gør i Word. Det, du ser her, er præcis sådan siden kommer til at se ud.'],
    ['.tab[data-tab="insert"]', 'Indsæt', 'Tilføj overskrifter, tekst, billeder, knapper og kolonner. Det nye kommer lige under det, du har klikket på.'],
    ['.tab[data-tab="design"]', 'Design', 'Vælg farver og skrift til hele siden på én gang, og bestem hvor meget luft der skal være.'],
    ['#previewWrap', 'Klik på noget i siden', 'Så kommer der en lille værktøjslinje, hvor du kan ændre farve og størrelse, flytte det, kopiere eller slette det.'],
    ['.qb[data-cmd="save"]', 'Gem', 'Første gang du gemmer, laver TagNote en mappe til din hjemmeside. Billeder lægges i samme mappe, så alt hænger sammen.'],
    ['#stLevel', 'Enkel og Avanceret', 'TagNote er i Enkel tilstand. Vil du se koden og alle værktøjer, så klik her og skift til Avanceret.'],
  ];
  let tourEls = null;
  function endTour() { if (tourEls) { tourEls.forEach((x) => x.remove()); tourEls = null; } store.set('toured', true); document.removeEventListener('keydown', tourKey, true); }
  TN.endTour = () => endTour();
  const tourKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); endTour(); } };
  function tour(i) {
    if (level() !== 'simple' && i === 0) setLevel('simple', true);
    if (tourEls && !tourEls[0].isConnected) tourEls = null;
    if (!tourEls) { const hole = el('div', 'tour-hole'), bub = el('div', 'tour-bubble'); document.body.append(hole, bub); tourEls = [hole, bub]; document.addEventListener('keydown', tourKey, true); }
    const [sel, title, text] = STEPS[i];
    const target = $(sel); const [hole, bub] = tourEls;
    const r = target ? target.getBoundingClientRect() : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 50, width: 200, height: 100 };
    const pad = 6;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    bub.innerHTML = '<h4>' + esc(t(title)) + '</h4><p>' + esc(t(text)) + '</p><div class="tb-foot"><span class="muted">' + esc(t('{0} af {1}', i + 1, STEPS.length)) + '</span></div>';
    const foot = bub.querySelector('.tb-foot');
    const btn = (label, fn, primary) => { const b = el('button', 'btn' + (primary ? ' primary' : '')); b.textContent = label; b.onclick = fn; foot.append(b); };
    btn(t('Luk'), endTour);
    if (i > 0) btn(t('Forrige'), () => tour(i - 1));
    btn(i < STEPS.length - 1 ? t('Næste') : t('Færdig'), () => (i < STEPS.length - 1 ? tour(i + 1) : endTour()), true);
    // boblen placeres ved siden af eller under målet
    const big = r.width > innerWidth * 0.4;
    let x = big ? r.left + r.width / 2 - 170 : r.left, y = big ? r.top + 40 : r.bottom + 14;
    if (y + 180 > innerHeight) y = Math.max(10, r.top - 190);
    bub.style.left = Math.max(10, Math.min(innerWidth - 360, x)) + 'px'; bub.style.top = y + 'px';
  }

  /* ======================= start ======================= */
  TN.ready.push(() => {
    addGroupHelp();
    const plainNew = TN.cmds.new;
    TN.cmds.new = () => (level() === 'simple' && TN.templates ? TN.templates.choose() : plainNew());
    setLevel(store.get('level', 'simple'), true);
    if (level() === 'simple' && !store.get('toured', false)) setTimeout(() => tour(0), 900);
  });
})();
