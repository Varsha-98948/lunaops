function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required UI element: ${id}`);
  }
  return element;
}

function formatMissionTime(missionElapsedMs) {
  const totalSeconds = Math.floor(missionElapsedMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `MET ${hours}:${minutes}:${seconds}`;
}

function formatPosition(position) {
  return `x ${position.x.toFixed(2)} | y ${position.y.toFixed(2)} | z ${position.z.toFixed(2)}`;
}

function applyTone(element, tone) {
  element.classList.toggle("is-good", tone === "good");
  element.classList.toggle("is-danger", tone === "danger");
  element.classList.toggle("is-caution", tone === "caution");
  element.classList.toggle("is-active", tone === "active");
}

function drawTelemetryChart(canvas, values, color, minValue, maxValue) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 12;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#07101d";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(109, 226, 255, 0.12)";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = padding + (chartHeight / 4) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  context.strokeStyle = color;
  context.lineWidth = 2.2;
  context.beginPath();

  values.forEach((value, index) => {
    const normalized = (value - minValue) / Math.max(0.0001, maxValue - minValue);
    const x = padding + (index / Math.max(1, values.length - 1)) * chartWidth;
    const y = padding + (1 - normalized) * chartHeight;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  const lastValue = values[values.length - 1];
  const normalized = (lastValue - minValue) / Math.max(0.0001, maxValue - minValue);
  const x = padding + chartWidth;
  const y = padding + (1 - normalized) * chartHeight;

  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fill();
}

function createComparableState(state) {
  return {
    targetLabel: state.targetPosition?.label || state.waypoint?.label || "",
    hasTargetPosition: Boolean(state.targetPosition),
    activeTaskLabel: state.activeTask?.label || "",
    stationActivity: state.stationActivity || "",
    isLowPower: Boolean(state.isLowPower),
    isAvoidingTerrain: Boolean(state.isAvoidingTerrain),
    displayStatus: state.displayStatus,
    mode: state.mode
  };
}

export function initUI() {
  let lastTelemetrySignature = "";
  let previousStateMeta = null;
  let alertTimeoutId = null;
  const elements = {
    missionTime: requireElement("mission-time"),
    position: requireElement("position"),
    robotStatus: requireElement("robot-status"),
    mode: requireElement("mode"),
    target: requireElement("target-readout"),
    activeTask: requireElement("active-task"),
    systemWarning: requireElement("system-warning"),
    batteryReadout: requireElement("battery-readout"),
    temperatureReadout: requireElement("temperature-readout"),
    radiationReadout: requireElement("radiation-readout"),
    minimapDistance: requireElement("minimap-distance"),
    timeline: requireElement("timeline"),
    missionAlert: requireElement("mission-alert"),
    batteryChart: requireElement("batteryChart"),
    temperatureChart: requireElement("temperatureChart"),
    radiationChart: requireElement("radiationChart")
  };

  function addLog(text, tone = "") {
    const latestEntry = elements.timeline.firstElementChild;
    if (latestEntry?.dataset.message === text) {
      return;
    }

    const entry = document.createElement("div");
    entry.className = "timeline-entry";
    if (tone) {
      entry.classList.add(`is-${tone}`);
    }
    entry.dataset.message = text;
    entry.textContent = text;
    elements.timeline.prepend(entry);

    while (elements.timeline.children.length > 6) {
      elements.timeline.removeChild(elements.timeline.lastElementChild);
    }
  }

  function showAlert(text, tone = "") {
    if (alertTimeoutId) {
      window.clearTimeout(alertTimeoutId);
    }

    elements.missionAlert.textContent = text;
    elements.missionAlert.classList.remove("is-danger", "is-caution", "is-success");
    if (tone) {
      elements.missionAlert.classList.add(`is-${tone}`);
    }
    elements.missionAlert.classList.add("is-visible");

    alertTimeoutId = window.setTimeout(() => {
      elements.missionAlert.classList.remove("is-visible");
    }, 2000);
  }

  addLog("System Initialized", "success");

  return {
    render(state) {
      const nextStateMeta = createComparableState(state);
      elements.missionTime.textContent = formatMissionTime(state.missionElapsedMs);
      elements.position.textContent = formatPosition(state.position);
      elements.robotStatus.textContent = state.displayStatus;
      elements.mode.textContent = state.mode;
      elements.target.textContent = state.targetPosition?.label || state.waypoint?.label || "No target";
      elements.activeTask.textContent = state.activeTask?.label || "STANDBY";
      elements.systemWarning.textContent = state.systemWarning;

      elements.batteryReadout.textContent = `${state.battery.toFixed(1)}%`;
      elements.temperatureReadout.textContent = `${state.temperature.toFixed(1)} C`;
      elements.radiationReadout.textContent = `${state.radiation.toFixed(1)} uSv/h`;
      const activeTarget = state.targetPosition || state.waypoint;
      if (activeTarget) {
        const dx = activeTarget.x - state.position.x;
        const dz = activeTarget.z - state.position.z;
        elements.minimapDistance.textContent = `Distance: ${Math.floor(Math.hypot(dx, dz))}m`;
      } else {
        elements.minimapDistance.textContent = "Distance: --";
      }

      const statusTone = state.isLowPower ? "danger" : state.isAvoidingTerrain ? "caution" : state.isMoving ? "active" : "good";
      const batteryTone = state.battery <= 25 ? "danger" : state.battery <= 55 ? "caution" : "good";
      const warningTone = state.isLowPower ? "danger" : state.isAvoidingTerrain || state.isRoughTerrain ? "caution" : "";
      applyTone(elements.robotStatus, statusTone);
      applyTone(elements.activeTask, statusTone);
      applyTone(elements.systemWarning, warningTone);
      applyTone(elements.batteryReadout, batteryTone);

      const telemetrySignature = [
        state.telemetryHistory.battery.at(-1)?.toFixed(3),
        state.telemetryHistory.temperature.at(-1)?.toFixed(3),
        state.telemetryHistory.radiation.at(-1)?.toFixed(3),
        state.telemetryHistory.battery.length
      ].join("|");

      if (telemetrySignature !== lastTelemetrySignature) {
        lastTelemetrySignature = telemetrySignature;
        drawTelemetryChart(elements.batteryChart, state.telemetryHistory.battery, "#6af0b2", 0, 100);
        drawTelemetryChart(elements.temperatureChart, state.telemetryHistory.temperature, "#ffd479", -70, -35);
        drawTelemetryChart(elements.radiationChart, state.telemetryHistory.radiation, "#ff8469", 116, 124);
      }

      if (!previousStateMeta) {
        previousStateMeta = nextStateMeta;
        return;
      }

      if (
        nextStateMeta.targetLabel &&
        nextStateMeta.targetLabel !== previousStateMeta.targetLabel
      ) {
        addLog(`Target Selected: ${nextStateMeta.targetLabel}`, "active");
      }

      if (
        nextStateMeta.hasTargetPosition &&
        (
          !previousStateMeta.hasTargetPosition ||
          nextStateMeta.targetLabel !== previousStateMeta.targetLabel
        )
      ) {
        addLog(`Navigating: ${nextStateMeta.targetLabel}`, "active");
      }

      if (
        nextStateMeta.activeTaskLabel &&
        nextStateMeta.activeTaskLabel !== previousStateMeta.activeTaskLabel &&
        ["INSPECTING MODULE", "PERFORMING MAINTENANCE", "COLLECTING DATA"].includes(nextStateMeta.activeTaskLabel)
      ) {
        addLog("Arrived", "success");
        addLog(nextStateMeta.activeTaskLabel, "success");
      }

      if (
        nextStateMeta.activeTaskLabel === "TARGET REACHED" &&
        previousStateMeta.activeTaskLabel !== "TARGET REACHED"
      ) {
        addLog("Arrived", "success");
        addLog("Operation Complete", "success");
        showAlert("MISSION SUCCESS", "success");
      }

      if (!previousStateMeta.isLowPower && nextStateMeta.isLowPower) {
        addLog("LOW POWER", "danger");
        showAlert("LOW POWER", "danger");
      }

      if (!previousStateMeta.isAvoidingTerrain && nextStateMeta.isAvoidingTerrain) {
        addLog("Terrain warning", "caution");
        showAlert("TERRAIN WARNING", "caution");
      }

      if (!previousStateMeta.stationActivity && nextStateMeta.stationActivity) {
        addLog("Operation Complete", "success");
        showAlert("MISSION SUCCESS", "success");
      }

      previousStateMeta = nextStateMeta;
    }
  };
}
