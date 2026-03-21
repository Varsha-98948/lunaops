const HISTORY_LENGTH = 40;
const TELEMETRY_SAMPLE_INTERVAL = 0.25;
const EYE_HEIGHT = 2.5;
const MOTION_RESPONSIVENESS = 1.9;
const TARGET_SNAP_DISTANCE = 0.18;
const DEMO_MOVE_STEP_DISTANCE = 6;
const MANUAL_MOVE_SPEED = 7.5;
const MANUAL_ACCELERATION = 6;
const SWEEP_DURATION_MS = 2600;
const TERRAIN_WRAP_LIMIT = 500;
const MIN_VELOCITY = 0.02;
const TERRAIN_STEEP_SLOPE_THRESHOLD = 0.7;
const TERRAIN_HEIGHT_RESPONSE = 8;
const TERRAIN_ATTITUDE_RESPONSE = 5;
const TERRAIN_MAX_TRACTION_LOSS = 0.55;
const TERRAIN_ROUGH_SLOPE_THRESHOLD = 0.14;
const TERRAIN_TILT_SAMPLE_DISTANCE = 3.2;
const AUTO_WAYPOINT_SPEED = 5.8;
const AUTO_WAYPOINT_ARRIVAL_DISTANCE = 2;
const AUTO_AVOIDANCE_SLOPE_THRESHOLD = 0.24;
const AUTO_AVOIDANCE_STEER = 0.42;
const LOW_POWER_THRESHOLD = 20;
const LOW_POWER_MOBILITY_FLOOR = 0.45;

export const ROBOT_STATUS = Object.freeze({
  IDLE: "IDLE",
  MOVING: "MOVING",
  SCANNING: "SCANNING",
  INSPECTING: "INSPECTING",
  AVOIDING_TERRAIN: "AVOIDING TERRAIN",
  LOW_POWER: "LOW POWER"
});

export const ROBOT_MODE = Object.freeze({
  MANUAL: "MANUAL",
  AUTO: "AUTO",
  INSPECTION: "INSPECTION"
});

export const MISSION_LOCATIONS = Object.freeze([
  { id: "habitat-hub", label: "Habitat Hub", x: 0, z: 0 },
  { id: "relay-ridge", label: "Relay Ridge", x: 24, z: -18 },
  { id: "solar-array", label: "Solar Array", x: -26, z: -12 },
  { id: "crater-rim", label: "Crater Rim", x: 18, z: 28 },
  { id: "service-bay", label: "Service Bay", x: -16, z: 22 }
]);

export const MISSION_TARGETS = Object.freeze({
  inspection: { type: "inspection", label: "Inspection Site", x: 50, z: -100 },
  maintenance: { type: "maintenance", label: "Maintenance Zone", x: -80, z: 120 },
  research: { type: "research", label: "Research Node", x: 120, z: 60 }
});

const listeners = new Set();
let terrainHeightResolver = null;
let terrainAnalysisResolver = null;
let movementBasisResolver = null;
let terrainAnalysisCache = null;
const moveInput = {
  forward: false,
  backward: false,
  left: false,
  right: false
};
const motionVelocity = {
  x: 0,
  z: 0
};
let telemetrySampleAccumulator = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function getBlendAlpha(responsePerSecond, deltaSeconds) {
  return 1 - Math.exp(-Math.max(0, responsePerSecond) * Math.max(0, deltaSeconds));
}

function interpolateAngle(current, target, alpha) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}

function distanceSquared(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return dx * dx + dz * dz;
}

export function getTerrainHeight(x, z) {
  const broadWave = Math.sin(x * 0.042) * 1.8 + Math.cos(z * 0.034) * 1.35;
  const ridge = Math.sin((x + z) * 0.09) * 0.6;
  const crater = -2.6 * Math.exp(-distanceSquared(x, z, 21, 24) / 150);
  const berm = 1.4 * Math.exp(-distanceSquared(x, z, -14, -20) / 170);
  return broadWave + ridge + crater + berm;
}

function resolveTerrainHeight(x, z) {
  if (terrainAnalysisCache && terrainAnalysisCache.x === x && terrainAnalysisCache.z === z) {
    return terrainAnalysisCache.value.height;
  }

  if (typeof terrainHeightResolver === "function") {
    return terrainHeightResolver(x, z);
  }
  return getTerrainHeight(x, z);
}

