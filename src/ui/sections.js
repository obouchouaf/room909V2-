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
 * Artist portrait: a real photo when one is provided (toned into the brand
 * with a charcoal/ember overlay), otherwise the generated mosaic. If the
 * photo fails to load it falls back to the mosaic automatically.
 */
function makePortrait(a) {
  if (!a.photo) return makeMosaic(a.name, a.initials);

  const wrap = el('div', 'portrait');
  const img = document.createElement('img');
  img.src = a.photo;
  img.alt = a.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    wrap.replaceWith(makeMosaic(a.name, a.initials));
  });
  wrap.appendChild(img);
  return wrap;
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
