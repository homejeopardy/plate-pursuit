// Plate Pursuit game engine. The same code runs in the local server (node)
// and in the host page on the website, so both modes play identically.
(function (root) {
function createEngine(opts = {}) {
  const changed = () => { S.undoLabel = history.length ? history[history.length - 1].label : null; opts.persist && opts.persist(S); opts.onChange && opts.onChange(); };
  const history = [];   // undo stack (in memory only)
  const DEFAULT_PUZZLES = `## What does it say?
  EZ PZ | Easy peasy
  XLR8 | Accelerate
  4GTFUL | Forgetful
  YYURYYUB | Too wise you are, too wise you be
  1DRFUL | Wonderful
  NE1 HOME | Anyone home?
  L8 AGAIN | Late again
  2COOL4U | Too cool for you
  W8 4 ME | Wait for me
  4TUN8 | Fortunate
  NVR L8 | Never late
  IOU 0 | I owe you nothing
  QT PIE | Cutie pie
  ICU2 | I see you too
  RU HNGRY | Are you hungry?
  GR8 DAY | Great day
  SK8 4EVR | Skate forever
  OWE NO1 | Owe no one
  Y B L8 | Why be late?
  
  ## Who drives this car?
  PI R2 | A math teacher (πr²)
  E MC2 | A science teacher (E=mc²)
  2TH FXR | A dentist (tooth fixer)
  IC 2020 | An eye doctor (I see 20/20)
  RX 4 U | A pharmacist (prescription for you)
  4 PAWS | A vet
  EIEIO | A farmer (Old MacDonald)
  ARRRR | A pirate
  MOO2U | A dairy farmer (moo to you)
  OUI OUI | A French teacher (yes, yes)`;
  
  function parsePuzzles(text) {
    let cat = 'What does it say?';
    const out = [];
    for (const raw of String(text).split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      if (l.startsWith('##')) { cat = l.replace(/^#+/, '').trim() || cat; continue; }
      if (l.startsWith('#')) continue;
      const [plate, answer = ''] = l.split('|').map(s => s.trim());
      if (plate) out.push({ cat, plate: plate.toUpperCase().slice(0, 10), answer });
    }
    return out;
  }
  
  const DEFAULT_SETTINGS = { maxPoints: 100, minPoints: 10, drainSeconds: 20, answerSeconds: 5, speedPoints: 50, speedSeconds: 60, finalSeconds: 30 };
  
  function freshState() {
    return {
      phase: 'lobby', teams: [], nextTeamId: 1,
      puzzleText: DEFAULT_PUZZLES, puzzles: parsePuzzles(DEFAULT_PUZZLES),
      used: [], cur: null, elapsed: 0, runningSince: null,
      buzzed: null, locked: [], valueAtBuzz: 0, result: null,
      speed: null, settings: { ...DEFAULT_SETTINGS }, ev: { n: 0, type: null },
      fin: null, tb: null, tbWinner: null, undoLabel: null,
    };
  }
  
  let S = freshState();
  try { const saved = opts.load && opts.load(); if (saved) S = { ...S, ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } }; } catch (e) {}
  S.runningSince = null; S.undoLabel = null;
  if (S.phase === 'fanswer' && S.fin) S.fin.endsAt = Date.now() + 10000;   // reloaded mid-answer: give 10 more seconds
  if (S.phase === 'running') S.phase = 'ready';
  if (S.phase === 'speed') S.phase = 'speedover';
  setTimeout(() => rearmTimers(), 0);
  // The "UR2SLO | You are too slow" plate read like the game mocking a team that ran out of time,
  // so it's gone from the starter list. Take it out of saved games too, keeping which plates were played.
  if (/^\s*UR2SLO\s*\|\s*You are too slow\s*$/mi.test(S.puzzleText || '')) {
    const plateAt = i => (S.puzzles[i] || {}).plate;
    const usedPlates = S.used.map(plateAt), curPlate = plateAt(S.cur);
    S.puzzleText = S.puzzleText.replace(/^\s*UR2SLO\s*\|\s*You are too slow\s*\n?/mi, '');
    S.puzzles = parsePuzzles(S.puzzleText);
    const idx = pl => S.puzzles.findIndex(q => q.plate === pl);
    S.used = usedPlates.map(idx).filter(i => i >= 0);
    S.cur = curPlate != null && idx(curPlate) >= 0 ? idx(curPlate) : null;
    if (S.cur == null && !['lobby', 'final'].includes(S.phase) && !S.phase.startsWith('speed')) S.phase = 'lobby';
    setTimeout(() => opts.persist && opts.persist(S), 0);
  }
  
  // ---------- engine ----------
  const now = () => Date.now();
  const team = id => S.teams.find(t => t.id === id);
  const elapsedNow = () => S.elapsed + (S.runningSince ? (now() - S.runningSince) / 1000 : 0);
  function liveValue() {
    const { maxPoints, minPoints, drainSeconds } = S.settings;
    const t = Math.min(1, elapsedNow() / drainSeconds);
    return Math.max(minPoints, Math.ceil((maxPoints - (maxPoints - minPoints) * t) / 10) * 10);
  }
  function freeze() { S.elapsed = elapsedNow(); S.runningSince = null; }
  function markUsed(i) { if (i != null && !S.used.includes(i)) S.used.push(i); }
  function nextUnused(after) {
    const n = S.puzzles.length;
    for (let k = 1; k <= n; k++) { const i = ((after ?? -1) + k) % n; if (!S.used.includes(i)) return i; }
    return null;
  }
  function fire(type) { S.ev = { n: S.ev.n + 1, type }; }
  function loadPlate(i) {
    if (i == null || !S.puzzles[i]) return;
    S.cur = i; S.phase = 'ready'; S.elapsed = 0; S.runningSince = null;
    S.buzzed = null; S.locked = []; S.result = null;
  }
  let speedTimer = null;
  function endSpeed() {
    clearTimeout(speedTimer); speedTimer = null;
    if (S.phase !== 'speed') return;
    S.phase = 'speedover'; fire('timeup'); changed();
  }
  
  // The buzzing team gets answerSeconds to answer; running out counts as wrong.
  let answerTimer = null;
  function armAnswer() {
    clearTimeout(answerTimer); answerTimer = null;
    if (S.phase !== 'buzzed') { S.answerEndsAt = null; return; }
    if (!S.answerEndsAt) return;
    const who = S.buzzed;
    answerTimer = setTimeout(() => {
      if (S.phase === 'buzzed' && S.buzzed === who) { record('timeout'); actions.wrong(); armAnswer(); changed(); }
    }, Math.max(0, S.answerEndsAt - now()));
  }

  // ---------- undo ----------
  const UNDO_LABELS = { next: 'Next plate', load: 'Pick plate', start: 'Start clock', buzz: 'Buzz-in', correct: 'Correct', wrong: 'Wrong',
    timeout: 'Time ran out', reopen: 'Reopen buzzing', reveal: 'Reveal', pass: 'Pass', speedReady: 'Set up speed round',
    speedStart: 'Start speed round', speedStop: 'Stop speed round', final: 'Final standings', lobby: 'Join screen',
    score: 'Score change', removeTeam: 'Remove team', finalStart: 'Final wager plate', finalShow: 'Show final plate',
    finalLock: 'Lock answers', finalMark: 'Mark final answer', tiebreak: 'Tie-breaker plate' };
  function record(type) {
    if (!UNDO_LABELS[type]) return false;
    const c = JSON.parse(JSON.stringify(S));
    c.elapsed = elapsedNow(); c._running = !!S.runningSince; c.runningSince = null;
    if (S.speed && S.speed.endsAt) c._speedLeft = Math.max(0, S.speed.endsAt - now());
    if (S.fin && S.fin.endsAt) c._finLeft = Math.max(0, S.fin.endsAt - now());
    history.push({ label: UNDO_LABELS[type], state: c, json: JSON.stringify(S) });
    if (history.length > 40) history.shift();
    return true;
  }
  // drop the entry if the action turned out to change nothing
  function unrecordIfSame() { const h = history[history.length - 1]; if (h && h.json === JSON.stringify(S)) history.pop(); }
  function undo() {
    const h = history.pop(); if (!h) return;
    const c = h.state, ev = S.ev;
    if (c._running) c.runningSince = now();
    if (c._speedLeft != null && c.speed) c.speed.endsAt = now() + c._speedLeft;
    if (c._finLeft != null && c.fin) c.fin.endsAt = now() + c._finLeft;
    delete c._running; delete c._speedLeft; delete c._finLeft;
    if (c.phase === 'buzzed' && c.settings.answerSeconds > 0) c.answerEndsAt = now() + c.settings.answerSeconds * 1000;
    S = c; S.ev = { n: ev.n + 1, type: null };   // no sound for an undo
    rearmTimers();
  }
  let finTimer = null;
  function rearmTimers() {
    armAnswer();
    clearTimeout(speedTimer); speedTimer = null;
    if (S.phase === 'speed' && S.speed && S.speed.endsAt) speedTimer = setTimeout(endSpeed, Math.max(0, S.speed.endsAt - now()));
    clearTimeout(finTimer); finTimer = null;
    if (S.phase === 'fanswer' && S.fin && S.fin.endsAt)
      finTimer = setTimeout(() => { if (S.phase === 'fanswer') { record('finalLock'); actions.finalLock(); changed(); } }, Math.max(0, S.fin.endsAt - now()));
  }
  function finalScore(id) {
    const f = S.fin, t = team(id); if (!f || !t || f.base[id] == null) return;
    const w = f.wagers[id] || 0, m = f.marks[id];
    t.score = f.base[id] + (m === true ? w : m === false ? -w : 0);
  }
  function tiedTop() {
    if (S.teams.length < 2) return [];
    const top = Math.max(...S.teams.map(t => t.score));
    const tied = S.teams.filter(t => t.score === top).map(t => t.id);
    return tied.length > 1 && !tied.includes(S.tbWinner) ? tied : [];
  }

  function buzz(teamId) {
    if (S.phase !== 'running' || !team(teamId) || S.locked.includes(teamId)) return false;
    S.valueAtBuzz = liveValue(); freeze();
    S.phase = 'buzzed'; S.buzzed = teamId; fire('buzz');
      S.answerEndsAt = S.settings.answerSeconds > 0 ? now() + S.settings.answerSeconds * 1000 : null;
      armAnswer();
    return true;
  }
  
  const actions = {
    next() { S.tb = null; loadPlate(nextUnused(S.cur)); },
    load({ index }) { S.tb = null; loadPlate(Number(index)); },
    start() { if (S.phase === 'ready') { S.phase = 'running'; S.runningSince = now(); fire('start'); } },
    buzz({ teamId }) { buzz(Number(teamId)); },
    correct() {
      if (S.phase === 'buzzed' && S.tb) {          // tie-breaker: first right answer wins, no points
        S.tbWinner = S.buzzed; S.result = { teamId: S.buzzed, points: 0, tiebreak: true };
        markUsed(S.cur); S.phase = 'revealed'; fire('correct');
      } else if (S.phase === 'buzzed') {
        const t = team(S.buzzed); if (t) t.score += S.valueAtBuzz;
        S.result = { teamId: S.buzzed, points: S.valueAtBuzz };
        markUsed(S.cur); S.phase = 'revealed'; fire('correct');
      } else if (S.phase === 'speed') {
        const t = team(S.speed.teamId); if (t) t.score += S.settings.speedPoints;
        S.speed.count++; markUsed(S.cur); fire('correct');
        S.cur = nextUnused(S.cur); if (S.cur == null) endSpeed();
      }
    },
    wrong() {
      if (S.phase !== 'buzzed') return;
      S.locked.push(S.buzzed); S.buzzed = null;
      if (S.teams.every(t => S.locked.includes(t.id))) { markUsed(S.cur); S.phase = 'revealed'; S.result = null; }   // (tie-breaker: other teams start locked)
      else S.phase = 'paused';      // buzzers stay closed until the host reopens them
      fire('wrong');
    },
    reopen() { if (S.phase === 'paused') { S.phase = 'running'; S.runningSince = now(); fire('start'); } },
    reveal() {
      if (!['ready', 'running', 'buzzed', 'paused'].includes(S.phase)) return;
      freeze(); markUsed(S.cur); S.phase = 'revealed'; S.buzzed = null; S.result = null; fire('reveal');
    },
    pass() {
      if (S.phase !== 'speed') return;
      markUsed(S.cur); fire('pass');
      S.cur = nextUnused(S.cur); if (S.cur == null) endSpeed();
    },
    speedReady({ teamId }) {
      if (!team(Number(teamId))) return;
      S.phase = 'speedready'; S.speed = { teamId: Number(teamId), count: 0, endsAt: null }; S.buzzed = null; S.result = null;
    },
    speedStart() {
      if (S.phase !== 'speedready') return;
      S.cur = nextUnused(S.cur); if (S.cur == null) return;
      S.phase = 'speed'; S.speed.endsAt = now() + S.settings.speedSeconds * 1000; fire('start');
      clearTimeout(speedTimer); speedTimer = setTimeout(endSpeed, S.settings.speedSeconds * 1000);
    },
    speedStop() { endSpeed(); },
    final() { freeze(); clearTimeout(finTimer); S.tb = null; S.buzzed = null; S.phase = 'final'; fire('winner'); },
    // ---- final wager plate: everyone bets, everyone types an answer, the host marks each one
    finalStart() {
      const i = nextUnused(S.cur); if (i == null) return;
      freeze(); S.cur = i; S.buzzed = null; S.locked = []; S.result = null; S.tb = null;
      S.fin = { wagers: {}, answers: {}, marks: {}, base: {}, endsAt: null };
      S.phase = 'fwager'; fire('start');
    },
    finalShow() {
      if (S.phase !== 'fwager') return;
      for (const t of S.teams) { S.fin.base[t.id] = t.score; S.fin.wagers[t.id] = Math.min(S.fin.wagers[t.id] || 0, Math.max(0, t.score)); }
      S.fin.endsAt = S.settings.finalSeconds > 0 ? now() + S.settings.finalSeconds * 1000 : null;
      S.phase = 'fanswer'; fire('start');
    },
    finalLock() {
      if (S.phase !== 'fanswer') return;
      S.fin.endsAt = null; markUsed(S.cur); S.phase = 'fjudge'; fire('reveal');
    },
    finalMark({ teamId, right }) {
      if (S.phase !== 'fjudge') return;
      const id = Number(teamId), r = right === true || right === 'true';
      if (S.fin.marks[id] === r) delete S.fin.marks[id]; else S.fin.marks[id] = r;   // tap again to unmark
      finalScore(id); fire(r ? 'correct' : 'wrong');
    },
    // ---- tie-breaker: only the teams tied for first can buzz
    tiebreak() {
      if (!(S.phase === 'final' || (S.tb && S.phase === 'revealed'))) return;
      const tied = S.tb && S.phase === 'revealed' ? S.tb.teams : tiedTop();
      if (tied.length < 2) return;
      const i = nextUnused(S.cur); if (i == null) return;
      loadPlate(i); S.tb = { teams: tied }; S.tbWinner = null;
      S.locked = S.teams.filter(t => !tied.includes(t.id)).map(t => t.id);
    },
    lobby() { freeze(); S.phase = 'lobby'; },
    score({ teamId, delta }) { const t = team(Number(teamId)); if (t) t.score += Number(delta) || 0; },
    rename({ teamId, name }) { const t = team(Number(teamId)); if (t && String(name).trim()) t.name = String(name).trim().slice(0, 24); },
    addTeam({ name }) { addTeam(name); },
    removeTeam({ teamId }) { S.teams = S.teams.filter(t => t.id !== Number(teamId)); },
    setPuzzles({ text }) {
      const p = parsePuzzles(text); if (!p.length) return;
      S.puzzleText = String(text); S.puzzles = p; S.used = []; S.cur = null;
      if (!['lobby', 'final'].includes(S.phase)) S.phase = 'lobby';
    },
    resetPuzzles() { actions.setPuzzles({ text: DEFAULT_PUZZLES }); },
    settings(o) {
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        const v = Number(o[k]); if (Number.isFinite(v) && v >= 0) S.settings[k] = v;
      }
      if (S.settings.minPoints > S.settings.maxPoints) S.settings.minPoints = S.settings.maxPoints;
      if (S.settings.drainSeconds < 1) S.settings.drainSeconds = 1;
    },
    newGame({ keepTeams } = {}) {
      clearTimeout(speedTimer); clearTimeout(finTimer); history.length = 0;
      const keep = { teams: keepTeams ? S.teams.map(t => ({ ...t, score: 0 })) : [], nextTeamId: S.nextTeamId,
        puzzleText: S.puzzleText, puzzles: S.puzzles, settings: S.settings, ev: S.ev };
      S = { ...freshState(), ...keep };
    },
  };
  
  function addTeam(name) {
    name = String(name || '').trim().slice(0, 24) || `Team ${S.nextTeamId}`;
    const t = { id: S.nextTeamId++, name, score: 0 };
    S.teams.push(t);
    return t;
  }

  return {
    get state() { return S; },
    act(type, data = {}) {
      if (type === 'undo') { undo(); changed(); return true; }
      const fn = actions[type]; if (!fn) return false;
      const rec = record(type);
      fn(data);
      if (rec) unrecordIfSame();
      rearmTimers();
      changed(); return true;
    },
    wager(teamId, amount) {
      const t = team(Number(teamId));
      if (S.phase !== 'fwager' || !t) return { ok: false };
      const max = Math.max(0, t.score);
      S.fin.wagers[t.id] = Math.max(0, Math.min(max, Math.round(Number(amount) || 0)));
      changed(); return { ok: true, amount: S.fin.wagers[t.id], max };
    },
    answer(teamId, text) {
      const t = team(Number(teamId));
      if (S.phase !== 'fanswer' || !t) return { ok: false };
      S.fin.answers[t.id] = String(text || '').trim().slice(0, 60);
      changed(); return { ok: true };
    },
    join(name, teamId) {
      let t = team(Number(teamId));
      if (!t) {
        const n = String(name || '').trim();
        t = S.teams.find(x => x.name.toLowerCase() === n.toLowerCase()) || addTeam(n);
        changed();
      }
      return t;
    },
    buzz(teamId) { record('buzz'); const won = buzz(Number(teamId)); if (won) changed(); else history.pop(); return won; },
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
else root.createEngine = createEngine;
})(this);
