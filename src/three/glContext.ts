import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GraphicsQuality } from '../types';

export interface ThreeRenderPipeline {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer | null;
  bloomPass: UnrealBloomPass | null;
  pmremGenerator: THREE.PMREMGenerator;
  envRT: THREE.WebGLRenderTarget;
  isSoftwareGl: boolean;
  setQuality: (quality: GraphicsQuality) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  resize: (width: number, height: number) => void;
  afterDraw: (cb: () => void) => number;
  cancelAfterDraw: (handle: number) => void;
  dispose: () => void;
}

export function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftware = /SwiftShader|llvmpipe|Software/i.test(glRenderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoftware;
  } catch {
    return true;
  }
}

export function createThreePipeline(
  container: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialQuality: GraphicsQuality = 'ultra'
): ThreeRenderPipeline {
  const isSoftwareGl = detectSoftwareGl();

  const width = Math.max(container.clientWidth || 1200, 320);
  const height = Math.max(container.clientHeight || 675, 180);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl && initialQuality !== 'low',
    powerPreference: 'high-performance',
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  // Environment IBL for crisp metallic PBR reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envScene = new RoomEnvironment();
  const envRT = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  envScene.dispose();

  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;

  if (!isSoftwareGl) {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.52, 0.44, 0.8);
    composer.addPass(bloomPass);
  }

  let currentWidth = width;
  let currentHeight = height;

  const setQuality = (quality: GraphicsQuality) => {
    const dprCap = isSoftwareGl
      ? 1
      : quality === 'ultra'
      ? 2
      : quality === 'high'
      ? 1.5
      : quality === 'medium'
      ? 1.2
      : 0.95;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(currentWidth, currentHeight);

    if (!isSoftwareGl && quality !== 'low') {
      renderer.shadowMap.enabled = true;
    } else {
      renderer.shadowMap.enabled = false;
    }

    if (composer) {
      composer.setSize(currentWidth, currentHeight);
    }

    if (bloomPass) {
      if (quality === 'low') {
        bloomPass.enabled = false;
        bloomPass.strength = 0;
      } else {
        bloomPass.enabled = true;
        bloomPass.strength = quality === 'ultra' ? 0.62 : quality === 'high' ? 0.44 : 0.24;
      }
      bloomPass.resolution.set(currentWidth, currentHeight);
    }
  };

  setQuality(initialQuality);

  let activeTimeoutId = 0;
  let activeRafId = 0;

  const afterDraw = (cb: () => void): number => {
    if (!isSoftwareGl) {
      activeRafId = requestAnimationFrame(cb);
      return activeRafId;
    }

    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      activeTimeoutId = window.setTimeout(cb, 80);
      return activeTimeoutId;
    }

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!sync) {
        activeTimeoutId = window.setTimeout(cb, 80);
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED || status === gl.WAIT_FAILED) {
        gl.deleteSync(sync);
        activeTimeoutId = window.setTimeout(cb, 80);
      } else {
        activeTimeoutId = window.setTimeout(poll, 4);
      }
    };
    activeTimeoutId = window.setTimeout(poll, 0);
    return activeTimeoutId;
  };

  const cancelAfterDraw = (handle: number) => {
    if (isSoftwareGl) {
      window.clearTimeout(handle);
      if (activeTimeoutId) window.clearTimeout(activeTimeoutId);
    } else {
      cancelAnimationFrame(handle);
      if (activeRafId) cancelAnimationFrame(activeRafId);
    }
  };

  const render = (targetScene: THREE.Scene, targetCamera: THREE.Camera) => {
    if (composer && !isSoftwareGl) {
      composer.render();
    } else {
      renderer.render(targetScene, targetCamera);
    }
  };

  const resize = (newWidth: number, newHeight: number) => {
    currentWidth = Math.max(newWidth, 1);
    currentHeight = Math.max(newHeight, 1);
    camera.aspect = currentWidth / currentHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(currentWidth, currentHeight);
    if (composer) composer.setSize(currentWidth, currentHeight);
    if (bloomPass) bloomPass.resolution.set(currentWidth, currentHeight);
  };

  const dispose = () => {
    if (activeTimeoutId) window.clearTimeout(activeTimeoutId);
    if (activeRafId) cancelAnimationFrame(activeRafId);
    envRT.dispose();
    pmremGenerator.dispose();
    composer?.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    renderer,
    composer,
    bloomPass,
    pmremGenerator,
    envRT,
    isSoftwareGl,
    setQuality,
    render,
    resize,
    afterDraw,
    cancelAfterDraw,
    dispose,
  };
}
