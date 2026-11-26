import * as THREE from 'three';
import type { GadgetId, OperatorId, PlayerState, WeaponId } from '../types';

export const WORLD_SCALE = 1 / 28;
export const GROUND_Y_PX = 500;

export function toWorldX(px: number): number {
  return px * WORLD_SCALE;
}

export function toWorldY(px: number): number {
  return (GROUND_Y_PX - px) * WORLD_SCALE;
}

export interface HeroAppearance {
  operatorId: OperatorId;
  weaponId: WeaponId;
  gadgetIds?: (GadgetId | null)[];
  hasDrone: boolean;
}

export interface BuiltWeapon3D {
  group: THREE.Group;
  muzzleFlash: THREE.Mesh;
  muzzleLight: THREE.PointLight;
  accentHex: number;
  isBlade: boolean;
  dispose: () => void;
}

export interface HeroRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponGroup: THREE.Group;
  slashArcGroup: THREE.Group;
  slashArcMat: THREE.MeshBasicMaterial;
  muzzleFlash: THREE.Mesh;
  muzzleLight: THREE.PointLight;
  capeGeo: THREE.PlaneGeometry;
  capeBasePositions: Float32Array;
  capeMesh: THREE.Mesh;
  visorMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
  armorMat: THREE.MeshStandardMaterial;
  capeMat: THREE.MeshStandardMaterial;
  droneGroup: THREE.Group;
  wingsGroup: THREE.Group;
  haloMesh: THREE.Mesh;
  aegisDome: THREE.Group;
  aegisShellMat: THREE.MeshStandardMaterial;
  aegisWireMat: THREE.MeshBasicMaterial;
  parryShieldMesh: THREE.Mesh;
  contactShadow: THREE.Mesh;
  appearance: HeroAppearance;
  dispose: () => void;
}

function getOperatorPalette(operatorId: OperatorId): {
  armor: number;
  accent: number;
  cape: number;
  trim: number;
} {
  if (operatorId === 'op_phantom_crimson') {
    return { armor: 0x0f172a, accent: 0xef4444, cape: 0x450a0a, trim: 0x94a3b8 };
  }
  if (operatorId === 'op_aegis_gold') {
    return { armor: 0x1c241b, accent: 0xfacc15, cape: 0x422006, trim: 0xf59e0b };
  }
  if (operatorId === 'op_void_valkyrie') {
    return { armor: 0x1e1033, accent: 0xc084fc, cape: 0x3b0764, trim: 0x22d3ee };
  }
  return { armor: 0x111827, accent: 0x22d3ee, cape: 0x083344, trim: 0xd97706 };
}

export function getWeaponPalette(weaponId: WeaponId): {
  core: number;
  body: number;
  barrel: number;
  isBlade: boolean;
} {
  if (weaponId === 'wpn_crimson_railcarbine') {
    return { core: 0xef4444, body: 0x1e293b, barrel: 0x94a3b8, isBlade: false };
  }
  if (weaponId === 'wpn_olive_arc_rifle') {
    return { core: 0x38bdf8, body: 0x2f3b28, barrel: 0xfacc15, isBlade: false };
  }
  if (weaponId === 'wpn_mythic_katana') {
    return { core: 0xf43f5e, body: 0x18181b, barrel: 0xe2e8f0, isBlade: true };
  }
  if (weaponId === 'wpn_mythic_railblade') {
    return { core: 0xfacc15, body: 0x241b0c, barrel: 0xfef08a, isBlade: true };
  }
  return { core: 0x06b6d4, body: 0x18181b, barrel: 0xfbbf24, isBlade: false };
}

