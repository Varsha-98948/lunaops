import { MISSION_LOCATIONS, getState, moveToLocation } from "../state.js";

const DEFAULT_TARGET = MISSION_LOCATIONS[1]?.id ?? MISSION_LOCATIONS[0].id;

export function getRobotState() {
  return getState();
}

export function moveForward() {
  return moveToLocation(DEFAULT_TARGET);
}

export function rotateLeft() {
  return false;
}

export function rotateRight() {
  return false;
}

export function updateRobot() {
  return getState();
}
