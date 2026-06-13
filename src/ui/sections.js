import { STATES } from '../core/Director.js';

/**
 * Section content. Placeholder copy throughout — structured so real data
 * (lineups, dates, tracklists) drops straight in. Each section renders to
 * a panel that fades in over the canvas when its state is active.
 */
const CONTENT = {
  [STATES.NEXT_EVENT]: {
    eyebrow: 'Next Event',
    title: 'Volume 909',
    lede: 'Le Charleston — a historic Marrakech cabaret, transformed into ROOM 909 for one night. VOID Acoustics, full production and lighting, until sunrise.',
    meta: [
      ['Date', 'Sat 12 Sep 2026 · 23:00'],
      ['Venue', 'Le Charleston · Historic Cabaret'],
      ['Location', 'Marrakech'],
      ['Sound', 'VOID Acoustics · Full Range'],
      ['Production', 'Lighting · Full Stage Build'],
      ['Format', 'Analog · 909 In The Room']
    ],
    cta: ['Get Tickets', 'https://shotgun.live/'] // TODO: real ticket link
  },
  [STATES.LINEUP]: {
    eyebrow: 'Lineup',
    title: 'Lineup',
    lede: 'The bill for Volume 909. Move across a name.',
    lineup: [
      {
        name: 'FRAUSARP',
        time: '23:00 — 01:30',
        initials: 'FR',
        photo: '/frausarp.jpg',
        bio: 'Opens the room. Patient, hypnotic builds that set the night in motion before the close.',
        links: []
      },
      {
        name: 'HASHASHIN',
        time: '01:30 — SUNRISE',
        initials: 'HK',
        photo: '/hashashin.jpg',
        bio: 'Headline close. Hardware-driven, hypnotic techno held all the way to the lights coming up.',
        links: [['SoundCloud', 'https://soundcloud.com/hashashin_kawasaki']]
      }
    ]
  },
  [STATES.CONTACT]: {
    eyebrow: 'Contact',
    title: 'Say Less',
    lede: 'Bookings, guestlist, press.',
    meta: [
      ['Email', 'ROOM909@MARRAKECH.NET'],
      ['Instagram', '@ROOM909'],
      ['Press', 'PRESS@ROOM909.NET']
    ],
    cta: ['Open Mail', 'mailto:room909@marrakech.net']
  }
};

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/**
 * A deterministic mini-mosaic "portrait" in the site's own language —
 * a grid of palette cells seeded from the artist name, with their
 * initials resolving out of the tiles. Stands in for photography until
 * real shots exist, and will read on-brand even next to them.
 */
const MOSAIC_PALETTE = [
  ['#141210', 46], // charcoal — most of the frame
  ['#23170f', 22], // charcoal warmed
  ['#732103', 18], // rust midtone
  ['#a23a06', 8], //  rust -> ember
  ['#ff5c00', 4], //  ember sparks
  ['#efe9dc', 2] //  rare cream highlight
];

function makeMosaic(seedStr, initials, cols = 16, rows = 10) {
  // tiny deterministic hash so the same artist always gets the same tiles
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };

  const total = MOSAIC_PALETTE.reduce((s, [, w]) => s + w, 0);
  const mosaic = el('div', 'mosaic');
  mosaic.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const count = cols * rows;
  for (let i = 0; i < count; i++) {
    let pick = rand() * total;
    let color = MOSAIC_PALETTE[0][0];
    for (const [c, w] of MOSAIC_PALETTE) {
      pick -= w;
      if (pick <= 0) {
        color = c;
        break;
      }
    }
    const cell = el('i');
    cell.style.background = color;
    // resolve in from a random tile, not row by row — feels like the
    // scene's own mosaic snapping into focus
    cell.style.animationDelay = `${(rand() * 0.45).toFixed(3)}s`;
    mosaic.appendChild(cell);
  }
  mosaic.appendChild(el('span', 'init', initials));
  return mosaic;
}