function resolveTerrainAnalysis(x, z, heading = 0) {
  if (terrainAnalysisCache && terrainAnalysisCache.x === x && terrainAnalysisCache.z === z) {
    return terrainAnalysisCache.value;
  }

  if (typeof terrainAnalysisResolver === "function") {
    const terrainAnalysis = terrainAnalysisResolver(x, z, heading);
    terrainAnalysisCache = {
      x,
      z,
      value: terrainAnalysis
    };
    return terrainAnalysis;
  }

  const terrainAnalysis = {
    height: resolveTerrainHeight(x, z),
    slope: 0,
    pitch: 0,
    roll: 0
  };
  terrainAnalysisCache = {
    x,
    z,
    value: terrainAnalysis
  };
  return terrainAnalysis;
}

function getInitialPosition() {
  return {
    x: 0,
    y: resolveTerrainHeight(0, 0) + EYE_HEIGHT,
    z: 0
  };
}

function computeSolarExposure(x, z, missionElapsedMs) {
  return 0.5 + 0.5 * Math.sin((x - z) * 0.026 + missionElapsedMs * 0.00035);
}

function computeTemperatureTarget(position) {
  const terrainHeight = resolveTerrainHeight(position.x, position.z);
  return -50 + terrainHeight * 0.2;
}

function computeRadiationTarget(missionElapsedMs) {
  return 120 + Math.sin(missionElapsedMs * 0.0001) * 2;
}

function isAutoDriveActive() {
  return (
    state.mode === ROBOT_MODE.AUTO &&
    state.status === ROBOT_STATUS.MOVING &&
    Boolean(state.targetPosition) &&
    !hasBlockingTask()
  );
}

function getMovementIntensity() {
  if (state.isAvoidingTerrain) {
    return 0;
  }
  const manualSpeed = Math.hypot(motionVelocity.x, motionVelocity.z);
  if (manualSpeed > MIN_VELOCITY) {
    return clamp(manualSpeed / MANUAL_MOVE_SPEED, 0, 1);
  }
  return isAutoDriveActive() ? 0.8 : 0;
}

function getMobilityScale(battery) {
  if (battery >= LOW_POWER_THRESHOLD) {
    return 1;
  }
  return lerp(LOW_POWER_MOBILITY_FLOOR, 1, clamp(battery / LOW_POWER_THRESHOLD, 0, 1));
}

function resolveMovementBasis() {
  const resolvedBasis = typeof movementBasisResolver === "function" ? movementBasisResolver() : null;
  if (resolvedBasis) {
    const forwardX = Number.isFinite(resolvedBasis.forwardX) ? resolvedBasis.forwardX : 0;
    const forwardZ = Number.isFinite(resolvedBasis.forwardZ) ? resolvedBasis.forwardZ : -1;
    const rightX = Number.isFinite(resolvedBasis.rightX) ? resolvedBasis.rightX : 1;
    const rightZ = Number.isFinite(resolvedBasis.rightZ) ? resolvedBasis.rightZ : 0;
    return {
      forwardX,
      forwardZ,
      rightX,
      rightZ
    };
  }

  return {
    forwardX: 0,
    forwardZ: -1,
    rightX: 1,
    rightZ: 0
  };
}

function createHistory(value) {
  return Array.from({ length: HISTORY_LENGTH }, () => value);
}

function getLocationById(locationId) {
  return MISSION_LOCATIONS.find((location) => location.id === locationId) || null;
}

function getDemoMoveTarget(location) {
  const dx = location.x - state.position.x;
  const dz = location.z - state.position.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= 0.001) {
    const forwardHeading = state.heading;
    return {
      x: state.position.x + Math.sin(forwardHeading) * DEMO_MOVE_STEP_DISTANCE,
      z: state.position.z + Math.cos(forwardHeading) * DEMO_MOVE_STEP_DISTANCE
    };
  }

  const stepDistance = Math.min(DEMO_MOVE_STEP_DISTANCE, distance);
  const stepRatio = stepDistance / distance;
  return {
    x: state.position.x + dx * stepRatio,
    z: state.position.z + dz * stepRatio
  };
}

function getInspectionFocus(position) {
  const candidates = MISSION_LOCATIONS.filter((location) => location.id !== "habitat-hub");
  return candidates.reduce((closest, location) => {
    if (!closest) return location;
    const closestDistance = distanceSquared(position.x, position.z, closest.x, closest.z);
    const nextDistance = distanceSquared(position.x, position.z, location.x, location.z);
    return nextDistance < closestDistance ? location : closest;
  }, null);
}

function getSweepDurationMs(position) {
  const travelFactor = Math.hypot(position.x, position.z);
  return clamp(SWEEP_DURATION_MS + travelFactor * 2, 2400, 3000);
}

