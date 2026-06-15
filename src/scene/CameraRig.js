import * as THREE from 'three';

/**
 * CameraRig — a PerspectiveCamera with restrained cursor parallax.
 *
 * The camera orbits the origin by at most ~3 degrees, lerped, following
 * the smoothed parallax signal. It also computes the world-space size of
 * the z=0 plane so the TileGrid can be laid out to fill the viewport.
 */
const MAX_ANGLE = THREE.MathUtils.degToRad(3);

export class CameraRig {
  constructor({ distance = 16, fov = 42 } = {}) {
    this.distance = distance;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);

    this._target = new THREE.Vector3(0, 0, 0);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** visible world dimensions of the z=0 plane, for grid layout. */
  worldSize() {
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.distance;
    const w = h * this.camera.aspect;
    return { w, h };
  }

  /** parallax: THREE.Vector2 in [-1,1]; damp in [0,1]. */
  update(parallax, damp, transition) {
    // section view dollies the camera back and lifts it a touch, so opening a
    // section reads as rising up and away from the grid (it recedes into a
    // dim cloud below), not a flat content swap.
    const dist = this.distance * (1 + transition * 0.14);
    const ax = parallax.x * MAX_ANGLE;
    const ay = parallax.y * MAX_ANGLE;

    const tx = Math.sin(ax) * dist;
    const ty = Math.sin(ay) * dist + transition * 1.1;
    const tz = Math.cos(ax) * Math.cos(ay) * dist;

    this.camera.position.x += (tx - this.camera.position.x) * damp;
    this.camera.position.y += (ty - this.camera.position.y) * damp;
    this.camera.position.z += (tz - this.camera.position.z) * damp;
    this.camera.lookAt(this._target);
  }
}
