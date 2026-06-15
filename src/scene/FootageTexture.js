import * as THREE from 'three';

/**
 * FootageTexture — the shared "aftermovie" the whole grid samples.
 *
 * For now it is a procedural smoke + strobe field (ported from the 2D
 * prototype's `field()`), rendered to an off-screen target every frame so
 * it stays alive. The grid samples `.texture`.
 *
 * SWAPPING IN REAL FOOTAGE LATER — one line at the call site:
 *
 *     const video = Object.assign(document.createElement('video'), {
 *       src: '/aftermovie.mp4', loop: true, muted: true, playsInline: true
 *     });
 *     video.play();
 *     tileGrid.setMap(new THREE.VideoTexture(video));   // <-- that's it
 *
 * The grid's material samples whatever texture it's handed; nothing else
 * needs to change.
 */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uReduced;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main(){
    // aspect-correct so the smoke isn't stretched across the grid
    vec2 p = vUv;
    p.x *= uAspect;
    p *= 1.4;

    float t = uReduced > 0.5 ? 20.0 : uTime;
    float drift = t * 0.018;   // slow, smoky drift

    float n  = fbm(p * 2.2 + vec2(drift, -drift * 0.7) + fbm(p * 3.0 - drift) * 0.6);
    float n2 = fbm(p * 5.0 + vec2(-drift * 0.5, drift * 0.3));

    // big, slow low-frequency structure: pools of light in a mostly dark
    // room. This is what keeps the field from reading as a flat orange wall —
    // ember concentrates where the light pools, charcoal owns the rest.
    float room  = fbm(p * 0.85 + vec2(drift * 0.4, 7.0));
    float light = smoothstep(0.40, 0.82, room);

    // locked palette only
    vec3 charcoal = vec3(0.045, 0.04, 0.036);
    vec3 rust     = vec3(0.45, 0.13, 0.012);   // #732103-ish
    vec3 ember    = vec3(1.0, 0.36, 0.0);      // #FF5C00
    vec3 cream    = vec3(0.937, 0.913, 0.863); // #EFE9DC

    // start in deep charcoal; let rust/ember/cream emerge ONLY inside the
    // light pools, so large negative-space pockets stay dark and the mosaic
    // resolves into an image with real contrast instead of uniform noise.
    vec3 col = charcoal;
    col = mix(col, rust,  smoothstep(0.40, 0.70, n) * (0.30 + 0.70 * light));
    col = mix(col, ember, smoothstep(0.70, 0.92, n) * light);
    col = mix(col, cream, smoothstep(0.88, 0.99, n * n2 * 1.7) * light);

    // haze beams raking the room — only where the light reaches
    float beam = smoothstep(0.6, 1.0, sin(p.x * 3.0 + t * 0.05) * 0.5 + 0.5)
               * smoothstep(1.2, 0.2, p.y + 1.0);
    col += cream * beam * 0.05 * light;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class FootageTexture {
  constructor(renderer, { size = 512, reduced = false } = {}) {
    this.renderer = renderer;
    this.reduced = reduced;
    this._staticDone = false;

    this.target = new THREE.WebGLRenderTarget(size, size, {
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uReduced: { value: reduced ? 1 : 0 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false
    });
    // fullscreen triangle
    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this._quad);
  }

  /** the texture the grid samples. */
  get texture() {
    return this.target.texture;
  }

  setAspect(aspect) {
    this.uniforms.uAspect.value = aspect;
  }

  update(time) {
    // when reduced motion is on, render exactly once into a static frame
    if (this.reduced && this._staticDone) return;
    this.uniforms.uTime.value = time;

    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
    this._staticDone = true;
  }

  dispose() {
    this._quad.geometry.dispose();
    this._quad.material.dispose();
    this.target.dispose();
  }
}
