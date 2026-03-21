import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function addStarfield(scene, texturePath = "assets/stars.jpg") {
  const starTexture = new THREE.TextureLoader().load(texturePath);
  const starfield = new THREE.Mesh(
    new THREE.SphereGeometry(2000, 64, 64),
    new THREE.MeshBasicMaterial({ map: starTexture, side: THREE.BackSide })
  );
  scene.add(starfield);
  return starfield;
}