/**
 * Artist portrait, rendered in the site's own language: the photo is
 * rebuilt as a grid of "9" / "0" glyphs coloured by brightness in the brand
 * palette (charcoal → rust → ember → cream), resolving in cell by cell —
 * inspired by 909.nl but in ROOM 909's particle idiom. Falls back to the
 * generated mosaic if no photo is set or it fails to load.
 */
const PORTRAIT_COLS = 80;
const PORTRAIT_ROWS = 50;
const PORTRAIT_CELL = 13;

function portraitColor(l) {
  // luminance 0..1 → brand palette
  if (l < 0.1) return null; //              charcoal — leave as background
  if (l < 0.26) return '#3a1606'; //        deep rust
  if (l < 0.44) return '#732103'; //        rust
  if (l < 0.62) return '#b23c06'; //        rust → ember
  if (l < 0.8) return '#ff5c00'; //         ember
  return '#efe9dc'; //                      cream highlight
}

function makePortrait(a) {
  if (!a.photo) return makeMosaic(a.name, a.initials);

  const wrap = el('div', 'portrait');
  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_COLS * PORTRAIT_CELL;
  canvas.height = PORTRAIT_ROWS * PORTRAIT_CELL;
  wrap.appendChild(canvas);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.addEventListener('error', () => wrap.replaceWith(makeMosaic(a.name, a.initials)));
  img.addEventListener('load', () => {
    try {
      renderGlyphPortrait(canvas, img);
    } catch (_) {
      wrap.replaceWith(makeMosaic(a.name, a.initials));
    }
  });
  img.src = a.photo;
  return wrap;
}

