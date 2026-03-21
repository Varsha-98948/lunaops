import { getState } from "../state.js";

export function getEnvironment() {
  const state = getState();
  return {
    terrain: "procedural-lunar-regolith",
    temperature: state.temperature,
    radiation: state.radiation
  };
}