function applyTerrainWrap() {
  let wrapped = false;

  if (state.position.x > TERRAIN_WRAP_LIMIT) {
    state.position.x -= TERRAIN_WRAP_LIMIT * 2;
    wrapped = true;
  } else if (state.position.x < -TERRAIN_WRAP_LIMIT) {
    state.position.x += TERRAIN_WRAP_LIMIT * 2;
    wrapped = true;
  }

  if (state.position.z > TERRAIN_WRAP_LIMIT) {
    state.position.z -= TERRAIN_WRAP_LIMIT * 2;
    wrapped = true;
  } else if (state.position.z < -TERRAIN_WRAP_LIMIT) {
    state.position.z += TERRAIN_WRAP_LIMIT * 2;
    wrapped = true;
  }

  if (wrapped) {
    const terrainSample = resolveTerrainAnalysis(state.position.x, state.position.z, state.heading);
    state.position.y = terrainSample.height + EYE_HEIGHT;
    state.isRoughTerrain = terrainSample.slope > TERRAIN_ROUGH_SLOPE_THRESHOLD;
    state.terrainSlope = terrainSample.slope;
    state.terrainPitch = terrainSample.pitch ?? 0;
    state.terrainRoll = terrainSample.roll ?? 0;
    state.terrainForwardDelta = Math.tan(state.terrainPitch) * TERRAIN_TILT_SAMPLE_DISTANCE;
    state.terrainLateralDelta = -Math.tan(state.terrainRoll) * TERRAIN_TILT_SAMPLE_DISTANCE;
  }

  return wrapped;
}

function cloneHistory(history) {
  return {
    battery: [...history.battery],
    temperature: [...history.temperature],
    radiation: [...history.radiation]
  };
}

const initialPosition = getInitialPosition();
const initialTemperature = computeTemperatureTarget(initialPosition);
const initialRadiation = computeRadiationTarget(0);

const state = {
  position: initialPosition,
  battery: 100,
  temperature: initialTemperature,
  radiation: initialRadiation,
  status: ROBOT_STATUS.IDLE,
  mode: ROBOT_MODE.MANUAL,
  heading: -0.18,
  missionElapsedMs: 0,
  autoNavigateEnabled: false,
  waypoint: null,
  targetPosition: { id: "habitat-hub", label: "Habitat Hub", x: 0, z: 0 },
  activeTask: {
    type: "idle",
    label: "STANDBY",
    progress: 0
  },
  displayStatus: ROBOT_STATUS.IDLE,
  systemWarning: "Nominal",
  stationActivity: null,
  isLowPower: false,
  isMoving: false,
  isAvoidingTerrain: false,
  isRoughTerrain: false,
  terrainSlope: 0,
  terrainPitch: 0,
  terrainRoll: 0,
  terrainForwardDelta: 0,
  terrainLateralDelta: 0,
  terrainSpeedMultiplier: 1,
  mobilityScale: 1,
  lowPowerSeverity: 0,
  telemetryHistory: {
    battery: createHistory(100),
    temperature: createHistory(initialTemperature),
    radiation: createHistory(initialRadiation)
  }
};

function syncDerivedState() {
  const movementIntensity = getMovementIntensity();
  const isLowPower = state.battery < LOW_POWER_THRESHOLD;
  const lowPowerSeverity = isLowPower ? 1 - clamp(state.battery / LOW_POWER_THRESHOLD, 0, 1) : 0;

  state.isLowPower = isLowPower;
  state.lowPowerSeverity = lowPowerSeverity;
  state.mobilityScale = getMobilityScale(state.battery);
  state.isMoving = movementIntensity > 0.04;

  let displayStatus = state.isMoving ? ROBOT_STATUS.MOVING : ROBOT_STATUS.IDLE;
  if (state.activeTask?.type === "maintenance") {
    displayStatus = ROBOT_STATUS.SCANNING;
  }
  if (state.activeTask?.type === "inspection") {
    displayStatus = ROBOT_STATUS.INSPECTING;
  }
  if (state.isAvoidingTerrain) {
    displayStatus = ROBOT_STATUS.AVOIDING_TERRAIN;
  }
  if (state.isLowPower) {
    displayStatus = ROBOT_STATUS.LOW_POWER;
  }

  state.displayStatus = displayStatus;
  state.systemWarning =
    state.battery === 0
      ? "Battery depleted"
      : state.isLowPower
        ? "Battery reserve critical - reduced drive performance"
        : state.isAvoidingTerrain
          ? "Slope threshold exceeded - terrain avoidance active"
          : state.isRoughTerrain
            ? "Rough terrain - suspension load elevated"
          : "Nominal";
}

