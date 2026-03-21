import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MISSION_TARGETS } from "./state.js";

const TERRAIN_SEGMENTS = 256;
const EYE_HEIGHT = 2.5;
const TERRAIN_SIZE = 820;
const TERRAIN_HALF_SIZE = TERRAIN_SIZE / 2;
const TERRAIN_GRID_WIDTH = TERRAIN_SEGMENTS + 1;

function createRoverFrontRig() {
  const rig = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d3643,
    roughness: 0.84,
    metalness: 0.26
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x7e8796,
    roughness: 0.52,
    metalness: 0.48
  });
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ccae0,
    roughness: 0.18,
    metalness: 0.14,
    transparent: true,
    opacity: 0.82
  });

  const basePanel = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.42, 1.15), bodyMaterial);
  basePanel.position.set(0, -1.44, -3.35);
  basePanel.castShadow = true;
  basePanel.receiveShadow = true;
  rig.add(basePanel);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.16, 0.34), accentMaterial);
  frontLip.position.set(0, -1.28, -2.82);
  rig.add(frontLip);

  const lensHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.24, 20), accentMaterial);
  lensHousing.rotation.x = Math.PI / 2;
  lensHousing.position.set(0, -1.05, -2.56);
  rig.add(lensHousing);

  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 18), lensMaterial);
  lens.position.set(0, -1.05, -2.38);
  rig.add(lens);

  const armGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.55, 12);
  const leftArm = new THREE.Mesh(armGeometry, accentMaterial);
  leftArm.position.set(-1.16, -1.08, -3.02);
  leftArm.rotation.z = -0.66;
  leftArm.rotation.x = Math.PI / 2.6;
  rig.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 1.16;
  rightArm.rotation.z = 0.66;
  rig.add(rightArm);

  const strutGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 10);
  const leftStrut = new THREE.Mesh(strutGeometry, accentMaterial);
  leftStrut.position.set(-0.76, -1.05, -2.88);
  leftStrut.rotation.z = -0.22;
  leftStrut.rotation.x = Math.PI / 2.4;
  rig.add(leftStrut);

  const rightStrut = leftStrut.clone();
  rightStrut.position.x = 0.76;
  rightStrut.rotation.z = 0.22;
  rig.add(rightStrut);

  return rig;
}

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

function applyShadowSettings(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function registerBobbingPart(mesh) {
  mesh.userData.baseYCaptured = false;
  return mesh;
}

function createInspectionStation(position) {
  const group = new THREE.Group();
  const supportMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.62,
    roughness: 0.4
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x222244,
    metalness: 0.72,
    roughness: 0.28
  });
  const panelFrameMaterial = new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 0.42,
    roughness: 0.5
  });
  const indicatorMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x00aaff,
    emissiveIntensity: 0.24,
    metalness: 0.38,
    roughness: 0.34
  });

  const basePad = new THREE.Mesh(new THREE.BoxGeometry(30, 0.45, 8.5), supportMaterial);
  basePad.position.y = 0.22;
  group.add(basePad);

  const panelRotators = [];
  const rowOffsets = [-10.5, -3.5, 3.5, 10.5];
  rowOffsets.forEach((xOffset, index) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.25, 10), supportMaterial);
    stand.position.set(xOffset, 1.12, index % 2 === 0 ? -0.35 : 0.35);
    group.add(stand);

    const rearBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.55, 8), supportMaterial);
    rearBrace.position.set(xOffset - 0.7, 1.45, -0.95);
    rearBrace.rotation.z = 0.42;
    group.add(rearBrace);

    const panelGroup = new THREE.Group();
    panelGroup.position.set(xOffset, 2.25, 0);
    panelGroup.rotation.x = -Math.PI / 6;
    panelGroup.rotation.y = -0.18 + index * 0.05;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.18, 3.2), panelFrameMaterial);
    panelGroup.add(frame);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.08, 2.7), panelMaterial);
    panel.position.y = 0.06;
    panelGroup.add(panel);

    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), indicatorMaterial);
    indicator.position.set(2.65, 0.12, 1.18);
    panelGroup.add(indicator);

    panelRotators.push(panelGroup);
    group.add(panelGroup);
  });

  const serviceCabinet = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 2.6), supportMaterial);
  serviceCabinet.position.set(-13.2, 1, 2.2);
  group.add(serviceCabinet);

  const junctionBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.2), panelFrameMaterial);
  junctionBox.position.set(13.1, 0.72, -2.3);
  group.add(junctionBox);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8, 10), supportMaterial);
  mast.position.set(-13.2, 2.6, 2.25);
  group.add(mast);

  const mastLight = registerBobbingPart(
    new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), indicatorMaterial)
  );
  mastLight.position.set(-13.2, 4.2, 2.25);
  group.add(mastLight);

  group.position.copy(position);
  group.userData = {
    lights: [indicatorMaterial],
    rotators: panelRotators,
    bobbers: [mastLight]
  };
  applyShadowSettings(group);
  return group;
}

