/**
 * Director — the scene state machine.
 *
 * Real state, not display:none. There is exactly one active state at a
 * time. Each state carries a target "transition" value (0 = hero, the
 * grid is formed; 1 = a section is open, the grid has flown apart). The
 * App lerps the live transition toward the active state's target every
 * frame, and listeners react (DOM sections fade, menu dims, etc).
 */
export const STATES = {
  HERO: 'HERO',
  NEXT_EVENT: 'NEXT_EVENT',
  LINEUP: 'LINEUP',
  CONTACT: 'CONTACT'
};

// every non-hero state opens a content section over a scattered grid
const SECTION_STATES = new Set([
  STATES.NEXT_EVENT,
  STATES.LINEUP,
  STATES.CONTACT
]);

export class Director {
  constructor() {
    this.state = STATES.HERO;
    this._listeners = new Set();
  }

  /** target transition for the current state: 0 hero, 1 section. */
  get transitionTarget() {
    return SECTION_STATES.has(this.state) ? 1 : 0;
  }

  isSection(state = this.state) {
    return SECTION_STATES.has(state);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  go(state) {
    if (!STATES[state]) {
      console.warn(`Director: unknown state "${state}"`);
      return;
    }
    if (state === this.state) return;
    const prev = this.state;
    this.state = state;
    for (const fn of this._listeners) fn(state, prev);
  }

  /** convenience: return to the hero composition. */
  home() {
    this.go(STATES.HERO);
  }
}
