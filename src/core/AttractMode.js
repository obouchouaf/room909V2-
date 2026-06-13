/**
 * AttractMode — the idle "909 reveal" centrepiece.
 *
 * After ~5s with no interaction on the HERO state, the tile grid assembles
 * into a glowing "909", holds (pulsing with the beat), then reforms into a
 * rotating word before returning to the normal reactive grid. Any
 * interaction interrupts and eases everything back within ~0.5s.
 *
 * It drives just two grid uniforms — `uAttract` (0..1 envelope) and
 * `uAttractPulse` (beat) — plus swaps the glyph-mask text. The actual
 * tile motion/colour lives in the shader, so this stays cheap and surgical.
 *
 * Cycle timeline (seconds):
 *   0.0–2.0  assemble "909"      (elastic overshoot)
 *   2.0–3.5  hold "909"          (pulses on each kick)
 *   3.5–5.0  reform into a word  (MARRAKECH / 31.62°N / NEXT / 128 BPM)
 *   5.0–6.0  release to normal
 *   then rest; restart after another idle period, advancing the word.
 */
const WORDS = ['MARRAKECH', '31.62°N', 'NEXT: SEP 12', '128 BPM'];

function easeOutElastic(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const p = 0.4;
  return Math.pow(2, -10 * x) * Math.sin(((x - p / 4) * (2 * Math.PI)) / p) + 1;
}
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class AttractMode {
  constructor(grid, { idle = 5, reduced = false } = {}) {
    this.grid = grid;
    this.idleDelay = idle;
    this.reduced = reduced;

    this.idle = 0;
    this.active = false;
    this.ct = 0; // cycle time
    this.word = 0;
    this.value = 0; // eased attract → uAttract
    this.pulse = 0; // → uAttractPulse
    this._text = '909';
  }

  _setText(t) {
    if (t !== this._text) {
      this._text = t;
      this.grid.setMarkText(t);
    }
  }

  /** call once per frame. hero: on HERO state; interacting: any input now. */
  update(dt, { hero, interacting, kick }) {
    // not eligible — settle attract to 0, reset, keep the mask as "909"
    if (this.reduced || !hero || interacting) {
      this.active = false;
      this.ct = 0;
      this.idle = 0;
      this.pulse = 0;
      this.value += (0 - this.value) * Math.min(1, dt * 5.5);
      if (this.value < 0.02) this._setText('909');
      return;
    }

    // idle, waiting to trigger
    if (!this.active) {
      this.value += (0 - this.value) * Math.min(1, dt * 5.5);
      if (this.value < 0.02) this._setText('909');
      this.idle += dt;
      if (this.idle >= this.idleDelay) {
        this.active = true;
        this.ct = 0;
        this._setText('909');
      }
      return;
    }

    // running a cycle
    this.ct += dt;
    const ct = this.ct;
    let env = 0;
    this.pulse = 0;

    if (ct < 2.0) {
      env = easeOutElastic(ct / 2.0); // assemble 909
      this._setText('909');
    } else if (ct < 3.5) {
      env = 1; // hold 909
      this.pulse = kick;
    } else if (ct < 5.0) {
      this._setText(WORDS[this.word]); // reform into a word
      env = 0.55 + 0.45 * easeOutElastic((ct - 3.5) / 1.5);
    } else if (ct < 6.0) {
      env = 1 - smoothstep(5.0, 6.0, ct); // release
    } else {
      this.active = false; // cycle done — rest, advance the word
      this.idle = 0;
      this.word = (this.word + 1) % WORDS.length;
      env = 0;
    }

    this.value = Math.max(0, Math.min(1.1, env));
  }
}
