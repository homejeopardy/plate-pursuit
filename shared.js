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

  // ---------- website: messages go through public MQTT relays over secure WebSockets ----------
  // No direct phone-to-laptop connection is needed, so school networks that block
  // WebRTC still work. The host listens on every relay; joiners use whichever connects.
  const RELAYS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  const topic = t => `plate-pursuit/v1/${room}/${t}`;
  const rid = () => Math.random().toString(36).slice(2, 10);
  const enc = o => JSON.stringify(o);
  const dec = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch (e) { return null; } };

  // ---------- website: the host page runs the game ----------
  let engine = null, bc = null;
  const relays = [];                 // host: one client per relay
  const seen = {};                   // teamId -> last time that phone said hello
  const baseUrl = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  function hostSnapshot() {
    const online = {}, cutoff = Date.now() - 25000;
    for (const id in seen) if (seen[id] > cutoff) online[id] = true;
    const joinUrl = baseUrl() + 'play.html?room=' + room;
    return { ...engine.state, serverNow: Date.now(), online, joinUrl, joinUrls: [joinUrl], room, hostOnline: relays.some(r => r.connected) };
  }
  let queued = false;
  function broadcast() {
    if (queued) return; queued = true;
    setTimeout(() => {
      queued = false;
      const snap = hostSnapshot();
      const payload = enc({ snap });
      for (const r of relays) if (r.connected) r.publish(topic('state'), payload, { qos: 1, retain: true });
      if (bc) bc.postMessage({ snap });
      receive(snap);
      if (!snap.hostOnline) status = relays.length ? "Can't reach the connection servers. Check the internet." : status;
    }, 0);
  }
  function handleRequest(client, msg) {
    if (!msg || typeof msg !== 'object' || !msg.cid) return;
    let r = { ok: true };
    if (msg.teamId) seen[msg.teamId] = Date.now();
    if (msg.kind === 'join') { const t = engine.join(msg.name, msg.teamId); seen[t.id] = Date.now(); r.team = t; broadcast(); }
    else if (msg.kind === 'buzz') r.won = engine.buzz(msg.teamId);
    else if (msg.kind === 'hello') { broadcast(); return; }
    else if (msg.kind === 'bye') { broadcast(); return; }
    if (msg.id != null) client.publish(topic('res/' + msg.cid), enc({ reply: msg.id, ...r }), { qos: 1 });
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
    if (!window.mqtt) { broadcast(); return setStatus("Couldn't load the connection library. Check the internet, then reload."); }
    status = `Opening room ${room}…`;
    for (const url of RELAYS) {
      const c = mqtt.connect(url, {
        clientId: 'pp-host-' + room + '-' + rid(), clean: true, reconnectPeriod: 3000, connectTimeout: 8000, keepalive: 20,
        will: { topic: topic('host'), payload: 'offline', qos: 1, retain: true },
      });
      relays.push(c);
      c.on('connect', () => {
        c.subscribe(topic('req'), { qos: 1 });
        c.publish(topic('host'), 'online', { qos: 1, retain: true });
        status = null; broadcast();
      });
      c.on('message', (t, buf) => { if (t === topic('req')) handleRequest(c, dec(buf)); });
      c.on('close', () => broadcast());
      c.on('error', e => console.warn('relay error', url, e && e.message));
    }
    broadcast();
    // keep everyone's clock in sync, and let screens notice if the host goes away
    setInterval(() => { const p = enc({ now: Date.now() }); for (const r of relays) if (r.connected) r.publish(topic('ping'), p, { qos: 0 }); }, 5000);
    // refresh "phone connected" dots as phones go quiet
    setInterval(broadcast, 10000);
    addEventListener('pagehide', () => { for (const r of relays) if (r.connected) r.publish(topic('host'), 'offline', { qos: 1, retain: true }); });
  }
  function newCode() { return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); }
  function newRoom() {
    for (const r of relays) if (r.connected) { r.publish(topic('host'), 'offline', { qos: 1, retain: true }); r.publish(topic('state'), '', { qos: 1, retain: true }); }
    safe(() => localStorage.setItem(PREFIX + 'room', newCode()));
    setTimeout(() => location.reload(), 400);
  }

  // ---------- website: projector and phones join the host's room ----------
  const cid = rid();
  let jc = null, relayIdx = 0, myTeam = null, pending = {}, nextId = 1, lastHeard = 0, hostState = null, opened = [], started = false;
  function joinStart() {
    if (started) return; started = true;
    if (window.BroadcastChannel) {   // projector opened from the host on the same computer
      bc = new BroadcastChannel(PREFIX + room);
      bc.onmessage = e => { if (e.data && e.data.snap) { lastHeard = Date.now(); receive(e.data.snap); } };
      bc.postMessage({ hello: 1 });
    }
    if (!window.mqtt) return setStatus("Couldn't load the connection library. Check the internet, then reload.");
    tryRelay();
    setInterval(() => {
      if (jc && jc.connected) jc.publish(topic('req'), enc({ cid, kind: 'hello', teamId: myTeam }), { qos: 0 });
      if (jc && jc.connected && hostState === 'online' && lastHeard && Date.now() - lastHeard > 70000) { connected = false; setStatus(`Lost the host. Is the host page still open?`); }
    }, 8000);
  }
  function tryRelay() {
    const url = RELAYS[relayIdx % RELAYS.length];
    setStatus(`Connecting to room ${room}…`);
    const c = (jc = mqtt.connect(url, {
      clientId: 'pp-' + cid + '-' + rid(), clean: true, reconnectPeriod: 3000, connectTimeout: 7000, keepalive: 20,
      will: { topic: topic('req'), payload: enc({ cid, kind: 'bye', teamId: myTeam }), qos: 0 },
    }));
    let gaveUp = false;
    const failover = setTimeout(() => {          // this relay didn't connect: try the next one
      if (c.connected) return;
      gaveUp = true; c.end(true);
      relayIdx++;
      if (relayIdx % RELAYS.length === 0) setStatus("Can't reach the connection servers. This network may block them. Try cellular data or another Wi-Fi.");
      setTimeout(tryRelay, relayIdx % RELAYS.length === 0 ? 3000 : 0);
    }, 9000);
    c.on('connect', () => {
      clearTimeout(failover);
      c.subscribe([topic('state'), topic('ping'), topic('host'), topic('res/' + cid)], { qos: 1 });
      c.publish(topic('req'), enc({ cid, kind: 'hello', teamId: myTeam }), { qos: 0 });
      setTimeout(() => { if (!state || hostState !== 'online') setStatus(`Waiting for room ${room}. Is the host page open? Check the room code.`); }, 3500);
      const waiting = opened; opened = []; waiting.forEach(f => f());
    });
    c.on('message', (t, buf, packet) => {
      if (t === topic('host')) {
        hostState = String(buf);
        if (hostState === 'offline') { connected = false; setStatus(`Waiting for room ${room}. The host page is closed.`); }
        else if (state) { status = null; emit(); }
        return;
      }
      const m = dec(buf); if (!m) return;
      if (t === topic('ping')) { lastHeard = Date.now(); offset = m.now - Date.now(); if (status && hostState === 'online' && state) { status = null; connected = true; emit(); } return; }
      if (t === topic('state')) {
        if (!m.snap) return;
        const keepOffset = packet && packet.retain;      // a retained copy can be old: don't trust its clock
        const o = offset;
        lastHeard = Date.now();
        state = m.snap; connected = hostState !== 'offline';
        if (keepOffset) offset = o; else offset = m.snap.serverNow - Date.now();
        if (hostState !== 'offline') status = null;
        emit(); return;
      }
      if (m.reply != null) { const f = pending[m.reply]; delete pending[m.reply]; if (f) f(m); }
    });
    c.on('close', () => { if (jc === c && !gaveUp && started) { connected = false; setStatus(`Reconnecting to room ${room}…`); emit(); } });
    c.on('error', e => console.warn('relay error', url, e && e.message));
  }
  function request(kind, data) {
    joinStart();
    return new Promise(resolve => {
      const send = () => {
        const id = nextId++;
        const t = setTimeout(() => {
          delete pending[id];
          if (!status) status = hostState === 'online' ? "The host didn't answer. Try again." : `Waiting for room ${room}. Is the host page open? Check the room code.`;
          resolve({ ok: false });
        }, 7000);
        pending[id] = m => { clearTimeout(t); resolve(m); };
        jc.publish(topic('req'), enc({ cid, id, kind, ...data }), { qos: 1 });
      };
      if (jc && jc.connected) send();
      else {
        const t = setTimeout(() => resolve({ ok: false }), 15000);
        opened.push(() => { clearTimeout(t); send(); });
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
      if (!started) joinStart();
      else if (jc && jc.connected && teamId) jc.publish(topic('req'), enc({ cid, kind: 'hello', teamId }), { qos: 0 });
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
