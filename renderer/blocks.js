/* TagNote – skabeloner, indsæt-blokke, billeder, links og hjemmesidemappe (Enkel) */
(function () {
  'use strict';
  const { $, $$, t, state, ed, el, esc, store, api } = TN;
  const escA = TN.escAttr;

  /* ======================= fælles stil til blokke og skabeloner ======================= */
  const BLOCK_CSS = [
    'img { max-width: 100%; height: auto; }',
    '.tn-knap { display: inline-block; padding: .7em 1.4em; border-radius: var(--tn-hjorner, 8px); background: var(--tn-primaer, #2b579a); color: var(--tn-paa-primaer, #fff); text-decoration: none; font-weight: 600; }',
    '.tn-knap:hover { filter: brightness(1.08); }',
    '.tn-kolonner { display: grid; gap: var(--tn-luft, 24px); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); align-items: start; }',
    '.tn-kort { background: var(--tn-flade, #fff); border-radius: var(--tn-hjorner, 12px); box-shadow: var(--tn-skygge, 0 2px 10px rgb(0 0 0 / .08)); overflow: hidden; }',
    '.tn-kort > img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }',
    '.tn-kort .tn-indhold { padding: 14px 20px 18px; }',
    '.tn-kort h3 { margin: .2em 0 .3em; }',
    '.tn-billede { display: block; max-width: 100%; height: auto; border-radius: var(--tn-hjorner, 8px); }',
    '.tn-video { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: var(--tn-hjorner, 8px); }',
    '.tn-luft { height: calc(var(--tn-luft, 24px) * 2); }',
    '.tn-citat { margin: 1.5em 0; padding: .4em 1.2em; border-left: 4px solid var(--tn-primaer, #2b579a); font-size: 1.15em; font-style: italic; }',
    '.tn-tabel { border-collapse: collapse; width: 100%; }',
    '.tn-tabel th, .tn-tabel td { border: 1px solid rgb(0 0 0 / .14); padding: 8px 12px; text-align: left; }',
    '.tn-tabel th { background: var(--tn-flade-2, #f1f4f8); }',
  ].join('\n');
  const LAYOUT_CSS = [
    '* { box-sizing: border-box; }',
    '.tn-menu { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 24px; max-width: var(--tn-bredde, 980px); margin: 0 auto; padding: 16px clamp(16px, 4vw, 32px); }',
    '.tn-logo { font-family: var(--tn-overskrift-skrift); font-weight: 700; font-size: 1.25rem; text-decoration: none; color: var(--tn-overskrift); }',
    '.tn-menu ul { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 0; padding: 0; list-style: none; }',
    '.tn-menu ul a { color: var(--tn-tekst); text-decoration: none; }',
    '.tn-top { background: var(--tn-primaer); color: var(--tn-paa-primaer); text-align: center; padding: calc(var(--tn-luft) * 3) clamp(16px, 4vw, 32px); }',
    '.tn-top h1 { color: inherit; font-size: clamp(2rem, 1.2rem + 3vw, 3.4rem); margin: 0 0 .3em; }',
    '.tn-top p { max-width: 38rem; margin: 0 auto 1.4em; font-size: 1.15em; opacity: .92; }',
    '.tn-top .tn-knap { background: var(--tn-paa-primaer); color: var(--tn-primaer); }',
    '.tn-sektion { padding: calc(var(--tn-luft) * 1.5) clamp(16px, 4vw, 32px); }',
    '.tn-sektion > * { max-width: min(100%, var(--tn-bredde, 980px)); margin-left: auto; margin-right: auto; }',
    '.tn-farvet { background: var(--tn-flade-2); }',
    '.tn-fod { text-align: center; padding: calc(var(--tn-luft) * 1.5) 16px; background: var(--tn-overskrift); color: var(--tn-baggrund); }',
    '.tn-fod a { color: inherit; }',
  ].join('\n');

  function ensureBlockCss(doc) {
    if (doc.getElementById('tn-blokke')) return;
    const st = doc.createElement('style'); st.id = 'tn-blokke'; st.textContent = '\n' + BLOCK_CSS + '\n';
    (doc.head || doc.documentElement).append(st);
  }

  /* pladsholderbillede, indtil man vælger sit eget */
  const PH = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3eaf3"/><stop offset="1" stop-color="#c8d5e6"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g fill="none" stroke="#8ea3bf" stroke-width="8" stroke-linejoin="round"><rect x="140" y="105" width="120" height="90" rx="8"/><path d="M150 185l35-38 25 25 20-18 30 31"/></g><circle cx="230" cy="132" r="9" fill="#8ea3bf"/></svg>');

  /* ======================= skabeloner ======================= */
  const T = (s) => esc(t(s));
  function page(title, body, design) {
    const lang = window.WDi18n.lang();
    return '<!DOCTYPE html>\n<html lang="' + lang + '">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' + esc(title) + '</title>\n' +
      '  <style id="tn-design">\n' + TN.design.css(design || {}).replace(/^/gm, '    ') + '\n  </style>\n' +
      '  <style id="tn-layout">\n' + LAYOUT_CSS.replace(/^/gm, '    ') + '\n  </style>\n' +
      '  <style id="tn-blokke">\n' + BLOCK_CSS.replace(/^/gm, '    ') + '\n  </style>\n' +
      '</head>\n<body>\n' + body.trim().replace(/^/gm, '  ') + '\n</body>\n</html>\n';
  }
  const nav = (name, links) => '<header>\n  <nav class="tn-menu">\n    <a class="tn-logo" href="index.html">' + T(name) + '</a>\n    <ul>\n' + links.map(([h, l]) => '      <li><a href="' + h + '">' + T(l) + '</a></li>').join('\n') + '\n    </ul>\n  </nav>\n</header>';
  const card = (title, text) => '    <article class="tn-kort">\n      <img src="' + PH + '" alt="">\n      <div class="tn-indhold">\n        <h3>' + T(title) + '</h3>\n        <p>' + T(text) + '</p>\n      </div>\n    </article>';
  const year = new Date().getFullYear();
  const TEMPLATES = {
    tom: { name: 'Tom side', text: 'En tom side med en overskrift. Byg selv videre med Indsæt.', thumb: [['h', 10, 60], ['l', 6, 90], ['l', 6, 80]], design: {},
      build: () => page(t('Min side'), '<main class="tn-sektion">\n  <h1>' + T('Overskrift') + '</h1>\n  <p>' + T('Skriv din tekst her.') + '</p>\n</main>') },
    personlig: { name: 'Personlig side', text: 'Præsentér dig selv med billede, en kort tekst og kontakt.', thumb: [['b', 8, 100], ['p', 30, 100], ['l', 6, 70], ['l', 6, 60]], design: { farver: 'lyng', skrift: 'venlig' },
      build: () => page(t('Dit navn'), nav('Dit navn', [['#om', 'Om mig'], ['#kontakt', 'Kontakt']]) + '\n<section class="tn-top">\n  <h1>' + T('Hej, jeg hedder Dit navn') + '</h1>\n  <p>' + T('Skriv en kort sætning om dig selv, og hvad siden handler om.') + '</p>\n  <a class="tn-knap" href="#kontakt">' + T('Skriv til mig') + '</a>\n</section>\n<main>\n  <section class="tn-sektion" id="om">\n    <h2>' + T('Om mig') + '</h2>\n    <div class="tn-kolonner">\n      <img class="tn-billede" src="' + PH + '" alt="' + escA(t('Billede af mig')) + '">\n      <div>\n        <p>' + T('Fortæl, hvem du er, hvad du laver, og hvad du brænder for. Klik i teksten, og skriv din egen.') + '</p>\n        <p>' + T('Skift billedet ved at dobbeltklikke på det.') + '</p>\n      </div>\n    </div>\n  </section>\n  <section class="tn-sektion tn-farvet" id="kontakt">\n    <h2>' + T('Kontakt') + '</h2>\n    <p>' + T('Skriv til mig på') + ' <a href="mailto:navn@eksempel.dk">navn@eksempel.dk</a>.</p>\n  </section>\n</main>\n<footer class="tn-fod">\n  <p>&copy; ' + year + ' ' + T('Dit navn') + '</p>\n</footer>', { farver: 'lyng', skrift: 'venlig' }) },
    cafe: { name: 'Café eller butik', text: 'Forside med billeder af det, du sælger, åbningstider og adresse.', thumb: [['b', 6, 100], ['p', 32, 100], ['c', 22, 3], ['l', 6, 80]], design: { farver: 'solnedgang', skrift: 'avis', hjorner: 'runde' },
      build: () => page(t('Café Navn'), nav('Café Navn', [['#menu', 'Menu'], ['#tider', 'Åbningstider'], ['#find', 'Find os']]) + '\n<section class="tn-top">\n  <h1>' + T('Café Navn') + '</h1>\n  <p>' + T('Kaffe, kage og hyggelige stunder midt i byen.') + '</p>\n  <a class="tn-knap" href="#find">' + T('Book et bord') + '</a>\n</section>\n<main>\n  <section class="tn-sektion" id="menu">\n    <h2>' + T('Det serverer vi') + '</h2>\n    <div class="tn-kolonner">\n' + card('Kaffe', 'Friskmalet kaffe fra en lokal risteri.') + '\n' + card('Kage', 'Hjemmebag hver morgen.') + '\n' + card('Frokost', 'Sandwich og dagens suppe.') + '\n    </div>\n  </section>\n  <section class="tn-sektion tn-farvet" id="tider">\n    <h2>' + T('Åbningstider') + '</h2>\n    <table class="tn-tabel">\n      <tr><th>' + T('Mandag til fredag') + '</th><td>8–17</td></tr>\n      <tr><th>' + T('Lørdag') + '</th><td>9–16</td></tr>\n      <tr><th>' + T('Søndag') + '</th><td>' + T('Lukket') + '</td></tr>\n    </table>\n  </section>\n  <section class="tn-sektion" id="find">\n    <h2>' + T('Find os') + '</h2>\n    <p>' + T('Gadenavn 1, 1234 By. Ring på 12 34 56 78.') + '</p>\n  </section>\n</main>\n<footer class="tn-fod">\n  <p>&copy; ' + year + ' ' + T('Café Navn') + '</p>\n</footer>', { farver: 'solnedgang', skrift: 'avis', hjorner: 'runde' }) },
    forening: { name: 'Forening eller klub', text: 'Nyheder, kommende aktiviteter og hvordan man bliver medlem.', thumb: [['b', 6, 100], ['p', 26, 100], ['c', 18, 3], ['l', 5, 100], ['l', 5, 100]], design: { farver: 'skov', skrift: 'moderne' },
      build: () => page(t('Foreningens navn'), nav('Foreningens navn', [['#nyt', 'Nyheder'], ['#aktiviteter', 'Aktiviteter'], ['#medlem', 'Bliv medlem']]) + '\n<section class="tn-top">\n  <h1>' + T('Foreningens navn') + '</h1>\n  <p>' + T('Vi mødes hver uge og laver ting sammen. Alle er velkomne.') + '</p>\n  <a class="tn-knap" href="#medlem">' + T('Bliv medlem') + '</a>\n</section>\n<main>\n  <section class="tn-sektion" id="nyt">\n    <h2>' + T('Nyheder') + '</h2>\n    <div class="tn-kolonner">\n' + card('Sommerfest', 'Kom til sommerfest i klubhuset. Vi griller fra kl. 17.') + '\n' + card('Nye træningstider', 'Fra næste måned træner vi også om onsdagen.') + '\n' + card('Generalforsamling', 'Indkaldelse og dagsorden kommer snart.') + '\n    </div>\n  </section>\n  <section class="tn-sektion tn-farvet" id="aktiviteter">\n    <h2>' + T('Kommende aktiviteter') + '</h2>\n    <table class="tn-tabel">\n      <tr><th>' + T('Dato') + '</th><th>' + T('Aktivitet') + '</th><th>' + T('Sted') + '</th></tr>\n      <tr><td>12. juni</td><td>' + T('Sommerfest') + '</td><td>' + T('Klubhuset') + '</td></tr>\n      <tr><td>20. august</td><td>' + T('Udflugt') + '</td><td>' + T('Mødested oplyses') + '</td></tr>\n    </table>\n  </section>\n  <section class="tn-sektion" id="medlem">\n    <h2>' + T('Bliv medlem') + '</h2>\n    <p>' + T('Skriv til os, så sender vi information om kontingent og træningstider.') + '</p>\n    <p><a class="tn-knap" href="mailto:kontakt@eksempel.dk">' + T('Skriv til os') + '</a></p>\n  </section>\n</main>\n<footer class="tn-fod">\n  <p>&copy; ' + year + ' ' + T('Foreningens navn') + '</p>\n</footer>', { farver: 'skov', skrift: 'moderne' }) },
    portfolio: { name: 'Portfolio', text: 'Vis dine projekter, billeder eller arbejde i et gitter.', thumb: [['b', 6, 100], ['h', 10, 50], ['c', 18, 3], ['c', 18, 3]], design: { farver: 'grafit', skrift: 'elegant', hjorner: 'skarpe', skygge: 'ingen' },
      build: () => page(t('Dit navn'), nav('Dit navn', [['#projekter', 'Projekter'], ['#om', 'Om mig'], ['#kontakt', 'Kontakt']]) + '\n<main>\n  <section class="tn-sektion">\n    <h1>' + T('Dit navn') + '</h1>\n    <p>' + T('Fotograf og grafisk designer. Skriv, hvad du laver.') + '</p>\n  </section>\n  <section class="tn-sektion" id="projekter">\n    <h2>' + T('Udvalgte projekter') + '</h2>\n    <div class="tn-kolonner">\n' + card('Projekt 1', 'Kort tekst om projektet.') + '\n' + card('Projekt 2', 'Kort tekst om projektet.') + '\n' + card('Projekt 3', 'Kort tekst om projektet.') + '\n' + card('Projekt 4', 'Kort tekst om projektet.') + '\n' + card('Projekt 5', 'Kort tekst om projektet.') + '\n' + card('Projekt 6', 'Kort tekst om projektet.') + '\n    </div>\n  </section>\n  <section class="tn-sektion tn-farvet" id="om">\n    <h2>' + T('Om mig') + '</h2>\n    <p>' + T('Fortæl om din baggrund, og hvem du gerne vil arbejde for.') + '</p>\n  </section>\n  <section class="tn-sektion" id="kontakt">\n    <h2>' + T('Kontakt') + '</h2>\n    <p><a class="tn-knap" href="mailto:navn@eksempel.dk">' + T('Skriv til mig') + '</a></p>\n  </section>\n</main>\n<footer class="tn-fod">\n  <p>&copy; ' + year + ' ' + T('Dit navn') + '</p>\n</footer>', { farver: 'grafit', skrift: 'elegant', hjorner: 'skarpe', skygge: 'ingen' }) },
  };
  function thumb(tp) {
    const p = TN.design.PALETTES[tp.design.farver || 'hav'];
    const parts = tp.thumb.map(([k, h, w]) => {
      if (k === 'c') return '<span style="display:flex;gap:4px">' + Array.from({ length: w }, () => '<i style="flex:1;height:' + h + 'px;background:' + p[4] + ';box-shadow:0 0 0 1px ' + p[5] + '"></i>').join('') + '</span>';
      const bg = k === 'b' ? p[4] : k === 'p' ? p[1] : k === 'h' ? p[7] : p[6];
      return '<i style="height:' + h + 'px;width:' + w + '%;background:' + bg + (k === 'l' ? ';opacity:.3' : '') + '"></i>';
    }).join('');
    return '<div class="gthumb" style="background:' + p[3] + '">' + parts + '</div>';
  }
  async function choose() {
    const body = el('div');
    body.append(Object.assign(el('p', 'muted'), { textContent: t('Vælg en side at starte fra. Du kan ændre alt bagefter: tekst, billeder, farver og skrift.') }));
    const g = el('div', 'gallery'); let pick = null;
    const r = await new Promise((res) => {
      for (const [id, tp] of Object.entries(TEMPLATES)) {
        const c = el('button', 'gcard'); c.innerHTML = thumb(tp) + '<b>' + esc(t(tp.name)) + '</b><small>' + esc(t(tp.text)) + '</small>';
        c.onclick = () => { pick = id; $$('.gcard', g).forEach((x) => x.classList.toggle('on', x === c)); };
        c.ondblclick = () => { pick = id; document.querySelector('#modalRoot .overlay .btn.primary').click(); };
        g.append(c);
      }
      body.append(g);
      TN.modal({ title: t('Ny side'), body, wide: true, buttons: [{ text: t('Annuller') }, { text: t('Opret'), primary: true, value: () => pick || 'tom' }] }).then(res);
    });
    if (!r) return;
    TN.newTab(TEMPLATES[r].build());
    TN.preview.render(true);
  }
  TN.templates = { choose, TEMPLATES };
  TN.cmds.newTemplate = () => choose();

  /* ======================= indsæt i siden ======================= */
  const CONTAINERS = new Set(['BODY', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'DIV']);
  const isContainer = (n) => CONTAINERS.has(n.tagName) && !n.classList.contains('tn-kolonner') && !/^(P|SPAN)$/.test(n.tagName);
  function insertPoint(doc) {
    const main = doc.querySelector('main') || doc.body;
    const fallback = () => ({ parent: main, before: main === doc.body ? doc.body.querySelector(':scope > footer') : null });
    let ref = TN.sel.el;
    if (!ref || !ref.isConnected || ref.ownerDocument !== doc || /^(HTML|HEAD|BODY)$/.test(ref.tagName)) return fallback();
    if (isContainer(ref) && ref.tagName !== 'DIV') return { parent: ref, before: null };
    while (ref.parentElement && !isContainer(ref.parentElement)) ref = ref.parentElement;
    if (!ref.parentElement) return fallback();
    if (ref.parentElement.classList.contains('tn-kolonner')) ref = ref.parentElement;
    if (ref.parentElement && ref.parentElement.classList.contains('tn-kolonner')) ref = ref.parentElement;
    return { parent: ref.parentElement || main, before: ref.nextSibling };
  }
  function focusText(doc, node) {
    const target = node.matches('h1,h2,h3,h4,p,li,blockquote,a,td,th') ? node : node.querySelector('h1,h2,h3,h4,p,li,blockquote,a,td,th');
    if (!target) return;
    const s = doc.getSelection(); const r = doc.createRange(); r.selectNodeContents(target); s.removeAllRanges(); s.addRange(r);
    const fr = TN.preview.frame(); fr.focus(); fr.contentWindow.focus(); doc.body.focus(); TN.focusPane = 'preview';
    s.removeAllRanges(); s.addRange(r);
  }
  async function place(html, select = true) {
    if (state.mode === 'raw' && TN.level() !== 'simple') { TN.insert(html); return null; }
    await TN.ensureEditable();
    const doc = TN.preview.doc(); if (!doc) return null;
    ensureBlockCss(doc);
    const tpl = doc.createElement('template'); tpl.innerHTML = html.trim();
    const node = tpl.content.firstElementChild;
    let { parent, before } = insertPoint(doc);
    let added = node;
    /* Mellem sidens sektioner pakkes blokken i en sektion, så den får samme margen og bredde som resten */
    if ((parent === doc.body || parent.tagName === 'MAIN') && doc.querySelector('.tn-sektion') && !/^(SECTION|HEADER|FOOTER|NAV|MAIN)$/.test(node.tagName)) {
      added = doc.createElement('section'); added.className = 'tn-sektion'; added.append(node);
    }
    parent.insertBefore(added, before);
    TN.preview.commit(true);
    TN.sel.set(node);
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (select) focusText(doc, node);
    return node;
  }
  const blk = (html) => () => place(html());
  Object.assign(TN.cmds, {
    blkHeading: blk(() => '<h2>' + T('Ny overskrift') + '</h2>'),
    blkText: blk(() => '<p>' + T('Skriv din tekst her.') + '</p>'),
    blkList: blk(() => '<ul>\n  <li>' + T('Første punkt') + '</li>\n  <li>' + T('Andet punkt') + '</li>\n  <li>' + T('Tredje punkt') + '</li>\n</ul>'),
    blkQuote: blk(() => '<blockquote class="tn-citat">' + T('Skriv et citat her.') + '</blockquote>'),
    blkCols2: blk(() => '<div class="tn-kolonner">\n  <div>\n    <h3>' + T('Overskrift') + '</h3>\n    <p>' + T('Tekst i første kolonne.') + '</p>\n  </div>\n  <div>\n    <h3>' + T('Overskrift') + '</h3>\n    <p>' + T('Tekst i anden kolonne.') + '</p>\n  </div>\n</div>'),
    blkCols3: blk(() => '<div class="tn-kolonner">\n' + [1, 2, 3].map((i) => '  <div>\n    <h3>' + T('Overskrift') + '</h3>\n    <p>' + esc(t('Tekst i kolonne {0}.', i)) + '</p>\n  </div>').join('\n') + '\n</div>'),
    blkCards: blk(() => '<div class="tn-kolonner">\n' + card('Titel', 'Kort tekst. Dobbeltklik på billedet for at skifte det.') + '\n' + card('Titel', 'Kort tekst.') + '\n' + card('Titel', 'Kort tekst.') + '\n</div>'),
    blkHr: () => place('<hr>', false),
    blkSpace: () => place('<div class="tn-luft" aria-hidden="true"></div>', false),
    blkButton: async () => {
      const r = await linkDialog(t('Knap'), t('Kontakt os'), '');
      if (r) place('<p><a class="tn-knap" href="' + escA(r.href) + '"' + (r.blank ? ' target="_blank" rel="noopener"' : '') + '>' + esc(r.text) + '</a></p>');
    },
    blkTable: async () => {
      const r = await TN.ask({ title: 'Tabel', intro: t('Første række bliver overskrifter. Du kan skrive direkte i cellerne bagefter.'), fields: [{ id: 'rows', label: 'Antal rækker', type: 'number', value: 4, min: 2, max: 40 }, { id: 'cols', label: 'Antal kolonner', type: 'number', value: 3, min: 1, max: 10 }] });
      if (!r) return;
      const rows = Math.max(2, +r.rows || 4), cols = Math.max(1, +r.cols || 3);
      let h = '<table class="tn-tabel">\n  <tr>' + Array.from({ length: cols }, (_, i) => '<th>' + esc(t('Kolonne {0}', i + 1)) + '</th>').join('') + '</tr>\n';
      for (let i = 1; i < rows; i++) h += '  <tr>' + Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('') + '</tr>\n';
      place(h + '</table>');
    },
    blkVideo: async () => {
      const r = await TN.ask({ title: 'Video', intro: t('Find videoen på YouTube eller Vimeo, kopiér adressen fra browseren, og sæt den ind her.'), fields: [{ id: 'url', label: 'Adresse på videoen', value: '', placeholder: 'https://www.youtube.com/watch?v=…' }] });
      if (!r || !r.url) return;
      const src = videoSrc(r.url);
      if (!src) { TN.toast(t('Adressen ligner ikke en YouTube- eller Vimeo-video. Kopiér den fra browserens adresselinje.'), 6000); return; }
      await place('<iframe class="tn-video" src="' + escA(src) + '" title="' + escA(t('Video')) + '" loading="lazy" allowfullscreen></iframe>', false);
      TN.toast(t('Videoen afspilles, når siden vises i en browser.'), 4500);
    },
    blkImage: async () => {
      const src = await pickImage(); if (!src) return;
      const alt = await askAlt(src.name);
      if (alt === null) return;
      place('<img class="tn-billede" src="' + escA(src.rel) + '" alt="' + escA(alt) + '">', false);
    },
  });

  /* ======================= links ======================= */
  /* Gør det, man skriver, til en gyldig adresse: e-mail, telefon, web eller en fil */
  function normalizeHref(v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^(https?:|mailto:|tel:|#)/i.test(v)) return v;
    if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(v)) return 'mailto:' + v;
    if (/^\+?[\d\s-]{6,}$/.test(v)) return 'tel:' + v.replace(/[\s-]/g, '');
    if (/^www\.|^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(v) && !/\.html?$/i.test(v)) return 'https://' + v;
    return v;
  }
  async function linkDialog(title, text, href, blank) {
    const r = await TN.ask({ title, intro: t('Skriv en webadresse, en e-mailadresse eller et telefonnummer. TagNote laver selv resten.'), fields: [
      { id: 'text', label: 'Tekst', value: text || '' },
      { id: 'href', label: 'Fører hen til', value: href || '', placeholder: 'www.eksempel.dk  ·  navn@eksempel.dk  ·  12 34 56 78' },
      { id: 'blank', label: 'Åbn i et nyt vindue', type: 'checkbox', value: !!blank }] });
    if (!r) return null;
    const h = normalizeHref(r.href);
    if (!h) { TN.toast(t('Skriv, hvor linket skal føre hen.')); return null; }
    return { text: r.text || r.href, href: h, blank: r.blank };
  }
  async function editLink(a) {
    const r = await linkDialog(t('Link'), a.textContent, a.getAttribute('href'), a.getAttribute('target') === '_blank');
    if (!r) return;
    a.setAttribute('href', r.href); a.textContent = r.text;
    if (r.blank) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    TN.preview.commit(true); TN.preview.positionSelBox();
  }
  async function simpleLink() {
    await TN.ensureEditable();
    const doc = TN.preview.doc(); if (!doc) return;
    const s = doc.getSelection();
    const inA = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('a');
    if (inA) return editLink(inA);
    const range = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    const text = range && !range.collapsed ? range.toString() : '';
    if (!text) { TN.toast(t('Markér først den tekst i siden, der skal være et link. Eller brug Knap.'), 4500); return; }
    const r = await linkDialog(t('Link'), text, '');
    if (!r) return;
    s.removeAllRanges(); s.addRange(range);
    const a = doc.createElement('a'); a.href = r.href; a.textContent = r.text;
    if (r.blank) { a.target = '_blank'; a.rel = 'noopener'; }
    range.deleteContents(); range.insertNode(a);
    TN.preview.commit(true); TN.sel.set(a);
  }
  function videoSrc(u) {
    let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i.exec(u);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }

  /* ======================= billeder ======================= */
  async function needSaved() {
    if (state.path) return true;
    const body = el('div');
    body.append(Object.assign(el('p'), { textContent: t('Billeder lægges i samme mappe som din side, så de altid følger med. Derfor skal siden gemmes først.') }));
    const ok = await TN.modal({ title: t('Gem siden først'), body, buttons: [{ text: t('Annuller') }, { text: t('Gem nu'), primary: true, value: () => true }] });
    if (!ok) return false;
    await TN.cmds.save();
    return !!state.path;
  }
  async function pickImage() {
    if (!(await needSaved())) return null;
    const files = await api.chooseImages(false);
    if (!files || !files[0]) return null;
    const r = await api.importImage({ src: files[0], docPath: state.path });
    if (!r || r.error) { TN.toast(t('Billedet kunne ikke kopieres: {0}', r ? r.error : '?'), 5000); return null; }
    return { rel: r.rel, name: files[0].split(/[\\/]/).pop() };
  }
  async function askAlt(file) {
    const guess = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b(img|dsc|image|photo)\s*\d+\b/gi, '').trim();
    const r = await TN.ask({ title: 'Beskriv billedet', intro: t('Skriv kort, hvad billedet viser. Beskrivelsen læses op for blinde og bruges af Google.'), fields: [{ id: 'alt', label: 'Beskrivelse', value: guess, placeholder: t('Fx: Smilende barista bag disken') }], okText: t('Indsæt') });
    return r ? r.alt : null;
  }
  async function changeImage(img) {
    const src = await pickImage(); if (!src) return;
    img.setAttribute('src', src.rel);
    if (!img.getAttribute('alt')) { const alt = await askAlt(src.name); if (alt) img.setAttribute('alt', alt); }
    TN.preview.commit(true); TN.preview.positionSelBox();
  }

  /* ======================= gem i en hjemmesidemappe ======================= */
  async function saveNew(content, untitled) {
    const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(content) || [])[1] || untitled;
    let parent = store.get('siteParent', api.documentsDir || '');
    const body = el('div', 'savesite');
    body.append(Object.assign(el('p'), { textContent: t('TagNote laver en mappe til din hjemmeside. Siden gemmes som index.html, og billeder lægges i mappen billeder. Sådan skal en hjemmeside se ud, når den lægges på nettet.') }));
    const nameL = el('label', 'f'); nameL.append(t('Navn på hjemmesiden'));
    const name = el('input'); name.type = 'text'; name.value = title.trim(); nameL.append(name); body.append(nameL);
    const whereL = el('label', 'f'); whereL.append(t('Gemmes i'));
    const row = el('div'); row.style.cssText = 'display:flex;gap:6px';
    const where = el('input'); where.type = 'text'; where.readOnly = true; where.value = parent;
    const pick = el('button', 'btn'); pick.textContent = t('Skift mappe…'); pick.style.flex = 'none';
    pick.onclick = async () => { const d = await api.pickDir(parent); if (d) { parent = d; where.value = d; } };
    row.append(where, pick); whereL.append(row); body.append(whereL);
    const ok = await TN.modal({ title: t('Gem din hjemmeside'), body, buttons: [{ text: t('Annuller') }, { text: t('Gem'), primary: true, value: () => true }] });
    if (!ok) return null;
    const r = await api.siteCreate({ parent, name: name.value.trim() || title, content });
    if (!r || r.error) { TN.toast(t('Kunne ikke gemme: {0}', r ? r.error : '?'), 6000); return null; }
    store.set('siteParent', parent);
    /* Gem som: billeder fra den gamle mappe kopieres med, og stierne rettes */
    if (state.path) {
      const sep = state.path.includes('\\') ? '\\' : '/';
      const oldDir = state.path.replace(/[\\/][^\\/]*$/, '');
      let out = content, changed = false;
      for (const m of content.matchAll(/\s(src|href)\s*=\s*"([^"]+)"/gi)) {
        const ref = m[2];
        if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(ref) || !/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(ref.split(/[?#]/)[0])) continue;
        let file; try { file = oldDir + sep + decodeURIComponent(ref.split(/[?#]/)[0]).replace(/\//g, sep); } catch (_) { continue; }
        const res = await api.importImage({ src: file, docPath: r.path });
        if (res && res.rel && res.rel !== ref) { out = out.split('"' + ref + '"').join('"' + res.rel + '"'); changed = true; }
      }
      if (changed) { await api.saveFile({ path: r.path, content: out }); TN.src.setAll(out); }
    }
    TN.toast(t('Gemt i mappen {0}', r.path.split(/[\\/]/).slice(-2, -1)[0]), 4500);
    return r.path;
  }
  TN.site = { saveNew };
  TN.blocks = { place, changeImage, editLink, normalizeHref, ensureBlockCss };
  TN.ready.push(() => {
    const advLink = TN.cmds.link;
    TN.cmds.link = () => (TN.level() === 'simple' ? simpleLink() : advLink());
  });
})();
