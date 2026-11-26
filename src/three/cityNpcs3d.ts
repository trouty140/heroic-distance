import * as THREE from 'three';
import type { CityNpc } from '../types';
import { toWorldX, toWorldY } from './hero3d';

export interface CityNpcMeshEntry {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  propGroup: THREE.Group;
  beaconRing: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function buildCityNpc3D(
  npc: CityNpc,
  shadowTexture?: THREE.Texture
): CityNpcMeshEntry {
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

  const accentHex = new THREE.Color(npc.accentColor || '#22d3ee').getHex();
  const isRacer = npc.role === 'racer';
  const isMechanic = npc.role === 'mechanic';

  // Archetype-specific modern techwear color & PBR finish palette
  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRacer ? 0xf8fafc : isMechanic ? 0x365314 : 0x0f172a,
      metalness: isRacer ? 0.25 : 0.45,
      roughness: isRacer ? 0.38 : 0.48,
    })
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRacer ? 0x18181b : isMechanic ? 0x27272a : 0x1e293b,
      metalness: 0.22,
      roughness: 0.68,
    })
  );
  const bootMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090d14,
      metalness: 0.65,
      roughness: 0.28,
    })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isMechanic ? 0xd9a78b : isRacer ? 0xf3cbb4 : 0xe5b89d,
      metalness: 0.04,
      roughness: 0.56,
    })
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRacer ? 0x06b6d4 : isMechanic ? 0x451a03 : 0x1e1b4b,
      metalness: 0.2,
      roughness: 0.42,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 2.0,
      metalness: 0.3,
      roughness: 0.2,
    })
  );

  // Ground Contact Shadow
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTexture || null,
      color: 0x000000,
      transparent: true,
      opacity: shadowTexture ? 0.6 : 0.32,
      depthWrite: false,
    })
  );
  const shadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.5, 1.0)), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  // Subtle Ground Interaction Beacon Ring
  const beaconMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const beaconRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(0.85, 1.04, 24)), beaconMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.05;
  root.add(beaconRing);

  // Articulated Feminine Silhouette: Sculpted Boots & Tapered Legs
  for (const zOff of [-0.14, 0.14]) {
    const leg = new THREE.Group();
    leg.position.set(0, 1.32, zOff);

    const thigh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.1, 0.62, 10)), pantsMat);
    thigh.position.y = -0.32;
    thigh.castShadow = true;
    leg.add(thigh);

    const calf = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.085, 0.54, 10)), bootMat);
    calf.position.y = -0.88;
    calf.castShadow = true;
    leg.add(calf);

    const boot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.18, 0.19)), bootMat);
    boot.position.set(0.06, -1.2, 0);
    leg.add(boot);

    const bootTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.33, 0.04, 0.2)), accentMat);
    bootTrim.position.set(0.06, -1.27, 0);
    leg.add(bootTrim);

    bodyGroup.add(leg);
  }

  // Hips & Tech Utility Belt
  const hips = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.29, 0.32, 12)), pantsMat);
  hips.position.y = 1.44;
  hips.scale.set(0.82, 1, 1.16);
  hips.castShadow = true;
  bodyGroup.add(hips);

  const belt = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.26, 0.035, 6, 16)), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.56;
  belt.scale.set(0.84, 1.15, 1);
  bodyGroup.add(belt);

  // Fitted Cropped Jacket / Bodysuit Torso
  const waist = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.2, 0.42, 12)), skinMat);
  waist.position.y = 1.75;
  waist.scale.set(0.8, 1, 1.1);
  bodyGroup.add(waist);

  const jacket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.56, 0.52)), jacketMat);
  jacket.position.y = 2.04;
  jacket.castShadow = true;
  bodyGroup.add(jacket);

  const collarGlow = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.22, 0.032, 6, 14)), accentMat);
  collarGlow.rotation.x = Math.PI / 2;
  collarGlow.position.y = 2.34;
  bodyGroup.add(collarGlow);

  // Head + Stylized Hair + Visor / Goggles
  const headGroup = new THREE.Group();
  headGroup.position.set(0.02, 2.62, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 0.2, 8)), skinMat);
  neck.position.y = -0.2;
  headGroup.add(neck);

  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.23, 14, 14)), skinMat);
  head.scale.set(0.95, 1.06, 0.92);
  head.castShadow = true;
  headGroup.add(head);

  const hairCrown = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.25, 14, 12)), hairMat);
  hairCrown.position.set(-0.03, 0.05, 0);
  headGroup.add(hairCrown);

  if (isRacer) {
    // Sleek High-Tech Cyber Ponytail + Neon Racing Shades
    const ponytail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.58, 8)), hairMat);
    ponytail.position.set(-0.28, -0.06, 0);
    ponytail.rotation.z = 0.72;
    headGroup.add(ponytail);

    const visor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.085, 0.42)), accentMat);
    visor.position.set(0.21, 0.04, 0);
    headGroup.add(visor);
  } else if (isMechanic) {
    // Twin Braids + Pushed-Up Welding Goggles on Forehead
    for (const side of [-0.18, 0.18]) {
      const braid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.04, 0.46, 8)), hairMat);
      braid.position.set(-0.14, -0.14, side);
      braid.rotation.z = 0.22;
      headGroup.add(braid);

      const goggleLens = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10)), accentMat);
      goggleLens.rotation.z = Math.PI / 2;
      goggleLens.position.set(0.16, 0.16, side * 0.48);
      headGroup.add(goggleLens);
    }
  } else {
    // Tactical Operator: Sleek Asymmetric Bob + Holographic Ear-Comms Monocle
    const bobBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.36, 0.48)), hairMat);
    bobBack.position.set(-0.16, -0.04, 0);
    headGroup.add(bobBack);

    const monocle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.075, 0.2)), accentMat);
    monocle.position.set(0.21, 0.04, 0.11);
    headGroup.add(monocle);
  }

  // Arms + Role Props (Holo-Tablet / Plasma Wrench / Cyber-Wristband)
  const leftArm = new THREE.Group();
  leftArm.position.set(0, 2.22, -0.32);
  const lUpper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 8)), jacketMat);
  lUpper.position.y = -0.22;
  const lFore = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.072, 0.06, 0.4, 8)), skinMat);
  lFore.position.set(0.08, -0.5, 0);
  lFore.rotation.z = 0.35;
  leftArm.add(lUpper, lFore);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0, 2.22, 0.32);
  const rUpper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 8)), jacketMat);
  rUpper.position.y = -0.22;
  const rFore = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.072, 0.06, 0.4, 8)), skinMat);
  rFore.position.set(0.12, -0.48, 0);
  rFore.rotation.z = 0.55;
  rightArm.add(rUpper, rFore);

  const propGroup = new THREE.Group();
  propGroup.position.set(0.24, -0.58, 0);
  if (isMechanic) {
    // Plasma Hydro-Wrench
    const handle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.07, 0.07)), bootMat);
    const jaw = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.11, 0.03, 6, 12, Math.PI * 1.4)), accentMat);
    jaw.position.x = 0.24;
    propGroup.add(handle, jaw);
  } else if (npc.role === 'operator') {
    // Glowing Holographic Mission Datapad
    const pad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.04, 0.36)), accentMat);
    pad.rotation.z = -0.4;
    propGroup.add(pad);
  } else {
    // Street Racer Holo-Wrist Chrono
    const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.09, 0.025, 6, 12)), accentMat);
    band.rotation.y = Math.PI / 2;
    propGroup.add(band);
  }
  rightArm.add(propGroup);
  bodyGroup.add(rightArm);

  root.position.set(toWorldX(npc.x), toWorldY(npc.y), 0.85);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    propGroup,
    beaconRing,
    beaconMat,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function updateCityNpc3D(
  entry: CityNpcMeshEntry,
  npc: CityNpc,
  playerXPx: number,
  timeSec: number
) {
  const faceRight = playerXPx >= npc.x;
  entry.bodyGroup.rotation.y = faceRight ? 0 : Math.PI;
  entry.bodyGroup.position.y = Math.sin(timeSec * 2.6 + npc.x * 0.02) * 0.04;
  entry.headGroup.rotation.y = Math.sin(timeSec * 1.5 + npc.x * 0.01) * 0.14;
  entry.rightArm.rotation.z = 0.15 + Math.sin(timeSec * 2.4 + npc.x * 0.01) * 0.12;
  entry.leftArm.rotation.z = -0.1 - Math.sin(timeSec * 2.0) * 0.08;

  const dist = Math.abs(playerXPx - npc.x);
  const near = dist < 135;
  entry.beaconMat.opacity = near ? 0.88 : 0.34 + Math.sin(timeSec * 3.5) * 0.12;
  entry.beaconRing.scale.setScalar(near ? 1.18 + Math.sin(timeSec * 6) * 0.08 : 1.0);
}
