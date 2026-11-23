/* TagNote – HTML-værktøjer: farvemarkering, kort mellem kode og side, formatering, kontrol, eksport */
(function () {
  'use strict';
  const { $, $$, api, t, state, ed, esc, escAttr } = TN;
  const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const sp = (c, s) => '<span class="' + c + '">' + esc(s) + '</span>';

  /* ======================= farvemarkering ======================= */
  const KW = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(\d[\d_.]*(?:e[+-]?\d+)?|0x[0-9a-fA-F]+)\b|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|void|delete|yield|static|super)\b/g;
  function hlJs(s) {
    let out = '', last = 0, m;
    KW.lastIndex = 0;
    while ((m = KW.exec(s))) {
      out += esc(s.slice(last, m.index));
      out += m[1] ? sp('x', m[0]) : m[2] ? sp('v', m[0]) : m[3] ? sp('n', m[0]) : sp('k', m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
  }
  function cssValue(v) {
    return esc(v).replace(/(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|rem|em|%|vh|vw|vmin|vmax|ch|s|ms|deg|fr)?\b)|(&quot;[^&]*&quot;|"[^"]*"|'[^']*')|([\w-]+)(?=\()/g,
      (m, hex, num, str, fn) => (hex ? '<span class="n">' + m + '</span>' : num ? '<span class="n">' + m + '</span>' : str ? '<span class="v">' + m + '</span>' : '<span class="k">' + m + '</span>'));
  }
  function hlCss(s) {
    let out = '', i = 0; const n = s.length;
    while (i < n) {
      if (s.startsWith('/*', i)) { let j = s.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += sp('x', s.slice(i, j)); i = j; continue; }
      if (s[i] === '{' || s[i] === '}' || s[i] === ';') { out += sp('p', s[i]); i++; continue; }
      if (/\s/.test(s[i])) { out += s[i]; i++; continue; }
      let j = i; let kind = null;
      while (j < n) {
        const c = s[j];
        if (c === '"' || c === "'") { const q = c; j++; while (j < n && s[j] !== q && s[j] !== '\n') { if (s[j] === '\\') j++; j++; } j++; continue; }
        if (c === '(') { let d = 1; j++; while (j < n && d) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; } continue; }
        if (c === '{') { kind = 'sel'; break; }
        if (c === ';' || c === '}') { kind = 'decl'; break; }
        if (s.startsWith('/*', j)) break;
        j++;
      }
      if (j > n) j = n;
      const chunk = s.slice(i, j);
      if (kind === 'sel' || kind === null) out += chunk.trim().startsWith('@') ? sp('t', chunk) : sp('cs', chunk);
      else {
        const c = chunk.indexOf(':');
        if (c < 0) out += esc(chunk);
        else out += '<span class="a">' + esc(chunk.slice(0, c)) + '</span>' + sp('p', ':') + cssValue(chunk.slice(c + 1));
      }
      i = j;
    }
    return out;
  }
  const RE_NAME = /<(\/?)([a-zA-Z][^\s/>]*)/y;
  const RE_ATTR = /([^\s=>/][^\s=>/]*)/y;
  const RE_ENT = /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
  function hlText(s) {
    let out = '', last = 0, m;
    RE_ENT.lastIndex = 0;
    while ((m = RE_ENT.exec(s))) { out += esc(s.slice(last, m.index)) + sp('e', m[0]); last = m.index + m[0].length; }
    return out + esc(s.slice(last));
  }
  function highlight(src) {
    let out = '', i = 0; const n = src.length;
    while (i < n) {
      const lt = src.indexOf('<', i);
      if (lt < 0) { out += hlText(src.slice(i)); break; }
      if (lt > i) { out += hlText(src.slice(i, lt)); i = lt; }
      if (src.startsWith('<!--', i)) { let j = src.indexOf('-->', i + 4); j = j < 0 ? n : j + 3; out += sp('x', src.slice(i, j)); i = j; continue; }
      if (src.startsWith('<!', i) || src.startsWith('<?', i)) { let j = src.indexOf('>', i); j = j < 0 ? n : j + 1; out += sp('d', src.slice(i, j)); i = j; continue; }
      RE_NAME.lastIndex = i;
      const m = RE_NAME.exec(src);
      if (!m) { out += esc('<'); i++; continue; }
      const closing = !!m[1], name = m[2].toLowerCase();
      out += sp('p', '<' + m[1]) + sp('t', m[2]);
      i = RE_NAME.lastIndex;
      let selfClose = false;
      for (;;) {
        const ws = /^\s*/.exec(src.slice(i, i + 200))[0]; out += ws; i += ws.length;
        if (i >= n) break;
        if (src[i] === '>') { out += sp('p', '>'); i++; break; }
        if (src.startsWith('/>', i)) { out += sp('p', '/>'); i += 2; selfClose = true; break; }
        if (src[i] === '/') { out += sp('p', '/'); i++; continue; }
        if (src[i] === '<') break;
        RE_ATTR.lastIndex = i;
        const a = RE_ATTR.exec(src);
        if (!a) { out += esc(src[i]); i++; continue; }
        out += sp('a', a[1]); i = RE_ATTR.lastIndex;
        const w2 = /^\s*/.exec(src.slice(i, i + 50))[0];
        if (src[i + w2.length] === '=') {
          out += w2 + sp('p', '='); i += w2.length + 1;
          const w3 = /^\s*/.exec(src.slice(i, i + 50))[0]; out += w3; i += w3.length;
          const q = src[i];
          if (q === '"' || q === "'") { let j = src.indexOf(q, i + 1); j = j < 0 ? n : j + 1; out += sp('v', src.slice(i, j)); i = j; }
          else { const um = /^[^\s>]+/.exec(src.slice(i, i + 400)); if (um) { out += sp('v', um[0]); i += um[0].length; } }
        }
      }
      if (!closing && !selfClose && (name === 'script' || name === 'style')) {
        const re = new RegExp('</' + name + '\\b', 'i');
        const rest = src.slice(i);
        const e = re.exec(rest);
        const j = e ? i + e.index : n;
        const body = src.slice(i, j);
        const isJs = name === 'script' && !/type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/(?:template|html|x-))/i.test(src.slice(Math.max(0, i - 200), i));
        out += name === 'style' ? hlCss(body) : isJs ? hlJs(body) : esc(body);
        i = j;
      }
    }
    return out;
  }

  /* ======================= kort mellem kode og side ======================= */
  /* Gennemløber tags i rækkefølge og springer kommentarer samt script/style-indhold over */
  function scanTags(text) {
    const tags = []; let i = 0; const n = text.length;
    while (i < n) {
      const lt = text.indexOf('<', i); if (lt < 0) break;
      i = lt;
      if (text.startsWith('<!--', i)) { const j = text.indexOf('-->', i + 4); i = j < 0 ? n : j + 3; continue; }
      if (text.startsWith('<!', i) || text.startsWith('<?', i)) { const j = text.indexOf('>', i); i = j < 0 ? n : j + 1; continue; }
      RE_NAME.lastIndex = i;
      const m = RE_NAME.exec(text);
      if (!m) { i++; continue; }
      let j = RE_NAME.lastIndex, q = null;
      while (j < n) { const c = text[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
      const end = Math.min(n, j + 1);
      const name = m[2].toLowerCase();
      const closing = !!m[1];
      const selfClose = text[end - 2] === '/';
      tags.push({ name, pos: i, end, closing, selfClose, voidEl: VOID.has(name) });
      i = end;
      if (!closing && !selfClose && (name === 'script' || name === 'style' || name === 'textarea' || name === 'title')) {
        const e = new RegExp('</' + name + '\\b', 'i').exec(text.slice(i));
        i = e ? i + e.index : n;
      }
    }
    return tags;
  }
  /* Stak af åbne elementer ved position */
  function stackAt(text, pos) {
    const stack = [], counts = {}; let hit = null;
    for (const tg of scanTags(text)) {
      if (tg.pos > pos) break;
      if (!tg.closing) {
        const idx = counts[tg.name] = (counts[tg.name] || 0) + 1;
        const el = { name: tg.name, idx: idx - 1, pos: tg.pos, end: tg.end };
        if (pos < tg.end) { hit = el; break; }
        if (!tg.voidEl && !tg.selfClose) stack.push(el);
        else if (pos < tg.end) hit = el;
      } else {
        if (pos < tg.end) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === tg.name) { hit = stack[k]; break; } break; }
        for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === tg.name) { stack.length = k; break; }
      }
    }
    if (hit) { const k = stack.findIndex((e) => e.pos === hit.pos); if (k >= 0) stack.length = k + 1; else stack.push(hit); }
    return stack;
  }
  function attrOf(text, el, name) {
    const open = text.slice(el.pos, el.end);
    const m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(open);
    return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : '';
  }
  function pathAt(text, pos) {
    return stackAt(text, pos).map((e) => {
      let s = e.name; const id = attrOf(text, e, 'id'), cl = attrOf(text, e, 'class').trim().split(/\s+/).filter(Boolean);
      if (id) s += '#' + id; if (cl.length) s += '.' + cl[0] + (cl.length > 1 ? '…' : '');
      return s;
    });
  }
  function elementAt(text, pos, doc) {
    const st = stackAt(text, pos);
    for (let k = st.length - 1; k >= 0; k--) {
      const e = st[k];
      const list = doc.querySelectorAll(e.name);
      if (list[e.idx]) return list[e.idx];
    }
    return null;
  }
  function rangeOf(text, name, idx) {
    const tags = scanTags(text); let c = -1;
    for (let k = 0; k < tags.length; k++) {
      const tg = tags[k];
      if (tg.closing || tg.name !== name) continue;
      if (++c !== idx) continue;
      if (tg.voidEl || tg.selfClose) return { start: tg.pos, openEnd: tg.end, end: tg.end };
      let depth = 1;
      for (let q = k + 1; q < tags.length; q++) {
        const t2 = tags[q];
        if (t2.name !== name) continue;
        if (t2.closing) { if (--depth === 0) return { start: tg.pos, openEnd: tg.end, end: t2.end }; }
        else if (!t2.voidEl && !t2.selfClose) depth++;
      }
      return { start: tg.pos, openEnd: tg.end, end: tg.end };
    }
    return null;
  }
  /* y-placering af et tegn i tekstfeltet, målt via et usynligt spejl */
  let mirror = null;
  function yOf(offset) {
    if (!mirror) { mirror = document.createElement('div'); mirror.className = 'mirror'; document.body.append(mirror); }
    const cs = getComputedStyle(ed);
    mirror.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;white-space:' + (ed.wrap === 'off' ? 'pre' : 'pre-wrap') + ';word-wrap:break-word;width:' + ed.clientWidth + 'px;font:' + cs.font + ';line-height:' + cs.lineHeight + ';padding:' + cs.padding + ';tab-size:2;letter-spacing:0;box-sizing:border-box;border:0';
    mirror.textContent = ed.value.slice(0, offset);
    const s = document.createElement('span'); s.textContent = '\u200b'; mirror.append(s);
    return s.offsetTop;
  }
  function scrollToOffset(off) {
    const y = yOf(off);
    if (y < ed.scrollTop + 20 || y > ed.scrollTop + ed.clientHeight - 60) ed.scrollTop = Math.max(0, y - ed.clientHeight / 3);
  }
  const map = (TN.map = {
    scanTags, stackAt, pathAt, elementAt, rangeOf, scrollToOffset,
    revealInSource(el, focus) {
      const name = el.tagName.toLowerCase();
      const list = el.ownerDocument.querySelectorAll(name);
      const idx = Array.prototype.indexOf.call(list, el);
      const r = rangeOf(ed.value, name, idx);
      if (!r) return false;
      ed.setSelectionRange(r.start, r.openEnd);
      TN.hooks.cursor && TN.hooks.cursor();
      if (state.mode !== 'read') scrollToOffset(r.start);
      if (focus) { if (state.mode === 'read') TN.setMode('split'); ed.focus(); scrollToOffset(r.start); }
      return true;
    },
  });
  TN.highlight = highlight;

  /* ======================= formatering ======================= */
  TN.beautify = function (text) {
    const opt = { indent_size: 2, indent_char: ' ', wrap_line_length: 0, preserve_newlines: true, max_preserve_newlines: 2, indent_inner_html: true, indent_scripts: 'normal', end_with_newline: true, unformatted: ['code', 'pre', 'textarea'], content_unformatted: ['pre', 'textarea'], extra_liners: [], inline_custom_elements: true };
    try {
      const html = window.html_beautify || (window.beautifier && window.beautifier.html);
      if (typeof html !== 'function') return text;
      opt.css = { indent_size: 2 }; opt.js = { indent_size: 2 };
      return html(text, opt);
    } catch (_) { return text; }
  };

  /* ======================= kontrol ======================= */
  function parse(text) { return new DOMParser().parseFromString(text, 'text/html'); }
  function indexOfEl(doc, el) { return Array.prototype.indexOf.call(doc.querySelectorAll(el.tagName.toLowerCase()), el); }
  const shortSrc = (src) => { src = src || ''; if (/^data:/i.test(src)) return t('indlejret billede'); const n = decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() || src); return n.length > 48 ? n.slice(0, 45) + '…' : n; };
  TN.lint = function (text) {
    const doc = parse(text), out = [];
    const add = (level, key, args, el) => { if (!Array.isArray(args)) { el = args; args = []; } out.push({ level, key, args, tag: el ? el.tagName.toLowerCase() : null, idx: el ? indexOfEl(doc, el) : -1 }); };
    const full = /<html[\s>]|<head[\s>]|<body[\s>]|<!doctype/i.test(text);
    if (full) {
      if (!/^\s*<!doctype html/i.test(text)) add('fejl', 'Mangler <!DOCTYPE html>. Browseren går i quirks-tilstand, og layoutet kan opføre sig anderledes.');
      if (!doc.documentElement.getAttribute('lang')) add('advarsel', 'Mangler lang på <html>. Skærmlæsere og oversættelse har brug for sproget.', doc.documentElement);
      if (!doc.querySelector('meta[charset],meta[http-equiv="Content-Type" i]')) add('advarsel', 'Mangler <meta charset="utf-8">. Specialtegn kan blive vist forkert.');
      if (!doc.querySelector('meta[name="viewport"]')) add('advarsel', 'Mangler <meta name="viewport">. Siden vises som en zoomet skrivebordsside på telefoner.');
      const ti = doc.querySelector('title');
      if (!ti || !ti.textContent.trim()) add('advarsel', 'Mangler <title> eller titlen er tom.', ti);
      if (!doc.querySelector('meta[name="description"]')) add('info', 'Mangler <meta name="description">. Søgemaskiner bruger den som beskrivelse.');
    }
    doc.querySelectorAll('img').forEach((el) => { if (!el.hasAttribute('alt')) add('fejl', 'Billedet mangler alt-tekst: {0}', [shortSrc(el.getAttribute('src'))], el); });
    doc.querySelectorAll('a').forEach((el) => {
      const h = (el.getAttribute('href') || '').trim();
      if (!el.hasAttribute('href')) add('info', 'Link uden href.', el);
      else if (h === '' || h === '#') add('advarsel', 'Link uden mål (href er tom eller #).', el);
      if (!el.textContent.trim() && !el.querySelector('img[alt]:not([alt=""])') && !el.getAttribute('aria-label')) add('fejl', 'Linket har ingen tekst, som skærmlæsere kan læse op.', el);
      if (el.getAttribute('target') === '_blank' && !/noopener|noreferrer/.test(el.getAttribute('rel') || '')) add('info', 'target="_blank" bør have rel="noopener".', el);
    });
    doc.querySelectorAll('button').forEach((el) => { if (!el.textContent.trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) add('fejl', 'Knappen har ingen tekst eller aria-label.', el); });
    doc.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').forEach((el) => {
      const id = el.getAttribute('id');
      const labelled = el.closest('label') || (id && doc.querySelector('label[for="' + CSS.escape(id) + '"]')) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!labelled) add('advarsel', 'Formularfeltet har ingen label.', el);
    });
    const seen = {};
    doc.querySelectorAll('[id]').forEach((el) => { const id = el.id; if (seen[id]) add('fejl', 'id="{0}" bruges flere gange.', [id], el); else seen[id] = 1; });
    const hs = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const h1s = hs.filter((h) => h.tagName === 'H1');
    if (hs.length && !h1s.length) add('info', 'Siden har ingen <h1>.');
    if (h1s.length > 1) add('info', 'Siden har {0} <h1>-overskrifter.', [h1s.length], h1s[1]);
    let prev = 0;
    for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) add('info', 'Overskriftsniveau springes over: <h{0}> efterfølges af <h{1}>.', [prev, l], h); prev = l; }
    for (const tg of ['font', 'center', 'marquee', 'blink', 'big', 'strike', 'frame', 'frameset']) doc.querySelectorAll(tg).forEach((el) => add('advarsel', '<{0}> er forældet. Brug CSS i stedet.', [tg], el));
    if (TN.fw && TN.fw.lint) TN.fw.lint(doc, add, text);
    return out;
  };

  /* ======================= disposition ======================= */
  const LAND = new Set(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'form', 'table', 'ul', 'ol']);
  TN.outline = function (text) {
    const doc = parse(text), res = [];
    (function walk(node, depth) {
      for (const el of node.children) {
        const tag = el.tagName.toLowerCase();
        const isH = /^h[1-6]$/.test(tag), isL = LAND.has(tag) && !['ul', 'ol', 'table', 'form'].includes(tag);
        let d = depth;
        if (isH || isL) {
          let label = isH ? el.textContent.trim().replace(/\s+/g, ' ') : '';
          if (!isH) { const h = el.querySelector('h1,h2,h3,h4,h5,h6'); label = (el.getAttribute('aria-label') || (h && h.textContent.trim().replace(/\s+/g, ' ')) || (el.id ? '#' + el.id : '')); }
          res.push({ tag, label: label.slice(0, 60), depth: isH ? Math.max(depth, 0) + (+tag[1] > 2 ? 1 : 0) : depth, el, idx: indexOfEl(doc, el), h: isH ? +tag[1] : 0 });
          if (isL) d = depth + 1;
        }
        walk(el, d);
      }
    })(doc.body || doc, 0);
    return res;
  };

  /* ======================= eksport ======================= */
  TN.toMarkdown = function (text) {
    const doc = parse(text);
    doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', hr: '---' });
    if (window.turndownPluginGfm) td.use(window.turndownPluginGfm.gfm);
    const title = doc.title ? '# ' + doc.title.trim() + '\n\n' : '';
    const body = td.turndown(doc.body ? doc.body.innerHTML : text);
    return (/^\s*#\s/.test(body) ? '' : title) + body + '\n';
  };
  TN.toPlainText = function (text) {
    const doc = parse(text);
    doc.querySelectorAll('script,style,noscript,template,head').forEach((n) => n.remove());
    const BLOCK = /^(address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul)$/i;
    let out = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) out += c.nodeValue.replace(/\s+/g, ' ');
        else if (c.nodeType === 1) { const b = BLOCK.test(c.tagName); if (b) out += '\n'; walk(c); if (b) out += '\n'; }
      }
    })(doc.body || doc);
    return out.split('\n').map((l) => l.trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1].trim())).join('\n').trim() + '\n';
  };

  /* ======================= byggeklodser ======================= */
  const snip = (TN.snip = {});
  snip.table = (rows, cols, header, caption) => {
    let s = '<table>\n';
    if (caption) s += '  <caption>Tabeltitel</caption>\n';
    if (header) s += '  <thead>\n    <tr>' + Array.from({ length: cols }, (_, i) => '<th scope="col">Kolonne ' + (i + 1) + '</th>').join('') + '</tr>\n  </thead>\n';
    s += '  <tbody>\n';
    for (let r = 0; r < rows - (header ? 1 : 0); r++) s += '    <tr>' + Array.from({ length: cols }, () => '<td></td>').join('') + '</tr>\n';
    return s + '  </tbody>\n</table>';
  };
  /* Ny, tom side: gyldig HTML5 med en overskrift og et afsnit, man kan skrive direkte i */
  snip.blank = (title, lang) => {
    const head = '<!DOCTYPE html>\n<html lang="' + (lang || 'da') + '">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' + esc(title) + '</title>\n</head>\n<body>\n  ';
    const text = head + '<h1>' + esc(t('Overskrift')) + '</h1>\n  <p>' + esc(t('Skriv din tekst her.')) + '</p>\n</body>\n</html>\n';
    return { text, caret: head.length };
  };
  snip.skeleton = (title, lang) => `<!DOCTYPE html>\n<html lang="${lang || 'da'}">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${esc(title || 'Min side')}</title>\n</head>\n<body>\n  <header>\n    <h1>${esc(title || 'Min side')}</h1>\n  </header>\n  <main>\n    <p>Skriv her.</p>\n  </main>\n  <footer>\n    <p>&copy; 2026</p>\n  </footer>\n</body>\n</html>\n`;
  snip.sections = {
    header: '<header>\n  <h1>Titel</h1>\n</header>',
    nav: '<nav aria-label="Hovedmenu">\n  <ul>\n    <li><a href="#">Forside</a></li>\n    <li><a href="#">Om os</a></li>\n    <li><a href="#">Kontakt</a></li>\n  </ul>\n</nav>',
    main: '<main>\n  \n</main>',
    section: '<section>\n  <h2>Overskrift</h2>\n  <p>Tekst.</p>\n</section>',
    article: '<article>\n  <h2>Overskrift</h2>\n  <p>Tekst.</p>\n</article>',
    aside: '<aside>\n  <p>Sidebemærkning.</p>\n</aside>',
    footer: '<footer>\n  <p>&copy; 2026</p>\n</footer>',
    div: '<div>\n  \n</div>',
    figure: '<figure>\n  <img src="billede.jpg" alt="Beskrivelse">\n  <figcaption>Billedtekst</figcaption>\n</figure>',
    details: '<details>\n  <summary>Overskrift</summary>\n  <p>Skjult tekst.</p>\n</details>',
  };
  snip.forms = {
    form: '<form action="#" method="post">\n  <label for="navn">Navn</label>\n  <input type="text" id="navn" name="navn" required>\n\n  <label for="mail">E-mail</label>\n  <input type="email" id="mail" name="mail" required>\n\n  <button type="submit">Send</button>\n</form>',
    text: '<label for="felt">Tekst</label>\n<input type="text" id="felt" name="felt">',
    email: '<label for="mail">E-mail</label>\n<input type="email" id="mail" name="mail">',
    password: '<label for="kode">Adgangskode</label>\n<input type="password" id="kode" name="kode" autocomplete="current-password">',
    number: '<label for="antal">Antal</label>\n<input type="number" id="antal" name="antal" min="0" max="10" step="1">',
    date: '<label for="dato">Dato</label>\n<input type="date" id="dato" name="dato">',
    textarea: '<label for="besked">Besked</label>\n<textarea id="besked" name="besked" rows="4"></textarea>',
    select: '<label for="valg">Vælg</label>\n<select id="valg" name="valg">\n  <option value="a">Valg A</option>\n  <option value="b">Valg B</option>\n</select>',
    checkbox: '<label><input type="checkbox" name="accept"> Jeg accepterer</label>',
    radio: '<fieldset>\n  <legend>Vælg ét</legend>\n  <label><input type="radio" name="valg" value="a" checked> A</label>\n  <label><input type="radio" name="valg" value="b"> B</label>\n</fieldset>',
    range: '<label for="skala">Værdi</label>\n<input type="range" id="skala" name="skala" min="0" max="100" value="50">',
  };
  snip.media = {
    video: '<video controls width="640" poster="">\n  <source src="video.mp4" type="video/mp4">\n  Din browser understøtter ikke video.\n</video>',
    audio: '<audio controls>\n  <source src="lyd.mp3" type="audio/mpeg">\n  Din browser understøtter ikke lyd.\n</audio>',
    iframe: '<iframe src="https://example.com" title="Indlejret side" width="600" height="400" loading="lazy"></iframe>',
    picture: '<picture>\n  <source srcset="billede.webp" type="image/webp">\n  <img src="billede.jpg" alt="Beskrivelse" loading="lazy">\n</picture>',
  };
  snip.symbols = [['&copy;', '©'], ['&reg;', '®'], ['&trade;', '™'], ['&euro;', '€'], ['&pound;', '£'], ['&nbsp;', 'ikke-brydende mellemrum'], ['&mdash;', '—'], ['&ndash;', '–'], ['&hellip;', '…'], ['&laquo;', '«'], ['&raquo;', '»'], ['&rarr;', '→'], ['&larr;', '←'], ['&uarr;', '↑'], ['&darr;', '↓'], ['&times;', '×'], ['&divide;', '÷'], ['&plusmn;', '±'], ['&deg;', '°'], ['&aelig;', 'æ'], ['&oslash;', 'ø'], ['&aring;', 'å']];
})();
