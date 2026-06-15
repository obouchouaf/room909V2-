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
    '<b>ROOM <span class="logo808">8<span class="o"></span>8</span></b><span class="sub">MARRAKECH · 31.62°N 7.99°W</span>';
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
    '<span class="hint">— scratch the centre —</span>';

  // ---- centred reveal text (crisp, resolves char-by-char on hover) ----
  const reveal = document.createElement('div');
  reveal.className = 'reveal-text';
  reveal.setAttribute('aria-live', 'polite');
  // a faint pulsing marker that shows where to hover, fades once discovered
  const revealHint = document.createElement('div');
  revealHint.className = 'reveal-hint';
  revealHint.setAttribute('aria-hidden', 'true');
  const setReveal = makeReveal(reveal, revealHint);

  // ---- get tickets — the single boldest CTA ----
  const TICKETS_URL = 'https://shotgun.live/'; // TODO: real ticket link
  const tickets = document.createElement('a');
  tickets.className = 'tickets';
  tickets.href = TICKETS_URL;
  tickets.target = '_blank';
  tickets.rel = 'noopener noreferrer';
  tickets.textContent = 'GET TICKETS';

  // sticky tickets button — stays reachable inside sections (top-right)
  const ticketSticky = document.createElement('a');
  ticketSticky.className = 'ticket-sticky';
  ticketSticky.href = TICKETS_URL;
  ticketSticky.target = '_blank';
  ticketSticky.rel = 'noopener noreferrer';
  ticketSticky.innerHTML = 'Tickets <span class="arr">↗</span>';

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

  // ---- scroll cue — a bottom fade in sections that signals more below ----
  const scrollFade = document.createElement('div');
  scrollFade.className = 'scroll-fade';
  scrollFade.setAttribute('aria-hidden', 'true');

  root.append(
    nav, mark, prompt, revealHint, reveal, tickets, ticketSticky,
    scrollFade, progress, navIndex, motion, popup.el
  );

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
 * The centred reveal. The word lives UNDER the tiles and is rendered on a
 * canvas that you "scratch" open: the cursor paints a soft circle into an
 * accumulation mask, so wherever you hover builds up to fully revealed and
 * STAYS revealed while you're in the zone. The tiles are physically pushed
 * aside by the shader (no opacity). Returns setReveal(text, show).
 */
function makeReveal(el, hint) {
  const GLYPHS = '0123456789ABCDEFGHJKLMNPRSTUWXYZ#%';
  const W = 1280;
  const H = 240;
  const view = document.createElement('canvas');
  view.width = W;
  view.height = H;
  el.appendChild(view);
  const ctx = view.getContext('2d');
  const maskC = document.createElement('canvas');
  maskC.width = W;
  maskC.height = H;
  const mctx = maskC.getContext('2d');

  let word = '808';
  let display = '808';
  let scrambleStart = -9999;
  let shown = false;
  let discovered = false;
  let prog = 0; // 0..1 build-up, driven from App (matches the tile clearing)
  let cx = -999;
  let cy = -999;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const trackPoint = (clientX, clientY) => {
    const r = view.getBoundingClientRect();
    cx = ((clientX - r.left) / r.width) * W;
    cy = ((clientY - r.top) / r.height) * H;
  };
  // mouse + finger both drive the scratch lead, so the reveal follows a
  // dragged finger on touch the same way it follows the cursor on desktop
  window.addEventListener('pointermove', (e) => trackPoint(e.clientX, e.clientY), { passive: true });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches[0]) trackPoint(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );

  const setFont = (text) => {
    let size = H * 0.74;
    ctx.font = `800 ${size}px 'Martian Mono','Space Mono',monospace`;
    while (ctx.measureText(text).width > W * 0.92 && size > 20) {
      size -= 6;
      ctx.font = `800 ${size}px 'Martian Mono','Space Mono',monospace`;
    }
  };

  const loop = (now) => {
    requestAnimationFrame(loop);

    // scramble the word for ~0.4s after it changes
    if (!reduced && now - scrambleStart < 420) {
      const p = (now - scrambleStart) / 420;
      const locked = p * word.length;
      let out = '';
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        out += ch === ' ' ? ' ' : i < locked ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      display = out;
    } else {
      display = word;
    }

    // rebuild the scratch mask from the live progress. The whole word lifts in
    // with `prog` (matching the tiles parting), and the cursor adds a brighter
    // leading edge so it reads as scratched open from where you hover outward.
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, W, H);
    if (reduced) {
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, W, H);
    } else {
      if (prog > 0.001) {
        mctx.fillStyle = `rgba(0,0,0,${Math.min(1, prog).toFixed(3)})`;
        mctx.fillRect(0, 0, W, H);
      }
      if (shown && cx > -900) {
        const rad = H * 0.72;
        const g = mctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, W, H);
      }
    }

    // draw the word, then keep only the scratched-open area
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#efe9dc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setFont(display);
    ctx.fillText(display, W / 2, H / 2 + 6);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskC, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(loop);

  return (text, show, progress = 0) => {
    prog = progress;
    if (show) {
      if (!discovered && hint) {
        discovered = true;
        hint.classList.add('gone');
      }
      if (word !== text) {
        word = text;
        scrambleStart = performance.now();
      }
      if (!shown) {
        shown = true;
        el.classList.add('show');
      }
    } else if (shown) {
      shown = false;
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
