// Flip Side: connections between screens (adapted from Plate Pursuit's shared.js), sounds, helpers.
const PP = (() => {
  const LOCAL = !!window.PP_LOCAL;
  const PREFIX = 'flip-side-';
  const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
  let offset = 0;          // host clock - this device's clock, so every screen shares one clock
  let listeners = [], state = null, connected = false, status = null;
  let room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '') || null;
  const emit = () => listeners.forEach(fn => fn(state));
  const setStatus = t => { if (t !== status) { status = t; emit(); } };
  const receive = snap => { state = snap; offset = snap.serverNow - Date.now(); connected = true; status = null; emit(); };
  const safe = f => { try { return f(); } catch (e) { return null; } };
  // Every host update is numbered. A screen can get the same update twice (instantly inside the browser, and later
  // through the internet relay), so an older copy that turns up after a newer one is thrown away instead of
  // flicking the screen back to old scores and replaying sounds.
  let lastSid = null, lastSeq = 0;
  const fresh = snap => {
    if (snap.sid && snap.sid === lastSid && snap.seq <= lastSeq) return false;
    if (snap.sid) { lastSid = snap.sid; lastSeq = snap.seq; }
    return true;
  };

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
  const topic = t => `flip-side/v1/${room}/${t}`;
  const rid = () => Math.random().toString(36).slice(2, 10);
  const enc = o => JSON.stringify(o);
  const dec = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch (e) { return null; } };

  // ---------- website: the host page runs the game ----------
  let engine = null, bc = null;
  const relays = [];                 // host: one client per relay
  const seen = {};                   // teamId -> last time that phone said hello
  const baseUrl = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  const hostSid = rid(); let hostSeq = 0;
  function hostSnapshot() {
    const online = {}, cutoff = Date.now() - 25000;
    for (const id in seen) if (seen[id] > cutoff) online[id] = true;
    const joinUrl = baseUrl() + 'play.html?room=' + room;
    return { ...engine.state, serverNow: Date.now(), online, joinUrl, joinUrls: [joinUrl], room, hostOnline: relays.some(r => r.connected), sid: hostSid, seq: ++hostSeq };
  }
  let queued = false;
  function broadcast() {
    if (queued) return; queued = true;
    setTimeout(() => {
      queued = false;
      const snap = hostSnapshot();
      // other screens get only the puzzle being played, and only the faces of cards that are turned over
      const shared = { ...snap, puzzles: undefined, puzzle: snap.puzzles[snap.cur] || null,
        board: snap.board.map(c => c.gone || snap.flips.includes(c.n) ? c : { n: c.n, gone: false, kind: 'hidden' }) };
      const payload = enc({ snap: shared });
      for (const r of relays) if (r.connected) r.publish(topic('state'), payload, { qos: 1, retain: true });
      if (bc) bc.postMessage({ snap: shared });
      receive(snap);
      if (!snap.hostOnline) status = relays.length ? "Can't reach the connection servers. Check the internet." : status;
    }, 0);
  }
  function handleRequest(client, msg) {
    if (!msg || typeof msg !== 'object' || !msg.cid) return;
    let r = { ok: true };
    if (msg.teamId) seen[msg.teamId] = Date.now();
    if (msg.kind === 'join') { const t = engine.join(msg.name, msg.teamId); seen[t.id] = Date.now(); r.team = t; broadcast(); }
    else if (msg.kind === 'flip') r.ok = engine.phoneFlip(msg.teamId, msg.n);
    else if (msg.kind === 'solve') r.ok = engine.phoneSolve(msg.teamId);
    else if (msg.kind === 'again') r.ok = engine.phoneAgain(msg.teamId);
    else if (msg.kind === 'color') r = engine.color(msg.teamId, msg.color);
    else if (msg.kind === 'img') { publishImage(msg.img); return; }
    else if (msg.kind === 'hello') { broadcast(); return; }
    else if (msg.kind === 'bye') { broadcast(); return; }
    if (msg.id != null) client.publish(topic('res/' + msg.cid), enc({ reply: msg.id, ...r }), { qos: 1 });
  }
  // pictures the host uploaded live only in this browser: other screens ask for them by id
  const published = {};
  function publishImage(id) {
    if (!id || !/^up:/.test(id)) return;
    FSImages.get(id).then(data => {
      if (!data) return;
      for (const r of relays) if (r.connected && !published[id + relays.indexOf(r)]) { r.publish(topic('img/' + id.slice(3)), data, { qos: 1, retain: true }); published[id + relays.indexOf(r)] = 1; }
    });
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
      bc.onmessage = e => {
        if (!e.data) return;
        if (e.data.hello) broadcast();
        if (e.data.needImg) FSImages.get(e.data.needImg).then(data => { if (data) bc.postMessage({ img: e.data.needImg, data }); });
      };
    }
    if (!window.mqtt) { broadcast(); return setStatus("Couldn't load the connection library. Check the internet, then reload."); }
    status = `Opening room ${room}…`;
    for (const url of RELAYS) {
      const c = mqtt.connect(url, {
        clientId: 'fs-host-' + room + '-' + rid(), clean: true, reconnectPeriod: 3000, connectTimeout: 8000, keepalive: 20,
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
    setInterval(() => engine.tick(), 200);   // cards that were peeking turn back over by themselves
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
      bc.onmessage = e => {
        if (!e.data) return;
        if (e.data.snap) { lastHeard = Date.now(); if (fresh(e.data.snap)) receive(e.data.snap); }
        if (e.data.img) gotImage(e.data.img, e.data.data);
      };
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
      clientId: 'fs-' + cid + '-' + rid(), clean: true, reconnectPeriod: 3000, connectTimeout: 7000, keepalive: 20,
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
      if (t.startsWith(topic('img/'))) { gotImage('up:' + t.slice(topic('img/').length), String(buf)); return; }
      const m = dec(buf); if (!m) return;
      if (t === topic('ping')) { lastHeard = Date.now(); offset = m.now - Date.now(); if (status && hostState === 'online' && state) { status = null; connected = true; emit(); } return; }
      if (t === topic('state')) {
        if (!m.snap) return;
        lastHeard = Date.now();
        if (!fresh(m.snap)) return;   // an older copy of something already shown
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
  const imgCache = {}, imgWait = {};
  function gotImage(id, data) {
    if (!data || imgCache[id]) return;
    imgCache[id] = data; (imgWait[id] || []).forEach(f => f(data)); delete imgWait[id];
  }
  // a picture by id: "images/…" files load directly; "up:…" uploads come from the host page
  function getImage(id) {
    if (!/^up:/.test(id)) return Promise.resolve(id);
    if (engine) return FSImages.get(id);
    if (imgCache[id]) return Promise.resolve(imgCache[id]);
    return new Promise(res => {
      const first = !imgWait[id]; (imgWait[id] = imgWait[id] || []).push(res);
      if (!first) return;
      const ask = () => {
        if (imgCache[id]) return;
        if (bc) bc.postMessage({ needImg: id });
        if (jc && jc.connected) { jc.subscribe(topic('img/' + id.slice(3)), { qos: 1 }); jc.publish(topic('req'), enc({ cid, kind: 'img', img: id }), { qos: 1 }); }
        else opened.push(ask);
      };
      joinStart(); ask(); setTimeout(() => { if (!imgCache[id]) ask(); }, 4000);
    });
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
    startHost, newRoom, getImage,
    connect(teamId) {
      if (LOCAL) return localConnect(teamId);
      if (teamId) myTeam = teamId;
      if (!started) joinStart();
      else if (jc && jc.connected && teamId) jc.publish(topic('req'), enc({ cid, kind: 'hello', teamId }), { qos: 0 });
    },
    post(url, data) {
      if (LOCAL) return httpPost(url, data);
      const kinds = { '/join': 'join', '/flip': 'flip', '/solve': 'solve', '/again': 'again', '/color': 'color' };
      if (kinds[url]) return request(kinds[url], data);
      return Promise.resolve({ ok: false });
    },
    act(type, data) {
      if (LOCAL) return httpPost('/action', { type, ...data });
      if (engine) return Promise.resolve({ ok: engine.act(type, data || {}) });
      return Promise.resolve({ ok: false });
    },
    // Projector and phones need a room code on the website. Shows a form and returns true when it's missing.
    needRoom(title, useSaved) {
      if (LOCAL || room) return false;
      // the projector and host script opened on the host's own computer (a bookmark, a Stream Dock key) use the host's room
      if (useSaved) { const saved = safe(() => localStorage.getItem(PREFIX + 'room')); if (saved && /^[A-Z]{4}$/.test(saved)) { room = saved; return false; } }
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

// ---- pictures uploaded on the host computer, kept in this browser (IndexedDB) ----
const FSImages = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('flip-side-images', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction('img', mode); const q = fn(t.objectStore('img')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return {
    get: id => tx('readonly', s => s.get(id)).catch(() => null),
    put: (id, data) => tx('readwrite', s => s.put(data, id)),
    del: id => tx('readwrite', s => s.delete(id)).catch(() => null),
    // shrink a picked file to a JPEG data URL small enough to send to other screens
    fromFile(file, max = 1200) {
      return new Promise((res, rej) => {
        const url = URL.createObjectURL(file), im = new Image();
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          let q = 0.85, d = c.toDataURL('image/jpeg', q);
          while (d.length > 380000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
          res(d);
        };
        im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Not a picture')); };
        im.src = url;
      });
    },
  };
})();

const TEAM_COLORS = { red: '#c8322a', blue: '#2563c9', orange: '#e07a10', purple: '#7a45c2', teal: '#0f8f86', pink: '#d6417f', green: '#2f8a3e', brown: '#8a5a2b' };
const teamColor = t => TEAM_COLORS[t && t.color] || TEAM_COLORS.green;
const teamStyle = t => `--team:${teamColor(t)}`;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const teamName = (s, id) => (s.teams.find(t => t.id === id) || {}).name || '';
const fsPot = (s, id) => (s.pot[id] || []).reduce((a, c) => a + c.v, 0);
const fsCardLabel = c => c.kind === 'pts' ? String(c.v) : c.kind === 'wild' ? 'WILD' : c.kind === 'take' ? 'TAKE' : c.kind === 'lose' ? 'LOSE A TURN' : '';
const fsPuzzle = s => s.puzzle !== undefined ? s.puzzle : (s.puzzles || [])[s.cur] || null;
const fsLeft = s => s.board.filter(c => !c.gone).length;
function fsAnswerLeft(s) { return s.answerEndsAt ? Math.max(0, (s.answerEndsAt - PP.now()) / 1000) : null; }
function fsAnswerText(s) { const l = fsAnswerLeft(s); return l == null ? '' : l > 0 ? String(Math.ceil(l)) : 'TIME'; }
function fsRanking(s) {
  return [...s.teams].sort((a, b) => b.score - a.score).map(t => ({ team: t, rank: 1 + s.teams.filter(o => o.score > t.score).length }));
}
// what just happened, in a few words (projector banner, phones, host)
function fsResultText(s) {
  const r = s.result; if (!r) return '';
  const n = id => teamName(s, id);
  if (r.kind === 'miss') return 'No match';
  if (r.kind === 'match') {
    if (r.effect === 'take') return r.took ? `${n(r.team)} takes ${r.took.v} from ${n(r.took.from)}!` : `TAKE: nothing to take yet`;
    if (r.effect === 'lose') return `${n(r.team)} loses a turn`;
    if (r.cards.every(c => c === 'WILD')) return `Two wilds! +${r.points}`;
    if (r.cards.includes('WILD')) return `Wild card! +${r.points}`;
    return `Match! +${r.points}`;
  }
  if (r.kind === 'wrong') return r.penalty ? `Not quite! ${n(r.team)} −${r.penalty}` : 'Not quite!';
  if (r.kind === 'solved') return `${n(r.team)} solves it! +${r.points}`;
  if (r.kind === 'revealed') return 'Here it is';
  return '';
}
// ---- keyboard shortcuts (stream deck): Ctrl+Shift+letter
const FS_KEYS = { KeyG: 'go', KeyC: 'correct', KeyX: 'wrong', KeyU: 'undo', KeyN: 'next', KeyV: 'solve', KeyA: 'again', KeyP: 'pass', KeyR: 'reveal', KeyJ: 'lobby', KeyE: 'final' };
function fsKeyName(e) {
  if (!e.ctrlKey || !e.shiftKey || e.metaKey) return null;
  // cards: Ctrl+Shift+1…9,0 flips cards 1–10; add Option/Alt for cards 11–20
  const d = /^Digit(\d)$/.exec(e.code);
  if (d) return 'card:' + ((Number(d[1]) || 10) + (e.altKey ? 10 : 0));
  return e.altKey ? null : FS_KEYS[e.code] || null;
}
const _keyChan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flip-side-keys') : null;
function fsForwardKeys() {
  if (!_keyChan) return;
  document.addEventListener('keydown', e => { const n = fsKeyName(e); if (!n) return; e.preventDefault(); _keyChan.postMessage({ key: n, room: PP.room || null }); }, true);
}
function fsOnForwardedKey(fn) { if (_keyChan) _keyChan.onmessage = e => { if (e.data && (e.data.room || null) === (PP.room || null)) fn(e.data.key); }; }
// ---- generated sound effects (no audio files): everything is synthesised in the browser ----
const SFX = (() => {
  let ctx = null, out = null, noiseBuf = null;
  const unlock = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(), vol = ctx.createGain();
      vol.gain.value = 0.9; comp.connect(vol).connect(ctx.destination); out = comp;
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const filt = (type, freq, q = 0.8) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  // one note: f = pitch, t = start (s from now), d = length, hold = keep full volume until near the end (horns, brass)
  function note({ f, t = 0, d = 0.3, type = 'sine', v = 0.2, to, lp, vib, a = 0.012, hold = false }) {
    const t0 = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + d + 0.1); }
    let n = o; if (lp) { const fl = filt('lowpass', lp); o.connect(fl); n = fl; }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a);
    if (hold) g.gain.setValueAtTime(v, t0 + Math.max(a, d - 0.07));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    n.connect(g).connect(out); o.start(t0); o.stop(t0 + d + 0.05);
  }
  // noise: hp / lp / bp filters, sweep = band-pass glide, trem = drum-roll flutter, swell = fade in rather than out
  function noise({ t = 0, d = 0.1, v = 0.2, hp, lp, bp, sweep, trem, swell }) {
    const t0 = ctx.currentTime + t, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    let n = src;
    if (hp) { const f = filt('highpass', hp); n.connect(f); n = f; }
    if (lp) { const f = filt('lowpass', lp); n.connect(f); n = f; }
    if (bp || sweep) { const f = filt('bandpass', bp || sweep[0], 1.4); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep[1], t0 + d); n.connect(f); n = f; }
    if (trem) {
      const tg = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      tg.gain.value = 0.5; l.type = 'square'; l.frequency.value = trem; lg.gain.value = 0.5;
      l.connect(lg).connect(tg.gain); l.start(t0); l.stop(t0 + d + 0.1); n.connect(tg); n = tg;
    }
    g.gain.setValueAtTime(0.0001, t0);
    if (swell) { g.gain.exponentialRampToValueAtTime(v * 0.25, t0 + 0.05); g.gain.exponentialRampToValueAtTime(v, t0 + d - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); }
    else { g.gain.exponentialRampToValueAtTime(v, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); }
    n.connect(g).connect(out); src.start(t0, Math.random()); src.stop(t0 + d + 0.05);
  }
  const crash = (t, v = 0.22) => { noise({ t, d: 1.6, v, hp: 5000 }); noise({ t, d: 0.5, v: v * 0.6, bp: 3000 }); };
  const kick = t => note({ f: 130, to: 45, t, d: 0.16, v: 0.55, a: 0.003 });
  const snare = (t, v = 0.2) => { noise({ t, d: 0.13, v, bp: 1900 }); note({ f: 210, to: 160, t, d: 0.08, v: v * 0.6, type: 'triangle', a: 0.002 }); };
  const hat = (t, v = 0.07) => noise({ t, d: 0.035, v, hp: 7500 });
  const brass = (m, t, d, v = 0.1) => { note({ f: mtof(m), t, d, type: 'sawtooth', v, lp: 2600, a: 0.03, hold: true }); note({ f: mtof(m) * 1.004, t, d, type: 'sawtooth', v: v * 0.6, lp: 2000, a: 0.03, hold: true }); };
  const bell = (f, t, v = 0.28) => { note({ f, t, d: 1.5, v, a: 0.003 }); note({ f: f * 2.01, t, d: 0.7, v: v * 0.3, a: 0.003 }); note({ f: f * 3.02, t, d: 0.35, v: v * 0.14, a: 0.003 }); };
  function applause(t, d = 2.6, v = 0.11) {
    for (let i = 0; i < 140; i++) { const at = t + Math.random() * d, fade = 1 - (at - t) / d * 0.7; noise({ t: at, d: 0.025 + Math.random() * 0.03, v: v * fade * (0.5 + Math.random() * 0.5), bp: 1200 + Math.random() * 1800 }); }
  }
  // the theme: four bars of a road-trip tune and a final hit
  function theme() {
    const e = 60 / 138 / 2;   // one eighth note
    const mel = [[67,1],[72,1],[76,1],[79,2],[76,1],[79,2], [81,1],[79,1],[76,1],[72,2],[74,1],[76,2],
                 [77,1],[76,1],[74,1],[72,1],[74,1],[77,1],[81,2], [79,2],[83,2],[86,2],[0,1],[79,1]];
    let t = 0.05;
    for (const [m, n] of mel) { if (m) { note({ f: mtof(m), t, d: n * e * 0.92, type: 'square', v: 0.07, lp: 3200, a: 0.006, hold: true }); note({ f: mtof(m + 12), t, d: n * e * 0.8, type: 'triangle', v: 0.04, a: 0.006 }); } t += n * e; }
    const roots = [48, 45, 41, 43], thirds = [4, 3, 4, 4];
    roots.forEach((r, b) => {
      const b0 = 0.05 + b * 8 * e;
      for (let q = 0; q < 4; q++) note({ f: mtof(q % 2 ? r + 12 : r), t: b0 + q * 2 * e, d: 2 * e * 0.85, type: 'square', v: 0.07, lp: 700, a: 0.005, hold: true });
      [r + 12, r + 12 + thirds[b], r + 19].forEach(m => note({ f: mtof(m + 12), t: b0, d: 8 * e, type: 'triangle', v: 0.025, a: 0.08, hold: true }));
      for (let k = 0; k < 8; k++) { hat(b0 + k * e); if (k % 4 === 0) kick(b0 + k * e); if (k % 4 === 2) snare(b0 + k * e); }
    });
    const end = 0.05 + 32 * e;
    snare(end - e, 0.14); snare(end - e / 2, 0.18);
    [60, 64, 67, 72].forEach(m => brass(m, end, 1.1, 0.07)); note({ f: mtof(84), t: end, d: 1.1, type: 'square', v: 0.07, lp: 3200, hold: true });
    note({ f: mtof(36), t: end, d: 1.1, type: 'square', v: 0.09, lp: 600, hold: true }); kick(end); crash(end);
  }
  const sounds = {
    // buzz-in: a car horn, two detuned tones like a real one
    buzz: () => { [405, 508].forEach(f => { note({ f, d: 0.55, type: 'sawtooth', v: 0.14, lp: 2400, a: 0.01, hold: true }); note({ f: f * 1.006, d: 0.55, type: 'square', v: 0.05, lp: 1800, a: 0.01, hold: true }); }); },
    // correct: ding-ding
    correct: () => { bell(1319, 0); bell(1760, 0.16); },
    // wrong: the sad trombone, wah wah wah waaah
    wrong: () => {
      [392, 370, 349].forEach((f, i) => note({ f: f * 1.03, to: f, t: i * 0.42, d: 0.38, type: 'sawtooth', v: 0.15, lp: 1100, a: 0.04, hold: true }));
      note({ f: 340, to: 318, t: 1.26, d: 1.15, type: 'sawtooth', v: 0.15, lp: 1100, a: 0.04, hold: true, vib: [5.5, 9] });
    },
    reveal: () => [72, 76, 79, 84].forEach((m, i) => note({ f: mtof(m + 12), t: i * 0.07, d: 0.7, v: 0.13, a: 0.004 })),
    piece: () => { note({ f: 520, to: 1180, d: 0.1, type: 'triangle', v: 0.22, a: 0.004 }); note({ f: 1560, t: 0.07, d: 0.25, v: 0.08, a: 0.004 }); },
    show: () => { noise({ d: 0.4, v: 0.25, sweep: [500, 4000], swell: true }); note({ f: 880, t: 0.36, d: 0.3, v: 0.12, type: 'triangle', a: 0.004 }); },
    pass: () => { note({ f: 330, d: 0.14, type: 'triangle', v: 0.2 }); note({ f: 247, t: 0.13, d: 0.22, type: 'triangle', v: 0.2 }); },
    start: () => { noise({ d: 0.3, v: 0.18, sweep: [3000, 600] }); note({ f: 784, t: 0.18, d: 0.12, type: 'triangle', v: 0.2 }); note({ f: 1175, t: 0.3, d: 0.3, type: 'triangle', v: 0.2 }); },
    tick: () => { noise({ d: 0.03, v: 0.32, hp: 3500 }); note({ f: 1900, d: 0.04, v: 0.08, a: 0.002 }); },
    tock: () => { noise({ d: 0.04, v: 0.36, hp: 2500 }); note({ f: 1046, d: 0.12, v: 0.2, type: 'triangle', a: 0.002 }); },
    timeup: () => [150, 156].forEach(f => note({ f, d: 0.9, type: 'square', v: 0.13, lp: 1500, hold: true })),
    drumroll: () => { noise({ d: 1.5, v: 0.28, bp: 2200, trem: 26, swell: true }); crash(1.5); snare(1.5, 0.25); kick(1.5); },
    award: () => { noise({ d: 0.8, v: 0.24, bp: 2200, trem: 28, swell: true }); [72, 76, 79].forEach(m => brass(m, 0.8, 0.2, 0.08)); [72, 76, 79, 84].forEach(m => brass(m, 1.02, 0.9, 0.07)); crash(1.02, 0.16); applause(1.1, 1.8, 0.08); },
    winner: () => {
      const e = 0.16;
      [[67,1],[72,1],[76,1],[79,2],[76,1],[79,4]].reduce((t, [m, n]) => { brass(m, t, n * e * 0.95, 0.1); return t + n * e; }, 0);
      [60, 64, 67, 72].forEach(m => brass(m, 10 * e, 1.4, 0.06)); kick(10 * e); crash(10 * e, 0.25); applause(10 * e, 3.2, 0.12);
    },
    theme,
    // a card turning over: a quick paper snap
    flip: () => { noise({ d: 0.05, v: 0.3, bp: 2600 }); note({ f: 300, to: 620, d: 0.07, type: 'triangle', v: 0.12, a: 0.003 }); },
    match: () => { sounds.flip(); [76, 83, 88].forEach((m, i) => note({ f: mtof(m), t: 0.08 + i * 0.09, d: 0.5, type: 'triangle', v: 0.15, a: 0.004 })); bell(1760, 0.36, 0.18); },
    nomatch: () => { sounds.flip(); note({ f: 220, t: 0.08, d: 0.18, type: 'square', v: 0.07, lp: 900 }); note({ f: 175, t: 0.26, d: 0.32, type: 'square', v: 0.07, lp: 900 }); },
    lose: () => { sounds.flip(); [392, 330, 262].forEach((f, i) => note({ f, t: 0.1 + i * 0.16, d: 0.22, type: 'sawtooth', v: 0.1, lp: 1200 })); },
    take: () => { sounds.flip(); noise({ t: 0.08, d: 0.35, v: 0.22, sweep: [4000, 600] }); [67, 71, 74, 79].forEach((m, i) => note({ f: mtof(m), t: 0.12 + i * 0.06, d: 0.25, type: 'square', v: 0.06, lp: 2400 })); },
    solve: () => { [72, 79].forEach((m, i) => note({ f: mtof(m), t: i * 0.12, d: 0.3, type: 'triangle', v: 0.18 })); },
  };
  return {
    unlock,
    play: n => { try { if (ctx && sounds[n]) sounds[n](); } catch (e) {} },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
})();
