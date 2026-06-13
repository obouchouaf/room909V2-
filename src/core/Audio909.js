/**
 * Audio909 — background music + live analysis.
 *
 * The track (public/room909.mp3) starts on the visitor's first gesture (so
 * autoplay rules are satisfied). A Web Audio AnalyserNode listens to the
 * low end and produces per frame:
 *
 *   .level   smoothed bass energy 0..1  — the music's overall weight
 *   .kick    1 -> 0 envelope retriggered on each detected kick onset
 *   .syncedTime  track time phase-aligned to the detected kicks, so the
 *                grid pulse lands ON the beat
 *
 * iOS Safari is strict: audio must (re)start inside a user gesture, the
 * AudioContext must be resumed in a gesture, and routing through Web Audio
 * needs a silent-buffer unlock. We therefore keep retrying play+resume on
 * every tap until it is actually running.
 *
 * Muting routes through a GainNode (the element keeps playing) so analysis
 * and sync continue while silent.
 */
const BEAT_DUR = 60 / 128; // one beat at 128 BPM

export class Audio909 {
  constructor({ src = '/room909.mp3' } = {}) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.muted = false;
    el.src = src;
    this.el = el;
    this.playing = false;
    this.available = true;
    this.muted = false;

    this.level = 0;
    this.kick = 0;
    this._phase = 0; // estimated offset of the downbeat within a beat
    this._avg = 0.0001; // running average bass energy
    this._lastOnset = -1;

    this._ctx = null;
    this._analyser = null;
    this._gain = null;
    this._bins = null;
    this._unlockInstalled = false;

    el.addEventListener('error', () => {
      this.available = false;
      this.playing = false;
    });
    el.addEventListener('play', () => (this.playing = true));
    el.addEventListener('pause', () => (this.playing = false));
  }

  setSource(src) {
    this.el.src = src;
    this.available = true;
  }

  /** track time aligned to the detected beat grid. */
  get syncedTime() {
    return (this.el.currentTime || 0) - this._phase;
  }

  _build() {
    if (this._ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
      const src = this._ctx.createMediaElementSource(this.el);
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0.2; // snappier transients
      this._gain = this._ctx.createGain();
      this._gain.gain.value = this.muted ? 0 : 1;
      src.connect(this._analyser);
      this._analyser.connect(this._gain);
      this._gain.connect(this._ctx.destination);
      this._bins = new Uint8Array(this._analyser.frequencyBinCount);

      // iOS unlock: play a 1-sample silent buffer through the context
      const b = this._ctx.createBuffer(1, 1, 22050);
      const s = this._ctx.createBufferSource();
      s.buffer = b;
      s.connect(this._ctx.destination);
      s.start(0);
    } catch (_) {
      /* no analysis — the clock free-runs, playback still works */
    }
  }

  _resumeAndPlay() {
    if (this._ctx && this._ctx.state !== 'running') this._ctx.resume().catch(() => {});
    const p = this.el.play();
    if (p && p.catch) p.catch(() => {});
  }

  // keep retrying on every tap until audio is genuinely running (iOS)
  _installUnlock() {
    if (this._unlockInstalled) return;
    this._unlockInstalled = true;
    const handler = () => {
      this._resumeAndPlay();
      const ok = this.playing && (!this._ctx || this._ctx.state === 'running');
      if (ok) {
        document.removeEventListener('touchend', handler);
        document.removeEventListener('pointerdown', handler);
        document.removeEventListener('keydown', handler);
        this._unlockInstalled = false;
      }
    };
    document.addEventListener('touchend', handler, { passive: true });
    document.addEventListener('pointerdown', handler, { passive: true });
    document.addEventListener('keydown', handler);
  }

  /** start playback + analysis. Must be called from a user gesture. */
  start() {
    if (!this.available) return;
    this._build();
    this._resumeAndPlay();
    this._installUnlock();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this._gain) {
      this._gain.gain.value = this.muted ? 0 : 1;
    } else {
      this.el.muted = this.muted;
    }
    return this.muted;
  }

  /** call once per frame. Updates .level / .kick / phase estimate. */
  tick(dt) {
    // snappy kick envelope decay
    this.kick = Math.max(0, this.kick - dt * 8);
    if (!this._analyser || !this.playing) {
      this.level *= 1 - Math.min(1, dt * 3);
      return;
    }

    this._analyser.getByteFrequencyData(this._bins);

    // bass energy: ~21–150 Hz (bins 1..7 at 44.1kHz / fft 2048)
    let sum = 0;
    for (let i = 1; i <= 7; i++) sum += this._bins[i];
    const energy = sum / (7 * 255);

    // smoothed level: fast attack, slow release
    this.level += (energy - this.level) * (energy > this.level ? 0.5 : Math.min(1, dt * 4));

    // onset detection against the running average — a bit more sensitive
    const t = this.el.currentTime;
    if (energy > this._avg * 1.32 && energy > 0.16 && t - this._lastOnset > BEAT_DUR * 0.55) {
      this._lastOnset = t;
      this.kick = 1;

      // nudge the beat-phase estimate toward this onset (circular)
      const phase = t % BEAT_DUR;
      let delta = phase - this._phase;
      if (delta > BEAT_DUR / 2) delta -= BEAT_DUR;
      if (delta < -BEAT_DUR / 2) delta += BEAT_DUR;
      this._phase += delta * 0.3;
      if (this._phase < 0) this._phase += BEAT_DUR;
    }
    this._avg += (energy - this._avg) * Math.min(1, dt * 1.2);
  }
}
