import * as THREE from 'three';

import { Clock909 } from './core/Clock909.js';
import { Director } from './core/Director.js';
import { PointerRig } from './core/PointerRig.js';
import { Audio909 } from './core/Audio909.js';
import { SwipeNav } from './core/SwipeNav.js';
import { AttractMode } from './core/AttractMode.js';
import { STATES } from './core/Director.js';

import { FootageTexture } from './scene/FootageTexture.js';
import { TileGrid } from './scene/TileGrid.js';
import { CameraRig } from './scene/CameraRig.js';
import { Composer } from './scene/post/Composer.js';

import { buildLayout } from './ui/layout.js';

/**
 * App — wires every part together and owns the single render loop.
 *
 * Lifecycle: construct → start(). One rAF loop advances the clock, the
 * pointer, the camera, the grid, and renders through the composer. No
 * per-frame allocations live here.
 */
export class App {
  constructor({ canvas, ui }) {
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ---- renderer ----
    // Color management off: the locked palette is authored as plain sRGB
    // values in the shaders (matching the 2D prototype exactly), so we want
    // a straight passthrough with no working-space conversion.
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x141210, 1);

    // ---- scene + camera ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141210);
    this.cameraRig = new CameraRig({ distance: 16, fov: 42 });

    // ---- footage (swappable for video) ----
    this.footage = new FootageTexture(this.renderer, {
      size: this.reduced ? 512 : 640,
      reduced: this.reduced
    });

    // ---- tile grid ----
    this.grid = new TileGrid({ reduced: this.reduced });
    this.grid.setMap(this.footage.texture);
    this.scene.add(this.grid.mesh);

    // ---- post ----
    this.composer = new Composer(this.renderer, this.scene, this.cameraRig.camera, {
      reduced: this.reduced
    });

    // ---- clock + state + input ----
    this.clock = new Clock909({ bpm: 128, steps: 16, reduced: this.reduced });
    this.director = new Director();
    this.pointer = new PointerRig(this.cameraRig.camera, { reduced: this.reduced });

    // ---- audio (analyzed + synced to the clock) ----
    this.audio = new Audio909({ src: '/room909.mp3' });
    // while the track plays, the grid steps off its transport, phase-
    // aligned to the kicks the analyser actually hears
    this.clock.useTimeSource(
      () => this.audio.syncedTime,
      () => this.audio.playing
    );

    // ---- swipe / scroll between sections ----
    this.swipe = new SwipeNav(this.director);
    this.swipe.enable();

    // ---- idle attract animation (disabled for now — the hidden info is
    // revealed by scratching with the cursor, not on an idle timer) ----
    this.attract = new AttractMode(this.grid, { idle: Infinity, reduced: this.reduced });
    // any wheel / key / pointer gesture counts as interaction (resets idle)
    this._lastInteract = 0;
    const bump = () => { this._lastInteract = performance.now(); };
    window.addEventListener('wheel', bump, { passive: true });
    window.addEventListener('keydown', bump);
    window.addEventListener('pointerdown', bump);

    // ---- runtime motion (calm) toggle for accessibility ----
    this._calm = false;

    // ---- UI ----
    const { cells, setMeter, setReveal } = buildLayout(ui, this.director, {
      onGyro: () => this.pointer.requestGyro(),
      audio: this.audio,
      onEnter: () => this.audio.start(),
      onToggleMotion: (off) => {
        this._calm = off;
      }
    });
    this.cells = cells;
    this.setMeter = setMeter;
    this.setReveal = setReveal;
    this.cursorPulse = null; // wired from main.js

    // the centred info reveal cycles through these each time the cursor
    // enters the centred box (hover the spot to read it)
    this._infos = ['808', '12 SEP 2026', 'LE CHARLESTON', 'MARRAKECH'];
    this._infoIndex = -1; // first hover lands on 808
    this._wasInBox = false;
    this._revealProgress = 0; // grows while hovering, resets on each new word

    // sequencer DOM follows the same clock
    this._litCell = 0;
    this._downbeatPulse = false;
    this.clock.onStep((step) => {
      this.cells[this._litCell].classList.remove('on');
      this.cells[step].classList.add('on');
      this._litCell = step;
      if (step % 4 === 0) this._downbeatPulse = true; // bar accents → cursor thunk
    });
    if (this.reduced) this.cells[0].classList.add('on');

    // ---- live transition value, lerped toward the active state ----
    // (the App reads director.transitionTarget every frame)
    this._transition = 0;

    // per-section scatter seed: each section rotates the cloud into its
    // own arrangement, so section -> section is a visible swirl, not a
    // content swap. Lerped, so the swirl animates.
    this._sectionIndex = { NEXT_EVENT: 1, LINEUP: 2, CONTACT: 3 };
    this._sectionSeed = 0;
    this._sectionSeedTarget = 0;
    this.director.onChange((state) => {
      const idx = this._sectionIndex[state];
      if (idx) this._sectionSeedTarget = idx * 1.45;
      // returning to HERO keeps the last seed so the re-form unwinds
      // along the same path it scattered
    });

