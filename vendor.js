// Kopierer browser-bibliotekerne ind i renderer/vendor, så appen er selvstændig.
const fs = require('fs'), path = require('path');
const nm = (p) => path.join(__dirname, 'node_modules', p);
const out = path.join(__dirname, 'renderer', 'vendor');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(nm('turndown/lib/turndown.browser.umd.js'), path.join(out, 'turndown.js'));
fs.copyFileSync(nm('turndown-plugin-gfm/dist/turndown-plugin-gfm.js'), path.join(out, 'turndown-gfm.js'));
fs.copyFileSync(nm('js-beautify/js/lib/beautify.js'), path.join(out, 'beautify-js.js'));
fs.copyFileSync(nm('js-beautify/js/lib/beautify-css.js'), path.join(out, 'beautify-css.js'));
fs.copyFileSync(nm('js-beautify/js/lib/beautify-html.js'), path.join(out, 'beautify-html.js'));
console.log('vendor ok');
