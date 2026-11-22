// Trækker klassenavne ud af frameworkenes egne CSS-filer og skriver dem til renderer/catalog/*.js.
// Kør: npm run catalogs  (kræver devDependencies: bootstrap, bulma, @picocss/pico)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const nm = (p) => path.join(root, 'node_modules', p);
const out = path.join(root, 'renderer', 'catalog');
fs.mkdirSync(out, { recursive: true });

function classes(file) {
  let css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const set = new Set();
  // vælgere = tekst før hver "{" (springer @-regler over)
  const re = /([^{}]+)\{/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1];
    if (sel.trim().startsWith('@')) continue;
    for (const c of sel.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)) {
      const name = c[1].replace(/\\(.)/g, '$1');
      if (/^[A-Za-z_-][\w:-]*$/.test(name) && !/^\d/.test(name)) set.add(name);
    }
  }
  return Array.from(set).sort();
}
const defs = {
  bootstrap: { file: nm('bootstrap/dist/css/bootstrap.css'), version: require(nm('bootstrap/package.json')).version },
  bulma: { file: nm('bulma/css/bulma.css'), version: require(nm('bulma/package.json')).version },
  pico: { file: nm('@picocss/pico/css/pico.css'), version: require(nm('@picocss/pico/package.json')).version },
};
for (const [k, d] of Object.entries(defs)) {
  const list = classes(d.file);
  fs.writeFileSync(path.join(out, k + '.js'), 'window.TN_CATALOG=window.TN_CATALOG||{};window.TN_CATALOG.' + k + '={version:' + JSON.stringify(d.version) + ',classes:' + JSON.stringify(list) + '};\n');
  console.log(k, d.version, list.length, 'klasser');
}
