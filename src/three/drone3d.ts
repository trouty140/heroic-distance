import * as THREE from 'three';
import type { DroneModelId } from '../types';
import { toWorldX, toWorldY } from './hero3d';

export interface SupportDroneRig {
  modelId: DroneModelId;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  gimbalGroup: THREE.Group;
  rotorA: THREE.Object3D;
  rotorB: THREE.Object3D;
  radarDish: THREE.Object3D | null;
  supportBeam: THREE.Mesh;
  supportBeamMat: THREE.MeshBasicMaterial;
  scanBeam: THREE.Mesh;
  scanBeamMat: THREE.MeshBasicMaterial;
  targetReticle: THREE.Mesh;
  targetReticleMat: THREE.MeshBasicMaterial;
  muzzleFlash: THREE.Mesh;
  muzzleMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshStandardMaterial;
  accentLight: THREE.PointLight;
  dispose: () => void;
}

const DRONE_COLORS: Record<
  DroneModelId,
  { hull: number; trim: number; core: number; beam: number }
> = {
  drone_sentinel: { hull: 0x0f172a, trim: 0x94a3b8, core: 0x22d3ee, beam: 0x06b6d4 },
  drone_aegis: { hull: 0x1e293b, trim: 0xfacc15, core: 0x38bdf8, beam: 0x38bdf8 },
  drone_medic: { hull: 0xe2e8f0, trim: 0x334155, core: 0x34d399, beam: 0x10b981 },
  drone_scanner: { hull: 0x18181b, trim: 0xf59e0b, core: 0xfacc15, beam: 0xfbbf24 },
};

