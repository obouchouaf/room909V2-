import * as THREE from 'three';

/**
 * TileGrid — the centerpiece.
 *
 * A single InstancedMesh of thin boxes (one draw call) floating in z-space.
 * Every tile samples a shared texture (the FootageTexture, or later a
 * VideoTexture) at its own region, reconstructing the image as a mosaic.
 *
 * All motion happens on the GPU in the vertex shader:
 *   - idle z-displacement from noise (tiles float in depth)
 *   - cursor focus: tiles near the pointer rotate toward the camera,
 *     scatter collapses, and the image "resolves"
 *   - sequencer pulse: the active column gets a z-push + emissive flash
 *   - transition: tiles fly apart / re-form when a section opens/closes
 *
 * Layout is capacity-based: we allocate buffers for the largest grid we
 * will ever show and just change `count` on resize — no per-resize
 * allocation, no dispose churn.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3  uPointer;      // world point on the z=0 plane
  uniform float uFocusRadius;
  uniform float uTransition;   // 0 hero (formed) .. 1 section (scattered)
  uniform float uStep;         // active sequencer column 0..15
  uniform float uStepEnv;      // 1 -> 0 within the step
  uniform float uDepthAmp;     // idle float depth
  uniform float uPushAmp;      // sequencer z-push
  uniform float uExplodeAmp;   // transition scatter distance
  uniform float uSectionSeed;  // per-section scatter rotation (lerped)
  uniform float uKick;         // 1 -> 0 on each detected kick in the music
  uniform float uAudio;        // smoothed bass level 0..1
  uniform float uActive;       // pointer activity 0..1 (decays when idle)
  uniform float uVelocity;     // smoothed pointer speed 0..1 (amplifies all)
  uniform float uBaseReveal;   // reveal floor for reduced motion
  uniform float uRevealAmount; // 0..1 how far the word has built up on hover
  uniform vec2  uCellSize;     // (1/cols, 1/rows) in texture UV
  uniform vec2  uRevealHalf;   // half-size (world) of the centred reveal zone
  uniform float uReduced;

  attribute vec2  aCellUV;     // center UV of this tile's texture region
  attribute vec3  aSeed;       // per-tile randoms
  attribute float aColumn;     // mapped sequencer column 0..15

  varying vec2  vCellUV;
  varying vec2  vFullUV;       // UV across the whole image (crisp 909)
  varying vec2  vLocalUV;
  varying float vFocus;
  varying float vReveal;
  varying float vPulse;
  varying float vReact;
  varying float vDepth;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
  mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
  mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

  void main(){
    vLocalUV = uv;
    vCellUV  = aCellUV;
    vFullUV  = aCellUV + (uv - 0.5) * uCellSize;   // crisp 909 across tiles

    // tile center in world space (instanceMatrix is translation + scale only)
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    // --- cursor focus -------------------------------------------------
    // smooth, generous falloff so the cursor's pull on the image is felt.
    // Per-tile randomness: every tile answers the cursor with its own
    // sensitivity and a slow personal flicker, so the response feels
    // organic rather than a perfect radial stamp.
    float t0 = uReduced > 0.5 ? 0.0 : uTime;
    float gain = mix(0.7, 1.5, hash(aSeed.xy * 19.0));
    float flick = 0.78 + 0.22 * sin(t0 * (0.8 + aSeed.z * 2.8) + aSeed.x * 6.2831);

    float dist  = distance(center.xy, uPointer.xy);
    float spatial = 1.0 - smoothstep(0.0, uFocusRadius * gain, dist); // 1 near cursor
    spatial = spatial * spatial * (3.0 - 2.0 * spatial);      // ease it
    spatial = clamp(spatial * flick, 0.0, 1.0);
    spatial *= (1.0 - uTransition);                           // no focus mid-section

    // gate the 3D resolve on pointer activity: it surges while the cursor
    // moves and fades when it stops.
    float focus = spatial * uActive;
    vFocus = focus;

    // ONE centred word inside a soft ellipse. While the cursor hovers in it,
    // the whole word box dims LIGHTLY (the faded word shows through), and the
    // tiles right under the cursor PART AWAY + dim hard — so you scratch
    // across to uncover the word, the cursor clearing space as it goes.
    vec2 rn = center.xy / max(uRevealHalf, vec2(1e-3));
    float region = 1.0 - smoothstep(0.7, 1.18, length(rn));        // tile in word box
    region = region * region * (3.0 - 2.0 * region);
    vec2 prn = uPointer.xy / max(uRevealHalf, vec2(1e-3));
    float overCursor = 1.0 - smoothstep(0.6, 1.3, length(prn));    // cursor inside box

    // the cursor's MAGNETIC FIELD: a circle around the pointer where the tiles
    // are cleared first — the leading edge of the reveal that scratches open.
    float dcur = distance(center.xy, uPointer.xy);
    float field = 1.0 - smoothstep(0.0, uFocusRadius * 0.62, dcur);
    field = field * field;

    // how cleared this tile is: the cursor's field opens it locally, while the
    // built-up hover amount (uRevealAmount, 0..1) lifts the WHOLE word region
    // over ~0.9s and holds it open. Whichever is stronger wins, so the word
    // emerges from the cursor outward and stays once fully built.
    float clear = max(field * overCursor, uRevealAmount);
    float part = region * (1.0 - uTransition) * clear;
    vReveal = clamp(part + uBaseReveal * (1.0 - uTransition), 0.0, 1.0);
    float calm = 1.0 - vReveal;

    // faster movement amplifies everything — flicks feel kinetic
    float amp = 1.0 + uVelocity * 1.4;

    // tilt the tile toward the cursor (rotates toward the camera). Text
    // tiles stay flat (calm) so the revealed word doesn't fragment.
    vec2 dir = uPointer.xy - center.xy;
    float dl = length(dir);
    dir = dl > 1e-4 ? dir / dl : vec2(0.0);
    float tilt = focus * 1.0 * amp * calm;

    vec3 local = position;
    local = rotX(-dir.y * tilt) * rotY(dir.x * tilt) * local;
    // a little extra spin on fast moves
    local = rotZ(focus * uVelocity * 0.7 * (aSeed.z - 0.5) * 4.0 * calm) * local;

    // --- depth --------------------------------------------------------
    float t = uReduced > 0.5 ? 0.0 : uTime;
    // always-alive idle float so the grid breathes like particles
    float n = noise(center.xy * 0.18 + aSeed.xy * 7.0 + t * 0.06);
    float zNoise = (n - 0.5) * uDepthAmp * (1.0 - focus * 0.9) * calm;
    // focused tiles lift toward the camera — lively, but flat on text
    float zFocus = focus * 1.6 * amp * calm;

    // expanding ripple rings emanate from the cursor — like a stone dropped
    // in z-space, travelling outward over time.
    float rfall = 1.0 - smoothstep(0.0, uFocusRadius * 2.4, dist);
    float ringR = fract(t * 0.5) * uFocusRadius * 2.4;     // wavefront radius
    float ring = exp(-pow((dist - ringR) * 1.7, 2.0));      // gaussian ring
    float wave = sin(dist * 3.0 - t * 6.0) * 0.22;
    float ripple = (ring * 0.6 + wave) * rfall * (0.3 + uVelocity * 0.9) * uActive * calm;

    // fisheye lens: cluster tiles near the cursor centre, stretch the
    // surrounding ring outward — a warp in the resolve zone
    float rN = dist / max(uFocusRadius, 1e-3);
    float lensPull = focus * (1.0 - clamp(rN, 0.0, 1.0)) * calm;
    float lensPush = smoothstep(0.45, 1.1, rN) * focus * 0.35 * calm;

    // sequencer column pulse — the column flash rides the music's kick
    // (uKick is 1 on each detected onset; falls back to the step env)
    float beat = max(uStepEnv * 0.55, uKick);
    float pulse = (1.0 - step(0.5, abs(aColumn - uStep))) * beat;
    vPulse = pulse;
    float zPush = pulse * uPushAmp;

    // --- music reaction -------------------------------------------------
    // a random scattering of tiles bumps with the bass: each kick picks
    // roughly a quarter of the grid (by seed) and shoves it forward
    float gate = step(0.72, fract(aSeed.z * 7.0 + floor(uTime * 0.5)));
    float react = gate * uKick;
    vReact = react;
    float zReact = react * (0.6 + aSeed.x * 1.2) + uAudio * (aSeed.y - 0.5) * 0.5;

    // --- transition (scatter into a living cloud, not off-screen) ------
    // tiles drift apart, spin and settle into a dim backdrop behind the
    // section text — they never leave the frame. uSectionSeed rotates the
    // scatter pattern per section, so moving section -> section visibly
    // swirls the cloud into a new arrangement.
    float tr = uTransition;
    vec3 outDir = normalize(aSeed - 0.5 + 1e-4);
    float sa = uSectionSeed * (0.6 + aSeed.y);
    outDir = rotZ(sa) * outDir;
    vec3 explode = outDir * tr * uExplodeAmp;
    explode.z -= tr * 1.5;                       // push the cloud back a touch
    local = rotZ(tr * (aSeed.z - 0.5) * 2.5 + tr * sa) * local; // gentle spin

    // --- assemble -----------------------------------------------------
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    world.xyz += explode;
    // fisheye lens: pull in near the cursor centre, push the ring outward
    world.xy += dir * (focus * 0.2 + lensPull * 0.5) * amp;
    world.xy -= dir * lensPush * amp;
    world.z += zNoise + zPush + zFocus + zReact + ripple;
    // whole grid breathes forward on every detected kick — but not the flat
    // reveal zone, so the word stays steady
    world.z += uKick * (0.18 + aSeed.x * 0.25) * calm;

    // the magnetic field physically repels the tiles out of its circle (no
    // fade — they move), opening a clear gap for the word beneath. A per-tile
    // jitter keeps even the dead-centre tile moving.
    vec2 awayDir = (center.xy - uPointer.xy) + (aSeed.xy - 0.5) * 0.6;
    float al = length(awayDir);
    awayDir = al > 1e-4 ? awayDir / al : vec2(0.0);
    world.xy += awayDir * part * 3.4;     // shoved aside
    world.z -= part * 1.8;                 // and sunk back, opening a gap

    vDepth = world.z;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3  uEmber;
  uniform float uTransition;
  uniform float uTime;
  uniform float uVelocity;     // pointer speed 0..1
  uniform float uKick;         // 1 -> 0 on each detected kick
  uniform float uAttract;      // idle attract 0..1
  uniform float uAttractPulse; // beat pulse during the attract hold

  varying vec2  vCellUV;
  varying vec2  vFullUV;
  varying vec2  vLocalUV;
  varying float vFocus;
  varying float vReveal;
  varying float vPulse;
  varying float vReact;
  varying float vDepth;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

  void main(){
    // When unfocused, the tile samples the footage well off its true
    // region — the mosaic is scattered. Focus pulls the sample home, so
    // the image resolves sharply under the cursor (the core trick).
    vec2 jitter = (vec2(hash(vCellUV * 53.0), hash(vCellUV * 91.0)) - 0.5);
    // a coherent image at rest (reads like the footage), scattering a little
    // when out of focus and a touch more during section transitions
    float scatter = (1.0 - vFocus) * (0.09 + uTransition * 0.12) + vFocus * uVelocity * 0.05;
    vec2 sampUV = vCellUV + jitter * scatter;

    // trippy chromatic split — a slow wobble, stronger near the cursor. It is
    // killed inside the reveal so the hidden text reads crisp, not fringed.
    float ca = (0.003 + vFocus * 0.006) * (1.0 + uVelocity * 1.2)
             * (0.6 + 0.4 * sin(uTime * 0.7 + vCellUV.x * 6.0)) * (1.0 - vReveal);
    vec2 cao = vec2(ca, ca * 0.4);
    vec3 col;
    col.r = texture2D(uMap, sampUV + cao).r;
    col.g = texture2D(uMap, sampUV).g;
    col.b = texture2D(uMap, sampUV - cao).b;

    // (no hover brightening — the resolve sharpens via reduced scatter only)

    // (no opacity on tiles — the word's gap is opened by physically pushing
    // the tiles aside, not by fading them)

    // sequencer emissive flash — this is what bloom catches
    col += uEmber * vPulse * 0.6;
    // music-reactive tiles glow softly on the kick
    col += uEmber * vReact * 0.28;
    // and the whole grid lifts a touch on the kick (synced to the music)
    col *= 1.0 + uKick * 0.06;

    // very faint tile seams — present but not a hard grid. Suppressed inside
    // the reveal so the text isn't broken up by dark gaps.
    vec2 e = smoothstep(0.0, 0.04, vLocalUV) * smoothstep(0.0, 0.04, 1.0 - vLocalUV);
    float frame = min(e.x, e.y);
    col *= mix(1.0, mix(0.9, 0.97, vFocus), (1.0 - frame) * (1.0 - vReveal));

    // dim the scattered cloud so section text stays readable over it
    col *= 1.0 - uTransition * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class TileGrid {
  constructor({ reduced = false, capacityCols = 56, capacityRows = 34 } = {}) {
    this.reduced = reduced;
    this.capCols = capacityCols;
    this.capRows = capacityRows;
    this.capacity = capacityCols * capacityRows;

    // thin box — real depth so edges catch light when tilted
    const geo = new THREE.BoxGeometry(1, 1, 0.12);

    this.uniforms = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector3() },
      uFocusRadius: { value: 4.5 },
      uTransition: { value: 0 },
      uStep: { value: 0 },
      uStepEnv: { value: 0 },
      uDepthAmp: { value: 1.5 },
      uPushAmp: { value: 0.8 },
      uExplodeAmp: { value: 2.4 },
      uSectionSeed: { value: 0 },
      uKick: { value: 0 },
      uAudio: { value: 0 },
      uActive: { value: 0 },
      uVelocity: { value: 0 },
      uBaseReveal: { value: reduced ? 0.28 : 0 },
      uRevealAmount: { value: 0 },
      uCellSize: { value: new THREE.Vector2(0.05, 0.05) },
      uRevealHalf: { value: new THREE.Vector2(5, 2) },
      uAttract: { value: 0 },
      uAttractPulse: { value: 0 },
      uReduced: { value: reduced ? 1 : 0 },
      uMap: { value: null },
      uEmber: { value: new THREE.Color(0xff5c00) }
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, this.capacity);
    this.mesh.frustumCulled = false; // tiles move well beyond their base cell

    // per-instance attributes
    this._cellUV = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 2), 2);
    this._seed = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    this._column = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 1), 1);
    this._cellUV.setUsage(THREE.DynamicDrawUsage);
    this._column.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCellUV', this._cellUV);
    geo.setAttribute('aSeed', this._seed);
    geo.setAttribute('aColumn', this._column);

    // seeds are stable across layouts — fill once
    for (let i = 0; i < this.capacity; i++) {
      this._seed.setXYZ(i, Math.random(), Math.random(), Math.random());
    }
    this._seed.needsUpdate = true;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._pos = new THREE.Vector3();
    this._scl = new THREE.Vector3();

    this.cols = 0;
    this.rows = 0;
  }

  /** swap the sampled texture (procedural footage now, video later). */
  setMap(texture) {
    this.uniforms.uMap.value = texture;
  }

  /**
   * Lay out the grid to cover `worldW x worldH` at z=0 with `cols x rows`
   * tiles. Writes into preallocated buffers and sets the live instance
   * count — safe to call on every resize.
   */
  layout(worldW, worldH, cols, rows) {
    cols = Math.min(cols, this.capCols);
    rows = Math.min(rows, this.capRows);
    this.cols = cols;
    this.rows = rows;

    const tileW = worldW / cols;
    const tileH = worldH / rows;
    const fill = 1.04; // slight overlap hides seams during parallax
    const x0 = -worldW / 2 + tileW / 2;
    const y0 = -worldH / 2 + tileH / 2;

    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this._pos.set(x0 + c * tileW, y0 + r * tileH, 0);
        this._scl.set(tileW * fill, tileH * fill, 1);
        this._m.compose(this._pos, this._q, this._scl);
        this.mesh.setMatrixAt(i, this._m);

        // texture region for this tile (v flipped so image is upright)
        this._cellUV.setXY(i, (c + 0.5) / cols, 1 - (r + 0.5) / rows);
        // map this tile's screen column to one of 16 sequencer steps
        this._column.setX(i, Math.floor((c / cols) * 16));
        i++;
      }
    }

    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this._cellUV.needsUpdate = true;
    this._column.needsUpdate = true;

    // focus radius scales with the world so the resolve feels consistent
    this.uniforms.uFocusRadius.value = Math.min(worldW, worldH) * 0.4;
    // tile size in texture UV, so the mask samples crisply across tiles
    this.uniforms.uCellSize.value.set(1 / cols, 1 / rows);
    // the centred reveal ellipse — where the DOM info text appears on hover.
    // On portrait/narrow screens the word spans most of the width, so widen
    // the cleared zone to match (otherwise the tiles part in a patch that's
    // narrower than the text sitting on top of them).
    const portrait = worldH > worldW;
    const hx = portrait ? 0.46 : 0.3;
    const hy = portrait ? 0.1 : 0.12;
    this.uniforms.uRevealHalf.value.set(worldW * hx, worldH * hy);
  }

  // no-op kept so the (disabled) attract path stays harmless
  setMarkText() {}

  update(opts) {
    const u = this.uniforms;
    u.uTime.value = opts.time;
    u.uPointer.value.copy(opts.pointerWorld);
    u.uStep.value = opts.step;
    u.uStepEnv.value = opts.env;
    u.uTransition.value = opts.transition;
    u.uSectionSeed.value = opts.sectionSeed;
    u.uKick.value = opts.kick;
    u.uAudio.value = opts.audioLevel;
    u.uActive.value = opts.active;
    u.uVelocity.value = opts.velocity;
    u.uAttract.value = opts.attract;
    u.uAttractPulse.value = opts.attractPulse;
    u.uRevealAmount.value = opts.revealAmount || 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
