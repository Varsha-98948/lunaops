export function setupRoverController(roverRig) {
  const inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") inputState.forward = true;
    if (event.key === "ArrowDown") inputState.backward = true;
    if (event.key === "ArrowLeft") inputState.left = true;
    if (event.key === "ArrowRight") inputState.right = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp") inputState.forward = false;
    if (event.key === "ArrowDown") inputState.backward = false;
    if (event.key === "ArrowLeft") inputState.left = false;
    if (event.key === "ArrowRight") inputState.right = false;
  });

  const roverMoveSpeed = 18;
  const roverTurnSpeed = 1.4;

  function update(deltaSeconds) {
    const joystick = window.roverJoystick || { x: 0, y: 0 };
    const keyboardForward = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    const keyboardTurn = (inputState.left ? 1 : 0) - (inputState.right ? 1 : 0);

    const forwardAxis = keyboardForward + (Number(joystick.y) ? -Number(joystick.y) : 0);
    const turnAxis = keyboardTurn + (Number(joystick.x) || 0);

    roverRig.rotation.y += turnAxis * roverTurnSpeed * deltaSeconds;

    if (forwardAxis !== 0) {
      const moveStep = forwardAxis * roverMoveSpeed * deltaSeconds;
      roverRig.position.x += Math.sin(roverRig.rotation.y) * moveStep;
      roverRig.position.z += Math.cos(roverRig.rotation.y) * moveStep;
    }
  }

  return {
    update
  };
}