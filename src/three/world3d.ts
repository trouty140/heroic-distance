import * as THREE from 'three';
import type {
  BiomeStageId,
  DecorItem,
  GameSettings,
  GraphicsQuality,
  HazardTripwire,
  TerrainSegment,
  WorldId,
} from '../types';
import { resolveEffectiveWeather } from '../config/worlds';
import { getWeatherProfile } from '../config/weatherSystem';
import { toWorldX, toWorldY, WORLD_SCALE } from './hero3d';
import type { MaterialTextureSet, WorldTextureBundle } from './textures';

export function resolveSoloBiomeStage(world: WorldId, distanceMeters: number): BiomeStageId {
  if (distanceMeters < 400) {
    return world === 'postapoc' ? 'VOLCANIC' : 'JUNGLE';
  }
  if (distanceMeters < 800) {
    return 'VOLCANIC';
  }
  return 'CYBER';
}

interface BiomeAtmosphere {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  sunColor: THREE.Color;
  ambientColor: THREE.Color;
  accentHex: number;
}

const BIOME_PALETTES: Record<BiomeStageId, BiomeAtmosphere> = {
  JUNGLE: {
    skyColor: new THREE.Color('#061c24'),
    fogColor: new THREE.Color('#0a2e38'),
    fogDensity: 0.017,
    sunColor: new THREE.Color('#7dd3fc'),
    ambientColor: new THREE.Color('#164e63'),
    accentHex: 0x22d3ee,
  },
  VOLCANIC: {
    skyColor: new THREE.Color('#1b0b08'),
    fogColor: new THREE.Color('#3b150c'),
    fogDensity: 0.018,
    sunColor: new THREE.Color('#fb923c'),
    ambientColor: new THREE.Color('#7c2d12'),
    accentHex: 0xf97316,
  },
  CYBER: {
    skyColor: new THREE.Color('#090d1f'),
    fogColor: new THREE.Color('#131b3a'),
    fogDensity: 0.016,
    sunColor: new THREE.Color('#60a5fa'),
    ambientColor: new THREE.Color('#1e1b4b'),
    accentHex: 0x38bdf8,
  },
};

const WORLD_PALETTES: Record<WorldId, BiomeAtmosphere> = {
  scifi: BIOME_PALETTES.JUNGLE,
  medieval: {
    skyColor: new THREE.Color('#0d1626'),
    fogColor: new THREE.Color('#1e293b'),
    fogDensity: 0.018,
    sunColor: new THREE.Color('#e2e8f0'),
    ambientColor: new THREE.Color('#475569'),
    accentHex: 0xf59e0b,
  },
  postapoc: {
    skyColor: new THREE.Color('#2a150c'),
    fogColor: new THREE.Color('#5c2814'),
    fogDensity: 0.016,
    sunColor: new THREE.Color('#fdba74'),
    ambientColor: new THREE.Color('#7c2d12'),
    accentHex: 0x4ade80,
  },
};

export interface WorldEnvironmentController {
  sunLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  fog: THREE.FogExp2;
  updateAtmosphere: (
    settings: GameSettings,
    distanceMeters: number,
    playerWorldX: number,
    playerWorldY: number,
    timeSec: number,
    deltaSec: number,
    isSolo: boolean,
    bossAtmosphereActive?: boolean,
    onCrimsonLightning?: () => void
  ) => void;
  dispose: () => void;
}

