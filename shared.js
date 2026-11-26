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
  const topic = t => `plate-pursuit/v1/${room}/${t}`;
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
    else if (msg.kind === 'wager') r = engine.wager(msg.teamId, msg.amount);
    else if (msg.kind === 'answer') r = engine.answer(msg.teamId, msg.text);
    else if (msg.kind === 'color') r = engine.color(msg.teamId, msg.color);
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
      bc.onmessage = e => { if (e.data && e.data.snap) { lastHeard = Date.now(); if (fresh(e.data.snap)) receive(e.data.snap); } };
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
      if (url === '/wager') return request('wager', data);
      if (url === '/answer') return request('answer', data);
      if (url === '/color') return request('color', data);
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
  const v = Math.max(minPoints, Math.ceil((maxPoints - (maxPoints - minPoints) * t) / 10) * 10);
  return (s.puzzles[s.cur] || {}).double && !String(s.phase).startsWith('speed') ? v * 2 : v;
}
// Team colours: the engine stores the key, pages paint it.
const TEAM_COLORS = { red: '#c8322a', blue: '#2563c9', orange: '#e07a10', purple: '#7a45c2', teal: '#0f8f86', pink: '#d6417f', green: '#0f6b3e', brown: '#8a5a2b' };
const teamColor = t => TEAM_COLORS[t && t.color] || TEAM_COLORS.green;
const teamStyle = t => `--team:${teamColor(t)}`;
// Final ranking: by score, and a tie-breaker winner goes ahead of the teams they tied with.
function ppRanking(s) {
  if (!s.teams.length) return [];
  const top = Math.max(...s.teams.map(t => t.score));
  const tbw = s.teams.some(t => t.id === s.tbWinner && t.score === top) ? s.tbWinner : null;
  const ahead = (o, t) => o.score > t.score || (o.score === t.score && o.id === tbw && t.id !== tbw);
  return [...s.teams].sort((a, b) => b.score - a.score || (a.id === tbw ? -1 : b.id === tbw ? 1 : 0))
    .map(t => ({ team: t, rank: 1 + s.teams.filter(o => o !== t && ahead(o, t)).length }));
}
function ppTiedTop(s) {
  const r = ppRanking(s).filter(x => x.rank === 1);
  return r.length > 1 ? r.map(x => x.team.id) : [];
}
// During the final plate a team's new score stays secret until its answer is put on screen.
function ppFinShown(s, id) { return !s.fin || !['fanswer', 'fjudge'].includes(s.phase) || (s.phase === 'fjudge' && s.fin.order.indexOf(id) < s.fin.shown); }
function ppShownScore(s, t) { return ppFinShown(s, t.id) ? t.score : (s.fin.base[t.id] ?? t.score); }
// ---- keyboard shortcuts (stream deck): Ctrl+Shift+letter -> what it does
const PP_KEYS = { KeyG: 'go', KeyC: 'correct', KeyX: 'wrong', KeyO: 'reopen', KeyU: 'undo', KeyN: 'next', KeyR: 'reveal', KeyW: 'stepAll',
  KeyP: 'pass', KeyS: 'speed', KeyJ: 'lobby', KeyF: 'finalStart', KeyL: 'finalLock', KeyT: 'tiebreak', KeyE: 'final',
  KeyD: 'double', KeyK: 'speedStop', KeyA: 'pick1', KeyB: 'pick2', KeyH: 'pick3', KeyI: 'pick4' };   // speed round page: pick a team (no number keys: Cmd+Shift+3/4 are Mac screenshots), then S sends it
function ppKeyName(e) { return e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey ? PP_KEYS[e.code] || null : null; }
const _keyChan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('plate-pursuit-keys') : null;
// projector / crew windows on the same computer: hand shortcut presses to the control page
function ppForwardKeys() {
  if (!_keyChan) return;
  document.addEventListener('keydown', e => { const n = ppKeyName(e); if (!n) return; e.preventDefault(); _keyChan.postMessage({ key: n, room: PP.room || null }); }, true);
}
function ppOnForwardedKey(fn) { if (_keyChan) _keyChan.onmessage = e => { if (e.data && (e.data.room || null) === (PP.room || null)) fn(e.data.key); }; }
function ppFinalLeft(s) { return s.fin && s.fin.endsAt ? Math.max(0, (s.fin.endsAt - PP.now()) / 1000) : null; }
// countdown text: seconds left, or TIME once it runs out (the host still marks the answer)
function ppAnswerText(s) { const l = ppAnswerLeft(s); return l == null ? '' : l > 0 ? String(Math.ceil(l)) : 'TIME'; }
function ppAnswerLeft(s) { return s.answerEndsAt ? Math.max(0, (s.answerEndsAt - PP.now()) / 1000) : null; }
function ppFraction(s) { return Math.max(0, 1 - ppElapsed(s) / s.settings.drainSeconds); }
function ppSpeedLeft(s) { return s.speed && s.speed.endsAt ? Math.max(0, (s.speed.endsAt - PP.now()) / 1000) : (s.settings.speedSeconds); }
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const teamName = (s, id) => (s.teams.find(t => t.id === id) || {}).name || '';

