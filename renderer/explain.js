/* TagNote – venlige navne på elementer i siden (bruges i Enkel) */
(function () {
  'use strict';
  const { t } = TN;
  const TAGS = {
    body: 'Side', main: 'Hovedindhold', header: 'Sidehoved', footer: 'Sidefod', nav: 'Menu', section: 'Afsnit', article: 'Artikel', aside: 'Sideboks',
    h1: 'Overskrift', h2: 'Overskrift', h3: 'Underoverskrift', h4: 'Underoverskrift', h5: 'Lille overskrift', h6: 'Lille overskrift',
    p: 'Tekst', a: 'Link', img: 'Billede', picture: 'Billede', figure: 'Billede med tekst', figcaption: 'Billedtekst',
    ul: 'Liste', ol: 'Nummereret liste', li: 'Punkt', blockquote: 'Citat', hr: 'Skillelinje', br: 'Linjeskift',
    strong: 'Fed tekst', b: 'Fed tekst', em: 'Kursiv tekst', i: 'Kursiv tekst', u: 'Understreget tekst', s: 'Overstreget tekst', span: 'Tekststykke', mark: 'Fremhævet tekst', small: 'Lille tekst',
    button: 'Knap', form: 'Formular', input: 'Felt', textarea: 'Tekstfelt', select: 'Valgliste', label: 'Feltnavn',
    table: 'Tabel', thead: 'Tabelhoved', tbody: 'Tabel', tr: 'Tabelrække', th: 'Overskriftscelle', td: 'Celle', caption: 'Tabeltitel',
    video: 'Video', audio: 'Lyd', iframe: 'Indlejret indhold', details: 'Fold ud', summary: 'Fold ud-titel', code: 'Kode', pre: 'Kode', div: 'Boks',
  };
  const HINTS = [
    [/(^|[\s-])(btn|button|knap|tn-knap)([\s-]|$)/, 'Knap'],
    [/(^|\s)(card|kort|tn-kort|box)(\s|$)/, 'Kort'],
    [/(^|\s)(tn-kolonner|row|columns|grid)(\s|$)/, 'Kolonner'],
    [/(^|\s)(col|column)(-[\w-]+)?(\s|$)/, 'Kolonne'],
    [/(^|\s)(hero|tn-top|jumbotron)(\s|$)/, 'Topbanner'],
    [/(^|\s)(navbar|menu|tn-menu)(\s|$)/, 'Menu'],
    [/(^|\s)(tn-citat)(\s|$)/, 'Citat'],
    [/(^|\s)(tn-luft)(\s|$)/, 'Luft'],
    [/(^|\s)(alert|notification|tn-besked)(\s|$)/, 'Besked'],
  ];
  /* Venligt navn på et element, fx "Knap", "Overskrift" eller "Billede" */
  TN.friendly = function (el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute('class') || '').toLowerCase();
    if (tag !== 'img') for (const [re, name] of HINTS) if (re.test(cls)) return t(name);
    if (tag === 'a' && /tn-knap|btn/.test(cls)) return t('Knap');
    if (tag === 'div' && el.querySelector(':scope > img') && el.children.length === 1) return t('Billede');
    if (/^h[1-6]$/.test(tag)) return t(TAGS[tag]);
    return t(TAGS[tag] || 'Boks');
  };
  /* Kort beskrivelse af, hvad man kan gøre med elementet */
  TN.friendlyHint = function (el) {
    if (!el) return '';
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return t('Dobbeltklik for at skifte billedet.');
    if (tag === 'a') return t('Klik på Link i den lille bjælke for at ændre, hvor det fører hen.');
    if (/^(h[1-6]|p|li|blockquote|figcaption|td|th|button)$/.test(tag)) return t('Skriv direkte i teksten for at ændre den.');
    return t('Klik inde i boksen for at rette indholdet.');
  };
})();
