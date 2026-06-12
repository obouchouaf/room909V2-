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
    cta: 'Request Address'
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
    title: 'The Lineup',
    lede: 'Who plays the room.',
    roster: [
      ['AÏCHA', '00:00 · Hardware Live'],
      ['NOUR', '01:30 · Deep Techno'],
      ['SAID K.', '03:00 · Acid / 303'],
      ['THE CARETAKER', '04:30 · Selector'],
      ['GUEST 909', '05:30 · Invitation Only']
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
    cta: 'Open Mail'
  }
};

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
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
    const b = el('button', 'cta', data.cta);
    b.type = 'button';
    sec.appendChild(b);
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
