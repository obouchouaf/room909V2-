import { STATES } from './Director.js';

/**
 * SwipeNav — move between sections by scrolling the wheel or swiping
 * vertically, as well as via the menu. Swipe/scroll UP advances deeper
 * into the site; DOWN steps back toward the hero.
 *
 * Order: HERO → NEXT EVENT → PAST NIGHTS → LINEUP → ALBUM → CONTACT.
 * Both inputs are debounced so one gesture moves exactly one step.
 */
const ORDER = [
  STATES.HERO,
  STATES.NEXT_EVENT,
  STATES.PAST_NIGHTS,
  STATES.LINEUP,
  STATES.ALBUM,
  STATES.CONTACT
];

export class SwipeNav {
  constructor(director, { cooldown = 700 } = {}) {
    this.director = director;
    this.cooldown = cooldown;
    this._last = 0;
    this._touchY = null;
    this._enabled = false;
    this._bind();
  }

  enable() {
    this._enabled = true;
  }

  _index() {
    const i = ORDER.indexOf(this.director.state);
    return i < 0 ? 0 : i;
  }

  _move(dir) {
    if (!this._enabled) return;
    const now = performance.now();
    if (now - this._last < this.cooldown) return;
    const next = Math.min(ORDER.length - 1, Math.max(0, this._index() + dir));
    if (next === this._index()) return;
    this._last = now;
    this.director.go(ORDER[next]);
  }

  _bind() {
    window.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) < 12) return;
        this._move(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true }
    );

    // arrow keys / page keys step through sections too
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') this._move(1);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') this._move(-1);
    });

    window.addEventListener(
      'touchstart',
      (e) => {
        this._touchY = e.touches[0] ? e.touches[0].clientY : null;
      },
      { passive: true }
    );
    window.addEventListener(
      'touchend',
      (e) => {
        if (this._touchY == null) return;
        const endY = e.changedTouches[0] ? e.changedTouches[0].clientY : this._touchY;
        const dy = this._touchY - endY; // swipe up => positive
        if (Math.abs(dy) > 50) this._move(dy > 0 ? 1 : -1);
        this._touchY = null;
      },
      { passive: true }
    );
  }
}