function createSnapshot() {
  syncDerivedState();
  return {
    position: { ...state.position },
    battery: state.battery,
    temperature: state.temperature,
    radiation: state.radiation,
    status: state.status,
    displayStatus: state.displayStatus,
    mode: state.mode,
    heading: state.heading,
    missionElapsedMs: state.missionElapsedMs,
    autoNavigateEnabled: state.autoNavigateEnabled,
    waypoint: state.waypoint ? { ...state.waypoint } : null,
    targetPosition: state.targetPosition ? { ...state.targetPosition } : null,
    activeTask: state.activeTask ? { ...state.activeTask } : null,
    systemWarning: state.systemWarning,
    stationActivity: state.stationActivity,
    isLowPower: state.isLowPower,
    isMoving: state.isMoving,
    isAvoidingTerrain: state.isAvoidingTerrain,
    isRoughTerrain: state.isRoughTerrain,
    terrainSlope: state.terrainSlope,
    terrainPitch: state.terrainPitch,
    terrainRoll: state.terrainRoll,
    terrainForwardDelta: state.terrainForwardDelta,
    terrainLateralDelta: state.terrainLateralDelta,
    terrainSpeedMultiplier: state.terrainSpeedMultiplier,
    mobilityScale: state.mobilityScale,
    lowPowerSeverity: state.lowPowerSeverity,
    telemetryHistory: cloneHistory(state.telemetryHistory)
  };
}

