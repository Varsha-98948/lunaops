import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function createTerrainMesh({ segments, material }) {
  const geometry = new THREE.PlaneGeometry(400, 400, segments, segments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}