import { STATES } from '../core/Director.js';
import { buildSections } from './sections.js';

/**
 * Builds the fixed UI chrome and wires it to the Director:
 *   - bottom-centre nav bar (HOME / EVENT / LINEUP / CONTACT / SOUND)
 *   - bottom-left wordmark (+ Rhythm Composer popup)
 *   - bottom-right 16-step sequencer (cells returned for the clock)
 *   - the GET TICKETS pill (front page)
 *   - the section panels (via buildSections)
 *
 * Everything is real, focusable DOM. Navigation flips Director state; the
 * App reacts to state changes for the canvas transition.
 */
export function buildLayout(root, director, { onGyro, onEnter, audio } = {}) {
  // ---- Rhythm Composer popup (the TR-909 reference) ----
  const popup = buildPopup();

  // ---- bottom-centre nav bar ----
  const nav = document.createElement('nav');
  nav.className = 'bar';
  nav.setAttribute('aria-label', 'Primary');

  const navItems = [
    ['Home', STATES.HERO],
    ['Event', STATES.NEXT_EVENT],
    ['Lineup', STATES.LINEUP],
    ['Contact', STATES.CONTACT]
  ];
  const navButtons = new Map();
  for (const [label, state] of navItems) {
    const b = button(label, () => director.go(state));
    b.className = 'bar-item';
    navButtons.set(state, b);
    nav.appendChild(b);
  }

  // sound toggle — circle indicator: filled when on, hollow when muted
  const sound = button('', () => {
    if (!audio) return;
    const muted = audio.toggleMute();
    reflectSound(muted);
  });
  sound.className = 'bar-item bar-sound';
  sound.setAttribute('aria-label', 'Toggle sound');
  const reflectSound = (muted) => {
    sound.innerHTML = `Sound <span class="dot${muted ? ' off' : ''}"></span>`;
    sound.setAttribute('aria-pressed', String(!muted));
  };
  reflectSound(audio ? audio.muted : false);
  nav.appendChild(sound);

  // ---- wordmark (bottom-left, ROOM 909 reads clearly) ----
  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.innerHTML =
    '<b>ROOM <span class="nine">909</span></b><span class="sub">MARRAKECH · 31.62°N 7.99°W</span>';
  const rc = button('Rhythm Composer', () => popup.open());
  rc.className = 'rc-link';
  mark.appendChild(rc);

  // ---- step sequencer ----
  const seq = document.createElement('div');
  seq.className = 'seq';
  seq.setAttribute('aria-hidden', 'true');
  const cells = [];
  for (let i = 0; i < 16; i++) {
    const c = document.createElement('i');
    if (i % 4 === 0) c.classList.add('accent');
    seq.appendChild(c);
    cells.push(c);
  }

  // ---- get tickets — visible on the front page ----
  const tickets = document.createElement('a');
  tickets.className = 'tickets';
  tickets.href = 'https://shotgun.live/'; // TODO: real ticket link
  tickets.target = '_blank';
  tickets.rel = 'noopener noreferrer';
  tickets.textContent = 'GET TICKETS';

  // ---- sections ----
  const sections = buildSections(root);

  root.append(nav, mark, seq, tickets, popup.el);

  // No intro gate: the music starts on the visitor's first real gesture
  // (click or key — the interactions browsers accept for audio unlock).
  let entered = false;
  const firstGesture = () => {
    if (entered) return;
    entered = true;
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
    if (onGyro) onGyro();
    if (onEnter) onEnter();
    if (audio) reflectSound(audio.muted);
  };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  // ---- react to state: highlight the active nav item ----
  function syncState(state) {
    root.dataset.mode = director.isSection(state) ? 'section' : 'hero';
    sections.show(director.isSection(state) ? state : null);
    for (const [s, b] of navButtons) {
      b.classList.toggle('active', s === state);
      b.setAttribute('aria-current', s === state ? 'true' : 'false');
    }
  }
  director.onChange((state) => syncState(state));
  syncState(director.state);

  // ---- keyboard: Escape returns home ----
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && director.isSection()) director.home();
  });

  return { cells };
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The Rhythm Composer popup — a small panel explaining the TR-909 the
 * whole series is named for. Opens from the wordmark, closes on the X,
 * Escape, or a click on the backdrop.
 */
function buildPopup() {
  const el = document.createElement('div');
  el.className = 'popup';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Rhythm Composer');
  el.innerHTML =
    '<div class="popup-panel">' +
    '<button type="button" class="popup-x" aria-label="Close">×</button>' +
    '<div class="popup-eyebrow">Rhythm Composer</div>' +
    '<div class="popup-mark">TR-<span class="nine">909</span></div>' +
    '<p>Roland built the TR-909 in 1983 and discontinued it two years ' +
    'later. It flopped. Then house and techno found it — its kick, its ' +
    'open hi-hat, its sixteen steps became the spine of the music.</p>' +
    '<p>ROOM 909 is built around that machine: one room, one sequencer, ' +
    'sixteen steps a bar, analog in the air. The grid you are looking at ' +
    'is the 909 — every tile is a step.</p>' +
    '</div>';

  const close = () => el.classList.remove('show');
  const open = () => el.classList.add('show');

  el.querySelector('.popup-x').addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { el, open, close };
}
