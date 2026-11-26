import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GadgetId, ItemRarity, OperatorId, StoreItem, WeaponId } from '../types';
import { detectSoftwareGl } from './glContext';
import { buildHeroRig, buildWeapon3D } from './hero3d';

const RARITY_HEX: Record<ItemRarity, number> = {
  Rare: 0x22d3ee,
  Epic: 0xf43f5e,
  Legendary: 0xfacc15,
  Mythic: 0xc084fc,
};

export function buildGadget3D(gadgetId: GadgetId): {
  group: THREE.Group;
  animate: (t: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };

  const carbonMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.28 })
  );
  const titaniumMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
  );
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.16 })
  );

  let spinRotorA: THREE.Object3D | null = null;
  let spinRotorB: THREE.Object3D | null = null;
  let corePulseMat: THREE.MeshStandardMaterial | null = null;
  let leftWingPivot: THREE.Group | null = null;
  let rightWingPivot: THREE.Group | null = null;

  if (gadgetId === 'gdg_combat_drone') {
    const cyanGlow = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.2,
        roughness: 0.15,
      })
    );
    corePulseMat = cyanGlow;

    const hull = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.45, 1)), carbonMat);
    hull.scale.set(1.4, 0.55, 1.1);
    group.add(hull);

    const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 12, 12)), cyanGlow);
    eye.position.set(0, -0.05, 0.45);
    group.add(eye);

    const visorBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.48, 0.04, 8, 24)), titaniumMat);
    visorBand.rotation.x = Math.PI / 2;
    group.add(visorBand);

    const buildPod = (xPos: number) => {
      const pod = new THREE.Group();
      pod.position.set(xPos, 0.08, 0);
      const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.08, 0.1)), titaniumMat);
      arm.position.set(-Math.sign(xPos) * 0.2, 0, 0);
      const shroud = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.28, 0.045, 8, 20)), carbonMat);
      shroud.rotation.x = Math.PI / 2;
      const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.02, 0.07)), cyanGlow);
      pod.add(arm, shroud, blade);
      return { pod, blade };
    };

    const podL = buildPod(-0.75);
    const podR = buildPod(0.75);
    spinRotorA = podL.blade;
    spinRotorB = podR.blade;
    group.add(podL.pod, podR.pod);
  } else if (gadgetId === 'gdg_reactive_armor') {
    const amberGlow = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.9,
        roughness: 0.2,
      })
    );
    corePulseMat = amberGlow;

    const chestBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.92, 0.55)), carbonMat);
    group.add(chestBase);

    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.4, 0.18)), titaniumMat);
      plate.position.set(side * 0.3, 0.16, 0.26);
      plate.rotation.y = -side * 0.22;
      group.add(plate);

      const pauldrons = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.24, 0.56)), goldMat);
      pauldrons.position.set(side * 0.68, 0.38, 0);
      pauldrons.rotation.z = -side * 0.28;
      group.add(pauldrons);
    }

    const arcCore = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.2, 0)), amberGlow);
    arcCore.position.set(0, 0.06, 0.34);
    group.add(arcCore);

    const coreRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.26, 0.035, 8, 24)), goldMat);
    coreRing.position.set(0, 0.06, 0.32);
    group.add(coreRing);
  } else if (gadgetId === 'gdg_quick_mag') {
    const cyanCoil = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 2.1,
        roughness: 0.18,
      })
    );
    corePulseMat = cyanCoil;

    const drum = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 16)), carbonMat);
    drum.rotation.z = 0.28;
    group.add(drum);

    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 16)), titaniumMat);
    cap.position.set(-0.12, 0.44, 0);
    cap.rotation.z = 0.28;
    group.add(cap);

    for (let i = -1; i <= 1; i++) {
      const coil = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.45, 0.04, 8, 24)), cyanCoil);
      coil.position.set(-i * 0.07, i * 0.24, 0);
      coil.rotation.x = Math.PI / 2;
      coil.rotation.y = 0.28;
      group.add(coil);
    }

    const railClip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.72, 0.36)), goldMat);
    railClip.position.set(0.36, 0.06, 0);
    railClip.rotation.z = 0.28;
    group.add(railClip);
  } else if (gadgetId === 'gdg_kinetic_servo') {
    const emeraldGlow = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x34d399,
        emissive: 0x10b981,
        emissiveIntensity: 2.1,
        roughness: 0.18,
      })
    );
    corePulseMat = emeraldGlow;

    const harness = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.44, 0.42)), carbonMat);
    group.add(harness);

    for (const side of [-1, 1]) {
      const piston = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.92, 12)), titaniumMat);
      piston.position.set(side * 0.56, 0.04, 0.08);
      piston.rotation.z = -side * 0.2;
      group.add(piston);

      const naniteRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.22, 0.04, 8, 20)), emeraldGlow);
      naniteRing.position.set(side * 0.56, 0.04, 0.08);
      naniteRing.rotation.x = Math.PI / 2;
      group.add(naniteRing);
    }

    const coreVial = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.62, 12)), emeraldGlow);
    coreVial.position.set(0, 0.06, 0.26);
    group.add(coreVial);
  } else {
    // gdg_mythic_wings — Twin Valkyrie Chrono-Thruster Wings
    const mythicGlow = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe879f9,
        emissive: 0xc026d3,
        emissiveIntensity: 2.5,
        roughness: 0.15,
      })
    );
    corePulseMat = mythicGlow;

    const spinePack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.82, 0.34)), carbonMat);
    group.add(spinePack);

    const coreGem = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.18, 0)), mythicGlow);
    coreGem.position.set(0, 0.08, 0.22);
    group.add(coreGem);

    const buildWing = (dir: -1 | 1) => {
      const wing = new THREE.Group();
      wing.position.set(dir * 0.22, 0.15, 0);
      for (let i = 0; i < 4; i++) {
        const len = 0.92 - i * 0.14;
        const vane = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len, 0.13, 0.08)), i % 2 === 0 ? titaniumMat : goldMat);
        vane.position.set(dir * (0.28 + len * 0.45), 0.25 - i * 0.22, -i * 0.04);
        vane.rotation.z = dir * (0.38 - i * 0.14);
        wing.add(vane);

        const edge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len * 0.85, 0.05, 0.09)), mythicGlow);
        edge.position.set(dir * (0.28 + len * 0.45), 0.18 - i * 0.22, -i * 0.04);
        edge.rotation.z = dir * (0.38 - i * 0.14);
        wing.add(edge);
      }
      return wing;
    };

    leftWingPivot = buildWing(-1);
    rightWingPivot = buildWing(1);
    group.add(leftWingPivot, rightWingPivot);
  }

  return {
    group,
    animate: (t: number) => {
      if (spinRotorA) spinRotorA.rotation.y = t * 18;
      if (spinRotorB) spinRotorB.rotation.y = -t * 18;
      if (leftWingPivot && rightWingPivot) {
        const flap = Math.sin(t * 3.4) * 0.14;
        leftWingPivot.rotation.y = 0.18 + flap;
        rightWingPivot.rotation.y = -0.18 - flap;
      }
      if (corePulseMat) {
        corePulseMat.emissiveIntensity = 1.85 + Math.sin(t * 4.5) * 0.55;
      }
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

interface PedestalSubjectEntry {
  key: string;
  root: THREE.Group;
  subjectGroup: THREE.Group;
  ringOuter: THREE.Mesh;
  ringInner: THREE.Mesh;
  auraPoints: THREE.Points;
  accentLight: THREE.PointLight;
  updateCustom?: (t: number) => void;
  dispose: () => void;
}

function buildPedestalSubject(item: StoreItem): PedestalSubjectEntry {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const rarityColor = RARITY_HEX[item.rarity] ?? 0x22d3ee;

  // Holographic Pedestal Base
  const baseGeo = new THREE.CylinderGeometry(1.18, 1.38, 0.24, 32);
  const deckGeo = new THREE.CylinderGeometry(1.02, 1.12, 0.1, 32);
  const ringOuterGeo = new THREE.TorusGeometry(1.26, 0.025, 8, 48);
  const ringInnerGeo = new THREE.TorusGeometry(0.92, 0.018, 8, 40);
  geos.push(baseGeo, deckGeo, ringOuterGeo, ringInnerGeo);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.88,
    roughness: 0.25,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.9,
    roughness: 0.18,
  });
  const holoMat = new THREE.MeshBasicMaterial({
    color: rarityColor,
    transparent: true,
    opacity: 0.9,
  });
  const holoInnerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
  });
  mats.push(baseMat, deckMat, holoMat, holoInnerMat);

  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -1.25;
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.y = -1.09;

  const ringOuter = new THREE.Mesh(ringOuterGeo, holoMat);
  ringOuter.rotation.x = Math.PI / 2;
  ringOuter.position.y = -1.02;

  const ringInner = new THREE.Mesh(ringInnerGeo, holoInnerMat);
  ringInner.rotation.x = Math.PI / 2;
  ringInner.position.y = -0.94;

  // Holographic upward beam cylinder
  const beamGeo = new THREE.CylinderGeometry(0.96, 1.05, 1.65, 28, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: rarityColor,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  geos.push(beamGeo);
  mats.push(beamMat);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -0.2;

  // Rarity Aura Motes
  const moteCount = item.rarity === 'Mythic' ? 36 : item.rarity === 'Legendary' ? 26 : 18;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const a = (i / moteCount) * Math.PI * 2;
    const rad = 0.72 + (i % 4) * 0.16;
    motePos[i * 3] = Math.cos(a) * rad;
    motePos[i * 3 + 1] = -0.9 + ((i * 0.27) % 2.1);
    motePos[i * 3 + 2] = Math.sin(a) * rad;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: rarityColor,
    size: item.rarity === 'Mythic' ? 0.095 : 0.07,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  geos.push(moteGeo);
  mats.push(moteMat);
  const auraPoints = new THREE.Points(moteGeo, moteMat);

  const accentLight = new THREE.PointLight(rarityColor, 2.8, 7);
  accentLight.position.set(0.6, 0.8, 1.4);

  root.add(baseMesh, deckMesh, ringOuter, ringInner, beam, auraPoints, accentLight);

  const subjectGroup = new THREE.Group();
  root.add(subjectGroup);

  let updateCustom: ((t: number) => void) | undefined;
  let extraDispose: (() => void) | undefined;

  if (item.category === 'operators') {
    const rig = buildHeroRig({
      operatorId: item.id as OperatorId,
      weaponId: 'wpn_carbon_gold_ar',
      gadgetIds: item.id === 'op_void_valkyrie' ? ['gdg_mythic_wings'] : [],
      hasDrone: item.id === 'op_void_valkyrie' || item.id === 'op_aegis_gold',
    });
    // Face viewer with subtle heroic 3/4 stance
    rig.root.scale.setScalar(0.66);
    rig.root.position.set(0, -1.04, 0);
    rig.bodyGroup.rotation.y = 0.55;
    subjectGroup.add(rig.root);

    updateCustom = (t: number) => {
      rig.headGroup.rotation.z = Math.sin(t * 2) * 0.03;
      rig.leftArm.rotation.z = Math.sin(t * 2.2) * 0.05;
      rig.rightArm.rotation.z = Math.cos(t * 2.2) * 0.05;
      if (rig.wingsGroup.visible) {
        rig.wingsGroup.rotation.y = Math.sin(t * 3.1) * 0.14;
      }
      if (rig.droneGroup.visible) {
        rig.droneGroup.position.y = 3.05 + Math.sin(t * 3.5) * 0.12;
      }
    };
    extraDispose = () => rig.dispose();
  } else if (item.category === 'weapons') {
    const built = buildWeapon3D(item.id as WeaponId);
    built.group.scale.setScalar(built.isBlade ? 1.42 : 1.52);
    built.group.position.set(built.isBlade ? -0.15 : -0.45, 0.08, 0);
    built.group.rotation.z = built.isBlade ? 0.34 : 0.18;
    subjectGroup.add(built.group);

    updateCustom = (t: number) => {
      subjectGroup.position.y = Math.sin(t * 2.4) * 0.09;
    };
    extraDispose = () => built.dispose();
  } else {
    const built = buildGadget3D(item.id as GadgetId);
    built.group.scale.setScalar(1.22);
    built.group.position.set(0, 0.1, 0);
    subjectGroup.add(built.group);

    updateCustom = (t: number) => {
      subjectGroup.position.y = Math.sin(t * 2.6) * 0.08;
      built.animate(t);
    };
    extraDispose = () => built.dispose();
  }

  return {
    key: item.id,
    root,
    subjectGroup,
    ringOuter,
    ringInner,
    auraPoints,
    accentLight,
    updateCustom,
    dispose: () => {
      extraDispose?.();
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// Single shared offscreen WebGLRenderer feeding all live 3D pedestals cleanly (zero context exhaustion)
class SharedPedestalEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.2, 40);
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private isSoftwareGl = false;
  private subjects = new Map<string, PedestalSubjectEntry>();
  private subscribers = new Map<
    string,
    {
      canvas: HTMLCanvasElement;
      item: StoreItem;
      hovered: boolean;
      yaw: number | null;
      pitch: number | null;
      zoom: number;
      size: number;
    }
  >();
  private loopId = 0;
  private running = false;

  private ensureInit(size: number) {
    if (this.renderer) return;
    this.isSoftwareGl = detectSoftwareGl();

    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    this.renderer = new THREE.WebGLRenderer({
      canvas: offscreen,
      alpha: true,
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setSize(size, size, false);

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    this.envRT = this.pmremGenerator.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    envScene.dispose();

    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 1.15);
    const key = new THREE.DirectionalLight(0xffffff, 2.35);
    key.position.set(3.5, 5.5, 4.5);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rim.position.set(-4.5, 3, -3.5);
    this.scene.add(hemi, key, rim);
  }

  private getOrBuildSubject(item: StoreItem): PedestalSubjectEntry {
    let entry = this.subjects.get(item.id);
    if (!entry) {
      entry = buildPedestalSubject(item);
      entry.root.visible = false;
      this.scene.add(entry.root);
      this.subjects.set(item.id, entry);
    }
    return entry;
  }

  subscribe(
    id: string,
    canvas: HTMLCanvasElement,
    item: StoreItem,
    hovered: boolean,
    yaw: number | null,
    pitch: number | null,
    zoom: number,
    size: number
  ) {
    this.subscribers.set(id, { canvas, item, hovered, yaw, pitch, zoom, size });
    this.startLoop();
  }

  update(
    id: string,
    item: StoreItem,
    hovered: boolean,
    yaw: number | null,
    pitch: number | null,
    zoom: number
  ) {
    const sub = this.subscribers.get(id);
    if (sub) {
      sub.item = item;
      sub.hovered = hovered;
      sub.yaw = yaw;
      sub.pitch = pitch;
      sub.zoom = zoom;
    }
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) {
      this.stopLoop();
    }
  }

  private startLoop() {
    if (this.running) return;
    this.running = true;

    const tick = () => {
      if (!this.running || this.subscribers.size === 0) {
        this.running = false;
        return;
      }

      const maxTargetSize = Array.from(this.subscribers.values()).reduce(
        (acc, s) => Math.max(acc, s.size),
        256
      );
      this.ensureInit(maxTargetSize);
      const renderer = this.renderer;
      if (!renderer) return;

      const t = performance.now() / 1000;

      // Render each subscribed canvas sequentially using the single WebGL context
      for (const sub of this.subscribers.values()) {
        if (sub.canvas.width !== sub.size || sub.canvas.height !== sub.size) {
          sub.canvas.width = sub.size;
          sub.canvas.height = sub.size;
        }
        if (renderer.domElement.width !== sub.size || renderer.domElement.height !== sub.size) {
          renderer.setSize(sub.size, sub.size, false);
        }

        const entry = this.getOrBuildSubject(sub.item);
        entry.root.visible = true;

        const baseSpin = t * (sub.hovered ? 1.55 : 0.72);
        entry.subjectGroup.rotation.y = sub.yaw !== null ? sub.yaw : baseSpin;
        entry.subjectGroup.rotation.x = sub.pitch !== null ? sub.pitch : 0.08;
        entry.ringOuter.rotation.z = t * 0.9;
        entry.ringInner.rotation.z = -t * 1.4;
        entry.auraPoints.rotation.y = t * 0.65;
        entry.updateCustom?.(t);

        this.camera.position.set(0, 0.25, 4.9 / Math.max(0.55, sub.zoom));
        this.camera.lookAt(0, -0.18, 0);

        renderer.render(this.scene, this.camera);
        entry.root.visible = false;

        const ctx2d = sub.canvas.getContext('2d');
        if (ctx2d) {
          ctx2d.clearRect(0, 0, sub.size, sub.size);
          ctx2d.drawImage(renderer.domElement, 0, 0, sub.size, sub.size);
        }
      }

      if (this.isSoftwareGl) {
        this.loopId = window.setTimeout(tick, 90);
      } else {
        this.loopId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.loopId = window.setTimeout(tick, 40);
    } else {
      this.loopId = requestAnimationFrame(tick);
    }
  }

  private stopLoop() {
    this.running = false;
    window.clearTimeout(this.loopId);
    cancelAnimationFrame(this.loopId);
  }
}

const sharedEngine = new SharedPedestalEngine();
let nextInstanceCounter = 1;

export function PedestalCardCanvas3D({
  item,
  hovered = false,
  size = 220,
  className = '',
}: {
  item: StoreItem;
  hovered?: boolean;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceIdRef = useRef<string>(`ped_card_${nextInstanceCounter++}`);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = instanceIdRef.current;
    sharedEngine.subscribe(id, canvas, item, hovered, null, null, 1, size);
    return () => {
      sharedEngine.unsubscribe(id);
    };
  }, [size]);

  useEffect(() => {
    sharedEngine.update(instanceIdRef.current, item, hovered, null, null, 1);
  }, [item, hovered]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`block w-full h-full object-contain ${className}`}
    />
  );
}