export function buildSupportDrone3D(modelId: DroneModelId): SupportDroneRig {
  const pal = DRONE_COLORS[modelId] || DRONE_COLORS.drone_sentinel;
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const gimbalGroup = new THREE.Group();
  bodyGroup.add(gimbalGroup);
  root.add(bodyGroup);

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

  const hullMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.hull,
      metalness: 0.82,
      roughness: 0.25,
    })
  );
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.trim,
      metalness: 0.9,
      roughness: 0.18,
    })
  );
  const coreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.core,
      emissive: pal.core,
      emissiveIntensity: 2.3,
      metalness: 0.25,
      roughness: 0.16,
    })
  );

  // Main chassis silhouette varies by drone model
  if (modelId === 'drone_aegis') {
    const coreSphere = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.34, 1)), hullMat);
    coreSphere.scale.set(1.2, 0.82, 1.05);
    const shieldRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.48, 0.045, 8, 24)), trimMat);
    shieldRing.rotation.x = Math.PI / 2;
    const shieldOrbit = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.42, 0.025, 8, 24)), coreMat);
    shieldOrbit.rotation.z = Math.PI / 3;
    bodyGroup.add(coreSphere, shieldRing, shieldOrbit);
  } else if (modelId === 'drone_medic') {
    const medPod = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.24, 0.34, 6, 12)), hullMat);
    medPod.rotation.z = Math.PI / 2;
    const crossH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.08, 0.08)), coreMat);
    crossH.position.set(0, 0.05, 0.24);
    const crossV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.24, 0.08)), coreMat);
    crossV.position.set(0, 0.05, 0.24);
    const haloRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.025, 8, 22)), coreMat);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.y = -0.14;
    bodyGroup.add(medPod, crossH, crossV, haloRing);
  } else if (modelId === 'drone_scanner') {
    const stealthWing = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.42, 0.86, 4)), hullMat);
    stealthWing.rotation.z = -Math.PI / 2;
    stealthWing.scale.set(0.45, 1.0, 1.35);
    const sensorStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.06, 0.62)), trimMat);
    sensorStrip.position.set(-0.08, 0.04, 0);
    bodyGroup.add(stealthWing, sensorStrip);
  } else {
    // drone_sentinel
    const hull = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.36, 1)), hullMat);
    hull.scale.set(1.38, 0.62, 1.05);
    const trimBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.035, 8, 20)), trimMat);
    trimBand.rotation.x = Math.PI / 2;
    bodyGroup.add(hull, trimBand);
  }

  // Twin ducted rotor pods (left/right in Z)
  const buildRotorPod = (zOffset: number) => {
    const pod = new THREE.Group();
    pod.position.set(-0.05, 0.14, zOffset);
    const strut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.06, 0.32)), trimMat);
    strut.position.z = -Math.sign(zOffset) * 0.14;
    const shroud = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.2, 0.032, 8, 16)), hullMat);
    shroud.rotation.x = Math.PI / 2;
    const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.018, 0.05)), coreMat);
    pod.add(strut, shroud, blade);
    return { pod, blade };
  };

  const podL = buildRotorPod(-0.56);
  const podR = buildRotorPod(0.56);
  bodyGroup.add(podL.pod, podR.pod);

  // Optional top rotating radar dish for Scanner Drone (and fin for others)
  let radarDish: THREE.Object3D | null = null;
  if (modelId === 'drone_scanner') {
    const dishGroup = new THREE.Group();
    dishGroup.position.set(-0.05, 0.28, 0);
    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8)), trimMat);
    const dish = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.06, 0.12, 12, 1, true)),
      coreMat
    );
    dish.position.set(0.06, 0.12, 0);
    dish.rotation.z = -0.65;
    dishGroup.add(mast, dish);
    bodyGroup.add(dishGroup);
    radarDish = dishGroup;
  }

  // Forward aiming gimbal eye + twin micro barrels
  gimbalGroup.position.set(0.28, -0.06, 0);
  const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 10)), coreMat);
  const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.04, 0.34, 8)), trimMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.16, -0.05, 0);
  gimbalGroup.add(eye, barrel);

  const muzzleMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: pal.core,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  const muzzleFlash = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.18, 0)), muzzleMat);
  muzzleFlash.position.set(0.38, -0.05, 0);
  gimbalGroup.add(muzzleFlash);

  // Downward Support Shield/Heal Pulse Cone (points toward player when pulsing)
  const supportBeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: pal.beam,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const supportBeam = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.12, 0.72, 2.2, 14, 1, true)),
    supportBeamMat
  );
  supportBeam.position.set(0, -1.1, 0);
  supportBeam.visible = false;
  root.add(supportBeam);

  // Scanner Drone laser target-painter beam + enemy lock reticle
  const scanBeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const scanBeam = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.025, 0.09, 1, 8, 1, true)),
    scanBeamMat
  );
  scanBeam.visible = false;
  root.add(scanBeam);

  const targetReticleMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const targetReticle = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.55, 0.72, 16)),
    targetReticleMat
  );
  targetReticle.visible = false;
  root.add(targetReticle);

  const accentLight = new THREE.PointLight(pal.core, 1.4, 5.5);
  accentLight.position.set(0, -0.1, 0.35);
  bodyGroup.add(accentLight);

  return {
    modelId,
    root,
    bodyGroup,
    gimbalGroup,
    rotorA: podL.blade,
    rotorB: podR.blade,
    radarDish,
    supportBeam,
    supportBeamMat,
    scanBeam,
    scanBeamMat,
    targetReticle,
    targetReticleMat,
    muzzleFlash,
    muzzleMat,
    coreMat,
    accentLight,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function updateSupportDrone3D(
  rig: SupportDroneRig,
  state: {
    xPx: number;
    yPx: number;
    vx: number;
    facing: 'left' | 'right';
    fireFlashTimer: number;
    supportPulseTimer: number;
    targetPx: { x: number; y: number } | null;
  },
  timeSec: number
) {
  const wx = toWorldX(state.xPx);
  const wy = toWorldY(state.yPx);

  rig.root.position.set(wx, wy, -0.35);

  // Spin twin rotors & scanner dish
  rig.rotorA.rotation.y = timeSec * 24;
  rig.rotorB.rotation.y = -timeSec * 24;
  if (rig.radarDish) {
    rig.radarDish.rotation.y = timeSec * 4.5;
  }

  // Bank smoothly with drone velocity and face target or player facing
  const faceSign = state.targetPx
    ? state.targetPx.x >= state.xPx
      ? 1
      : -1
    : state.facing === 'right'
    ? 1
    : -1;
  rig.bodyGroup.rotation.y = faceSign > 0 ? 0.14 : Math.PI - 0.14;
  rig.bodyGroup.rotation.z = Math.max(-0.35, Math.min(0.35, -state.vx * 0.025)) * faceSign;
  rig.bodyGroup.position.y = Math.sin(timeSec * 4.2) * 0.11;

  // Muzzle flash
  if (state.fireFlashTimer > 0) {
    rig.muzzleFlash.visible = true;
    rig.muzzleMat.opacity = Math.min(1, state.fireFlashTimer * 6);
    rig.muzzleFlash.scale.setScalar(0.8 + state.fireFlashTimer * 3.5);
    rig.accentLight.intensity = 3.2;
  } else {
    rig.muzzleFlash.visible = false;
    rig.muzzleMat.opacity = 0;
    rig.accentLight.intensity = 1.45 + Math.sin(timeSec * 4) * 0.3;
  }

  // Support shield/heal pulse cone
  if (state.supportPulseTimer > 0) {
    rig.supportBeam.visible = true;
    const pNorm = Math.min(1, state.supportPulseTimer / 0.65);
    rig.supportBeamMat.opacity = Math.sin(pNorm * Math.PI) * 0.42;
    rig.supportBeam.rotation.y = timeSec * 5;
  } else {
    rig.supportBeam.visible = false;
  }

  // Scanner Drone laser lock-on beam & target reticle
  if (rig.modelId === 'drone_scanner' && state.targetPx) {
    const tx = toWorldX(state.targetPx.x) - wx;
    const ty = toWorldY(state.targetPx.y) - wy;
    const tz = 0.35;
    const dist = Math.max(0.2, Math.hypot(tx, ty, tz));

    rig.scanBeam.visible = true;
    rig.scanBeam.position.set(tx * 0.5, ty * 0.5, tz * 0.5);
    rig.scanBeam.scale.set(1, dist, 1);
    const dir = new THREE.Vector3(tx, ty, tz).normalize();
    rig.scanBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rig.scanBeamMat.opacity = 0.34 + Math.sin(timeSec * 12) * 0.14;

    rig.targetReticle.visible = true;
    rig.targetReticle.position.set(tx, ty, tz + 0.15);
    rig.targetReticle.rotation.z = timeSec * 3.8;
  } else {
    rig.scanBeam.visible = false;
    rig.targetReticle.visible = false;
  }

  rig.coreMat.emissiveIntensity = 2.0 + Math.sin(timeSec * 5) * 0.45;
}
