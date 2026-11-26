// Flip Side game engine: a matching-pairs board hiding a picture puzzle.
// It runs inside the control page (host.html); the other screens get snapshots of S.
(function (root) {
function createEngine(opts = {}) {
  const now = () => Date.now();
  const history = [];   // undo stack (in memory only)
  const changed = () => { S.undoLabel = history.length ? history[history.length - 1].label : null; opts.persist && opts.persist(S); opts.onChange && opts.onChange(); };
  const COLORS = ['red', 'blue', 'orange', 'purple', 'teal', 'pink', 'green', 'brown'];
  const DEFAULT_TEAMS = [['CNSTTTNLWYR', 'red'], ['SCNCEGY', 'blue'], ['GEHLTHCR', 'orange'], ['PJMKRNDMR', 'purple']];
  const DEFAULT_SETTINGS = { answerSeconds: 15, solveBonus: 500, peekSeconds: 3, wildBonus: 500, wrongPenalty: 200 };
  // 20 cards: 7 pairs of points, a TAKE pair, a LOSE A TURN pair, and two WILD cards
  const POINTS = [100, 200, 300, 400, 500, 600, 700];
  const STARTERS = (root.FS_STARTERS || []).map((p, i) => p && { id: 's' + i, ...p }).filter(Boolean);
  const retired = id => /^s\d+$/.test(id) && !STARTERS.some(p => p.id === id);   // a starter set to null in starters.js

  function defaultTeams(firstId) { return DEFAULT_TEAMS.map(([name, color], i) => ({ id: firstId + i, name, score: 0, color })); }
  function freshState() {
    return {
      phase: 'lobby', teams: defaultTeams(1), nextTeamId: 1 + DEFAULT_TEAMS.length,
      puzzles: STARTERS.map(p => ({ ...p })), used: [], cur: null, round: 0, shuffle: true,
      board: [], flips: [], turn: null, starter: null, pot: {}, locked: [], solver: null, result: null,
      answerEndsAt: null, hideAt: null, settings: { ...DEFAULT_SETTINGS }, ev: { n: 0, type: null }, undoLabel: null,
    };
  }
  let S = freshState();
  try {
    const saved = opts.load && opts.load();
    if (saved) S = { ...S, ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } };
  } catch (e) {}
  // retired starters leave old saves; starter puzzles added in a later version show up in them
  S.puzzles = S.puzzles.filter(p => !retired(p.id));
  for (const p of STARTERS) if (!S.puzzles.some(q => q.id === p.id) && !(S.removed || []).includes(p.id)) S.puzzles.push({ ...p });
  for (const p of S.puzzles) { const st = STARTERS.find(q => q.id === p.id); if (st && st.final && p.final === undefined) p.final = true; }
  S.undoLabel = null;

  const team = id => S.teams.find(t => t.id === Number(id));
  const fire = type => { S.ev = { n: (S.ev.n || 0) + 1, type }; };
  const potOf = id => (S.pot[id] || []).reduce((a, c) => a + c.v, 0);
  const left = () => S.board.filter(c => !c.gone).length;
  function nextTeam(id) {
    if (!S.teams.length) return null;
    const i = S.teams.findIndex(t => t.id === id);
    for (let k = 1; k <= S.teams.length; k++) {
      const t = S.teams[(i + k) % S.teams.length];
      if (!S.fin || !S.locked.includes(t.id)) return t.id;
    }
    return S.teams[(i + 1) % S.teams.length].id;
  }
  // final-wager puzzles: each team bets up to its score (or up to 500 if it has less)
  const maxWager = t => Math.max(t ? t.score : 0, 500);
  const wagerOf = id => Math.max(0, Number((S.wagers || {})[id]) || 0);
  const canBuzz = id => S.fin && team(id) && !S.locked.includes(Number(id)) && ['pick', 'match', 'miss', 'lost', 'buzz'].includes(S.phase);
  function deal() {
    const cards = [];
    POINTS.forEach(v => { cards.push({ kind: 'pts', v }, { kind: 'pts', v }); });
    cards.push({ kind: 'take' }, { kind: 'take' }, { kind: 'lose' }, { kind: 'lose' }, { kind: 'wild' }, { kind: 'wild' });
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards.map((c, i) => ({ ...c, n: i + 1, gone: false, by: null }));
  }
  const same = (a, b) => a.kind === b.kind && (a.kind !== 'pts' || a.v === b.v);
  const label = c => c.kind === 'pts' ? String(c.v) : c.kind === 'wild' ? 'WILD' : c.kind === 'take' ? 'TAKE' : 'LOSE A TURN';

  function nextUnused() {
    const free = S.puzzles.map((p, i) => i).filter(i => !S.used.includes(S.puzzles[i].id) && i !== S.cur && !S.puzzles[i].final);
    if (!free.length) return null;
    return S.shuffle !== false ? free[Math.floor(Math.random() * free.length)] : free[0];
  }
  function startRound(i) {
    if (i == null || !S.puzzles[i] || !S.teams.length) return false;
    S.cur = i; S.round++;
    if (!S.used.includes(S.puzzles[i].id)) S.used.push(S.puzzles[i].id);
    S.board = deal(); S.flips = []; S.pot = {}; S.locked = []; S.solver = null; S.result = null;
    S.answerEndsAt = null; S.hideAt = null;
    S.starter = S.starter == null || !team(S.starter) ? S.teams[0].id : nextTeam(S.starter);
    S.turn = S.starter; S.phase = 'pick';
    S.fin = !!S.puzzles[i].final; S.wagers = {}; S.resume = null;
    if (S.fin) { S.phase = 'wager'; S.turn = null; fire('theme'); return true; }
    fire(S.round === 1 ? 'theme' : 'start');
    return true;
  }
  function endTurn() {   // the turn moves on (no match, a wrong guess, lose a turn)
    S.flips = []; S.hideAt = null; S.answerEndsAt = null;
    if (!left()) { S.phase = 'buzz'; S.turn = null; return; }   // nothing left to flip: anyone can buzz in
    S.turn = nextTeam(S.turn); S.phase = 'pick';
  }
  function flip(n) {
    if (S.phase !== 'pick') return false;
    const c = S.board[n - 1];
    if (!c || c.gone || S.flips.includes(n)) return false;
    S.flips.push(n);
    if (c.kind === 'lose') {   // a LOSE A TURN card comes off by itself as soon as it's turned over, and the turn ends
      c.gone = true; c.by = S.turn; S.wildTwin = null;
      S.result = { kind: 'match', team: S.turn, cards: ['LOSE A TURN'], effect: 'lose', points: 0 };
      S.phase = 'lost'; S.hideAt = now() + S.settings.peekSeconds * 1000; fire('lose'); return true;
    }
    if (S.flips.length < 2) { fire('flip'); return true; }
    const [a, b] = S.flips.map(k => S.board[k - 1]);
    const me = S.turn, won = [];
    let match = false, effect = null;
    if (a.kind === 'wild' && b.kind === 'wild') { match = true; won.push({ v: S.settings.wildBonus, what: 'Wild pair' }); a.gone = b.gone = true; }
    else if (a.kind === 'wild' || b.kind === 'wild') {
      const w = a.kind === 'wild' ? a : b, o = a.kind === 'wild' ? b : a;
      const twin = S.board.find(c => c !== o && !c.gone && c.kind !== 'wild' && same(c, o));
      w.gone = o.gone = true; if (twin) twin.gone = true;
      match = true; effect = o.kind; if (o.kind === 'pts') won.push({ v: o.v, what: String(o.v) });
      S.wildTwin = twin ? twin.n : null;
    } else if (same(a, b)) {
      match = true; a.gone = b.gone = true; effect = a.kind;
      if (a.kind === 'pts') won.push({ v: a.v, what: String(a.v) });
    }
    if (!match) { S.phase = 'miss'; S.hideAt = now() + S.settings.peekSeconds * 1000; S.result = { kind: 'miss' }; fire('nomatch'); return true; }
    if (a.kind !== 'wild' && b.kind !== 'wild') S.wildTwin = null;
    S.board.forEach(c => { if (c.gone && c.by == null) c.by = me; });
    if (S.fin) won.length = 0;
    S.pot[me] = (S.pot[me] || []).concat(won);
    S.result = { kind: 'match', team: me, cards: [a, b].map(label), effect, points: won.reduce((x, c) => x + c.v, 0), fin: !!S.fin };
    if (effect === 'take' && !S.fin) {   // steal the biggest card another team has matched this round
      let best = null;
      for (const t of S.teams) if (t.id !== me) (S.pot[t.id] || []).forEach((c, k) => { if (!best || c.v > best.c.v) best = { id: t.id, k, c }; });
      if (best) { S.pot[best.id].splice(best.k, 1); S.pot[me].push({ ...best.c, what: 'Taken' }); S.result.took = { from: best.id, v: best.c.v }; }
      else S.result.took = null;
    }
    if (effect === 'lose') { S.phase = 'lost'; S.hideAt = now() + S.settings.peekSeconds * 1000; fire('lose'); return true; }
    S.phase = 'match'; fire(effect === 'take' && S.result.took ? 'take' : 'match');
    return true;
  }
  function solve(teamId) {
    const id = Number(teamId);
    if (S.fin) {
      if (!canBuzz(id)) return false;
      S.resume = { phase: S.phase, turn: S.turn, flips: S.flips.slice() };
      S.solver = id; S.phase = 'solve'; S.hideAt = null;
      S.answerEndsAt = S.settings.answerSeconds > 0 ? now() + S.settings.answerSeconds * 1000 : null;
      fire('buzz'); return true;
    }
    if (S.phase === 'match' && id === S.turn) S.solver = id;
    else if (S.phase === 'buzz' && team(id) && !S.locked.includes(id)) { S.solver = id; fire('buzz'); }
    else return false;
    S.phase = 'solve'; S.flips = [];
    S.answerEndsAt = S.settings.answerSeconds > 0 ? now() + S.settings.answerSeconds * 1000 : null;
    if (S.ev.type !== 'buzz') fire('solve');
    return true;
  }
  function bank(id) {   // the solving team banks its matches plus the bonus; everyone else's matches are lost
    const t = team(id), pts = potOf(id) + S.settings.solveBonus;
    if (t) t.score += pts;
    S.result = { kind: 'solved', team: id, points: pts, pot: potOf(id) };
  }

  function finWrong() {   // final wager: lose the wager, sit out the rest of this puzzle, and play carries on
    const id = S.solver, t = team(id), w = wagerOf(id);
    if (t) t.score -= w;
    if (!S.locked.includes(id)) S.locked.push(id);
    S.solver = null; S.answerEndsAt = null; S.result = { kind: 'wrong', team: id, penalty: w, fin: true }; fire('wrong');
    if (S.teams.every(x => S.locked.includes(x.id))) {   // everyone has guessed wrong: show the answer
      S.board.forEach(c => { c.gone = true; }); S.phase = 'solved'; S.flips = []; S.resume = null; S.result = { kind: 'revealed', fin: true }; return;
    }
    const r = S.resume || { phase: 'pick', turn: S.turn, flips: [] }; S.resume = null;
    S.turn = r.turn; S.flips = r.flips || [];
    if (!left()) { S.phase = 'buzz'; S.turn = null; S.flips = []; return; }
    if (r.phase === 'miss' || r.phase === 'lost') { S.phase = r.phase; S.hideAt = now() + S.settings.peekSeconds * 1000; return; }
    if (S.locked.includes(S.turn)) { endTurn(); return; }   // the team whose turn it was is out: the next team picks
    S.phase = r.phase === 'match' ? 'match' : 'pick';
    if (S.phase === 'pick' && S.flips.length >= 2) S.flips = [];
  }

  const actions = {
    flip({ n }) { flip(Number(n)); },
    again() { if (S.phase === 'match' && left()) { S.phase = 'pick'; S.flips = []; } },
    solve({ teamId }) { solve(teamId == null ? (S.phase === 'match' ? S.turn : null) : teamId); },
    correct() {
      if (S.phase !== 'solve') return;
      if (S.fin) { const t = team(S.solver), w = wagerOf(S.solver); if (t) t.score += w; S.result = { kind: 'solved', team: S.solver, points: w, fin: true }; }
      else bank(S.solver); S.pot = {}; S.phase = 'solved'; S.answerEndsAt = null; S.board.forEach(c => { c.gone = true; }); fire('correct');
    },
    wrong() {
      if (S.phase !== 'solve') return;
      if (S.fin) return finWrong();
      const id = S.solver, t = team(id), pen = Math.max(0, Number(S.settings.wrongPenalty) || 0); if (t) t.score -= pen;
      S.solver = null; S.answerEndsAt = null; S.result = { kind: 'wrong', team: id, penalty: pen }; fire('wrong');
      if (!left()) { if (!S.locked.includes(id)) S.locked.push(id); S.phase = S.locked.length >= S.teams.length ? 'buzz' : 'buzz'; S.turn = null; return; }
      S.turn = id; endTurn();
    },
    hide() { if (S.phase === 'miss' || S.phase === 'lost') endTurn(); },
    pass() { if (['pick', 'match', 'miss', 'lost'].includes(S.phase)) { S.flips = []; S.turn = S.turn ?? S.starter; endTurn(); } },
    setTurn({ teamId }) { if (team(teamId) && ['pick', 'match'].includes(S.phase)) { S.turn = Number(teamId); S.phase = 'pick'; S.flips = []; } },
    reveal() {   // nobody got it: show the whole picture, no points
      if (!['pick', 'match', 'miss', 'lost', 'buzz', 'solve'].includes(S.phase)) return;
      S.board.forEach(c => { c.gone = true; }); S.phase = 'solved'; S.flips = []; S.pot = {}; S.answerEndsAt = null; S.result = { kind: 'revealed' }; fire('reveal');
    },
    next() { startRound(nextUnused()); },
    finalPuzzle() {   // play the final-wager puzzle (one that hasn't been played yet, if there is one)
      const list = S.puzzles.map((p, i) => i).filter(i => S.puzzles[i].final);
      const i = list.find(i => !S.used.includes(S.puzzles[i].id)) ?? list[0];
      if (i != null) { S.used = S.used.filter(id => id !== S.puzzles[i].id); startRound(i); }
    },
    wager({ teamId, amount }) {
      const t = team(teamId); if (!t || S.phase !== 'wager') return;
      S.wagers = { ...(S.wagers || {}), [t.id]: Math.min(maxWager(t), Math.max(0, Math.round(Number(amount) || 0))) };
    },
    startBoard() { if (S.phase === 'wager') { S.phase = 'pick'; S.turn = S.starter; fire('start'); } },
    setFinal({ id, on }) { const p = S.puzzles.find(q => q.id === id); if (p) p.final = on === true || on === 'true'; },
    load({ index }) { const i = Number(index); if (S.puzzles[i]) { S.used = S.used.filter(id => id !== S.puzzles[i].id); startRound(i); } },
    lobby() { S.phase = 'lobby'; S.flips = []; S.answerEndsAt = null; },
    final() { S.phase = 'final'; S.flips = []; S.answerEndsAt = null; fire('winner'); },
    theme() { fire('theme'); },
    score({ teamId, delta }) { const t = team(teamId); if (t) { t.score += Math.round(Number(delta) || 0); } },
    rename({ teamId, name }) { const t = team(teamId); const n = String(name || '').trim().slice(0, 24); if (t && n) t.name = n; },
    color({ teamId, color }) { const t = team(teamId); if (t && COLORS.includes(color)) { const o = S.teams.find(x => x !== t && x.color === color); if (o) o.color = t.color; t.color = color; } },
    addTeam({ name }) { addTeam(name); },
    removeTeam({ teamId }) { S.teams = S.teams.filter(t => t.id !== Number(teamId)); if (S.turn === Number(teamId)) S.turn = S.teams[0] ? S.teams[0].id : null; },
    moveTeam({ teamId, dir }) { const i = S.teams.findIndex(t => t.id === Number(teamId)), j = i + (Number(dir) < 0 ? -1 : 1); if (i >= 0 && S.teams[j]) [S.teams[i], S.teams[j]] = [S.teams[j], S.teams[i]]; },
    defaultTeams() { S.teams = defaultTeams(S.nextTeamId); S.nextTeamId += DEFAULT_TEAMS.length; },
    shuffle({ on }) { S.shuffle = on === true || on === 'true'; },
    // puzzle list
    addPuzzle({ img, answer, hint }) {
      const a = String(answer || '').trim(); if (!img || !a) return;
      S.puzzles.push({ id: 'u' + now().toString(36) + Math.random().toString(36).slice(2, 5), img: String(img), answer: a.slice(0, 120), hint: String(hint || '').trim().slice(0, 120) });
    },
    editPuzzle({ id, answer, hint }) {
      const p = S.puzzles.find(q => q.id === id); if (!p) return;
      if (answer != null && String(answer).trim()) p.answer = String(answer).trim().slice(0, 120);
      if (hint != null) p.hint = String(hint).trim().slice(0, 120);
    },
    removePuzzle({ id }) {
      const i = S.puzzles.findIndex(q => q.id === id); if (i < 0 || i === S.cur && !['lobby', 'final', 'solved'].includes(S.phase)) return;
      if (/^s\d/.test(id)) S.removed = (S.removed || []).concat(id);
      const curId = S.cur != null && S.puzzles[S.cur] ? S.puzzles[S.cur].id : null;
      S.puzzles.splice(i, 1); S.cur = curId ? S.puzzles.findIndex(q => q.id === curId) : null; if (S.cur < 0) S.cur = null;
    },
    movePuzzle({ id, dir }) {
      const i = S.puzzles.findIndex(q => q.id === id), j = i + (Number(dir) < 0 ? -1 : 1); if (i < 0 || !S.puzzles[j]) return;
      const curId = S.cur != null && S.puzzles[S.cur] ? S.puzzles[S.cur].id : null;
      [S.puzzles[i], S.puzzles[j]] = [S.puzzles[j], S.puzzles[i]];
      if (curId) S.cur = S.puzzles.findIndex(q => q.id === curId);
    },
    restorePuzzles() { S.removed = []; for (const p of STARTERS) if (!S.puzzles.some(q => q.id === p.id)) S.puzzles.push({ ...p }); },
    markUnused() { S.used = []; },
    settings(o) { for (const k of Object.keys(DEFAULT_SETTINGS)) { const v = Number(o[k]); if (o[k] !== undefined && Number.isFinite(v) && v >= 0) S.settings[k] = Math.round(v); } },
    newGame({ keepTeams } = {}) {
      history.length = 0;
      const keep = { teams: keepTeams ? S.teams.map(t => ({ ...t, score: 0 })) : defaultTeams(S.nextTeamId), nextTeamId: keepTeams ? S.nextTeamId : S.nextTeamId + DEFAULT_TEAMS.length,
        puzzles: S.puzzles, removed: S.removed, settings: S.settings, ev: S.ev, shuffle: S.shuffle };
      S = { ...freshState(), ...keep };
    },
  };

  // ---------- undo ----------
  const UNDO_LABELS = { flip: 'Flip card', again: 'Pick again', solve: 'Solve', correct: 'Correct', wrong: 'Wrong', hide: 'Turn cards back',
    pass: 'Pass turn', setTurn: 'Change turn', reveal: 'Reveal puzzle', next: 'Next puzzle', load: 'Pick puzzle', lobby: 'Join screen',
    final: 'Final standings', finalPuzzle: 'Final wager puzzle', startBoard: 'Start the board', wager: 'Wager', score: 'Score change', removeTeam: 'Remove team', defaultTeams: 'Default teams', removePuzzle: 'Delete puzzle', buzz: 'Buzz-in' };
  function record(type) {
    if (!UNDO_LABELS[type]) return false;
    const c = JSON.parse(JSON.stringify(S));
    if (S.answerEndsAt) c._ansLeft = Math.max(0, S.answerEndsAt - now());
    history.push({ label: UNDO_LABELS[type], state: c, json: JSON.stringify(S) });
    if (history.length > 60) history.shift();
    return true;
  }
  function unrecordIfSame() { const h = history[history.length - 1]; if (h && h.json === JSON.stringify(S)) history.pop(); }
  function undo() {
    const h = history.pop(); if (!h) return;
    const c = h.state, ev = S.ev;
    if (c._ansLeft != null) c.answerEndsAt = now() + c._ansLeft;
    delete c._ansLeft;
    if (c.hideAt) c.hideAt = null;   // cards that were peeking stay up until Go after an undo
    S = c; S.ev = { n: ev.n + 1, type: null };
  }
  function freeColor() { const used = S.teams.map(t => t.color); return COLORS.find(c => !used.includes(c)) || COLORS[S.teams.length % COLORS.length]; }
  function addTeam(name) {
    name = String(name || '').trim().slice(0, 24) || `Team ${S.nextTeamId}`;
    const t = { id: S.nextTeamId++, name, score: 0, color: freeColor() };
    S.teams.push(t); return t;
  }

  return {
    get state() { return S; },
    potOf, label,
    act(type, data = {}) {
      if (type === 'undo') { undo(); changed(); return true; }
      const fn = actions[type]; if (!fn) return false;
      const rec = record(type);
      fn(data || {});
      if (rec) unrecordIfSame();
      changed(); return true;
    },
    // the host page calls this a few times a second: peeking cards turn back over by themselves
    tick() { if ((S.phase === 'miss' || S.phase === 'lost') && S.hideAt && now() >= S.hideAt) { endTurn(); changed(); } },
    // requests from phones
    phoneFlip(teamId, n) { if (S.phase !== 'pick' || Number(teamId) !== S.turn) return false; record('flip'); const ok = flip(Number(n)); if (ok) changed(); else history.pop(); return ok; },
    phoneWager(teamId, amount) { if (S.phase !== 'wager' || !team(teamId)) return false; actions.wager({ teamId, amount }); changed(); return true; },
    maxWager: id => maxWager(team(id)),
    phoneSolve(teamId) { record(S.phase === 'buzz' || S.fin ? 'buzz' : 'solve'); const ok = solve(teamId); if (ok) changed(); else history.pop(); return ok; },
    phoneAgain(teamId) { if (Number(teamId) !== S.turn || S.phase !== 'match') return false; record('again'); actions.again(); changed(); return true; },
    color(teamId, color) {
      const t = team(teamId);
      if (!t || !COLORS.includes(color)) return { ok: false };
      if (S.teams.some(o => o !== t && o.color === color)) return { ok: false, taken: true };
      t.color = color; changed(); return { ok: true };
    },
    join(name, teamId) {
      let t = team(teamId);
      if (!t) { const n = String(name || '').trim(); t = S.teams.find(x => x.name.toLowerCase() === n.toLowerCase()) || addTeam(n); changed(); }
      return t;
    },
  };
}
root.createEngine = createEngine;
})(this);