const BADGES = { raptor: 'raptor.png' };   // pictures a plate's frame can carry ("| badge: raptor")
function plateHTML(text, opts = {}) {
  // the state name is coloured once its piece ("~=…") has been revealed
  const L = opts.look;   // a state's plate design, from states.js
  let top = esc(L && L.name && L.name.text || opts.top || 'Puzzle State');
  if (opts.parts) {
    const n = opts.parts.findIndex(([k]) => k === '~'), step = opts.step == null ? Infinity : opts.step;
    if (n >= 0 && n < step) top = `<span class="pc c${pieceColor(opts.parts)[n]}">${top}</span>`;
    else if (n >= 0) top = `<span class="st-wait">${top}</span>`;   // not its turn yet: plain ink, not the red of piece 1
  }
  const lookStyle = L ? [`--plate-bg:${L.bg}`, `--plate-ink:${L.ink}`, `--rim:${L.rim || 'transparent'}`,
    `--name-color:${(L.name && L.name.color) || L.ink}`, `--name-outline:${(L.name && L.name.outline) || 'transparent'}`, `--slogan-color:${(L.slogan && L.slogan.color) || L.ink}`].join(';') : '';
  const sl = L && L.slogan && L.slogan.text || '', nm = L && L.name && L.name.text || '';
  const lookCls = L ? `look name-${(L.name && L.name.font) || 'block'} name-${(L.name && L.name.pos) || 'top'} slogan-${(L.slogan && L.slogan.font) || 'block'}${sl.length > 28 ? ' long-slogan xlong-slogan' : sl.length > 18 ? ' long-slogan' : ''}${nm.length > 12 ? ' long-name' : ''}` : '';
  const bottom = L ? esc((L.slogan && L.slogan.text) || '') : (opts.bottom || 'LAND OF VANITY PLATES');
  const plate = `<div class="plate ${lookCls} ${opts.cls || ''}" style="${lookStyle}">
    ${L && L.art ? `<div class="plate-art"><svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">${L.art}</svg></div>` : ''}
    <i class="slot l"></i><i class="slot r"></i>
    <span class="sticker l">11</span><span class="sticker r">27</span>
    <div class="plate-top"><span class="fit">${top}</span></div>
    <div class="plate-text"><span>${(opts.parts && platePiecesHTML(text, opts.parts, opts.step)) || esc(text) || '&nbsp;'}</span></div>
    <div class="plate-bottom"><span class="fit">${bottom}</span></div>
  </div>`;
  if (opts.frame == null && !opts.badge) return plate;
  const top2 = opts.badge && BADGES[opts.badge] ? `<img src="${BADGES[opts.badge]}" alt="${esc(opts.badge)}">` : esc(opts.frame || opts.badge || '');
  return `<div class="pframe"><div class="pf-top">${top2}</div>${plate}<div class="pf-bot">PLATE PURSUIT MOTORS</div></div>`;
}
// a puzzle's plate with its state and frame; the frame and state stay blank while the plate is covered
function puzzlePlate(p, opts = {}) {
  if (!p) return plateHTML('', opts);
  const covered = /covered/.test(opts.cls || '');
  const look = !covered && typeof STATE_STYLES !== 'undefined' ? STATE_STYLES[p.state] : null;
  return plateHTML(opts.text != null ? opts.text : p.plate, { ...opts, look, top: covered ? 'Puzzle State' : p.state,
    frame: covered ? '' : (p.frame || ''), badge: covered ? null : p.badge });
}

// Stretch the characters across the plate. Letters are sized to the plate's height
// in CSS; here they're squeezed (long plates) or spaced out (short ones) to fill the width.
// ---- colour-matching the plate's pieces to the words they stand for, revealed one piece at a time
const PIECE_COLORS = 6;
function pieceColor(parts) {   // same piece of plate -> same colour (both YYs in YYURYYUB match)
  const keys = [];
  return parts.map(([k]) => { if (!keys.includes(k)) keys.push(k); return keys.indexOf(k) % PIECE_COLORS; });
}
// [{t, n}] where n is the piece number, or -1 for spaces/leftovers. null if the pieces don't spell the plate.
function plateSegments(plate, parts) {
  if (!parts) return null;
  plate = String(plate || ''); let i = 0; const out = [];
  for (let n = 0; n < parts.length; n++) {
    const k = parts[n][0];
    if (k === '~') continue;   // the state name, not on the plate itself
    while (plate[i] === ' ') { out.push({ t: ' ', n: -1 }); i++; }
    if (plate.slice(i, i + k.length) !== k) return null;
    out.push({ t: k, n }); i += k.length;
  }
  if (i < plate.length) out.push({ t: plate.slice(i), n: -1 });
  return out;
}
function answerSegments(answer, parts) {
  answer = String(answer || '');
  if (!parts) return [{ t: answer, n: -1 }];
  const lower = answer.toLowerCase(), out = []; let pos = 0;
  parts.forEach(([, v], n) => {
    const word = new RegExp('(?<![\\p{L}\\p{N}])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'iug');
    word.lastIndex = pos;
    const m = word.exec(answer);
    const at = m ? m.index : lower.indexOf(v.toLowerCase(), pos);
    if (at < 0) return;
    if (at > pos) out.push({ t: answer.slice(pos, at), n: -1 });
    out.push({ t: answer.slice(at, at + v.length), n }); pos = at + v.length;
  });
  if (pos < answer.length) out.push({ t: answer.slice(pos), n: -1 });
  return out;
}
// the pieces a plate reveals in (just one, the whole answer, if it has no usable mapping)
function piecesOf(p) {
  if (!p) return [];
  const ok = p.parts && plateSegments(p.plate, p.parts);
  return ok ? p.parts.map(([k, v], n) => ({ plate: k === '~' ? (p.state || 'the state') : k, means: v, color: pieceColor(p.parts)[n], state: k === '~' })) : [{ plate: p.plate, means: p.answer, color: -1 }];
}
const pieceTotal = p => piecesOf(p).length;
// step = how many pieces are showing (undefined = all of them)
function platePiecesHTML(plate, parts, step = Infinity) {
  const seg = plateSegments(plate, parts); if (!seg) return null;
  const col = pieceColor(parts);
  return seg.map(x => x.n >= 0 && x.n < step ? `<span class="pc c${col[x.n]}${x.n === step - 1 ? ' now' : ''}">${esc(x.t)}</span>` : esc(x.t)).join('');
}
function answerPiecesHTML(p, step = Infinity) {   // p = the puzzle
  const usable = p.parts && plateSegments(p.plate, p.parts) ? p.parts : null, answer = p.answer;
  const col = usable ? pieceColor(usable) : [], total = usable ? usable.length : 1;
  const hide = t => t.split(/(\s+)/).map(w => !w || /^\s+$/.test(w) ? w : `<span class="pc hid">${esc(w)}</span>`).join('');
  return answerSegments(answer, usable).map(x => {
    if (x.n < 0) return step >= total ? esc(x.t) : hide(x.t);
    return x.n < step ? `<span class="pc c${col[x.n]}">${esc(x.t)}</span>` : hide(x.t);
  }).join('');
}
// The state name and slogan stay inside their lane (clear of the corner stickers and bolt holes): squeeze, then shrink.
function fitLabels(plate) {
  plate.querySelectorAll('.plate-top > .fit, .plate-bottom > .fit').forEach(f => {
    f.style.transform = ''; f.style.fontSize = '';
    const lane = f.parentElement.clientWidth, w = f.scrollWidth;
    if (!lane || !w || w <= lane) return;
    let k = lane / w;
    if (k < 0.72) { f.style.fontSize = (parseFloat(getComputedStyle(f).fontSize) * k / 0.72) + 'px'; k = 0.72; }
    f.style.transform = `scaleX(${k})`;
  });
}
function fitPlate(plate) {
  fitLabels(plate);
  const span = plate.querySelector('.plate-text span');
  if (!span || !plate.clientWidth) return;
  span.style.cssText = '';
  const chars = span.textContent.trim().length;
  const avail = plate.clientWidth * 0.9;
  const w = span.getBoundingClientRect().width;
  if (!w) return;
  if (w > avail) {
    let squeeze = avail / w;
    if (squeeze < 0.62) { span.style.fontSize = `calc(var(--serial, 84cqh) * ${squeeze / 0.62})`; squeeze = 0.62; }
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
  };
  return {
    unlock,
    play: n => { try { if (ctx && sounds[n]) sounds[n](); } catch (e) {} },
    get ready() { return !!ctx && ctx.state === 'running'; },
  };
})();
