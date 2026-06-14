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
export function buildLayout(root, director, { onGyro, onEnter, audio, onToggleMotion } = {}) {
  // ---- Rhythm Composer popup (the TR-808 reference) ----
  const popup = buildPopup();

  // ---- bottom-centre nav bar ----
  const nav = document.createElement('nav');
  nav.className = 'bar';
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Primary');

  const navItems = [
    ['Home', STATES.HERO],
    ['Event', STATES.NEXT_EVENT],
    ['Lineup', STATES.LINEUP],
    ['Contact', STATES.CONTACT]
  ];
  const ORDER = navItems.map(([, s]) => s);
  const LABELS = Object.fromEntries(navItems);
  const navButtons = new Map();
  for (const [label, state] of navItems) {
    const b = button(label, () => director.go(state));
    b.className = 'bar-item';
    navButtons.set(state, b);
    nav.appendChild(b);
  }

  // sound toggle with a live VU meter that moves with the music
  const sound = document.createElement('button');
  sound.type = 'button';
  sound.className = 'bar-item bar-sound';
  sound.setAttribute('aria-label', 'Toggle sound');
  const sLabel = document.createElement('span');
  sLabel.textContent = 'Sound';
  const sDot = document.createElement('span');
  sDot.className = 'dot';
  const meterEl = document.createElement('span');
  meterEl.className = 'meter';
  const meterBars = [];
  for (let i = 0; i < 4; i++) {
    const bar = document.createElement('i');
    meterEl.appendChild(bar);
    meterBars.push(bar);
  }
  sound.append(sLabel, sDot, meterEl);
  const reflectSound = (muted) => {
    sDot.classList.toggle('off', muted);
    sound.setAttribute('aria-pressed', String(!muted));
  };
  sound.addEventListener('click', () => {
    if (!audio) return;
    reflectSound(audio.toggleMute());
  });
  reflectSound(audio ? audio.muted : false);
  nav.appendChild(sound);

  /** called each frame by the App with the live audio level + kick. */
  const setMeter = (level, kick) => {
    const v = Math.max(level, kick * 0.8);
    for (let i = 0; i < meterBars.length; i++) {
      const h = Math.min(1, v * (0.55 + i * 0.16) + kick * i * 0.08);
      meterBars[i].style.transform = `scaleY(${(0.12 + h * 0.88).toFixed(3)})`;
    }
  };

  // ---- wordmark (bottom-left, ROOM 808 reads clearly) ----
  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.innerHTML =
    '<b>ROOM <span class="nine">808</span></b><span class="sub">MARRAKECH · 31.62°N 7.99°W</span>';
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

  // ---- hero prompt — the invitation to explore ----
  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.innerHTML =
    '<span class="q">What brings you here?</span>' +
    '<span class="hint">— scratch the centre · pick a room below —</span>';

  // ---- centred reveal text (crisp, resolves char-by-char on hover) ----
  const reveal = document.createElement('div');
  reveal.className = 'reveal-text';
  reveal.setAttribute('aria-live', 'polite');
  // a faint pulsing marker that shows where to hover, fades once discovered
  const revealHint = document.createElement('div');
  revealHint.className = 'reveal-hint';
  revealHint.setAttribute('aria-hidden', 'true');
  const setReveal = makeReveal(reveal, revealHint);

  // ---- get tickets — visible on the front page ----
  const tickets = document.createElement('a');
  tickets.className = 'tickets';
  tickets.href = 'https://shotgun.live/'; // TODO: real ticket link
  tickets.target = '_blank';
  tickets.rel = 'noopener noreferrer';
  tickets.textContent = 'GET TICKETS';

  // ---- top progress bar + section index ----
  const progress = document.createElement('div');
  progress.className = 'progress';
  const pFill = document.createElement('i');
  progress.appendChild(pFill);

  const navIndex = document.createElement('div');
  navIndex.className = 'nav-index';

  // ---- motion toggle (accessibility) ----
  const motion = document.createElement('button');
  motion.type = 'button';
  motion.className = 'motion-toggle';
  let motionOff = false;
  const reflectMotion = () => {
    motion.innerHTML = `<span class="mi">${motionOff ? '▶' : '❚❚'}</span> Motion`;
    motion.setAttribute('aria-pressed', String(motionOff));
    motion.setAttribute('aria-label', motionOff ? 'Resume motion' : 'Pause motion');
  };
  motion.addEventListener('click', () => {
    motionOff = !motionOff;
    if (onToggleMotion) onToggleMotion(motionOff);
    reflectMotion();
  });
  reflectMotion();

  // ---- sections ----
  const sections = buildSections(root);

  root.append(nav, mark, prompt, revealHint, reveal, tickets, progress, navIndex, motion, popup.el);

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

  // ---- react to state: nav highlight + progress + index ----
  function syncState(state) {
    root.dataset.mode = director.isSection(state) ? 'section' : 'hero';
    sections.show(director.isSection(state) ? state : null);
    for (const [s, b] of navButtons) {
      b.classList.toggle('active', s === state);
      b.setAttribute('aria-current', s === state ? 'true' : 'false');
    }
    const idx = Math.max(0, ORDER.indexOf(state));
    pFill.style.width = `${(idx / (ORDER.length - 1)) * 100}%`;
    navIndex.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(ORDER.length).padStart(2, '0')} · ${(LABELS[state] || 'Home').toUpperCase()}`;
  }
  director.onChange((state) => syncState(state));
  syncState(director.state);

  // ---- keyboard: Escape returns home ----
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && director.isSection()) director.home();
  });

  return { cells, setMeter, setReveal };
}

/**
 * The centred reveal text: crisp Share Tech Mono that resolves character by
 * character (a brief scramble) when a new word comes in, then fades out when
 * the cursor leaves the centre. Returns setReveal(text, show).
 */
function makeReveal(el, hint) {
  const GLYPHS = '0123456789ABCDEFGHJKLMNPRSTUWXYZ#%·';
  let shown = false;
  let cur = '';
  let raf = 0;
  let discovered = false;

  const scrambleTo = (target) => {
    cancelAnimationFrame(raf);
    const start = performance.now();
    const dur = 420;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.textContent = target;
      return;
    }
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const locked = p * target.length;
      let out = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === ' ') out += ' ';
        else if (i < locked) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  return (text, show) => {
    if (show) {
      if (!discovered && hint) {
        discovered = true;
        hint.classList.add('gone');
      }
      if (!shown || cur !== text) {
        shown = true;
        cur = text;
        el.classList.add('show');
        scrambleTo(text);
      }
    } else if (shown) {
      shown = false;
      cur = '';
      el.classList.remove('show');
    }
  };
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The Rhythm Composer popup — a small panel explaining the TR-808 the
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
    '<div class="popup-mark">TR-<span class="nine">808</span></div>' +
    '<p>Roland built the TR-808 in 1980 and pulled it three years later. ' +
    'It was a commercial failure. Then the music found it — its deep kick, ' +
    'its cymbal, its sixteen steps became the backbone of electro, hip-hop ' +
    'and everything bass.</p>' +
    '<p>ROOM 808 is built around that machine: one room, one sequencer, ' +
    'sixteen steps a bar, analog in the air. The grid you are looking at ' +
    'is the 808 — every tile is a step.</p>' +
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
