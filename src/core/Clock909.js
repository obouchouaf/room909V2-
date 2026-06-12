/**
 * Clock909 — the heartbeat of the scene.
 *
 * One bar of sixteen 16th-note steps at 128 BPM (a classic TR-909 grid).
 * It is the single source of truth: the same clock drives the shader
 * uniforms (column pulse) and the DOM step cells, so they can never drift.
 *
 * Rather than a naive rAF delta, time is accumulated from a monotonic
 * origin and the step is derived from elapsed time. This stays locked to
 * wall-clock tempo even if frames are dropped.
 */
export class Clock909 {
  constructor({ bpm = 128, steps = 16, reduced = false } = {}) {
    this.bpm = bpm;
    this.steps = steps;
    this.reduced = reduced;

    // one 16th note in seconds
    this.stepDur = 60 / bpm / 4;

    this.step = 0; // current step index 0..15
    this.env = 0; // 1 -> 0 decay within the current step
    this._elapsed = 0;
    this._onStep = null; // callback(stepIndex)
  }

  onStep(fn) {
    this._onStep = fn;
    return this;
  }

  /** Advance the clock by dt seconds. Returns nothing; read .step / .env. */
  tick(dt) {
    if (this.reduced) {
      // frozen composition: hold step 0, no envelope
      this.step = 0;
      this.env = 0;
      return;
    }

    this._elapsed += dt;
    const totalSteps = Math.floor(this._elapsed / this.stepDur);
    const next = ((totalSteps % this.steps) + this.steps) % this.steps;

    if (next !== this.step) {
      this.step = next;
      if (this._onStep) this._onStep(this.step);
    }

    // envelope: 1 at the step onset, decaying to 0 just before the next
    const within = this._elapsed / this.stepDur - totalSteps;
    this.env = 1 - within;
  }
}
