import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const TEXTURE_PATHS = [
  "./assets/moon_heightmap.png",
  "./assets/moon_albedo.png",
  "./assets/moon_normal.png",
  "./assets/stars.png"
];

function createSolidTexture(hexColor) {
  const color = new THREE.Color(hexColor);
  const data = new Uint8Array([
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
    255
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function loadTextureWithReport(loader, path) {
  return new Promise((resolve) => {
    loader.load(
      path,
      (texture) => {
        console.log(`Texture loaded: ${path}`);
        resolve({ path, texture, ok: true });
      },
      undefined,
      () => {
        console.warn(
          `Missing texture: ${path} — please place this file in ./assets or update the path.`
        );
        resolve({ path, texture: null, ok: false });
      }
    );
  });
}

export async function initTextureVerifierScene(containerId = "three-container") {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container not found: ${containerId}`);
  }

  const loader = new THREE.TextureLoader();
  const results = await Promise.all(
    TEXTURE_PATHS.map((path) => loadTextureWithReport(loader, path))
  );

  const byPath = Object.fromEntries(results.map((r) => [r.path, r.texture]));
  const colorFallback = createSolidTexture("#6f737d");
  const normalFallback = createSolidTexture("#7f7fff");
  const heightFallback = createSolidTexture("#808080");

  const heightMap = byPath["./assets/moon_heightmap.png"] || heightFallback;
  const albedoMap = byPath["./assets/moon_albedo.png"] || colorFallback;
  const normalMap = byPath["./assets/moon_normal.png"] || null;
  const starsMap = byPath["./assets/stars.png"] || null;

  albedoMap.colorSpace = THREE.SRGBColorSpace;
  if (starsMap) {
    starsMap.colorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  scene.background = starsMap || new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 90, 140);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(130, 110, -70);
  sun.castShadow = true;
  scene.add(sun);

  const material = new THREE.MeshStandardMaterial({
    map: albedoMap,
    displacementMap: heightMap,
    displacementScale: 20,
    roughness: 0.9,
    metalness: 0.0,
    normalMap: normalMap || normalFallback
  });

  if (!byPath["./assets/moon_normal.png"]) {
    console.warn(
      "Missing texture: ./assets/moon_normal.png — scene is using a fallback normal texture."
    );
  }
  if (!byPath["./assets/moon_heightmap.png"]) {
    console.warn(
      "Missing texture: ./assets/moon_heightmap.png — scene is using a fallback height texture."
    );
  }
  if (!byPath["./assets/moon_albedo.png"]) {
    console.warn(
      "Missing texture: ./assets/moon_albedo.png — scene is using a fallback albedo texture."
    );
  }
  if (!byPath["./assets/stars.png"]) {
    console.warn(
      "Missing texture: ./assets/stars.png — scene background is using a plain black fallback."
    );
  }

  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 256, 256),
    material
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);

  const robot = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xb04a4a })
  );
  robot.position.set(0, 2, 0);
  robot.castShadow = true;
  robot.receiveShadow = true;
  scene.add(robot);

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  resize();
  window.addEventListener("resize", resize);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();

  return { scene, camera, renderer, robot, textureResults: results };
}
