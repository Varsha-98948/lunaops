import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

export function createRoverSystem(sampleHeight) {
  const roverRig = new THREE.Group();
  roverRig.userData.externalControlEnabled = false;

  const roverTilt = new THREE.Group();
  roverRig.add(roverTilt);

  const fallbackRover = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xb04a4a, metalness: 0.45, roughness: 0.4 })
  );
  fallbackRover.position.y = 1.0;
  fallbackRover.castShadow = true;
  fallbackRover.receiveShadow = true;
  roverTilt.add(fallbackRover);

  const wheelNodes = [];
  const wheelBaseY = new Map();
  const sampleWorldPoint = new THREE.Vector3();
  const tempLocal = new THREE.Vector3();

  const defaultWheelOffsets = [
    new THREE.Vector3(-1.25, 0, 1.6),
    new THREE.Vector3(1.25, 0, 1.6),
    new THREE.Vector3(-1.25, 0, -1.6),
    new THREE.Vector3(1.25, 0, -1.6)
  ];

  function registerWheelNodes(root) {
    wheelNodes.length = 0;
    wheelBaseY.clear();
    root.traverse((node) => {
      if (!node.isObject3D) return;
      if (/wheel|tyre|tire/i.test(node.name)) {
        wheelNodes.push(node);
        wheelBaseY.set(node, node.position.y);
      }
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  const loader = new GLTFLoader();
  loader.load(
    "assets/rover.glb",
    (gltf) => {
      roverTilt.remove(fallbackRover);
      gltf.scene.position.set(0, 0, 0);
      roverTilt.add(gltf.scene);
      registerWheelNodes(gltf.scene);
    },
    undefined,
    () => {
      // Keep fallback mesh if model is unavailable.
    }
  );

  function getWheelWorldPoints() {
    if (wheelNodes.length > 0) {
      return wheelNodes.slice(0, 4).map((node) => node.getWorldPosition(new THREE.Vector3()));
    }
    return defaultWheelOffsets.map((offset) => roverRig.localToWorld(offset.clone()));
  }

  function conformToTerrain() {
    const wheelPoints = getWheelWorldPoints();
    if (wheelPoints.length < 4) return;

    const heights = wheelPoints.map((point) => sampleHeight(point.x, point.z));

    const frontAvg = (heights[0] + heights[1]) * 0.5;
    const backAvg = (heights[2] + heights[3]) * 0.5;
    const leftAvg = (heights[0] + heights[2]) * 0.5;
    const rightAvg = (heights[1] + heights[3]) * 0.5;
    const bodyAvg = (frontAvg + backAvg) * 0.5;

    const wheelBase = 3.2;
    const trackWidth = 2.5;
    const targetPitch = Math.atan2(frontAvg - backAvg, wheelBase);
    const targetRoll = Math.atan2(leftAvg - rightAvg, trackWidth);

    roverRig.position.y += (bodyAvg + 0.9 - roverRig.position.y) * 0.2;
    roverTilt.rotation.x += (-targetPitch - roverTilt.rotation.x) * 0.15;
    roverTilt.rotation.z += (targetRoll - roverTilt.rotation.z) * 0.15;

    wheelNodes.forEach((wheel) => {
      wheel.getWorldPosition(sampleWorldPoint);
      const contactY = sampleHeight(sampleWorldPoint.x, sampleWorldPoint.z);
      tempLocal.set(sampleWorldPoint.x, contactY, sampleWorldPoint.z);
      wheel.parent.worldToLocal(tempLocal);
      const baseY = wheelBaseY.get(wheel) ?? wheel.position.y;
      wheel.position.y += (baseY + (tempLocal.y - baseY) - wheel.position.y) * 0.35;
    });
  }

  return {
    roverRig,
    conformToTerrain
  };
}
