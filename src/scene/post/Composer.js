import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Post — restrained bloom on the ember highlights + a little film grain
 * and vignette. Deliberately understated: confidence over decoration.
 *
 * Bloom uses a high threshold so only the brightest ember pulses and cream
 * highlights bleed; the charcoal field stays matte. Grain is the final
 * pass and is frozen under prefers-reduced-motion.
 */
const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.05 },
    uVignette: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uVignette;

    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // vignette
      float v = smoothstep(1.25, 0.45, distance(vUv, vec2(0.5)));
      col *= mix(1.0, mix(0.72, 1.0, v), uVignette);

      // animated film grain
      float g = hash(vUv * vec2(1024.0, 540.0) + uTime) - 0.5;
      col += g * uAmount;

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export class Composer {
  constructor(renderer, scene, camera, { reduced = false } = {}) {
    this.renderer = renderer;
    this.reduced = reduced;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // strength, radius, threshold — kept low and high respectively
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.72);
    this.composer.addPass(this.bloom);

    this.grain = new ShaderPass(GrainShader);
    this.grain.uniforms.uVignette.value = 1.0;
    this.grain.uniforms.uAmount.value = reduced ? 0.025 : 0.05;
    this.grain.renderToScreen = true;
    this.composer.addPass(this.grain);
  }

  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * dpr, h * dpr);
  }

  render(time) {
    if (!this.reduced) this.grain.uniforms.uTime.value = time;
    this.composer.render();
  }
}
