import { STATES } from '../core/Director.js';

/**
 * Section content. Placeholder copy throughout — structured so real data
 * (lineups, dates, tracklists) drops straight in. Each section renders to
 * a panel that fades in over the canvas when its state is active.
 */
const CONTENT = {
  [STATES.NEXT_EVENT]: {
    eyebrow: 'Next Event',
    title: 'Volume 808',
    lede: 'Le Charleston — a historic Marrakech cabaret, transformed into ROOM 808 for one night. VOID Acoustics, full production and lighting, until sunrise.',
    meta: [
      ['Date', 'Sat 12 Sep 2026 · 23:00'],
      ['Venue', 'Le Charleston · Historic Cabaret'],
      ['Location', 'Marrakech'],
      ['Sound', 'VOID Acoustics · Full Range'],
      ['Production', 'Lighting · Full Stage Build'],
      ['Format', 'Analog · 808 In The Room']
    ],
    cta: ['Get Tickets', 'https://shotgun.live/'] // TODO: real ticket link
  },
  [STATES.LINEUP]: {
    eyebrow: 'Lineup',
    title: 'Lineup',
    lede: 'The bill for Volume 808. Move across a name.',
    lineup: [
      {
        name: 'FRAUSARP',
        time: '23:00 — 01:30',
        tag: 'OPEN',
        initials: 'FR',
        photo: '/frausarp.jpg',
        bio: 'Opens the room. Patient, hypnotic builds that set the night in motion before the close.',
        links: []
      },
      {
        name: 'HASHASHIN',
        time: '01:30 — SUNRISE',
        tag: 'CLOSE',
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
      ['Email', 'ROOM808@MARRAKECH.NET'],
      ['Instagram', '@ROOM808'],
      ['Press', 'PRESS@ROOM808.NET']
    ],
    cta: ['Open Mail', 'mailto:room808@marrakech.net']
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
 * rebuilt as a grid of palette-toned particle tiles (charcoal → rust →
 * ember → cream), near-black left as background so the face floats. The
 * tiles resolve in, breathe with a subtle idle shimmer, and respond to the
 * cursor exactly like the home-page grid — clean image, live particles.
 */
const PORTRAIT_COLS = 104;
const PORTRAIT_ROWS = 66;
const PORTRAIT_CELL = 10;

// luminance 0..1 → an interpolated point along the brand ramp
const PORTRAIT_RAMP = [
  [0.0, [20, 18, 16]], //   charcoal
  [0.32, [60, 18, 4]], //   rust
  [0.52, [150, 46, 6]], //  rust → ember
  [0.74, [255, 92, 0]], //  ember
  [1.0, [239, 233, 220]] // cream
];
function rampColor(l) {
  for (let i = 1; i < PORTRAIT_RAMP.length; i++) {
    if (l <= PORTRAIT_RAMP[i][0]) {
      const [a0, c0] = PORTRAIT_RAMP[i - 1];
      const [a1, c1] = PORTRAIT_RAMP[i];
      const t = (l - a0) / (a1 - a0 || 1);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t
      ];
    }
  }
  return PORTRAIT_RAMP[PORTRAIT_RAMP.length - 1][1];
}

function makePortrait(a) {
  if (!a.photo) return makeMosaic(a.name, a.initials);

  const wrap = el('div', 'portrait');
  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_COLS * PORTRAIT_CELL;
  canvas.height = PORTRAIT_ROWS * PORTRAIT_CELL;
  wrap.appendChild(canvas);

  // try the given path, then common extensions, before the mosaic fallback
  const base = a.photo.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const candidates = [a.photo, `${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`];
  const tried = [...new Set(candidates)];

  const attempt = (i) => {
    if (i >= tried.length) {
      wrap.replaceWith(makeMosaic(a.name, a.initials));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        renderParticlePortrait(canvas, img);
      } catch (_) {
        wrap.replaceWith(makeMosaic(a.name, a.initials));
      }
    };
    img.onerror = () => attempt(i + 1);
    img.src = tried[i];
  };
  attempt(0);
  return wrap;
}

function renderParticlePortrait(canvas, img) {
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

  // visible cells only (skip near-black so the face floats clean)
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      if (l < 0.08) continue;
      cells.push({ x, y, l, rgb: rampColor(l), ord: Math.random(), ph: Math.random() * 6.28 });
    }
  }

  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();

  // cursor in cell-space (the portrait reacts like the home grid)
  let px = -999;
  let py = -999;
  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * cols;
    py = ((e.clientY - r.top) / r.height) * rows;
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', () => { px = -999; py = -999; });

  const FOCUS = 13;
  const frame = (now) => {
    if (!canvas.isConnected) return; // artist switched — stop the loop
    const t = now / 1000;
    const reveal = reduced ? 1 : Math.min(1, (now - start) / 750);

    ctx.fillStyle = '#141210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const c of cells) {
      if (c.ord > reveal) continue;
      // idle shimmer + cursor resolve (brighten + grow near the pointer)
      let b = reduced ? 1 : 1 + 0.07 * Math.sin(t * 1.6 + c.ph);
      let f = 0;
      if (px > -900) {
        const d = Math.hypot(c.x - px, c.y - py);
        f = Math.max(0, 1 - d / FOCUS);
        f = f * f;
        b += f * 0.55;
      }
      const r = Math.min(255, c.rgb[0] * b);
      const g = Math.min(255, c.rgb[1] * b);
      const bl = Math.min(255, c.rgb[2] * b);
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
      const s = cell * (0.74 + 0.14 * c.l + 0.2 * f);
      const o = (cell - s) / 2;
      ctx.fillRect(c.x * cell + o, c.y * cell + o, s, s);
    }
    requestAnimationFrame(frame);
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

    // portrait + side arrows in one relative block, so the arrows sit on
    // the edges of the image and never overlap the text or the nav bar
    const visual = el('div', 'stage-visual');
    visual.appendChild(makePortrait(a));
    const prev = el('button', 'stage-arrow prev', '‹');
    const next = el('button', 'stage-arrow next', '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Previous artist');
    next.setAttribute('aria-label', 'Next artist');
    prev.addEventListener('click', () => setActive(index - 1));
    next.addEventListener('click', () => setActive(index + 1));
    visual.appendChild(prev);
    visual.appendChild(next);
    visual.appendChild(
      el('span', 'stage-count', `${String(i + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`)
    );
    stage.appendChild(visual);

    const text = el('div', 'stage-text');
    text.appendChild(el('div', 'stage-name', a.name));
    const timeRow = el('div', 'stage-time');
    timeRow.appendChild(el('span', null, a.time));
    if (a.tag) timeRow.appendChild(el('span', 'set-tag', a.tag));
    text.appendChild(timeRow);
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
    const row = el('span', 'lineup-time');
    row.appendChild(el('span', null, artist.time));
    if (artist.tag) row.appendChild(el('span', 'set-tag', artist.tag));
    btn.appendChild(row);
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
    const list = el('div', 'meta');
    for (const [k, v] of data.meta) {
      const row = el('div', 'meta-row');
      row.setAttribute('tabindex', '0');
      row.appendChild(el('span', 'meta-k', k));
      row.appendChild(el('span', 'meta-v', v));
      list.appendChild(row);
    }
    sec.appendChild(list);
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
