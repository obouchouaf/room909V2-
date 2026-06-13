import * as THREE from 'three';

import { Clock909 } from './core/Clock909.js';
import { Director } from './core/Director.js';
import { PointerRig } from './core/PointerRig.js';
import { Audio909 } from './core/Audio909.js';
import { SwipeNav } from './core/SwipeNav.js';

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

    // ---- UI ----
    const { cells } = buildLayout(ui, this.director, {
      onGyro: () => this.pointer.requestGyro(),
      audio: this.audio,
      onEnter: () => this.audio.start()
    });
    this.cells = cells;

    // sequencer DOM follows the same clock
    this._litCell = 0;
    this.clock.onStep((step) => {
      this.cells[this._litCell].classList.remove('on');
      this.cells[step].classList.add('on');
      this._litCell = step;
    });
    if (this.reduced) this.cells[0].classList.add('on');

    // ---- live transition value, lerped toward the active state ----
    // (the App reads director.transitionTarget every frame)
    this._transition = 0;

    // per-section scatter seed: each section rotates the cloud into its
    // own arrangement, so section -> section is a visible swirl, not a
    // content swap. Lerped, so the swirl animates.
    this._sectionIndex = { NEXT_EVENT: 1, PAST_NIGHTS: 2, LINEUP: 3, ALBUM: 4, CONTACT: 5 };
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

    // tile counts: fewer on mobile, scaled to aspect, clamped to capacity
    const isMobile = w < 720;
    const rows = isMobile ? 12 : 20;
    const cols = Math.round(rows * aspect);

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

    const time = this.reduced ? 20 : now;

    // audio analysis first — the clock reads its synced transport
    this.audio.tick(dt);
    this.clock.tick(dt);

    // transition lerp toward the active state's target
    const target = this.director.transitionTarget;
    this._transition += (target - this._transition) * (this.reduced ? 1 : Math.min(1, dt * 4.5));
    // section seed swirl
    this._sectionSeed +=
      (this._sectionSeedTarget - this._sectionSeed) * (this.reduced ? 1 : Math.min(1, dt * 3));

    // input
    this.pointer.tick(this.reduced ? 1 : Math.min(1, dt * 6));

    // footage stays alive
    this.footage.update(time);

    // grid + camera
    this.grid.update(
      time,
      this.pointer.world,
      this.clock.step,
      this.clock.env,
      this._transition,
      this._sectionSeed,
      this.reduced ? 0 : this.audio.kick,
      this.reduced ? 0 : this.audio.level
    );
    this.cameraRig.update(this.pointer.parallax, this.reduced ? 1 : Math.min(1, dt * 3), this._transition);

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
