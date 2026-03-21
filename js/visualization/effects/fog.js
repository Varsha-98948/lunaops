import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function applySpaceFog(scene) {
  scene.fog = new THREE.FogExp2(0x000000, 0.0005);
}