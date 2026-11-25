// Each state's (or territory's) current standard plate, redrawn in simple shapes: background, artwork, how the
// name and slogan look. Researched from descriptions of the real plates; colours are approximate, not exact copies.
// art is SVG drawn in a 200 x 100 box (the plate), behind the characters. name.font: block | serif | sans | script.
// A slogan of null falls back to the state's nickname (a county-name line on the real plate becomes the nickname).
(function (root) {
const tree = (x, y, h, c) => `<path d="M${x} ${y - h} L${x + h * .32} ${y} L${x - h * .32} ${y}Z" fill="${c}"/>`;
const forest = (y, c, n = 34) => Array.from({ length: n }, (_, i) => tree(i * (200 / (n - 1)), y, 8 + (i * 7 % 5), c)).join('') + `<rect x="0" y="${y}" width="200" height="${100 - y}" fill="${c}"/>`;
const ridge = (pts, c, base = 100) => `<path d="M0 ${base} L${pts} L200 ${base}Z" fill="${c}"/>`;
const wave = (y, c, w = 1.6, amp = 2.4) => `<path d="M0 ${y} ${Array.from({ length: 10 }, (_, i) => `Q${i * 20 + 5} ${y - amp} ${i * 20 + 10} ${y} T${i * 20 + 20} ${y}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const sky = (...stops) => `linear-gradient(180deg, ${stops.join(', ')})`;

const S = {
  'Alabama': { bg: sky('#7fb8e0 0%', '#d7e9f2 30%', '#f6d58a 46%', '#8cc7dd 52%', '#5aa9c9 66%', '#f3e3c3 80%', '#e6cc9a 100%'), ink: '#111',
    name: { text: 'ALABAMA', color: '#1f4e9c', font: 'block' }, slogan: { text: 'HEART OF DIXIE', color: '#1f4e9c' },
    art: `<circle cx="132" cy="49" r="8" fill="#fff4c9" opacity=".95"/><path d="M178 84 c-3 -4 -9 -1 -6 4 l6 6 l6 -6 c3 -5 -3 -8 -6 -4z" fill="none" stroke="#fff" stroke-width="1.2"/>` },
  'Alaska': { bg: '#f5c518', ink: '#1c3f94', name: { text: 'ALASKA', color: '#1c3f94', font: 'block' }, slogan: { text: 'THE LAST FRONTIER', color: '#1c3f94' },
    art: `<rect x="92" y="42" width="16" height="16" fill="#1c3f94" opacity=".9"/><circle cx="105" cy="45" r="1.4" fill="#f5c518"/>` + [[95, 53], [97, 50], [99, 51], [101, 52], [102, 55], [99, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".8" fill="#f5c518"/>`).join('') },
  'Arizona': { bg: sky('#3fb7b4 0%', '#bfe8e4 30%', '#ffffff 48%', '#f6c48d 66%', '#f4a259 80%'), ink: '#1f5130',
    name: { text: 'ARIZONA', color: '#2aa7a7', font: 'block', outline: '#ffffff' }, slogan: { text: 'GRAND CANYON STATE', color: '#1f5130' },
    art: `<circle cx="100" cy="76" r="15" fill="#fff" opacity=".85"/>` + ridge('0 84 L22 76 L40 82 L64 69 L88 79 L112 71 L138 83 L160 74 L182 80 L200 76', '#8c6bb1')
      + `<g fill="#1f5130"><rect x="16" y="44" width="5" height="44" rx="2.5"/><path d="M16 66 h-6 v-12 a2.5 2.5 0 0 1 5 0 v7 h1z"/><path d="M21 60 h6 v-10 a2.5 2.5 0 0 0 -5 0 v5 h-1z"/></g>` },
  'Arkansas': { bg: sky('#8cc6ea 0%', '#ffffff 62%'), ink: '#111', name: { text: 'Arkansas', color: '#8b1a1a', font: 'sans' }, slogan: { text: 'The Natural State', color: '#8b1a1a', font: 'script' },
    art: `<path d="M100 36 L114 52 L100 68 L86 52Z" fill="#8b1a1a" opacity=".18"/>` },
  'California': { bg: '#ffffff', ink: '#1b2a7a', name: { text: 'California', color: '#c8102e', font: 'script' }, slogan: { text: 'dmv.ca.gov', color: '#1b2a7a' } },
  'Colorado': { bg: 'linear-gradient(180deg, #1d5631 0 31%, #ffffff 31%)', ink: '#1d5631', name: { text: 'COLORADO', color: '#ffffff', font: 'block' }, slogan: null,
    art: ridge('0 28 L14 22 L26 27 L42 19 L56 26 L72 20 L88 27 L104 21 L120 27 L136 18 L152 26 L168 21 L184 27 L200 22', '#ffffff', 31)
      + ridge('0 30 L20 26 L34 29 L50 25 L70 30 L92 26 L112 30 L130 25 L150 29 L172 26 L200 29', '#c9cfd4', 31) },
  'Connecticut': { bg: sky('#8fc3ea 0%', '#ffffff 70%'), ink: '#1b2f6b', rim: '#1b2f6b', name: { text: 'Connecticut', color: '#1b2f6b', font: 'sans' }, slogan: { text: 'Constitution State', color: '#1b2f6b', font: 'serif' } },
  'Delaware': { bg: '#1d2b5e', ink: '#d4a92a', rim: '#d4a92a', name: { text: 'DELAWARE', color: '#d4a92a', font: 'block', pos: 'bottom' }, slogan: { text: 'THE FIRST STATE', color: '#d4a92a' } },
  'District of Columbia': { bg: '#ffffff', ink: '#1d3f8f', name: { text: 'WASHINGTON, DC', color: '#1d3f8f', font: 'block' }, slogan: { text: 'END TAXATION WITHOUT REPRESENTATION', color: '#1d3f8f' },
    art: `<rect x="10" y="19" width="180" height="3" fill="#c8102e"/><rect x="10" y="82" width="180" height="3" fill="#c8102e"/>` },
  'Florida': { bg: '#ffffff', ink: '#1f6b3a', name: { text: 'FLORIDA', color: '#1f6b3a', font: 'block' }, slogan: { text: 'SUNSHINE STATE', color: '#1f6b3a' },
    art: `<path d="M84 40 L114 40 L116 44 L106 45 L110 56 L113 65 L109 68 L101 58 L98 47 L84 46Z" fill="#3c8a4f" opacity=".45"/><circle cx="104" cy="47" r="4.2" fill="#f28c28"/>`
      + [[96, 44], [99, 41], [95, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" stroke="#e8e0c8" stroke-width=".4"/>`).join('') },
  'Georgia': { bg: '#ffffff', ink: '#111', name: { text: 'Georgia', color: '#1d2b5c', font: 'sans' }, slogan: null,
    art: `<circle cx="100" cy="53" r="9" fill="#f4895f"/><path d="M100 53 q-2 -6 0 -9" stroke="#c4553a" stroke-width=".8" fill="none"/><path d="M100 44 q7 -5 11 -1 q-5 4 -11 1z" fill="#4c8a3a"/>` },
  'Guam': { bg: '#ffffff', ink: '#111', name: { text: 'GUAM', color: '#111', font: 'block' }, slogan: { text: 'Tano Y Chamorro', color: '#c8102e', font: 'script' },
    art: `<g fill="#9a9a96"><rect x="96" y="46" width="8" height="18" rx="1"/><path d="M88 46 q12 -9 24 0z"/></g>` + [[90, 62], [108, 60], [111, 65]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#d6266f"/>`).join('') },
  'Hawaii': { bg: '#ffffff', ink: '#111', name: { text: 'HAWAIʻI', color: '#111', font: 'block' }, slogan: { text: 'ALOHA STATE', color: '#111' },
    art: ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].map((c, i) => `<path d="M${18 + i * 4} 96 A${82 - i * 4} ${66 - i * 4} 0 0 1 ${182 - i * 4} 96" fill="none" stroke="${c}" stroke-width="4" opacity=".55"/>`).join('') },
  'Idaho': { bg: sky('#c8102e 0%', '#f0a3ac 26%', '#ffffff 42%'), ink: '#111', rim: '#ffffff', name: { text: 'Scenic IDAHO', color: '#ffffff', font: 'block' }, slogan: { text: 'FAMOUS POTATOES', color: '#ffffff' },
    art: ridge('0 70 L18 58 L34 66 L52 52 L70 63 L90 55 L110 64 L130 50 L150 62 L170 54 L188 63 L200 58', '#a9c7e8') + forest(84, '#1c2f6b') },
  'Illinois': { bg: sky('#5b8fd0 0%', '#ffffff 72%'), ink: '#111', name: { text: 'Illinois', color: '#111', font: 'sans' }, slogan: { text: 'Land of Lincoln', color: '#111', font: 'script' },
    art: `<g fill="#ffffff" opacity=".85">${[[30, 34], [38, 22], [46, 30], [54, 18], [62, 28], [70, 36], [130, 30], [138, 40], [146, 24], [154, 34], [162, 28]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="${62 - y}"/>`).join('')}</g><ellipse cx="14" cy="50" rx="7" ry="10" fill="#d4d4d4" opacity=".7"/>` },
  'Indiana': { bg: sky('#9ccbea 0%', '#e8f3fa 45%', '#d6e8b8 70%', '#86b86f 100%'), ink: '#1c2f6b', name: { text: 'INDIANA', color: '#1c2f6b', font: 'block' }, slogan: null,
    art: `<g opacity=".85"><rect x="150" y="70" width="38" height="12" fill="#9b2d20"/><path d="M147 70 L169 60 L191 70Z" fill="#6d1f16"/><rect x="164" y="73" width="10" height="9" fill="#3b120d"/></g>`
      + [[20, 74, 8], [34, 78, 6], [128, 76, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#4f8a3c" opacity=".8"/>`).join('') },
  'Iowa': { bg: sky('#6fa8dc 0%', '#a9cbe9 44%', '#ffffff 46%', '#ffffff 70%', '#5a9e3a 74%'), ink: '#111', name: { text: 'IOWA', color: '#ffffff', font: 'block' },
    art: `<g fill="#ffffff">${[[24, 32], [30, 26], [36, 34], [42, 22]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="${46 - y}"/>`).join('')}<path d="M120 46 v-10 l7 -6 l7 6 v10z"/><rect x="140" y="30" width="5" height="16" rx="2.5"/><path d="M168 46 l1 -24 l1 24z"/><path d="M169 22 l-9 -4 M169 22 l9 -4 M169 22 v10" stroke="#fff" stroke-width="1.2"/></g>`, slogan: { text: null, color: '#ffffff' } },
  'Kansas': { bg: sky('#a9cfe8 0%', '#ffffff 55%', '#e8c35a 100%'), ink: '#111', rim: '#4a4a4a', name: { text: 'KANSAS', color: '#4a4a4a', font: 'block' }, slogan: { text: 'To the Stars', color: '#4a4a4a', font: 'script' },
    art: `<g fill="#4a4a4a" opacity=".85"><rect x="10" y="74" width="30" height="10"/><rect x="21" y="64" width="8" height="10"/><path d="M20 64 q5 -10 10 0z"/><rect x="24.5" y="50" width="1" height="6"/></g>` },
  'Kentucky': { bg: sky('#ffffff 0%', '#a8d0ee 100%'), ink: '#1c2f6b', name: { text: 'KENTUCKY', color: '#1c3f94', font: 'block' }, slogan: { text: 'BLUEGRASS STATE', color: '#1c3f94' } },
  'Louisiana': { bg: '#ffffff', ink: '#1c2f6b', rim: '#1c2f6b', name: { text: 'LOUISIANA', color: '#c8102e', font: 'block' }, slogan: { text: "Sportsman's Paradise", color: '#1c2f6b', font: 'script' },
    art: `<path d="M90 40 L106 40 L106 50 L112 50 L114 60 L108 64 L100 61 L92 63 L90 56Z" fill="#c8102e" opacity=".75"/>` },
  'Maine': { bg: '#ffffff', ink: '#1c2f6b', rim: '#1c2f6b', name: { text: 'MAINE', color: '#1f5a32', font: 'block' }, slogan: { text: 'VACATIONLAND', color: '#1f5a32' },
    art: `<path d="M22 28 l1.6 4.4 h4.6 l-3.8 2.8 l1.5 4.5 l-3.9 -2.8 l-3.9 2.8 l1.5 -4.5 l-3.8 -2.8 h4.6z" fill="#1c3f94"/>` + tree(22, 62, 22, '#1f5a32') + tree(22, 78, 22, '#1f5a32') + `<rect x="20.5" y="78" width="3" height="6" fill="#5a3b1e"/>` },
  'Maryland': { bg: '#ffffff', ink: '#111', name: { text: 'Maryland', color: '#c8102e', font: 'script' }, slogan: { text: '' },
    art: [0, 1, 2, 3].map(q => { const x = 22 + q * 39; return q % 3 === 0
      ? `<rect x="${x}" y="85" width="39" height="11" fill="#e6b31e"/>` + [0, 1, 2].map(i => `<rect x="${x + 6 + i * 12}" y="85" width="6" height="11" fill="#111"/>`).join('')
      : `<rect x="${x}" y="85" width="39" height="11" fill="#fff"/><rect x="${x}" y="85" width="19.5" height="5.5" fill="#c8102e"/><rect x="${x + 19.5}" y="90.5" width="19.5" height="5.5" fill="#c8102e"/><rect x="${x + 17.5}" y="85" width="4" height="11" fill="#c8102e"/><rect x="${x}" y="88.8" width="39" height="3.4" fill="#c8102e"/>`; }).join('') },
  'Massachusetts': { bg: '#ffffff', ink: '#c8102e', name: { text: 'Massachusetts', color: '#1c3f94', font: 'sans' }, slogan: { text: 'The Spirit of America', color: '#1c3f94', font: 'serif' } },
  'Michigan': { bg: '#ffffff', ink: '#1c3f94', name: { text: 'Pure Michigan', color: '#1c3f94', font: 'sans' }, slogan: { text: 'GREAT LAKES STATE', color: '#ffffff' },
    art: `<path d="M0 84 Q25 78 50 84 T100 84 T150 84 T200 84 V100 H0Z" fill="#1c3f94"/>` },
  'Minnesota': { bg: sky('#cfe6f5 0%', '#ffffff 50%', '#ffffff 68%', '#8fc0e3 84%'), ink: '#111', name: { text: 'Explore Minnesota', color: '#1c3f94', font: 'sans' }, slogan: { text: '10,000 lakes', color: '#1c3f94', font: 'serif' },
    art: `<ellipse cx="26" cy="62" rx="16" ry="3" fill="#4f8a3c"/>` + tree(20, 61, 12, '#2e6b33') + tree(28, 61, 15, '#2e6b33') + `<path d="M150 70 q10 4 20 0 l-2 2 h-16z" fill="#2e6b33"/>` },
  'Mississippi': { bg: '#ffffff', ink: '#1c2f6b', name: { text: 'MISSISSIPPI', color: '#1c2f6b', font: 'block' }, slogan: null,
    art: `<circle cx="100" cy="52" r="11" fill="#2a5ba8"/>` + Array.from({ length: 5 }, (_, i) => `<ellipse cx="100" cy="46" rx="2.8" ry="6" fill="#fff" transform="rotate(${i * 72} 100 52)"/>`).join('') + `<circle cx="100" cy="52" r="2" fill="#e8d35a"/>` },
  'Missouri': { bg: '#ffffff', ink: '#1c2f6b', name: { text: 'MISSOURI', color: '#c8102e', font: 'block' }, slogan: { text: 'SHOW-ME STATE', color: '#1c3f94' },
    art: wave(20, '#c8102e') + wave(23.5, '#c8102e', 1) + wave(81, '#1c3f94', 1) + wave(84.5, '#1c3f94') + `<circle cx="100" cy="52" r="12" fill="none" stroke="#b9b9b9" stroke-width="1.4" opacity=".6"/>` },
  'Montana': { bg: '#1d3f8f', ink: '#ffffff', rim: '#ffffff', name: { text: 'MONTANA', color: '#ffffff', font: 'block', pos: 'bottom' }, slogan: { text: 'TREASURE STATE', color: '#ffffff' } },
};
Object.assign(S, {
  'Nebraska': { bg: '#ffffff', ink: '#1f3a6e', name: { text: 'NEBRASKA', color: '#1f3a6e', font: 'block' }, slogan: null,
    art: `<g fill="none" stroke="#9db7d6" stroke-width="2" opacity=".55"><circle cx="100" cy="52" r="20"/><path d="M84 60 q16 -26 34 -8 q-10 -4 -18 6"/><path d="M90 44 q10 -10 24 -4"/></g>` },
  'Nevada': { bg: '#8fc3e8', ink: '#000', name: { text: 'NEVADA', color: '#000', font: 'block' }, slogan: { text: 'Home Means Nevada', color: '#000', font: 'script' },
    art: ridge('0 78 L20 70 L40 76 L60 66 L84 74 L106 64 L128 73 L150 65 L172 74 L200 68', '#c7a6d8') + ridge('0 84 L26 78 L48 83 L72 76 L96 82 L122 76 L146 83 L170 77 L200 82', '#f2b880') },
  'New Hampshire': { bg: sky('#cfe3f2 0%', '#ffffff 72%'), ink: '#1e5631', name: { text: 'New HAMPSHIRE', color: '#1e5631', font: 'serif', pos: 'bottom' }, slogan: { text: 'LIVE FREE OR DIE', color: '#1e5631' },
    art: `<path d="M58 80 L62 60 L58 56 L64 50 L60 46 L66 38 L74 40 L80 56 L92 80Z" fill="#8a9a88" opacity=".55"/>` + ridge('0 80 L30 70 L60 76 L90 66 L120 74 L150 68 L200 76', '#b9cbb5', 82) },
  'New Jersey': { bg: sky('#f3df8a 0%', '#ffffff 72%'), ink: '#000', name: { text: 'New Jersey', color: '#000', font: 'sans' }, slogan: { text: 'Garden State', color: '#000', font: 'serif' } },
  'New Mexico': { bg: '#f6d23a', ink: '#c8102e', name: { text: 'New Mexico USA', color: '#c8102e', font: 'sans', pos: 'bottom' }, slogan: { text: 'Land of Enchantment', color: '#2f86a8', font: 'script' },
    art: `<g fill="none" stroke="#c8102e" stroke-width="2.4" stroke-linecap="round"><circle cx="100" cy="52" r="6"/><path d="M86 49 h7 M86 52 h7 M86 55 h7 M107 49 h7 M107 52 h7 M107 55 h7 M97 38 v7 M100 38 v7 M103 38 v7 M97 59 v7 M100 59 v7 M103 59 v7"/></g>`
      + `<path d="M4 4 l6 5 l6 -5 l6 5 l6 -5 M172 4 l6 5 l6 -5 l6 5 l6 -5" fill="none" stroke="#2f86a8" stroke-width="2"/><g stroke="#5ab4d6" stroke-width="1.6"><path d="M18 90 l-6 -14 M18 90 l0 -16 M18 90 l6 -14 M18 90 l-9 -8 M18 90 l9 -8"/></g>` },
  'New York': { bg: '#ffffff', ink: '#1b3a6b', name: { text: 'NEW YORK', color: '#1b3a6b', font: 'block' }, slogan: { text: 'EXCELSIOR', color: '#e0a526' },
    art: `<rect x="34" y="9" width="40" height="2.4" fill="#e0a526"/><rect x="34" y="12.6" width="40" height="2.4" fill="#1b3a6b"/><rect x="126" y="9" width="40" height="2.4" fill="#e0a526"/><rect x="126" y="12.6" width="40" height="2.4" fill="#1b3a6b"/>`
      + `<g fill="#1b3a6b" opacity=".75">${[[140, 84], [146, 78], [152, 82], [158, 74], [164, 80], [170, 86]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="${96 - y}"/>`).join('')}</g><path d="M8 96 L16 86 L22 90 L30 82 L38 96Z" fill="#1b3a6b" opacity=".6"/><rect x="24" y="86" width="4" height="10" fill="#8fc3e8"/>` },
  'North Carolina': { bg: '#ffffff', ink: '#1f3f8f', name: { text: 'NORTH CAROLINA', color: '#1f3f8f', font: 'block', pos: 'bottom' }, slogan: { text: 'FIRST IN FLIGHT', color: '#c8102e' },
    art: `<g fill="none" stroke="#a9c6e8" stroke-width="1.6" opacity=".9" transform="rotate(-8 100 50)"><path d="M70 46 h60 M70 54 h60 M80 46 v8 M100 46 v8 M120 46 v8 M130 50 h12 l4 -3 v6 l-4 -3"/></g><path d="M0 80 Q100 70 200 80 V84 H0Z" fill="#efe3c2"/>` },
  'North Dakota': { bg: sky('#9cc9e8 0%', '#fbe2b8 50%', '#f4a259 66%', '#f7d55c 80%'), ink: '#000', name: { text: 'NORTH DAKOTA', color: '#b94f12', font: 'block' }, slogan: { text: 'LEGENDARY', color: '#ffffff' },
    art: `<circle cx="140" cy="66" r="8" fill="#ffe680"/>` + ridge('0 84 L14 78 L30 80 L42 74 L56 78 L70 72 L90 80 L110 76 L130 82 L150 76 L170 80 L200 78', '#8a5530') + `<path d="M168 78 q4 -7 12 -6 q6 0 7 4 v4 h-3 v-3 h-12 v3 h-3z" fill="#3b2414"/>` },
  'Ohio': { bg: sky('#cfe3f5 0%', '#ffffff 52%', '#f6c25b 78%'), ink: '#1b2f6b', name: { text: 'OHIO', color: '#1b2f6b', font: 'block' }, slogan: { text: 'BIRTHPLACE OF AVIATION', color: '#ffffff' },
    art: `<path d="M0 80 Q40 70 80 78 T160 74 T200 78 V86 H0Z" fill="#6fa64a"/><path d="M0 82 Q60 78 120 84 T200 82 V84 H0Z" fill="#4a90c8"/><g fill="#8aa0b8">${[[150, 66], [156, 60], [162, 64], [168, 58]].map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="${76 - y}"/>`).join('')}</g><rect x="0" y="86" width="200" height="14" fill="#c8102e"/>` },
  'Oklahoma': { bg: '#c8102e', ink: '#ffffff', name: { text: 'OKLAHOMA', color: '#ffffff', font: 'block' }, slogan: { text: 'IMAGINE THAT', color: '#ffffff' },
    art: `<g fill="#6b8fd8" opacity=".9">${Array.from({ length: 12 }, (_, i) => i % 3 === 0 ? `<path d="M${10 + i * 16} 84 l4 -8 l4 8z"/>` : i % 3 === 1 ? `<rect x="${10 + i * 16}" y="77" width="7" height="7"/>` : `<circle cx="${14 + i * 16}" cy="80" r="4"/>`).join('')}</g><path d="M176 14 a6 6 0 1 0 6 8 a5 5 0 1 1 -6 -8z" fill="#fff" opacity=".8"/>` },
  'Oregon': { bg: sky('#bcd9ef 0%', '#ffffff 62%'), ink: '#1b2f6b', name: { text: 'OREGON', color: '#1b2f6b', font: 'block' }, slogan: null,
    art: ridge('0 76 L24 64 L44 72 L66 56 L88 70 L110 60 L134 72 L156 58 L178 68 L200 62', '#cbb8dd', 84) + tree(100, 70, 30, '#1f5a32') + `<rect x="98.5" y="70" width="3" height="6" fill="#4a3017"/>` },
  'Pennsylvania': { bg: '#f5f0e1', ink: '#1b2f6b', name: { text: 'PENNSYLVANIA', color: '#c8102e', font: 'block' }, slogan: { text: 'Let Freedom Ring', color: '#c8102e', font: 'script' },
    art: `<g fill="#8f8a80" opacity=".3"><rect x="97" y="30" width="6" height="5"/><path d="M90 36 q10 -6 20 0 l3 26 q-13 4 -26 0z"/></g>` },
  'Rhode Island': { bg: '#a9d4ee', ink: '#1b2a5c', name: { text: 'RHODE ISLAND', color: '#1b2a5c', font: 'block' }, slogan: { text: 'Ocean State', color: '#1b2a5c', font: 'script' },
    art: wave(70, '#5d9fd0', 2) + wave(74, '#4a8cc4', 2) + wave(78, '#3a78b4', 2) + wave(82, '#2c64a0', 2) + `<g fill="none" stroke="#1b2a5c" stroke-width="1.6"><path d="M36 24 v14 M31 28 h10 M29 34 q7 8 14 0"/><circle cx="36" cy="22" r="2"/></g>` },
  'South Carolina': { bg: '#ffffff', ink: '#000', name: { text: 'SOUTH CAROLINA', color: '#1b2f6b', font: 'block', pos: 'bottom' }, slogan: { text: 'WHERE THE REVOLUTIONARY WAR WAS WON', color: '#1b2f6b' },
    art: `<rect x="10" y="20" width="180" height="1.4" fill="#c8102e"/><rect x="6" y="30" width="28" height="40" fill="#1b2f6b"/><path d="M20 38 a6 6 0 1 0 6 6 a4.5 4.5 0 1 1 -6 -6z" fill="#fff"/>` },
  'South Dakota': { bg: sky('#6fa8dc 0%', '#bcd6ee 46%', '#d9c7a5 56%', '#b8a582 100%'), ink: '#000', name: { text: 'SOUTH DAKOTA', color: '#1b2f6b', font: 'block' }, slogan: { text: 'Great Faces. Great Places.', color: '#1b2f6b', font: 'serif' },
    art: [[64, 64], [86, 62], [110, 66], [132, 64]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="11" fill="#9d9584"/><ellipse cx="${x}" cy="${y - 2}" rx="5" ry="6" fill="#b3ab99"/>`).join('') },
  'Tennessee': { bg: '#1f4e9c', ink: '#ffffff', name: { text: 'TENNESSEE', color: '#ffffff', font: 'block' }, slogan: { text: 'THE VOLUNTEER STATE', color: '#ffffff' },
    art: `<path d="M56 4 L150 4 L148 10 L152 20 L52 20 L54 12Z" fill="none" stroke="#fff" stroke-width="1"/>` },
  'Texas': { bg: '#ffffff', ink: '#000', name: { text: 'TEXAS', color: '#000', font: 'block' }, slogan: { text: 'THE LONE STAR STATE', color: '#000' },
    art: `<path d="M66 6 l1.8 5 h5.2 l-4.2 3.1 l1.6 5 l-4.4 -3.1 l-4.4 3.1 l1.6 -5 l-4.2 -3.1 h5.2z" fill="#000"/>` },
  'Utah': { bg: sky('#9cc5e6 0%', '#e8f2fa 50%', '#ffffff 66%'), ink: '#1b2f6b', name: { text: 'UTAH', color: '#1b2f6b', font: 'block' }, slogan: { text: 'GREATEST SNOW ON EARTH', color: '#1b2f6b' },
    art: ridge('0 74 L22 58 L40 68 L62 50 L84 66 L104 54 L126 70 L150 52 L172 66 L200 56', '#d6e3ee', 86) + `<path d="M158 60 l4 -4 l3 2 l-3 4 l6 3" fill="none" stroke="#1b2f6b" stroke-width="1.4"/><circle cx="161" cy="54" r="1.6" fill="#1b2f6b"/>` },
  'Vermont': { bg: '#1e6b3a', ink: '#ffffff', rim: '#ffffff', name: { text: 'VERMONT', color: '#ffffff', font: 'block' }, slogan: { text: 'GREEN MOUNTAIN STATE', color: '#ffffff' },
    art: tree(56, 15, 9, '#ffffff') + tree(56, 20, 9, '#ffffff') },
  'Virginia': { bg: '#ffffff', ink: '#1b2f6b', name: { text: 'VIRGINIA', color: '#1b2f6b', font: 'serif' }, slogan: { text: 'VIRGINIA IS FOR LOVERS', color: '#000' } },
  'Washington': { bg: '#ffffff', ink: '#1b2a5c', name: { text: 'WASHINGTON', color: '#c8102e', font: 'block' }, slogan: { text: 'EVERGREEN STATE', color: '#c8102e' },
    art: `<path d="M30 80 L80 46 L92 36 L100 32 L110 38 L122 48 L170 80Z" fill="#bcd7ee" opacity=".7"/><path d="M88 39 L100 32 L112 40 L104 42 L98 38 L92 42Z" fill="#fff"/>` },
  'West Virginia': { bg: 'linear-gradient(180deg, #1b2f6b 0 22%, #e2b33c 22% 25%, #ffffff 25%)', ink: '#1b2f6b', name: { text: 'West Virginia', color: '#e2b33c', font: 'sans' }, slogan: { text: 'Wild, Wonderful', color: '#1b2f6b', font: 'script' } },
  'Wisconsin': { bg: '#ffffff', ink: '#000', name: { text: 'WISCONSIN', color: '#000', font: 'block' }, slogan: { text: "AMERICA'S DAIRYLAND", color: '#000' },
    art: `<circle cx="160" cy="34" r="9" fill="#f4a259" opacity=".85"/><rect x="138" y="40" width="50" height="6" fill="#5d9fd0" opacity=".7"/><path d="M158 39 v-12 l7 12z" fill="#fff" stroke="#9ab" stroke-width=".5"/><g fill="#b23a2a"><rect x="14" y="34" width="16" height="12"/><path d="M12 34 l10 -7 l10 7z"/></g><path d="M60 26 l4 2 l4 -2 M72 22 l4 2 l4 -2" fill="none" stroke="#555" stroke-width="1"/>` },
  'Wyoming': { bg: sky('#1b2a5c 0%', '#2c3f78 60%', '#9ea3a8 100%'), ink: '#ffffff', rim: '#c8102e', name: { text: 'WYOMING', color: '#1b2a5c', font: 'block', outline: '#ffffff' }, slogan: { text: "That's WY", color: '#ffffff', font: 'script' },
    art: `<path d="M10 72 l6 -10 l8 -2 l6 -8 l4 2 l-2 6 l6 4 l-2 10 l-4 -6 l-8 2 l-4 6z M24 52 l2 -6 l3 1 l-1 6z" fill="#c9ced3" opacity=".85"/>` },
  'Puerto Rico': { bg: '#ffffff', ink: '#000', name: { text: 'PUERTO RICO', color: '#1b2f6b', font: 'block' }, slogan: { text: 'Isla del Encanto', color: '#c8102e', font: 'script' },
    art: `<g fill="#c9b79a" opacity=".85"><rect x="14" y="52" width="16" height="24"/><path d="M12 52 q10 -14 20 0z"/><rect x="21" y="38" width="2" height="4"/></g><rect x="19" y="60" width="6" height="8" fill="#5a4a33" opacity=".7"/>` },
  'U.S. Virgin Islands': { bg: 'linear-gradient(180deg, #1a9a9a 0 24%, #ffffff 24% 78%, #e0a526 78%)', ink: '#000', name: { text: 'U.S. VIRGIN ISLANDS', color: '#ffffff', font: 'block' }, slogan: { text: '175TH EMANCIPATION', color: '#000' },
    art: `<circle cx="100" cy="52" r="10" fill="none" stroke="#1a9a9a" stroke-width="1.6" opacity=".6"/>` },
  'American Samoa': { bg: sky('#7fc4e8 0%', '#e9f5fb 50%', '#3a8fc0 70%', '#1f6b9a 100%'), ink: '#000', name: { text: 'AMERICAN SAMOA', color: '#1b2f6b', font: 'block' }, slogan: { text: 'Motu O Fiafiaga', color: '#ffffff', font: 'script' },
    art: `<path d="M150 72 L152 50 L158 42 L166 44 L170 56 L172 72Z" fill="#6b5a3e"/><path d="M152 50 q8 -10 16 -4 q-4 -6 -10 -6z" fill="#3f7a35"/>` },
  'Northern Mariana Islands': { bg: '#ffffff', ink: '#1b2f6b', name: { text: 'C.N.M.I.-U.S.A.', color: '#1b2f6b', font: 'block', pos: 'bottom' }, slogan: { text: 'HAFA ADAI', color: '#1b2f6b' },
    art: `<circle cx="100" cy="52" r="11" fill="#2a6fb8"/><g fill="#fff"><rect x="98" y="50" width="4" height="9"/><path d="M95 50 q5 -4 10 0z"/><path d="M100 42 l1 2.4 h2.5 l-2 1.5 l.8 2.4 l-2.3 -1.5 l-2.3 1.5 l.8 -2.4 l-2 -1.5 h2.5z"/></g>` },
});
// nicknames for plates whose real slogan is a county name or nothing at all
const NICK = {"Alabama":"Heart of Dixie","Alaska":"The Last Frontier","Arizona":"Grand Canyon State","Arkansas":"The Natural State","California":"The Golden State","Colorado":"Centennial State","Connecticut":"Constitution State","Delaware":"The First State","District of Columbia":"Taxation Without Representation","Florida":"Sunshine State","Georgia":"Peach State","Guam":"Hub of the Pacific","Hawaii":"Aloha State","Idaho":"Famous Potatoes","Illinois":"Land of Lincoln","Indiana":"Crossroads of America","Iowa":"Hawkeye State","Kansas":"Sunflower State","Kentucky":"Bluegrass State","Louisiana":"Sportsman's Paradise","Maine":"Vacationland","Maryland":"Old Line State","Massachusetts":"The Spirit of America","Michigan":"Great Lakes State","Minnesota":"10,000 Lakes","Mississippi":"Magnolia State","Missouri":"Show-Me State","Montana":"Treasure State","Nebraska":"Cornhusker State","Nevada":"Silver State","New Hampshire":"Live Free or Die","New Jersey":"Garden State","New Mexico":"Land of Enchantment","New York":"The Empire State","North Carolina":"First in Flight","North Dakota":"Peace Garden State","Ohio":"Birthplace of Aviation","Oklahoma":"Native America","Oregon":"Beaver State","Pennsylvania":"Keystone State","Rhode Island":"Ocean State","South Carolina":"Palmetto State","South Dakota":"Great Faces. Great Places.","Tennessee":"Volunteer State","Texas":"The Lone Star State","Utah":"Life Elevated","Vermont":"Green Mountain State","Virginia":"Old Dominion","Washington":"Evergreen State","West Virginia":"Wild, Wonderful","Wisconsin":"America's Dairyland","Wyoming":"Equality State","Puerto Rico":"Isla del Encanto","U.S. Virgin Islands":"American Paradise","American Samoa":"Motu o Fiafiaga","Northern Mariana Islands":"Hafa Adai"};
for (const k of Object.keys(S)) {
  const L = S[k];
  if (!L.slogan || L.slogan.text == null) L.slogan = { color: (L.slogan && L.slogan.color) || L.ink, ...(L.slogan || {}), text: (NICK[k] || '').toUpperCase() };
}
root.STATE_STYLES = Object.assign(root.STATE_STYLES || {}, S);
root.PLATE_ART = { tree, forest, ridge, wave, sky };
})(this);
