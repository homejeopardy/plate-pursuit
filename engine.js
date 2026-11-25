// Plate Pursuit game engine. The same code runs in the local server (node)
// and in the host page on the website, so both modes play identically.
(function (root) {
function createEngine(opts = {}) {
  const changed = () => { S.undoLabel = history.length ? history[history.length - 1].label : null; opts.persist && opts.persist(S); opts.onChange && opts.onChange(); };
  const history = [];   // undo stack (in memory only)
  const DEFAULT_PUZZLES = `## What does it say?
  XQZME | Excuse me | X=Ex, QZ=cuse, ME=me | frame: SORRY, NEW DRIVER
  EZ4U2C | Easy for you to see | EZ=Easy, 4=for, U=you, 2=to, C=see | frame: IF YOU CAN READ THIS
  NOT2NITE | Not tonight | NOT=Not, 2=to, NITE=night | frame: HOME BY 9
  IH8MNDAZ | I hate Mondays | I=I, H8=hate, MNDAZ=Mondays | frame: THANK GOODNESS IT'S FRIDAY
  RUOK2DRV | Are you okay to drive? | R=Are, U=you, OK=okay, 2=to, DRV=drive | frame: DESIGNATED DRIVER
  XLNC | Excellence | X=Ex, L=cel, N=len, C=ce | frame: HONOR ROLL STUDENT
  NRG4U | Energy for you | NRG=Energy, 4=for, U=you | frame: POWERED BY COFFEE
  LUV2SK8 | Love to skate | LUV=Love, 2=to, SK8=skate | frame: I'D RATHER BE AT THE SKATE PARK
  GONE4GD | Gone for good | GONE=Gone, 4=for, GD=good | frame: MOVING SALE
  IOU1MOR | I owe you one more | I=I, O=owe, U=you, 1=one, MOR=more | frame: PAID IN FULL… ALMOST
  QTP2T | Cutie patootie | QT=Cutie, P=pa, 2=too, T=tie | frame: GRANDMA'S CAR
  XPRT | Expert | X=Ex, P=p, RT=ert | frame: ASK ME ANYTHING
  1DRWMN | Wonder Woman | 1=Won, DR=der, WMN=Woman | frame: SUPERHERO ON BOARD
  YRUL8 | Why are you late? | Y=Why, R=are, U=you, L8=late | frame: SCHOOL ZONE
  2L8 4ME | Too late for me | 2=Too, L8=late, 4=for, ME=me | frame: MISSED THE BUS
  RTST | Artist | RT=Art, ST=ist | frame: HONK IF YOU LIKE PAINTINGS
  NSANE | Insane | N=In, SANE=sane | frame: 0 TO 60 IN 3 SECONDS
  2THDK | Tooth decay | 2TH=Tooth, DK=decay | frame: MY DENTIST DRIVES A NICER CAR
  ICUR2BZ | I see you're too busy | I=I, C=see, UR=you're, 2=too, BZ=busy | frame: TEXT ME LATER
  LTL OL ME | Little old me | LTL=Little, OL=old, ME=me | frame: WORLD'S OKAYEST DRIVER
  CR8TIV | Creative | CR8=Crea, TIV=tive | frame: ART TEACHER ON BOARD
  4EVR YNG | Forever young | 4=For, EVR=ever, YNG=young | frame: SENIOR CITIZEN
  B9 | Benign | B=Be, 9=nign | frame: NOTHING TO WORRY ABOUT
  N8IV | Native | N8=Nat, IV=ive | frame: BORN AND RAISED
  U4IA | Euphoria | U=Eu, 4=pho, IA=ria | frame: JUST GOT MY LICENSE
  NML | Animal | N=An, M=im, L=al | frame: I BRAKE FOR SQUIRRELS
  OBDNT | Obedient | O=O, B=be, D=di, NT=ent | frame: DOG TRAINING SCHOOL
  DSPR8 | Desperate | DSP=Desp, R=er, 8=ate | frame: LOW ON GAS
  1DRLND | Wonderland | 1=Won, DR=der, LND=land | frame: FOLLOW THE WHITE RABBIT
  AT10SHN | Attention | AT=At, 10=ten, SHN=tion | frame: BUCKLE UP
  4GV ME | Forgive me | 4=For, GV=give, ME=me | frame: I DIDN'T SEE THE STOP SIGN
  0 2 60 | Zero to sixty | 0=Zero, 2=to, 60=sixty | frame: RACE CAR DRIVER
  NE1 4 10S | Anyone for tennis? | NE1=Anyone, 4=for, 10=ten, S=nis | frame: COUNTRY CLUB MEMBER
  BYND | Beyond | B=Be, YND=yond | frame: TO INFINITY
  NFO | Info | N=In, FO=fo | frame: LIBRARY VOLUNTEER
  MT NST | Empty nest | MT=Empty, NST=nest | frame: KIDS AWAY AT COLLEGE
  IM2GUD4U | I'm too good for you | IM=I'm, 2=too, GUD=good, 4=for, U=you | frame: NEVER LOST A GAME
  DCSN | Decision | D=De, C=ci, SN=sion | frame: SHOULD I TURN LEFT?
  10DR | Tender | 10=Ten, DR=der | frame: STEAKHOUSE CHEF
  SEZ U | Says you | SEZ=Says, U=you | frame: MOM KNOWS BEST
  IYDKNYK | If you don't know, now you know | I=If, Y=you, D=don't, K=know, N=now, Y=you, K=know | frame: INSIDE JOKE
  GUDAY M8 | G'day, mate | GUDAY=G'day, M8=mate | frame: AUSTRALIAN AT HEART
  SOULM8S | Soulmates | SOUL=Soul, M8=mate, S=s | frame: JUST MARRIED
  SRVSTEK | Serve steak | SRV=Serve, STEK=steak | frame: GRILL MASTER
  GRLDCHS | Grilled cheese | GRLD=Grilled, CHS=cheese | frame: SOUP OF THE DAY: TOMATO
  EW PRNDL | Ew Prindle | EW=Ew, PRNDL=Prindle | frame: STUDENT DRIVER
  XT1NK | Extinct | X=Ex, T=t, 1=i, NK=nct | badge: raptor
  SNDAE DRVR | Sundae driver | SNDAE=Sundae, DRVR=driver | frame: ICE CREAM TRUCK
  UR NXT | You're next | UR=You're, NXT=next | frame: TOW TRUCK
  TRSH TLK | Trash talk | TRSH=Trash, TLK=talk | frame: GARBAGE TRUCK
  YA | How are ya? | ~=How are, YA=ya | state: Hawaii | frame: ALOHA!
  LUVS CO | Misery loves company | ~=Misery, LUVS=loves, CO=company | state: Missouri | frame: CARPOOL LANE
  FAVR | I owe a favor | ~=I owe a, FAVR=favor | state: Iowa | frame: BORROWED CAR
  EVENT | Main event | ~=Main, EVENT=event | state: Maine | frame: HEADLINER
  JONES | Indiana Jones | ~=Indiana, JONES=Jones | state: Indiana | frame: ARCHAEOLOGIST
  CURIUS | Curious George | CURIUS=Curious, ~=George | state: Georgia | frame: THE MAN IN THE YELLOW HAT`;
  
  // "PLATE | answer | x2" marks a double-points plate
  const isDouble = f => /^(x2|2x|double)$/i.test(String(f).trim());
  // Rewrite the n-th plate line of the list so it does (or doesn't) end in "| x2", keeping everything else.
  function setDoubleInText(text, n, on) {
    let k = -1;
    return String(text).split('\n').map(raw => {
      const l = raw.trim();
      if (!l || l.startsWith('#')) return raw;
      const parts = l.split('|').map(x => x.trim());
      if (!parts[0] || ++k !== n) return raw;
      const base = [parts[0], parts[1] || ''].concat(parts.slice(2).filter(f => !isDouble(f)));
      const indent = raw.match(/^\s*/)[0];
      return indent + base.join(' | ') + (on ? ' | x2' : '');
    }).join('\n');
  }
  // "YY=Too wise, U=you, ..." in order: which piece of the plate makes which words of the answer
  function parseParts(f) {
    const parts = f.split(',').map(x => { const k = x.indexOf('='); return k < 1 ? null : [x.slice(0, k).trim().toUpperCase(), x.slice(k + 1).trim()]; })
      .filter(x => x && x[0] && x[1]);
    return parts.length ? parts : undefined;
  }
  const NEW_PLATES_2026_11_23 = `  BCNU | Be seeing you | B=Be, C=see, N=ing, U=you
  XQZIT | Exquisite | X=Ex, Q=qui, ZIT=site
  MT POCKT | Empty pocket | MT=Empty, POCKT=pocket
  XPNSV | Expensive | X=Ex, PN=pen, SV=sive
  AV8R | Aviator | AV=Avi, 8=at, R=or
  GR8FUL | Grateful | GR8=Grate, FUL=ful
  2B1ASK1 | To be one, ask one | 2=To, B=be, 1=one, ASK=ask, 1=one
  10TATIV | Tentative | 10=Ten, TATIV=tative
  CU@ BCH | See you at the beach | C=See, U=you, @=at, BCH=beach
  MOOV OVR | Move over | hint: On a cow-print car | MOOV=Move, OVR=over
  ENUF SNO | Enough snow | ENUF=Enough, SNO=snow
  CUZ ICAN | 'Cause I can | CUZ='Cause, I=I, CAN=can
  SAY CHZ | Say cheese | SAY=Say, CHZ=cheese
  O2B HOME | Oh, to be home | O=Oh, 2=to, B=be, HOME=home
  NVUS | Envious | NV=Envi, US=ous
  L8 NITE | Late night | L8=Late, NITE=night
  PB N J | Peanut butter and jelly | P=Peanut, B=butter, N=and, J=jelly
  H8 TRAFC | I hate traffic | H8=hate, TRAFC=traffic
  XCELLNT | Excellent | X=Ex, CELL=cell, NT=ent
  2MUCH2DO | Too much to do | 2=Too, MUCH=much, 2=to, DO=do`;
  // 50 states, DC and the 5 territories: 56 different plates before a state repeats
  const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
    'District of Columbia', 'Puerto Rico', 'Guam', 'U.S. Virgin Islands', 'American Samoa', 'Northern Mariana Islands'];
  function parsePuzzles(text) {
    let cat = 'What does it say?';
    const out = [];
    for (const raw of String(text).split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      if (l.startsWith('##')) { cat = l.replace(/^#+/, '').trim() || cat; continue; }
      if (l.startsWith('#')) continue;
      const [plate, answer = '', ...extra] = l.split('|').map(s => s.trim());
      if (!plate) continue;
      const q = { cat, plate: plate.toUpperCase().slice(0, 10), answer };
      for (const f of extra) {
        const kv = f.match(/^(hint|state|frame|badge)\s*:\s*(.*)$/i);
        if (isDouble(f)) q.double = true;
        else if (kv) q[kv[1].toLowerCase()] = kv[2].trim();
        else if (f.includes('=')) q.parts = parseParts(f);
      }
      out.push(q);
    }
    // every plate gets its own state: the ones named in the list first, then the rest in order
    const taken = new Set(out.map(q => q.state).filter(Boolean));
    const free = STATES.filter(x => !taken.has(x));
    let k = 0;
    for (const q of out) if (!q.state) q.state = free.length ? free[k++ % free.length] : STATES[k++ % STATES.length];
    return out;
  }
  
  // Team colours (keys; shared.js maps them to paint). Yellow is left out: it marks the team answering.
  const COLORS = ['red', 'blue', 'orange', 'purple', 'teal', 'pink', 'green', 'brown'];
  const DEFAULT_SETTINGS = { maxPoints: 100, minPoints: 10, drainSeconds: 20, answerSeconds: 5, speedPoints: 50, speedSeconds: 60, finalSeconds: 30 };
  
  function freshState() {
    return {
      phase: 'lobby', teams: [], nextTeamId: 1,
      puzzleText: DEFAULT_PUZZLES, puzzles: parsePuzzles(DEFAULT_PUZZLES),
      used: [], cur: null, elapsed: 0, runningSince: null,
      buzzed: null, locked: [], valueAtBuzz: 0, result: null,
      speed: null, settings: { ...DEFAULT_SETTINGS }, ev: { n: 0, type: null },
      fin: null, tb: null, tbWinner: null, undoLabel: null, step: 0,
    };
  }
  
  let S = freshState();
  try { const saved = opts.load && opts.load(); if (saved) S = { ...S, ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } }; } catch (e) {}
  S.runningSince = null; S.undoLabel = null;
  if (S.phase === 'fanswer' && S.fin) S.fin.endsAt = Date.now() + 10000;   // reloaded mid-answer: give 10 more seconds
  if (S.phase === 'running') S.phase = 'ready';
  if (S.phase === 'speed') S.phase = 'speedover';
  setTimeout(() => rearmTimers(), 0);
  for (const t of S.teams) if (!COLORS.includes(t.color)) t.color = freeColor();   // games saved before colours
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
  
  // Saved games based on the starter list get the 20 plates added on 2026-11-23, at the end of the
  // "What does it say?" section. Played plates are kept by remapping them by plate text.
  if (/^\s*ICU2\s*\|/m.test(S.puzzleText || '') && !/^\s*BCNU\s*\|/m.test(S.puzzleText || '')) {
    const plateAt = i => (S.puzzles[i] || {}).plate;
    const usedPlates = S.used.map(plateAt), curPlate = plateAt(S.cur);
    const lines = String(S.puzzleText).split('\n');
    let at = lines.findIndex(l => /^\s*##\s*Who drives/i.test(l));
    if (at < 0) at = lines.length;
    while (at > 0 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, ...NEW_PLATES_2026_11_23.split('\n'));
    S.puzzleText = lines.join('\n'); S.puzzles = parsePuzzles(S.puzzleText);
    const idx = pl => S.puzzles.findIndex(q => q.plate === pl);
    S.used = usedPlates.map(idx).filter(i => i >= 0);
    S.cur = curPlate != null && idx(curPlate) >= 0 ? idx(curPlate) : null;
    setTimeout(() => opts.persist && opts.persist(S), 0);
  }
  // 2026-11-23: the user dropped the "Who drives this car?" plates. Take the starter ones out of saved games
  // (plates the host typed in themselves stay), keeping which plates were played.
  {
    const GONE = ['PI R2', 'E MC2', '2TH FXR', 'IC 2020', 'RX 4 U', '4 PAWS', 'EIEIO', 'ARRRR', 'MOO2U', 'OUI OUI'];
    const lines = String(S.puzzleText || '').split('\n');
    const isGone = l => { const f = l.trim(); return !f.startsWith('#') && GONE.includes(f.split('|')[0].trim().toUpperCase()); };
    if (lines.some(isGone)) {
      const plateAt = i => (S.puzzles[i] || {}).plate;
      const usedPlates = S.used.map(plateAt), curPlate = plateAt(S.cur);
      let kept = lines.filter(l => !isGone(l));
      // drop a "## Who drives this car?" header with nothing left under it
      kept = kept.filter((l, i) => !(/^\s*##\s*Who drives this car\?\s*$/i.test(l) && !kept.slice(i + 1).some(x => x.trim() && !x.trim().startsWith('#'))));
      while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
      const p = parsePuzzles(kept.join('\n'));
      if (p.length) {
        S.puzzleText = kept.join('\n'); S.puzzles = p;
        const idx = pl => S.puzzles.findIndex(q => q.plate === pl);
        S.used = usedPlates.map(idx).filter(i => i >= 0);
        S.cur = curPlate != null && idx(curPlate) >= 0 ? idx(curPlate) : null;
        if (S.cur == null && !['lobby', 'final'].includes(S.phase)) S.phase = 'lobby';
        setTimeout(() => opts.persist && opts.persist(S), 0);
      }
    }
  }
  // 2026-11-25: the user asked for harder plates, replacing the whole starter list. A saved game still on
  // the old starter list gets the new one; scores and teams stay, and every plate becomes unplayed.
  if (/^\s*YYURYYUB\s*\|/m.test(S.puzzleText || '') && !/^\s*XQZME\s*\|/m.test(S.puzzleText || '')) {
    S.puzzleText = DEFAULT_PUZZLES; S.puzzles = parsePuzzles(DEFAULT_PUZZLES); S.used = []; S.cur = null;
    if (!['lobby', 'final'].includes(S.phase)) S.phase = 'lobby';
    setTimeout(() => opts.persist && opts.persist(S), 0);
  }
  // 2026-11-25: five more plates the user asked for. Added after SEZ U (or at the end); nothing else moves.
  if (/^\s*XQZME\s*\|/m.test(S.puzzleText || '') && !/^\s*IYDKNYK\s*\|/m.test(S.puzzleText || '')) {
    const add = `  IYDKNYK | If you don't know, now you know | I=If, Y=you, D=don't, K=know, N=now, Y=you, K=know
  GUDAY M8 | G'day, mate | GUDAY=G'day, M8=mate
  SOULM8S | Soulmates | SOUL=Soul, M8=mate, S=s
  SRVSTEK | Serve steak | SRV=Serve, STEK=steak
  GRLDCHS | Grilled cheese | GRLD=Grilled, CHS=cheese`;
    const lines = String(S.puzzleText).split('\n');
    const at = lines.findIndex(l => /^\s*SEZ U\s*\|/.test(l));
    if (at >= 0) lines.splice(at + 1, 0, ...add.split('\n')); else lines.push(...add.split('\n'));
    const plateAt = i => (S.puzzles[i] || {}).plate;
    const usedPlates = S.used.map(plateAt), curPlate = plateAt(S.cur);
    S.puzzleText = lines.join('\n'); S.puzzles = parsePuzzles(S.puzzleText);
    const idx = pl => S.puzzles.findIndex(q => q.plate === pl);
    S.used = usedPlates.map(idx).filter(i => i >= 0);
    S.cur = curPlate != null && idx(curPlate) >= 0 ? idx(curPlate) : null;
    setTimeout(() => opts.persist && opts.persist(S), 0);
  }
  // 2026-11-25: frames on every plate, state jokes and car jokes. Starter lines in a saved list are brought up to
  // date (keeping a "| x2"), missing starter plates are added after the last plate, and played plates stay played.
  if (/^\s*XQZME\s*\|/m.test(S.puzzleText || '')) {
    const def = {};
    for (const l of DEFAULT_PUZZLES.split('\n')) { const t = l.trim(); if (t && !t.startsWith('#') && t.includes('|')) def[t.split('|')[0].trim()] = t; }
    const seen = new Set(); let touched = false, lastPlate = -1;
    const lines = String(S.puzzleText).split('\n').map((raw, i) => {
      const t = raw.trim(); if (!t || t.startsWith('#')) return raw;
      const pl = t.split('|')[0].trim().toUpperCase(); seen.add(pl); lastPlate = i;
      if (!def[pl] || /\|\s*(frame|badge)\s*:/i.test(t)) return raw;
      touched = true;
      return raw.match(/^\s*/)[0] + def[pl] + (t.split('|').slice(2).some(f => isDouble(f)) ? ' | x2' : '');
    });
    const missing = Object.keys(def).filter(pl => !seen.has(pl)).map(pl => '  ' + def[pl]);
    if (missing.length) { lines.splice(lastPlate + 1, 0, ...missing); touched = true; }
    if (touched) {
      const plateAt = i => (S.puzzles[i] || {}).plate;
      const usedPlates = S.used.map(plateAt), curPlate = plateAt(S.cur);
      S.puzzleText = lines.join('\n'); S.puzzles = parsePuzzles(S.puzzleText);
      const idx = pl => S.puzzles.findIndex(q => q.plate === pl);
      S.used = usedPlates.map(idx).filter(i => i >= 0);
      S.cur = curPlate != null && idx(curPlate) >= 0 ? idx(curPlate) : null;
      setTimeout(() => opts.persist && opts.persist(S), 0);
    }
  }
  // Saved lists from before plate pieces were coloured: add the starter mapping to starter lines that have none.
  {
    const starter = {};
    for (const l of DEFAULT_PUZZLES.split('\n')) { const f = l.split('|').map(x => x.trim()); const m = f.slice(2).find(x => x.includes('=') && !/^hint\s*:/i.test(x)); if (m) starter[f[0] + '|' + f[1]] = m; }
    let touched = false;
    const text = String(S.puzzleText || '').split('\n').map(raw => {
      const l = raw.trim(); if (!l || l.startsWith('#')) return raw;
      const f = l.split('|').map(x => x.trim());
      const m = starter[(f[0] || '').toUpperCase() + '|' + (f[1] || '')];
      if (!m || f.slice(2).some(x => x.includes('='))) return raw;
      touched = true; return raw.replace(/\s+$/, '') + ' | ' + m;
    }).join('\n');
    if (touched) {
      S.puzzleText = text; S.puzzles = parsePuzzles(text);
      setTimeout(() => opts.persist && opts.persist(S), 0);
    }
  }

  // ---------- engine ----------
  const now = () => Date.now();
  const team = id => S.teams.find(t => t.id === id);
  const elapsedNow = () => S.elapsed + (S.runningSince ? (now() - S.runningSince) / 1000 : 0);
  function liveValue() {
    const { maxPoints, minPoints, drainSeconds } = S.settings;
    const t = Math.min(1, elapsedNow() / drainSeconds);
    const v = Math.max(minPoints, Math.ceil((maxPoints - (maxPoints - minPoints) * t) / 10) * 10);
    return (S.puzzles[S.cur] || {}).double ? v * 2 : v;
  }
  function freeze() { S.elapsed = elapsedNow(); S.runningSince = null; }
  function markUsed(i) { if (i != null && !S.used.includes(i)) S.used.push(i); }
  function nextUnused(after) {
    const n = S.puzzles.length;
    if (S.shuffle !== false) {   // shuffle (on unless the host turned it off): any unplayed plate other than the one up now
      const left = [...Array(n).keys()].filter(i => !S.used.includes(i) && i !== S.cur);
      if (left.length) return left[Math.floor(Math.random() * left.length)];
      return S.cur != null && !S.used.includes(S.cur) ? S.cur : null;
    }
    for (let k = 1; k <= n; k++) { const i = ((after ?? -1) + k) % n; if (!S.used.includes(i)) return i; }
    return null;
  }
  function fire(type) { S.ev = { n: S.ev.n + 1, type }; }
  function loadPlate(i) {
    if (i == null || !S.puzzles[i]) return;
    S.cur = i; S.phase = 'ready'; S.elapsed = 0; S.runningSince = null;
    S.buzzed = null; S.locked = []; S.result = null; S.step = 0;
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
    score: 'Score change', toggleDouble: 'Double points', removeTeam: 'Remove team', finalStart: 'Final wager plate', finalShow: 'Show final plate',
    finalLock: 'Lock answers', finalMark: 'Mark final answer', tiebreak: 'Tie-breaker plate',
    step: 'Reveal piece', stepAll: 'Whole answer', finalNext: 'Show team answer' };
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
      S.fin = { wagers: {}, answers: {}, marks: {}, base: {}, endsAt: null, order: [], shown: 0 }; S.step = 0;
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
      S.fin.endsAt = null; markUsed(S.cur); S.phase = 'fjudge'; S.step = 0; fire('reveal');
      // teams' answers are shown one at a time, lowest score first
      S.fin.order = [...S.teams].sort((a, b) => (S.fin.base[a.id] ?? a.score) - (S.fin.base[b.id] ?? b.score)).map(t => t.id); S.fin.shown = 0;
    },
    finalNext() { if (S.phase === 'fjudge' && S.fin.shown < S.fin.order.length) { S.fin.shown++; fire('buzz'); } },
    // reveal the answer one piece of the plate at a time
    step() { if (['revealed', 'fjudge'].includes(S.phase) && S.step < pieceCount(S.puzzles[S.cur])) S.step++; },
    stepAll() { if (['revealed', 'fjudge'].includes(S.phase)) S.step = pieceCount(S.puzzles[S.cur]); },
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
    color({ teamId, color }) { const t = team(Number(teamId)); if (t && COLORS.includes(color)) t.color = color; },
    toggleDouble({ index }) {
      const i = Number(index), q = S.puzzles[i]; if (!q) return;
      if (q.double) delete q.double; else q.double = true;
      S.puzzleText = setDoubleInText(S.puzzleText, i, !!q.double);
    },
    shuffle({ on }) { S.shuffle = on === true || on === 'true'; },
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
        puzzleText: S.puzzleText, puzzles: S.puzzles, settings: S.settings, ev: S.ev, shuffle: S.shuffle };
      S = { ...freshState(), ...keep };
    },
  };
  
  // how many steps the answer reveals in: one per piece, or one for a plate without a usable mapping
  function pieceCount(q) {
    if (!q) return 0;
    if (!q.parts) return 1;
    let i = 0;
    for (const [k] of q.parts) { if (k === '~') continue; while (q.plate[i] === ' ') i++; if (q.plate.slice(i, i + k.length) !== k) return 1; i += k.length; }
    return q.parts.length;
  }
  function freeColor() {
    const used = S.teams.map(t => t.color);
    return COLORS.find(c => !used.includes(c)) || COLORS[S.teams.length % COLORS.length];
  }
  function addTeam(name) {
    name = String(name || '').trim().slice(0, 24) || `Team ${S.nextTeamId}`;
    const t = { id: S.nextTeamId++, name, score: 0, color: freeColor() };
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
    // a phone picks its colour; two teams can't share one
    color(teamId, color) {
      const t = team(Number(teamId));
      if (!t || !COLORS.includes(color)) return { ok: false };
      if (S.teams.some(o => o !== t && o.color === color)) return { ok: false, taken: true };
      t.color = color; changed(); return { ok: true };
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