export function buildWeapon3D(weaponId: WeaponId): BuiltWeapon3D {
  const pal = getWeaponPalette(weaponId);
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

  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: pal.body, metalness: 0.84, roughness: 0.24 })
  );
  const metalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: pal.barrel, metalness: 0.94, roughness: 0.16 })
  );
  const gripMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x452719, metalness: 0.15, roughness: 0.78 })
  );
  const coreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: pal.core,
      emissive: pal.core,
      emissiveIntensity: 2.8,
      metalness: 0.2,
      roughness: 0.15,
    })
  );
  const holoGlassMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: pal.core,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  );

  if (weaponId === 'wpn_mythic_katana') {
    // Detailed multi-part Mythic Plasma Katana
    const grip = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.06, 0.56, 10)), gripMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = -0.22;
    group.add(grip);

    // Pommel ring
    const pommel = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.07, 0.02, 8, 12)), metalMat);
    pommel.position.x = -0.52;
    group.add(pommel);

    // Sculpted vented tsuba handguard
    const tsuba = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8)), metalMat);
    tsuba.rotation.z = Math.PI / 2;
    tsuba.position.x = 0.08;
    group.add(tsuba);

    const guardCore = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.15, 0.02, 8, 16)), coreMat);
    guardCore.rotation.y = Math.PI / 2;
    guardCore.position.x = 0.08;
    group.add(guardCore);

    // Titanium blade spine + superheated plasma edge
    const spine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.11, 0.045)), bodyMat);
    spine.position.set(0.86, 0.03, 0);
    group.add(spine);

    const plasmaEdge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.58, 0.055, 0.025)), coreMat);
    plasmaEdge.position.set(0.88, -0.04, 0);
    group.add(plasmaEdge);

    // Tanto tip
    const tip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.085, 0.32, 4)), coreMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(1.78, 0, 0);
    group.add(tip);

    // Cryo-vents along spine
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.05, 0.07)), metalMat);
      vent.position.set(0.32 + i * 0.24, 0.08, 0);
      group.add(vent);
    }
  } else if (weaponId === 'wpn_mythic_railblade') {
    // Hybrid Mythic Gunblade: Greatsword + Dual Rail Accelerators + Core Rings
    const grip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.11, 0.12)), gripMat);
    grip.position.x = -0.22;
    group.add(grip);

    const receiver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.26, 0.18)), bodyMat);
    receiver.position.set(0.24, 0.02, 0);
    group.add(receiver);

    // Holographic reticle sight
    const sightFrame = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.08, 0.015, 6, 12)), metalMat);
    sightFrame.rotation.y = Math.PI / 2;
    sightFrame.position.set(0.22, 0.24, 0);
    const sightGlass = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.065, 12)), holoGlassMat);
    sightGlass.rotation.y = Math.PI / 2;
    sightGlass.position.set(0.22, 0.24, 0);
    group.add(sightFrame, sightGlass);

    // Twin accelerator rails flanking plasma greatsword blade
    for (const zOff of [-0.075, 0.075]) {
      const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 0.065, 0.04)), metalMat);
      rail.position.set(1.15, 0.06, zOff);
      group.add(rail);
    }

    const bladeCore = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.14, 0.04)), coreMat);
    bladeCore.position.set(1.22, -0.02, 0);
    group.add(bladeCore);

    const bladeTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.36, 4)), coreMat);
    bladeTip.rotation.z = -Math.PI / 2;
    bladeTip.position.set(2.12, 0.01, 0);
    group.add(bladeTip);

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.022, 8, 16)), coreMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0.68 + i * 0.45, 0.02, 0);
      group.add(ring);
    }
  } else {
    // Detailed Assault Rifle / Railcarbine / Arc Pulse Cannon
    const receiver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.24, 0.17)), bodyMat);
    group.add(receiver);

    const upperRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.055, 0.12)), metalMat);
    upperRail.position.set(0.06, 0.14, 0);
    group.add(upperRail);

    const stock = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.2, 0.13)), gripMat);
    stock.position.set(-0.52, -0.03, 0);
    group.add(stock);

    const magazine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, 0.32, 0.1)), bodyMat);
    magazine.position.set(0.16, -0.24, 0);
    magazine.rotation.z = 0.24;
    group.add(magazine);

    const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.065, 0.78, 12)), metalMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.76, 0.04, 0);
    group.add(barrel);

    const muzzleBrake = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.12, 0.12)), metalMat);
    muzzleBrake.position.set(1.14, 0.04, 0);
    group.add(muzzleBrake);

    const energyCell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.09, 0.19)), coreMat);
    energyCell.position.set(0.18, 0.05, 0);
    group.add(energyCell);

    // 3D Holographic Sight + Reticle Glass
    const holoHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.12, 0.12)), bodyMat);
    holoHousing.position.set(0.08, 0.22, 0);
    const holoLens = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.09, 0.09)), holoGlassMat);
    holoLens.rotation.y = Math.PI / 2;
    holoLens.position.set(0.16, 0.24, 0);
    group.add(holoHousing, holoLens);

    if (weaponId === 'wpn_crimson_railcarbine') {
      const bayonet = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.48, 4)), coreMat);
      bayonet.rotation.z = -Math.PI / 2;
      bayonet.position.set(1.02, -0.08, 0);
      group.add(bayonet);
    } else if (weaponId === 'wpn_olive_arc_rifle') {
      for (const offset of [0.52, 0.78]) {
        const coil = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.11, 0.024, 8, 14)), coreMat);
        coil.rotation.y = Math.PI / 2;
        coil.position.set(offset, 0.04, 0);
        group.add(coil);
      }
    }
  }

  const muzzleMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: pal.core,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  const muzzleFlash = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.28, 0)), muzzleMat);
  muzzleFlash.position.set(pal.isBlade ? 1.85 : 1.24, 0.04, 0);
  group.add(muzzleFlash);

  const muzzleLight = new THREE.PointLight(pal.core, 0, 7);
  muzzleLight.position.set(1.3, 0.06, 0);
  group.add(muzzleLight);

  return {
    group,
    muzzleFlash,
    muzzleLight,
    accentHex: pal.core,
    isBlade: pal.isBlade,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export function buildHeroRig(
  appearance: HeroAppearance,
  shadowTexture?: THREE.Texture
): HeroRig {
  const palette = getOperatorPalette(appearance.operatorId);
  const gadgets = appearance.gadgetIds || [];
  const hasReactiveArmor = gadgets.includes('gdg_reactive_armor');
  const hasMythicWings =
    gadgets.includes('gdg_mythic_wings') || appearance.operatorId === 'op_void_valkyrie';

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const armorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.armor,
      metalness: 0.76,
      roughness: 0.3,
    })
  );
  const darkUnderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090d14,
      metalness: 0.35,
      roughness: 0.65,
    })
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      metalness: 0.15,
      roughness: 0.78,
    })
  );
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.trim,
      metalness: 0.88,
      roughness: 0.22,
    })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9a78b,
      metalness: 0.05,
      roughness: 0.62,
    })
  );
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 2.4,
      metalness: 0.2,
      roughness: 0.15,
    })
  );
  const coreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 2.0,
      metalness: 0.4,
      roughness: 0.2,
    })
  );

  // Contact shadow decal
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(1.75, 1.1));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTexture || null,
      color: 0x000000,
      transparent: true,
      opacity: shadowTexture ? 0.65 : 0.35,
      depthWrite: false,
    })
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  // Pelvis & Belt
  const pelvis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.3, 0.44)), darkUnderMat);
  pelvis.position.y = 1.35;
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const belt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.74, 0.12, 0.48)), leatherMat);
  belt.position.y = 1.48;
  bodyGroup.add(belt);

  const buckle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.12, 0.5)), trimMat);
  buckle.position.set(0.18, 1.48, 0);
  bodyGroup.add(buckle);

  const buildLeg = (zOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(0, 1.32, zOffset);

    const thigh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.58, 0.28)), armorMat);
    thigh.position.y = -0.3;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const kneePad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.16, 0.31)), trimMat);
    kneePad.position.set(0.03, -0.58, 0);
    legGroup.add(kneePad);

    const shin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.56, 0.26)), darkUnderMat);
    shin.position.y = -0.88;
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.22, 0.3)), armorMat);
    boot.position.set(0.08, -1.2, 0);
    boot.castShadow = true;
    legGroup.add(boot);

    const soleGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.05, 0.31)), coreMat);
    soleGlow.position.set(0.08, -1.29, 0);
    legGroup.add(soleGlow);

    return legGroup;
  };

  const leftLeg = buildLeg(-0.18);
  const rightLeg = buildLeg(0.18);
  bodyGroup.add(leftLeg, rightLeg);

  // Torso Armor + Optional Reactive Armor Plate Rig
  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 0.84, 0.52)), armorMat);
  torso.position.y = 1.94;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  if (hasReactiveArmor) {
    const rigPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.48, 0.6)), trimMat);
    rigPlate.position.set(0.03, 2.02, 0);
    bodyGroup.add(rigPlate);
  }

  const chestCore = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.15, 0)), coreMat);
  chestCore.position.set(0.38, 2.02, 0);
  chestCore.scale.set(0.5, 1.1, 1.0);
  bodyGroup.add(chestCore);

  const strap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.11, 0.58)), leatherMat);
  strap.position.set(0, 1.96, 0);
  strap.rotation.x = 0.55;
  bodyGroup.add(strap);

  const rightPauldron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.32, 0.38)), armorMat);
  rightPauldron.position.set(0.02, 2.34, 0.36);
  rightPauldron.rotation.x = -0.25;
  rightPauldron.castShadow = true;
  bodyGroup.add(rightPauldron);

  const pauldronTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.07, 0.4)), trimMat);
  pauldronTrim.position.set(0.02, 2.46, 0.36);
  pauldronTrim.rotation.x = -0.25;
  bodyGroup.add(pauldronTrim);

  // Head + Scar + Glowing Visor + Mythic Halo
  const headGroup = new THREE.Group();
  headGroup.position.set(0.04, 2.66, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.22, 8)), darkUnderMat);
  neck.position.y = -0.22;
  headGroup.add(neck);

  const headMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.46, 0.44)), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const hairTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.2, 0.49)), darkUnderMat);
  hairTop.position.set(-0.02, 0.2, 0);
  headGroup.add(hairTop);

  const hairBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.36, 0.48)), darkUnderMat);
  hairBack.position.set(-0.2, 0.04, 0);
  headGroup.add(hairBack);

  const visorFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.16, 0.47)), armorMat);
  visorFrame.position.set(0.21, 0.06, 0);
  headGroup.add(visorFrame);

  const visorLens = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.09, 0.42)), visorMat);
  visorLens.position.set(0.23, 0.06, 0.03);
  headGroup.add(visorLens);

  const scarMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x7f1d1d }));
  const scar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.16, 0.04)), scarMat);
  scar.position.set(0.22, -0.06, -0.11);
  scar.rotation.x = 0.4;
  headGroup.add(scar);

  const haloMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.03, 8, 24)), visorMat);
  haloMesh.rotation.x = Math.PI / 2 - 0.18;
  haloMesh.position.set(-0.06, 0.45, 0);
  haloMesh.visible = appearance.operatorId === 'op_void_valkyrie';
  headGroup.add(haloMesh);

  // Flowing One-Shoulder Cape
  const capeGeo = trackGeo(new THREE.PlaneGeometry(1.55, 1.9, 6, 8));
  const capeBasePositions = new Float32Array(capeGeo.attributes.position.array as Float32Array);
  const capeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.cape,
      roughness: 0.82,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
  );
  const capeMesh = new THREE.Mesh(capeGeo, capeMat);
  capeMesh.position.set(-0.28, 2.28, -0.18);
  capeMesh.rotation.y = Math.PI * 0.05;
  capeMesh.castShadow = true;
  bodyGroup.add(capeMesh);

  // Articulated Twin Chrono-Thruster Wings (Mythic Gadget or Valkyrie skin)
  const wingsGroup = new THREE.Group();
  wingsGroup.position.set(-0.36, 2.15, 0);
  wingsGroup.visible = hasMythicWings;
  for (const s of [-1, 1]) {
    const wingBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.25, 0.36)), coreMat);
    wingBlade.position.set(-0.24, 0.25, s * 0.56);
    wingBlade.rotation.x = s * 0.55;
    wingBlade.rotation.z = 0.32;
    const wingStrut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.14, 0.5)), trimMat);
    wingStrut.position.set(-0.05, 0.05, s * 0.3);
    wingsGroup.add(wingBlade, wingStrut);
  }
  bodyGroup.add(wingsGroup);

  // Left Cybernetic Prosthetic Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(0, 2.25, -0.34);
  const cyberShoulder = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 10, 10)), trimMat);
  const cyberUpper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.1, 0.44, 10)), trimMat);
  cyberUpper.position.y = -0.24;
  const cyberForearm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.44, 0.2)), darkUnderMat);
  cyberForearm.position.set(0.12, -0.58, 0);
  cyberForearm.rotation.z = 0.35;
  const cyberRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.12, 0.028, 8, 14)), coreMat);
  cyberRing.position.set(0.16, -0.62, 0);
  cyberRing.rotation.x = Math.PI / 2;
  leftArm.add(cyberShoulder, cyberUpper, cyberForearm, cyberRing);
  bodyGroup.add(leftArm);

  // Right Arm + Intricate Multi-Part 3D Weapon
  const rightArm = new THREE.Group();
  rightArm.position.set(0.04, 2.22, 0.35);

  const upperArmR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.42, 0.22)), armorMat);
  upperArmR.position.y = -0.2;
  const forearmR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.2, 0.2)), armorMat);
  forearmR.position.set(0.22, -0.38, -0.06);
  rightArm.add(upperArmR, forearmR);

  const builtWeapon = buildWeapon3D(appearance.weaponId);
  const weaponGroup = builtWeapon.group;
  weaponGroup.position.set(0.46, -0.36, -0.14);
  rightArm.add(weaponGroup);
  bodyGroup.add(rightArm);

  // Dynamic 3D Sword/Weapon Slash Crescent Trail
  const slashArcGroup = new THREE.Group();
  slashArcGroup.position.set(0.6, 1.95, 0);
  slashArcGroup.visible = false;
  const slashArcMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: builtWeapon.accentHex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const slashArcMesh = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.15, 2.35, 24, 1, -Math.PI * 0.48, Math.PI * 0.96)),
    slashArcMat
  );
  slashArcMesh.rotation.y = Math.PI * 0.14;
  slashArcGroup.add(slashArcMesh);
  bodyGroup.add(slashArcGroup);

  // Hovering Autonomous Combat Drone
  const droneGroup = new THREE.Group();
  droneGroup.position.set(-0.95, 3.35, -0.45);
  droneGroup.visible = appearance.hasDrone;

  const droneHull = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.32, 0)), armorMat);
  droneHull.scale.set(1.3, 0.72, 1.0);
  const droneRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.03, 8, 16)), coreMat);
  droneRing.rotation.x = Math.PI / 2;
  const droneEye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 10)), visorMat);
  droneEye.position.set(0.28, 0, 0);
  droneGroup.add(droneHull, droneRing, droneEye);
  root.add(droneGroup);

  // Aegis Overload Hexagonal 3D Energy Dome
  const aegisDome = new THREE.Group();
  aegisDome.position.set(0, 1.75, 0);
  aegisDome.visible = false;

  const aegisShellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const aegisShell = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(2.15, 1)), aegisShellMat);
  const aegisWireMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    })
  );
  const aegisWire = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(2.17, 1)), aegisWireMat);
  aegisDome.add(aegisShell, aegisWire);
  root.add(aegisDome);

  const parryShieldMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const parryShieldMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(1.5, 14, 14, -Math.PI * 0.35, Math.PI * 0.7, 0.35, 2.2)),
    parryShieldMat
  );
  parryShieldMesh.position.set(0.25, 1.85, 0);
  parryShieldMesh.visible = false;
  root.add(parryShieldMesh);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponGroup,
    slashArcGroup,
    slashArcMat,
    muzzleFlash: builtWeapon.muzzleFlash,
    muzzleLight: builtWeapon.muzzleLight,
    capeGeo,
    capeBasePositions,
    capeMesh,
    visorMat,
    coreMat,
    armorMat,
    capeMat,
    droneGroup,
    wingsGroup,
    haloMesh,
    aegisDome,
    aegisShellMat,
    aegisWireMat,
    parryShieldMesh,
    contactShadow,
    appearance,
    dispose: () => {
      builtWeapon.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function updateHeroRig(
  rig: HeroRig,
  state: {
    xPx: number;
    yPx: number;
    vx: number;
    vy: number;
    facing: 'left' | 'right';
    grounded: boolean;
    actionState: PlayerState['actionState'];
    stateTimer: number;
    attackKind?: 'SLASH' | 'SHOOT';
    aegisActiveTimer?: number;
    hasDrone?: boolean;
  },
  timeSec: number
) {
  const wx = toWorldX(state.xPx);
  const wy = toWorldY(state.yPx + 24);

  rig.root.position.set(wx, wy, 0);
  rig.bodyGroup.rotation.y = state.facing === 'right' ? 0 : Math.PI;

  const speedNorm = Math.min(1, Math.abs(state.vx) / 7);
  const runCycle = timeSec * 14;

  if (!state.grounded) {
    rig.leftLeg.rotation.z = 0.45;
    rig.rightLeg.rotation.z = -0.38;
    rig.bodyGroup.position.y = 0.08;
    rig.bodyGroup.rotation.z = state.facing === 'right' ? -0.1 : 0.1;
  } else if (speedNorm > 0.15) {
    const legSwing = Math.sin(runCycle) * 0.75 * speedNorm;
    rig.leftLeg.rotation.z = legSwing;
    rig.rightLeg.rotation.z = -legSwing;
    rig.bodyGroup.position.y = Math.abs(Math.cos(runCycle)) * 0.1;
    rig.bodyGroup.rotation.z = (state.facing === 'right' ? -0.14 : 0.14) * speedNorm;
  } else {
    rig.leftLeg.rotation.z = 0.08;
    rig.rightLeg.rotation.z = -0.08;
    rig.bodyGroup.position.y = Math.sin(timeSec * 3.2) * 0.04;
    rig.bodyGroup.rotation.z = 0;
  }

  const muzzleMat = rig.muzzleFlash.material as THREE.MeshBasicMaterial;
  if (state.actionState === 'ATTACKING') {
    if (state.attackKind === 'SHOOT') {
      const shootT = Math.max(0, Math.min(1, state.stateTimer / 9));
      rig.rightArm.rotation.z = 0.1 + Math.sin(shootT * Math.PI) * 0.24;
      rig.leftArm.rotation.z = 0.45;
      muzzleMat.opacity = shootT > 0.45 ? 0.96 : 0;
      rig.muzzleFlash.scale.setScalar(0.85 + shootT * 0.85);
      rig.muzzleLight.intensity = shootT > 0.45 ? 5.2 : 0;
      rig.slashArcGroup.visible = false;
    } else {
      const swingT = Math.max(0, Math.min(1, state.stateTimer / 12));
      rig.rightArm.rotation.z = -0.45 + Math.sin(swingT * Math.PI) * 1.45;
      rig.leftArm.rotation.z = 0.72;
      muzzleMat.opacity = 0;
      rig.muzzleLight.intensity = 0;

      // 3D Slash Crescent Trail Sweep
      rig.slashArcGroup.visible = true;
      rig.slashArcGroup.rotation.z = -1.35 + (1 - swingT) * 2.5;
      rig.slashArcMat.opacity = Math.sin(swingT * Math.PI) * 0.95;
    }
  } else if (state.actionState === 'DASHING') {
    rig.rightArm.rotation.z = -0.6;
    rig.leftArm.rotation.z = -0.65;
    rig.bodyGroup.rotation.z = state.facing === 'right' ? -0.38 : 0.38;
    muzzleMat.opacity = 0;
    rig.muzzleLight.intensity = 0;
    rig.slashArcGroup.visible = false;
  } else if (state.actionState === 'PARRYING') {
    rig.rightArm.rotation.z = 0.7;
    rig.leftArm.rotation.z = 1.1;
    muzzleMat.opacity = 0;
    rig.muzzleLight.intensity = 0;
    rig.slashArcGroup.visible = false;
  } else {
    rig.rightArm.rotation.z = 0.12 + Math.sin(runCycle) * 0.25 * speedNorm;
    rig.leftArm.rotation.z = -0.12 - Math.sin(runCycle) * 0.35 * speedNorm;
    muzzleMat.opacity = 0;
    rig.muzzleLight.intensity = 0;
    rig.slashArcGroup.visible = false;
  }

  rig.parryShieldMesh.visible = state.actionState === 'PARRYING';
  if (rig.parryShieldMesh.visible) {
    rig.parryShieldMesh.rotation.y = state.facing === 'right' ? 0 : Math.PI;
  }

  const aegisActive = (state.aegisActiveTimer ?? 0) > 0;
  rig.aegisDome.visible = aegisActive;
  if (aegisActive) {
    rig.aegisDome.rotation.y = timeSec * 1.4;
    rig.aegisDome.rotation.x = Math.sin(timeSec * 1.1) * 0.25;
    const pulse = 1 + Math.sin(timeSec * 8) * 0.04;
    rig.aegisDome.scale.setScalar(pulse);
    rig.aegisWireMat.opacity = 0.6 + Math.sin(timeSec * 10) * 0.25;
  }

  if (rig.wingsGroup.visible) {
    rig.wingsGroup.rotation.z = Math.sin(timeSec * 6) * 0.08;
  }
  if (rig.haloMesh.visible) {
    rig.haloMesh.rotation.z = timeSec * 1.8;
  }

  const posAttr = rig.capeGeo.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const base = rig.capeBasePositions;
  const windBoost = 0.35 + speedNorm * 0.95 + (state.actionState === 'DASHING' ? 0.9 : 0);
  for (let i = 0; i < posAttr.count; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const pinnedFactor = Math.max(0, (0.95 - by) / 1.9);
    const wave =
      Math.sin(timeSec * 7.5 - by * 3.1 + bx * 1.5) * 0.26 * pinnedFactor * (0.6 + windBoost);
    const trail = -pinnedFactor * (0.35 + windBoost * 0.65);
    arr[i * 3] = bx + trail;
    arr[i * 3 + 1] = by + Math.abs(trail) * 0.14;
    arr[i * 3 + 2] = base[i * 3 + 2] + wave;
  }
  posAttr.needsUpdate = true;
  rig.capeGeo.computeVertexNormals();

  rig.droneGroup.visible = Boolean(state.hasDrone ?? rig.appearance.hasDrone);
  if (rig.droneGroup.visible) {
    const faceSign = state.facing === 'right' ? 1 : -1;
    rig.droneGroup.position.set(
      -0.95 * faceSign,
      3.35 + Math.sin(timeSec * 3.8) * 0.22,
      -0.45 + Math.cos(timeSec * 2.1) * 0.2
    );
    rig.droneGroup.rotation.y = state.facing === 'right' ? 0.15 : Math.PI - 0.15;
  }

  const groundDist = Math.max(0, toWorldY(state.yPx + 24));
  const shadowScale = Math.max(0.4, 1 - groundDist * 0.1);
  rig.contactShadow.scale.setScalar(shadowScale);
  rig.contactShadow.position.y = -wy + 0.03;
  rig.contactShadow.visible = groundDist < 7;
}

export interface DashGhostPool {
  update: (deltaSec: number) => void;
  spawn: (xPx: number, yPx: number, facing: 'left' | 'right', colorHex?: number) => void;
  dispose: () => void;
}

export function createDashGhostPool(scene: THREE.Scene): DashGhostPool {
  const ghosts: { mesh: THREE.Group; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  const geoTorso = new THREE.BoxGeometry(0.74, 1.35, 0.48);
  const geoHead = new THREE.BoxGeometry(0.42, 0.44, 0.42);

  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
      wireframe: i % 2 === 1,
      depthWrite: false,
    });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(geoTorso, mat);
    torso.position.y = 1.65;
    const head = new THREE.Mesh(geoHead, mat);
    head.position.y = 2.65;
    g.add(torso, head);
    g.visible = false;
    scene.add(g);
    ghosts.push({ mesh: g, mat, life: 0 });
  }

  let cursor = 0;

  return {
    spawn: (xPx, yPx, facing, colorHex = 0x22d3ee) => {
      const slot = ghosts[cursor];
      cursor = (cursor + 1) % ghosts.length;
      slot.mesh.position.set(toWorldX(xPx), toWorldY(yPx + 24), 0);
      slot.mesh.rotation.y = facing === 'right' ? 0 : Math.PI;
      slot.mesh.rotation.z = facing === 'right' ? -0.32 : 0.32;
      slot.mat.color.setHex(colorHex);
      slot.mat.opacity = 0.75;
      slot.life = 0.32;
      slot.mesh.visible = true;
    },
    update: (deltaSec) => {
      for (const slot of ghosts) {
        if (slot.life <= 0) continue;
        slot.life -= deltaSec;
        if (slot.life <= 0) {
          slot.mesh.visible = false;
          slot.mat.opacity = 0;
        } else {
          slot.mat.opacity = (slot.life / 0.32) * 0.72;
        }
      }
    },
    dispose: () => {
      ghosts.forEach((g) => {
        scene.remove(g.mesh);
        g.mat.dispose();
      });
      geoTorso.dispose();
      geoHead.dispose();
    },
  };
}

