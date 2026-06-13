import * as THREE from 'three';

/**
 * PointerRig — turns input into two smoothed signals:
 *   - `world`  : a point on the grid plane (z = 0) the cursor hovers over,
 *                used by the tile shader for the "resolve" focus.
 *   - `parallax`: a normalized [-1, 1] vector used to nudge the camera.
 *
 * Inputs: mouse / touch, plus optional device orientation (gyroscope) on
 * mobile. Everything degrades gracefully — no gyro permission just means
 * no gyro parallax. All vectors are preallocated; tick() makes no garbage.
 */
export class PointerRig {
  constructor(camera, { reduced = false } = {}) {
    this.camera = camera;
    this.reduced = reduced;

    // normalized device coords of the raw pointer (-1..1)
    this._ndc = new THREE.Vector2(0, 0);
    // smoothed parallax signal (-1..1)
    this.parallax = new THREE.Vector2(0, 0);
    // smoothed world-space target on the z=0 plane
    this.world = new THREE.Vector3(0, 0, 0);
    // activity 0..1 — surges while the pointer moves, fades when it stops
    this.strength = 0;
    this._lastMove = -1e9;

    // scratch — reused every frame
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this._hit = new THREE.Vector3();
    this._gyro = new THREE.Vector2(0, 0);
    this._active = false;

    this._bind();
  }

  _bind() {
    const onMove = (x, y) => {
      this._ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      this._active = true;
      this._lastMove = performance.now();
    };

    window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: true }
    );

    // Optional gyroscope parallax. We attach the listener unconditionally;
    // if the device never fires it, the gyro signal simply stays at zero.
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      // gamma: left/right [-90,90], beta: front/back [-180,180]
      this._gyro.set(
        THREE.MathUtils.clamp(e.gamma / 30, -1, 1),
        THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1)
      );
      this._active = true;
      this._lastMove = performance.now();
    });
  }

  /**
   * iOS requires a user gesture to request orientation permission. Call
   * this from a click handler; harmless and silent everywhere else.
   */
  requestGyro() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().catch(() => {});
    }
  }

  tick(damp) {
    // Combine pointer ndc with gyro tilt (gyro wins when present)
    const tx = this._ndc.x + this._gyro.x * 0.6;
    const ty = this._ndc.y + this._gyro.y * 0.6;

    if (this.reduced) {
      // freeze at a stable composition, slightly above center
      this.parallax.set(0, 0);
      this.world.set(0, 1.2, 0);
      this.strength = 0;
      return;
    }

    // activity: ~1 while moving, easing to 0 over ~1s after the last move,
    // so the cursor reveal (and the 909) fades out when you stop
    const since = (performance.now() - this._lastMove) / 1000;
    this.strength = Math.max(0, 1 - since / 1.1);

    // smooth the parallax signal
    this.parallax.x += (THREE.MathUtils.clamp(tx, -1, 1) - this.parallax.x) * damp;
    this.parallax.y += (THREE.MathUtils.clamp(ty, -1, 1) - this.parallax.y) * damp;

    // project the raw pointer onto the grid plane
    this._ray.setFromCamera(this._ndc, this.camera);
    if (this._ray.ray.intersectPlane(this._plane, this._hit)) {
      this.world.x += (this._hit.x - this.world.x) * damp;
      this.world.y += (this._hit.y - this.world.y) * damp;
    }
  }
}
