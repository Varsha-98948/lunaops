import {
  MISSION_LOCATIONS,
  ROBOT_STATUS,
  getState,
  moveToLocation,
  startInspection,
  startMaintenanceSweep
} from "../state.js";

const commandQueue = [];

export let roverState = ROBOT_STATUS.IDLE;

function syncRoverState() {
  roverState = getState().status;
}

function executeCommand(command) {
  switch (command?.type) {
    case "MOVE_FORWARD":
      moveToLocation(MISSION_LOCATIONS[1]?.id ?? MISSION_LOCATIONS[0].id);
      break;
    case "INSPECT_MODULE":
      startInspection();
      break;
    case "MAINTENANCE_SWEEP":
      startMaintenanceSweep();
      break;
    default:
      break;
  }
}

export function addCommand(command) {
  if (!command || typeof command.type !== "string") {
    return;
  }
  commandQueue.push(command);
}

export function getNextCommand() {
  return commandQueue.shift() || null;
}

export function peekQueue() {
  return [...commandQueue];
}

export function clearQueue() {
  commandQueue.length = 0;
}

export function setRoverState(state) {
  roverState = state;
}

export function canExecuteCommand() {
  return getState().status === ROBOT_STATUS.IDLE;
}

export function processCommandQueue() {
  syncRoverState();
  if (!canExecuteCommand() || commandQueue.length === 0) {
    return;
  }

  const command = getNextCommand();
  if (!command) {
    return;
  }

  executeCommand(command);
  syncRoverState();
}
