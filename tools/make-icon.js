// Tegner build/icon.png ud fra tools/icon.svg (kør: npx electron tools/make-icon.js)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
  const w = new BrowserWindow({ width: 256, height: 256, show: false, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,' + encodeURIComponent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>' + svg));
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img.toPNG());
  console.log('icon ok', img.getSize());
  app.quit();
});
