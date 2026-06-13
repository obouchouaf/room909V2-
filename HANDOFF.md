# ROOM 909 — Developer Handoff

A single-page promo site for ROOM 909, an electronic-music event series in
Marrakech themed around the Roland TR-909. The centerpiece is a 3D instanced
tile grid (the "909 mosaic") that samples a shared texture, reacts to the
cursor and to the music, and drives section navigation. This document is the
state of play for the next developer.

/ Branch: `claude/gallant-allen-tjx4wc` /

---

## 1. Stack & how to run

- **Vite** + **Three.js** (`three@^0.170`, ES modules). Post-processing comes
  from `three/examples/jsm/postprocessing/*`.
- No framework, no TypeScript. Plain ES modules + one CSS file.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run preview
```

> IMPORTANT: the project has **not been `npm install`/build-verified** in the
> authoring environment (registry access was blocked there). All modules pass
> `node --check` (syntax), but the first real browser run should be treated as
> the integration test. Nothing exotic is used; expect it to just work, but
> verify in a browser before sharing.

---

## 2. Architecture

Single render loop in `App.js`. One `requestAnimationFrame`. No per-frame
allocations in the hot path (vectors/quaternions are preallocated).

```
index.html → src/main.js → App.js
src/
  App.js                 renderer, render loop, resize, wiring of everything
  core/
    Clock909.js          16-step / 128 BPM clock; single source of truth.
                         Free-runs on rAF delta OR locks to audio transport.
    Director.js          state machine (HERO, NEXT_EVENT, LINEUP, CONTACT)
    PointerRig.js        cursor→world point + parallax + decaying "activity"
                         signal; optional gyroscope
    Audio909.js          <audio> + Web Audio AnalyserNode (kick detect, bass
                         level, beat-phase alignment)
    SwipeNav.js          wheel / vertical swipe / arrow keys → section steps
  scene/
    TileGrid.js          THE CENTERPIECE. InstancedMesh + custom GLSL.
                         Also builds the hidden "909" mask texture.
    FootageTexture.js    procedural smoke/strobe rendered to a RenderTarget
                         each frame; swappable for a VideoTexture
    CameraRig.js         PerspectiveCamera + ~3° lerped parallax
    post/Composer.js     EffectComposer: bloom (ember only) + grain + vignette
  ui/
    layout.js            chrome: nav, centre menu, wordmark, sequencer,
                         GET TICKETS, BACK, Rhythm Composer popup, audio gate
    sections.js          section content data + DOM, incl. the lineup stage
    styles.css           the entire brand system (locked palette/type)
public/
  room909.mp3            current soundtrack (Kevin Saunderson / Joris Voorn
                         mix, ~128 BPM). Loops.
```

### Data flow per frame (`App._frame`)
1. `audio.tick(dt)` → updates `level`, `kick`, `syncedTime`.
2. `clock.tick(dt)` → if audio playing, reads `audio.syncedTime`; else free-runs.
   Emits step changes to the DOM sequencer cells.
3. Lerp `_transition` (0 hero → 1 section) and `_sectionSeed` (per-section
   scatter rotation).
4. `pointer.tick()` → smoothed world point, parallax, and `strength`
   (1 while moving, decays to 0 ~1.1s after the last move).
5. `footage.update(time)` → re-render the procedural texture.
6. `grid.update(...)` and `cameraRig.update(...)` → push uniforms.
7. `composer.render(time)`.

---

## 3. The tile grid (read this before touching shaders)

`scene/TileGrid.js` — one `InstancedMesh` of thin boxes, one draw call.

- **Per-instance attributes:** `aCellUV` (which region of the shared texture
  this tile samples), `aSeed` (vec3 randoms), `aColumn` (0–15 sequencer
  column the tile belongs to).
- **Capacity-based layout:** buffers are allocated for the max grid
  (`capacityCols=56 × capacityRows=34`) and `layout()` just rewrites matrices
  and sets `mesh.count` on resize — no realloc, no dispose churn.
- **Tile count is size-driven, not fixed:** `App.resize()` targets a constant
  on-screen tile size (~38px mobile, ~50px desktop), so phones get a denser
  grid instead of huge tiles.

### Vertex shader does all motion on the GPU
- Idle depth float from noise.
- **Cursor focus** (`focus`) = radial falloff around `uPointer`, eased, with
  per-tile `gain`/`flick` randomness so it isn't a clean stamp.
  `focus *= uActive` — the whole interaction is gated on pointer activity, so
  it surges while moving and calms when idle.
- Focused tiles: tilt toward camera, lift in z, slight in-plane magnetism,
  soft ripple ring.
- **Sequencer pulse:** active column gets a z-push; rides `uKick` (music) and
  falls back to the step envelope.
- **Music reaction:** a rotating random ~quarter of tiles bumps forward on
  each kick; bass `uAudio` breathes through.
- **Transition:** tiles scatter into a spinning, dimmed particle cloud behind
  section content (`uTransition`), rotated per section by `uSectionSeed`.

### Fragment shader
- Samples the footage at a scattered UV when unfocused; the scatter collapses
  under the cursor so the image "resolves."
- **Trippy chromatic split:** R/G/B sampled at a small offset that wobbles
  over time and intensifies near the cursor.
- **The hidden 909:** a separate glyph-mask texture (`uMark`) sampled at the
  tile's full-image UV (`vFullUV`), revealed ONLY where `vReveal` (cursor
  activity) is high. Invisible at rest; the cursor "scratches" it into view.
  Reduced-motion shows a faint steady version.

### Key tunables (uniforms set in the constructor / shader constants)
| What | Where | Current |
|---|---|---|
| Cursor reach | `uFocusRadius` (set in `layout()`) | `min(worldW,worldH)*0.4` |
| Cursor lift | `zFocus` in VERT | `focus * 1.7` |
| Tilt strength | `tilt` in VERT | `focus * 1.15` |
| In-plane magnetism | `world.xy += dir*focus*` | `0.3` |
| Ripple | `ripple` in VERT | `* 0.4` |
| Chromatic split | `ca` in FRAG | `0.004 + vFocus*0.010` |
| 909 brightness | `mark*vReveal` mix in FRAG | full ember + hot highlight |
| Activity decay | `PointerRig.tick` | `1 - since/1.1` (s) |

---

## 4. Music & sync

`core/Audio909.js`. The track starts on the visitor's **first click or
keypress** (browser autoplay requires a gesture — there is no longer an ENTER
gate). A Web Audio `AnalyserNode` (fftSize 2048) reads the low end:

- `level` — smoothed bass energy (fast attack / slow release).
- `kick` — 1→0 envelope retriggered on detected onsets.
- `syncedTime` — `currentTime` minus an estimated beat-phase offset, so the
  16-step grid lands on the actual kick even if the file doesn't start on a
  downbeat.

`Clock909.useTimeSource(getTime, isActive)` binds the clock to this. **Mute**
(SOUND toggle in the pill nav) routes through a `GainNode` so analysis/sync
keep running while silent.

**Swap the track:** drop a file at `public/room909.mp3`, or at runtime
`window.__room909.audio.setSource('/x.mp3')`. Detection assumes ~128 BPM; for
other tempos change `BEAT_DUR` in `Audio909.js` and `bpm` in `App.js`.

**Swap the footage for real video** (architected for one line):
```js
const v = Object.assign(document.createElement('video'),
  { src:'/aftermovie.mp4', loop:true, muted:true, playsInline:true });