    this._last = performance.now() / 1000;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.cameraRig.setAspect(aspect);
    this.composer.setSize(w, h, this.dpr);
    this.footage.setAspect(aspect);

    // Aim for a roughly constant on-screen tile size instead of a fixed
    // row count, so phones don't get huge chunky tiles. Portrait screens
    // (small min-edge) still get a denser grid than before.
    const isMobile = w < 720;
    const targetTilePx = isMobile ? 32 : 42; // finer, more image-like mosaic
    const rows = Math.max(10, Math.min(this.grid.capRows, Math.round(h / targetTilePx)));
    const cols = Math.max(6, Math.min(this.grid.capCols, Math.round(w / targetTilePx)));

    const { w: worldW, h: worldH } = this.cameraRig.worldSize();
    this.grid.layout(worldW, worldH, cols, rows);
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._frame();
    };
    this._raf = requestAnimationFrame(loop);
  }

  _frame() {
    const now = performance.now() / 1000;
    let dt = now - this._last;
    this._last = now;
    if (dt > 0.1) dt = 0.1; // clamp after tab-switch stalls

    // "still" = reduced motion preference OR the user paused motion. The
    // music keeps playing and the meter keeps moving either way.
    const still = this.reduced || this._calm;
    if (still) this._frozen = this._frozen || now;
    else this._frozen = 0;
    const time = still ? this._frozen || 20 : now;

    // audio analysis always runs (drives the meter + cursor pulse)
    this.audio.tick(dt);
    this.clock.tick(dt);

    const kick = still ? 0 : this.audio.kick;

    // transition lerp toward the active state's target (sections still work)
    const target = this.director.transitionTarget;
    this._transition += (target - this._transition) * Math.min(1, dt * 4.5);
    this._sectionSeed += (this._sectionSeedTarget - this._sectionSeed) * Math.min(1, dt * 3);

    // input
    this.pointer.tick(this.reduced ? 1 : Math.min(1, dt * 6));

    // cycle the centred info each time the cursor ENTERS the centred zone:
    // 909 → date → venue → city. The grid dims that patch; the readable info
    // is rendered as crisp DOM text on top (see layout.setReveal).
    let inZone = false;
    if (!still && this.director.state === STATES.HERO) {
      const half = this.grid.uniforms.uRevealHalf.value;
      const ex = this.pointer.world.x / half.x;
      const ey = this.pointer.world.y / half.y;
      inZone = ex * ex + ey * ey < 1.0;
      if (inZone && !this._wasInBox) {
        this._wasInBox = true;
        this._infoIndex = (this._infoIndex + 1) % this._infos.length;
        this._revealProgress = 0; // a new word starts hidden and builds up
      } else if (!inZone) {
        this._wasInBox = false;
      }
    }
    // the word builds up over the hover (~0.9s to fully revealed) and holds
    // while the cursor stays; it eases back when the cursor leaves the zone.
    this._revealProgress = inZone
      ? Math.min(1, this._revealProgress + dt / 0.9)
      : Math.max(0, this._revealProgress - dt / 0.4);
    if (this.setReveal)
      this.setReveal(this._infos[Math.max(0, this._infoIndex)], inZone, this._revealProgress);

    // idle 909 attract — eligible only on HERO with no recent interaction
    const interacting =
      this.pointer.strength > 0.02 ||
      this.pointer.velocity > 0.02 ||
      performance.now() - this._lastInteract < 220;
    this.attract.update(dt, {
      hero: this.director.state === STATES.HERO,
      interacting,
      kick
    });

    // footage stays alive
    this.footage.update(time);

    // grid + camera
    this.grid.update({
      time,
      pointerWorld: this.pointer.world,
      step: this.clock.step,
      env: this.clock.env,
      transition: this._transition,
      sectionSeed: this._sectionSeed,
      kick,
      audioLevel: still ? 0 : this.audio.level,
      active: still ? 0 : this.pointer.strength,
      velocity: still ? 0 : this.pointer.velocity,
      attract: this.attract.value,
      attractPulse: this.attract.pulse,
      revealAmount: this._revealProgress
    });
    this.cameraRig.update(this.pointer.parallax, this.reduced ? 1 : Math.min(1, dt * 3), this._transition);

    // live audio UI: VU meter + cursor knob pulse (always, even when paused)
    if (this.setMeter) this.setMeter(this.audio.level, this.audio.kick);
    if (this.cursorPulse) this.cursorPulse(this.reduced ? 0 : this.audio.kick, this._downbeatPulse && !still);
    this._downbeatPulse = false;

    // render
    this.composer.render(time);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.grid.dispose();
    this.footage.dispose();
    this.renderer.dispose();
  }
}