function emitChange() {
  const snapshot = createSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

function setIdleState(label = "STANDBY") {
  state.status = ROBOT_STATUS.IDLE;
  state.mode = getPreferredIdleMode();
  state.isAvoidingTerrain = false;
  state.isRoughTerrain = false;
  state.terrainSpeedMultiplier = 1;
  motionVelocity.x = 0;
  motionVelocity.z = 0;
  state.activeTask = {
    type: "idle",
    label,
    progress: 0
  };
}

function appendTelemetrySample() {
  const series = [
    ["battery", state.battery],
    ["temperature", state.temperature],
    ["radiation", state.radiation]
  ];

  series.forEach(([key, value]) => {
    const history = state.telemetryHistory[key];
    history.push(value);
    if (history.length > HISTORY_LENGTH) {
      history.shift();
    }
  });
}

function hasBlockingTask() {
  return state.activeTask?.type === "maintenance" || state.activeTask?.type === "inspection";
}

function getPreferredIdleMode() {
  return state.autoNavigateEnabled ? ROBOT_MODE.AUTO : ROBOT_MODE.MANUAL;
}

function activateWaypointNavigation(label = "NAVIGATING TO TARGET") {
  if (!state.waypoint || hasBlockingTask() || state.battery <= 1) {
    return false;
  }

  const dx = state.waypoint.x - state.position.x;
  const dz = state.waypoint.z - state.position.z;
  const totalDistance = Math.max(0.001, Math.hypot(dx, dz));

  state.targetPosition = {
    type: "waypoint",
    missionType: state.waypoint.missionType ?? null,
    label: state.waypoint.label ?? "Waypoint",
    x: state.waypoint.x,
    y: state.waypoint.y,
    z: state.waypoint.z
  };
  state.status = ROBOT_STATUS.MOVING;
  state.mode = ROBOT_MODE.AUTO;
  state.stationActivity = null;
  state.activeTask = {
    type: "waypoint",
    label,
    progress: 0,
    totalDistance
  };
  return true;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(createSnapshot());
  return () => listeners.delete(listener);
}

export function getState() {
  return createSnapshot();
}

export function setTerrainHeightResolver(resolver) {
  terrainHeightResolver = typeof resolver === "function" ? resolver : null;
  terrainAnalysisCache = null;
  state.position.y = resolveTerrainHeight(state.position.x, state.position.z) + EYE_HEIGHT;
  if (state.targetPosition) {
    state.targetPosition.y = resolveTerrainHeight(state.targetPosition.x, state.targetPosition.z) + EYE_HEIGHT;
  }
  emitChange();
}

export function setTerrainAnalysisResolver(resolver) {
  terrainAnalysisResolver = typeof resolver === "function" ? resolver : null;
  terrainAnalysisCache = null;
}

export function setMovementBasisResolver(resolver) {
  movementBasisResolver = typeof resolver === "function" ? resolver : null;
}

export function setAutoNavigationEnabled(enabled) {
  state.autoNavigateEnabled = Boolean(enabled);

  if (state.status !== ROBOT_STATUS.INSPECTING && state.status !== ROBOT_STATUS.SCANNING) {
    state.mode = getPreferredIdleMode();
  }

  if (!state.autoNavigateEnabled && state.targetPosition?.type === "waypoint") {
    state.targetPosition = null;
    state.stationActivity = null;
    setIdleState("STANDBY");
  } else if (state.autoNavigateEnabled && state.waypoint && !isAutoDriveActive()) {
    activateWaypointNavigation("NAVIGATING TO TARGET");
  }

  emitChange();
}

export function setWaypointDestination(x, z) {
  if (hasBlockingTask() || state.battery <= 1) {
    return false;
  }

  const waypointSample = resolveTerrainAnalysis(x, z, state.heading);
  state.stationActivity = null;
  state.waypoint = {
    type: "waypoint",
    label: "Waypoint",
    x,
    y: waypointSample.height + EYE_HEIGHT,
    z
  };

  if (state.autoNavigateEnabled) {
    activateWaypointNavigation("NAVIGATING TO TARGET");
  } else if (!state.isMoving) {
    state.activeTask = {
      type: "waypoint-idle",
      label: "WAYPOINT SET",
      progress: 0
    };
  }

  emitChange();
  return true;
}

export function clearWaypointDestination(arrivalLabel = "STANDBY") {
  state.waypoint = null;
  state.stationActivity = null;

  if (state.targetPosition?.type === "waypoint") {
    state.targetPosition = null;
  }

  if (!state.isMoving && !hasBlockingTask()) {
    setIdleState(arrivalLabel);
  }

  emitChange();
}

export function setMissionTarget(targetType) {
  const target = MISSION_TARGETS[targetType];
  if (!target || hasBlockingTask() || state.battery <= 1) {
    return false;
  }

  const waypointSample = resolveTerrainAnalysis(target.x, target.z, state.heading);
  state.autoNavigateEnabled = true;
  state.stationActivity = null;
  state.waypoint = {
    type: "waypoint",
    missionType: target.type,
    label: target.label,
    x: target.x,
    y: waypointSample.height + EYE_HEIGHT,
    z: target.z
  };

  activateWaypointNavigation(`NAVIGATING TO ${target.type.toUpperCase()}`);
  emitChange();
  return true;
}

export function setDirectionalMovement(direction, active) {
  if (!(direction in moveInput)) {
    return;
  }

  moveInput[direction] = Boolean(active);
}

export function moveToLocation(locationId) {
  const location = getLocationById(locationId);
  if (!location || hasBlockingTask() || state.battery <= 1) {
    return false;
  }

  const demoTarget = getDemoMoveTarget(location);
  const targetY = resolveTerrainAnalysis(demoTarget.x, demoTarget.z).height + EYE_HEIGHT;
  const totalDistance = Math.max(
    0.001,
    Math.hypot(demoTarget.x - state.position.x, demoTarget.z - state.position.z)
  );

  state.targetPosition = {
    type: "location",
    id: location.id,
    label: location.label,
    x: demoTarget.x,
    y: targetY,
    z: demoTarget.z
  };
  state.status = ROBOT_STATUS.MOVING;
  state.mode = ROBOT_MODE.AUTO;
  state.activeTask = {
    type: "move",
    label: `Advancing toward ${location.label}`,
    progress: 0,
    totalDistance
  };

  emitChange();
  return true;
}

function applyTerrainAwarePosition(nextX, nextZ, movementLabel, deltaSeconds, desiredHeading) {
  const terrainSample = resolveTerrainAnalysis(nextX, nextZ, desiredHeading);
  const heightBlend = clamp(deltaSeconds * TERRAIN_HEIGHT_RESPONSE, 0, 1);
  const attitudeBlend = clamp(deltaSeconds * TERRAIN_ATTITUDE_RESPONSE, 0, 1);
  const isRoughTerrain = terrainSample.slope > TERRAIN_ROUGH_SLOPE_THRESHOLD;

  state.terrainSlope = terrainSample.slope;
  state.terrainPitch = lerp(state.terrainPitch, terrainSample.pitch ?? 0, attitudeBlend);
  state.terrainRoll = lerp(state.terrainRoll, terrainSample.roll ?? 0, attitudeBlend);
  state.terrainForwardDelta = lerp(
    state.terrainForwardDelta,
    Math.tan(terrainSample.pitch ?? 0) * TERRAIN_TILT_SAMPLE_DISTANCE,
    attitudeBlend
  );
  state.terrainLateralDelta = lerp(
    state.terrainLateralDelta,
    -Math.tan(terrainSample.roll ?? 0) * TERRAIN_TILT_SAMPLE_DISTANCE,
    attitudeBlend
  );
  state.isRoughTerrain = isRoughTerrain;

  if (terrainSample.slope > TERRAIN_STEEP_SLOPE_THRESHOLD) {
    state.isAvoidingTerrain = true;
    state.terrainSpeedMultiplier = 0;
    state.position.y = lerp(state.position.y, terrainSample.height + EYE_HEIGHT, heightBlend);
    terrainAnalysisCache = null;
    state.activeTask = {
      type: "terrain-adjust",
      label: "AVOIDING TERRAIN",
      progress: 0
    };
    return false;
  }

  state.isAvoidingTerrain = false;
  const baseTraction = 1 - clamp(
    terrainSample.slope / Math.max(0.001, TERRAIN_STEEP_SLOPE_THRESHOLD * 1.25),
    0,
    TERRAIN_MAX_TRACTION_LOSS
  );
  const terrainSpeedMultiplier = isRoughTerrain ? baseTraction * 0.5 : baseTraction;
  const traction = clamp(terrainSpeedMultiplier, 0.1, 1);
  state.terrainSpeedMultiplier = traction;
  const groundHeight = lerp(state.position.y - EYE_HEIGHT, terrainSample.height, traction);
  state.position.x = lerp(state.position.x, nextX, traction);
  state.position.z = lerp(state.position.z, nextZ, traction);
  state.position.y = lerp(state.position.y, groundHeight + EYE_HEIGHT, heightBlend);
  terrainAnalysisCache = {
    x: state.position.x,
    z: state.position.z,
    value: {
      ...terrainSample,
      height: groundHeight
    }
  };
  state.activeTask = {
    type: "traverse",
    label:
      isRoughTerrain
        ? "ROUGH TERRAIN"
        : terrainSample.slope > TERRAIN_STEEP_SLOPE_THRESHOLD * 0.55
        ? `${movementLabel} - reduced speed`
        : movementLabel,
    progress: 0
  };
  return true;
}

export function startInspection() {
  if (state.status !== ROBOT_STATUS.IDLE || state.battery <= 3) {
    return false;
  }

  state.status = ROBOT_STATUS.INSPECTING;
  state.mode = ROBOT_MODE.INSPECTION;
  state.activeTask = {
    type: "inspection",
    label: "Inspecting module",
    progress: 0,
    remainingMs: 2000,
    durationMs: 2000
  };

  emitChange();
  return true;
}

export function startMaintenanceSweep() {
  if (state.status !== ROBOT_STATUS.IDLE || state.battery <= 5) {
    return false;
  }

  const durationMs = getSweepDurationMs(state.position);
  state.status = ROBOT_STATUS.SCANNING;
  state.mode = ROBOT_MODE.AUTO;
  state.activeTask = {
    type: "maintenance",
    label: "Sweeping actuator and seal diagnostics",
    progress: 0,
    remainingMs: durationMs,
    durationMs
  };

  emitChange();
  return true;
}

export function advanceMotion(deltaSeconds) {
  if (deltaSeconds <= 0) {
    return;
  }

  syncDerivedState();
  let changed = false;
  const strafeAxis = (moveInput.right ? 1 : 0) - (moveInput.left ? 1 : 0);
  const forwardAxis = (moveInput.forward ? 1 : 0) - (moveInput.backward ? 1 : 0);
  const isManualMoveActive = strafeAxis !== 0 || forwardAxis !== 0;

  if (!hasBlockingTask() && state.mode !== ROBOT_MODE.AUTO) {
    let desiredVelocityX = 0;
    let desiredVelocityZ = 0;

    if (isManualMoveActive) {
      const movementBasis = resolveMovementBasis();
      const basisX = movementBasis.forwardX * forwardAxis + movementBasis.rightX * strafeAxis;
      const basisZ = movementBasis.forwardZ * forwardAxis + movementBasis.rightZ * strafeAxis;
      const magnitude = Math.hypot(basisX, basisZ) || 1;
      const moveSpeed = MANUAL_MOVE_SPEED * state.mobilityScale;
      desiredVelocityX = (basisX / magnitude) * moveSpeed;
      desiredVelocityZ = (basisZ / magnitude) * moveSpeed;
    }

    const alpha = clamp(deltaSeconds * MANUAL_ACCELERATION, 0, 1);
    motionVelocity.x = lerp(motionVelocity.x, desiredVelocityX, alpha);
    motionVelocity.z = lerp(motionVelocity.z, desiredVelocityZ, alpha);

    if (Math.abs(motionVelocity.x) > MIN_VELOCITY || Math.abs(motionVelocity.z) > MIN_VELOCITY) {
      const nextX = state.position.x + motionVelocity.x * deltaSeconds;
      const nextZ = state.position.z + motionVelocity.z * deltaSeconds;
      const desiredHeading = Math.atan2(motionVelocity.x, motionVelocity.z);

      state.status = ROBOT_STATUS.MOVING;
      state.mode = ROBOT_MODE.MANUAL;
      state.stationActivity = null;

      if (applyTerrainAwarePosition(nextX, nextZ, "Manual traverse", deltaSeconds, desiredHeading)) {
        state.heading = interpolateAngle(
          state.heading,
          desiredHeading,
          clamp(deltaSeconds * 6, 0, 1)
        );
      } else {
        motionVelocity.x = lerp(motionVelocity.x, 0, clamp(deltaSeconds * 8, 0, 1));
        motionVelocity.z = lerp(motionVelocity.z, 0, clamp(deltaSeconds * 8, 0, 1));
      }

      changed = true;
    } else if (state.status === ROBOT_STATUS.MOVING && state.mode === ROBOT_MODE.MANUAL) {
      motionVelocity.x = 0;
      motionVelocity.z = 0;
      setIdleState("STANDBY");
      changed = true;
    }
  }

  if (isAutoDriveActive()) {
    const dx = state.targetPosition.x - state.position.x;
    const dz = state.targetPosition.z - state.position.z;
    const distance = Math.hypot(dx, dz);

    const isWaypointTarget = state.targetPosition?.type === "waypoint";
    const arrivalDistance = isWaypointTarget ? AUTO_WAYPOINT_ARRIVAL_DISTANCE : TARGET_SNAP_DISTANCE;

    if (distance > arrivalDistance) {
      const totalDistance = state.activeTask?.totalDistance ?? Math.max(distance, 0.001);
      let desiredDirX = dx / Math.max(distance, 0.001);
      let desiredDirZ = dz / Math.max(distance, 0.001);
      let desiredHeading = Math.atan2(desiredDirX, desiredDirZ);
      let movementLabel = `Advancing toward ${state.targetPosition.label}`;

      if (isWaypointTarget) {
        const aheadDistance = Math.min(4, Math.max(2.1, distance * 0.18));
        const aheadSample = resolveTerrainAnalysis(
          state.position.x + desiredDirX * aheadDistance,
          state.position.z + desiredDirZ * aheadDistance,
          desiredHeading
        );

        if (aheadSample.slope > AUTO_AVOIDANCE_SLOPE_THRESHOLD) {
          const steerOffset = Math.sin(state.missionElapsedMs * 0.0062) * AUTO_AVOIDANCE_STEER;
          const cosOffset = Math.cos(steerOffset);
          const sinOffset = Math.sin(steerOffset);
          const adjustedDirX = desiredDirX * cosOffset - desiredDirZ * sinOffset;
          const adjustedDirZ = desiredDirX * sinOffset + desiredDirZ * cosOffset;
          const adjustedLength = Math.hypot(adjustedDirX, adjustedDirZ) || 1;

          desiredDirX = adjustedDirX / adjustedLength;
          desiredDirZ = adjustedDirZ / adjustedLength;
          desiredHeading = Math.atan2(desiredDirX, desiredDirZ);
          movementLabel = "AVOIDING TERRAIN";
        } else {
          movementLabel = "NAVIGATING TO TARGET";
        }

        const stepDistance = Math.min(
          distance,
          AUTO_WAYPOINT_SPEED * state.mobilityScale * Math.max(0.45, state.terrainSpeedMultiplier) * deltaSeconds
        );
        const nextX = state.position.x + desiredDirX * stepDistance;
        const nextZ = state.position.z + desiredDirZ * stepDistance;

        if (applyTerrainAwarePosition(nextX, nextZ, movementLabel, deltaSeconds, desiredHeading)) {
          state.heading = interpolateAngle(state.heading, desiredHeading, clamp(deltaSeconds * 3.6, 0, 1));
          const remaining = Math.max(0, Math.hypot(state.targetPosition.x - state.position.x, state.targetPosition.z - state.position.z));
          state.activeTask = {
            type: "waypoint",
            label: movementLabel,
            progress: clamp(1 - remaining / totalDistance, 0, 0.999),
            totalDistance
          };
        }
      } else {
        const alpha = clamp(deltaSeconds * MOTION_RESPONSIVENESS * state.mobilityScale, 0, 1);
        const nextX = lerp(state.position.x, state.targetPosition.x, alpha);
        const nextZ = lerp(state.position.z, state.targetPosition.z, alpha);

        if (
          applyTerrainAwarePosition(
            nextX,
            nextZ,
            movementLabel,
            deltaSeconds,
            desiredHeading
          )
        ) {
          state.heading = interpolateAngle(state.heading, desiredHeading, clamp(deltaSeconds * 3.2, 0, 1));
          const remaining = Math.max(0, distance);
          state.activeTask = {
            type: "move",
            label: movementLabel,
            progress: clamp(1 - remaining / totalDistance, 0, 0.999),
            totalDistance
          };
        }
      }
    } else {
      state.position.x = state.targetPosition.x;
      state.position.y = state.targetPosition.y;
      state.position.z = state.targetPosition.z;
      state.status = ROBOT_STATUS.IDLE;
      state.mode = getPreferredIdleMode();
      state.isRoughTerrain = false;
      state.terrainSpeedMultiplier = 1;
      if (state.targetPosition?.type === "waypoint") {
        const arrivedMissionType =
          state.targetPosition.missionType ?? state.waypoint?.missionType ?? null;
        const stationStatusByType = {
          inspection: "INSPECTING MODULE",
          maintenance: "PERFORMING MAINTENANCE",
          research: "COLLECTING DATA"
        };

        state.stationActivity = arrivedMissionType;
        state.waypoint = null;
        state.targetPosition = null;
        state.activeTask = {
          type: "idle",
          label: stationStatusByType[arrivedMissionType] ?? "TARGET REACHED",
          progress: 1
        };
      } else {
        state.activeTask = {
          type: "idle",
          label: `Arrived at ${state.targetPosition.label}`,
          progress: 1
        };
      }
    }

    changed = true;
  }

  if (applyTerrainWrap()) {
    changed = true;
  }

  if (state.activeTask?.type === "inspection") {
    const focus = getInspectionFocus(state.position);
    if (focus) {
      const desiredHeading = Math.atan2(focus.x - state.position.x, focus.z - state.position.z);
      state.heading = interpolateAngle(state.heading, desiredHeading, clamp(deltaSeconds * 2.4, 0, 1));
      changed = true;
    }
  }

  if (state.activeTask?.type === "maintenance") {
    state.heading += deltaSeconds * 0.85;
    changed = true;
  }

  if (changed) {
    emitChange();
  }
}

export function advanceTelemetry(deltaSeconds) {
  updateSystem(deltaSeconds);
}

export function updateSystem(deltaSeconds) {
  if (deltaSeconds <= 0) {
    return;
  }

  state.missionElapsedMs += deltaSeconds * 1000;

  if (state.activeTask?.remainingMs !== undefined) {
    state.activeTask.remainingMs = Math.max(0, state.activeTask.remainingMs - deltaSeconds * 1000);
    state.activeTask.progress = clamp(
      1 - state.activeTask.remainingMs / state.activeTask.durationMs,
      0,
      1
    );

    if (state.activeTask.remainingMs === 0) {
      const completionLabel =
        state.activeTask.type === "inspection"
          ? "Inspection complete"
          : "Maintenance sweep complete";
      state.status = ROBOT_STATUS.IDLE;
      state.mode = getPreferredIdleMode();
      state.activeTask = {
        type: "idle",
        label: completionLabel,
        progress: 1
      };
    }
  }

  syncDerivedState();
  const targetTemperature = computeTemperatureTarget(state.position);
  const targetRadiation = computeRadiationTarget(state.missionElapsedMs);
  const idleDrain = 0.01 * deltaSeconds;
  const moveDrain = state.isMoving ? 0.05 * deltaSeconds : 0;

  state.temperature += (targetTemperature - state.temperature) * 0.005;
  state.radiation += (targetRadiation - state.radiation) * 0.01;
  state.battery = Math.max(0, state.battery - (idleDrain + moveDrain));

  if (state.battery === 0) {
    state.autoNavigateEnabled = false;
    state.waypoint = null;
    state.targetPosition = null;
    state.stationActivity = null;
    setIdleState("Battery depleted");
  }

  telemetrySampleAccumulator += deltaSeconds;
  if (telemetrySampleAccumulator >= TELEMETRY_SAMPLE_INTERVAL) {
    appendTelemetrySample();
    telemetrySampleAccumulator -= TELEMETRY_SAMPLE_INTERVAL;
  }

  emitChange();
}
