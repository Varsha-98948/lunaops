import { initScene } from "../scene.js";

let sceneController = null;

export function initThreeScene(containerId) {
  sceneController = initScene(containerId);
  return sceneController;
}

export function updateRobotPosition(_robot, robotData) {
  sceneController?.syncState(robotData);
}
