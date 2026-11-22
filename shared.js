// Client helpers shared by host.html, display.html and play.html.
// The server (server.js) owns the game; pages subscribe over SSE and POST actions.

const PP = (() => {
  const LOCAL = !!window.PP_LOCAL;
  const PREFIX = 'plate-pursuit-';
  const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
  let offset = 0;          // host clock - this device's clock, so every screen shares one clock
  let listeners = [], state = null, connected = false, status = null;
  let room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '') || null;
  const emit = () => listeners.forEach(fn => fn(state));
  const setStatus = t => { if (t !== status) { status = t; emit(); } };
  const receive = snap => { state = snap; offset = snap.serverNow - Date.now(); connected = true; status = null; emit(); };
  const safe = f => { try { return f(); } catch (e) { return null; } };

  // ---------- local server mode (node server.js) ----------
  let es = null;
  function localConnect(teamId) {
    if (es) es.close();
    es = new EventSource('/events' + (teamId ? `?team=${teamId}` : ''));
    es.onmessage = e => receive(JSON.parse(e.data));
    es.onerror = () => { connected = false; setStatus('Lost the game server. Is it still running?'); };
  }
  const httpPost = (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
    .then(r => r.json()).catch(() => ({ ok: false }));

  // ---------- website: the host page runs the game ----------
  let engine = null, peer = null, bc = null;
  const conns = new Set();
  const baseUrl = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  function hostSnapshot() {
    const online = {};
    for (const c of conns) if (c.teamId && c.open) online[c.teamId] = true;
    const joinUrl = baseUrl() + 'play.html?room=' + room;
    return { ...engine.state, serverNow: Date.now(), online, joinUrl, joinUrls: [joinUrl], room, hostOnline: !!(peer && peer.open) };
  }
  let queued = false;
  function broadcast() {
    if (queued) return; queued = true;
    setTimeout(() => {
      queued = false;
      const snap = hostSnapshot();
      for (const c of conns) if (c.open) c.send({ snap });
      if (bc) bc.postMessage({ snap });
      receive(snap);
      if (!snap.hostOnline && status == null) status = 'opening';
    }, 0);
  }
  function startHost() {
    if (LOCAL) return localConnect();
    room = safe(() => localStorage.getItem(PREFIX + 'room'));
    if (!room) { room = newCode(); safe(() => localStorage.setItem(PREFIX + 'room', room)); }
    engine = createEngine({
      load: () => JSON.parse(localStorage.getItem(PREFIX + 'game') || 'null'),
      persist: s => safe(() => localStorage.setItem(PREFIX + 'game', JSON.stringify(s))),
      onChange: broadcast,
    });
    if (window.BroadcastChannel) {
      bc = new BroadcastChannel(PREFIX + room);
      bc.onmessage = e => { if (e.data && e.data.hello) broadcast(); };
    }
    broadcast();
    if (!window.Peer) return setStatus("Couldn't load the connection library. Check the internet, then reload.");
    let tries = 0;
    const open = () => {
      setStatus(`Opening room ${room}…`);
      peer = new Peer(PREFIX + room, { debug: 1 });
      peer.on('open', () => { tries = 0; status = null; broadcast(); });
      peer.on('connection', conn => {
        conn.teamId = Number((conn.metadata || {}).teamId) || null;
        conn.on('open', () => { conns.add(conn); broadcast(); });
        conn.on('data', msg => {
          if (!msg || typeof msg !== 'object') return;
          let r = { ok: true };
          if (msg.kind === 'join') { const t = engine.join(msg.name, msg.teamId); conn.teamId = t.id; r.team = t; broadcast(); }
          else if (msg.kind === 'buzz') r.won = engine.buzz(msg.teamId);
          else if (msg.kind === 'hello') { if (msg.teamId) conn.teamId = Number(msg.teamId); broadcast(); }
          if (msg.id != null && conn.open) conn.send({ reply: msg.id, ...r });
        });
        const gone = () => { if (conns.delete(conn)) broadcast(); };
        conn.on('close', gone); conn.on('error', gone);
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', e => {
        broadcast();
        if (e.type === 'unavailable-id') {
          peer.destroy();
          if (++tries <= 6) { setStatus(`Room ${room} is still closing from last time. Retrying…`); setTimeout(open, 3000); }
          else setStatus(`Room ${room} is in use. Is the host page open in another tab? If not, click "New room code".`);
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
          setStatus("Can't reach the connection server. Check the internet. Retrying…");
          peer.destroy(); setTimeout(open, 3000);
        } else console.warn('peer error', e.type, e);
      });
    };
    open();
    setInterval(() => { for (const c of conns) if (c.open) c.send({ now: Date.now() }); }, 4000);
  }
  function newCode() { return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); }
  function newRoom() {
    safe(() => localStorage.setItem(PREFIX + 'room', newCode()));
    if (peer) peer.destroy();
    location.reload();
  }

  // ---------- website: projector and phones join the host's room ----------
  let jpeer = null, conn = null, myTeam = null, pending = {}, nextId = 1, lastHeard = 0, opened = null, retry = null;
  function joinStart() {
    if (jpeer) return;
    if (window.BroadcastChannel) {   // projector opened from the host on the same computer
      bc = new BroadcastChannel(PREFIX + room);
      bc.onmessage = e => { if (e.data && e.data.snap) { lastHeard = Date.now(); receive(e.data.snap); } };
      bc.postMessage({ hello: 1 });
    }
    if (!window.Peer) return setStatus("Couldn't load the connection library. Check the internet, then reload.");
    setStatus(`Connecting to room ${room}…`);
    jpeer = new Peer({ debug: 1 });
    let stalls = 0;
    const later = (ms, why) => { if (why) setStatus(why); clearTimeout(retry); retry = setTimeout(connect, ms); };
    const connect = () => {
      clearTimeout(retry);
      if (conn) safe(() => conn.close());
      if (jpeer.disconnected) { jpeer.reconnect(); return later(2000); }
      const c = (conn = jpeer.connect(PREFIX + room, { metadata: { teamId: myTeam }, serialization: 'json', reliable: true }));
      c.on('open', () => { stalls = 0; lastHeard = Date.now(); if (opened) { opened(); opened = null; } });
      c.on('data', m => {
        lastHeard = Date.now();
        if (m && m.reply != null) { const f = pending[m.reply]; delete pending[m.reply]; if (f) f(m); return; }
        if (m && m.snap) receive(m.snap);
      });
      c.on('close', () => { if (conn === c) { connected = false; later(1500, `Lost the host. Reconnecting to room ${room}…`); } });
      setTimeout(() => {
        if (conn === c && !c.open) later(0, ++stalls >= 2
          ? `Found room ${room}, but this browser won't connect to it. A VPN, a privacy setting or a strict network can block this.`
          : `Connecting to room ${room}…`);
      }, 6000);
    };
    jpeer.on('open', connect);
    jpeer.on('disconnected', () => { if (!jpeer.destroyed) jpeer.reconnect(); });
    jpeer.on('error', e => {
      if (e.type === 'peer-unavailable') later(3000, `Waiting for room ${room}. Is the host page open? Check the room code.`);
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) later(3000, "Can't reach the connection server. Check the internet. Retrying…");
      else console.warn('peer error', e.type, e);
    });
    setInterval(() => {
      if (conn && conn.open && Date.now() - lastHeard > 30000) { connected = false; later(0, `Lost the host. Reconnecting to room ${room}…`); }
    }, 3000);
  }
  function request(kind, data) {
    joinStart();
    return new Promise(resolve => {
      const send = () => {
        const id = nextId++;
        const t = setTimeout(() => { delete pending[id]; resolve({ ok: false }); }, 6000);
        pending[id] = m => { clearTimeout(t); resolve(m); };
        conn.send({ id, kind, ...data });
      };
      if (conn && conn.open) send();
      else {
        const t = setTimeout(() => { opened = null; resolve({ ok: false }); }, 10000);
        opened = () => { clearTimeout(t); send(); };
      }
    });
  }

  return {
    get local() { return LOCAL; },
    get room() { return room; },
    get state() { return state; },
    get connected() { return connected; },
    get status() { return status === 'opening' ? null : status; },
    on: fn => listeners.push(fn),
    now: () => Date.now() + offset,
    startHost, newRoom,
    connect(teamId) {
      if (LOCAL) return localConnect(teamId);
      if (teamId) myTeam = teamId;
      if (!jpeer) joinStart();
      else if (conn && conn.open && teamId) conn.send({ kind: 'hello', teamId });
    },
    post(url, data) {
      if (LOCAL) return httpPost(url, data);
      if (url === '/join') return request('join', data);
      if (url === '/buzz') return request('buzz', data);
      return Promise.resolve({ ok: false });
    },
    act(type, data) {
      if (LOCAL) return httpPost('/action', { type, ...data });
      if (engine) return Promise.resolve({ ok: engine.act(type, data || {}) });
      return Promise.resolve({ ok: false });
    },
    // Projector and phones need a room code on the website. Shows a form and returns true when it's missing.
    needRoom(title) {
      if (LOCAL || room) return false;
      document.body.innerHTML = `<form class="room-form" id="roomForm">
        <div class="sign green">${esc(title)}</div>
        <p>Type the room code shown on the projector or the host's screen.</p>
        <input id="roomIn" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD">
        <button class="btn primary">Join</button></form>`;
      const inp = document.getElementById('roomIn'); inp.focus();
      document.getElementById('roomForm').onsubmit = e => {
        e.preventDefault();
        const code = inp.value.toUpperCase().replace(/[^A-Z]/g, '');
        if (code.length !== 4) return inp.focus();
        const q = new URLSearchParams(location.search); q.set('room', code);
        location.search = q.toString();
      };
      return true;
    },
  };
})();

