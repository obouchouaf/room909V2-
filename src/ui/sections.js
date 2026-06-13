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
    lede: 'One night. One room. A serious sound system. The machine runs until sunrise.',
    meta: [
      ['Date', 'Sat 12 Sep 2026 · 23:00'],
      ['Location', 'Undisclosed Riad · Medina, Marrakech'],
      ['Sound', 'Custom Stack · Tuned For The Room'],
      ['Format', 'Analog Only · 909 In The Room']
    ],
    cta: ['Get Tickets', 'https://shotgun.live/'] // TODO: real ticket link
  },
  [STATES.PAST_NIGHTS]: {
    eyebrow: 'Past Nights',
    title: 'The Archive',
    lede: 'Where the machine has already been.',
    cards: [
      ['Vol. 008', 'Atlas Rooftop · May 2026'],
      ['Vol. 007', 'Salt Warehouse · Mar 2026'],
      ['Vol. 006', 'Palmeraie · Jan 2026'],
      ['Vol. 005', 'Old Cinema · Nov 2025'],
      ['Vol. 004', 'Tannery · Sep 2025'],
      ['Vol. 003', 'Courtyard 9 · Jul 2025']
    ]
  },
  [STATES.LINEUP]: {
    eyebrow: 'Lineup',
    title: 'Lineup',
    lede: 'The bill for Volume 909. Hover a name.',
    lineup: [
      {
        name: 'AÏCHA',
        time: '23:00 — 00:30',
        initials: 'AÏ',
        bio: 'Hardware live set. A 909, a 303, no laptop. Opens the room slow and lets the machines warm up with it.',
        links: [
          ['SoundCloud', 'https://soundcloud.com/'],
          ['Instagram', 'https://instagram.com/']
        ]
      },
      {
        name: 'NOUR',
        time: '00:30 — 02:00',
        initials: 'NO',
        bio: 'Deep, patient techno from Casablanca. Long blends, low ceilings, no rush.',
        links: [
          ['SoundCloud', 'https://soundcloud.com/'],
          ['Instagram', 'https://instagram.com/']
        ]
      },
      {
        name: 'SAID K.',
        time: '02:00 — 03:30',
        initials: 'SK',
        bio: 'Acid worship. Marrakech native — a 303 in hand since 2015 and no intention of putting it down.',
        links: [
          ['SoundCloud', 'https://soundcloud.com/'],
          ['Bandcamp', 'https://bandcamp.com/']
        ]
      },
      {
        name: 'GUEST 909',
        time: '03:30 — 05:00',
        initials: '909',
        bio: 'Announced at the door. Trust the room.',
        links: []
      },
      {
        name: 'B2B CLOSING',
        time: '05:00 — SUNRISE',
        initials: 'B2B',
        bio: 'Everyone still standing. Four hands minimum, sunrise through the smoke.',
        links: []
      }
    ]
  },
  [STATES.ALBUM]: {
    eyebrow: 'The Album',
    title: 'Rhythm Composer',
    lede: 'Nine tracks pressed from the room. Out soon.',
    tracks: [
      'Cold Start',
      'Medina 4AM',
      'Hi-Hat Prayer',
      'Rust Hum',
      'Ember Sequence',
      'Closed Room',
      'Atlas Static',
      'Last Bar',
      'Sunrise / 909'
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

function makeMosaic(seedStr, initials) {
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
  for (let i = 0; i < 12 * 7; i++) {
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
    mosaic.appendChild(cell);
  }
  mosaic.appendChild(el('span', 'init', initials));
  return mosaic;
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

  if (data.cards) {
    const ul = el('ul', 'cards');
    for (const [name, when] of data.cards) {
      const li = el('li');
      li.appendChild(el('div', 'thumb'));
      li.appendChild(el('div', 'label', `${name}<span>${when}</span>`));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }

  if (data.roster) {
    const ul = el('ul', 'roster');
    for (const [name, role] of data.roster) {
      const li = el('li');
      li.appendChild(el('span', 'name', name));
      li.appendChild(el('span', 'role', role));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }

  if (data.lineup) {
    const ul = el('ul', 'roster');
    for (const artist of data.lineup) {
      const li = el('li');
      li.className = 'artist';

      // the name is a button: hover shows the card on desktop, tap
      // toggles it on touch, focus shows it for keyboard users
      const btn = el('button', 'artist-btn', artist.name);
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const open = li.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });

      const card = el('div', 'artist-card');
      card.appendChild(makeMosaic(artist.name, artist.initials));
      card.appendChild(el('p', 'bio', artist.bio));
      if (artist.links.length) {
        const links = el('div', 'links');
        for (const [label, href] of artist.links) {
          const a = el('a', null, label);
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          links.appendChild(a);
        }
        card.appendChild(links);
      }

      li.appendChild(btn);
      li.appendChild(el('span', 'role', artist.time));
      li.appendChild(card);
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }

  if (data.tracks) {
    const ul = el('ul', 'tracks');
    data.tracks.forEach((t, i) => {
      const li = el('li');
      li.appendChild(el('span', 'no', String(i + 1).padStart(2, '0')));
      li.appendChild(el('span', 'title', t));
      ul.appendChild(li);
    });
    sec.appendChild(ul);
  }

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
