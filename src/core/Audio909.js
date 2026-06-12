/**
 * Audio909 — background music, gated behind the ENTER intro (a user
 * gesture, which satisfies browser autoplay rules) and synced to the
 * sequencer.
 *
 * The clock reads `currentTime` while the track plays, so the pulsing
 * boxes stay locked to the beat — assuming a 128 BPM track that starts on
 * a bar. Muting keeps the transport running so sync never breaks.
 *
 * DROPPING IN THE TRACK LATER — put the file at `public/room909.mp3`, or
 * point at any URL with one line:
 *
 *     window.__room909.audio.setSource('/my-track.mp3');
 */
export class Audio909 {
  constructor({ src = '/room909.mp3' } = {}) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.src = src;
    this.el = el;
    this.playing = false;
    this.available = true;

    // if the file is missing the boxes simply free-run; no hard failure
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

  /** seconds into the track — used by the clock for beat sync. */
  get currentTime() {
    return this.el.currentTime || 0;
  }

  /** start playback from the top (called on ENTER — a user gesture). */
  start() {
    if (!this.available) return;
    try {
      this.el.currentTime = 0;
    } catch (_) {
      /* not yet seekable; ignore */
    }
    const p = this.el.play();
    if (p && p.catch) p.catch(() => {});
  }

  toggleMute() {
    this.el.muted = !this.el.muted;
    return this.el.muted;
  }

  get muted() {
    return this.el.muted;
  }
}
