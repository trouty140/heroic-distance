import * as THREE from 'three';
import { toWorldX, toWorldY } from './hero3d';

export interface HypercarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
  turretGroup: THREE.Group;
  turretBarrels: THREE.Mesh[];
  muzzleFlashL: THREE.Mesh;
  muzzleFlashR: THREE.Mesh;
  muzzleLight: THREE.PointLight;
  missilePods: THREE.Group;
  nitroFlames: THREE.Mesh[];
  nitroLight: THREE.PointLight;
  headlightBeam: THREE.PointLight;
  underglowMat: THREE.MeshBasicMaterial;
  contactShadow: THREE.Mesh;
  dispose: () => void;
}

export interface HypercarSyncState {
  xPx: number;
  yPx: number;
  vx: number;
  facing: 'left' | 'right';
  occupied: boolean;
  nitroActive: boolean;
  wheelSpin: number;
  pitch: number;
  firingMinigun: boolean;
  missileCooldownRatio: number;
}

export function buildHypercar3D(shadowTexture?: THREE.Texture): HypercarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
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

  // Bugatti Chiron-inspired Glossy Obsidian Black Clearcoat Paint
  const chassisPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0f17,
      metalness: 0.85,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    })
  );

  // Satin Carbon-Fiber Aero Trim
  const carbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161b24,
      metalness: 0.55,
      roughness: 0.36,
    })
  );

  // Brushed Gunmetal Alloy
  const alloyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.94,
      roughness: 0.18,
    })
  );

  // Electric Cyan Signature Accent
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.8,
      metalness: 0.2,
      roughness: 0.15,
    })
  );

  // LED Taillight Crimson Strip
  const tailGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 2.6,
      roughness: 0.18,
    })
  );

  // Tinted Aerodynamic Canopy Glass
  const canopyGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x082f49,
      metalness: 0.15,
      roughness: 0.06,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    })
  );

  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090b0f,
      metalness: 0.12,
      roughness: 0.85,
    })
  );

  const underglowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  // Contact shadow
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(6.8, 3.0));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTexture || null,
      color: 0x000000,
      transparent: true,
      opacity: shadowTexture ? 0.78 : 0.45,
      depthWrite: false,
    })
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  // Underglow Strip
  const underglow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.9, 2.0)), underglowMat);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.06;
  bodyGroup.add(underglow);

  // Sculpted Bugatti Chiron-Style Aerodynamic Side Profile (Extruded Curve + Bevel)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.65, 0.22);
  hullShape.lineTo(2.72, 0.22);
  hullShape.quadraticCurveTo(2.92, 0.44, 2.58, 0.72);
  hullShape.quadraticCurveTo(1.75, 0.94, 1.02, 1.02);
  hullShape.quadraticCurveTo(0.28, 1.54, -0.45, 1.48);
  hullShape.quadraticCurveTo(-1.32, 1.44, -2.02, 1.06);
  hullShape.lineTo(-2.55, 0.98);
  hullShape.quadraticCurveTo(-2.82, 0.68, -2.65, 0.22);

  const hullGeo = trackGeo(
    new THREE.ExtrudeGeometry(hullShape, {
      depth: 2.02,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.08,
      bevelSegments: 3,
    })
  );
  hullGeo.translate(0, 0, -1.01);
  const hullMesh = new THREE.Mesh(hullGeo, chassisPaintMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // Lower Carbon Splitter & Side Skirts
  const splitter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.65, 0.14, 2.28)), carbonMat);
  splitter.position.set(0.05, 0.22, 0);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Signature Chiron Cyan C-Pillar Sweeping Intake Arcs (Left & Right)
  for (const side of [-1, 1]) {
    const cArc = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.64, 0.055, 8, 22, Math.PI * 1.15)),
      cyanGlowMat
    );
    cArc.position.set(-0.22, 0.88, side * 1.13);
    cArc.rotation.z = -Math.PI * 0.56;
    bodyGroup.add(cArc);

    const rockerTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.06, 0.08)), cyanGlowMat);
    rockerTrim.position.set(0.05, 0.26, side * 1.15);
    bodyGroup.add(rockerTrim);
  }

  // Tinted Glass Aerodynamic Canopy Dome
  const canopy = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.95, 18, 12)), canopyGlassMat);
  canopy.scale.set(1.52, 0.56, 0.92);
  canopy.position.set(-0.15, 1.24, 0);
  bodyGroup.add(canopy);

  // Horseshoe Front Grille + Glowing Cyan Rim
  const grilleHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.42, 0.78)), carbonMat);
  grilleHousing.position.set(2.74, 0.46, 0);
  bodyGroup.add(grilleHousing);

  const horseshoeRim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.24, 0.032, 8, 18, Math.PI * 1.35)),
    cyanGlowMat
  );
  horseshoeRim.rotation.y = Math.PI / 2;
  horseshoeRim.rotation.z = -Math.PI * 0.18;
  horseshoeRim.position.set(2.86, 0.46, 0);
  bodyGroup.add(horseshoeRim);

  // Quad-Bar Glowing LED Headlights
  for (const side of [-1, 1]) {
    for (let bar = 0; bar < 2; bar++) {
      const led = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.045, 0.34)), cyanGlowMat);
      led.position.set(2.72, 0.58 + bar * 0.08, side * 0.72);
      led.rotation.y = side * -0.18;
      bodyGroup.add(led);
    }
  }

  const headlightBeam = new THREE.PointLight(0x67e8f9, 3.2, 16);
  headlightBeam.position.set(3.4, 0.7, 0);
  bodyGroup.add(headlightBeam);

  // Sweeping Full-Width LED Taillight Bar + Rear Diffuser
  const tailBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.09, 1.92)), tailGlowMat);
  tailBar.position.set(-2.72, 0.82, 0);
  bodyGroup.add(tailBar);

  const diffuser = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.24, 1.86)), carbonMat);
  diffuser.position.set(-2.68, 0.3, 0);
  bodyGroup.add(diffuser);

  // Active Aero Rear Spoiler Wing + Struts
  const wingDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.09, 2.26)), carbonMat);
  wingDeck.position.set(-2.35, 1.46, 0);
  wingDeck.rotation.z = -0.14;
  wingDeck.castShadow = true;
  const wingEdge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.64, 0.04, 2.28)), cyanGlowMat);
  wingEdge.position.set(-2.35, 1.46, 0);
  wingEdge.rotation.z = -0.14;
  bodyGroup.add(wingDeck, wingEdge);

  for (const side of [-0.62, 0.62]) {
    const strut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.48, 0.08)), alloyMat);
    strut.position.set(-2.28, 1.22, side);
    strut.rotation.z = 0.22;
    bodyGroup.add(strut);
  }

  // Four Multi-Spoke Alloy Wheels with Glowing Cyan Brake Calipers
  const wheels: THREE.Group[] = [];
  const wheelCoords: [number, number, number][] = [
    [1.68, 0.44, 1.08],
    [1.68, 0.44, -1.08],
    [-1.68, 0.44, 1.08],
    [-1.68, 0.44, -1.08],
  ];

  for (const [wx, wy, wz] of wheelCoords) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    const tire = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 0.34, 18)), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rimRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.28, 0.045, 8, 16)), alloyMat);
    rimRing.position.z = wz > 0 ? 0.14 : -0.14;
    wheelGroup.add(rimRing);

    const brakeGlow = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.2, 0.024, 6, 14)), cyanGlowMat);
    brakeGlow.position.z = wz > 0 ? 0.11 : -0.11;
    wheelGroup.add(brakeGlow);

    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.045, 0.05)), alloyMat);
      spoke.position.z = wz > 0 ? 0.15 : -0.15;
      spoke.rotation.z = (s / 5) * Math.PI;
      wheelGroup.add(spoke);
    }

    bodyGroup.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  // Twin Roof-Mounted Plasma Minigun Turrets
  const turretGroup = new THREE.Group();
  turretGroup.position.set(-0.2, 1.58, 0);
  const turretBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.52, 0.18, 10)), carbonMat);
  turretGroup.add(turretBase);

  const turretBarrels: THREE.Mesh[] = [];
  const flashMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, depthWrite: false })
  );
  const flashGeo = trackGeo(new THREE.OctahedronGeometry(0.22, 0));

  for (const side of [-0.32, 0.32]) {
    const pod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.2, 0.22)), carbonMat);
    pod.position.set(0.05, 0.16, side);
    turretGroup.add(pod);

    const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 1.05, 8)), alloyMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.68, 0.16, side);
    turretGroup.add(barrel);
    turretBarrels.push(barrel);

    const muzzleRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.08, 0.018, 6, 12)), cyanGlowMat);
    muzzleRing.rotation.y = Math.PI / 2;
    muzzleRing.position.set(1.16, 0.16, side);
    turretGroup.add(muzzleRing);
  }

  const muzzleFlashL = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlashL.position.set(1.32, 0.16, -0.32);
  const muzzleFlashR = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlashR.position.set(1.32, 0.16, 0.32);
  turretGroup.add(muzzleFlashL, muzzleFlashR);

  const muzzleLight = new THREE.PointLight(0x22d3ee, 0, 10);
  muzzleLight.position.set(1.45, 0.25, 0);
  turretGroup.add(muzzleLight);
  bodyGroup.add(turretGroup);

  // Hood-Mounted Twin Missile Launcher Pods
  const missilePods = new THREE.Group();
  missilePods.position.set(1.25, 0.98, 0);
  const warheadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf97316,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    })
  );
  for (const side of [-0.52, 0.52]) {
    const rack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.2, 0.26)), carbonMat);
    rack.position.set(0, 0, side);
    rack.rotation.z = 0.12;
    const tip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.075, 0.22, 8)), warheadMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(0.36, 0.04, side);
    missilePods.add(rack, tip);
  }
  bodyGroup.add(missilePods);

  // Twin Rear Nitro Boost Exhaust Flames
  const flameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  const nitroFlames: THREE.Mesh[] = [];
  for (const side of [-0.34, 0.34]) {
    const flame = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 1.55, 10)), flameMat);
    flame.rotation.z = Math.PI / 2;
    flame.position.set(-3.45, 0.44, side);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  }
  const nitroLight = new THREE.PointLight(0x38bdf8, 0, 12);
  nitroLight.position.set(-3.4, 0.55, 0);
  bodyGroup.add(nitroLight);

  return {
    root,
    bodyGroup,
    wheels,
    turretGroup,
    turretBarrels,
    muzzleFlashL,
    muzzleFlashR,
    muzzleLight,
    missilePods,
    nitroFlames,
    nitroLight,
    headlightBeam,
    underglowMat,
    contactShadow,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function updateHypercar3D(
  rig: HypercarRig,
  state: HypercarSyncState,
  timeSec: number
) {
  const wx = toWorldX(state.xPx);
  const wy = toWorldY(state.yPx + 22);

  rig.root.position.set(wx, wy, 0);
  rig.bodyGroup.rotation.y = state.facing === 'right' ? 0 : Math.PI;
  rig.bodyGroup.rotation.z = state.pitch;

  // Suspension micro-bounce when driving fast
  const speedRatio = Math.min(1, Math.abs(state.vx) / 18);
  rig.bodyGroup.position.y = state.occupied
    ? Math.sin(timeSec * 22) * 0.025 * speedRatio
    : Math.sin(timeSec * 2.2) * 0.015;

  // Spin alloy wheels proportionally
  for (const w of rig.wheels) {
    w.rotation.z = -state.wheelSpin;
  }

  // Underglow & headlights intensify when occupied
  rig.underglowMat.opacity = state.occupied ? 0.72 + Math.sin(timeSec * 6) * 0.14 : 0.36;
  rig.headlightBeam.intensity = state.occupied ? 4.4 : 2.2;

  // Roof Minigun spin & muzzle flash
  if (state.firingMinigun) {
    rig.turretBarrels.forEach((b) => {
      b.rotation.x += 0.65;
    });
    const f = 0.7 + Math.random() * 0.7;
    rig.muzzleFlashL.scale.setScalar(f);
    rig.muzzleFlashR.scale.setScalar(f);
    (rig.muzzleFlashL.material as THREE.MeshBasicMaterial).opacity = 0.92;
    rig.muzzleLight.intensity = 6.5;
  } else {
    (rig.muzzleFlashL.material as THREE.MeshBasicMaterial).opacity = 0;
    rig.muzzleLight.intensity = 0;
  }

  // Hood missile pods slight elevation when ready
  rig.missilePods.position.y = state.missileCooldownRatio <= 0.02 ? 1.02 : 0.92;

  // Blue Nitro Exhaust Flames
  for (const flame of rig.nitroFlames) {
    flame.visible = state.nitroActive;
    if (state.nitroActive) {
      const stretch = 1.0 + Math.sin(timeSec * 48) * 0.35;
      flame.scale.set(1, stretch, 1);
    }
  }
  rig.nitroLight.intensity = state.nitroActive ? 8.5 : 0;

  const groundDist = Math.max(0, wy);
  rig.contactShadow.position.y = -wy + 0.03;
  rig.contactShadow.visible = groundDist < 7;
}
