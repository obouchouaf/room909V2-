import { STATES } from '../core/Director.js';
import { buildSections } from './sections.js';

/**
 * Builds the fixed UI chrome and wires it to the Director:
 *   - top-right pill nav (EVENTS / CONTACT / SOUND)
 *   - left menu (NEXT EVENT / LINEUP / CONTACT)
 *   - bottom-left wordmark
 *   - bottom-right 16-step sequencer (cells returned for the clock)
 *   - close/back control
 *   - the GET TICKETS pill (front page)
 *   - the section panels (via buildSections)
 *
 * Everything is real, focusable DOM. Navigation flips Director state; the
 * App reacts to state changes for the canvas transition.
 */
export function buildLayout(root, director, { onGyro, onEnter, audio } = {}) {
  // ---- top-right pill nav ----
  const nav = document.createElement('nav');
  nav.className = 'pill';
  nav.setAttribute('aria-label', 'Primary');
  const navEvents = button('Events', () => director.go(STATES.NEXT_EVENT));
  const navContact = button('Contact', () => director.go(STATES.CONTACT));

  // sound toggle — reflects mute state
  const sound = button('Sound: On', () => {
    if (!audio) return;
    const muted = audio.toggleMute();
    sound.textContent = muted ? 'Sound: Off' : 'Sound: On';
    sound.setAttribute('aria-pressed', String(!muted));
  });
  sound.setAttribute('aria-label', 'Toggle sound');

  nav.append(navEvents, sep(), navContact, sep(), sound);

  // ---- left menu ----
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('aria-label', 'What brings you here');
  const q = document.createElement('div');
  q.className = 'q';
  q.textContent = 'What brings you here?';
  menu.appendChild(q);

  const links = [
    ['Next Event', STATES.NEXT_EVENT],
    ['Lineup', STATES.LINEUP],
    ['Contact', STATES.CONTACT]
  ];
  const menuButtons = new Map();
  for (const [label, state] of links) {
    const b = button(label, () => director.go(state));
    menuButtons.set(state, b);
    menu.appendChild(b);
  }

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

  // ---- close / back ----
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.innerHTML = '<span class="x">×</span> BACK';
  close.setAttribute('aria-label', 'Back to home');
  close.addEventListener('click', () => director.home());

  // ---- Rhythm Composer popup (the TR-909 reference) ----
  const popup = buildPopup();

  // ---- get tickets — visible on the front page ----
  const tickets = document.createElement('a');
  tickets.className = 'tickets';
  tickets.href = 'https://shotgun.live/'; // TODO: real ticket link
  tickets.target = '_blank';
  tickets.rel = 'noopener noreferrer';
  tickets.textContent = 'GET TICKETS';

  // ---- sections ----
  const sections = buildSections(root);

  root.append(nav, menu, mark, seq, close, tickets, popup.el);

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
    if (audio) sound.textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
  };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  // ---- react to state ----
  function syncState(state) {
    const isSection = director.isSection(state);
    root.dataset.mode = isSection ? 'section' : 'hero';
    close.classList.toggle('show', isSection);
    sections.show(isSection ? state : null);
    for (const [s, b] of menuButtons) {
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
function sep() {
  const s = document.createElement('span');
  s.className = 'sep';
  return s;
}
