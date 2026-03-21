import {
  ROBOT_STATUS,
  setAutoNavigationEnabled,
  setDirectionalMovement,
  setMissionTarget,
  subscribe
} from "./state.js";

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required control element: ${id}`);
  }
  return element;
}

export function initControls() {
  const autoNavigateButton = requireElement("auto-navigate-button");
  const inspectButton = requireElement("inspect-button");
  const maintenanceButton = requireElement("maintenance-button");
  const researchButton = requireElement("research-button");
  const forwardButton = requireElement("move-forward-button");
  const backwardButton = requireElement("move-backward-button");
  const leftButton = requireElement("move-left-button");
  const rightButton = requireElement("move-right-button");

  function stopDirectionalMovement() {
    ["forward", "backward", "left", "right"].forEach((direction) => {
      setDirectionalMovement(direction, false);
    });
  }

  autoNavigateButton.addEventListener("click", () => {
    stopDirectionalMovement();
    setAutoNavigationEnabled(autoNavigateButton.dataset.enabled !== "true");
  });

  inspectButton.addEventListener("click", () => {
    stopDirectionalMovement();
    setMissionTarget("inspection");
  });

  maintenanceButton.addEventListener("click", () => {
    stopDirectionalMovement();
    setMissionTarget("maintenance");
  });

  researchButton.addEventListener("click", () => {
    stopDirectionalMovement();
    setMissionTarget("research");
  });

  function bindMovementButton(button, direction) {
    const start = (event) => {
      event.preventDefault();
      setDirectionalMovement(direction, true);
    };
    const stop = () => {
      setDirectionalMovement(direction, false);
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    button.addEventListener("mousedown", start);
    button.addEventListener("mouseup", stop);
    button.addEventListener("mouseleave", stop);
    button.addEventListener("touchstart", start, { passive: false });
    button.addEventListener("touchend", stop);
    button.addEventListener("touchcancel", stop);
  }

  bindMovementButton(forwardButton, "forward");
  bindMovementButton(backwardButton, "backward");
  bindMovementButton(leftButton, "left");
  bindMovementButton(rightButton, "right");

  const keyDirectionMap = {
    ArrowUp: "forward",
    ArrowDown: "backward",
    ArrowLeft: "left",
    ArrowRight: "right"
  };

  window.addEventListener("keydown", (event) => {
    const direction = keyDirectionMap[event.key];
    if (!direction || event.repeat) {
      return;
    }
    setDirectionalMovement(direction, true);
  });

  window.addEventListener("keyup", (event) => {
    const direction = keyDirectionMap[event.key];
    if (!direction) {
      return;
    }
    setDirectionalMovement(direction, false);
  });

  window.addEventListener("blur", () => {
    stopDirectionalMovement();
  });

  window.addEventListener("pointerup", stopDirectionalMovement);

  subscribe((state) => {
    const taskLocked =
      state.status === ROBOT_STATUS.INSPECTING || state.status === ROBOT_STATUS.SCANNING;
    const manualLocked = taskLocked || state.battery <= 1 || state.autoNavigateEnabled;
    const missionLocked = taskLocked || state.battery <= 1;

    autoNavigateButton.disabled = taskLocked || state.battery <= 1;
    inspectButton.disabled = missionLocked;
    maintenanceButton.disabled = missionLocked;
    researchButton.disabled = missionLocked;
    forwardButton.disabled = manualLocked;
    backwardButton.disabled = manualLocked;
    leftButton.disabled = manualLocked;
    rightButton.disabled = manualLocked;
    autoNavigateButton.dataset.enabled = state.autoNavigateEnabled ? "true" : "false";
    autoNavigateButton.textContent = `Auto Navigate: ${state.autoNavigateEnabled ? "ON" : "OFF"}`;
  });
}
