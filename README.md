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

The site opens behind an ENTER gate; clicking in starts `public/room909.mp3`
(looped) — the user gesture that satisfies browser autoplay rules. While the
track plays, a Web Audio `AnalyserNode` listens to the low end: detected
kicks phase-align the 16-step grid to the actual beat (not just the clock),
retrigger the column flash, and bump a random scattering of tiles with an
ember glow. Bass level breathes through the whole mosaic. To swap the track:

```js
window.__room909.audio.setSource('/other-track.mp3');
```

SOUND ●/○ in the pill nav mutes without stopping the transport, so sync
never breaks.

## Navigation

- Left menu, pill nav, or wheel-scroll / vertical swipe to move through
  HERO → NEXT EVENT → PAST NIGHTS → LINEUP → THE ALBUM → CONTACT.
- `Esc` or BACK returns to the hero.

## Quality

- Instancing, no per-frame allocations, DPR capped at 2.
- Responsive: fewer tiles on mobile, optional gyroscope parallax, graceful degrade.
- `prefers-reduced-motion`: clock frozen, static composition, grain stilled.
- Keyboard navigable; visible ember focus states; `Esc` returns to the hero.
