'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net, clipboard, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');

const OPEN_EXT = ['html', 'htm', 'xhtml', 'shtml', 'txt'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];
const userData = () => app.getPath('userData');
const recentFile = () => path.join(userData(), 'recent.json');
const snapDir = (key) => path.join(userData(), 'snapshots', crypto.createHash('sha1').update(key).digest('hex').slice(0, 16));

let win = null;
let L = {};
const S = (k, d) => L[k] || d;
let forceClose = false;
let pendingOpen = null;
let rendererReady = false;

/* ---------- egen protokol: tagnote://app/… ---------- */
/* Programmet og forhåndsvisningen har samme oprindelse, så den visuelle editor kan nå ind i forhåndsvisningen,
   mens scripts i siden er slået fra af iframe-attributten "sandbox". Selve siden hentes fra en sti, der
   indeholder dokumentets egen mappe, så relative billeder, stilark og skrifttyper virker som i en browser. */
protocol.registerSchemesAsPrivileged([
  { scheme: 'tagnote', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  otf: 'font/otf', eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
  ogg: 'audio/ogg', wav: 'audio/wav', txt: 'text/plain; charset=utf-8', map: 'application/json',
};
/* Kun disse filtyper må forhåndsvisningen hente fra disken */
const PREVIEW_EXT = new Set(['css', 'js', 'mjs', 'json', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'webm', 'mp3', 'ogg', 'wav', 'html', 'htm', 'txt', 'map']);
/* Filtyper, en side kan køre eller læse som tekst, hentes kun fra dokumentets egen mappe og undermapper.
   Stilark, billeder, skrifttyper og medier må også ligge i mapper ovenover (fx ../css/style.css),
   fordi de ikke kan læses af scripts uden CORS-tilladelse. */
const LOCAL_ONLY_EXT = new Set(['js', 'mjs', 'json', 'html', 'htm', 'txt', 'map', 'svg']);
/* Kun skrifttyper får CORS-tilladelse, så @font-face virker fra den isolerede ramme */
const FONT_EXT = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);

const previews = new Map(); // token -> { rest, html, csp }
const allowedNav = new Set();
const extOf = (p) => path.extname(p).slice(1).toLowerCase();

/* Dokumentets sti skrives ind i adressen, så relative stier virker. Netværksstier (\\server\share)
   får præfikset __unc__/server, så servernavnet ikke går tabt. */
function restFor(docPath) {
  if (!docPath) return '__untitled__/index.html';
  const u = pathToFileURL(docPath);
  return u.host ? '__unc__/' + u.host + u.pathname : u.pathname.replace(/^\//, '');
}
function restToFile(rest) {
  if (rest.startsWith('__untitled__/')) return null;
  return rest.startsWith('__unc__/') ? fileURLToPath('file://' + rest.slice(8)) : fileURLToPath('file:///' + rest);
}
function insideDir(root, p) {
  const rel = path.relative(root, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
function respond(body, type, extra) {
  return new Response(body, { status: 200, headers: Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra || {}) });
}
const notFound = () => new Response('Not found', { status: 404 });

async function handleProtocol(req) {
  let u;
  try { u = new URL(req.url); } catch (_) { return notFound(); }
  if (u.host !== 'app') return notFound();
  const pathname = u.pathname;
  /* forhåndsvisning */
  const pm = /^\/__preview\/([a-z0-9]+)\/(.*)$/i.exec(pathname);
  if (pm) {
    const entry = previews.get(pm[1]);
    if (!entry) return notFound();
    const rest = pm[2];
    if (rest === entry.rest) {
      const h = {};
      if (entry.csp) h['Content-Security-Policy'] = entry.csp;
      return respond(entry.html, 'text/html; charset=utf-8', h);
    }
    let file;
    try { file = restToFile(rest); } catch (_) { return notFound(); }
    if (!file) return notFound();
    const ext = extOf(file);
    if (!PREVIEW_EXT.has(ext)) return notFound();
    if (LOCAL_ONLY_EXT.has(ext) && !(entry.dir && (path.resolve(file) === path.resolve(entry.dir) || insideDir(entry.dir, path.resolve(file))))) return notFound();
    try {
      if (!fs.statSync(file).isFile()) return notFound();
      const r = await net.fetch(pathToFileURL(file).href, { headers: req.headers });
      const headers = new Headers(r.headers);
      headers.set('Content-Type', MIME[ext] || 'application/octet-stream');
      headers.set('Cache-Control', 'no-store');
      if (FONT_EXT.has(ext)) headers.set('Access-Control-Allow-Origin', '*');
      return new Response(r.body, { status: r.status, headers });
    } catch (_) { return notFound(); }
  }
  /* selve programmet */
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (_) { return notFound(); }
  if (rel === '/' || rel === '') rel = '/index.html';
  const isBuild = rel.startsWith('/build/');
  const root = path.join(__dirname, isBuild ? 'build' : 'renderer');
  const file = path.resolve(root, '.' + (isBuild ? rel.slice(6) : rel));
  if (!insideDir(root, file)) return notFound();
  try {
    const buf = fs.readFileSync(file);
    return respond(buf, MIME[extOf(file)] || 'application/octet-stream');
  } catch (_) { return notFound(); }
}

ipcMain.handle('preview:set', (_e, { token, html, docPath, csp }) => {
  if (!/^[a-z0-9]{4,32}$/i.test(String(token))) return null;
  const rest = restFor(docPath);
  previews.set(token, { rest, html: String(html || ''), csp: csp || '', dir: docPath ? path.dirname(docPath) : null });
  const url = 'tagnote://app/__preview/' + token + '/' + rest;
  allowedNav.add(url);
  return url;
});
ipcMain.handle('preview:drop', (_e, token) => { previews.delete(token); return true; });

ipcMain.on('sys:locale', (e) => { e.returnValue = app.getLocale(); });
ipcMain.on('app:version', (e) => { e.returnValue = app.getVersion(); });

/* ---------- opdateringer ---------- */
const REPO = 'Cphmartinus/tagnote';
const RELEASE_DL = 'https://github.com/' + REPO + '/releases/download/';
const isPortable = () => !!process.env.PORTABLE_EXECUTABLE_FILE;
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}
let pendingInstaller = null;
ipcMain.handle('update:check', async () => {
  try {
    const res = await net.fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { 'User-Agent': 'TagNote', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const latest = String(d.tag_name || '').replace(/^v/i, '');
    const current = app.getVersion();
    const assets = Array.isArray(d.assets) ? d.assets : [];
    const setup = assets.find((a) => /^TagNote-Setup-.*\.exe$/i.test(a.name));
    return {
      current, latest, newer: !!latest && cmpVer(latest, current) > 0,
      url: d.html_url, notes: String(d.body || ''), portable: isPortable(),
      canInstall: process.platform === 'win32' && app.isPackaged && !isPortable() && !!setup,
      setup: setup ? { name: setup.name, url: setup.browser_download_url, size: setup.size, digest: setup.digest || '' } : null,
    };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('update:download', async (_e, asset) => {
  try {
    if (!asset || typeof asset.url !== 'string' || !asset.url.startsWith(RELEASE_DL) || !/\.exe$/i.test(asset.name || '')) return { error: 'invalid asset' };
    const dir = path.join(app.getPath('temp'), 'tagnote-update');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, path.basename(asset.name));
    const res = await net.fetch(asset.url);
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || Number(asset.size) || 0;
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(file);
    const reader = res.body.getReader();
    let got = 0, last = -1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      hash.update(buf);
      got += buf.length;
      if (!out.write(buf)) await new Promise((r) => out.once('drain', r));
      const pct = total ? Math.min(100, Math.floor((got * 100) / total)) : 0;
      if (pct !== last) { last = pct; if (win) win.webContents.send('update:progress', pct); }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    const hex = hash.digest('hex');
    if (asset.digest && /^sha256:/i.test(asset.digest) && asset.digest.slice(7).toLowerCase() !== hex) { fs.unlink(file, () => {}); return { error: 'checksum' }; }
    pendingInstaller = file;
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('update:install', () => {
  if (!pendingInstaller || !fs.existsSync(pendingInstaller)) return false;
  const { spawn } = require('child_process');
  spawn(pendingInstaller, [], { detached: true, stdio: 'ignore' }).unref();
  forceClose = true;
  app.quit();
  return true;
});

ipcMain.handle('win:overlay', (_e, { color, symbol }) => {
  try { if (win && typeof win.setTitleBarOverlay === 'function') win.setTitleBarOverlay({ color, symbolColor: symbol, height: 32 }); } catch (_) {}
  return true;
});
ipcMain.handle('lang:set', (_e, { spell, strings, lang }) => {
  L = strings || {};
  L.lang = lang || 'da';
  try {
    const ses = win.webContents.session;
    const avail = ses.availableSpellCheckerLanguages || [];
    const pick = [spell, 'en-US'].filter((x, i, a) => x && avail.includes(x) && a.indexOf(x) === i);
    if (pick.length) ses.setSpellCheckerLanguages(pick);
  } catch (_) {}
  return true;
});

/* ---------- start ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on('second-instance', (_e, argv) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
      const f = fileFromArgv(argv.slice(1));
      if (f) { if (rendererReady) win.webContents.send('app:open-path', f); else pendingOpen = f; }
    }
  });
}

function fileFromArgv(argv) {
  return argv.find((a) => !a.startsWith('-') && OPEN_EXT.includes(path.extname(a).slice(1).toLowerCase()) && fs.existsSync(a)) || null;
}

function openExternal(url) { if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); }

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 820, minHeight: 520,
    backgroundColor: '#2b579a',
    show: false,
    title: 'TagNote',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#2b579a', symbolColor: '#ffffff', height: 32 },
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true,
    },
  });
  win.webContents.session.setSpellCheckerLanguages(['da', 'en-US']);
  win.loadURL('tagnote://app/index.html');
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 8000);
  win.webContents.on('did-finish-load', () => {
    rendererReady = true;
    if (pendingOpen) { win.webContents.send('app:open-path', pendingOpen); pendingOpen = null; }
  });
  win.webContents.on('render-process-gone', (_e, d) => {
    rendererReady = false;
    if (d && d.reason !== 'clean-exit' && win && !win.isDestroyed()) {
      const r = dialog.showMessageBoxSync({ type: 'error', title: 'TagNote', message: 'TagNote stopped unexpectedly.', buttons: ['Reload', 'Close'], defaultId: 0, cancelId: 1, noLink: true });
      if (r === 0) win.reload(); else { forceClose = true; app.quit(); }
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  /* Navigation: kun programmets egne sider og forhåndsvisningens egen adresse må indlæses.
     Alt andet (links, formularer) åbnes udenfor eller sendes til programmet. */
  win.webContents.on('will-frame-navigate', (e) => {
    const url = e.url;
    if (url === 'tagnote://app/index.html') return;
    if (allowedNav.has(url) || allowedNav.has(url.split('?')[0])) return;
    e.preventDefault();
    if (/^(https?:|mailto:)/i.test(url)) openExternal(url);
    else if (e.isMainFrame === false && url.startsWith('tagnote://app/__preview/')) {
      /* et link til en anden lokal HTML-fil åbnes i en ny fane */
      try {
        const m = /^\/__preview\/[a-z0-9]+\/(.*)$/i.exec(new URL(url).pathname);
        const file = m && restToFile(m[1]);
        if (file && /\.(html?|xhtml)$/i.test(file) && fs.existsSync(file)) win.webContents.send('preview:navigate', file);
      } catch (_) {}
    }
  });
  win.on('close', (e) => {
    if (!forceClose && rendererReady && !win.webContents.isCrashed()) { e.preventDefault(); win.webContents.send('app:request-close'); }
  });
  win.on('closed', () => (win = null));
}

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  if (!gotLock) return;
  protocol.handle('tagnote', handleProtocol);
  pendingOpen = fileFromArgv(process.argv.slice(1));
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ---------- filer ---------- */
function decodeText(buf) {
  let text, converted = false;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (_) { text = new TextDecoder('windows-1252').decode(buf); converted = true; }
  return { text: text.replace(/^﻿/, ''), converted };
}
async function readDoc(p) {
  const { text, converted } = decodeText(fs.readFileSync(p));
  addRecent(p);
  return { path: p, content: text, converted };
}
function addRecent(p) {
  let list = getRecent().filter((x) => x !== p);
  list.unshift(p);
  list = list.slice(0, 12);
  try { fs.mkdirSync(userData(), { recursive: true }); fs.writeFileSync(recentFile(), JSON.stringify(list)); } catch (_) {}
  app.addRecentDocument && app.addRecentDocument(p);
}
function getRecent() {
  try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter((p) => fs.existsSync(p)); } catch (_) { return []; }
}
const openFilters = () => [
  { name: 'HTML', extensions: ['html', 'htm', 'xhtml', 'shtml'] },
  { name: S('filterAll', 'Alle filer'), extensions: ['*'] },
];

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: S('openTitle', 'Åbn dokument'), filters: openFilters(), properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return readDoc(r.filePaths[0]).catch((err) => ({ error: err.message }));
});
ipcMain.handle('file:read', async (_e, p) => { try { return await readDoc(p); } catch (err) { return { error: err.message }; } });
ipcMain.handle('file:save', async (_e, { path: p, content, saveAs, suggested }) => {
  if (!p || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: S('saveTitle', 'Gem dokument'), defaultPath: p || (suggested || 'index') + '.html',
      filters: [{ name: 'HTML', extensions: ['html', 'htm'] }, { name: S('filterAll', 'Alle filer'), extensions: ['*'] }],
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  try { fs.writeFileSync(p, content, 'utf8'); addRecent(p); return { path: p }; } catch (err) { return { error: err.message }; }
});
ipcMain.handle('file:recent', () => getRecent());
ipcMain.handle('file:clearRecent', () => { try { fs.unlinkSync(recentFile()); } catch (_) {} return true; });
ipcMain.handle('shell:show', (_e, p) => { if (p) shell.showItemInFolder(p); });
ipcMain.handle('dialog:confirm', async (_e, { message, detail, buttons }) => {
  const r = await dialog.showMessageBox(win, { type: 'warning', title: 'TagNote', message, detail, buttons: buttons || ['Gem', 'Gem ikke', 'Annuller'], defaultId: 0, cancelId: 2, noLink: true });
  return r.response;
});
ipcMain.handle('app:closeConfirmed', () => { forceClose = true; win && win.close(); });
ipcMain.handle('app:openExternal', (_e, url) => openExternal(url));
ipcMain.handle('edit:action', (_e, action) => {
  if (!win || !['cut', 'copy', 'paste', 'pasteAndMatchStyle', 'selectAll'].includes(action)) return false;
  win.webContents[action]();
  return true;
});
ipcMain.handle('clip:write', (_e, text) => { clipboard.writeText(String(text || '')); return true; });
ipcMain.handle('clip:read', () => ({ text: clipboard.readText(), html: clipboard.readHTML() }));

/* ---------- billeder ---------- */
ipcMain.handle('image:pick', async (_e, docPath) => {
  const r = await dialog.showOpenDialog(win, { title: S('imageTitle', 'Indsæt billede'), properties: ['openFile', 'multiSelections'], filters: [{ name: S('imageFilter', 'Billeder'), extensions: IMG_EXT }] });
  if (r.canceled) return [];
  return r.filePaths.map((p) => relOrFileUrl(p, docPath));
});
ipcMain.handle('image:rel', (_e, p, docPath) => (IMG_EXT.includes(extOf(p)) ? relOrFileUrl(p, docPath) : null));
function relOrFileUrl(p, docPath) {
  if (docPath) {
    const rel = path.relative(path.dirname(docPath), p);
    if (rel && !path.isAbsolute(rel)) return encodeURI(rel.split(path.sep).join('/'));
  }
  return pathToFileURL(p).href;
}

/* ---------- versionshistorik ---------- */
ipcMain.handle('snap:save', (_e, { key, content }) => {
  try {
    const d = snapDir(key);
    fs.mkdirSync(d, { recursive: true });
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(d, id + '.html'), content, 'utf8');
    fs.writeFileSync(path.join(d, 'key.txt'), key, 'utf8');
    const files = fs.readdirSync(d).filter((f) => f.endsWith('.html')).sort();
    files.slice(0, Math.max(0, files.length - 60)).forEach((f) => fs.unlinkSync(path.join(d, f)));
    return id;
  } catch (_) { return null; }
});
ipcMain.handle('snap:list', (_e, key) => {
  try {
    const d = snapDir(key);
    return fs.readdirSync(d).filter((f) => f.endsWith('.html')).sort().reverse().map((f) => ({ id: f.slice(0, -5), size: fs.statSync(path.join(d, f)).size }));
  } catch (_) { return []; }
});
ipcMain.handle('snap:read', (_e, key, id) => {
  try { return fs.readFileSync(path.join(snapDir(key), path.basename(id) + '.html'), 'utf8'); } catch (_) { return null; }
});

/* ---------- eksport ---------- */
function suggestName(docPath, ext) {
  const base = docPath ? path.basename(docPath, path.extname(docPath)) : 'index';
  return path.join(docPath ? path.dirname(docPath) : app.getPath('documents'), base + '.' + ext);
}
ipcMain.handle('export:run', async (_e, { kind, html, text, docPath, landscape }) => {
  const filters = { pdf: [{ name: 'PDF', extensions: ['pdf'] }], html: [{ name: 'HTML', extensions: ['html'] }], md: [{ name: 'Markdown', extensions: ['md'] }], txt: [{ name: 'Text', extensions: ['txt'] }] }[kind];
  if (!filters) return { error: 'unknown export' };
  const r = await dialog.showSaveDialog(win, { title: S('exportTitle', 'Eksportér'), defaultPath: suggestName(docPath, kind === 'html' ? 'copy.html' : kind), filters });
  if (r.canceled || !r.filePath) return null;
  try {
    if (kind === 'html' || kind === 'md' || kind === 'txt') fs.writeFileSync(r.filePath, kind === 'html' ? html : text, 'utf8');
    else if (kind === 'pdf') {
      const dir = docPath ? path.dirname(docPath) : os.tmpdir();
      const tmp = path.join(os.tmpdir(), 'tagnote-' + crypto.randomBytes(6).toString('hex') + '.html');
      const base = '<base href="' + pathToFileURL(dir + path.sep).href + '">';
      const src = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + base) : base + html;
      fs.writeFileSync(tmp, src, 'utf8');
      const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true } });
      try {
        await w.loadFile(tmp);
        const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, landscape: !!landscape, margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 } });
        fs.writeFileSync(r.filePath, pdf);
      } finally { w.destroy(); fs.unlink(tmp, () => {}); }
    }
    return { path: r.filePath };
  } catch (err) { return { error: err.message }; }
});

module.exports = { getWindow: () => win };