export function createWorldEnvironment(
  scene: THREE.Scene,
  textures: WorldTextureBundle,
  isSoftwareGl: boolean
): WorldEnvironmentController {
  const fog = new THREE.FogExp2(0x0a2e38, 0.017);
  scene.fog = fog;
  scene.background = new THREE.Color(0x061c24);

  const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.92);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xbae6fd, 2.25);
  sunLight.position.set(10, 22, 14);
  if (!isSoftwareGl) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 65;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -12;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
  }
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0xf97316, 1.2);
  rimLight.position.set(-12, 10, -14);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Deep multi-layered 3D vista silhouettes (Crashed starship / fortress / cyber towers + torch braziers)
  const vistaGroup = new THREE.Group();
  const vistaGeos: THREE.BufferGeometry[] = [];
  const vistaMats: THREE.Material[] = [];

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x162030,
    metalness: 0.58,
    roughness: 0.55,
  });
  const vistaGlowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  vistaMats.push(pillarMat, vistaGlowMat, torchFlameMat, beaconMat);

  const vistaSlots: { group: THREE.Group; baseOffset: number; depthZ: number; parallax: number }[] = [];

  for (let i = 0; i < 18; i++) {
    const slot = new THREE.Group();
    const depthZ = -12 - (i % 3) * 12;
    const h = 13 + (i % 5) * 5.2;
    const w = 2.9 + (i % 4) * 1.25;

    const towerGeo = new THREE.BoxGeometry(w, h, w * 0.95);
    vistaGeos.push(towerGeo);
    const tower = new THREE.Mesh(towerGeo, pillarMat);
    tower.position.y = h * 0.38 - 2;
    slot.add(tower);

    // Crumbling stepped skyscraper crown or slanted ruin spire
    const capGeo = i % 2 === 0 ? new THREE.BoxGeometry(w * 0.68, 3.6, w * 0.68) : new THREE.ConeGeometry(w * 0.72, 3.2, 4);
    vistaGeos.push(capGeo);
    const cap = new THREE.Mesh(capGeo, pillarMat);
    cap.position.y = h * 0.38 - 2 + h * 0.5 + 1.4;
    if (i % 2 === 0) {
      cap.rotation.z = (i % 4 === 0 ? 1 : -1) * 0.12;
    } else {
      cap.rotation.y = Math.PI * 0.25;
    }
    slot.add(cap);

    // Emissive skyscraper window grid & vertical neon sign strip
    const stripGeo = new THREE.BoxGeometry(0.24, h * 0.62, 0.22);
    vistaGeos.push(stripGeo);
    const strip = new THREE.Mesh(stripGeo, vistaGlowMat);
    strip.position.set(0, h * 0.38 - 1.5, w * 0.49);
    slot.add(strip);

    if (i % 2 === 1) {
      const signGeo = new THREE.BoxGeometry(w * 0.75, 0.55, 0.16);
      vistaGeos.push(signGeo);
      const sign = new THREE.Mesh(signGeo, i % 4 === 1 ? torchFlameMat : vistaGlowMat);
      sign.position.set(0, h * 0.45, w * 0.52);
      slot.add(sign);
    }

    // Flickering torch/beacon brazier accent on front pillars
    if (i % 2 === 0) {
      const brazierGeo = new THREE.OctahedronGeometry(0.32, 0);
      vistaGeos.push(brazierGeo);
      const flame = new THREE.Mesh(brazierGeo, torchFlameMat);
      flame.position.set(-w * 0.35, 1.4, w * 0.5);
      slot.add(flame);
    }

    // Cascading distant waterfall on every 3rd monolith
    if (i % 3 === 1) {
      const wfGeo = new THREE.PlaneGeometry(1.4, 14);
      const wfMat = new THREE.MeshBasicMaterial({
        map: textures.waterfallMap,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      vistaGeos.push(wfGeo);
      vistaMats.push(wfMat);
      const wf = new THREE.Mesh(wfGeo, wfMat);
      wf.position.set(w * 0.32, 3.5, w * 0.52);
      slot.add(wf);
    }

    const baseOffset = (i - 4) * 9.5;
    slot.position.set(baseOffset, 0, depthZ);
    vistaGroup.add(slot);
    vistaSlots.push({ group: slot, baseOffset, depthZ, parallax: 0.25 + (i % 3) * 0.1 });
  }

  // Hero background centerpiece (Crashed Starship / Citadel Keep silhouette + distress beacon)
  const megaGeo = new THREE.CylinderGeometry(3.2, 5.4, 24, 8);
  const wingMegaGeo = new THREE.BoxGeometry(14, 1.2, 4.5);
  const beaconGeo = new THREE.SphereGeometry(0.55, 10, 10);
  vistaGeos.push(megaGeo, wingMegaGeo, beaconGeo);

  const megaShip = new THREE.Group();
  const megaHull = new THREE.Mesh(megaGeo, pillarMat);
  const megaWing = new THREE.Mesh(wingMegaGeo, pillarMat);
  megaWing.position.set(0, -2, 0);
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.set(0, 11.8, 0);
  megaShip.add(megaHull, megaWing, beaconMesh);
  megaShip.position.set(16, 7, -34);
  megaShip.rotation.z = 0.62;
  vistaGroup.add(megaShip);

  scene.add(vistaGroup);

  // Volumetric 3D God-Ray Light Shafts
  const godRaysGroup = new THREE.Group();
  const godRayGeo = new THREE.PlaneGeometry(3.6, 28);
  const godRayMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.085,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rayMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const ray = new THREE.Mesh(godRayGeo, godRayMat);
    ray.position.set(-14 + i * 7.2, 7.5, -5.5 - (i % 2) * 3.5);
    ray.rotation.z = -0.34;
    godRaysGroup.add(ray);
    rayMeshes.push(ray);
  }
  scene.add(godRaysGroup);

  // Reflective Wet Ground Horizon Strip (for rayTracedReflections)
  const wetGeo = new THREE.PlaneGeometry(140, 12);
  wetGeo.rotateX(-Math.PI / 2);
  const wetMat = new THREE.MeshStandardMaterial({
    color: 0x0b1724,
    metalness: 0.88,
    roughness: 0.09,
    normalMap: textures.medievalSlate.normalMap,
    roughnessMap: textures.medievalSlate.roughnessMap,
    transparent: true,
    opacity: 0.62,
  });
  const wetMirrorPlane = new THREE.Mesh(wetGeo, wetMat);
  wetMirrorPlane.position.set(0, -0.02, -3.8);
  wetMirrorPlane.receiveShadow = true;
  scene.add(wetMirrorPlane);

  // GPU Weather & Biome Particles (up to 320, dynamically scaled by GraphicsQuality)
  const PARTICLE_COUNT = 320;
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);
  const pVelocities = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPositions[i * 3] = (Math.random() - 0.5) * 48;
    pPositions[i * 3 + 1] = Math.random() * 18 - 2;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    pVelocities[i * 3] = (Math.random() - 0.5) * 1.4;
    pVelocities[i * 3 + 1] = -2 - Math.random() * 3;
    pVelocities[i * 3 + 2] = 0;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.32,
    map: textures.glowSprite,
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const weatherPoints = new THREE.Points(pGeo, pMat);
  scene.add(weatherPoints);

  const targetBg = new THREE.Color();
  const targetFog = new THREE.Color();
  const targetSun = new THREE.Color();
  const bossSkyDark = new THREE.Color('#090208');
  const bossFogDark = new THREE.Color('#1f0612');
  const bossCrimsonFlash = new THREE.Color('#ef4444');
  const wxSkyCol = new THREE.Color();
  const wxFogCol = new THREE.Color();
  const wxSunCol = new THREE.Color();
  let lastAppliedQuality: GraphicsQuality | null = null;
  let crimsonFlashTimer = 0;
  let nextCrimsonLightningIn = 3.2;

  const syncQualityShadowAndParticles = (quality: GraphicsQuality) => {
    if (lastAppliedQuality === quality) return;
    lastAppliedQuality = quality;

    const targetCount =
      quality === 'ultra' ? 320 : quality === 'high' ? 240 : quality === 'medium' ? 140 : 60;
    pGeo.setDrawRange(0, targetCount);

    if (!isSoftwareGl) {
      if (quality === 'low') {
        sunLight.castShadow = false;
      } else {
        sunLight.castShadow = true;
        const nextSize = quality === 'ultra' ? 2048 : quality === 'high' ? 1024 : 512;
        if (sunLight.shadow.mapSize.x !== nextSize) {
          sunLight.shadow.mapSize.set(nextSize, nextSize);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
      }
    }
  };

  return {
    sunLight,
    rimLight,
    hemiLight,
    fog,
    updateAtmosphere: (
      settings,
      distanceMeters,
      playerWX,
      playerWY,
      timeSec,
      deltaSec,
      isSolo,
      bossAtmosphereActive = false,
      onCrimsonLightning
    ) => {
      syncQualityShadowAndParticles(settings.graphicsQuality);

      const pal = isSolo
        ? BIOME_PALETTES[resolveSoloBiomeStage(settings.world, distanceMeters)]
        : WORLD_PALETTES[settings.world];

      const effectiveWeather = resolveEffectiveWeather(settings.world, settings.weather);
      const wxProfile = getWeatherProfile(effectiveWeather);

      if (bossAtmosphereActive) {
        nextCrimsonLightningIn -= deltaSec;
        if (nextCrimsonLightningIn <= 0) {
          nextCrimsonLightningIn = 2.6 + Math.random() * 2.8;
          crimsonFlashTimer = 0.24;
          onCrimsonLightning?.();
        }
      } else {
        nextCrimsonLightningIn = 1.6;
      }
      if (crimsonFlashTimer > 0) {
        crimsonFlashTimer = Math.max(0, crimsonFlashTimer - deltaSec);
      }

      if (bossAtmosphereActive) {
        targetBg.copy(bossSkyDark);
        targetFog.copy(bossFogDark);
        targetSun.setHex(0xf43f5e);
        if (crimsonFlashTimer > 0) {
          const flashRatio = crimsonFlashTimer / 0.24;
          targetBg.lerp(bossCrimsonFlash, flashRatio * 0.52);
          targetFog.lerp(bossCrimsonFlash, flashRatio * 0.36);
          targetSun.setHex(0xffb4b4);
          sunLight.intensity = 2.25 + flashRatio * 2.4;
        } else {
          sunLight.intensity = 1.45;
        }
      } else if (wxProfile.isExtreme) {
        wxSkyCol.set(wxProfile.skyColorHex);
        wxFogCol.set(wxProfile.fogColorHex);
        wxSunCol.set(wxProfile.sunColorHex);
        targetBg.copy(pal.skyColor).lerp(wxSkyCol, 0.78);
        targetFog.copy(pal.fogColor).lerp(wxFogCol, 0.78);
        targetSun.copy(wxSunCol);
        sunLight.intensity = effectiveWeather === 'solar_flare' ? 2.85 : effectiveWeather === 'void_storm' ? 1.55 : 1.95;
      } else {
        targetBg.copy(pal.skyColor);
        targetFog.copy(pal.fogColor);
        targetSun.copy(pal.sunColor);
        sunLight.intensity = 2.25;
      }

      const lerpAlpha = Math.min(1, deltaSec * 2.8);
      (scene.background as THREE.Color).lerp(targetBg, lerpAlpha);
      fog.color.lerp(targetFog, lerpAlpha);
      const targetDensity = bossAtmosphereActive
        ? pal.fogDensity * 1.55
        : pal.fogDensity * wxProfile.fogDensityMult;
      fog.density += (targetDensity - fog.density) * lerpAlpha;

      sunLight.color.lerp(targetSun, lerpAlpha);
      sunLight.position.set(playerWX + 10, playerWY + 20, 14);
      sunLight.target.position.set(playerWX + 2, playerWY, 0);
      sunLight.target.updateMatrixWorld();

      rimLight.position.set(playerWX - 12, playerWY + 9, -12);
      rimLight.target.position.set(playerWX, playerWY + 1.5, 0);
      rimLight.target.updateMatrixWorld();

      vistaGlowMat.color.setHex(
        bossAtmosphereActive ? 0xef4444 : wxProfile.isExtreme ? wxProfile.particleColorHex : pal.accentHex
      );
      // Environmental storytelling flicker & beacon pulse
      const torchPulse = 0.72 + Math.sin(timeSec * 11.5) * 0.28;
      torchFlameMat.color.setRGB(1.0 * torchPulse, 0.45 * torchPulse, 0.1 * torchPulse);
      const beaconOn = Math.sin(timeSec * 3.4) > 0.15;
      beaconMat.color.setHex(beaconOn ? 0xf43f5e : 0x3b0d17);

      textures.waterfallMap.offset.y -= deltaSec * 1.65;

      // Volumetric God-Rays tracking camera horizon
      const showRays = settings.volumetricLighting && settings.graphicsQuality !== 'low';
      godRaysGroup.visible = showRays;
      if (showRays) {
        godRaysGroup.position.x = playerWX;
        godRayMat.color.copy(bossAtmosphereActive ? bossCrimsonFlash : targetSun);
        godRayMat.opacity =
          (settings.graphicsQuality === 'ultra' ? 0.11 : 0.075) *
          (0.88 + Math.sin(timeSec * 1.1) * 0.12);
      }

      // Wet reflective surface corridor
      wetMirrorPlane.visible = settings.rayTracedReflections && settings.graphicsQuality !== 'low';
      if (wetMirrorPlane.visible) {
        wetMirrorPlane.position.x = playerWX;
      }

      // Wrap vista monoliths seamlessly around camera
      for (const slot of vistaSlots) {
        const span = 18 * 9.5;
        let rel = (slot.baseOffset - playerWX * (1 - slot.parallax)) % span;
        if (rel < -span * 0.4) rel += span;
        if (rel > span * 0.6) rel -= span;
        slot.group.position.x = playerWX + rel - 14;
      }
      megaShip.position.x = playerWX + 18 - ((playerWX * 0.08) % 28);

      // Weather & Boss Heavy Rain particles
      weatherPoints.visible = settings.particlesEnabled || bossAtmosphereActive;
      if (weatherPoints.visible) {
        const activeCount =
          settings.graphicsQuality === 'ultra'
            ? 320
            : settings.graphicsQuality === 'high'
            ? 240
            : settings.graphicsQuality === 'medium'
            ? 140
            : 60;

        const bossRain = bossAtmosphereActive;
        const pStyle = bossRain ? 'rain' : wxProfile.particleStyle;
        const isRain = pStyle === 'rain' || pStyle === 'acid';
        const isEmber = pStyle === 'ember';
        const isVoid = pStyle === 'void';
        const isSpores = pStyle === 'spores';

        pMat.color.setHex(
          bossRain
            ? crimsonFlashTimer > 0
              ? 0xfca5a5
              : 0x93c5fd
            : wxProfile.isExtreme || isRain || pStyle === 'snow'
            ? wxProfile.particleColorHex
            : pal.accentHex
        );
        pMat.size = bossRain ? 0.25 : wxProfile.particleSize;

        const attr = pGeo.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const vyFactor = bossRain ? 5.6 : wxProfile.particleSpeedY;
        const vxWind = bossRain ? -5.8 : wxProfile.particleWindX;

        for (let i = 0; i < activeCount; i++) {
          const ix = i * 3;
          const swirlX =
            isSpores || isEmber || isVoid ? Math.sin(timeSec * 2.2 + i) * (isVoid ? 1.8 : 0.95) : 0;
          const swirlY =
            isSpores || isVoid ? Math.cos(timeSec * 1.6 + i) * 0.45 : 0;
          arr[ix] += (vxWind + swirlX) * deltaSec;
          arr[ix + 1] -= (1.8 * vyFactor + swirlY) * deltaSec;

          if (arr[ix + 1] < -2) arr[ix + 1] = 16;
          if (arr[ix + 1] > 16.5) arr[ix + 1] = -1.5;
          if (arr[ix] < playerWX - 26) arr[ix] += 52;
          if (arr[ix] > playerWX + 26) arr[ix] -= 52;
        }
        attr.needsUpdate = true;
      }
    },
    dispose: () => {
      scene.remove(
        vistaGroup,
        godRaysGroup,
        wetMirrorPlane,
        weatherPoints,
        hemiLight,
        sunLight,
        sunLight.target,
        rimLight,
        rimLight.target
      );
      vistaGeos.forEach((g) => g.dispose());
      vistaMats.forEach((m) => m.dispose());
      godRayGeo.dispose();
      godRayMat.dispose();
      wetGeo.dispose();
      wetMat.dispose();
      pGeo.dispose();
      pMat.dispose();
    },
  };
}

