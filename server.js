// Plate Pursuit local server (offline fallback). No dependencies: `node server.js`.
// The website version runs the same engine inside host.html instead.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createEngine } = require('./engine.js');

const PORT = Number(process.env.PORT) || 3400;
const DIR = __dirname;
const SAVE = path.join(DIR, 'saved-game.json');
const PUBLIC = new Set(['index.html', 'host.html', 'display.html', 'play.html', 'shared.js', 'engine.js', 'style.css']);

const clients = new Set();
const engine = createEngine({
  load: () => JSON.parse(fs.readFileSync(SAVE, 'utf8')),
  persist: s => { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFile(SAVE, JSON.stringify(s), () => {}), 300); },
  onChange: () => push(),
});
let saveTimer = null;

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${PORT}`);
  return out;
}
function snapshot() {
  const online = {};
  for (const c of clients) if (c.teamId) online[c.teamId] = true;
  const urls = lanUrls().map(u => u + '/play.html');
  return { ...engine.state, serverNow: Date.now(), online, joinUrl: urls[0] || `http://localhost:${PORT}/play.html`, joinUrls: urls, room: null };
}
function push() {
  const data = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const c of clients) c.res.write(data);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 20000);

function body(req) {
  return new Promise(resolve => {
    let b = ''; req.on('data', d => { b += d; if (b.length > 2e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}
const json = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/mode.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('window.PP_LOCAL = true;');
  }
  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const c = { res, teamId: Number(url.searchParams.get('team')) || null };
    clients.add(c);
    req.on('close', () => { clients.delete(c); if (c.teamId) push(); });
    if (c.teamId) push(); else res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    return;
  }
  if (req.method === 'POST' && p === '/action') {
    const b = await body(req);
    return json(res, { ok: engine.act(b.type, b) });
  }
  if (req.method === 'POST' && p === '/join') {
    const b = await body(req);
    return json(res, { ok: true, team: engine.join(b.name, b.teamId) });
  }
  if (req.method === 'POST' && p === '/wager') {
    const b = await body(req);
    return json(res, engine.wager(b.teamId, b.amount));
  }
  if (req.method === 'POST' && p === '/answer') {
    const b = await body(req);
    return json(res, engine.answer(b.teamId, b.text));
  }
  if (req.method === 'POST' && p === '/buzz') {
    const b = await body(req);
    return json(res, { ok: true, won: engine.buzz(b.teamId) });
  }

  const file = p === '/' ? 'index.html' : p.slice(1).split('?')[0];
  if (!PUBLIC.has(file)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(DIR, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('Plate Pursuit (local mode) running.');
  console.log(`  Host:      http://localhost:${PORT}/host.html`);
  console.log(`  Projector: http://localhost:${PORT}/display.html`);
  for (const u of lanUrls()) console.log(`  Phones:    ${u}/play.html`);
});