function createMaintenanceStation(position) {
  const group = new THREE.Group();
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.64,
    roughness: 0.36
  });
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    metalness: 0.54,
    roughness: 0.5
  });
  const dishMaterial = new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 0.42,
    roughness: 0.42
  });
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x00aaff,
    emissiveIntensity: 0.26,
    metalness: 0.4,
    roughness: 0.34
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.1, 8.2), baseMaterial);
  base.position.y = 1.05;
  group.add(base);

  const sideStation = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.8, 3.6), towerMaterial);
  sideStation.position.set(-3.4, 2.05, 1.4);
  group.add(sideStation);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 11.2, 14), towerMaterial);
  tower.position.set(2.8, 6.1, -0.8);
  group.add(tower);

  const towerBraceA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.4, 8), towerMaterial);
  towerBraceA.position.set(1.2, 3.7, -2.2);
  towerBraceA.rotation.z = 0.34;
  group.add(towerBraceA);

  const towerBraceB = towerBraceA.clone();
  towerBraceB.position.set(4.4, 3.7, 0.4);
  towerBraceB.rotation.z = -0.32;
  group.add(towerBraceB);

  const dishPivot = new THREE.Group();
  dishPivot.position.set(2.8, 8.4, -0.8);
  group.add(dishPivot);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 18, 18, 0, Math.PI, 0, Math.PI / 2),
    dishMaterial
  );
  dish.rotation.x = Math.PI / 2;
  dish.rotation.z = -0.18;
  dishPivot.add(dish);

  const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), towerMaterial);
  dishArm.position.set(0, -1.5, 0);
  dishArm.rotation.z = 0.22;
  dishPivot.add(dishArm);

  const dishHub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 12), towerMaterial);
  dishHub.rotation.x = Math.PI / 2;
  dishPivot.add(dishHub);

  const tipLight = registerBobbingPart(
    new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), lightMaterial)
  );
  tipLight.position.set(2.8, 11.9, -0.8);
  group.add(tipLight);

  const relayBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.8), towerMaterial);
  relayBox.position.set(5, 1.15, 2.4);
  group.add(relayBox);

  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.8, 10), towerMaterial);
  conduit.position.set(4, 1.55, 1.1);
  conduit.rotation.z = Math.PI / 2;
  group.add(conduit);

  group.position.copy(position);
  group.userData = {
    lights: [lightMaterial],
    rotators: [dishPivot],
    bobbers: [tipLight]
  };
  applyShadowSettings(group);
  return group;
}

function createResearchStation(position) {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.56,
    roughness: 0.44
  });
  const domeMaterial = new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 0.48,
    roughness: 0.32
  });
  const equipmentMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.42,
    roughness: 0.38
  });
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x00aaff,
    emissiveIntensity: 0.22,
    metalness: 0.38,
    roughness: 0.34
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.4, 1.15, 24), baseMaterial);
  base.position.y = 0.58;
  group.add(base);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6.1, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMaterial
  );
  dome.position.y = 1.15;
  group.add(dome);

  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(6.15, 0.12, 12, 34), lightMaterial);
  domeRing.position.y = 1.22;
  domeRing.rotation.x = Math.PI / 2;
  group.add(domeRing);

  const equipmentPivot = new THREE.Group();
  equipmentPivot.position.set(3.6, 1.2, 0.8);
  group.add(equipmentPivot);

  const equipment = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.1, 2), equipmentMaterial);
  equipment.position.y = 1.02;
  equipmentPivot.add(equipment);

  const equipmentTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12), baseMaterial);
  equipmentTop.position.set(0, 2.25, 0);
  equipmentPivot.add(equipmentTop);

  const equipmentLight = registerBobbingPart(
    new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), lightMaterial)
  );
  equipmentLight.position.set(0.6, 2.55, 0.45);
  equipmentPivot.add(equipmentLight);

  const rearUnit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.6), equipmentMaterial);
  rearUnit.position.set(-4.2, 0.95, -2.2);
  group.add(rearUnit);

  const servicePod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.8, 12), baseMaterial);
  servicePod.rotation.z = Math.PI / 2;
  servicePod.position.set(-2.7, 1.05, 3.6);
  group.add(servicePod);

  group.position.copy(position);
  group.userData = {
    lights: [lightMaterial],
    rotators: [equipmentPivot],
    bobbers: [equipmentLight]
  };
  applyShadowSettings(group);
  return group;
}

