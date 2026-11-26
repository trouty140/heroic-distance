import * as THREE from 'three';
import type { BossId, DecorItem, Enemy, Projectile } from '../types';
import { toWorldX, toWorldY } from './hero3d';

export interface EnemyMeshEntry {
  group: THREE.Group;
  weakPoint: THREE.Mesh;
  leftWing?: THREE.Mesh;
  rightWing?: THREE.Mesh;
  weaponPivot?: THREE.Group;
  orbitDrones?: THREE.Group;
  shadowClones?: THREE.Group;
  rageRing?: THREE.Mesh;
  unblockableRing?: THREE.Mesh;
  energyShield?: THREE.Mesh;
  telegraphBeam?: THREE.Mesh;
  baseMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function buildEnemy3D(enemy: Enemy): EnemyMeshEntry {
  const group = new THREE.Group();
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

  const colorNum = new THREE.Color(enemy.color || '#ef4444').getHex();
  const baseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      metalness: 0.72,
      roughness: 0.32,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: colorNum,
      emissive: colorNum,
      emissiveIntensity: 2.1,
      metalness: 0.2,
      roughness: 0.2,
    })
  );
  const darkMetal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b0f17,
      metalness: 0.85,
      roughness: 0.3,
    })
  );

  const bossEyeHex =
    enemy.bossId === 'specter9' || enemy.bossId === 'malakor' ? 0xd946ef : 0xff1e38;
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: bossEyeHex,
      emissive: bossEyeHex,
      emissiveIntensity: 3.1,
      metalness: 0.1,
      roughness: 0.15,
    })
  );
  const obsidianMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x05070c,
      metalness: 0.9,
      roughness: 0.24,
    })
  );

  let weakPoint: THREE.Mesh;
  let leftWing: THREE.Mesh | undefined;
  let rightWing: THREE.Mesh | undefined;
  let weaponPivot: THREE.Group | undefined;
  let orbitDrones: THREE.Group | undefined;
  let shadowClones: THREE.Group | undefined;
  let rageRing: THREE.Mesh | undefined;
  let unblockableRing: THREE.Mesh | undefined;
  let energyShield: THREE.Mesh | undefined;
  let telegraphBeam: THREE.Mesh | undefined;

  if (enemy.type === 'BOSS') {
    const bossId: BossId = enemy.bossId || 'malakor';
    const scale = bossId === 'malakor' ? 1.52 : bossId === 'ignis' ? 1.38 : bossId === 'vex' ? 1.24 : 1.15;

    // Towering dark obsidian mech/titan legs & torso
    const legs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12 * scale, 1.32 * scale, 0.84 * scale)), obsidianMat);
    legs.position.y = 0.65 * scale;
    legs.castShadow = true;
    group.add(legs);

    const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6 * scale, 1.7 * scale, 1.1 * scale)), obsidianMat);
    torso.position.y = 2.0 * scale;
    torso.castShadow = true;
    group.add(torso);

    // Jagged dorsal spine spikes along the back silhouette
    for (let sp = 0; sp < 4; sp++) {
      const spine = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.18 * scale, (0.75 + sp * 0.12) * scale, 4)),
        sp % 2 === 0 ? obsidianMat : accentMat
      );
      spine.position.set(-0.62 * scale, (1.45 + sp * 0.42) * scale, 0);
      spine.rotation.z = 0.85;
      group.add(spine);
    }

    // Jagged multi-spike shoulder pauldrons + dark aura collar
    for (const s of [-1, 1]) {
      const pauldron = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.48 * scale, 1.08 * scale, 5)),
        obsidianMat
      );
      pauldron.position.set(0, 2.82 * scale, s * 0.96 * scale);
      pauldron.rotation.x = s * 0.52;
      group.add(pauldron);

      const outerSpike = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.2 * scale, 0.95 * scale, 4)),
        eyeMat
      );
      outerSpike.position.set(-0.15 * scale, 3.08 * scale, s * 1.18 * scale);
      outerSpike.rotation.x = s * 0.72;
      group.add(outerSpike);
    }

    // Menacing dark silhouette halo behind boss shoulders
    const darkHalo = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.42 * scale, 0.09 * scale, 6, 18)),
      eyeMat
    );
    darkHalo.position.set(-0.28 * scale, 2.55 * scale, 0);
    darkHalo.rotation.y = Math.PI / 2;
    group.add(darkHalo);

    // Armored head + jagged crown + glowing crimson/void dual eyes
    const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78 * scale, 0.76 * scale, 0.78 * scale)), obsidianMat);
    head.position.y = 3.18 * scale;
    group.add(head);

    for (const eyeZ of [-0.18, 0.18]) {
      const eyeSlit = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.22 * scale, 0.12 * scale, 0.22 * scale)),
        eyeMat
      );
      eyeSlit.position.set(0.36 * scale, 3.22 * scale, eyeZ * scale);
      eyeSlit.rotation.x = eyeZ > 0 ? -0.22 : 0.22;
      group.add(eyeSlit);
    }

    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.16 * scale, 0.88 * scale, 5)), eyeMat);
      horn.position.set(-0.1 * scale, 3.74 * scale, s * 0.32 * scale);
      horn.rotation.z = -0.34;
      group.add(horn);
    }

    // Glowing Weak Point Reactor in Chest
    weakPoint = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.42 * scale, 1)), accentMat);
    weakPoint.position.set(0.55 * scale, 2.05 * scale, 0);
    group.add(weakPoint);

    // Weapon Arm Pivot
    weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.35 * scale, 2.2 * scale, 0.85 * scale);
    if (bossId === 'vex') {
      // Plasma Greatsword
      const hilt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.6, 0.2)), darkMetal);
      const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 2.7, 0.1)), accentMat);
      blade.position.y = 1.5;
      weaponPivot.add(hilt, blade);
    } else if (bossId === 'ignis') {
      // Molten Hammer Gauntlet
      const fist = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.65 * scale, 0)), accentMat);
      fist.position.set(0.55, -0.45, 0);
      weaponPivot.add(fist);
    } else if (bossId === 'specter9') {
      // Dual Void Blade
      const voidBlade = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 2.2, 4)), accentMat);
      voidBlade.rotation.z = -Math.PI / 2;
      voidBlade.position.x = 1.1;
      weaponPivot.add(voidBlade);
    } else {
      // Overlord Malakor Plasma Lance
      const lance = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.22, 3.2, 8)), accentMat);
      lance.rotation.z = -Math.PI / 2;
      lance.position.x = 1.25;
      weaponPivot.add(lance);
    }
    group.add(weaponPivot);

    // Boss-specific signature 3D attachments
    if (bossId === 'vex') {
      orbitDrones = new THREE.Group();
      orbitDrones.position.y = 2.1 * scale;
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const shieldHex = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 6)), accentMat);
        shieldHex.rotation.z = Math.PI / 2;
        shieldHex.position.set(Math.cos(ang) * 1.65, 0, Math.sin(ang) * 1.65);
        orbitDrones.add(shieldHex);
      }
      group.add(orbitDrones);
    }

    if (bossId === 'specter9') {
      shadowClones = new THREE.Group();
      const cloneMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.38, wireframe: true })
      );
      for (const offset of [-2.4, 2.4]) {
        const clone = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.45, 1.8, 4, 8)), cloneMat);
        clone.position.set(offset, 1.75, -0.6);
        shadowClones.add(clone);
      }
      shadowClones.visible = false;
      group.add(shadowClones);

      const beamMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.65 })
      );
      telegraphBeam = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 22, 8)), beamMat);
      telegraphBeam.rotation.z = Math.PI / 2;
      telegraphBeam.position.set(11, 2.0, 0);
      telegraphBeam.visible = false;
      group.add(telegraphBeam);
    }

    if (bossId === 'malakor') {
      const wingGeo = trackGeo(new THREE.BoxGeometry(0.18, 2.4, 2.6));
      const wingMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x3b0764,
          emissive: 0xdc2626,
          emissiveIntensity: 0.8,
          metalness: 0.5,
          roughness: 0.3,
        })
      );
      leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.6, 2.8 * scale, -1.45);
      leftWing.rotation.x = 0.45;
      rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(-0.6, 2.8 * scale, 1.45);
      rightWing.rotation.x = -0.45;
      group.add(leftWing, rightWing);
    }

    const rageMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    rageRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.9 * scale, 0.08, 8, 28)), rageMat);
    rageRing.rotation.x = Math.PI / 2;
    rageRing.position.y = 0.2;
    rageRing.visible = false;
    group.add(rageRing);

    const unblockMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85, wireframe: true })
    );
    unblockableRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.35 * scale, 0.14, 8, 24)), unblockMat);
    unblockableRing.position.y = 2.0 * scale;
    unblockableRing.visible = false;
    group.add(unblockableRing);

    const bossShieldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    energyShield = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.45 * scale, 1.45 * scale, 3.1 * scale, 6, 1, true, -Math.PI * 0.38, Math.PI * 0.76)),
      bossShieldMat
    );
    energyShield.rotation.y = Math.PI / 2;
    energyShield.position.set(0.55 * scale, 1.8 * scale, 0);
    energyShield.visible = false;
    group.add(energyShield);
  } else if (enemy.type === 'HARPY') {
    const body = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.55, 0)), baseMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    weakPoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 10, 10)), accentMat);
    weakPoint.position.set(0.35, 1.0, 0);
    group.add(weakPoint);

    const wingGeo = trackGeo(new THREE.BoxGeometry(0.15, 0.75, 1.35));
    leftWing = new THREE.Mesh(wingGeo, accentMat);
    leftWing.position.set(0, 1.15, -0.75);
    rightWing = new THREE.Mesh(wingGeo, accentMat);
    rightWing.position.set(0, 1.15, 0.75);
    group.add(leftWing, rightWing);
  } else if (enemy.type === 'HEAVY') {
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 1.85, 0.95)), baseMat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.52, 0.62)), darkMetal);
    head.position.y = 2.25;
    group.add(head);

    weakPoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.26, 10, 10)), accentMat);
    weakPoint.position.set(0.52, 1.35, 0);
    group.add(weakPoint);

    const shieldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 0.72,
      })
    );
    const towerShield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 1.9, 1.25)), shieldMat);
    towerShield.position.set(0.78, 1.12, 0);
    energyShield = towerShield;
    group.add(towerShield);
  } else if (enemy.type === 'ARCHER') {
    const body = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.34, 0.95, 4, 8)), baseMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.45, 0.45)), darkMetal);
    head.position.y = 1.9;
    group.add(head);

    weakPoint = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.4)), accentMat);
    weakPoint.position.set(0.2, 1.92, 0);
    group.add(weakPoint);

    weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.32, 1.35, 0.28);
    const rail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.05, 8)), accentMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.x = 0.45;
    weaponPivot.add(rail);
    group.add(weaponPivot);
  } else if (enemy.type === 'INTERCEPTOR') {
    // Armored Black Villain Interceptor Pursuit Truck
    const hull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 1.15, 1.75)), obsidianMat);
    hull.position.y = 0.78;
    hull.castShadow = true;
    group.add(hull);

    const cab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.75, 0.78, 1.55)), darkMetal);
    cab.position.set(0.15, 1.62, 0);
    cab.castShadow = true;
    group.add(cab);

    const ramBumper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.65, 1.85)), eyeMat);
    ramBumper.position.set(1.78, 0.55, 0);
    group.add(ramBumper);

    const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12));
    wheelGeo.rotateX(Math.PI / 2);
    for (const wx of [-1.15, 0.05, 1.15]) {
      for (const wz of [-0.92, 0.92]) {
        const wheel = new THREE.Mesh(wheelGeo, darkMetal);
        wheel.position.set(wx, 0.42, wz);
        group.add(wheel);
      }
    }

    // Roof EMP Missile Turret + Crimson Siren Bar
    weaponPivot = new THREE.Group();
    weaponPivot.position.set(0, 2.15, 0);
    const turret = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 0.38, 0.7)), obsidianMat);
    const empPod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8)), accentMat);
    empPod.rotation.z = Math.PI / 2;
    empPod.position.set(0.35, 0.1, 0);
    weaponPivot.add(turret, empPod);
    group.add(weaponPivot);

    weakPoint = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.32, 0)), eyeMat);
    weakPoint.position.set(1.08, 1.55, 0);
    group.add(weakPoint);
  } else if (enemy.type === 'HOVER_BIKE') {
    // Predator Black & Crimson Villain Hover-Bike
    const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.46, 0.68)), obsidianMat);
    chassis.position.y = 0.82;
    chassis.castShadow = true;
    group.add(chassis);

    const cowl = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.42, 1.15, 5)), darkMetal);
    cowl.rotation.z = -Math.PI / 2;
    cowl.position.set(1.18, 0.92, 0);
    group.add(cowl);

    const riderTorso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.72, 0.46)), obsidianMat);
    riderTorso.position.set(-0.15, 1.38, 0);
    riderTorso.rotation.z = -0.35;
    group.add(riderTorso);

    const riderVisor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.14, 0.36)), eyeMat);
    riderVisor.position.set(0.08, 1.85, 0);
    group.add(riderVisor);

    const thrusterGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.24, 0.42, 8));
    thrusterGeo.rotateZ(Math.PI / 2);
    for (const tz of [-0.36, 0.36]) {
      const thruster = new THREE.Mesh(thrusterGeo, accentMat);
      thruster.position.set(-1.12, 0.78, tz);
      group.add(thruster);
    }

    weakPoint = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 8, 8)), eyeMat);
    weakPoint.position.set(0.65, 1.02, 0);
    group.add(weakPoint);
  } else {
    // SCOUT cyber-stalker
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78, 1.15, 0.56)), baseMat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.42, 0.44)), darkMetal);
    head.position.y = 1.75;
    group.add(head);

    weakPoint = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.12, 0.4)), accentMat);
    weakPoint.position.set(0.21, 1.76, 0);
    group.add(weakPoint);

    weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.28, 1.1, 0.35);
    const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78, 0.12, 0.08)), accentMat);
    blade.position.x = 0.38;
    weaponPivot.add(blade);
    group.add(weaponPivot);
  }

  return {
    group,
    weakPoint,
    leftWing,
    rightWing,
    weaponPivot,
    orbitDrones,
    shadowClones,
    rageRing,
    unblockableRing,
    energyShield,
    telegraphBeam,
    baseMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function updateEnemy3D(entry: EnemyMeshEntry, enemy: Enemy, timeSec: number) {
  entry.group.position.set(toWorldX(enemy.x), toWorldY(enemy.y + enemy.height / 2), 0);
  entry.group.rotation.y = enemy.facing === 'right' ? 0 : Math.PI;

  const pulse = 1 + Math.sin(timeSec * 8) * 0.15;
  entry.weakPoint.scale.setScalar(pulse);

  if (enemy.isStunned) {
    entry.baseMat.emissive.setHex(0x38bdf8);
    entry.baseMat.emissiveIntensity = 0.65;
  } else if (enemy.behavior === 'TELEGRAPH') {
    entry.baseMat.emissive.setHex(0xfacc15);
    entry.baseMat.emissiveIntensity = 0.55;
  } else if (enemy.rageMode) {
    entry.baseMat.emissive.setHex(0xef4444);
    entry.baseMat.emissiveIntensity = 0.45 + Math.sin(timeSec * 14) * 0.25;
  } else {
    entry.baseMat.emissive.setHex(0x000000);
    entry.baseMat.emissiveIntensity = 0;
  }

  if (entry.leftWing && entry.rightWing) {
    const flap = Math.sin(timeSec * 11) * 0.42;
    entry.leftWing.rotation.x = 0.35 + flap;
    entry.rightWing.rotation.x = -0.35 - flap;
  }

  if (entry.weaponPivot) {
    if (enemy.behavior === 'ATTACK') {
      entry.weaponPivot.rotation.z = Math.sin(timeSec * 20) * 0.9;
    } else if (enemy.behavior === 'TELEGRAPH') {
      entry.weaponPivot.rotation.z = 0.75;
    } else {
      entry.weaponPivot.rotation.z = Math.sin(timeSec * 3) * 0.12;
    }
  }

  if (entry.orbitDrones) {
    entry.orbitDrones.rotation.y = timeSec * 2.4;
  }

  if (entry.shadowClones) {
    entry.shadowClones.visible =
      enemy.behavior === 'TELEGRAPH' || enemy.behavior === 'ATTACK' || Boolean(enemy.rageMode);
    entry.shadowClones.rotation.y = Math.sin(timeSec * 3) * 0.25;
  }

  if (entry.telegraphBeam) {
    entry.telegraphBeam.visible = enemy.behavior === 'TELEGRAPH';
  }

  if (entry.rageRing) {
    entry.rageRing.visible = Boolean(enemy.rageMode);
    if (entry.rageRing.visible) {
      entry.rageRing.rotation.z = timeSec * 5.2;
      entry.rageRing.scale.setScalar(1 + Math.sin(timeSec * 12) * 0.12);
    }
  }

  if (entry.unblockableRing) {
    const chargingUnblockable = (enemy.unblockableTimer ?? 0) > 0;
    entry.unblockableRing.visible = chargingUnblockable;
    if (chargingUnblockable) {
      entry.unblockableRing.rotation.z = -timeSec * 7;
      entry.unblockableRing.rotation.y = timeSec * 3;
      const pulseScale = 0.85 + Math.sin(timeSec * 22) * 0.22;
      entry.unblockableRing.scale.setScalar(pulseScale);
    }
  }

  if (entry.energyShield) {
    if (enemy.type === 'HEAVY') {
      entry.energyShield.visible = !enemy.isStunned;
      const shieldPulse = (enemy.blockTimer ?? 0) > 0 ? 1.12 : 1.0;
      entry.energyShield.scale.setScalar(shieldPulse);
    } else {
      entry.energyShield.visible = Boolean(enemy.shieldActive || (enemy.blockTimer ?? 0) > 0) && !enemy.isStunned;
    }
  }
}

export function buildPrincessCage3D(item: DecorItem): {
  group: THREE.Group;
  update: (timeSec: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const pedGeo = new THREE.CylinderGeometry(1.5, 1.75, 0.5, 8);
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.7, roughness: 0.3 });
  geos.push(pedGeo);
  mats.push(pedMat);
  const ped = new THREE.Mesh(pedGeo, pedMat);
  ped.position.y = 0.25;
  group.add(ped);

  // Captive Princess silhouette inside cage
  const dressGeo = new THREE.ConeGeometry(0.42, 1.4, 10);
  const dressMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xdb2777,
    emissiveIntensity: 0.35,
  });
  const headGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfde2c8 });
  geos.push(dressGeo, headGeo);
  mats.push(dressMat, headMat);

  const dress = new THREE.Mesh(dressGeo, dressMat);
  dress.position.y = 1.15;
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.02;
  group.add(dress, head);

  // Glowing energy prison crystal bars
  const cageGeo = new THREE.OctahedronGeometry(1.65, 1);
  const cageMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  });
  geos.push(cageGeo);
  mats.push(cageMat);
  const cage = new THREE.Mesh(cageGeo, cageMat);
  cage.position.y = 1.75;
  group.add(cage);

  const light = new THREE.PointLight(0xf472b6, 2.5, 9);
  light.position.y = 2.2;
  group.add(light);

  group.position.set(toWorldX(item.x + item.width / 2), toWorldY(item.y + item.height), 0);

  return {
    group,
    update: (t: number) => {
      cage.rotation.y = t * 1.1;
      dress.position.y = 1.15 + Math.sin(t * 2.5) * 0.05;
      head.position.y = 2.02 + Math.sin(t * 2.5) * 0.05;
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export interface ProjectilePool {
  sync: (projectiles: Projectile[], timeSec: number) => void;
  dispose: () => void;
}

export function createProjectilePool(scene: THREE.Scene): ProjectilePool {
  const pool = new Map<string, { group: THREE.Group; mat: THREE.MeshBasicMaterial; trail: THREE.Mesh }>();
  const sphereGeo = new THREE.SphereGeometry(0.22, 10, 10);
  const trailGeo = new THREE.CylinderGeometry(0.05, 0.18, 1.25, 8);
  trailGeo.rotateZ(Math.PI / 2);

  return {
    sync: (projectiles, timeSec) => {
      const aliveIds = new Set<string>();
      for (const p of projectiles) {
        aliveIds.add(p.id);
        let entry = pool.get(p.id);
        if (!entry) {
          const mat = new THREE.MeshBasicMaterial({ color: p.color || '#22d3ee' });
          const group = new THREE.Group();
          const head = new THREE.Mesh(sphereGeo, mat);
          const trail = new THREE.Mesh(trailGeo, mat);
          trail.position.x = -0.55;
          group.add(head, trail);
          scene.add(group);
          entry = { group, mat, trail };
          pool.set(p.id, entry);
        }

        entry.mat.color.set(p.deflected ? '#67e8f9' : p.color || '#22d3ee');
        entry.group.position.set(toWorldX(p.x), toWorldY(p.y), 0);
        const angle = Math.atan2(-p.vy, p.vx);
        entry.group.rotation.z = angle;

        if (p.type === 'LAVA_PILLAR') {
          entry.group.scale.set(1.8, 5.2, 1.8);
          entry.group.rotation.z = Math.PI / 2;
        } else if (p.type === 'METEOR') {
          entry.group.scale.setScalar(2.1);
        } else if (p.type === 'EMP_MISSILE') {
          const pulse = 1.45 + Math.sin(timeSec * 22) * 0.28;
          entry.group.scale.set(2.1, pulse, pulse);
        } else if (p.type === 'MISSILE') {
          entry.group.scale.set(1.9, 1.15, 1.15);
        } else if (p.type === 'SHOCKWAVE') {
          entry.group.scale.set(2.4, 1.1, 2.4);
        } else if (p.type === 'VOID_BEAM' || p.type === 'LASER_BARRAGE') {
          entry.group.scale.set(2.8, 0.85, 0.85);
        } else {
          const s = Math.max(0.75, p.radius / 6.5);
          entry.group.scale.setScalar(s + Math.sin(timeSec * 25) * 0.08);
        }
      }

      for (const [id, entry] of pool.entries()) {
        if (!aliveIds.has(id)) {
          scene.remove(entry.group);
          entry.mat.dispose();
          pool.delete(id);
        }
      }
    },
    dispose: () => {
      for (const entry of pool.values()) {
        scene.remove(entry.group);
        entry.mat.dispose();
      }
      pool.clear();
      sphereGeo.dispose();
      trailGeo.dispose();
    },
  };
}
