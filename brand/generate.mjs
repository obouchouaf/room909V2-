/**
 * ROOM 909 — social identity template generator.
 *
 * Builds SVG templates straight from the website's visual language: the
 * charcoal field, the ember 909, the tile mosaic, the 16-step sequencer,
 * wide-tracked Share Tech Mono, the coordinates. Pure string building, no
 * dependencies. SVGs export to PNG with any tool (or open in a browser and
 * screenshot at 2x). Edit the CONTENT block and re-run:  node generate.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OUT, { recursive: true });

// ---- locked brand ----------------------------------------------------
const C = {
  charcoal: '#141210',
  charcoalWarm: '#23170f',
  cream: '#efe9dc',
  ember: '#ff5c00',
  rust: '#732103',
  rustEmber: '#a23a06',
  dim: 'rgba(239,233,220,0.55)',
  line: 'rgba(239,233,220,0.22)'
};
const FONT = `'Share Tech Mono', ui-monospace, monospace`;

// editable content — change these, re-run
const CONTENT = {
  presents: 'ROOM 909 PRESENTS',
  title: 'VOLUME 909',
  date: '12 SEP 2026',
  venue: 'LE CHARLESTON',
  city: 'MARRAKECH',
  lineup: ['HASHASHIN', 'FRAUSARP'],
  sound: 'VOID ACOUSTICS',
  coords: '31.62°N 7.99°W',
  tag: 'RHYTHM COMPOSER',
  cta: 'TICKETS · SHOTGUN'
};

// ---- helpers ---------------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [
  [C.charcoal, 46],
  [C.charcoalWarm, 24],
  [C.rust, 16],
  [C.rustEmber, 8],
  [C.ember, 4],
  [C.cream, 2]
];
const PAL_TOTAL = PALETTE.reduce((s, [, w]) => s + w, 0);

/** a block of mosaic tiles (the signature texture). */
function mosaic(x, y, w, h, cols, rows, seed, { gap = 2, opacity = 1 } = {}) {
  const rnd = mulberry32(seed);
  const tw = w / cols;
  const th = h / rows;
  let out = `<g opacity="${opacity}">`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let pick = rnd() * PAL_TOTAL;
      let color = PALETTE[0][0];
      for (const [col, wt] of PALETTE) {
        pick -= wt;
        if (pick <= 0) {
          color = col;
          break;
        }
      }
      const jx = (rnd() - 0.5) * 1.5;
      const jy = (rnd() - 0.5) * 1.5;
      out += `<rect x="${(x + c * tw + gap / 2 + jx).toFixed(1)}" y="${(y + r * th + gap / 2 + jy).toFixed(1)}" width="${(tw - gap).toFixed(1)}" height="${(th - gap).toFixed(1)}" fill="${color}" rx="1"/>`;
    }
  }
  return out + '</g>';
}