export function initScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Missing scene container: ${containerId}`);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 30, 200);

  const camera = new THREE.PerspectiveCamera(76, 1, 0.1, 3000);
  camera.position.set(0, 5, 10);
  camera.layers.enable(2);
  scene.add(camera);
  const miniCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 600);
  miniCamera.position.set(0, 150, 0);
  miniCamera.up.set(0, 0, -1);
  miniCamera.lookAt(0, 0, 0);
  miniCamera.layers.disable(0);
  miniCamera.layers.enable(1);
  miniCamera.near = 1;
  miniCamera.far = 1000;
  miniCamera.updateProjectionMatrix();
  scene.add(miniCamera);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1;
  controls.enablePan = false;
  controls.target.set(0, EYE_HEIGHT, 0);
  controls.minDistance = 4;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;

  const loader = new THREE.TextureLoader();

  const fallbackHeight = createSolidTexture("#808080");
  const fallbackAlbedo = createSolidTexture("#6f737c");
  const fallbackNormal = createSolidTexture("#7f7fff");

  const terrainGeometry = new THREE.PlaneGeometry(820, 820, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  const terrainColliderGeometry = terrainGeometry.clone();
  const terrainUvs = terrainGeometry.attributes.uv;
  const positionAttr = terrainGeometry.attributes.position;
  const terrainColliderPositionAttr = terrainColliderGeometry.attributes.position;
  const uvAttr = terrainGeometry.attributes.uv;
  const terrainHeightGrid = new Float32Array(TERRAIN_GRID_WIDTH * TERRAIN_GRID_WIDTH);
  let hasTerrainHeightGrid = false;
  const uvInset = 0.0035;
  for (let index = 0; index < terrainUvs.count; index += 1) {
    const u = terrainUvs.getX(index);
    const v = terrainUvs.getY(index);
    terrainUvs.setXY(
      index,
      uvInset + u * (1 - uvInset * 2),
      uvInset + v * (1 - uvInset * 2)
    );
  }
  terrainUvs.needsUpdate = true;

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: fallbackAlbedo,
    normalMap: fallbackNormal,
    displacementMap: fallbackHeight,
    displacementScale: 30,
    displacementBias: -14,
    roughness: 0.9,
    metalness: 0
  });
  terrainMaterial.normalScale = new THREE.Vector2(0.42, 0.42);
  const minimapTerrainMaterial = new THREE.MeshBasicMaterial({
    color: 0x8b97a6,
    map: fallbackAlbedo,
    transparent: false
  });
  const minimapUnderlayMaterial = new THREE.MeshBasicMaterial({ color: 0x08131d });
  const minimapClearColor = new THREE.Color(0x08131d);

  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.rotation.x = -Math.PI / 2;
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  terrain.frustumCulled = false;
  terrain.layers.enable(1);
  scene.add(terrain);

  const terrainCollider = new THREE.Mesh(
    terrainColliderGeometry,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  terrainCollider.rotation.x = -Math.PI / 2;
  terrainCollider.frustumCulled = false;
  scene.add(terrainCollider);

  const terrainUnderlay = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshBasicMaterial({ color: 0x020202 })
  );
  terrainUnderlay.rotation.x = -Math.PI / 2;
  terrainUnderlay.position.y = -30;
  terrainUnderlay.layers.enable(1);
  scene.add(terrainUnderlay);

  const waypointMarker = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.5, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6de2ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    })
  );
  waypointMarker.rotation.x = -Math.PI / 2;
  waypointMarker.layers.set(2);
  waypointMarker.visible = false;
  scene.add(waypointMarker);

  const roverMarker = new THREE.Mesh(
    new THREE.ConeGeometry(1, 2.4, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ff66 })
  );
  roverMarker.rotation.x = -Math.PI / 2;
  roverMarker.layers.set(1);
  scene.add(roverMarker);

  const targetMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffcc00 })
  );
  targetMarker.layers.set(1);
  targetMarker.visible = false;
  scene.add(targetMarker);

  const radarMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const radarPulse = new THREE.Mesh(new THREE.RingGeometry(2, 2.22, 40), radarMaterial);
  radarPulse.rotation.x = -Math.PI / 2;
  radarPulse.frustumCulled = false;
  scene.add(radarPulse);

  const missionStations = new Map();
  const missionStationRoot = new THREE.Group();
  scene.add(missionStationRoot);

  const roverFront = createRoverFrontRig();
  roverFront.renderOrder = 10;
  camera.add(roverFront);

  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  ambientLight.layers.enable(1);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xbfd7ff, 0x111111, 0.18);
  hemiLight.layers.enable(1);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50, 100, 50);
  sunLight.layers.enable(1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 1400;
  sunLight.shadow.camera.left = -320;
  sunLight.shadow.camera.right = 320;
  sunLight.shadow.camera.top = 320;
  sunLight.shadow.camera.bottom = -320;
  sunLight.shadow.bias = -0.00015;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  const miniLight = new THREE.AmbientLight(0xffffff, 0.6);
  miniLight.layers.set(1);
  scene.add(miniLight);

  function configureSurfaceTexture(texture) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
  }

  function configureHeightTexture(texture) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
  }

  function sampleHeightPixel(imageData, u, v) {
    const clampedU = THREE.MathUtils.clamp(u, 0, 1);
    const clampedV = THREE.MathUtils.clamp(v, 0, 1);
    const px = Math.min(imageData.width - 1, Math.max(0, Math.round(clampedU * (imageData.width - 1))));
    const py = Math.min(imageData.height - 1, Math.max(0, Math.round((1 - clampedV) * (imageData.height - 1))));
    const offset = (py * imageData.width + px) * 4;
    return imageData.data[offset] / 255;
  }

  function rebuildTerrainHeightGrid(texture) {
    const image = texture.image;
    if (!image || !image.width || !image.height) {
      hasTerrainHeightGrid = false;
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      hasTerrainHeightGrid = false;
      return;
    }

    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, image.width, image.height);
    const displacementScale = terrainMaterial.displacementScale ?? 0;
    const displacementBias = terrainMaterial.displacementBias ?? 0;

    for (let index = 0; index < positionAttr.count; index += 1) {
      const localX = positionAttr.getX(index);
      const localPlaneY = positionAttr.getY(index);
      const gridX = Math.round(((localX + TERRAIN_HALF_SIZE) / TERRAIN_SIZE) * TERRAIN_SEGMENTS);
      const gridZ = Math.round(((-localPlaneY + TERRAIN_HALF_SIZE) / TERRAIN_SIZE) * TERRAIN_SEGMENTS);
      const u = uvAttr.getX(index);
      const v = uvAttr.getY(index);
      const sampledHeight = sampleHeightPixel(imageData, u, v) * displacementScale + displacementBias;
      terrainHeightGrid[gridZ * TERRAIN_GRID_WIDTH + gridX] = sampledHeight;
      terrainColliderPositionAttr.setZ(index, sampledHeight);
    }

    terrainColliderPositionAttr.needsUpdate = true;
    terrainColliderGeometry.computeVertexNormals();
    hasTerrainHeightGrid = true;
  }

  function sampleTerrainHeightFromGrid(localX, localZ) {
    if (!hasTerrainHeightGrid) {
      return 0;
    }

    const normalizedX = THREE.MathUtils.clamp((localX + TERRAIN_HALF_SIZE) / TERRAIN_SIZE, 0, 1);
    const normalizedZ = THREE.MathUtils.clamp((localZ + TERRAIN_HALF_SIZE) / TERRAIN_SIZE, 0, 1);
    const gridX = normalizedX * TERRAIN_SEGMENTS;
    const gridZ = normalizedZ * TERRAIN_SEGMENTS;
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(TERRAIN_SEGMENTS, x0 + 1);
    const z1 = Math.min(TERRAIN_SEGMENTS, z0 + 1);
    const tx = gridX - x0;
    const tz = gridZ - z0;

    const h00 = terrainHeightGrid[z0 * TERRAIN_GRID_WIDTH + x0];
    const h10 = terrainHeightGrid[z0 * TERRAIN_GRID_WIDTH + x1];
    const h01 = terrainHeightGrid[z1 * TERRAIN_GRID_WIDTH + x0];
    const h11 = terrainHeightGrid[z1 * TERRAIN_GRID_WIDTH + x1];
    const hx0 = THREE.MathUtils.lerp(h00, h10, tx);
    const hx1 = THREE.MathUtils.lerp(h01, h11, tx);
    return THREE.MathUtils.lerp(hx0, hx1, tz);
  }

  function updateMissionStationHeights() {
    Object.entries(MISSION_TARGETS).forEach(([key, target]) => {
      const station = missionStations.get(key);
      if (!station) {
        return;
      }
      station.position.set(target.x, sampleTerrainHeightFromGrid(target.x, target.z), target.z);
    });
  }

  function createMissionStations() {
    const stationFactories = {
      inspection: createInspectionStation,
      maintenance: createMaintenanceStation,
      research: createResearchStation
    };

    Object.entries(MISSION_TARGETS).forEach(([key, target]) => {
      const factory = stationFactories[key];
      if (!factory) {
        return;
      }
      const station = factory(new THREE.Vector3(target.x, 0, target.z));
      station.rotation.y = key === "maintenance" ? Math.PI / 6 : key === "research" ? -Math.PI / 5 : Math.PI / 10;
      missionStations.set(key, station);
      missionStationRoot.add(station);
    });

    updateMissionStationHeights();
  }

  function animateMissionStations(deltaSeconds, missionTimeSeconds, activeStationType) {
    missionStations.forEach((station, stationType) => {
      const lights = station.userData.lights ?? [];
      const rotators = station.userData.rotators ?? [];
      const bobbers = station.userData.bobbers ?? [];
      const isActive = stationType === activeStationType;
      const pulse = (Math.sin(missionTimeSeconds * (isActive ? 7.2 : 2.4) + station.position.x * 0.02) + 1) * 0.5;
      const rotationSpeedByType = {
        inspection: isActive ? 0.12 : 0.035,
        maintenance: isActive ? 0.6 : 0.08,
        research: isActive ? 0.36 : 0.06
      };
      const bobAmplitudeByType = {
        inspection: isActive ? 0.08 : 0.025,
        maintenance: isActive ? 0.06 : 0.02,
        research: isActive ? 0.12 : 0.03
      };
      const bobFrequencyByType = {
        inspection: isActive ? 3.4 : 1.4,
        maintenance: isActive ? 4.1 : 1.7,
        research: isActive ? 5.4 : 1.9
      };
      const rotationSpeed = rotationSpeedByType[stationType] ?? (isActive ? 0.2 : 0.05);
      const bobAmplitude = bobAmplitudeByType[stationType] ?? (isActive ? 0.08 : 0.02);
      const bobFrequency = bobFrequencyByType[stationType] ?? (isActive ? 4 : 2);

      lights.forEach((material, index) => {
        material.emissiveIntensity = (isActive ? 0.55 : 0.12) + pulse * (isActive ? 0.9 : 0.16) + index * 0.04;
      });

      rotators.forEach((part, index) => {
        part.rotation.y += deltaSeconds * (rotationSpeed + index * 0.02);
      });

      bobbers.forEach((part, index) => {
        if (!part.userData.baseYCaptured) {
          part.userData.baseY = part.position.y;
          part.userData.baseYCaptured = true;
        }
        const bobOffset = Math.sin(missionTimeSeconds * bobFrequency + index * 0.8) * bobAmplitude;
        part.position.y = (part.userData.baseY ?? part.position.y) + bobOffset;
      });
    });
  }

  createMissionStations();

  loader.load(
    "./assets/moon_heightmap.png",
    (texture) => {
      configureHeightTexture(texture);
      terrainMaterial.displacementMap = texture;
      rebuildTerrainHeightGrid(texture);
      updateMissionStationHeights();
      terrainMaterial.needsUpdate = true;
      console.log("Texture loaded: ./assets/moon_heightmap.png");
    },
    undefined,
    () => {
      console.warn("Missing texture: ./assets/moon_heightmap.png - using fallback displacement.");
    }
  );

  loader.load(
    "./assets/moon_albedo.png",
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      configureSurfaceTexture(texture);
      terrainMaterial.map = texture;
      minimapTerrainMaterial.map = texture;
      minimapTerrainMaterial.needsUpdate = true;
      terrainMaterial.needsUpdate = true;
      console.log("Texture loaded: ./assets/moon_albedo.png");
    },
    undefined,
    () => {
      console.warn("Missing texture: ./assets/moon_albedo.png - using fallback albedo.");
    }
  );

  loader.load(
    "./assets/moon_normal.png",
    (texture) => {
      configureSurfaceTexture(texture);
      terrainMaterial.normalMap = texture;
      terrainMaterial.normalScale.set(0.4, 0.4);
      terrainMaterial.needsUpdate = true;
      console.log("Texture loaded: ./assets/moon_normal.png");
    },
    undefined,
    () => {
      console.warn("Missing texture: ./assets/moon_normal.png - using fallback normal map.");
    }
  );

  function loadStarfield(paths, index = 0) {
    if (index >= paths.length) {
      console.warn("Missing texture: starfield (.jpg/.png) - using black space background.");
      return;
    }

    const path = paths[index];
    loader.load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        scene.background = texture;
        console.log(`Texture loaded: ${path}`);
      },
      undefined,
      () => {
        console.warn(`Missing texture: ${path} - trying alternate starfield path.`);
        loadStarfield(paths, index + 1);
      }
    );
  }

  loadStarfield(["./assets/stars.png", "./assets/stars.png"]);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const terrainNormal = new THREE.Vector3();
  const terrainForward = new THREE.Vector3();
  const terrainRight = new THREE.Vector3();
  const movementForward = new THREE.Vector3();
  const movementRight = new THREE.Vector3();
  const miniCameraLookTarget = new THREE.Vector3();
  const previousTarget = new THREE.Vector3();
  const currentTarget = new THREE.Vector3();
  const horizontalDelta = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const cameraTiltEuler = new THREE.Euler();
  const cameraTiltQuaternion = new THREE.Quaternion();
  let lastWidth = 0;
  let lastHeight = 0;
  let currentState = null;
  let restDistance = camera.position.distanceTo(controls.target);
  let lastBobOffset = 0;
  let cameraPitchOffset = 0;
  let cameraRollOffset = 0;
  let suspensionTargetY = EYE_HEIGHT;
  let suspensionPositionY = EYE_HEIGHT;
  let suspensionVelocityY = 0;
  let waypointSelectHandler = null;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let radarPulseScale = 1;

  function pickTerrainPoint(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(terrainCollider, false);
    return hits[0]?.point.clone() ?? null;
  }

  function updateSuspension(targetHeight, deltaTime) {
    const stiffness = 10;
    const damping = 0.8;
    const safeDeltaTime = Math.max(0.001, deltaTime);
    const force = (targetHeight - suspensionPositionY) * stiffness;
    suspensionVelocityY += force * safeDeltaTime;
    suspensionVelocityY *= Math.pow(damping, safeDeltaTime * 60);

    const nextY = suspensionPositionY + suspensionVelocityY * safeDeltaTime;
    const deltaY = nextY - suspensionPositionY;
    suspensionPositionY = nextY;
    controls.target.y = suspensionPositionY;
    camera.position.y += deltaY;
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || typeof waypointSelectHandler !== "function") {
      return;
    }

    const dragDistance = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
    if (dragDistance > 6) {
      return;
    }

    const waypointPoint = pickTerrainPoint(event.clientX, event.clientY);
    if (waypointPoint) {
      waypointSelectHandler(waypointPoint);
    }
  });

  function sampleTerrainContact(worldX, worldZ, heading = currentState?.heading ?? 0) {
    const fallbackHeight = hasTerrainHeightGrid ? sampleTerrainHeightFromGrid(worldX, worldZ) : 0;
    terrainCollider.updateMatrixWorld();
    rayOrigin.set(worldX, 300, worldZ);
    raycaster.set(rayOrigin, rayDirection);
    const hits = raycaster.intersectObject(terrainCollider, false);
    if (hits.length === 0) {
      return {
        height: fallbackHeight,
        slope: 0,
        pitch: 0,
        roll: 0
      };
    }

    const hit = hits[0];
    terrainNormal.copy(worldUp);
    if (hit.face) {
      terrainNormal.copy(hit.face.normal).transformDirection(terrainCollider.matrixWorld).normalize();
    }

    const safeNormalY = Math.max(0.001, Math.abs(terrainNormal.y));
    terrainForward.set(Math.sin(heading), 0, Math.cos(heading));
    if (terrainForward.lengthSq() < 0.0001) {
      terrainForward.set(0, 0, 1);
    }
    terrainForward.normalize();
    terrainRight.set(terrainForward.z, 0, -terrainForward.x).normalize();

    const forwardGrade =
      -(terrainNormal.x * terrainForward.x + terrainNormal.z * terrainForward.z) / safeNormalY;
    const lateralGrade =
      -(terrainNormal.x * terrainRight.x + terrainNormal.z * terrainRight.z) / safeNormalY;

    return {
      height: hit.point.y,
      slope: THREE.MathUtils.clamp(
        Math.acos(THREE.MathUtils.clamp(terrainNormal.y, -1, 1)) / (Math.PI / 2),
        0,
        1
      ),
      pitch: THREE.MathUtils.clamp(Math.atan(forwardGrade), -0.24, 0.24),
      roll: THREE.MathUtils.clamp(-Math.atan(lateralGrade), -0.18, 0.18)
    };
  }

  function sampleTerrainHeight(worldX, worldZ) {
    return sampleTerrainContact(worldX, worldZ).height;
  }

  function sampleTerrainAnalysis(worldX, worldZ, heading = currentState?.heading ?? 0) {
    return sampleTerrainContact(worldX, worldZ, heading);
  }

  function ensureRendererSize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    if (width === lastWidth && height === lastHeight) {
      return;
    }

    lastWidth = width;
    lastHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function getMovementBasis() {
    camera.getWorldDirection(movementForward);
    movementForward.y = 0;
    if (movementForward.lengthSq() < 0.0001) {
      const fallbackHeading = currentState?.heading ?? 0;
      movementForward.set(Math.sin(fallbackHeading), 0, Math.cos(fallbackHeading));
    }
    movementForward.normalize();
    movementRight.crossVectors(movementForward, worldUp).normalize();

    return {
      forwardX: movementForward.x,
      forwardZ: movementForward.z,
      rightX: movementRight.x,
      rightZ: movementRight.z
    };
  }

  ensureRendererSize();
  window.addEventListener("resize", ensureRendererSize);

  return {
    getMovementBasis,
    sampleTerrainHeight,
    sampleTerrainAnalysis,
    setWaypointHandler(handler) {
      waypointSelectHandler = typeof handler === "function" ? handler : null;
    },
    syncState(state) {
      currentState = state;

      controls.autoRotate = state.status === "SCANNING";

      previousTarget.copy(controls.target);
      currentTarget.set(state.position.x, previousTarget.y, state.position.z);
      horizontalDelta.subVectors(currentTarget, previousTarget);
      camera.position.add(horizontalDelta);
      controls.target.x = state.position.x;
      controls.target.z = state.position.z;
      suspensionTargetY = state.position.y;

      if (currentState?.missionElapsedMs === 0) {
        camera.position.y += suspensionTargetY - previousTarget.y;
        suspensionPositionY = suspensionTargetY;
        suspensionVelocityY = 0;
        controls.target.y = suspensionPositionY;
      }

      if (state.waypoint) {
        waypointMarker.visible = true;
        waypointMarker.position.set(state.waypoint.x, state.waypoint.y - EYE_HEIGHT + 0.12, state.waypoint.z);
      } else {
        waypointMarker.visible = false;
      }

      const activeTarget = state.targetPosition || state.waypoint;
      if (activeTarget) {
        targetMarker.visible = true;
        targetMarker.position.set(activeTarget.x, 1.2, activeTarget.z);
      } else {
        targetMarker.visible = false;
      }

      const groundY = state.position.y - EYE_HEIGHT;
      roverMarker.position.set(state.position.x, groundY + 1.2, state.position.z);
      radarPulse.position.set(state.position.x, groundY + 0.08, state.position.z);
      miniCamera.position.set(state.position.x, 150, state.position.z);
      miniCameraLookTarget.set(state.position.x, 0, state.position.z);
      miniCamera.lookAt(miniCameraLookTarget);
    },
    render(deltaSeconds = 1 / 60) {
      ensureRendererSize();
      updateSuspension(suspensionTargetY, deltaSeconds);
      cameraOffset.subVectors(camera.position, controls.target);
      const currentDistance = Math.max(0.001, cameraOffset.length());
      const missionTimeSeconds = (currentState?.missionElapsedMs ?? 0) / 1000;
      const moving = Boolean(currentState?.isMoving);
      const lowPowerSeverity = currentState?.lowPowerSeverity ?? 0;
      const terrainSlope = currentState?.terrainSlope ?? 0;
      const tiltX = (currentState?.terrainForwardDelta ?? 0) * 0.05;
      const tiltZ = (currentState?.terrainLateralDelta ?? 0) * 0.05;

      if (currentState?.status !== "INSPECTING") {
        restDistance = THREE.MathUtils.lerp(restDistance, currentDistance, 0.08);
      }

      let desiredDistance = restDistance;
      if (moving) {
        desiredDistance = Math.max(controls.minDistance + 1, restDistance * 0.94);
      }
      if (currentState?.status === "INSPECTING") {
        desiredDistance = Math.max(controls.minDistance + 2, restDistance * 0.82);
      }

      if (Math.abs(currentDistance - desiredDistance) > 0.01) {
        cameraOffset.normalize().multiplyScalar(
          THREE.MathUtils.lerp(currentDistance, desiredDistance, 0.12)
        );
        camera.position.copy(controls.target).add(cameraOffset);
      }

      const idleBob = Math.sin(missionTimeSeconds * 1.6) * 0.03;
      const motionBob = moving ? Math.sin(missionTimeSeconds * 7.5) * 0.05 : 0;
      const terrainShake =
        moving ? Math.sin(missionTimeSeconds * 12.5) * (0.015 + terrainSlope * 0.025) : 0;
      const lowPowerShake =
        lowPowerSeverity > 0
          ? (Math.sin(missionTimeSeconds * 17) + Math.cos(missionTimeSeconds * 23)) * 0.012 * lowPowerSeverity
          : 0;
      const bobOffset = idleBob + motionBob + terrainShake + lowPowerShake;
      const bobDelta = bobOffset - lastBobOffset;
      lastBobOffset = bobOffset;
      camera.position.y += bobDelta;
      controls.target.y += bobDelta * (moving ? 0.45 : 0.3);

      controls.update();
      cameraPitchOffset = THREE.MathUtils.lerp(cameraPitchOffset, tiltX, 0.1);
      cameraRollOffset = THREE.MathUtils.lerp(cameraRollOffset, tiltZ, 0.1);
      cameraTiltEuler.set(cameraPitchOffset, 0, cameraRollOffset);
      cameraTiltQuaternion.setFromEuler(cameraTiltEuler);
      camera.quaternion.multiply(cameraTiltQuaternion);
      animateMissionStations(deltaSeconds, missionTimeSeconds, currentState?.stationActivity ?? null);
      const movementBasis = getMovementBasis();
      roverMarker.rotation.z = Math.atan2(movementBasis.forwardX, movementBasis.forwardZ);
      radarPulseScale += deltaSeconds * 1.7;
      if (radarPulseScale > 5) {
        radarPulseScale = 1;
        radarMaterial.opacity = 0.45;
      } else {
        radarMaterial.opacity = Math.max(0.08, radarMaterial.opacity * Math.pow(0.98, deltaSeconds * 60));
      }
      radarPulse.scale.setScalar(radarPulseScale);
      if (waypointMarker.visible) {
        const markerPulse = 1 + Math.sin(missionTimeSeconds * 3.4) * 0.1;
        waypointMarker.scale.setScalar(markerPulse);
      }
      renderer.setClearColor(0x000000, 1);
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, lastWidth, lastHeight);
      renderer.setScissor(0, 0, lastWidth, lastHeight);
      renderer.render(scene, camera);

      const minimapWidth = 180;
      const minimapHeight = 180;
      const minimapMargin = 20;
      const minimapX = lastWidth - minimapWidth - minimapMargin;
      const minimapY = lastHeight - minimapHeight - minimapMargin;
      miniCamera.position.set(currentState?.position.x ?? 0, 150, currentState?.position.z ?? 0);
      miniCameraLookTarget.set(currentState?.position.x ?? 0, 0, currentState?.position.z ?? 0);
      miniCamera.lookAt(miniCameraLookTarget);
      renderer.clearDepth();
      renderer.setViewport(minimapX, minimapY, minimapWidth, minimapHeight);
      renderer.setScissor(minimapX, minimapY, minimapWidth, minimapHeight);
      const previousBackground = scene.background;
      const previousFog = scene.fog;
      const previousTerrainMaterial = terrain.material;
      const previousUnderlayMaterial = terrainUnderlay.material;
      scene.background = null;
      scene.fog = null;
      terrain.material = minimapTerrainMaterial;
      terrainUnderlay.material = minimapUnderlayMaterial;
      renderer.setClearColor(minimapClearColor, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, miniCamera);
      terrain.material = previousTerrainMaterial;
      terrainUnderlay.material = previousUnderlayMaterial;
      scene.background = previousBackground;
      scene.fog = previousFog;
      renderer.setClearColor(0x000000, 1);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, lastWidth, lastHeight);
    }
  };
}
