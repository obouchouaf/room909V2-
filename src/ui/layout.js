import { STATES } from '../core/Director.js';
import { buildSections } from './sections.js';

/**
 * Builds the fixed UI chrome and wires it to the Director:
 *   - top-right pill nav (EVENTS / CONTACT / SOUND)
 *   - left menu (NEXT EVENT / PAST NIGHTS / LINEUP / THE ALBUM)
 *   - bottom-left wordmark
 *   - bottom-right 16-step sequencer (cells returned for the clock)
 *   - close/back control
 *   - the ENTER intro gate (unlocks audio + gyro)
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
  const navEvents = button('Events', () => director.go(STATES.PAST_NIGHTS));
  const navContact = button('Contact', () => director.go(STATES.CONTACT));

  // sound toggle — reflects mute state
  const sound = button('Sound ●', () => {
    if (!audio) return;
    const muted = audio.toggleMute();
    sound.textContent = muted ? 'Sound ○' : 'Sound ●';
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
    ['Past Nights', STATES.PAST_NIGHTS],
    ['Lineup', STATES.LINEUP],
    ['The Album', STATES.ALBUM]
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
    '<b>ROOM <span class="nine">909</span></b><span class="sub">MARRAKECH · 31.62°N 7.99°W</span><span class="sub">RHYTHM COMPOSER</span>';

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

  // ---- sections ----
  const sections = buildSections(root);

  // ---- ENTER intro ----
  // Covers the scene until the visitor clicks in. The click is the user
  // gesture that unlocks audio + gyroscope. The grid runs dimly behind it.
  const intro = document.createElement('div');
  intro.className = 'intro';
  intro.innerHTML =
    '<div class="intro-mark">ROOM <span class="nine">909</span></div>' +
    '<div class="intro-sub">MARRAKECH · RHYTHM COMPOSER</div>' +
    '<button type="button" class="enter" aria-label="Enter Room 909">ENTER</button>';
  const enterBtn = intro.querySelector('.enter');

  let entered = false;
  const doEnter = () => {
    if (entered) return;
    entered = true;
    intro.classList.add('gone');
    if (onGyro) onGyro();
    if (onEnter) onEnter();
    // reflect playing state on the sound control
    if (audio) sound.textContent = audio.muted ? 'Sound ○' : 'Sound ●';
    window.setTimeout(() => intro.remove(), 900);
  };
  enterBtn.addEventListener('click', doEnter);

  root.append(nav, menu, mark, seq, close, intro);

  // focus the ENTER button so keyboard users can press Enter/Space
  requestAnimationFrame(() => enterBtn.focus());

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
function sep() {
  const s = document.createElement('span');
  s.className = 'sep';
  return s;
}
