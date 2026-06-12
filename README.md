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
    Clock909.js         16-step / 128 BPM clock — one source of truth
    Director.js         state machine: HERO · NEXT_EVENT · PAST_NIGHTS ·
                        RESIDENTS · ALBUM · CONTACT
    PointerRig.js       cursor → world point + parallax (gyro optional)
  scene/
    TileGrid.js         InstancedMesh + custom shaders (the centerpiece)
    FootageTexture.js   procedural smoke/strobe → render target (swappable)
    CameraRig.js        perspective camera + ~3° parallax
    post/Composer.js    bloom (ember only) + film grain + vignette
  ui/
    layout.js           nav, menu, wordmark, sequencer, close
    sections.js         section panels + content
    styles.css          locked brand system
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

## Quality

- Instancing, no per-frame allocations, DPR capped at 2.
- Responsive: fewer tiles on mobile, optional gyroscope parallax, graceful degrade.
- `prefers-reduced-motion`: clock frozen, static composition, grain stilled.
- Keyboard navigable; visible ember focus states; `Esc` returns to the hero.