function ppElapsed(s) { return s.elapsed + (s.runningSince ? (PP.now() - s.runningSince) / 1000 : 0); }
function ppValue(s) {
  const { maxPoints, minPoints, drainSeconds } = s.settings;
  const t = Math.min(1, ppElapsed(s) / drainSeconds);
  return Math.max(minPoints, Math.ceil((maxPoints - (maxPoints - minPoints) * t) / 10) * 10);
}
function ppFraction(s) { return Math.max(0, 1 - ppElapsed(s) / s.settings.drainSeconds); }
function ppSpeedLeft(s) { return s.speed && s.speed.endsAt ? Math.max(0, (s.speed.endsAt - PP.now()) / 1000) : (s.settings.speedSeconds); }
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const teamName = (s, id) => (s.teams.find(t => t.id === id) || {}).name || '';

function plateHTML(text, opts = {}) {
  return `<div class="plate ${opts.cls || ''}">
    <i class="slot l"></i><i class="slot r"></i>
    <span class="sticker l">11</span><span class="sticker r">27</span>
    <div class="plate-top">${opts.top || 'Puzzle State'}</div>
    <div class="plate-text"><span>${esc(text) || '&nbsp;'}</span></div>
    <div class="plate-bottom">${opts.bottom || 'LAND OF VANITY PLATES'}</div>
  </div>`;
}

