# ROOM 909 — MARRAKECH

Single-page portfolio for ROOM 909, an electronic music event series in
Marrakech inspired by the Roland TR-909. A slightly-3D rebuild of the 2D
mosaic prototype: an instanced grid of floating tiles that sample a shared
"aftermovie" texture and resolve under the cursor, driven by a 16-step
sequencer clock at 128 BPM.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the build
```

## Architecture

```
src/
  main.js               bootstrap
  App.js                renderer + single render loop, wiring, resize
  core/
    Clock909.js         16-step / 128 BPM clock — one source of truth,
                        locks to the music's transport while it plays
    Director.js         state machine: HERO · NEXT_EVENT · PAST_NIGHTS ·
                        LINEUP · ALBUM · CONTACT
    Audio909.js         background music (public/room909.mp3), beat-synced
    SwipeNav.js         wheel / vertical swipe moves between sections
    PointerRig.js       cursor → world point + parallax (gyro optional)
  scene/
    TileGrid.js         InstancedMesh + custom shaders (the centerpiece)
    FootageTexture.js   procedural smoke/strobe → render target (swappable)
    CameraRig.js        perspective camera + ~3° parallax
    post/Composer.js    bloom (ember only) + film grain + vignette
  ui/
    layout.js           nav, menu, wordmark, sequencer, intro, close
    sections.js         section panels + content
    styles.css          locked brand system
public/
  room909.mp3           the soundtrack (looped, starts on ENTER)
```

### The grid

One `InstancedMesh` of thin boxes (one draw call). Per-instance attributes
carry the texture region (`aCellUV`), random seeds (`aSeed`) and the mapped
sequencer column (`aColumn`). All motion is on the GPU in the vertex shader:
idle depth-noise float, cursor-focus tilt + resolve, sequencer column pulse,
and the section fly-apart / re-form transition.

### Dropping in real footage

The grid samples whatever texture it is handed. To use aftermovie footage
instead of the procedural field, one line at the call site:

```js
const video = Object.assign(document.createElement('video'), {
  src: '/aftermovie.mp4', loop: true, muted: true, playsInline: true
});
video.play();
window.__room909.grid.setMap(new THREE.VideoTexture(video));
```

## Brand (locked)

- Palette: charcoal `#141210`, cream `#EFE9DC`, ember `#FF5C00`, rust `#732103`. Nothing else.
- Type: Share Tech Mono only — small, uppercase, wide tracking.

## Music

`public/room909.mp3` (looped) starts on the visitor's first click or
keypress — the gesture browsers require for audio. While the
track plays, a Web Audio `AnalyserNode` listens to the low end: detected
kicks phase-align the 16-step grid to the actual beat (not just the clock),
retrigger the column flash, and bump a random scattering of tiles with an
ember glow. Bass level breathes through the whole mosaic.

The 909 is hidden under the tiles: a glyph mask the cursor "scratches" into
view (it surges where you move and fades when you stop). The cursor also
tilts, lifts and magnetises nearby tiles with a ripple — interaction is
gated on pointer activity, so the scene calms when idle. To swap the track:

```js
window.__room909.audio.setSource('/other-track.mp3');
```

SOUND ●/○ in the pill nav mutes without stopping the transport, so sync
never breaks.

## Navigation

- Bottom-centre nav bar (HOME · EVENT · LINEUP · CONTACT · SOUND), or
  wheel-scroll / vertical swipe / arrow keys, to move through
  HERO → NEXT EVENT → LINEUP → CONTACT. The active item gets an ember pill.
- Lineup: moving across (or focusing) a name resolves that artist's
  mosaic portrait, bio and links into a full-bleed stage.
- The wordmark's RHYTHM COMPOSER opens a popup about the TR-909.
- `Esc` returns to the hero.
- Idle 909 attract: after ~5s untouched on the hero, the grid assembles
  into a glowing 909, holds on the beat, reforms into a rotating word,
  then releases. Any input interrupts and eases back. See
  `core/AttractMode.js`.

## Quality

- Instancing, no per-frame allocations, DPR capped at 2.
- Responsive: fewer tiles on mobile, optional gyroscope parallax, graceful degrade.
- `prefers-reduced-motion`: clock frozen, static composition, grain stilled.
- Keyboard navigable; visible ember focus states; `Esc` returns to the hero.
