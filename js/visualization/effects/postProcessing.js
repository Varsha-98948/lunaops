import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { EffectComposer } from "https://unpkg.com/three@0.161.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.161.0/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "https://unpkg.com/three@0.161.0/examples/jsm/postprocessing/OutputPass.js";
import { N8AOPass } from "https://unpkg.com/n8ao@latest/dist/N8AO.js";

export function setupPostProcessing({ renderer, scene, camera, container, additionalPasses = [] }) {
  const maxPixelRatio = 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Enforced pass order:
  // RenderPass -> AO -> additional effects (SSR/Bloom/etc.) -> OutputPass.
  // This preserves AO depth contribution when compositing with other effects.
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const n8aoPass = new N8AOPass(scene, camera, window.innerWidth, window.innerHeight);
  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(n8aoPass);

  additionalPasses.forEach((pass) => {
    composer.addPass(pass);
  });

  composer.addPass(outputPass);

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    composer.setSize(w, h);
    n8aoPass.setSize(w, h);
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    render() {
      composer.render();
    }
  };
}
