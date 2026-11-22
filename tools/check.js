// Hurtig kontrol før bygning: syntaks i alle scripts og gyldige oversættelsesfiler.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
const files = ['main.js', 'preload.js', 'vendor.js', 'afterPack.js', ...fs.readdirSync(path.join(root, 'renderer')).filter((f) => f.endsWith('.js')).map((f) => 'renderer/' + f)];
for (const f of files) {
  try { new Function(fs.readFileSync(path.join(root, f), 'utf8')); } catch (e) { bad++; console.error('Syntaksfejl i ' + f + ': ' + e.message); }
}
global.window = {};
for (const f of ['renderer/strings.base.js', 'renderer/strings.tn.js']) {
  try { eval(fs.readFileSync(path.join(root, f), 'utf8')); } catch (e) { bad++; console.error('Fejl i ' + f + ': ' + e.message); }
}
const rows = window.WD_STRINGS || [];
if (rows.length < 100 || rows.some((r) => !Array.isArray(r) || typeof r[0] !== 'string')) { bad++; console.error('Oversættelserne ser forkerte ud (' + rows.length + ' rækker)'); }
for (const f of ['build/icon.png', 'build/icon.ico', 'renderer/catalog/bootstrap.js', 'renderer/vendor/beautify-html.js']) if (!fs.existsSync(path.join(root, f))) { bad++; console.error('Mangler ' + f); }
if (bad) process.exit(1);
console.log('Kontrol ok: ' + files.length + ' scripts, ' + rows.length + ' oversættelser');
