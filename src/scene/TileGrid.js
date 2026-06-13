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
  uniform float uReduced;

  attribute vec2  aCellUV;     // center UV of this tile's texture region
  attribute vec3  aSeed;       // per-tile randoms
  attribute float aColumn;     // mapped sequencer column 0..15

  varying vec2  vCellUV;
  varying vec2  vLocalUV;
  varying float vFocus;
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

    // tile center in world space (instanceMatrix is translation + scale only)
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    // --- cursor focus -------------------------------------------------
    // smooth, generous falloff so the cursor's pull on the image is felt.
    // Per-tile randomness: every tile answers the cursor with its own
    // sensitivity and a slow personal flicker, so the response feels
    // organic rather than a perfect radial stamp.
    float t0 = uReduced > 0.5 ? 0.0 : uTime;
    float gain = mix(0.6, 1.35, hash(aSeed.xy * 19.0));
    float flick = 0.82 + 0.18 * sin(t0 * (0.7 + aSeed.z * 2.4) + aSeed.x * 6.2831);

    float dist  = distance(center.xy, uPointer.xy);
    float focus = 1.0 - smoothstep(0.0, uFocusRadius * gain, dist); // 1 near cursor
    focus = focus * focus * (3.0 - 2.0 * focus);              // ease it
    focus = clamp(focus * flick, 0.0, 1.0);
    focus *= (1.0 - uTransition);                             // no focus mid-section
    vFocus = focus;

    // tilt the tile toward the cursor (reads as rotating toward camera)
    vec2 dir = uPointer.xy - center.xy;
    float dl = length(dir);
    dir = dl > 1e-4 ? dir / dl : vec2(0.0);
    float tilt = focus * 1.05;

    vec3 local = position;
    local = rotX(-dir.y * tilt) * rotY(dir.x * tilt) * local;

    // --- depth --------------------------------------------------------
    float t = uReduced > 0.5 ? 0.0 : uTime;
    float n = noise(center.xy * 0.18 + aSeed.xy * 7.0 + t * 0.05);  // slow idle float
    // idle float; collapses toward the plane under focus (image resolves)
    float zNoise = (n - 0.5) * uDepthAmp * (1.0 - focus * 0.9);
    // focused tiles also lift toward the camera so the cursor "grabs" them
    float zFocus = focus * 1.6;

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
    explode.z -= tr * 2.5;                       // push the cloud back a touch
    local = rotZ(tr * (aSeed.z - 0.5) * 4.0 + tr * sa) * local; // particle spin

    // --- assemble -----------------------------------------------------
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    world.xyz += explode;
    world.z += zNoise + zPush + zFocus + zReact;

    vDepth = world.z;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3  uEmber;
  uniform float uTransition;

  varying vec2  vCellUV;
  varying vec2  vLocalUV;
  varying float vFocus;
  varying float vPulse;
  varying float vReact;
  varying float vDepth;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

  void main(){
    // When unfocused, the tile samples the footage slightly off its true
    // region — the mosaic is scattered. Focus pulls the sample home, so
    // the image resolves under the cursor (the prototype's core trick).
    vec2 jitter = (vec2(hash(vCellUV * 53.0), hash(vCellUV * 91.0)) - 0.5);
    float scatter = (1.0 - vFocus) * (0.16 + uTransition * 0.10);
    vec3 col = texture2D(uMap, vCellUV + jitter * scatter).rgb;

    // resolve brightens the focused region and warms it slightly
    col *= 1.0 + vFocus * 0.22;
    col += uEmber * vFocus * 0.05;

    // sequencer emissive flash — this is what bloom catches
    col += uEmber * vPulse * 0.6;
    // music-reactive tiles glow softly on the kick
    col += uEmber * vReact * 0.28;

    // faint tile border, stronger where unfocused (grid reads as grid)
    vec2 e = smoothstep(0.0, 0.045, vLocalUV) * smoothstep(0.0, 0.045, 1.0 - vLocalUV);
    float frame = min(e.x, e.y);
    col *= mix(1.0, mix(0.78, 0.94, vFocus), 1.0 - frame);

    // dim the scattered cloud so section text stays readable over it
    col *= 1.0 - uTransition * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class TileGrid {
  constructor({ reduced = false, capacityCols = 44, capacityRows = 26 } = {}) {
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
      uDepthAmp: { value: 1.7 },
      uPushAmp: { value: 0.9 },
      uExplodeAmp: { value: 3.6 },
      uSectionSeed: { value: 0 },
      uKick: { value: 0 },
      uAudio: { value: 0 },
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
    this.uniforms.uFocusRadius.value = Math.min(worldW, worldH) * 0.45;
  }

  update(time, pointerWorld, step, env, transition, sectionSeed, kick, audioLevel) {
    this.uniforms.uTime.value = time;
    this.uniforms.uPointer.value.copy(pointerWorld);
    this.uniforms.uStep.value = step;
    this.uniforms.uStepEnv.value = env;
    this.uniforms.uTransition.value = transition;
    this.uniforms.uSectionSeed.value = sectionSeed;
    this.uniforms.uKick.value = kick;
    this.uniforms.uAudio.value = audioLevel;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