/** the 16-step sequencer row (4 accents lit). */
function sequencer(x, y, cell, gap, lit = 0) {
  let out = '<g>';
  for (let i = 0; i < 16; i++) {
    const on = i === lit;
    const accent = i % 4 === 0;
    const fill = on ? C.ember : 'none';
    const stroke = on || accent ? C.ember : C.line;
    out += `<rect x="${x + i * (cell + gap)}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
  }
  return out + '</g>';
}

function text(x, y, s, { size = 24, color = C.cream, ls = 6, anchor = 'start', weight = 'normal' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" letter-spacing="${ls}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}" style="text-transform:uppercase">${s}</text>`;
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<style>@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&amp;display=swap');</style>
<radialGradient id="vig" cx="50%" cy="42%" r="75%">
<stop offset="55%" stop-color="${C.charcoal}" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
</radialGradient>
<linearGradient id="emberGlow" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${C.ember}" stop-opacity="0.0"/>
<stop offset="100%" stop-color="${C.ember}" stop-opacity="0.18"/>
</linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="${C.charcoal}"/>
${body}
<rect width="${w}" height="${h}" fill="url(#vig)"/>
</svg>`;
}

// big 909 watermark with a soft ember glow
function bigNine(x, y, size, opacity = 1) {
  return `<g opacity="${opacity}" filter="url(#none)">
<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" letter-spacing="${size * 0.06}" fill="${C.ember}" text-anchor="middle" style="text-transform:uppercase">909</text></g>`;
}

// ---- templates -------------------------------------------------------

// 1) PROFILE / AVATAR — 1080×1080, minimal, legible small
function profile() {
  const W = 1080;
  let b = '';
  b += mosaic(0, 0, W, W, 18, 18, 11, { opacity: 0.16 });
  b += `<rect width="${W}" height="${W}" fill="url(#emberGlow)"/>`;
  b += text(W / 2, 430, 'ROOM', { size: 96, color: C.cream, ls: 40, anchor: 'middle' });
  b += bigNine(W / 2, 760, 360);
  b += text(W / 2, 880, CONTENT.city, { size: 34, color: C.dim, ls: 22, anchor: 'middle' });
  return svg(W, W, b);
}

// 2) POST — 1080×1080 event announcement
function post() {
  const W = 1080;
  let b = '';
  // mosaic texture down the right third, faint 909 inside it
  b += mosaic(640, 0, 440, W, 14, 30, 7, { opacity: 0.9 });
  b += `<rect x="640" y="0" width="440" height="${W}" fill="${C.charcoal}" opacity="0.35"/>`;
  b += bigNine(860, 620, 300, 0.5);

  b += text(96, 150, CONTENT.presents, { size: 26, color: C.ember, ls: 12 });
  b += text(96, 330, CONTENT.title, { size: 92, color: C.cream, ls: 6 });
  b += `<line x1="96" y1="372" x2="560" y2="372" stroke="${C.ember}" stroke-width="2"/>`;
  b += text(96, 470, CONTENT.date, { size: 76, color: C.ember, ls: 4 });
  b += text(96, 540, `${CONTENT.venue} · ${CONTENT.city}`, { size: 30, color: C.cream, ls: 8 });

  b += text(96, 680, 'LINE-UP', { size: 22, color: C.ember, ls: 12 });
  b += text(96, 740, CONTENT.lineup.join('   ·   '), { size: 44, color: C.cream, ls: 6 });
  b += text(96, 800, `SOUND · ${CONTENT.sound}`, { size: 24, color: C.dim, ls: 8 });

  b += sequencer(96, 900, 28, 8, 0);
  b += text(96, 1010, `${CONTENT.coords}  ·  ${CONTENT.tag}`, { size: 22, color: C.dim, ls: 8 });
  return svg(W, W, b);
}

// 3) STORY — 1080×1920 vertical
function story() {
  const W = 1080;
  const H = 1920;
  let b = '';
  b += mosaic(0, 1180, W, 740, 22, 16, 23, { opacity: 0.9 });
  b += `<rect x="0" y="1180" width="${W}" height="740" fill="${C.charcoal}" opacity="0.4"/>`;
  b += bigNine(W / 2, 1560, 460, 0.45);

  b += text(W / 2, 360, CONTENT.presents, { size: 30, color: C.ember, ls: 14, anchor: 'middle' });
  b += text(W / 2, 560, CONTENT.title, { size: 120, color: C.cream, ls: 6, anchor: 'middle' });
  b += `<line x1="${W / 2 - 230}" y1="610" x2="${W / 2 + 230}" y2="610" stroke="${C.ember}" stroke-width="2"/>`;
  b += text(W / 2, 760, CONTENT.date, { size: 96, color: C.ember, ls: 4, anchor: 'middle' });
  b += text(W / 2, 840, `${CONTENT.venue} · ${CONTENT.city}`, { size: 34, color: C.cream, ls: 10, anchor: 'middle' });
  b += text(W / 2, 1000, CONTENT.lineup.join('   ·   '), { size: 52, color: C.cream, ls: 6, anchor: 'middle' });
  b += text(W / 2, 1070, `SOUND · ${CONTENT.sound}`, { size: 28, color: C.dim, ls: 10, anchor: 'middle' });
  b += sequencer(W / 2 - (16 * 36 - 8) / 2, 1140, 28, 8, 0);

  b += text(W / 2, 1820, CONTENT.cta, { size: 30, color: C.ember, ls: 12, anchor: 'middle' });
  b += text(W / 2, 1870, CONTENT.coords, { size: 22, color: C.dim, ls: 10, anchor: 'middle' });
  return svg(W, H, b);
}

// 4) ARTIST CARD — 1080×1350 (IG portrait)
function artist(name, slot, handle, seed) {
  const W = 1080;
  const H = 1350;
  let b = '';
  // portrait zone: mosaic stands in for the glyph-photo on the site
  b += mosaic(140, 170, 800, 640, 40, 32, seed, { gap: 3, opacity: 1 });
  b += `<rect x="140" y="170" width="800" height="640" fill="none" stroke="${C.line}" stroke-width="1.5"/>`;
  b += `<rect x="140" y="170" width="800" height="640" fill="url(#emberGlow)"/>`;

  b += text(96, 120, 'LINE-UP · ROOM 909', { size: 24, color: C.ember, ls: 12 });
  b += text(96, 940, name, { size: 92, color: C.cream, ls: 4 });
  b += `<line x1="96" y1="985" x2="520" y2="985" stroke="${C.ember}" stroke-width="2"/>`;
  b += text(96, 1060, slot, { size: 34, color: C.ember, ls: 8 });
  b += text(96, 1120, handle, { size: 28, color: C.dim, ls: 6 });
  b += sequencer(96, 1200, 26, 8, 0);
  b += text(96, 1300, `${CONTENT.venue} · ${CONTENT.date}`, { size: 24, color: C.dim, ls: 8 });
  return svg(W, H, b);
}

// 5) SWATCHES — palette + type reference
function swatches() {
  const W = 1080;
  const H = 1080;
  let b = text(96, 130, 'ROOM 909 · IDENTITY', { size: 34, color: C.cream, ls: 10 });
  const items = [
    ['CHARCOAL', C.charcoal, '#141210'],
    ['CREAM', C.cream, '#EFE9DC'],
    ['EMBER', C.ember, '#FF5C00'],
    ['RUST', C.rust, '#732103']
  ];
  items.forEach(([n, c, hex], i) => {
    const y = 200 + i * 180;
    b += `<rect x="96" y="${y}" width="300" height="150" fill="${c}" stroke="${C.line}"/>`;
    b += text(430, y + 70, n, { size: 40, color: C.cream, ls: 8 });
    b += text(430, y + 120, hex, { size: 28, color: C.ember, ls: 6 });
  });
  b += text(96, 1010, 'SHARE TECH MONO · UPPERCASE · WIDE TRACKING', { size: 24, color: C.dim, ls: 8 });
  return svg(W, H, b);
}

// ---- write -----------------------------------------------------------
const files = {
  'profile-1080.svg': profile(),
  'post-1080.svg': post(),
  'story-1080x1920.svg': story(),
  'artist-hashashin-1080x1350.svg': artist('HASHASHIN', '01:30 — SUNRISE', 'soundcloud.com/hashashin_kawasaki', 41),
  'artist-frausarp-1080x1350.svg': artist('FRAUSARP', '23:00 — 01:30', '@frausarp', 73),
  'swatches-1080.svg': swatches()
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), data);
  console.log('wrote', name);
}