export interface TerrainAndDecorRenderer {
  syncTerrain: (
    segments: TerrainSegment[],
    decor: DecorItem[],
    biome: BiomeStageId | WorldId,
    isSolo: boolean,
    timeSec: number,
    billboardsHijacked?: boolean,
    tripwires?: HazardTripwire[]
  ) => void;
  dispose: () => void;
}

export function createTerrainAndDecorRenderer(
  scene: THREE.Scene,
  textures: WorldTextureBundle
): TerrainAndDecorRenderer {
  const terrainMap = new Map<TerrainSegment, THREE.Group>();
  const decorMap = new Map<
    DecorItem,
    { group: THREE.Group; spinTarget?: THREE.Object3D; screenMesh?: THREE.Mesh; matIdx?: number }
  >();
  const tripwireMap = new Map<string, { group: THREE.Group; beam: THREE.Mesh }>();

  const pickTexSet = (biome: BiomeStageId | WorldId, isSolo: boolean): MaterialTextureSet => {
    if (isSolo) {
      if (biome === 'VOLCANIC') return textures.volcanicBasalt;
      if (biome === 'CYBER') return textures.cyberMetal;
      return textures.jungleStone;
    }
    if (biome === 'medieval') return textures.medievalSlate;
    if (biome === 'postapoc') return textures.volcanicBasalt;
    return textures.jungleStone;
  };

  const sharedMaterials = {
    jungle: new THREE.MeshStandardMaterial({
      map: textures.jungleStone.map,
      normalMap: textures.jungleStone.normalMap,
      roughnessMap: textures.jungleStone.roughnessMap,
      metalness: 0.25,
      roughness: 0.68,
    }),
    volcanic: new THREE.MeshStandardMaterial({
      map: textures.volcanicBasalt.map,
      normalMap: textures.volcanicBasalt.normalMap,
      roughnessMap: textures.volcanicBasalt.roughnessMap,
      metalness: 0.32,
      roughness: 0.65,
    }),
    cyber: new THREE.MeshStandardMaterial({
      map: textures.cyberMetal.map,
      normalMap: textures.cyberMetal.normalMap,
      roughnessMap: textures.cyberMetal.roughnessMap,
      metalness: 0.78,
      roughness: 0.3,
    }),
    medieval: new THREE.MeshStandardMaterial({
      map: textures.medievalSlate.map,
      normalMap: textures.medievalSlate.normalMap,
      roughnessMap: textures.medievalSlate.roughnessMap,
      metalness: 0.24,
      roughness: 0.6,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      map: textures.wetAsphalt.map,
      normalMap: textures.wetAsphalt.normalMap,
      roughnessMap: textures.wetAsphalt.roughnessMap,
      metalness: 0.52,
      roughness: 0.22,
    }),
    lava: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }),
    spikes: new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.9,
      roughness: 0.2,
    }),
    spring: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x34d399,
      emissiveIntensity: 1.8,
      metalness: 0.4,
      roughness: 0.2,
    }),
    coin: new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      metalness: 0.92,
      roughness: 0.18,
    }),
    potion: new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    }),
    chest: new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.6,
      roughness: 0.38,
    }),
    floraGlow: new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.9,
      roughness: 0.25,
    }),
    amberGlow: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    }),
    trunk: new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.85,
    }),
    waterfall: new THREE.MeshBasicMaterial({
      map: textures.waterfallMap,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    billboardMats: textures.billboardMaps.map(
      (bMap) =>
        new THREE.MeshBasicMaterial({
          map: bMap,
          transparent: true,
          opacity: 0.94,
          side: THREE.DoubleSide,
        })
    ),
    hijackBillboardMats: textures.hijackBillboardMaps.map(
      (bMap) =>
        new THREE.MeshBasicMaterial({
          map: bMap,
          transparent: true,
          opacity: 0.97,
          side: THREE.DoubleSide,
        })
    ),
    tripwirePylon: new THREE.MeshStandardMaterial({
      color: 0x090b10,
      metalness: 0.85,
      roughness: 0.25,
    }),
    tripwireLaser: new THREE.MeshBasicMaterial({
      color: 0xff1e38,
      transparent: true,
      opacity: 0.88,
    }),
  };

  const trackMeshGeos = new Set<THREE.BufferGeometry>();

  const buildTerrainMesh = (seg: TerrainSegment, biome: BiomeStageId | WorldId, isSolo: boolean): THREE.Group => {
    const g = new THREE.Group();
    const w = Math.max(0.5, seg.width * WORLD_SCALE);
    const h = Math.max(0.4, seg.height * WORLD_SCALE);
    const wx = toWorldX(seg.x + seg.width / 2);
    const wy = toWorldY(seg.y + seg.height / 2);

    if (seg.type === 'LAVA') {
      const geo = new THREE.BoxGeometry(w, h, 3.6);
      trackMeshGeos.add(geo);
      const m = new THREE.Mesh(geo, sharedMaterials.lava);
      g.add(m);
    } else if (seg.type === 'SPIKES') {
      const baseGeo = new THREE.BoxGeometry(w, h * 0.4, 2.2);
      trackMeshGeos.add(baseGeo);
      const base = new THREE.Mesh(baseGeo, sharedMaterials.cyber);
      base.position.y = -h * 0.25;
      g.add(base);

      const spikeCount = Math.max(2, Math.floor(w / 0.55));
      const coneGeo = new THREE.ConeGeometry(0.18, h * 1.15, 4);
      trackMeshGeos.add(coneGeo);
      for (let i = 0; i < spikeCount; i++) {
        const sp = new THREE.Mesh(coneGeo, sharedMaterials.spikes);
        sp.position.set(-w / 2 + (i + 0.5) * (w / spikeCount), h * 0.2, 0);
        g.add(sp);
      }
    } else if (seg.type === 'SPRING') {
      const geo = new THREE.CylinderGeometry(w * 0.48, w * 0.55, h, 10);
      trackMeshGeos.add(geo);
      const pad = new THREE.Mesh(geo, sharedMaterials.spring);
      g.add(pad);
    } else if (seg.type === 'RAMP') {
      const startTopW = toWorldY(seg.y);
      const endTopW = toWorldY(seg.rampEndY ?? seg.y - 110);
      const baseBottomW = toWorldY(Math.max(seg.y, seg.rampEndY ?? seg.y) + 28);
      const halfW = w / 2;

      const rampShape = new THREE.Shape();
      rampShape.moveTo(-halfW, baseBottomW);
      rampShape.lineTo(halfW, baseBottomW);
      rampShape.lineTo(halfW, endTopW);
      rampShape.lineTo(-halfW, startTopW);
      rampShape.closePath();

      const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
        depth: 3.4,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.06,
        bevelSegments: 2,
      });
      rampGeo.translate(0, 0, -1.7);
      trackMeshGeos.add(rampGeo);

      const rampMesh = new THREE.Mesh(rampGeo, sharedMaterials.asphalt);
      rampMesh.receiveShadow = true;
      rampMesh.castShadow = true;
      g.add(rampMesh);

      // Glowing neon ramp edge rail
      const slopeLen = Math.hypot(w, endTopW - startTopW);
      const slopeAngle = Math.atan2(endTopW - startTopW, w);
      const railGeo = new THREE.BoxGeometry(slopeLen, 0.1, 0.14);
      trackMeshGeos.add(railGeo);
      const rail = new THREE.Mesh(railGeo, sharedMaterials.floraGlow);
      rail.position.set(0, (startTopW + endTopW) / 2 + 0.06, 1.72);
      rail.rotation.z = slopeAngle;
      g.add(rail);

      g.position.set(wx, 0, 0);
      return g;
    } else if (seg.type === 'HIGHWAY') {
      const roadGeo = new THREE.BoxGeometry(w, h, 4.4);
      trackMeshGeos.add(roadGeo);
      const road = new THREE.Mesh(roadGeo, sharedMaterials.asphalt);
      road.receiveShadow = true;
      road.castShadow = true;
      g.add(road);

      const trimGeo = new THREE.BoxGeometry(w, 0.09, 0.14);
      trackMeshGeos.add(trimGeo);
      const frontTrim = new THREE.Mesh(trimGeo, sharedMaterials.floraGlow);
      frontTrim.position.set(0, h / 2, 2.22);
      const backTrim = new THREE.Mesh(trimGeo, sharedMaterials.amberGlow);
      backTrim.position.set(0, h / 2, -2.22);
      g.add(frontTrim, backTrim);
    } else {
      const texKey = isSolo
        ? biome === 'VOLCANIC'
          ? 'volcanic'
          : biome === 'CYBER'
          ? 'cyber'
          : 'jungle'
        : biome === 'medieval'
        ? 'medieval'
        : biome === 'postapoc'
        ? 'volcanic'
        : 'jungle';
      const mat = sharedMaterials[texKey];
      void pickTexSet(biome, isSolo);

      const shape = new THREE.Shape();
      const hw = w / 2 - 0.1;
      const hh = h / 2 - 0.08;
      shape.moveTo(-hw, -hh);
      shape.lineTo(hw, -hh);
      shape.lineTo(hw, hh);
      shape.lineTo(-hw, hh);
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: seg.type === 'GROUND' ? 4.8 : 2.9,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelSegments: 2,
      });
      extrudeGeo.center();
      trackMeshGeos.add(extrudeGeo);

      const block = new THREE.Mesh(extrudeGeo, mat);
      block.receiveShadow = true;
      block.castShadow = seg.type !== 'GROUND';
      g.add(block);

      const trimGeo = new THREE.BoxGeometry(w, 0.1, 0.16);
      trackMeshGeos.add(trimGeo);
      const trim = new THREE.Mesh(trimGeo, sharedMaterials.floraGlow);
      trim.position.set(0, h / 2, seg.type === 'GROUND' ? 2.45 : 1.5);
      g.add(trim);
    }

    g.position.set(wx, wy, 0);
    return g;
  };

  const buildDecorMesh = (
    item: DecorItem
  ): { group: THREE.Group; spinTarget?: THREE.Object3D; screenMesh?: THREE.Mesh; matIdx?: number } => {
    const g = new THREE.Group();
    const wx = toWorldX(item.x + item.width / 2);
    const wy = toWorldY(item.y + item.height / 2);

    if (item.type === 'GOLD_COIN') {
      const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14);
      geo.rotateX(Math.PI / 2);
      trackMeshGeos.add(geo);
      const coin = new THREE.Mesh(geo, sharedMaterials.coin);
      g.add(coin);
      g.position.set(wx, wy, 0);
      return { group: g, spinTarget: coin };
    }

    if (item.type === 'POTION') {
      const geo = new THREE.OctahedronGeometry(0.38, 0);
      trackMeshGeos.add(geo);
      const pot = new THREE.Mesh(geo, sharedMaterials.potion);
      g.add(pot);
      g.position.set(wx, wy, 0);
      return { group: g, spinTarget: pot };
    }

    if (item.type === 'CHEST') {
      const boxGeo = new THREE.BoxGeometry(1.15, 0.85, 0.85);
      const bandGeo = new THREE.BoxGeometry(1.2, 0.18, 0.9);
      trackMeshGeos.add(boxGeo);
      trackMeshGeos.add(bandGeo);
      const box = new THREE.Mesh(boxGeo, sharedMaterials.chest);
      const band = new THREE.Mesh(bandGeo, sharedMaterials.coin);
      band.position.y = 0.12;
      g.add(box, band);
      g.position.set(wx, wy, 0);
      return { group: g };
    }

    if (item.type === 'BILLBOARD') {
      const postGeo = new THREE.BoxGeometry(0.28, 5.2, 0.28);
      const frameGeo = new THREE.BoxGeometry(4.8, 2.8, 0.24);
      const screenGeo = new THREE.PlaneGeometry(4.5, 2.55);
      trackMeshGeos.add(postGeo);
      trackMeshGeos.add(frameGeo);
      trackMeshGeos.add(screenGeo);

      const post = new THREE.Mesh(postGeo, sharedMaterials.cyber);
      post.position.y = 2.6;
      const frame = new THREE.Mesh(frameGeo, sharedMaterials.cyber);
      frame.position.y = 4.6;
      const matIdx = Math.abs(item.variant ?? Math.floor(item.x)) % sharedMaterials.billboardMats.length;
      const screen = new THREE.Mesh(screenGeo, sharedMaterials.billboardMats[matIdx]);
      screen.position.set(0, 4.6, 0.14);
      g.add(post, frame, screen);
      g.position.set(wx, toWorldY(item.y + item.height), -2.45);
      return { group: g, screenMesh: screen, matIdx };
    }

    if (item.type === 'GARAGE_BAY') {
      const pillarGeo = new THREE.BoxGeometry(0.36, 4.2, 0.36);
      const roofGeo = new THREE.BoxGeometry(7.2, 0.42, 4.4);
      const stripGeo = new THREE.BoxGeometry(6.8, 0.1, 0.16);
      trackMeshGeos.add(pillarGeo);
      trackMeshGeos.add(roofGeo);
      trackMeshGeos.add(stripGeo);

      for (const px of [-3.2, 3.2]) {
        const pL = new THREE.Mesh(pillarGeo, sharedMaterials.cyber);
        pL.position.set(px, 2.1, -1.9);
        const pR = new THREE.Mesh(pillarGeo, sharedMaterials.cyber);
        pR.position.set(px, 2.1, 1.9);
        g.add(pL, pR);
      }
      const roof = new THREE.Mesh(roofGeo, sharedMaterials.cyber);
      roof.position.y = 4.25;
      const neonFront = new THREE.Mesh(stripGeo, sharedMaterials.floraGlow);
      neonFront.position.set(0, 4.1, 2.22);
      g.add(roof, neonFront);
      g.position.set(wx, toWorldY(item.y + item.height), -0.4);
      return { group: g };
    }

    if (item.type === 'NEON_LAMP') {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 4.4, 8);
      const armGeo = new THREE.BoxGeometry(1.1, 0.1, 0.12);
      const bulbGeo = new THREE.BoxGeometry(0.65, 0.08, 0.18);
      trackMeshGeos.add(poleGeo);
      trackMeshGeos.add(armGeo);
      trackMeshGeos.add(bulbGeo);
      const pole = new THREE.Mesh(poleGeo, sharedMaterials.cyber);
      pole.position.y = 2.2;
      const arm = new THREE.Mesh(armGeo, sharedMaterials.cyber);
      arm.position.set(0.45, 4.35, 0);
      const bulb = new THREE.Mesh(bulbGeo, sharedMaterials.floraGlow);
      bulb.position.set(0.68, 4.28, 0);
      g.add(pole, arm, bulb);
      g.position.set(wx, toWorldY(item.y + item.height), -1.8);
      return { group: g };
    }

    if (item.type === 'WATERFALL') {
      const geo = new THREE.PlaneGeometry(item.width * WORLD_SCALE, item.height * WORLD_SCALE);
      trackMeshGeos.add(geo);
      const mesh = new THREE.Mesh(geo, sharedMaterials.waterfall);
      g.add(mesh);
      g.position.set(wx, wy, -2.8);
      return { group: g };
    }

    if (item.type === 'TREE') {
      const stemGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.8, 7);
      const capGeo = new THREE.ConeGeometry(1.25, 0.9, 8);
      trackMeshGeos.add(stemGeo);
      trackMeshGeos.add(capGeo);
      const stem = new THREE.Mesh(stemGeo, sharedMaterials.trunk);
      stem.position.y = 1.4;
      const cap = new THREE.Mesh(capGeo, sharedMaterials.floraGlow);
      cap.position.y = 2.95;
      g.add(stem, cap);
      g.position.set(wx, toWorldY(item.y + item.height), -1.8);
      return { group: g };
    }

    if (item.type === 'RUINS') {
      const colGeo = new THREE.BoxGeometry(0.65, 3.6, 0.8);
      const beamGeo = new THREE.BoxGeometry(2.8, 0.55, 0.9);
      trackMeshGeos.add(colGeo);
      trackMeshGeos.add(beamGeo);
      const col = new THREE.Mesh(colGeo, sharedMaterials.medieval);
      col.position.y = 1.8;
      const beam = new THREE.Mesh(beamGeo, sharedMaterials.medieval);
      beam.position.set(0.6, 3.6, 0);
      beam.rotation.z = -0.14;
      g.add(col, beam);
      g.position.set(wx, toWorldY(item.y + item.height), -2.2);
      return { group: g };
    }

    const crystalGeo = new THREE.ConeGeometry(0.22, 0.85, 5);
    trackMeshGeos.add(crystalGeo);
    const c1 = new THREE.Mesh(crystalGeo, sharedMaterials.floraGlow);
    c1.position.y = 0.4;
    const c2 = new THREE.Mesh(crystalGeo, sharedMaterials.floraGlow);
    c2.position.set(0.28, 0.32, 0.1);
    c2.rotation.z = -0.35;
    g.add(c1, c2);
    g.position.set(wx, toWorldY(item.y + item.height), -0.9);
    return { group: g };
  };

  return {
    syncTerrain: (
      segments,
      decor,
      biome,
      isSolo,
      timeSec,
      billboardsHijacked = false,
      tripwires = []
    ) => {
      const activeSegs = new Set<TerrainSegment>(segments);
      for (const seg of segments) {
        if (!terrainMap.has(seg)) {
          const meshGroup = buildTerrainMesh(seg, biome, isSolo);
          scene.add(meshGroup);
          terrainMap.set(seg, meshGroup);
        }
      }
      for (const [seg, group] of terrainMap.entries()) {
        if (!activeSegs.has(seg)) {
          scene.remove(group);
          terrainMap.delete(seg);
        }
      }

      const activeDecor = new Set<DecorItem>();
      for (const item of decor) {
        if (item.type === 'PRINCESS_CAGE' || item.collected) continue;
        activeDecor.add(item);
        let entry = decorMap.get(item);
        if (!entry) {
          entry = buildDecorMesh(item);
          scene.add(entry.group);
          decorMap.set(item, entry);
        }
        if (entry.screenMesh && typeof entry.matIdx === 'number') {
          const idx = entry.matIdx % sharedMaterials.billboardMats.length;
          const targetMat = billboardsHijacked
            ? sharedMaterials.hijackBillboardMats[idx]
            : sharedMaterials.billboardMats[idx];
          if (entry.screenMesh.material !== targetMat) {
            entry.screenMesh.material = targetMat;
          }
        }
        if (entry.spinTarget) {
          entry.spinTarget.rotation.y = timeSec * 3.2;
          entry.spinTarget.position.y = Math.sin(timeSec * 4 + item.x * 0.05) * 0.14;
        }
      }
      for (const [item, entry] of decorMap.entries()) {
        if (!activeDecor.has(item)) {
          scene.remove(entry.group);
          decorMap.delete(item);
        }
      }

      // Sync 3D Villain Laser Tripwire Traps
      const activeTripwireIds = new Set<string>();
      for (const tw of tripwires) {
        activeTripwireIds.add(tw.id);
        let entry = tripwireMap.get(tw.id);
        if (!entry) {
          const g = new THREE.Group();
          const pylonGeo = new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6);
          const beamGeo = new THREE.CylinderGeometry(0.055, 0.055, 2.4, 8);
          beamGeo.rotateZ(Math.PI / 2);
          trackMeshGeos.add(pylonGeo);
          trackMeshGeos.add(beamGeo);

          const pylonBack = new THREE.Mesh(pylonGeo, sharedMaterials.tripwirePylon);
          pylonBack.position.set(0, 1.1, -1.15);
          const pylonFront = new THREE.Mesh(pylonGeo, sharedMaterials.tripwirePylon);
          pylonFront.position.set(0, 1.1, 1.15);

          const beam = new THREE.Mesh(beamGeo, sharedMaterials.tripwireLaser);
          beam.rotation.y = Math.PI / 2;
          beam.position.set(0, 1.05, 0);

          g.add(pylonBack, pylonFront, beam);
          g.position.set(toWorldX(tw.x), toWorldY(tw.y), 0);
          scene.add(g);
          entry = { group: g, beam };
          tripwireMap.set(tw.id, entry);
        }
        entry.beam.visible = tw.active && !tw.disarmed;
        if (entry.beam.visible) {
          entry.beam.position.y = 0.85 + Math.sin(timeSec * 14) * 0.22;
        }
      }
      for (const [id, entry] of tripwireMap.entries()) {
        if (!activeTripwireIds.has(id)) {
          scene.remove(entry.group);
          tripwireMap.delete(id);
        }
      }
    },
    dispose: () => {
      for (const g of terrainMap.values()) scene.remove(g);
      for (const d of decorMap.values()) scene.remove(d.group);
      for (const t of tripwireMap.values()) scene.remove(t.group);
      terrainMap.clear();
      decorMap.clear();
      tripwireMap.clear();
      trackMeshGeos.forEach((g) => g.dispose());
      trackMeshGeos.clear();
      sharedMaterials.billboardMats.forEach((m) => m.dispose());
      sharedMaterials.hijackBillboardMats.forEach((m) => m.dispose());
      Object.entries(sharedMaterials).forEach(([k, m]) => {
        if (
          k !== 'billboardMats' &&
          k !== 'hijackBillboardMats' &&
          m &&
          typeof (m as THREE.Material).dispose === 'function'
        ) {
          (m as THREE.Material).dispose();
        }
      });
    },
  };
}

