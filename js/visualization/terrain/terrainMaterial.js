import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function createTerrainMaterial({ albedoMap, normalMap, heightMap, displacementScale }) {
  return new THREE.MeshStandardMaterial({
    map: albedoMap,
    normalMap,
    displacementMap: heightMap,
    displacementScale,
    roughness: 0.9,
    metalness: 0.1
  });
}