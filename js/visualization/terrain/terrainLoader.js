import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { createTerrainMaterial } from "./terrainMaterial.js";
import { createTerrainMesh } from "./terrainMesh.js";

export function createTerrainSystem() {
  const textureLoader = new THREE.TextureLoader();
  const heightMap = textureLoader.load("assets/moon_heightmap.png");
  const albedoMap = textureLoader.load("assets/moon_albedo.png");
  const normalMap = textureLoader.load("assets/moon_normal.png");

  heightMap.wrapS = THREE.ClampToEdgeWrapping;
  heightMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.wrapS = THREE.ClampToEdgeWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.wrapS = THREE.ClampToEdgeWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const terrainLod = new THREE.LOD();
  terrainLod.addLevel(
    createTerrainMesh({ segments: 512, material: createTerrainMaterial({ albedoMap, normalMap, heightMap, displacementScale: 35 }) }),
    0
  );
  terrainLod.addLevel(
    createTerrainMesh({ segments: 256, material: createTerrainMaterial({ albedoMap, normalMap, heightMap, displacementScale: 34 }) }),
    220
  );
  terrainLod.addLevel(
    createTerrainMesh({ segments: 96, material: createTerrainMaterial({ albedoMap, normalMap, heightMap, displacementScale: 32 }) }),
    420
  );

  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);

  function sampleHeight(worldX, worldZ) {
    rayOrigin.set(worldX, 300, worldZ);
    raycaster.set(rayOrigin, rayDirection);
    const hits = raycaster.intersectObject(terrainLod, true);
    if (hits.length === 0) return 0;
    return hits[0].point.y;
  }

  function update(camera) {
    terrainLod.update(camera);
  }

  return {
    terrainLod,
    sampleHeight,
    update
  };
}