// Stretch the characters across the plate. Letters are sized to the plate's height
// in CSS; here they're squeezed (long plates) or spaced out (short ones) to fill the width.
function fitPlate(plate) {
  const span = plate.querySelector('.plate-text span');
  if (!span || !plate.clientWidth) return;
  span.style.cssText = '';
  const chars = span.textContent.trim().length;
  const avail = plate.clientWidth * 0.9;
  const w = span.getBoundingClientRect().width;
  if (!w) return;
  if (w > avail) {
    let squeeze = avail / w;
    if (squeeze < 0.62) { span.style.fontSize = (84 * squeeze / 0.62) + 'cqh'; squeeze = 0.62; }
    span.style.transform = `scaleX(${squeeze})`;
  } else if (chars > 1) {
    const fontPx = parseFloat(getComputedStyle(span).fontSize);
    const ls = Math.min((avail - w) / (chars - 1), fontPx * 0.22);
    span.style.letterSpacing = ls + 'px';
    span.style.marginRight = -ls + 'px';
  }
}
const _fitWatch = new WeakSet();
const _ro = window.ResizeObserver ? new ResizeObserver(es => es.forEach(e => fitPlate(e.target))) : null;
function fitPlates() {
  document.querySelectorAll('.plate').forEach(p => {
    if (_ro && !_fitWatch.has(p)) { _fitWatch.add(p); _ro.observe(p); }
    fitPlate(p);
  });
}
let _fitQueued = false;
new MutationObserver(() => {
  if (_fitQueued) return; _fitQueued = true;
  queueMicrotask(() => { _fitQueued = false; fitPlates(); });
}).observe(document.documentElement, { childList: true, subtree: true });
if (document.fonts) document.fonts.ready.then(fitPlates);

// ---- generated sound effects (no audio files) ----
const SFX = (() => {
  let ctx = null;
  const unlock = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  };
  function tone(freq, start, dur, type = 'sine', vol = 0.25, endFreq) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const sounds = {
    buzz: () => { tone(180, 0, 0.45, 'square', 0.18); tone(182, 0, 0.45, 'sawtooth', 0.08); },
    correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.25)),
    wrong: () => { tone(220, 0, 0.3, 'sawtooth', 0.15, 160); tone(150, 0.28, 0.5, 'sawtooth', 0.15, 100); },
    reveal: () => { tone(880, 0, 0.6, 'sine', 0.2); tone(1320, 0.08, 0.6, 'sine', 0.12); },
    pass: () => tone(300, 0, 0.18, 'triangle', 0.18, 220),
    start: () => { tone(392, 0, 0.12, 'triangle', 0.2); tone(587, 0.12, 0.25, 'triangle', 0.2); },
    timeup: () => { tone(330, 0, 0.9, 'square', 0.14); tone(415, 0, 0.9, 'square', 0.1); },
    winner: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.4, 'triangle', 0.22)),
  };
  return {
    unlock,
    play: n => { try { sounds[n] && sounds[n](); } catch (e) {} },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
})();
