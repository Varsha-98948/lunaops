import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 120, 200);
  camera.lookAt(0, 0, 0);
  return camera;
}