export function PedestalInspector3D({
  item,
  size = 380,
  className = '',
}: {
  item: StoreItem;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceIdRef = useRef<string>(`ped_insp_${nextInstanceCounter++}`);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.45,
    pitch: 0.1,
    manual: false,
  });

  useEffect(() => {
    dragStateRef.current.manual = false;
    dragStateRef.current.yaw = 0.45;
    dragStateRef.current.pitch = 0.1;
  }, [item.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = instanceIdRef.current;
    sharedEngine.subscribe(id, canvas, item, true, null, null, 1.08, size);
    return () => {
      sharedEngine.unsubscribe(id);
    };
  }, [size]);

  useEffect(() => {
    const ds = dragStateRef.current;
    sharedEngine.update(
      instanceIdRef.current,
      item,
      true,
      ds.manual ? ds.yaw : null,
      ds.manual ? ds.pitch : null,
      1.08
    );
  }, [item]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current.active = true;
    dragStateRef.current.manual = true;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    const dx = e.clientX - ds.lastX;
    const dy = e.clientY - ds.lastY;
    ds.lastX = e.clientX;
    ds.lastY = e.clientY;
    ds.yaw += dx * 0.015;
    ds.pitch = Math.max(-0.45, Math.min(0.55, ds.pitch + dy * 0.01));
    sharedEngine.update(instanceIdRef.current, item, true, ds.yaw, ds.pitch, 1.08);
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
    setDragging(false);
  };

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full block touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      />
      <div className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] font-mono text-zinc-400 bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 rounded">
        Drag to Rotate 360°
      </div>
    </div>
  );
}