export interface BurstFxPool {
  spawnBurst: (xPx: number, yPx: number, colorHex: number, count?: number, flashPower?: number) => void;
  update: (deltaSec: number) => void;
  dispose: () => void;
}

export function createBurstFxPool(scene: THREE.Scene): BurstFxPool {
  const MAX_DEBRIS = 90;
  const geo = new THREE.OctahedronGeometry(0.14, 0);
  const particles: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }[] = [];

  for (let i = 0; i < MAX_DEBRIS; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.4 });
  }

  const flashLights: { light: THREE.PointLight; life: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const light = new THREE.PointLight(0xf97316, 0, 14);
    scene.add(light);
    flashLights.push({ light, life: 0 });
  }

  let cursor = 0;
  let lightCursor = 0;

  return {
    spawnBurst: (xPx, yPx, colorHex, count = 12, flashPower = 5) => {
      const wx = toWorldX(xPx);
      const wy = toWorldY(yPx);
      for (let i = 0; i < count; i++) {
        const p = particles[cursor];
        cursor = (cursor + 1) % MAX_DEBRIS;
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 8;
        p.mesh.position.set(wx, wy, (Math.random() - 0.5) * 0.6);
        p.mesh.scale.setScalar(0.6 + Math.random() * 1.1);
        p.mat.color.setHex(colorHex);
        p.mat.opacity = 1;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd + 2.5;
        p.vz = (Math.random() - 0.5) * 4;
        p.maxLife = 0.25 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.mesh.visible = true;
      }

      if (flashPower > 0) {
        const fl = flashLights[lightCursor];
        lightCursor = (lightCursor + 1) % flashLights.length;
        fl.light.position.set(wx, wy, 1.2);
        fl.light.color.setHex(colorHex);
        fl.light.intensity = flashPower;
        fl.life = 0.22;
      }
    },
    update: (deltaSec) => {
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life -= deltaSec;
        if (p.life <= 0) {
          p.mesh.visible = false;
          continue;
        }
        p.vy -= 14 * deltaSec;
        p.mesh.position.x += p.vx * deltaSec;
        p.mesh.position.y += p.vy * deltaSec;
        p.mesh.position.z += p.vz * deltaSec;
        p.mesh.rotation.x += 8 * deltaSec;
        p.mesh.rotation.y += 6 * deltaSec;
        p.mat.opacity = Math.max(0, p.life / p.maxLife);
      }

      for (const fl of flashLights) {
        if (fl.life <= 0) continue;
        fl.life -= deltaSec;
        if (fl.life <= 0) {
          fl.light.intensity = 0;
        } else {
          fl.light.intensity *= 0.85;
        }
      }
    },
    dispose: () => {
      particles.forEach((p) => {
        scene.remove(p.mesh);
        p.mat.dispose();
      });
      flashLights.forEach((fl) => scene.remove(fl.light));
      geo.dispose();
    },
  };
}