export interface OrbitalStrikeRig {
  group: THREE.Group;
  update: (
    active: boolean,
    charging: boolean,
    xPx: number,
    timeSec: number,
    intensity: number
  ) => void;
  dispose: () => void;
}

export function createOrbitalStrikeRig(scene: THREE.Scene): OrbitalStrikeRig {
  const group = new THREE.Group();
  group.visible = false;

  const coreGeo = new THREE.CylinderGeometry(0.85, 0.95, 36, 16, 1, true);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coreBeam = new THREE.Mesh(coreGeo, coreMat);
  coreBeam.position.y = 18;
  group.add(coreBeam);

  const outerGeo = new THREE.CylinderGeometry(1.75, 2.2, 36, 16, 1, true);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerBeam = new THREE.Mesh(outerGeo, outerMat);
  outerBeam.position.y = 18;
  group.add(outerBeam);

  const ringGeo = new THREE.RingGeometry(1.4, 2.6, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(ringGeo, ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.08;
  group.add(groundRing);

  const strikeLight = new THREE.PointLight(0x38bdf8, 0, 26);
  strikeLight.position.y = 3.5;
  group.add(strikeLight);

  scene.add(group);

  return {
    group,
    update: (active, charging, xPx, timeSec, intensity) => {
      if (!active && !charging) {
        group.visible = false;
        strikeLight.intensity = 0;
        return;
      }
      group.visible = true;
      group.position.set(toWorldX(xPx), 0, 0);

      if (charging) {
        coreBeam.visible = false;
        outerBeam.visible = false;
        groundRing.visible = true;
        const shrink = 1.6 - Math.sin(timeSec * 16) * 0.25;
        groundRing.scale.setScalar(shrink);
        groundRing.rotation.z = timeSec * 5;
        ringMat.color.setHex(0xfacc15);
        ringMat.opacity = 0.9;
        strikeLight.color.setHex(0xfacc15);
        strikeLight.intensity = 4.5;
      } else {
        coreBeam.visible = true;
        outerBeam.visible = true;
        groundRing.visible = true;
        const pulse = (0.75 + Math.sin(timeSec * 42) * 0.25) * intensity;
        coreBeam.scale.set(pulse, 1, pulse);
        outerBeam.scale.set(pulse * 1.15, 1, pulse * 1.15);
        outerBeam.rotation.y = timeSec * 8;
        coreMat.opacity = Math.min(0.95, intensity);
        outerMat.opacity = Math.min(0.5, intensity * 0.55);
        groundRing.scale.setScalar(1.3 + (1 - intensity) * 2.2);
        ringMat.color.setHex(0x22d3ee);
        ringMat.opacity = intensity;
        strikeLight.color.setHex(0x67e8f9);
        strikeLight.intensity = 10 * intensity;
      }
    },
    dispose: () => {
      scene.remove(group);
      coreGeo.dispose();
      coreMat.dispose();
      outerGeo.dispose();
      outerMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