function renderGlyphPortrait(canvas, img) {
  const cols = PORTRAIT_COLS;
  const rows = PORTRAIT_ROWS;
  const cell = PORTRAIT_CELL;

  // downsample the photo (object-fit: cover) into cols x rows
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sg = small.getContext('2d');
  const ar = img.width / img.height;
  const target = cols / rows;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ar > target) {
    sw = img.height * target;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / target;
    sy = (img.height - sh) / 2;
  }
  sg.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  const data = sg.getImageData(0, 0, cols, rows).data;

  // build the visible cell list (skip near-black so the face floats)
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const color = portraitColor(l);
      if (!color) continue;
      const ch = (x * 7 + y * 13 + Math.round(l * 9)) % 3 === 0 ? '0' : '9';
      cells.push({ x, y, color, ch, ord: Math.random() });
    }
  }

  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${cell}px "Share Tech Mono", ui-monospace, monospace`;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = 700;
  const start = performance.now();

  const frame = (now) => {
    const p = reduced ? 1 : Math.min(1, (now - start) / dur);
    ctx.fillStyle = '#141210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const c of cells) {
      if (c.ord > p) continue; // staggered resolve
      ctx.fillStyle = c.color;
      ctx.fillText(c.ch, (c.x + 0.5) * cell, (c.y + 0.5) * cell);
    }
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * The lineup: not a tooltip box. A list of names on the left; moving across
 * (or focusing) a name resolves that artist's mosaic portrait, bio and
 * links into a full bleed "stage" on the right — the tiles snap into focus
 * the way the background does under the cursor.
 */
function buildLineup(data) {
  const wrap = el('div', 'lineup');
  const names = el('ul', 'lineup-names');
  const stage = el('div', 'lineup-stage');
  stage.setAttribute('aria-live', 'polite');

  const count = data.lineup.length;
  let index = 0;
  const buttons = [];

  const render = (i) => {
    const a = data.lineup[i];
    stage.innerHTML = '';
    stage.appendChild(makePortrait(a));

    const text = el('div', 'stage-text');
    text.appendChild(el('div', 'stage-name', a.name));
    text.appendChild(el('div', 'stage-time', a.time));
    text.appendChild(el('p', 'stage-bio', a.bio));
    if (a.links.length) {
      const links = el('div', 'stage-links');
      for (const [label, href] of a.links) {
        const link = el('a', null, label);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.appendChild(link);
      }
      text.appendChild(links);
    }
    stage.appendChild(text);

    // prev / next controls — the way to move between artists on mobile
    const ctl = el('div', 'stage-ctl');
    const prev = el('button', 'stage-arrow', '‹');
    const next = el('button', 'stage-arrow', '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Previous artist');
    next.setAttribute('aria-label', 'Next artist');
    prev.addEventListener('click', () => setActive(index - 1));
    next.addEventListener('click', () => setActive(index + 1));
    ctl.appendChild(prev);
    ctl.appendChild(el('span', 'stage-count', `${String(i + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`));
    ctl.appendChild(next);
    stage.appendChild(ctl);

    // restart the resolve animation
    stage.classList.remove('resolve');
    void stage.offsetWidth;
    stage.classList.add('resolve');
  };

  const setActive = (i) => {
    index = ((i % count) + count) % count; // wrap both directions
    buttons.forEach((b, j) => b.setAttribute('aria-current', String(j === index)));
    render(index);
  };

  data.lineup.forEach((artist, i) => {
    const li = el('li');
    const btn = el('button', 'lineup-name', artist.name);
    btn.type = 'button';
    btn.appendChild(el('span', 'lineup-time', artist.time));
    btn.addEventListener('mouseenter', () => setActive(i));
    btn.addEventListener('focus', () => setActive(i));
    btn.addEventListener('click', () => setActive(i));
    buttons.push(btn);
    li.appendChild(btn);
    names.appendChild(li);
  });

  // horizontal swipe on the stage steps between artists (touch)
  let sx = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0] ? e.touches[0].clientX : null; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : sx) - sx;
    if (Math.abs(dx) > 45) setActive(index + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

  wrap.appendChild(names);
  wrap.appendChild(stage);
  setActive(0);
  return wrap;
}

function buildPanel(state, data) {
  const sec = el('section', 'section');
  sec.id = `section-${state}`;
  sec.setAttribute('role', 'region');
  sec.setAttribute('aria-label', data.eyebrow);
  sec.setAttribute('tabindex', '-1');

  sec.appendChild(el('div', 'eyebrow', data.eyebrow));
  sec.appendChild(el('h1', null, data.title));
  if (data.lede) sec.appendChild(el('p', 'lede', data.lede));

  if (data.meta) {
    const dl = el('dl', 'meta');
    for (const [k, v] of data.meta) {
      dl.appendChild(el('dt', null, k));
      dl.appendChild(el('dd', null, v));
    }
    sec.appendChild(dl);
  }

  if (data.lineup) sec.appendChild(buildLineup(data));

  if (data.cta) {
    // [label, href] -> link; plain string -> button
    if (Array.isArray(data.cta)) {
      const a = el('a', 'cta', data.cta[0]);
      a.href = data.cta[1];
      if (!data.cta[1].startsWith('mailto:')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      sec.appendChild(a);
    } else {
      const b = el('button', 'cta', data.cta);
      b.type = 'button';
      sec.appendChild(b);
    }
  }

  return sec;
}

/**
 * Build all section panels, append to root, and return a controller that
 * shows exactly one (or none) based on Director state. Pure CSS-class
 * driven (.active) — visibility is real, not display:none.
 */
export function buildSections(root) {
  const panels = new Map();
  for (const [state, data] of Object.entries(CONTENT)) {
    const panel = buildPanel(state, data);
    root.appendChild(panel);
    panels.set(state, panel);
  }

  return {
    show(state) {
      for (const [s, panel] of panels) {
        const active = s === state;
        panel.classList.toggle('active', active);
        if (active) {
          // move focus into the section for keyboard users
          requestAnimationFrame(() => panel.focus({ preventScroll: true }));
        }
      }
    }
  };
}