v.play();
window.__room909.grid.setMap(new THREE.VideoTexture(v));
```

---

## 5. Navigation & state

`core/Director.js` holds the active state. No `display:none` — sections are
real DOM toggled by an `.active` class, and the canvas reacts via the lerped
`_transition`. Ways to move:
- Left **centre menu**, the pill **nav**, **wheel scroll**, **vertical swipe**,
  **arrow / page keys**. Order: HERO → NEXT EVENT → LINEUP → CONTACT.
- The menu stays visible (dimmed) inside sections so you can jump section→
  section directly. **Esc** or the **BACK** pill returns to hero.

The **Rhythm Composer** link in the wordmark opens a popup about the TR-909.

---

## 6. Sections / content

`ui/sections.js`, driven by a `CONTENT` map (easy to edit):
- **NEXT EVENT** — date / location / sound / format + a GET TICKETS CTA.
- **LINEUP** — a names list (desktop) beside a full-bleed reveal **stage**.
  Hover/focus a name (desktop) or swipe / ‹ › arrows + `NN / NN` counter
  (mobile) to switch artists. Each artist renders a deterministic **mosaic
  portrait** (palette tiles + initials, generated from a name hash) that
  resolves in with a staggered animation, plus bio + links.
- **CONTACT** — email / socials + a `mailto:` CTA.
- (PAST NIGHTS and THE ALBUM were intentionally removed — first event only.)

---

## 7. Brand (locked — do not deviate)

- Palette ONLY: charcoal `#141210`, cream `#EFE9DC`, ember `#FF5C00`,
  rust `#732103`. CSS vars in `styles.css`.
- Type ONLY: **Share Tech Mono**, small, uppercase, wide letter-spacing.
- Colour management is intentionally **disabled** (`THREE.ColorManagement.
  enabled = false`) so shader colours render as authored sRGB and match the
  original 2D prototype exactly. Keep this in mind if you add lit materials.

---

## 8. Quality / accessibility

- One draw call (instancing), DPR capped at 2, no per-frame allocs.
- `prefers-reduced-motion`: clock frozen, grain stilled, tiles static, the
  909 shown faint+steady instead of cursor-gated.
- Keyboard navigable; visible **ember focus rings**; Esc closes sections/popup.
- Mobile: denser-but-fewer tiles, swipe everywhere, sections scroll, optional
  gyroscope parallax (degrades silently without permission).

---

## 9. Open TODOs / placeholders

1. **Ticket URL** — placeholder `https://shotgun.live/` in two places:
   `ui/layout.js` (GET TICKETS pill) and `ui/sections.js` (NEXT EVENT CTA).
2. **Artist data** — names, bios, set times and social links in
   `ui/sections.js` `CONTENT[LINEUP].lineup` are evocative placeholders.
3. **Artist photos** — currently generated mosaic portraits. Real photography
   can replace `makeMosaic()` output; keep the resolve animation for theme.
4. **Aftermovie video** — wire a real `<video>` via `grid.setMap(...)` (see §4).
5. **Contact details** — `room909@marrakech.net`, `@ROOM909` are placeholders.
6. **Verify in-browser** — first true run + a perf pass on a mid laptop and a
   real phone (watch the analyser on Safari/iOS; confirm gyro permission UX).

---

## 10. Gotchas

- `instanceMatrix` is relied on in a custom `ShaderMaterial`; Three injects it
  because the object `isInstancedMesh`. Keep per-instance matrices to
  translation+scale only (no rotation) — the shader rotates in local space.
- The 909 mask is a 2D canvas texture (`makeMarkTexture` in `TileGrid.js`),
  redrawn once `document.fonts.ready` resolves so it uses Share Tech Mono.
- `window.__room909` exposes the `App` instance for console tinkering
  (`.grid`, `.audio`, etc.).
