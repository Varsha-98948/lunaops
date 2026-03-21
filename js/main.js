import { initControls } from "./controls.js";
import { initScene } from "./scene.js";
import {
  advanceMotion,
  setMovementBasisResolver,
  setWaypointDestination,
  setTerrainAnalysisResolver,
  setTerrainHeightResolver,
  subscribe,
  updateSystem
} from "./state.js";
import { initUI } from "./ui.js";

function bootstrap() {
  const ui = initUI();
  const scene = initScene("three-container");
  setTerrainHeightResolver(scene.sampleTerrainHeight);
  setTerrainAnalysisResolver(scene.sampleTerrainAnalysis);
  setMovementBasisResolver(scene.getMovementBasis);
  scene.setWaypointHandler((point) => {
    setWaypointDestination(point.x, point.z);
  });

  initControls();

  subscribe((state) => {
    ui.render(state);
    scene.syncState(state);
  });

  let lastFrameTime = performance.now();

  function frame(now) {
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    advanceMotion(deltaSeconds);
    updateSystem(deltaSeconds);

    scene.render(deltaSeconds);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
