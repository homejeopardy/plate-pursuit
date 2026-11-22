// Plate Pursuit game engine. The same code runs in the local server (node)
// and in the host page on the website, so both modes play identically.
(function (root) {
function createEngine(opts = {}) {
  const changed = () => { opts.persist && opts.persist(S); opts.onChange && opts.onChange(); };
  const DEFAULT_PUZZLES = `## What does it say?
  EZ PZ | Easy peasy
  UR2SLO | You are too slow
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
  
  const DEFAULT_SETTINGS = { maxPoints: 100, minPoints: 10, drainSeconds: 20, speedPoints: 50, speedSeconds: 60 };
  
  function freshState() {
    return {
      phase: 'lobby', teams: [], nextTeamId: 1,
      puzzleText: DEFAULT_PUZZLES, puzzles: parsePuzzles(DEFAULT_PUZZLES),
      used: [], cur: null, elapsed: 0, runningSince: null,
      buzzed: null, locked: [], valueAtBuzz: 0, result: null,
      speed: null, settings: { ...DEFAULT_SETTINGS }, ev: { n: 0, type: null },
    };
  }
  
  let S = freshState();
  try { const saved = opts.load && opts.load(); if (saved) S = { ...S, ...saved }; } catch (e) {}
  S.runningSince = null;
  if (S.phase === 'running') S.phase = 'ready';
  if (S.phase === 'speed') S.phase = 'speedover';
  
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
  
  function buzz(teamId) {
    if (S.phase !== 'running' || !team(teamId) || S.locked.includes(teamId)) return false;
    S.valueAtBuzz = liveValue(); freeze();
    S.phase = 'buzzed'; S.buzzed = teamId; fire('buzz');
    return true;
  }
  
  const actions = {
    next() { loadPlate(nextUnused(S.cur)); },
    load({ index }) { loadPlate(Number(index)); },
    start() { if (S.phase === 'ready') { S.phase = 'running'; S.runningSince = now(); fire('start'); } },
    buzz({ teamId }) { buzz(Number(teamId)); },
    correct() {
      if (S.phase === 'buzzed') {
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
      if (S.teams.every(t => S.locked.includes(t.id))) { markUsed(S.cur); S.phase = 'revealed'; S.result = null; }
      else { S.phase = 'running'; S.runningSince = now(); }
      fire('wrong');
    },
    reveal() {
      if (!['ready', 'running', 'buzzed'].includes(S.phase)) return;
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
    final() { freeze(); S.phase = 'final'; fire('winner'); },
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
      clearTimeout(speedTimer);
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
    act(type, data = {}) { const fn = actions[type]; if (!fn) return false; fn(data); changed(); return true; },
    join(name, teamId) {
      let t = team(Number(teamId));
      if (!t) {
        const n = String(name || '').trim();
        t = S.teams.find(x => x.name.toLowerCase() === n.toLowerCase()) || addTeam(n);
        changed();
      }
      return t;
    },
    buzz(teamId) { const won = buzz(Number(teamId)); if (won) changed(); return won; },
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
else root.createEngine = createEngine;
})(this);
