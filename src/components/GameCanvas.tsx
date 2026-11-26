import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type {
  BiomeStageId,
  BossHudState,
  BossId,
  CityNpc,
  CounterDashWindowHud,
  DecorItem,
  DroneHudState,
  Enemy,
  FloatingDamage,
  GameSettings,
  HazardTripwire,
  MissionLogEntry,
  NearbyNpcPrompt,
  PlayerLoadout,
  PlayerState,
  Projectile,
  SpecialAbilityState,
  TerrainSegment,
  VehicleHudState,
  VillainCommEvent,
} from '../types';
import { computeLoadoutBonuses, getDroneModelById, getWeaponById } from '../config/armory';
import { resolveEffectiveWeather } from '../config/worlds';
import { getWeatherProfile } from '../config/weatherSystem';
import { createThreePipeline } from '../three/glContext';
import { createWorldTextureBundle } from '../three/textures';
import {
  buildHeroRig,
  createDashGhostPool,
  createOrbitalStrikeRig,
  toWorldX,
  toWorldY,
  updateHeroRig,
  type HeroRig,
} from '../three/hero3d';
import {
  buildSupportDrone3D,
  updateSupportDrone3D,
  type SupportDroneRig,
} from '../three/drone3d';
import { buildHypercar3D, updateHypercar3D } from '../three/hypercar3d';
import {
  buildCityNpc3D,
  updateCityNpc3D,
  type CityNpcMeshEntry,
} from '../three/cityNpcs3d';
import {
  buildEnemy3D,
  buildPrincessCage3D,
  createProjectilePool,
  updateEnemy3D,
  type EnemyMeshEntry,
} from '../three/enemies3d';
import {
  createBurstFxPool,
  createTerrainAndDecorRenderer,
  createWorldEnvironment,
  resolveSoloBiomeStage,
} from '../three/world3d';
import {
  playAegisShield,
  playBossRoar,
  playCoin,
  playDash,
  playEmpHit,
  playExplosion,
  playGunfire,
  playHurt,
  playHypercarEnter,
  playJump,
  playMinigun,
  playMissileLaunch,
  playNitroBoost,
  playNpcInteract,
  playOrbitalStrike,
  playParry,
  playPowerUp,
  playSlash,
  playThunderCrack,
  playTripwireAlarm,
  setBossAtmosphereAudio,
} from '../utils/audio';

type CombatAudioCue = 'slash' | 'shoot' | 'parry' | 'hurt' | 'explosion';
type GameAudioCue = CombatAudioCue | 'dash' | 'gold' | 'jump' | 'powerup';

function useGameAudio() {
  const [audioQueue, setAudioQueue] = useState<GameAudioCue[]>([]);

  const enqueueCue = useCallback((cue: GameAudioCue) => {
    setAudioQueue((prev) => [...prev, cue]);
  }, []);

  useEffect(() => {
    if (audioQueue.length === 0) return;

    audioQueue.forEach((cue) => {
      switch (cue) {
        case 'slash':
          playSlash();
          break;
        case 'shoot':
          playGunfire();
          break;
        case 'parry':
          playParry();
          break;
        case 'hurt':
          playHurt();
          break;
        case 'explosion':
          playExplosion();
          break;
        case 'dash':
          playDash();
          break;
        case 'gold':
          playCoin();
          break;
        case 'jump':
          playJump();
          break;
        case 'powerup':
          playPowerUp();
          break;
      }
    });

    setAudioQueue((prev) => prev.slice(audioQueue.length));
  }, [audioQueue]);

  const playCombatCue = useCallback((cue: CombatAudioCue) => enqueueCue(cue), [enqueueCue]);
  const playDashCue = useCallback(() => enqueueCue('dash'), [enqueueCue]);
  const playGoldPickupCue = useCallback(() => enqueueCue('gold'), [enqueueCue]);
  const playJumpCue = useCallback(() => enqueueCue('jump'), [enqueueCue]);
  const playPowerUpCue = useCallback(() => enqueueCue('powerup'), [enqueueCue]);

  return useMemo(
    () => ({
      playCombatCue,
      playDashCue,
      playGoldPickupCue,
      playJumpCue,
      playPowerUpCue,
    }),
    [playCombatCue, playDashCue, playGoldPickupCue, playJumpCue, playPowerUpCue]
  );
}

export type AbilityTriggerKind = 'dash' | 'aegis' | 'orbital';
export type ControlActionKind = AbilityTriggerKind | 'jump' | 'slash' | 'shoot' | 'vehicle' | 'interact';

export interface VirtualControlInput {
  left: boolean;
  right: boolean;
  shootHeld: boolean;
  slashHeld: boolean;
}

interface GameCanvasProps {
  characterClass: 'vanguard' | 'shadowblade' | 'spellweaver';
  loadout: PlayerLoadout;
  onPlayerStateUpdate: (player: PlayerState) => void;
  onAbilitiesUpdate?: (abilities: SpecialAbilityState) => void;
  onBossUpdate?: (boss: BossHudState | null) => void;
  onVillainComm?: (comm: VillainCommEvent | null) => void;
  onVehicleUpdate?: (vehicle: VehicleHudState) => void;
  onNearbyNpcChange?: (npc: NearbyNpcPrompt | null) => void;
  onDroneUpdate?: (drone: DroneHudState | null) => void;
  onMissionLog?: (
    message: string,
    category?: MissionLogEntry['category'],
    severity?: MissionLogEntry['severity']
  ) => void;
  onFloatingDamagesUpdate?: (damages: FloatingDamage[]) => void;
  onBiomeChange?: (biome: BiomeStageId) => void;
  onBossDefeated?: (bossId: BossId, milestoneMeters: number) => void;
  onEnemyKilled: (goldGained: number) => void;
  onVictory: () => void;
  onGameOver: () => void;
  abilityTriggerRef?: React.MutableRefObject<((kind: ControlActionKind) => void) | null>;
  virtualControlRef?: React.MutableRefObject<VirtualControlInput>;
  isPaused: boolean;
  settings: GameSettings;
  upgradeModifiers: {
    maxHpAdd: number;
    lifestealPercent: number;
    dashCooldownAdd: number;
    dmgAdd: number;
    shieldRegenRate: number;
    critRateAdd: number;
    doubleJumpsAdd: number;
  };
}

interface FloatingWorldDmg {
  id: string;
  wx: number;
  wy: number;
  amount: number;
  crit: boolean;
  label?: string;
  color: string;
  age: number;
}

const BOSS_BLUEPRINTS: Record<
  number,
  {
    bossId: BossId;
    name: string;
    title: string;
    hp: number;
    damage: number;
    armor: number;
    width: number;
    height: number;
    color: string;
  }
> = {
  400: {
    bossId: 'vex',
    name: 'General Vex',
    title: 'Cyber-Warlord · Rank I',
    hp: 920,
    damage: 26,
    armor: 0.18,
    width: 68,
    height: 112,
    color: '#22d3ee',
  },
  800: {
    bossId: 'ignis',
    name: 'Ignis Prime',
    title: 'Volcanic Juggernaut · Rank II',
    hp: 1380,
    damage: 32,
    armor: 0.24,
    width: 78,
    height: 126,
    color: '#f97316',
  },
  1200: {
    bossId: 'specter9',
    name: 'Specter-9',
    title: 'Void Assassin · Rank III',
    hp: 1680,
    damage: 36,
    armor: 0.22,
    width: 62,
    height: 108,
    color: '#c084fc',
  },
  2000: {
    bossId: 'malakor',
    name: 'Overlord Malakor',
    title: 'Apex Flying Mech-Titan · Final Boss',
    hp: 2650,
    damage: 44,
    armor: 0.3,
    width: 92,
    height: 142,
    color: '#ef4444',
  },
};

export default function GameCanvas({
  characterClass,
  loadout,
  onPlayerStateUpdate,
  onAbilitiesUpdate,
  onBossUpdate,
  onVillainComm,
  onVehicleUpdate,
  onNearbyNpcChange,
  onDroneUpdate,
  onMissionLog,
  onFloatingDamagesUpdate,
  onBiomeChange,
  onBossDefeated,
  onEnemyKilled,
  onVictory,
  onGameOver,
  abilityTriggerRef,
  virtualControlRef,
  isPaused,
  settings,
  upgradeModifiers,
}: GameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameAudio = useGameAudio();
  const audioRef = useRef(gameAudio);
  const isPausedRef = useRef(isPaused);
  const settingsRef = useRef(settings);
  const loadoutRef = useRef(loadout);
  const upgradeModifiersRef = useRef(upgradeModifiers);
  const virtualControlRefProp = useRef(virtualControlRef);
  virtualControlRefProp.current = virtualControlRef;

  const callbacksRef = useRef({
    onPlayerStateUpdate,
    onAbilitiesUpdate,
    onBossUpdate,
    onVillainComm,
    onVehicleUpdate,
    onNearbyNpcChange,
    onDroneUpdate,
    onMissionLog,
    onFloatingDamagesUpdate,
    onBiomeChange,
    onBossDefeated,
    onEnemyKilled,
    onVictory,
    onGameOver,
  });
  callbacksRef.current = {
    onPlayerStateUpdate,
    onAbilitiesUpdate,
    onBossUpdate,
    onVillainComm,
    onVehicleUpdate,
    onNearbyNpcChange,
    onDroneUpdate,
    onMissionLog,
    onFloatingDamagesUpdate,
    onBiomeChange,
    onBossDefeated,
    onEnemyKilled,
    onVictory,
    onGameOver,
  };

  useEffect(() => {
    audioRef.current = gameAudio;
  }, [gameAudio]);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    loadoutRef.current = loadout;
  }, [loadout]);
  useEffect(() => {
    upgradeModifiersRef.current = upgradeModifiers;
  }, [upgradeModifiers]);

  const keysRef = useRef<Record<string, boolean>>({});
  const queuedActionsRef = useRef<ControlActionKind[]>([]);

  useEffect(() => {
    if (abilityTriggerRef) {
      abilityTriggerRef.current = (kind: ControlActionKind) => {
        if (!queuedActionsRef.current.includes(kind)) {
          queuedActionsRef.current.push(kind);
        }
      };
    }
    return () => {
      if (abilityTriggerRef) abilityTriggerRef.current = null;
    };
  }, [abilityTriggerRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's'].includes(key)) {
        e.preventDefault();
      }
      keysRef.current[key] = true;
      keysRef.current[e.code.toLowerCase()] = true;

      if (key === 'q' || key === '1') {
        if (!queuedActionsRef.current.includes('dash')) queuedActionsRef.current.push('dash');
      }
      if (key === 'e' || key === '2') {
        if (!queuedActionsRef.current.includes('aegis')) queuedActionsRef.current.push('aegis');
      }
      if (key === 'r' || key === '3') {
        if (!queuedActionsRef.current.includes('orbital')) queuedActionsRef.current.push('orbital');
      }
      if (key === 'f' && !e.repeat) {
        if (!queuedActionsRef.current.includes('vehicle')) queuedActionsRef.current.push('vehicle');
      }
      if (key === 'g' && !e.repeat) {
        if (!queuedActionsRef.current.includes('interact')) queuedActionsRef.current.push('interact');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code.toLowerCase()] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      if (virtualControlRefProp.current?.current) {
        virtualControlRefProp.current.current.left = false;
        virtualControlRefProp.current.current.right = false;
        virtualControlRefProp.current.current.shootHeld = false;
        virtualControlRefProp.current.current.slashHeld = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Setup Three.js Scene, Camera & Pipeline
    const scene = new THREE.Scene();
    const width = Math.max(container.clientWidth || 1200, 320);
    const height = Math.max(container.clientHeight || 675, 180);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 160);
    camera.position.set(4, 3.8, 14.5);

    const pipeline = createThreePipeline(container, scene, camera, settingsRef.current.graphicsQuality);
    const textures = createWorldTextureBundle();
    const worldEnv = createWorldEnvironment(scene, textures, pipeline.isSoftwareGl);
    const terrainRenderer = createTerrainAndDecorRenderer(scene, textures);
    const burstPool = createBurstFxPool(scene);
    const projPool = createProjectilePool(scene);
    const dashGhosts = createDashGhostPool(scene);
    const orbitalRig = createOrbitalStrikeRig(scene);

    const initBonuses = computeLoadoutBonuses(loadoutRef.current);
    let lastQuality = settingsRef.current.graphicsQuality;
    let currentAppearanceKey = `${loadoutRef.current.operatorId}|${loadoutRef.current.weaponId}|${loadoutRef.current.gadgetIds.join(',')}`;
    let heroRig: HeroRig = buildHeroRig(
      {
        operatorId: loadoutRef.current.operatorId,
        weaponId: loadoutRef.current.weaponId,
        gadgetIds: loadoutRef.current.gadgetIds,
        hasDrone: false,
      },
      textures.shadowDecal
    );
    scene.add(heroRig.root);

    let currentDroneModel = initBonuses.activeDroneModel || 'drone_sentinel';
    let supportDroneRig: SupportDroneRig = buildSupportDrone3D(currentDroneModel);
    supportDroneRig.root.visible = initBonuses.droneSupport;
    scene.add(supportDroneRig.root);

    const hypercarRig = buildHypercar3D(textures.shadowDecal);
    scene.add(hypercarRig.root);

    const npcMeshes = new Map<string, CityNpcMeshEntry>();
    const enemyMeshes = new Map<string, EnemyMeshEntry>();
    let princessCageRig: ReturnType<typeof buildPrincessCage3D> | null = null;

    // ResizeObserver & WebGL context loss guard
    let contextLost = false;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const handleContextRestored = () => {
      contextLost = false;
    };
    pipeline.renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    pipeline.renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        pipeline.resize(rect.width, rect.height);
      }
    });
    resizeObserver.observe(container);

    // 2. Game Simulation State
    const initMaxHp =
      (characterClass === 'vanguard' ? 150 : characterClass === 'spellweaver' ? 120 : 105) +
      initBonuses.maxHealthAdd;
    const initMaxShield =
      (characterClass === 'vanguard' ? 50 : 25) + initBonuses.maxShieldAdd;

    const p: PlayerState = {
      x: 120,
      y: 440,
      vx: 0,
      vy: 0,
      width: 32,
      height: 48,
      grounded: false,
      facing: 'right',
      health: initMaxHp,
      maxHealth: initMaxHp,
      shield: initMaxShield,
      maxShield: initMaxShield,
      stamina: 100,
      gold: 0,
      distance: 0,
      doubleJumpsLeft: (characterClass === 'shadowblade' ? 2 : 1) + initBonuses.doubleJumpAdd,
      attackCooldown: 0,
      dashCooldown: 0,
      hitCooldown: 0,
      parryCooldown: 0,
      combo: 0,
      comboTimer: 0,
      actionState: 'IDLE',
      stateTimer: 0,
    };
    let lastAttackKind: 'SLASH' | 'SHOOT' = 'SLASH';

    const abilities: SpecialAbilityState = {
      dashCooldown: 0,
      dashMaxCooldown: 2.2,
      dashActiveTimer: 0,
      aegisCooldown: 0,
      aegisMaxCooldown: 9.0,
      aegisActiveTimer: 0,
      orbitalCooldown: 0,
      orbitalMaxCooldown: 16.0,
      orbitalChargeTimer: 0,
      orbitalBeamTimer: 0,
      counterDashBonusTimer: 0,
      counterDashDamageBonusPct: 45,
    };

    let terrain: TerrainSegment[] = [];
    let decor: DecorItem[] = [];
    let enemies: Enemy[] = [];
    let projectiles: Projectile[] = [];
    let tripwires: HazardTripwire[] = [];
    const cityNpcs: CityNpc[] = [];
    const worldDmgs: FloatingWorldDmg[] = [];
    const spawnedMilestones = new Set<number>();

    const car = {
      x: 365,
      y: 477,
      vx: 0,
      vy: 0,
      width: 118,
      height: 46,
      facing: 'right' as 'left' | 'right',
      grounded: true,
      occupied: false,
      nitro: 100,
      nitroActive: false,
      empLockoutTimer: 0,
      minigunCooldown: 0,
      missileCooldown: 0,
      missileMaxCooldown: 1.05,
      firingMinigunTimer: 0,
      wheelSpin: 0,
      pitch: 0,
      ramCooldown: 0,
    };

    const logCooldowns = new Map<string, number>();
    const pushMissionLog = (
      key: string,
      message: string,
      category: MissionLogEntry['category'] = 'world',
      severity: MissionLogEntry['severity'] = 'info',
      cooldownSec = 3.2
    ) => {
      const nowMs = performance.now();
      const prevMs = logCooldowns.get(key) ?? 0;
      if (nowMs - prevMs < cooldownSec * 1000) return;
      logCooldowns.set(key, nowMs);
      callbacksRef.current.onMissionLog?.(message, category, severity);
    };

    const VILLAIN_META: Record<BossId, { name: string; title: string; accent: string }> = {
      vex: { name: 'General Vex', title: 'Cyber-Warlord · Rank I', accent: '#22d3ee' },
      ignis: { name: 'Ignis Prime', title: 'Volcanic Juggernaut · Rank II', accent: '#f97316' },
      specter9: { name: 'Specter-9', title: 'Void Assassin · Rank III', accent: '#c084fc' },
      malakor: { name: 'Overlord Malakor', title: 'Apex Mech-Titan · Final Boss', accent: '#ef4444' },
    };

    const commCooldowns = new Map<string, number>();
    let activeCommClearTimer = 0;
    const emitVillainComm = (
      bossId: BossId,
      message: string,
      tone: VillainCommEvent['tone'],
      cooldownSec = 5.5
    ) => {
      const nowMs = performance.now();
      const prevMs = commCooldowns.get(`${bossId}_${tone}`) ?? 0;
      if (nowMs - prevMs < cooldownSec * 1000) return;
      commCooldowns.set(`${bossId}_${tone}`, nowMs);
      const meta = VILLAIN_META[bossId] || VILLAIN_META.malakor;
      activeCommClearTimer = 4.6;
      callbacksRef.current.onVillainComm?.({
        id: `vcomm_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
        bossId,
        bossName: meta.name,
        bossTitle: meta.title,
        accentColor: meta.accent,
        message,
        tone,
        timestamp: nowMs,
      });
    };

    let generatedUpToX = 0;
    let maxReachedX = 120;
    const droneSim = {
      x: 82,
      y: 396,
      vx: 0,
      vy: 0,
      fireTimer: 0,
      supportTimer: 0,
      fireFlashTimer: 0,
      supportPulseTimer: 0,
      lockedEnemy: null as Enemy | null,
      statusText: 'ONLINE',
    };
    let gameOverTriggered = false;
    let victoryPending = false;
    let slowMoTimer = 0;
    let hitStopTimer = 0;
    let cameraZoomTimer = 0;
    let shakeIntensity = 0;
    let shakeTimer = 0;
    let orbitalTargetX = 120;
    let lastBiomeReported: BiomeStageId = 'JUNGLE';
    let victoryTimer = 0;
    let hudSyncAcc = 0;
    let totalTimeSec = 0;
    let lastComboMilestone = 0;
    let lastDetectedEnemyId = '';
    let lastNearbyNpcId = '';
    let pursuitSpawnTimer = 5.0;
    let tripwireSpawnTimer = 9.0;
    let voidLightningTimer = 6.5;
    let voidTelegraphTimer = 0;
    let voidStrikeX = 0;
    let bossAtmospherePrev = false;
    let prevPlayerShield = p.shield;

    // Reusable vector for projecting damage numbers
    const tempVec3 = new THREE.Vector3();

    const triggerShake = (intensity: number, durationFrames: number) => {
      shakeIntensity = Math.max(shakeIntensity, intensity);
      shakeTimer = Math.max(shakeTimer, durationFrames / 60);
    };

    const pushDamageNum = (
      xPx: number,
      yPx: number,
      amount: number,
      crit: boolean,
      color = '#ffffff',
      label?: string
    ) => {
      worldDmgs.push({
        id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        wx: toWorldX(xPx + (Math.random() - 0.5) * 18),
        wy: toWorldY(yPx - 24),
        amount: Math.round(amount),
        crit,
        label,
        color,
        age: 0,
      });
      if (worldDmgs.length > 18) worldDmgs.shift();
    };

    const spawnSafePlazaNpcs = (baseX: number, hubIndex: number) => {
      const roles: Omit<CityNpc, 'id' | 'x' | 'y' | 'cooldownTimer'>[] = [
        {
          role: 'mechanic',
          name: 'Maya "Torque" Lin',
          title: 'Garage Mechanic · Chiron-X Bay',
          facing: 'left',
          accentColor: '#f59e0b',
          actionLabel: 'Repair Hull & Refill Nitro (+Garage)',
          dialogue: 'Chiron-X twin miniguns are hot. Let me patch your hull & top off your nitro!',
        },
        {
          role: 'racer',
          name: 'Kira "Apex" Vance',
          title: 'Cyberpunk Street Racer',
          facing: 'left',
          accentColor: '#22d3ee',
          actionLabel: 'Claim Street Bounty (+45 Gold & Nitro)',
          dialogue: 'Hit the elevated neon ramps at full boost—nobody outruns a tuned Chiron.',
        },
        {
          role: 'operator',
          name: 'Cmdr. Elena Voss',
          title: 'Tactical Sector Operator',
          facing: 'left',
          accentColor: '#c084fc',
          actionLabel: 'Sync Sector Intel (+30 Shield & +35 Gold)',
          dialogue: 'Hostile warlords hold the 400m checkpoints. Stay lethal out there, Operator.',
        },
      ];

      if (hubIndex === 0) {
        cityNpcs.push(
          { ...roles[0], id: `npc_mech_${hubIndex}`, x: baseX + 260, y: 468, cooldownTimer: 0 },
          { ...roles[1], id: `npc_racer_${hubIndex}`, x: baseX + 515, y: 468, cooldownTimer: 0 },
          { ...roles[2], id: `npc_op_${hubIndex}`, x: baseX + 740, y: 468, cooldownTimer: 0 }
        );
      } else {
        const picked = roles[hubIndex % roles.length];
        cityNpcs.push({
          ...picked,
          id: `npc_hub_${hubIndex}_${picked.role}`,
          x: baseX + 180,
          y: 468,
          cooldownTimer: 0,
        });
      }
    };

    // Initial Free-Roam Dystopian Safe Plaza + Garage Bay + Highway Intro Ramp
    terrain.push({ x: -240, y: 500, width: 1220, height: 140, color: '#0f172a', type: 'HIGHWAY' });
    terrain.push({ x: 980, y: 500, width: 220, height: 22, color: '#0f172a', type: 'RAMP', rampEndY: 382 });
    terrain.push({ x: 1200, y: 382, width: 320, height: 26, color: '#0f172a', type: 'HIGHWAY' });
    terrain.push({ x: 1520, y: 382, width: 210, height: 22, color: '#0f172a', type: 'RAMP', rampEndY: 500 });
    terrain.push({ x: 980, y: 500, width: 750, height: 140, color: '#1e293b', type: 'GROUND' });

    decor.push(
      { x: 320, y: 380, type: 'GARAGE_BAY', width: 140, height: 120 },
      { x: 140, y: 360, type: 'BILLBOARD', width: 120, height: 140, variant: 0 },
      { x: 560, y: 360, type: 'BILLBOARD', width: 120, height: 140, variant: 1 },
      { x: 860, y: 360, type: 'BILLBOARD', width: 120, height: 140, variant: 2 },
      { x: 430, y: 375, type: 'NEON_LAMP', width: 36, height: 125 },
      { x: 780, y: 375, type: 'NEON_LAMP', width: 36, height: 125 },
      { x: 1280, y: 260, type: 'NEON_LAMP', width: 36, height: 122 }
    );
    spawnSafePlazaNpcs(0, 0);
    generatedUpToX = 1730;
    pushMissionLog('deploy', 'Safe Plaza Online · Chiron-X Hypercar Ready [F]', 'world', 'success', 0);

    const spawnMilestoneBoss = (milestone: number, spawnX: number) => {
      if (spawnedMilestones.has(milestone)) return;
      spawnedMilestones.add(milestone);

      const bp = BOSS_BLUEPRINTS[milestone];
      if (!bp) return;

      // Clear flat arena platform for epic boss showdown
      terrain.push({
        x: spawnX - 420,
        y: 500,
        width: 1180,
        height: 150,
        color: '#1e293b',
        type: 'GROUND',
      });
      generatedUpToX = Math.max(generatedUpToX, spawnX + 760);

      enemies.push({
        id: `boss_${bp.bossId}_${milestone}`,
        type: 'BOSS',
        bossId: bp.bossId,
        bossTitle: bp.title,
        milestoneMeters: milestone,
        name: bp.name,
        x: spawnX + 260,
        y: bp.bossId === 'malakor' ? 350 : 410,
        vx: 0,
        vy: 0,
        width: bp.width,
        height: bp.height,
        maxHealth: bp.hp,
        health: bp.hp,
        damage: bp.damage,
        facing: 'left',
        behavior: 'PATROL',
        behaviorTimer: 0,
        attackCooldown: 60,
        specialCooldown: 120,
        isStunned: false,
        stunDuration: 0,
        armorFactor: bp.armor,
        dodgeCooldown: 90,
        blockTimer: 0,
        blockCooldown: 180,
        leapCooldown: 110,
        comboStep: 0,
        comboTimer: 0,
        unblockableTimer: 0,
        minionCooldown: 240,
        hazardCooldown: 150,
        phase: 1,
        rageMode: false,
        color: bp.color,
        scoreValue: milestone === 2000 ? 500 : 120,
      });

      if (milestone === 2000) {
        decor.push({
          x: spawnX + 430,
          y: 416,
          type: 'PRINCESS_CAGE',
          width: 72,
          height: 84,
        });
      }

      playBossRoar();
      cameraZoomTimer = 1.65;
      triggerShake(0.32, 22);
      pushMissionLog(`boss_init_${milestone}`, `Boss Phase Initiated: ${bp.name}`, 'boss', 'crit', 5);
      const introQuotes: Record<BossId, string> = {
        vex: 'SECTOR LOCKDOWN INITIATED. YOUR CHIRON WON’T SAVE YOU.',
        ignis: 'THE STREETS WILL MELT BENEATH MY BOOTS, OPERATOR!',
        specter9: 'ALL BILLBOARDS HIJACKED. NOWHERE LEFT TO HIDE.',
        malakor: 'FINAL PROTOCOL: CRUSH THE HERO AND CLAIM THE CITY!',
      };
      emitVillainComm(bp.bossId, introQuotes[bp.bossId], 'ambush', 1);
    };

    let nextPlazaX = 3200;
    let plazaCounter = 1;

    const generateTerrainChunk = (startX: number) => {
      // Check if we're near boss milestone (400m = 6400px, 800m = 12800px, 1200m = 19200px, 2000m = 32000px)
      const distAtStart = startX / 16;
      const upcomingMilestone = [400, 800, 1200, 2000].find(
        (m) => distAtStart >= m - 18 && !spawnedMilestones.has(m)
      );
      if (upcomingMilestone) {
        spawnMilestoneBoss(upcomingMilestone, upcomingMilestone * 16 + 180);
        return;
      }

      // Periodic Dystopian Safe Plaza & Female Ally Outposts
      if (startX >= nextPlazaX) {
        const plazaW = 540;
        terrain.push({ x: startX, y: 500, width: plazaW, height: 140, color: '#0f172a', type: 'HIGHWAY' });
        decor.push(
          { x: startX + 120, y: 360, type: 'BILLBOARD', width: 120, height: 140, variant: plazaCounter },
          { x: startX + 340, y: 375, type: 'NEON_LAMP', width: 36, height: 125 }
        );
        spawnSafePlazaNpcs(startX, plazaCounter);
        plazaCounter++;
        nextPlazaX = startX + 2900;
        generatedUpToX = startX + plazaW;
        return;
      }

      const distMeters = startX / 16;
      const difficulty = 1 + distMeters * 0.0012;
      const chunkW = 340 + Math.random() * 260;

      const hasGap = Math.random() < 0.22;
      if (hasGap) {
        const gapW = 105 + Math.random() * 65;
        terrain.push({
          x: startX,
          y: 558,
          width: gapW,
          height: 80,
          color: '#ea580c',
          type: 'LAVA',
        });
        terrain.push({
          x: startX + gapW * 0.12,
          y: 412,
          width: Math.max(96, gapW * 0.78),
          height: 22,
          color: '#334155',
          type: 'PLATFORM',
        });
        startX += gapW;
      }

      const isHighway = Math.random() < 0.65;
      terrain.push({
        x: startX,
        y: 500,
        width: chunkW,
        height: 140,
        color: isHighway ? '#0f172a' : '#1e293b',
        type: isHighway ? 'HIGHWAY' : 'GROUND',
      });

      // Multi-Level Drivable Highway Overpass & Sloped Ramps
      if (chunkW > 410 && Math.random() < 0.42) {
        const rampW = 140;
        const deckW = 175;
        const deckY = 384;
        terrain.push({
          x: startX + 30,
          y: 500,
          width: rampW,
          height: 22,
          color: '#0f172a',
          type: 'RAMP',
          rampEndY: deckY,
        });
        terrain.push({
          x: startX + 30 + rampW,
          y: deckY,
          width: deckW,
          height: 24,
          color: '#0f172a',
          type: 'HIGHWAY',
        });
        decor.push({
          x: startX + 30 + rampW + deckW * 0.45,
          y: deckY - 36,
          type: 'GOLD_COIN',
          width: 24,
          height: 24,
        });
      } else if (Math.random() < 0.5) {
        const platY = 360 + Math.random() * 50;
        const platW = 120 + Math.random() * 110;
        terrain.push({
          x: startX + chunkW * 0.25,
          y: platY,
          width: platW,
          height: 22,
          color: '#334155',
          type: 'PLATFORM',
        });
        if (Math.random() < 0.7) {
          decor.push({
            x: startX + chunkW * 0.35,
            y: platY - 32,
            type: 'GOLD_COIN',
            width: 24,
            height: 24,
          });
        }
      }

      if (Math.random() < 0.25) {
        decor.push({
          x: startX + chunkW * 0.48,
          y: 360,
          type: 'BILLBOARD',
          width: 120,
          height: 140,
          variant: Math.floor(startX / 200),
        });
      }
      if (Math.random() < 0.55) {
        decor.push({
          x: startX + 45,
          y: 375,
          type: 'NEON_LAMP',
          width: 36,
          height: 125,
        });
      }

      if (Math.random() < 0.25) {
        terrain.push({
          x: startX + 35,
          y: 486,
          width: 44,
          height: 14,
          color: '#10b981',
          type: 'SPRING',
        });
      }

      if (Math.random() < 0.32) {
        terrain.push({
          x: startX + chunkW * 0.55,
          y: 482,
          width: 66,
          height: 18,
          color: '#a1a1aa',
          type: 'SPIKES',
        });
      }

      // Scenery & Waterfalls
      if (Math.random() < 0.75) {
        decor.push({
          x: startX + 30 + Math.random() * (chunkW - 80),
          y: 410,
          type: Math.random() < 0.5 ? 'TREE' : 'RUINS',
          width: 48,
          height: 90,
        });
      }
      if (Math.random() < 0.3) {
        decor.push({
          x: startX + chunkW * 0.4,
          y: 350,
          type: 'WATERFALL',
          width: 82,
          height: 170,
        });
      }
      if (Math.random() < 0.6) {
        decor.push({
          x: startX + 40,
          y: 465,
          type: 'GOLD_COIN',
          width: 24,
          height: 24,
        });
      }
      if (Math.random() < 0.22) {
        decor.push({
          x: startX + chunkW * 0.6,
          y: 465,
          type: Math.random() < 0.5 ? 'POTION' : 'CHEST',
          width: 28,
          height: 28,
        });
      }

      // Spawn enemies scaled with distance
      if (Math.random() < 0.85) {
        const count = Math.random() < 0.35 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const ex = startX + 80 + i * 95;
          const r = Math.random();
          if (r < 0.32) {
            enemies.push({
              id: `e_${ex}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'SCOUT',
              name: 'Cyber-Stalker',
              x: ex,
              y: 455,
              vx: 0,
              vy: 0,
              width: 34,
              height: 44,
              maxHealth: Math.round(58 * difficulty),
              health: Math.round(58 * difficulty),
              damage: Math.round(15 * difficulty),
              facing: 'left',
              behavior: 'PATROL',
              behaviorTimer: 0,
              attackCooldown: 0,
              dodgeCooldown: 40,
              leapCooldown: 70,
              isStunned: false,
              stunDuration: 0,
              color: '#ef4444',
              scoreValue: 15,
            });
          } else if (r < 0.62) {
            enemies.push({
              id: `e_${ex}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'ARCHER',
              name: 'Rail-Sniper',
              x: ex,
              y: 450,
              vx: 0,
              vy: 0,
              width: 32,
              height: 48,
              maxHealth: Math.round(48 * difficulty),
              health: Math.round(48 * difficulty),
              damage: Math.round(17 * difficulty),
              facing: 'left',
              behavior: 'PATROL',
              behaviorTimer: 0,
              attackCooldown: 35,
              dodgeCooldown: 55,
              leapCooldown: 90,
              isStunned: false,
              stunDuration: 0,
              color: '#a855f7',
              scoreValue: 18,
            });
          } else if (r < 0.84) {
            enemies.push({
              id: `e_${ex}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'HARPY',
              name: 'Bio-Drone',
              x: ex,
              y: 340,
              vx: 0,
              vy: 0,
              width: 36,
              height: 36,
              maxHealth: Math.round(45 * difficulty),
              health: Math.round(45 * difficulty),
              damage: Math.round(15 * difficulty),
              facing: 'left',
              behavior: 'FLIGHT',
              behaviorTimer: 0,
              attackCooldown: 45,
              dodgeCooldown: 60,
              isStunned: false,
              stunDuration: 0,
              color: '#22d3ee',
              scoreValue: 20,
            });
          } else {
            enemies.push({
              id: `e_${ex}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'HEAVY',
              name: 'Shield Juggernaut',
              x: ex,
              y: 440,
              vx: 0,
              vy: 0,
              width: 46,
              height: 60,
              maxHealth: Math.round(122 * difficulty),
              health: Math.round(122 * difficulty),
              damage: Math.round(24 * difficulty),
              facing: 'left',
              behavior: 'PATROL',
              behaviorTimer: 0,
              attackCooldown: 30,
              armorFactor: 0.16,
              blockTimer: 75,
              blockCooldown: 140,
              leapCooldown: 110,
              isStunned: false,
              stunDuration: 0,
              shieldChance: 0.6,
              shieldActive: true,
              color: '#f59e0b',
              scoreValue: 30,
            });
          }
        }
      }

      generatedUpToX = startX + chunkW;
    };

    while (generatedUpToX < 2400) {
      generateTerrainChunk(generatedUpToX);
    }

    let mouseShootDown = false;
    let mouseSlashDown = false;
    let shootTrigger = false;
    let slashTrigger = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (isPausedRef.current) return;
      if (e.button === 0) {
        mouseShootDown = true;
        shootTrigger = true;
      } else if (e.button === 2) {
        e.preventDefault();
        mouseSlashDown = true;
        slashTrigger = true;
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseShootDown = false;
      if (e.button === 2) mouseSlashDown = false;
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleMouseWindowBlur = () => {
      mouseShootDown = false;
      mouseSlashDown = false;
    };
    pipeline.renderer.domElement.addEventListener('mousedown', handleMouseDown);
    pipeline.renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleMouseWindowBlur);

    const applyDamageToEnemy = (
      e: Enemy,
      rawDmg: number,
      isCrit: boolean,
      fromLifesteal = true,
      sourceKind: 'SLASH' | 'SHOOT' | 'ULTIMATE' | 'DASH' = 'SLASH'
    ) => {
      let finalDmg = rawDmg;
      const attackerInFront =
        (e.facing === 'right' && p.x >= e.x - 16) || (e.facing === 'left' && p.x <= e.x + 16);

      // Evasive shot dodge by agile foes & bosses against predictable gunfire
      if (
        sourceKind === 'SHOOT' &&
        !e.isStunned &&
        (e.dodgeCooldown ?? 0) <= 0 &&
        (e.type === 'SCOUT' || e.type === 'ARCHER' || e.type === 'HARPY' || e.type === 'BOSS') &&
        Math.random() < (e.type === 'BOSS' ? 0.34 : 0.42)
      ) {
        e.dodgeCooldown = e.type === 'BOSS' ? 135 : 105;
        if (e.bossId !== 'malakor' && e.type !== 'HARPY') {
          e.vy = -8.2;
        }
        e.vx += p.x < e.x ? 5.2 : -5.2;
        pushDamageNum(e.x, e.y - 24, 0, false, '#cbd5e1', 'EVADED!');
        burstPool.spawnBurst(e.x, e.y, 0x94a3b8, 6, 3);
        return;
      }

      // Frontal Energy Shield blocking/parrying
      const activeBarrier = (e.blockTimer ?? 0) > 0;
      const heavyBlock =
        e.type === 'HEAVY' && e.shieldChance && Math.random() < e.shieldChance;

      const counterActive = abilities.counterDashBonusTimer > 0;
      const counterMult = counterActive ? 1 + abilities.counterDashDamageBonusPct / 100 : 1;

      if (
        !e.isStunned &&
        sourceKind !== 'ULTIMATE' &&
        sourceKind !== 'DASH' &&
        attackerInFront &&
        (activeBarrier || heavyBlock)
      ) {
        finalDmg = finalDmg * 0.22 * counterMult;
        audioRef.current.playCombatCue('parry');
        burstPool.spawnBurst(e.x + (e.facing === 'right' ? 24 : -24), e.y, 0x38bdf8, 8, 3);
        pushDamageNum(e.x, e.y - 16, finalDmg, false, '#67e8f9', 'SHIELDED!');
      } else if (e.isStunned) {
        finalDmg = finalDmg * 1.45 * counterMult; // Parry / Dash stun + Counter-Dash bonus
        pushDamageNum(
          e.x,
          e.y - 14,
          finalDmg,
          true,
          counterActive ? '#facc15' : '#38bdf8',
          counterActive ? 'COUNTER BREAK +45%!' : 'ARMOR BREAK!'
        );
      } else {
        if (e.armorFactor && sourceKind !== 'ULTIMATE') {
          finalDmg *= 1 - e.armorFactor;
        }
        if (droneSim.lockedEnemy && droneSim.lockedEnemy.id === e.id) {
          const curB = computeLoadoutBonuses(loadoutRef.current);
          if (curB.droneScanBonus > 0) {
            finalDmg *= 1 + curB.droneScanBonus;
          }
        }
        finalDmg *= counterMult;
        pushDamageNum(
          e.x,
          e.y,
          finalDmg,
          isCrit || counterActive,
          isCrit ? '#facc15' : counterActive ? '#22d3ee' : '#ffffff',
          counterActive ? (isCrit ? 'COUNTER CRIT!' : 'COUNTER +45%!') : isCrit ? 'CRIT!' : undefined
        );
      }

      e.health -= finalDmg;
      burstPool.spawnBurst(e.x, e.y, isCrit ? 0xfacc15 : 0xef4444, isCrit ? 14 : 8, isCrit ? 6 : 2);
      if (isCrit) {
        hitStopTimer = 0.045;
      }

      if (fromLifesteal) {
        const curBonuses = computeLoadoutBonuses(loadoutRef.current);
        const totalLifesteal =
          upgradeModifiersRef.current.lifestealPercent + curBonuses.lifestealPercent;
        if (totalLifesteal > 0) {
          p.health = Math.min(p.maxHealth, p.health + finalDmg * totalLifesteal);
        }
      }

      p.combo++;
      p.comboTimer = 180;
      if (p.combo >= 5 && p.combo % 5 === 0 && p.combo !== lastComboMilestone) {
        lastComboMilestone = p.combo;
        pushMissionLog(`combo_${p.combo}`, `Combo x${p.combo} Streak!`, 'combat', p.combo >= 15 ? 'crit' : 'success', 1.2);
      }
    };

    const getBossCounterDashState = (e: Enemy): CounterDashWindowHud | null => {
      if (e.type !== 'BOSS' || e.isStunned) return null;
      const w = e.finisherWindupTimer ?? 0;
      const hits = e.finisherRushHitsLeft ?? 0;
      if (w <= 0 && hits <= 0) return null;
      const totalW = e.finisherTotalWindup || 50;
      const windowStart = 0.42;
      const windowEnd = 0.96;
      if (w > 0) {
        const frac = Math.max(0, Math.min(1, 1 - w / totalW));
        const progress = frac * 0.72;
        return {
          phase: progress >= windowStart ? 'PERFECT' : 'CHARGING',
          progress,
          windowStart,
          windowEnd,
          bonusPct: abilities.counterDashDamageBonusPct,
          rushHitsLeft: hits,
        };
      }
      const dist = Math.abs(e.x - p.x);
      const base = hits >= 2 ? 0.78 : 0.9;
      const prox = Math.max(0, Math.min(1, 1 - dist / 340)) * 0.08;
      const progress = Math.min(0.98, base + prox);
      return {
        phase: dist < 340 ? 'PERFECT' : 'CHARGING',
        progress,
        windowStart,
        windowEnd,
        bonusPct: abilities.counterDashDamageBonusPct,
        rushHitsLeft: hits,
      };
    };

    const triggerPerfectCounterDash = (bossTarget?: Enemy) => {
      abilities.counterDashBonusTimer = 6.0;
      abilities.dashCooldown = Math.min(abilities.dashCooldown, 0.65);
      p.stamina = Math.min(100, p.stamina + 22);
      p.hitCooldown = Math.max(p.hitCooldown, 28);
      slowMoTimer = Math.max(slowMoTimer, 0.24);
      triggerShake(0.28, 12);
      burstPool.spawnBurst(p.x, p.y, 0x22d3ee, 22, 8);
      burstPool.spawnBurst(p.x, p.y - 14, 0xfacc15, 14, 6);
      pushDamageNum(
        p.x,
        p.y - 36,
        0,
        true,
        '#22d3ee',
        `COUNTER-DASH! +${abilities.counterDashDamageBonusPct}% DMG`
      );
      audioRef.current.playPowerUpCue();
      pushMissionLog(
        'counter_dash',
        `PERFECT COUNTER-DASH! +${abilities.counterDashDamageBonusPct}% DMG Bonus (6.0s)`,
        'combat',
        'success',
        1.5
      );
      if (bossTarget) {
        bossTarget.finisherWindupTimer = 0;
        bossTarget.finisherRushHitsLeft = 0;
        bossTarget.isStunned = true;
        bossTarget.stunDuration = 34;
        bossTarget.blockTimer = 0;
        bossTarget.shieldActive = false;
        burstPool.spawnBurst(bossTarget.x, bossTarget.y, 0x38bdf8, 16, 6);
      }
    };

    let lastClockTime = performance.now();
    let animHandle = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const rawDelta = Math.min(0.05, Math.max(0.004, (now - lastClockTime) / 1000));
      lastClockTime = now;

      if (!contextLost && !isPausedRef.current) {
        // Time scaling for slow-motion boss defeats & hit-stop frames
        if (hitStopTimer > 0) {
          hitStopTimer = Math.max(0, hitStopTimer - rawDelta);
        }
        const timeScale =
          hitStopTimer > 0 ? 0.12 : slowMoTimer > 0 ? 0.28 : 1.0;
        if (slowMoTimer > 0) slowMoTimer = Math.max(0, slowMoTimer - rawDelta);

        const dt = rawDelta * timeScale;
        const frames = dt * 60;
        totalTimeSec += dt;

        const curSettings = settingsRef.current;
        const activeWeatherId = resolveEffectiveWeather(curSettings.world, curSettings.weather);
        const wxMod = getWeatherProfile(activeWeatherId);
        if (curSettings.graphicsQuality !== lastQuality) {
          lastQuality = curSettings.graphicsQuality;
          pipeline.setQuality(lastQuality);
        }
        const curLoadout = loadoutRef.current;
        const curBonuses = computeLoadoutBonuses(curLoadout);
        const mods = upgradeModifiersRef.current;

        if (activeCommClearTimer > 0) {
          activeCommClearTimer = Math.max(0, activeCommClearTimer - rawDelta);
          if (activeCommClearTimer <= 0) {
            callbacksRef.current.onVillainComm?.(null);
          }
        }

        // Live swap hero 3D mesh or Tactical Support Drone if loadout changed
        const nextAppearanceKey = `${curLoadout.operatorId}|${curLoadout.weaponId}|${curLoadout.gadgetIds.join(',')}`;
        if (nextAppearanceKey !== currentAppearanceKey) {
          currentAppearanceKey = nextAppearanceKey;
          scene.remove(heroRig.root);
          heroRig.dispose();
          heroRig = buildHeroRig(
            {
              operatorId: curLoadout.operatorId,
              weaponId: curLoadout.weaponId,
              gadgetIds: curLoadout.gadgetIds,
              hasDrone: false,
            },
            textures.shadowDecal
          );
          scene.add(heroRig.root);
        }

        const nextDroneModel = curBonuses.activeDroneModel || 'drone_sentinel';
        if (nextDroneModel !== currentDroneModel) {
          currentDroneModel = nextDroneModel;
          scene.remove(supportDroneRig.root);
          supportDroneRig.dispose();
          supportDroneRig = buildSupportDrone3D(currentDroneModel);
          scene.add(supportDroneRig.root);
        }
        supportDroneRig.root.visible = curBonuses.droneSupport;

        // Keep maxHP / maxShield synced
        const baseMaxHp =
          characterClass === 'vanguard' ? 150 : characterClass === 'spellweaver' ? 120 : 105;
        const baseMaxShield = characterClass === 'vanguard' ? 50 : 25;
        p.maxHealth = Math.max(60, baseMaxHp + mods.maxHpAdd + curBonuses.maxHealthAdd);
        p.maxShield = Math.max(0, baseMaxShield + curBonuses.maxShieldAdd);
        if (p.health > p.maxHealth) p.health = p.maxHealth;

        // Ability Cooldowns
        abilities.dashCooldown = Math.max(0, abilities.dashCooldown - rawDelta);
        abilities.dashActiveTimer = Math.max(0, abilities.dashActiveTimer - dt);
        abilities.aegisCooldown = Math.max(0, abilities.aegisCooldown - rawDelta);
        abilities.aegisActiveTimer = Math.max(0, abilities.aegisActiveTimer - dt);
        abilities.orbitalCooldown = Math.max(0, abilities.orbitalCooldown - rawDelta);
        abilities.counterDashBonusTimer = Math.max(0, abilities.counterDashBonusTimer - dt);

        // Orbital Rail-Strike Execution
        if (abilities.orbitalChargeTimer > 0) {
          abilities.orbitalChargeTimer -= dt;
          if (abilities.orbitalChargeTimer <= 0) {
            abilities.orbitalBeamTimer = 0.85;
            playOrbitalStrike();
            triggerShake(0.65, 36);
            burstPool.spawnBurst(orbitalTargetX, 460, 0x38bdf8, 32, 12);

            const orbitalDmg =
              (155 + mods.dmgAdd * 2.2 + curBonuses.attackPowerAdd * 2.5) * wxMod.playerDamageMult;
            enemies.forEach((e) => {
              if (Math.abs(e.x - orbitalTargetX) < 195) {
                applyDamageToEnemy(e, orbitalDmg, true, false, 'ULTIMATE');
              }
            });
          }
        }
        if (abilities.orbitalBeamTimer > 0) {
          abilities.orbitalBeamTimer = Math.max(0, abilities.orbitalBeamTimer - dt);
        }

        // Handle Triggered Special Abilities & HUD Button Actions
        const queued = queuedActionsRef.current.splice(0, queuedActionsRef.current.length);
        let virtualJump = false;
        let triggerVehicleToggle = false;
        let triggerNpcInteract = false;
        for (const action of queued) {
          if (action === 'vehicle') {
            triggerVehicleToggle = true;
          } else if (action === 'interact') {
            triggerNpcInteract = true;
          } else if (
            action === 'dash' &&
            !car.occupied &&
            abilities.dashCooldown <= 0 &&
            !victoryPending &&
            !gameOverTriggered
          ) {
            const counterBoss = enemies.find(
              (en) =>
                en.type === 'BOSS' &&
                Math.abs(en.x - p.x) < 920 &&
                getBossCounterDashState(en)?.phase === 'PERFECT'
            );
            abilities.dashCooldown = counterBoss
              ? 0.65
              : Math.max(
                  1.0,
                  abilities.dashMaxCooldown - curBonuses.dashCooldownReduction * 0.08 - mods.dashCooldownAdd * 0.05
                );
            abilities.dashActiveTimer = 0.24;
            p.actionState = 'DASHING';
            p.stateTimer = 14;
            p.stamina = Math.max(0, p.stamina - 14 * wxMod.staminaDrainMult);
            const dashPow =
              (18 + (characterClass === 'shadowblade' ? 3 : 0) + curBonuses.moveSpeedAdd) *
              wxMod.speedMult;
            p.vx = p.facing === 'right' ? dashPow : -dashPow;
            p.vy = 0;
            audioRef.current.playDashCue();
            dashGhosts.spawn(p.x, p.y, p.facing, counterBoss ? 0xfacc15 : 0x22d3ee);
            if (counterBoss) {
              triggerPerfectCounterDash(counterBoss);
            }
          } else if (action === 'aegis' && abilities.aegisCooldown <= 0 && !victoryPending) {
            abilities.aegisCooldown = abilities.aegisMaxCooldown;
            abilities.aegisActiveTimer = 3.8;
            playAegisShield();
            burstPool.spawnBurst(p.x, p.y, 0x22d3ee, 16, 5);
            pushMissionLog('aegis', 'Aegis Overload Shield Active', 'combat', 'info', 2);
          } else if (action === 'orbital' && abilities.orbitalCooldown <= 0 && !victoryPending) {
            abilities.orbitalCooldown = abilities.orbitalMaxCooldown;
            abilities.orbitalChargeTimer = 0.42;
            orbitalTargetX = p.x + (p.facing === 'right' ? 140 : -140);
            const lockOn = enemies.find((e) => Math.abs(e.x - p.x) < 340);
            if (lockOn) orbitalTargetX = lockOn.x;
            cameraZoomTimer = 1.1;
            audioRef.current.playPowerUpCue();
            pushMissionLog('orbital', 'Orbital Rail-Strike Locked', 'combat', 'warn', 2);
          } else if (action === 'jump') {
            virtualJump = true;
          } else if (action === 'slash') {
            slashTrigger = true;
          } else if (action === 'shoot') {
            shootTrigger = true;
          }
        }

        // Toggle Enter / Exit / Air-Drop Hypercar ([F] or Drive button)
        if (triggerVehicleToggle && !victoryPending && !gameOverTriggered) {
          if (car.occupied) {
            car.occupied = false;
            car.nitroActive = false;
            p.x = car.x;
            p.y = car.y - 34;
            p.vy = -6.5;
            p.vx = car.vx * 0.35;
            playHypercarEnter();
            pushMissionLog('veh_exit', 'Exited Chiron-X Hypercar', 'vehicle', 'info', 1.2);
          } else if (Math.abs(p.x - car.x) < 165) {
            car.occupied = true;
            p.actionState = 'IDLE';
            playHypercarEnter();
            burstPool.spawnBurst(car.x, car.y, 0x22d3ee, 14, 5);
            pushMissionLog('veh_enter', 'Hypercar Engaged · Miniguns & Missiles Online', 'vehicle', 'success', 1.2);
          } else {
            // Recall / Air-Drop Chiron-X Hypercar right beside player & enter!
            car.x = p.x + (p.facing === 'right' ? 28 : -28);
            car.y = p.y - 12;
            car.vx = 0;
            car.vy = 0;
            car.facing = p.facing;
            car.occupied = true;
            playHypercarEnter();
            burstPool.spawnBurst(car.x, car.y, 0x22d3ee, 22, 8);
            pushMissionLog('veh_recall', 'Chiron-X Hypercar Deployed to Sector', 'vehicle', 'success', 1.5);
          }
        }

        // Update NPC cooldowns & handle NPC Ally Interaction ([G] or HUD button)
        for (const npc of cityNpcs) {
          if (npc.cooldownTimer > 0) npc.cooldownTimer = Math.max(0, npc.cooldownTimer - rawDelta);
        }
        const nearbyNpc = cityNpcs.find((n) => Math.abs(n.x - p.x) < 130) || null;
        if (nearbyNpc && nearbyNpc.id !== lastNearbyNpcId) {
          lastNearbyNpcId = nearbyNpc.id;
          pushMissionLog(`npc_near_${nearbyNpc.id}`, `Ally Nearby: ${nearbyNpc.name}`, 'ally', 'info', 6);
        } else if (!nearbyNpc) {
          lastNearbyNpcId = '';
        }

        if (triggerNpcInteract && nearbyNpc && nearbyNpc.cooldownTimer <= 0 && !victoryPending) {
          nearbyNpc.cooldownTimer = 14;
          playNpcInteract();
          burstPool.spawnBurst(nearbyNpc.x, nearbyNpc.y - 20, 0x22d3ee, 14, 5);
          if (nearbyNpc.role === 'mechanic') {
            p.health = Math.min(p.maxHealth, p.health + 50);
            p.shield = Math.min(p.maxShield, p.shield + 35);
            car.nitro = 100;
            pushDamageNum(p.x, p.y - 24, 50, true, '#f59e0b', '+50 HP & NITRO!');
            pushMissionLog('npc_mech', 'Maya Lin: Hull Repaired +50 HP & Nitro 100%', 'ally', 'success', 1);
          } else if (nearbyNpc.role === 'racer') {
            p.gold += 45;
            car.nitro = 100;
            callbacksRef.current.onEnemyKilled(45);
            pushDamageNum(p.x, p.y - 24, 45, true, '#22d3ee', '+45 GOLD!');
            pushMissionLog('npc_racer', 'Kira Vance: Street Bounty +45 Gold & Nitro Refill', 'ally', 'success', 1);
          } else {
            p.gold += 35;
            p.shield = Math.min(p.maxShield, p.shield + 30);
            callbacksRef.current.onEnemyKilled(35);
            pushDamageNum(p.x, p.y - 24, 30, true, '#c084fc', '+30 SHIELD!');
            pushMissionLog('npc_op', 'Cmdr. Voss: Sector Intel +30 Shield & +35 Gold', 'ally', 'success', 1);
          }
        }

        // Standard movement & combat inputs (On Foot OR Inside Bugatti Hypercar)
        if (!gameOverTriggered && !victoryPending) {
          if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - frames);
          if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - frames);
          if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - frames);
          if (p.parryCooldown > 0) p.parryCooldown = Math.max(0, p.parryCooldown - frames);
          if (p.comboTimer > 0) {
            p.comboTimer -= frames;
            if (p.comboTimer <= 0) {
              p.combo = 0;
              lastComboMilestone = 0;
            }
          }
          if (p.stateTimer > 0) {
            p.stateTimer = Math.max(0, p.stateTimer - frames);
            if (p.stateTimer <= 0) p.actionState = 'IDLE';
          }

          if (car.empLockoutTimer > 0) car.empLockoutTimer = Math.max(0, car.empLockoutTimer - dt);
          if (car.minigunCooldown > 0) car.minigunCooldown = Math.max(0, car.minigunCooldown - frames);
          if (car.missileCooldown > 0) car.missileCooldown = Math.max(0, car.missileCooldown - dt);
          if (car.firingMinigunTimer > 0) car.firingMinigunTimer = Math.max(0, car.firingMinigunTimer - rawDelta);
          if (car.ramCooldown > 0) car.ramCooldown = Math.max(0, car.ramCooldown - frames);

          const vCtrl = virtualControlRefProp.current?.current;
          const isW =
            virtualJump ||
            keysRef.current['w'] ||
            keysRef.current['space'] ||
            keysRef.current['arrowup'];
          const isS = keysRef.current['s'] || keysRef.current['arrowdown'] || keysRef.current['l'];
          const isA = Boolean(vCtrl?.left) || keysRef.current['a'] || keysRef.current['arrowleft'];
          const isD = Boolean(vCtrl?.right) || keysRef.current['d'] || keysRef.current['arrowright'];
          const isShift = keysRef.current['shift'] || keysRef.current['q'] || keysRef.current['1'];
          const isJ = keysRef.current['j'] || mouseShootDown || Boolean(vCtrl?.shootHeld);
          const isK = keysRef.current['k'] || mouseSlashDown || Boolean(vCtrl?.slashHeld);

          if (car.occupied) {
            // === BUGATTI CHIRON-X WEAPONIZED HYPERCAR DRIVING & COMBAT ===
            const wantsNitro = isShift && car.nitro > 4 && car.empLockoutTimer <= 0;
            if (isShift && car.empLockoutTimer > 0) {
              pushMissionLog('emp_nitro_warn', 'NITRO LOCKED BY EMP INTERCEPT!', 'vehicle', 'crit', 2.0);
            }
            if (wantsNitro && !car.nitroActive) {
              playNitroBoost();
              pushMissionLog('nitro_on', 'Nitro Boost Active · Afterburners Lit', 'vehicle', 'warn', 2.8);
            }
            car.nitroActive = wantsNitro;
            if (car.nitroActive) {
              car.nitro = Math.max(0, car.nitro - 28 * dt);
            } else {
              car.nitro = Math.min(100, car.nitro + 14 * dt);
            }

            const topSpeed = (car.nitroActive ? 22.5 : 14.5) * wxMod.speedMult;
            const accel = car.nitroActive ? 1.35 : 0.88;
            if (isD && !isA) {
              car.vx += accel * frames;
              car.facing = 'right';
            } else if (isA && !isD) {
              car.vx -= accel * frames;
              car.facing = 'left';
            } else {
              car.vx *= Math.pow(0.91, frames);
            }
            if (car.nitroActive && Math.abs(car.vx) < 8) {
              car.vx = (car.facing === 'right' ? 1 : -1) * 14;
            }
            car.vx = Math.max(-topSpeed, Math.min(topSpeed, car.vx));

            if (isW && car.grounded) {
              keysRef.current['w'] = false;
              keysRef.current['space'] = false;
              keysRef.current['arrowup'] = false;
              car.vy = -12.6;
              car.grounded = false;
              playJump();
            }

            // Twin Roof Plasma Miniguns [J / Left-Click]
            if (isJ && car.minigunCooldown <= 0) {
              car.minigunCooldown = 5.5;
              car.firingMinigunTimer = 0.12;
              playMinigun();
              const dir = car.facing === 'right' ? 1 : -1;
              const baseAtk =
                ((characterClass === 'vanguard' ? 24 : characterClass === 'shadowblade' ? 26 : 21) +
                  mods.dmgAdd +
                  curBonuses.attackPowerAdd) *
                wxMod.playerDamageMult;
              for (const yOff of [-22, -14]) {
                projectiles.push({
                  id: `mg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  x: car.x + dir * 32,
                  y: car.y + yOff,
                  vx: dir * 21,
                  vy: (Math.random() - 0.5) * 0.7,
                  radius: 6,
                  damage: Math.round(baseAtk * 0.68),
                  type: 'PLASMA',
                  owner: 'PLAYER',
                  color: '#22d3ee',
                });
              }
            }

            // Hood Homing Missile Launchers [K / Right-Click]
            if ((isK || slashTrigger) && car.missileCooldown <= 0) {
              slashTrigger = false;
              car.missileCooldown = car.missileMaxCooldown;
              playMissileLaunch();
              triggerShake(0.18, 10);
              const dir = car.facing === 'right' ? 1 : -1;
              const missileDmg =
                (68 + mods.dmgAdd * 1.6 + curBonuses.attackPowerAdd * 1.8) * wxMod.playerDamageMult;
              for (const vyInit of [-2.4, -0.6]) {
                projectiles.push({
                  id: `msl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  x: car.x + dir * 38,
                  y: car.y - 16,
                  vx: dir * 13.5,
                  vy: vyInit,
                  radius: 11,
                  damage: Math.round(missileDmg),
                  type: 'MISSILE',
                  owner: 'PLAYER',
                  color: '#f59e0b',
                  homing: true,
                  life: 160,
                });
              }
              pushMissionLog('missile_salvo', 'Hood Missile Salvo Fired', 'vehicle', 'info', 2);
            }
            slashTrigger = false;
            shootTrigger = false;

            // Hypercar Gravity & Multi-Level Ramp Integration
            car.vy += 0.58 * frames;
            car.x += car.vx * frames;
            car.y += car.vy * frames;
            car.x = Math.max(55, car.x);
            car.wheelSpin += (car.vx * frames) * 0.085;

            car.grounded = false;
            let rampSlopePitch = 0;
            const carL = car.x - car.width / 2;
            const carR = car.x + car.width / 2;
            const carB = car.y + car.height / 2;

            for (const seg of terrain) {
              if (seg.type === 'RAMP') {
                if (car.x >= seg.x - 16 && car.x <= seg.x + seg.width + 16) {
                  const t = Math.max(0, Math.min(1, (car.x - seg.x) / Math.max(1, seg.width)));
                  const endY = seg.rampEndY ?? seg.y - 110;
                  const surfY = seg.y + (endY - seg.y) * t;
                  if (car.vy >= -2 && carB >= surfY - 12 && carB - car.vy * frames <= surfY + 26) {
                    car.y = surfY - car.height / 2;
                    car.vy = 0;
                    car.grounded = true;
                    const slopeSign = car.facing === 'right' ? 1 : -1;
                    rampSlopePitch = -Math.atan2(endY - seg.y, seg.width) * slopeSign;
                  }
                }
                continue;
              }
              if (carR > seg.x && carL < seg.x + seg.width && carB > seg.y && car.y - car.height / 2 < seg.y + seg.height) {
                if (seg.type === 'LAVA' || seg.type === 'SPIKES') {
                  if (p.hitCooldown <= 0 && abilities.aegisActiveTimer <= 0) {
                    p.health -= seg.type === 'LAVA' ? 12 : 8;
                    car.vy = -8;
                    p.hitCooldown = 36;
                    audioRef.current.playCombatCue('hurt');
                  }
                } else if (car.vy >= 0 && carB - car.vy * frames <= seg.y + 18) {
                  car.y = seg.y - car.height / 2;
                  car.vy = 0;
                  car.grounded = true;
                  if (seg.type === 'SPRING') {
                    car.vy = -17.5;
                    car.grounded = false;
                    playJump();
                  }
                }
              }
            }
            if (car.y > 650) {
              car.y = 340;
              car.vy = 0;
            }
            const targetPitch = car.grounded
              ? rampSlopePitch
              : Math.max(-0.26, Math.min(0.26, -car.vy * 0.018 * (car.facing === 'right' ? 1 : -1)));
            car.pitch += (targetPitch - car.pitch) * Math.min(1, rawDelta * 12);

            // High-Speed Hypercar Ramming Damage
            if (Math.abs(car.vx) > 9.5 && car.ramCooldown <= 0) {
              for (const e of enemies) {
                if (
                  Math.abs(e.x - car.x) < e.width * 0.55 + car.width * 0.48 &&
                  Math.abs(e.y - car.y) < e.height * 0.6 + 34
                ) {
                  car.ramCooldown = 14;
                  const ramDmg = (car.nitroActive ? 88 : 52) + curBonuses.attackPowerAdd;
                  applyDamageToEnemy(e, ramDmg, car.nitroActive, true, 'DASH');
                  e.vx += Math.sign(car.vx) * (car.nitroActive ? 14 : 9);
                  e.vy = -7.5;
                  triggerShake(0.24, 10);
                  burstPool.spawnBurst(e.x, e.y, 0x22d3ee, 14, 6);
                  break;
                }
              }
            }

            // Sync player vitals & anchor coordinates to Hypercar cockpit
            p.x = car.x;
            p.y = car.y - 4;
            p.vx = car.vx;
            p.vy = car.vy;
            p.facing = car.facing;
            p.grounded = car.grounded;
            p.stamina = Math.min(100, p.stamina + 0.5 * frames);
            const shieldRegen =
              0.03 + mods.shieldRegenRate * 0.05 + curBonuses.droneShieldRegenAdd * 0.016;
            if (p.shield < p.maxShield) p.shield = Math.min(p.maxShield, p.shield + shieldRegen * frames);
          } else {
            // === ON-FOOT TACTICAL OPERATOR MOVEMENT & COMBAT ===
            car.nitroActive = false;
            car.nitro = Math.min(100, car.nitro + 10 * dt);
            car.vx *= Math.pow(0.88, frames);

            if (isJ) shootTrigger = true;
            if (isK) slashTrigger = true;
            if (isShift && abilities.dashCooldown <= 0 && !queuedActionsRef.current.includes('dash')) {
              queuedActionsRef.current.push('dash');
            }

            if (isS && p.parryCooldown <= 0 && p.actionState !== 'PARRYING') {
              p.actionState = 'PARRYING';
              p.stateTimer = 16;
              p.parryCooldown = 42;
              audioRef.current.playCombatCue('parry');
            }

            if (p.actionState !== 'PARRYING') {
              const maxSpd =
                (6.2 + (characterClass === 'shadowblade' ? 1.4 : 0) + curBonuses.moveSpeedAdd) *
                wxMod.speedMult;
              if (isD && !isA) {
                p.vx += 0.68 * wxMod.speedMult * frames;
                p.facing = 'right';
              } else if (isA && !isD) {
                p.vx -= 0.68 * wxMod.speedMult * frames;
                p.facing = 'left';
              } else if (abilities.dashActiveTimer <= 0) {
                p.vx *= Math.pow(0.8, frames);
              }
              if (abilities.dashActiveTimer <= 0) {
                p.vx = Math.max(-maxSpd, Math.min(maxSpd, p.vx));
              }
            } else {
              p.vx *= 0.8;
            }

            if (isW) {
              keysRef.current['w'] = false;
              keysRef.current['space'] = false;
              keysRef.current['arrowup'] = false;
              if (p.grounded) {
                p.vy = -13.2;
                p.grounded = false;
                audioRef.current.playJumpCue();
                burstPool.spawnBurst(p.x, p.y + 20, 0x94a3b8, 6, 0);
              } else if (p.doubleJumpsLeft > 0) {
                p.vy = -11.8;
                p.doubleJumpsLeft--;
                audioRef.current.playJumpCue();
                burstPool.spawnBurst(p.x, p.y + 18, 0x38bdf8, 8, 2);
              }
            }

            // Cyber-Dash damage trail + Tripwire disarming
            if (abilities.dashActiveTimer > 0) {
              if (Math.random() < 0.45) {
                dashGhosts.spawn(p.x, p.y, p.facing, 0x22d3ee);
              }
              for (const tw of tripwires) {
                if (tw.active && !tw.disarmed && Math.abs(tw.x - p.x) < 42) {
                  tw.disarmed = true;
                  tw.active = false;
                  p.gold += 15;
                  burstPool.spawnBurst(tw.x, tw.y - 18, 0x22d3ee, 10, 4);
                  pushDamageNum(tw.x, tw.y - 26, 15, false, '#22d3ee', 'TRIPWIRE DISARMED!');
                }
              }
              enemies.forEach((e) => {
                if (
                  Math.abs(e.x - p.x) < e.width * 0.7 + 26 &&
                  Math.abs(e.y - p.y) < e.height * 0.7 + 26 &&
                  !e.isStunned
                ) {
                  const dashDmg =
                    (34 + mods.dmgAdd + curBonuses.attackPowerAdd * 0.9) * wxMod.playerDamageMult;
                  applyDamageToEnemy(e, dashDmg, true, true, 'DASH');
                  e.isStunned = true;
                  e.stunDuration = 34;
                }
              });
            }

            // Combat Actions: Sword Slash (K / Right-Click) vs Shoot (J / Left-Click)
            if (slashTrigger && p.attackCooldown <= 0 && p.actionState !== 'PARRYING') {
              slashTrigger = false;
              shootTrigger = false;
              lastAttackKind = 'SLASH';
              p.actionState = 'ATTACKING';
              p.stateTimer = 12;
              p.attackCooldown = Math.max(
                8,
                Math.round(15 * (1 - Math.min(0.48, curBonuses.reloadSpeedBonus)))
              );
              audioRef.current.playCombatCue('slash');

              const isRight = p.facing === 'right';
              const baseAtk =
                ((characterClass === 'vanguard' ? 25 : characterClass === 'shadowblade' ? 28 : 20) +
                  mods.dmgAdd +
                  curBonuses.attackPowerAdd) *
                wxMod.playerDamageMult;
              const critChance =
                (characterClass === 'shadowblade' ? 0.35 : 0.14) +
                mods.critRateAdd +
                curBonuses.critChanceAdd +
                wxMod.critBonus;

              const slashReach = 112;
              const reachX = isRight ? p.x - 10 : p.x - slashReach + 10;
              for (const tw of tripwires) {
                if (
                  tw.active &&
                  !tw.disarmed &&
                  tw.x > reachX &&
                  tw.x < reachX + slashReach &&
                  Math.abs(tw.y - p.y) < 72
                ) {
                  tw.disarmed = true;
                  tw.active = false;
                  p.gold += 15;
                  burstPool.spawnBurst(tw.x, tw.y - 16, 0x38bdf8, 10, 4);
                  pushDamageNum(tw.x, tw.y - 26, 15, false, '#38bdf8', 'DISARMED!');
                }
              }
              enemies.forEach((e) => {
                if (
                  e.x + e.width / 2 > reachX &&
                  e.x - e.width / 2 < reachX + slashReach &&
                  Math.abs(e.y - p.y) < e.height / 2 + 52
                ) {
                  const isCrit = Math.random() < critChance;
                  applyDamageToEnemy(e, baseAtk * 1.25 * (isCrit ? 1.8 : 1), isCrit, true, 'SLASH');
                  e.vx += isRight ? 5.8 : -5.8;
                }
              });
              burstPool.spawnBurst(p.x + (isRight ? 42 : -42), p.y - 6, 0xfbbf24, 6, 3);
            } else if (shootTrigger && p.attackCooldown <= 0 && p.actionState !== 'PARRYING') {
              shootTrigger = false;
              lastAttackKind = 'SHOOT';
              p.actionState = 'ATTACKING';
              p.stateTimer = 9;
              p.attackCooldown = Math.max(
                7,
                Math.round(13 * (1 - Math.min(0.48, curBonuses.reloadSpeedBonus)))
              );
              audioRef.current.playCombatCue('shoot');

              const equippedWeapon = getWeaponById(curLoadout.weaponId);
              const shotColor = equippedWeapon.accentColor || '#22d3ee';
              const isRight = p.facing === 'right';
              const baseAtk =
                ((characterClass === 'vanguard' ? 25 : characterClass === 'shadowblade' ? 28 : 20) +
                  mods.dmgAdd +
                  curBonuses.attackPowerAdd) *
                wxMod.playerDamageMult;

              projectiles.push({
                id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                x: p.x + (isRight ? 28 : -28),
                y: p.y - 6,
                vx: isRight ? 16.5 : -16.5,
                vy: 0,
                radius: 7,
                damage: Math.round(baseAtk * 0.85),
                type: 'PLASMA',
                owner: 'PLAYER',
                color: shotColor,
              });
            } else {
              slashTrigger = false;
              shootTrigger = false;
            }

            // Gravity & Position Integration
            if (abilities.dashActiveTimer <= 0) {
              p.vy += 0.6 * frames;
            }
            p.x += p.vx * frames;
            p.y += p.vy * frames;
            p.x = Math.max(40, p.x);

            p.stamina = Math.min(100, p.stamina + 0.45 * frames);
            const shieldRegen =
              0.03 + mods.shieldRegenRate * 0.05 + curBonuses.droneShieldRegenAdd * 0.016;
            if (p.shield < p.maxShield) p.shield = Math.min(p.maxShield, p.shield + shieldRegen * frames);

            p.grounded = false;
            const pxL = p.x - p.width / 2;
            const pxR = p.x + p.width / 2;
            const pxT = p.y - p.height / 2;
            const pxB = p.y + p.height / 2;

            for (const seg of terrain) {
              if (seg.type === 'RAMP') {
                if (p.x >= seg.x - 10 && p.x <= seg.x + seg.width + 10) {
                  const t = Math.max(0, Math.min(1, (p.x - seg.x) / Math.max(1, seg.width)));
                  const endY = seg.rampEndY ?? seg.y - 110;
                  const surfY = seg.y + (endY - seg.y) * t;
                  if (p.vy >= -1 && pxB >= surfY - 8 && pxB - p.vy * frames <= surfY + 20) {
                    p.y = surfY - p.height / 2;
                    p.vy = 0;
                    p.grounded = true;
                    p.doubleJumpsLeft =
                      (characterClass === 'shadowblade' ? 2 : 1) +
                      mods.doubleJumpsAdd +
                      curBonuses.doubleJumpAdd;
                  }
                }
                continue;
              }
              if (pxR > seg.x && pxL < seg.x + seg.width && pxB > seg.y && pxT < seg.y + seg.height) {
                if (seg.type === 'LAVA' || seg.type === 'SPIKES') {
                  if (p.hitCooldown <= 0 && abilities.dashActiveTimer <= 0 && abilities.aegisActiveTimer <= 0) {
                    p.health -= seg.type === 'LAVA' ? 18 : 12;
                    p.vy = -9.5;
                    p.hitCooldown = 36;
                    audioRef.current.playCombatCue('hurt');
                    triggerShake(0.25, 12);
                  }
                } else if (p.vy >= 0 && pxB - p.vy * frames <= seg.y + 14) {
                  p.y = seg.y - p.height / 2;
                  p.vy = 0;
                  p.grounded = true;
                  p.doubleJumpsLeft =
                    (characterClass === 'shadowblade' ? 2 : 1) +
                    mods.doubleJumpsAdd +
                    curBonuses.doubleJumpAdd;
                  if (seg.type === 'SPRING') {
                    p.vy = -17.5;
                    p.grounded = false;
                    audioRef.current.playJumpCue();
                    burstPool.spawnBurst(p.x, p.y + 20, 0x10b981, 10, 3);
                  }
                }
              }
            }

            if (p.y > 660) {
              p.health -= 28;
              p.y = 320;
              p.vy = 0;
              audioRef.current.playCombatCue('hurt');
            }

            if (p.stateTimer <= 0) {
              if (!p.grounded) p.actionState = 'JUMPING';
              else if (Math.abs(p.vx) > 0.6) p.actionState = 'RUNNING';
              else p.actionState = 'IDLE';
            }
          }

          // Autonomous Tactical Support Drone Follower, Shielding, Healing, Scanning & Combat Fire
          if (curBonuses.droneSupport) {
            const faceSign = p.facing === 'right' ? 1 : -1;
            const anchorX = p.x - faceSign * 42;
            const anchorY = (car.occupied ? car.y - 72 : p.y - 56) + Math.sin(totalTimeSec * 3.1) * 7;

            const springAx = (anchorX - droneSim.x) * 9.5;
            const springAy = (anchorY - droneSim.y) * 9.5;
            droneSim.vx = (droneSim.vx + springAx * dt) * Math.pow(0.08, dt);
            droneSim.vy = (droneSim.vy + springAy * dt) * Math.pow(0.08, dt);
            droneSim.x += droneSim.vx * dt;
            droneSim.y += droneSim.vy * dt;

            if (droneSim.fireFlashTimer > 0) {
              droneSim.fireFlashTimer = Math.max(0, droneSim.fireFlashTimer - dt);
            }
            if (droneSim.supportPulseTimer > 0) {
              droneSim.supportPulseTimer = Math.max(0, droneSim.supportPulseTimer - dt);
            }

            const overclocked = curLoadout.gadgetIds.includes('gdg_combat_drone');
            const cycleMult = overclocked ? 1.25 : 1.0;
            const activeModel = curBonuses.activeDroneModel || 'drone_sentinel';
            const attackRange =
              activeModel === 'drone_scanner'
                ? 480
                : activeModel === 'drone_sentinel'
                ? 460
                : 330;

            let nearestEnemy: Enemy | null = null;
            let nearestDist = Infinity;
            for (const cand of enemies) {
              if (cand.health <= 0) continue;
              const d = Math.hypot(cand.x - droneSim.x, cand.y - droneSim.y);
              if (d < attackRange && d < nearestDist) {
                nearestDist = d;
                nearestEnemy = cand;
              }
            }
            droneSim.lockedEnemy = nearestEnemy;

            droneSim.fireTimer += dt * cycleMult;
            droneSim.supportTimer += dt * cycleMult;

            const fireInterval =
              activeModel === 'drone_sentinel'
                ? 0.9
                : activeModel === 'drone_scanner'
                ? 1.15
                : activeModel === 'drone_aegis'
                ? 1.45
                : 1.55;

            if (nearestEnemy && droneSim.fireTimer >= fireInterval) {
              droneSim.fireTimer = 0;
              droneSim.fireFlashTimer = 0.16;
              const dx = nearestEnemy.x - droneSim.x;
              const dy = nearestEnemy.y - droneSim.y;
              const mag = Math.max(1, Math.hypot(dx, dy));
              const boltColor =
                activeModel === 'drone_aegis'
                  ? '#38bdf8'
                  : activeModel === 'drone_medic'
                  ? '#34d399'
                  : activeModel === 'drone_scanner'
                  ? '#facc15'
                  : '#22d3ee';
              const baseDroneDmg =
                activeModel === 'drone_sentinel'
                  ? 17
                  : activeModel === 'drone_scanner'
                  ? 14
                  : 10;
              projectiles.push({
                id: `drone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                x: droneSim.x,
                y: droneSim.y,
                vx: (dx / mag) * 15,
                vy: (dy / mag) * 15,
                radius: 5,
                damage: Math.round(
                  baseDroneDmg + curBonuses.attackPowerAdd * 0.4 + (overclocked ? 9 : 0)
                ),
                type: 'PLASMA',
                owner: 'PLAYER',
                color: boltColor,
              });
            }

            if (activeModel === 'drone_aegis') {
              if (droneSim.supportTimer >= 2.8) {
                if (p.shield < p.maxShield) {
                  droneSim.supportTimer = 0;
                  droneSim.supportPulseTimer = 0.65;
                  const gain = overclocked ? 9 : 6;
                  p.shield = Math.min(p.maxShield, p.shield + gain);
                  burstPool.spawnBurst(p.x, p.y - 12, 0x38bdf8, 8, 3);
                  pushDamageNum(p.x, p.y - 34, gain, false, '#38bdf8', '+SHIELD');
                  pushMissionLog(
                    'drone_aegis_pulse',
                    'Aegis Drone pulsed minor shielding',
                    'combat',
                    'info',
                    14
                  );
                }
              }
              droneSim.statusText =
                droneSim.supportPulseTimer > 0
                  ? 'SHIELDING'
                  : nearestEnemy
                  ? 'DEFENDING'
                  : 'GUARDING';
            } else if (activeModel === 'drone_medic') {
              if (droneSim.supportTimer >= 3.2) {
                if (p.health < p.maxHealth || p.shield < p.maxShield) {
                  droneSim.supportTimer = 0;
                  droneSim.supportPulseTimer = 0.65;
                  const hpGain = overclocked ? 8 : 5;
                  const shGain = overclocked ? 5 : 3;
                  p.health = Math.min(p.maxHealth, p.health + hpGain);
                  p.shield = Math.min(p.maxShield, p.shield + shGain);
                  burstPool.spawnBurst(p.x, p.y - 12, 0x34d399, 8, 3);
                  pushDamageNum(p.x, p.y - 34, hpGain, false, '#34d399', '+HEAL');
                  pushMissionLog(
                    'drone_medic_pulse',
                    'Healing Drone repaired armor & shield',
                    'combat',
                    'success',
                    14
                  );
                }
              }
              droneSim.statusText =
                droneSim.supportPulseTimer > 0
                  ? 'HEALING'
                  : nearestEnemy
                  ? 'COVER FIRE'
                  : 'MEDIC READY';
            } else if (activeModel === 'drone_scanner') {
              droneSim.statusText = nearestEnemy ? 'TARGET LOCKED' : 'SCANNING';
            } else {
              if (droneSim.supportTimer >= 4.5 && p.shield < p.maxShield) {
                droneSim.supportTimer = 0;
                droneSim.supportPulseTimer = 0.5;
                p.shield = Math.min(p.maxShield, p.shield + 3);
              }
              droneSim.statusText = nearestEnemy ? 'ENGAGING' : 'OVERWATCH';
            }
          } else {
            droneSim.lockedEnemy = null;
            droneSim.statusText = 'OFFLINE';
          }

          // Distance & Procedural Chunk Generation
          if (p.x > maxReachedX) maxReachedX = p.x;
          p.distance = Math.min(2000, Math.max(0, (maxReachedX - 120) / 16));

          while (generatedUpToX < p.x + 1700 && generatedUpToX < 33400) {
            generateTerrainChunk(generatedUpToX);
          }

          // Collectibles
          for (const item of decor) {
            if (item.collected) continue;
            if (
              Math.abs(p.x - (item.x + item.width / 2)) < 36 &&
              Math.abs(p.y - (item.y + item.height / 2)) < 40
            ) {
              if (item.type === 'GOLD_COIN') {
                item.collected = true;
                p.gold += Math.round(10 * (1 + curBonuses.droneGoldMultiplier));
                audioRef.current.playGoldPickupCue();
                burstPool.spawnBurst(item.x, item.y, 0xfacc15, 8, 2);
              } else if (item.type === 'POTION') {
                item.collected = true;
                p.health = Math.min(p.maxHealth, p.health + 35);
                audioRef.current.playPowerUpCue();
                burstPool.spawnBurst(item.x, item.y, 0xf43f5e, 10, 3);
              } else if (item.type === 'CHEST') {
                item.collected = true;
                p.gold += 35;
                p.shield = Math.min(p.maxShield, p.shield + 25);
                audioRef.current.playPowerUpCue();
                burstPool.spawnBurst(item.x, item.y, 0xfbbf24, 16, 4);
              }
            }
          }

          // Extreme Weather Gameplay Modifiers (Acid Rain corrosion & Void Storm lightning strikes)
          if (wxMod.shieldCorrosionPerSec > 0 && p.shield > 0 && abilities.aegisActiveTimer <= 0 && p.x > 820) {
            p.shield = Math.max(0, p.shield - wxMod.shieldCorrosionPerSec * dt);
          }
          if (wxMod.voidLightningIntervalSec > 0 && p.x > 780) {
            if (voidTelegraphTimer > 0) {
              voidTelegraphTimer -= dt;
              if (Math.random() < 0.35) {
                burstPool.spawnBurst(voidStrikeX, 488, 0xc084fc, 4, 2);
              }
              if (voidTelegraphTimer <= 0) {
                playThunderCrack();
                triggerShake(0.28, 12);
                burstPool.spawnBurst(voidStrikeX, 468, 0xd946ef, 22, 9);
                if (Math.abs(p.x - voidStrikeX) < 58 && abilities.dashActiveTimer <= 0 && abilities.aegisActiveTimer <= 0) {
                  p.health -= 14;
                  p.hitCooldown = 28;
                  audioRef.current.playCombatCue('hurt');
                  pushDamageNum(p.x, p.y - 24, 14, true, '#c084fc', 'VOID STRIKE!');
                }
              }
            } else {
              voidLightningTimer -= dt;
              if (voidLightningTimer <= 0) {
                voidLightningTimer = wxMod.voidLightningIntervalSec;
                voidTelegraphTimer = 0.85;
                voidStrikeX = p.x + (Math.random() - 0.5) * 140;
                pushDamageNum(voidStrikeX, 440, 0, false, '#e879f9', 'VOID ARC!');
                pushMissionLog('void_arc', 'Void Lightning Targeting Sector!', 'world', 'warn', 6);
              }
            }
          } else {
            voidTelegraphTimer = 0;
          }

          // Villain Laser Tripwire Collision Check & Periodic Deployment
          tripwireSpawnTimer -= dt;
          if (tripwireSpawnTimer <= 0 && p.x > 840) {
            tripwireSpawnTimer = 11.5;
            const aheadX = p.x + (p.facing === 'right' ? 320 : -320);
            const hasNearbyWire = tripwires.some((tw) => !tw.disarmed && Math.abs(tw.x - aheadX) < 280);
            if (!hasNearbyWire && aheadX > 850) {
              tripwires.push({
                id: `tw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                x: aheadX,
                y: 500,
                width: 24,
                height: 48,
                active: true,
                disarmed: false,
                color: '#ff1e38',
              });
            }
          }
          for (const tw of tripwires) {
            if (!tw.active || tw.disarmed) continue;
            if (Math.abs(p.x - tw.x) < 22 && p.y > tw.y - 54 && p.y < tw.y + 12) {
              tw.disarmed = true;
              tw.active = false;
              playTripwireAlarm();
              burstPool.spawnBurst(tw.x, tw.y - 22, 0xff1e38, 18, 7);
              if (abilities.dashActiveTimer <= 0 && abilities.aegisActiveTimer <= 0) {
                const wireDmg = car.occupied ? 12 : 18;
                if (p.shield > 0) {
                  const ab = Math.min(p.shield, wireDmg);
                  p.shield -= ab;
                  p.health -= wireDmg - ab;
                } else {
                  p.health -= wireDmg;
                }
                p.vx = -Math.sign(p.vx || 1) * 7.5;
                p.vy = -6.5;
                triggerShake(0.28, 12);
                pushDamageNum(tw.x, tw.y - 26, wireDmg, true, '#ff1e38', 'TRIPWIRE TRAP!');
                pushMissionLog('tripwire_hit', 'Villain Laser Tripwire Detonated!', 'combat', 'crit', 3);
              }
            }
          }
          tripwires = tripwires.filter((tw) => tw.x > p.x - 1600 && !tw.disarmed);

          // High-Speed Hypercar Pursuit Units (Armored Interceptor Trucks & Hover-Bikes)
          if (car.occupied && p.x > 850) {
            const activePursuers = enemies.filter((en) => en.pursuitVehicle);
            pursuitSpawnTimer -= dt;
            if (pursuitSpawnTimer <= 0 && activePursuers.length < 2) {
              pursuitSpawnTimer = 6.8;
              const isBike = Math.random() < 0.55;
              const behind = Math.random() < 0.72;
              const spawnX = p.x + (behind ? -460 : 540);
              if (spawnX > 760) {
                enemies.push({
                  id: `pursuit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  type: isBike ? 'HOVER_BIKE' : 'INTERCEPTOR',
                  name: isBike ? 'Predator Hover-Bike' : 'Black Interceptor',
                  x: spawnX,
                  y: isBike ? 430 : 445,
                  vx: 0,
                  vy: 0,
                  width: isBike ? 64 : 104,
                  height: isBike ? 46 : 56,
                  maxHealth: isBike ? 95 : 175,
                  health: isBike ? 95 : 175,
                  damage: isBike ? 18 : 24,
                  facing: behind ? 'right' : 'left',
                  behavior: 'CHARGE',
                  behaviorTimer: 0,
                  attackCooldown: 30,
                  empCooldown: 70,
                  pursuitVehicle: true,
                  isStunned: false,
                  stunDuration: 0,
                  armorFactor: isBike ? 0.08 : 0.22,
                  color: isBike ? '#d946ef' : '#ef4444',
                  scoreValue: isBike ? 35 : 55,
                });
                pushMissionLog(
                  'pursuit_spawn',
                  `EMP Pursuit Incoming: ${isBike ? 'Predator Hover-Bike' : 'Black Interceptor'}!`,
                  'vehicle',
                  'crit',
                  5
                );
                emitVillainComm(
                  'vex',
                  'INTERCEPTOR SQUAD DEPLOYED — DISABLE THAT CHIRON’S NITRO WITH EMPs!',
                  'pursuit',
                  9
                );
              }
            }
          }

          // Update Enemies & Hardcore Top-Rank Bosses
          const dealPlayerDamage = (dmgAmt: number, unblockable = false, sourceEnemy?: Enemy) => {
            const scaledDmg = Math.round(dmgAmt * wxMod.enemyDamageMult);
            if (abilities.dashActiveTimer > 0) {
              if (
                sourceEnemy?.type === 'BOSS' &&
                ((sourceEnemy.finisherRushHitsLeft ?? 0) > 0 || (sourceEnemy.finisherWindupTimer ?? 0) > 0) &&
                abilities.counterDashBonusTimer < 5.0
              ) {
                triggerPerfectCounterDash(sourceEnemy);
              } else {
                pushDamageNum(p.x, p.y - 26, 0, false, '#22d3ee', 'DASH DODGE!');
              }
              return;
            }
            if (p.hitCooldown > 0) return;

            if (!unblockable && p.actionState === 'PARRYING') {
              if (sourceEnemy) {
                sourceEnemy.isStunned = true;
                sourceEnemy.stunDuration = sourceEnemy.type === 'BOSS' ? 68 : 55;
                sourceEnemy.blockTimer = 0;
                sourceEnemy.shieldActive = false;
              }
              audioRef.current.playCombatCue('parry');
              burstPool.spawnBurst(p.x, p.y, 0x38bdf8, 12, 4);
              pushDamageNum(p.x, p.y - 24, 0, false, '#38bdf8', 'PARRY!');
              return;
            }
            if (!unblockable && abilities.aegisActiveTimer > 0) {
              pushDamageNum(p.x, p.y - 24, 0, false, '#67e8f9', 'AEGIS BLOCK!');
              return;
            }

            let rem = scaledDmg;
            if (p.shield > 0) {
              // Unblockable hits shred 50% straight through shields
              const absorbCap = unblockable ? p.shield * 0.5 : p.shield;
              const ab = Math.min(absorbCap, rem);
              p.shield -= ab;
              rem -= ab;
            }
            p.health -= rem;
            p.hitCooldown = unblockable ? 24 : 30;
            audioRef.current.playCombatCue('hurt');
            burstPool.spawnBurst(p.x, p.y, 0xef4444, unblockable ? 18 : 10, unblockable ? 6 : 3);
            triggerShake(unblockable ? 0.42 : 0.24, unblockable ? 18 : 10);
          };

          // Shield-Break Detection -> Trigger Boss Finisher Rush Combo!
          const shieldJustBroke = prevPlayerShield > 0 && p.shield <= 0;
          prevPlayerShield = p.shield;
          if (shieldJustBroke) {
            const nearbyBoss = enemies.find(
              (en) => en.type === 'BOSS' && !en.isStunned && Math.abs(en.x - p.x) < 760
            );
            if (nearbyBoss && (nearbyBoss.finisherCooldown ?? 0) <= 0 && (nearbyBoss.finisherWindupTimer ?? 0) <= 0) {
              nearbyBoss.finisherCooldown = 360;
              nearbyBoss.finisherWindupTimer = 50;
              nearbyBoss.finisherTotalWindup = 50;
              nearbyBoss.finisherRushHitsLeft = 2;
              abilities.dashCooldown = Math.min(abilities.dashCooldown, 0.35);
              playBossRoar();
              pushMissionLog(
                'boss_finisher_warn',
                `SHIELD SHATTERED! ${nearbyBoss.name} Initiating Finisher Rush!`,
                'boss',
                'crit',
                4
              );
              emitVillainComm(
                nearbyBoss.bossId || 'malakor',
                'YOUR SHIELD IS GONE! WITNESS TRUE EXECUTION — DASH OR DIE!',
                'finisher',
                4
              );
            }
          }

          const spawnedReinforcements: Enemy[] = [];
          const nearbyGruntCount = enemies.filter(
            (other) => other.type !== 'BOSS' && Math.abs(other.x - p.x) < 620
          ).length;

          const survivingEnemies: Enemy[] = [];
          for (const e of enemies) {
            if (e.health <= 0) {
              const goldReward = Math.round(e.scoreValue * (1 + curBonuses.droneGoldMultiplier));
              p.gold += goldReward;
              callbacksRef.current.onEnemyKilled(goldReward);
              audioRef.current.playCombatCue('explosion');
              burstPool.spawnBurst(
                e.x,
                e.y,
                e.type === 'BOSS' ? 0xfacc15 : 0xf97316,
                e.type === 'BOSS' ? 40 : 16,
                e.type === 'BOSS' ? 12 : 5
              );
              triggerShake(e.type === 'BOSS' ? 0.55 : 0.18, e.type === 'BOSS' ? 30 : 8);

              const meshEntry = enemyMeshes.get(e.id);
              if (meshEntry) {
                scene.remove(meshEntry.group);
                meshEntry.dispose();
                enemyMeshes.delete(e.id);
              }

              if (e.type === 'BOSS' && e.bossId) {
                slowMoTimer = 1.4;
                if (e.bossId === 'malakor') {
                  victoryPending = true;
                  victoryTimer = 1.8;
                } else if (e.milestoneMeters) {
                  callbacksRef.current.onBossDefeated?.(e.bossId, e.milestoneMeters);
                }
              }
              continue;
            }

            survivingEnemies.push(e);

            // Apply horizontal knockback/dodge damping & vertical leap gravity for ground enemies
            e.x += e.vx * frames;
            e.vx *= Math.pow(0.84, frames);
            if (e.type !== 'HARPY' && e.bossId !== 'malakor') {
              const floorY = e.type === 'BOSS' ? 410 : e.type === 'HEAVY' ? 440 : 452;
              e.y += e.vy * frames;
              if (e.y < floorY) {
                e.vy += 0.58 * frames;
              } else {
                e.y = floorY;
                e.vy = 0;
              }
            }

            if ((e.dodgeCooldown ?? 0) > 0) e.dodgeCooldown = Math.max(0, (e.dodgeCooldown ?? 0) - frames);
            if ((e.blockTimer ?? 0) > 0) {
              e.blockTimer = Math.max(0, (e.blockTimer ?? 0) - frames);
              e.shieldActive = (e.blockTimer ?? 0) > 0;
            } else if (e.type !== 'HEAVY') {
              e.shieldActive = false;
            }
            if ((e.blockCooldown ?? 0) > 0) e.blockCooldown = Math.max(0, (e.blockCooldown ?? 0) - frames);
            if ((e.leapCooldown ?? 0) > 0) e.leapCooldown = Math.max(0, (e.leapCooldown ?? 0) - frames);

            if (e.isStunned) {
              e.stunDuration -= frames;
              e.unblockableTimer = 0;
              e.comboStep = 0;
              if (e.stunDuration <= 0) e.isStunned = false;
              continue;
            }

            const distToPlayer = Math.abs(e.x - p.x);
            e.facing = p.x >= e.x ? 'right' : 'left';
            const speedScale = e.type === 'BOSS' && e.rageMode ? 1.4 : 1.0;

            if (e.attackCooldown > 0) e.attackCooldown -= frames * speedScale;
            if ((e.specialCooldown ?? 0) > 0) e.specialCooldown = (e.specialCooldown ?? 0) - frames * speedScale;
            if ((e.minionCooldown ?? 0) > 0) e.minionCooldown = (e.minionCooldown ?? 0) - frames * speedScale;
            if ((e.hazardCooldown ?? 0) > 0) e.hazardCooldown = (e.hazardCooldown ?? 0) - frames * speedScale;

            if ((e.empCooldown ?? 0) > 0) e.empCooldown = Math.max(0, (e.empCooldown ?? 0) - frames);
            if ((e.finisherCooldown ?? 0) > 0) e.finisherCooldown = Math.max(0, (e.finisherCooldown ?? 0) - frames);

            if (e.type === 'BOSS') {
              // First-contact Brutal Ambush: Hijack billboards + surround with Armored Hit-Squad + Tripwires!
              if (!e.ambushTriggered && distToPlayer < 720) {
                e.ambushTriggered = true;
                pushMissionLog(
                  `ambush_${e.id}`,
                  `${e.name} Hijacked City Billboards · Hit-Squad Flanking!`,
                  'boss',
                  'crit',
                  6
                );
                emitVillainComm(
                  e.bossId || 'malakor',
                  'ALL CHANNELS ARE MINE! HIT-SQUAD, SURROUND THE TARGET!',
                  'ambush',
                  3
                );
                for (const [idx, flankOff] of ([-260, 220] as const).entries()) {
                  const squadX = p.x + flankOff;
                  if (squadX > 720) {
                    const sType = idx === 0 ? 'HEAVY' : 'SCOUT';
                    spawnedReinforcements.push({
                      id: `squad_${Date.now()}_${idx}`,
                      type: sType,
                      name: sType === 'HEAVY' ? 'Hit-Squad Enforcer' : 'Hit-Squad Assassin',
                      x: squadX,
                      y: sType === 'HEAVY' ? 440 : 452,
                      vx: 0,
                      vy: 0,
                      width: sType === 'HEAVY' ? 46 : 34,
                      height: sType === 'HEAVY' ? 60 : 44,
                      maxHealth: 92,
                      health: 92,
                      damage: 18,
                      facing: flankOff < 0 ? 'right' : 'left',
                      behavior: 'PATROL',
                      behaviorTimer: 0,
                      attackCooldown: 30,
                      dodgeCooldown: 50,
                      leapCooldown: 65,
                      blockTimer: sType === 'HEAVY' ? 60 : 0,
                      blockCooldown: 140,
                      shieldChance: sType === 'HEAVY' ? 0.55 : 0,
                      shieldActive: sType === 'HEAVY',
                      isStunned: false,
                      stunDuration: 0,
                      color: '#ef4444',
                      scoreValue: 24,
                    });
                    burstPool.spawnBurst(squadX, 440, 0xef4444, 14, 5);
                  }
                }
                const trapX = p.x + (p.facing === 'right' ? 165 : -165);
                if (trapX > 760) {
                  tripwires.push({
                    id: `boss_tw_${Date.now()}`,
                    x: trapX,
                    y: 500,
                    width: 24,
                    height: 48,
                    active: true,
                    disarmed: false,
                    color: '#ff1e38',
                  });
                }
              }

              // Shield-Break Finisher Rush Execution (with 4.5% Boss HP Lifesteal on heavy connect!)
              if ((e.finisherWindupTimer ?? 0) > 0) {
                e.finisherWindupTimer = Math.max(0, (e.finisherWindupTimer ?? 0) - frames);
                e.behavior = 'TELEGRAPH';
                continue;
              }
              if ((e.finisherRushHitsLeft ?? 0) > 0) {
                e.behavior = 'ATTACK';
                const rushSpd = 9.8;
                if (distToPlayer > 48) {
                  e.x += (p.x >= e.x ? rushSpd : -rushSpd) * frames;
                }
                if (distToPlayer < 125 && p.hitCooldown <= 0) {
                  const prevHp = p.health;
                  dealPlayerDamage(Math.round(e.damage * 1.15), false, e);
                  e.finisherRushHitsLeft = Math.max(0, (e.finisherRushHitsLeft ?? 0) - 1);
                  if (p.health < prevHp) {
                    const healAmt = Math.round(e.maxHealth * 0.045);
                    e.health = Math.min(e.maxHealth, e.health + healAmt);
                    burstPool.spawnBurst(e.x, e.y, 0xf43f5e, 18, 7);
                    pushDamageNum(e.x, e.y - 36, healAmt, true, '#ef4444', '+EXECUTION DRAIN');
                  }
                }
                continue;
              }

              // Enraged Phase at 50% HP (+40% attack speed + unblockable ultimates!)
              if (e.health <= e.maxHealth * 0.5 && !e.rageMode) {
                e.phase = 2;
                e.rageMode = true;
                playBossRoar();
                triggerShake(0.45, 22);
                burstPool.spawnBurst(e.x, e.y, 0xef4444, 30, 11);
                pushDamageNum(e.x, e.y - 45, 0, true, '#ef4444', 'ENRAGED +40% SPD!');
                pushMissionLog(`boss_rage_${e.id}`, `${e.name} Enraged (+40% SPD)`, 'boss', 'crit', 5);
                emitVillainComm(
                  e.bossId || 'malakor',
                  'ENOUGH GAMES! FULL OVERDRIVE — NO MERCY!',
                  'taunt',
                  2
                );
              }

              if (distToPlayer < 820) {
                // Periodic Frontal Energy Shield block against spam
                if ((e.blockCooldown ?? 0) <= 0 && (e.unblockableTimer ?? 0) <= 0 && distToPlayer < 320) {
                  e.blockCooldown = e.rageMode ? 210 : 280;
                  e.blockTimer = 68;
                  e.shieldActive = true;
                }

                // Minion Reinforcements during tough boss fights
                if ((e.minionCooldown ?? 0) <= 0 && nearbyGruntCount + spawnedReinforcements.length < (e.rageMode ? 2 : 1)) {
                  e.minionCooldown = e.rageMode ? 360 : 480;
                  const addType = e.bossId === 'ignis' || e.bossId === 'malakor' ? 'HARPY' : e.bossId === 'specter9' ? 'ARCHER' : 'SCOUT';
                  const addX = e.x + (e.facing === 'right' ? 95 : -95);
                  spawnedReinforcements.push({
                    id: `add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    type: addType,
                    name: addType === 'HARPY' ? 'Elite Drone' : addType === 'ARCHER' ? 'Void Marksman' : 'Shadow Striker',
                    x: addX,
                    y: addType === 'HARPY' ? 320 : 452,
                    vx: 0,
                    vy: 0,
                    width: 34,
                    height: 44,
                    maxHealth: Math.round(52 * (1 + (e.milestoneMeters || 400) * 0.0005)),
                    health: Math.round(52 * (1 + (e.milestoneMeters || 400) * 0.0005)),
                    damage: Math.round(14 * (1 + (e.milestoneMeters || 400) * 0.0004)),
                    facing: e.facing,
                    behavior: addType === 'HARPY' ? 'FLIGHT' : 'PATROL',
                    behaviorTimer: 0,
                    attackCooldown: 40,
                    dodgeCooldown: 45,
                    leapCooldown: 60,
                    isStunned: false,
                    stunDuration: 0,
                    color: e.color,
                    scoreValue: 14,
                  });
                  burstPool.spawnBurst(addX, 420, 0x38bdf8, 12, 4);
                }

                // Enraged Unblockable Ultimate Execution Windup -> Strike!
                if ((e.unblockableTimer ?? 0) > 0) {
                  e.unblockableTimer = (e.unblockableTimer ?? 0) - frames;
                  e.behavior = 'TELEGRAPH';
                  if ((e.unblockableTimer ?? 0) <= 0) {
                    e.behavior = 'ATTACK';
                    triggerShake(0.45, 20);
                    burstPool.spawnBurst(e.x, e.y, 0xf43f5e, 26, 10);
                    if (e.bossId === 'vex') {
                      for (const dir of [-1, 1]) {
                        projectiles.push({
                          id: `vex_ult_${Date.now()}_${dir}`,
                          x: e.x,
                          y: 478,
                          vx: dir * 11.5,
                          vy: 0,
                          radius: 16,
                          damage: Math.round(e.damage * 1.45),
                          type: 'SHOCKWAVE',
                          owner: 'ENEMY',
                          color: '#f43f5e',
                          unblockable: true,
                        });
                      }
                      if (distToPlayer < 165) dealPlayerDamage(Math.round(e.damage * 1.4), true, e);
                    } else if (e.bossId === 'ignis') {
                      for (let k = -2; k <= 2; k++) {
                        projectiles.push({
                          id: `ignis_ult_${Date.now()}_${k}`,
                          x: p.x + k * 75,
                          y: 48,
                          vx: k * 0.8,
                          vy: 10.2,
                          radius: 15,
                          damage: Math.round(e.damage * 1.35),
                          type: 'METEOR',
                          owner: 'ENEMY',
                          color: '#f43f5e',
                          unblockable: true,
                        });
                      }
                    } else if (e.bossId === 'specter9') {
                      for (const dy of [-18, 10]) {
                        projectiles.push({
                          id: `spec_ult_${Date.now()}_${dy}`,
                          x: e.x,
                          y: e.y + dy,
                          vx: (e.facing === 'right' ? 1 : -1) * 18,
                          vy: 0,
                          radius: 13,
                          damage: Math.round(e.damage * 1.4),
                          type: 'VOID_BEAM',
                          owner: 'ENEMY',
                          color: '#f43f5e',
                          unblockable: true,
                        });
                      }
                    } else {
                      for (let i = 0; i < 7; i++) {
                        const spread = (i - 3) * 0.19;
                        const baseAng = Math.atan2(p.y - e.y, p.x - e.x) + spread;
                        projectiles.push({
                          id: `mal_ult_${Date.now()}_${i}`,
                          x: e.x,
                          y: e.y,
                          vx: Math.cos(baseAng) * 12.2,
                          vy: Math.sin(baseAng) * 12.2,
                          radius: 12,
                          damage: Math.round(e.damage * 1.3),
                          type: 'LASER_BARRAGE',
                          owner: 'ENEMY',
                          color: '#f43f5e',
                          unblockable: true,
                        });
                      }
                    }
                  }
                } else if (e.bossId === 'vex') {
                  // General Vex: Gap-closing leap + 3-hit Greatsword Blitz Combo + Shockwaves
                  const spd = e.rageMode ? 4.3 : 3.0;
                  if (distToPlayer > 72) e.x += (e.facing === 'right' ? spd : -spd) * frames;

                  if (distToPlayer > 210 && distToPlayer < 480 && (e.leapCooldown ?? 0) <= 0 && e.y >= 408) {
                    e.leapCooldown = e.rageMode ? 120 : 170;
                    e.vy = -12.5;
                    e.vx = (e.facing === 'right' ? 1 : -1) * 11;
                    burstPool.spawnBurst(e.x, e.y + 30, 0x22d3ee, 10, 4);
                  }

                  // Multi-hit 3-slash combo
                  if ((e.comboStep ?? 0) > 0) {
                    e.comboTimer = (e.comboTimer ?? 0) - frames * speedScale;
                    e.behavior = 'ATTACK';
                    if ((e.comboTimer ?? 0) <= 0) {
                      if (distToPlayer < 135) {
                        dealPlayerDamage(Math.round(e.damage * 0.72), false, e);
                      }
                      if ((e.comboStep ?? 0) === 1) {
                        for (const dir of [-1, 1]) {
                          projectiles.push({
                            id: `vex_cwave_${Date.now()}_${dir}`,
                            x: e.x,
                            y: 484,
                            vx: dir * 8.5,
                            vy: 0,
                            radius: 12,
                            damage: 20,
                            type: 'SHOCKWAVE',
                            owner: 'ENEMY',
                            color: '#22d3ee',
                          });
                        }
                      }
                      e.comboStep = (e.comboStep ?? 0) - 1;
                      e.comboTimer = 16;
                    }
                  } else if (e.attackCooldown <= 0 && distToPlayer < 128) {
                    e.attackCooldown = 62;
                    e.comboStep = 2;
                    e.comboTimer = 14;
                    e.behavior = 'ATTACK';
                    dealPlayerDamage(Math.round(e.damage * 0.8), false, e);
                  } else if ((e.specialCooldown ?? 0) <= 0) {
                    e.specialCooldown = e.rageMode ? 130 : 175;
                    if (e.rageMode) {
                      e.unblockableTimer = 48;
                      e.unblockableKind = 'VEX_CLEAVE';
                      playBossRoar();
                    } else {
                      e.behavior = 'TELEGRAPH';
                      for (const dir of [-1, 1]) {
                        projectiles.push({
                          id: `vex_wave_${Date.now()}_${dir}`,
                          x: e.x,
                          y: 484,
                          vx: dir * 8.2,
                          vy: 0,
                          radius: 12,
                          damage: 20,
                          type: 'SHOCKWAVE',
                          owner: 'ENEMY',
                          color: '#22d3ee',
                        });
                      }
                    }
                  } else {
                    e.behavior = 'PATROL';
                  }
                } else if (e.bossId === 'ignis') {
                  // Ignis Prime: Leaping Slam + Area-Denial Lava Pillars + Enraged Supernova
                  const spd = e.rageMode ? 3.2 : 2.3;
                  if (distToPlayer > 100) e.x += (e.facing === 'right' ? spd : -spd) * frames;

                  if (distToPlayer > 230 && (e.leapCooldown ?? 0) <= 0 && e.y >= 408) {
                    e.leapCooldown = e.rageMode ? 140 : 200;
                    e.vy = -13.2;
                    e.vx = (e.facing === 'right' ? 1 : -1) * 9.5;
                  }

                  // Area-denial lava fissures
                  if ((e.hazardCooldown ?? 0) <= 0) {
                    e.hazardCooldown = e.rageMode ? 105 : 155;
                    for (const offset of [-75, 75]) {
                      projectiles.push({
                        id: `ignis_haz_${Date.now()}_${offset}`,
                        x: p.x + offset,
                        y: 472,
                        vx: 0,
                        vy: -2.0,
                        radius: 15,
                        damage: 22,
                        type: 'LAVA_PILLAR',
                        owner: 'ENEMY',
                        color: '#fb923c',
                        life: 70,
                      });
                    }
                  }

                  if (e.attackCooldown <= 0 && distToPlayer < 130) {
                    e.attackCooldown = 64;
                    e.behavior = 'ATTACK';
                    dealPlayerDamage(e.damage, false, e);
                  } else if ((e.specialCooldown ?? 0) <= 0) {
                    e.specialCooldown = e.rageMode ? 115 : 155;
                    if (e.rageMode) {
                      e.unblockableTimer = 52;
                      e.unblockableKind = 'IGNIS_SUPERNOVA';
                      playBossRoar();
                    } else {
                      for (let m = -1; m <= 1; m++) {
                        projectiles.push({
                          id: `meteor_${Date.now()}_${m}`,
                          x: p.x + m * 120,
                          y: 55 - Math.abs(m) * 40,
                          vx: (Math.random() - 0.5) * 1.6,
                          vy: 8.2,
                          radius: 13,
                          damage: 24,
                          type: 'METEOR',
                          owner: 'ENEMY',
                          color: '#f97316',
                        });
                      }
                    }
                  } else {
                    e.behavior = 'PATROL';
                  }
                } else if (e.bossId === 'specter9') {
                  // Specter-9: Blink Teleport + Multi-Hit Void Cross Combo + Unblockable Execution
                  if ((e.specialCooldown ?? 0) <= 0) {
                    e.specialCooldown = e.rageMode ? 95 : 135;
                    burstPool.spawnBurst(e.x, e.y, 0xa855f7, 16, 5);
                    e.x = p.x + (p.x > e.x ? -245 : 245);
                    e.behavior = 'TELEGRAPH';
                    if (e.rageMode) {
                      e.unblockableTimer = 46;
                      e.unblockableKind = 'SPECTER_EXECUTION';
                      playBossRoar();
                    } else {
                      e.telegraphTimer = 28;
                    }
                  } else if ((e.telegraphTimer ?? 0) > 0) {
                    e.telegraphTimer = (e.telegraphTimer ?? 0) - frames * speedScale;
                    e.behavior = 'TELEGRAPH';
                    if (e.telegraphTimer <= 0) {
                      e.behavior = 'ATTACK';
                      for (const vyOff of [0, -1.6]) {
                        projectiles.push({
                          id: `void_${Date.now()}_${vyOff}`,
                          x: e.x,
                          y: e.y - 12,
                          vx: (e.facing === 'right' ? 1 : -1) * 16.5,
                          vy: vyOff,
                          radius: 9,
                          damage: 26,
                          type: 'VOID_BEAM',
                          owner: 'ENEMY',
                          color: '#d946ef',
                        });
                      }
                    }
                  } else {
                    const spd = e.rageMode ? 4.4 : 3.1;
                    if (distToPlayer > 85) e.x += (e.facing === 'right' ? spd : -spd) * frames;
                    if (e.attackCooldown <= 0 && distToPlayer < 115) {
                      e.attackCooldown = 52;
                      e.behavior = 'ATTACK';
                      dealPlayerDamage(Math.round(e.damage * 0.85), false, e);
                    } else {
                      e.behavior = 'PATROL';
                    }
                  }
                } else {
                  // Overlord Malakor: Aerial Strafing + Gravity Pull + Area-Denial + Omega Barrage
                  e.y = 325 + Math.sin(totalTimeSec * (e.rageMode ? 3.2 : 2.3)) * 42;
                  const strafeSign = Math.sin(totalTimeSec * 0.9) > 0 ? 1 : -1;
                  const targetX = p.x + strafeSign * 245;
                  e.x += Math.sign(targetX - e.x) * (e.rageMode ? 3.9 : 2.5) * frames;

                  if (e.phase === 2 && distToPlayer < 480 && abilities.dashActiveTimer <= 0) {
                    p.x += Math.sign(e.x - p.x) * 0.85 * frames;
                  }

                  if ((e.hazardCooldown ?? 0) <= 0) {
                    e.hazardCooldown = e.rageMode ? 120 : 170;
                    projectiles.push({
                      id: `mal_haz_${Date.now()}`,
                      x: p.x + (Math.random() - 0.5) * 90,
                      y: 472,
                      vx: 0,
                      vy: -2.1,
                      radius: 14,
                      damage: 24,
                      type: 'LAVA_PILLAR',
                      owner: 'ENEMY',
                      color: '#ef4444',
                      life: 62,
                    });
                  }

                  if ((e.specialCooldown ?? 0) <= 0) {
                    e.specialCooldown = e.rageMode ? 96 : 130;
                    if (e.rageMode && Math.random() < 0.55) {
                      e.unblockableTimer = 50;
                      e.unblockableKind = 'MALAKOR_OMEGA';
                      playBossRoar();
                    } else {
                      e.behavior = 'ATTACK';
                      const fanCount = e.rageMode ? 5 : 3;
                      for (let i = 0; i < fanCount; i++) {
                        const spread = (i - (fanCount - 1) / 2) * 0.23;
                        const baseAng = Math.atan2(p.y - e.y, p.x - e.x) + spread;
                        projectiles.push({
                          id: `mal_${Date.now()}_${i}`,
                          x: e.x,
                          y: e.y,
                          vx: Math.cos(baseAng) * 10.5,
                          vy: Math.sin(baseAng) * 10.5,
                          radius: 10,
                          damage: 24,
                          type: 'LASER_BARRAGE',
                          owner: 'ENEMY',
                          color: e.rageMode ? '#ef4444' : '#f43f5e',
                        });
                      }
                    }
                  } else {
                    e.behavior = 'FLIGHT';
                  }
                }
              }
            } else if (e.type === 'INTERCEPTOR' || e.type === 'HOVER_BIKE') {
              // High-Speed Hypercar Pursuit Enforcers firing Dodgeable/Shootable EMP Missiles
              const isBike = e.type === 'HOVER_BIKE';
              const chaseSpeed = isBike ? 13.8 : 11.4;
              const targetGap = isBike ? 235 : 275;
              const desiredX = p.x + (e.x >= p.x ? targetGap : -targetGap);
              const dx = desiredX - e.x;
              if (Math.abs(dx) > 22) {
                e.x += Math.sign(dx) * Math.min(chaseSpeed * frames, Math.abs(dx));
              }
              if (isBike) {
                e.y = 422 + Math.sin(totalTimeSec * 6.5 + e.x * 0.01) * 18;
              }
              e.behavior = 'CHARGE';

              if ((e.empCooldown ?? 0) <= 0 && distToPlayer < 620) {
                e.empCooldown = isBike ? 105 : 135;
                const ang = Math.atan2(p.y - e.y, p.x - e.x);
                projectiles.push({
                  id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  x: e.x + Math.sign(p.x - e.x) * 34,
                  y: e.y - 12,
                  vx: Math.cos(ang) * 11.2,
                  vy: Math.sin(ang) * 11.2,
                  radius: 11,
                  damage: e.damage,
                  type: 'EMP_MISSILE',
                  owner: 'ENEMY',
                  color: '#a855f7',
                  homing: true,
                  isEmp: true,
                  life: 165,
                });
                playMissileLaunch();
              }
            } else if (distToPlayer < 520) {
              if (e.type === 'HARPY') {
                e.y = 325 + Math.sin(totalTimeSec * 4.2 + e.x * 0.02) * 38;
                const desiredX = p.x + (e.x > p.x ? 165 : -165);
                e.x += Math.sign(desiredX - e.x) * 2.8 * frames;
                if (e.attackCooldown <= 0 && distToPlayer < 360) {
                  e.attackCooldown = 92;
                  const baseAng = Math.atan2(p.y - e.y, p.x - e.x);
                  for (const sp of [-0.14, 0.14]) {
                    projectiles.push({
                      id: `harp_${Date.now()}_${sp}`,
                      x: e.x,
                      y: e.y,
                      vx: Math.cos(baseAng + sp) * 8.4,
                      vy: Math.sin(baseAng + sp) * 8.4,
                      radius: 6,
                      damage: e.damage,
                      type: 'FIREBALL',
                      owner: 'ENEMY',
                      color: '#22d3ee',
                    });
                  }
                }
              } else if (e.type === 'ARCHER') {
                // Rail-Sniper actively kites/strafes away if player rushes in!
                if (distToPlayer < 165) {
                  e.x += (e.facing === 'right' ? -2.6 : 2.6) * frames;
                  if ((e.leapCooldown ?? 0) <= 0 && e.y >= 450) {
                    e.leapCooldown = 120;
                    e.vy = -8.5;
                  }
                } else if (distToPlayer > 330) {
                  e.x += (e.facing === 'right' ? 2.1 : -2.1) * frames;
                }

                if (e.attackCooldown <= 0 && distToPlayer < 450) {
                  e.attackCooldown = 92;
                  projectiles.push({
                    id: `arc_${Date.now()}_${Math.random()}`,
                    x: e.x,
                    y: e.y - 6,
                    vx: e.facing === 'right' ? 11.2 : -11.2,
                    vy: 0,
                    radius: 6,
                    damage: e.damage,
                    type: 'ARROW',
                    owner: 'ENEMY',
                    color: '#c084fc',
                  });
                }
              } else {
                // Cyber-Stalker (SCOUT) & Shield Juggernaut (HEAVY)
                const spd = e.type === 'HEAVY' ? 1.85 : 3.3;
                if (distToPlayer > 36) e.x += (e.facing === 'right' ? spd : -spd) * frames;

                // Gap-closing tactical leap
                if (
                  distToPlayer > 145 &&
                  distToPlayer < 310 &&
                  (e.leapCooldown ?? 0) <= 0 &&
                  e.y >= (e.type === 'HEAVY' ? 438 : 450)
                ) {
                  e.leapCooldown = e.type === 'HEAVY' ? 150 : 95;
                  e.vy = e.type === 'HEAVY' ? -9.5 : -11.2;
                  e.vx = (e.facing === 'right' ? 1 : -1) * (e.type === 'HEAVY' ? 7 : 9.2);
                }

                // Heavy active frontal energy shield stance
                if (e.type === 'HEAVY' && (e.blockCooldown ?? 0) <= 0) {
                  e.blockCooldown = 140;
                  e.blockTimer = 75;
                  e.shieldActive = true;
                }

                if (distToPlayer < 58 && e.attackCooldown <= 0) {
                  e.attackCooldown = e.type === 'HEAVY' ? 62 : 46;
                  e.behavior = 'ATTACK';
                  dealPlayerDamage(e.damage, false, e);
                } else {
                  e.behavior = 'PATROL';
                }
              }
            }
          }
          enemies = survivingEnemies.concat(spawnedReinforcements);

          // Log first contact when spotting nearby hostiles
          const spotted = enemies.find((en) => en.type !== 'BOSS' && Math.abs(en.x - p.x) < 420);
          if (spotted && spotted.id !== lastDetectedEnemyId) {
            lastDetectedEnemyId = spotted.id;
            pushMissionLog(`detect_${spotted.type}`, `Enemy Detected: ${spotted.name}`, 'combat', 'warn', 4.5);
          }

          // Update Projectiles (with Homing Hypercar Missiles, Interceptable EMP Missiles & Aegis Deflection!)
          const nextProj: Projectile[] = [];
          for (const proj of projectiles) {
            if (proj.homing && proj.owner === 'PLAYER') {
              const target = enemies.find((e) => Math.abs(e.x - proj.x) < 620);
              if (target) {
                const dx = target.x - proj.x;
                const dy = target.y - proj.y;
                const mag = Math.max(1, Math.hypot(dx, dy));
                const speed = Math.max(13, Math.hypot(proj.vx, proj.vy));
                proj.vx += ((dx / mag) * speed - proj.vx) * Math.min(1, 0.14 * frames);
                proj.vy += ((dy / mag) * speed - proj.vy) * Math.min(1, 0.14 * frames);
              }
            } else if (proj.homing && proj.isEmp && proj.owner === 'ENEMY') {
              const dx = p.x - proj.x;
              const dy = p.y - proj.y;
              const mag = Math.max(1, Math.hypot(dx, dy));
              const speed = 11.6;
              proj.vx += ((dx / mag) * speed - proj.vx) * Math.min(1, 0.055 * frames);
              proj.vy += ((dy / mag) * speed - proj.vy) * Math.min(1, 0.055 * frames);
            }

            proj.x += proj.vx * frames;
            proj.y += proj.vy * frames;
            if (proj.life !== undefined) {
              proj.life -= frames;
              if (proj.life <= 0) continue;
            }
            if (Math.abs(proj.x - p.x) > 1000 || proj.y < -200 || proj.y > 700) continue;

            let hit = false;
            if (proj.owner === 'PLAYER') {
              // Allow player shots/miniguns to shoot down incoming EMP missiles!
              for (const other of projectiles) {
                if (
                  other.owner === 'ENEMY' &&
                  other.isEmp &&
                  Math.hypot(proj.x - other.x, proj.y - other.y) < proj.radius + other.radius + 14
                ) {
                  other.life = 0;
                  hit = true;
                  burstPool.spawnBurst(other.x, other.y, 0x38bdf8, 12, 5);
                  pushDamageNum(other.x, other.y - 16, 0, true, '#38bdf8', 'EMP SHOT DOWN!');
                  break;
                }
              }
              if (hit) continue;

              for (const tw of tripwires) {
                if (tw.active && !tw.disarmed && Math.abs(proj.x - tw.x) < 20 && Math.abs(proj.y - (tw.y - 24)) < 36) {
                  tw.disarmed = true;
                  tw.active = false;
                  p.gold += 15;
                  hit = true;
                  burstPool.spawnBurst(tw.x, tw.y - 22, 0x22d3ee, 10, 4);
                  pushDamageNum(tw.x, tw.y - 28, 15, false, '#22d3ee', 'TRAP DESTROYED!');
                  break;
                }
              }
              if (hit) continue;

              for (const e of enemies) {
                if (
                  Math.abs(proj.x - e.x) < e.width * 0.55 + proj.radius &&
                  Math.abs(proj.y - e.y) < e.height * 0.55 + proj.radius
                ) {
                  if (proj.type === 'MISSILE') {
                    audioRef.current.playCombatCue('explosion');
                    burstPool.spawnBurst(proj.x, proj.y, 0xf97316, 20, 8);
                    triggerShake(0.22, 10);
                    enemies.forEach((aoeTarget) => {
                      if (Math.hypot(aoeTarget.x - proj.x, aoeTarget.y - proj.y) < 120) {
                        applyDamageToEnemy(aoeTarget, proj.damage, true, true, 'SHOOT');
                      }
                    });
                  } else {
                    applyDamageToEnemy(e, proj.damage, Boolean(proj.deflected), true, 'SHOOT');
                  }
                  hit = true;
                  break;
                }
              }
            } else {
              const dist = Math.hypot(proj.x - p.x, proj.y - p.y);
              if (!proj.unblockable && abilities.aegisActiveTimer > 0 && dist < 68) {
                // Deflect back at enemies with bonus damage!
                proj.owner = 'PLAYER';
                proj.vx = -proj.vx * 1.45;
                proj.vy = -proj.vy * 1.45;
                proj.damage = Math.round(proj.damage * 1.85);
                proj.deflected = true;
                proj.color = '#67e8f9';
                audioRef.current.playCombatCue('parry');
                burstPool.spawnBurst(proj.x, proj.y, 0x67e8f9, 8, 3);
                pushDamageNum(p.x, p.y - 20, 0, false, '#67e8f9', 'DEFLECT!');
              } else if (dist < proj.radius + (car.occupied ? 30 : 18) && (p.hitCooldown <= 0 || proj.isEmp)) {
                if (abilities.dashActiveTimer > 0) {
                  if (!proj.id.endsWith('_dodged')) {
                    proj.id += '_dodged';
                    pushDamageNum(p.x, p.y - 24, 0, false, '#22d3ee', 'DASH DODGE!');
                  }
                } else if (!proj.unblockable && p.actionState === 'PARRYING') {
                  proj.owner = 'PLAYER';
                  proj.vx = -proj.vx * 1.3;
                  proj.vy = -proj.vy * 1.3;
                  proj.deflected = true;
                  audioRef.current.playCombatCue('parry');
                } else {
                  if (proj.isEmp) {
                    playEmpHit();
                    burstPool.spawnBurst(p.x, p.y, 0xa855f7, 20, 8);
                    if (car.occupied) {
                      car.empLockoutTimer = 3.8;
                      car.nitroActive = false;
                      pushDamageNum(p.x, p.y - 28, proj.damage, true, '#c084fc', 'EMP! NITRO LOCKED');
                      pushMissionLog('emp_lockout', 'EMP Strike! Hypercar Nitro Disabled (3.8s)', 'vehicle', 'crit', 2.5);
                    }
                  }
                  dealPlayerDamage(proj.damage, Boolean(proj.unblockable));
                  hit = true;
                }
              }
            }

            if (!hit) nextProj.push(proj);
          }
          projectiles = nextProj;

          if (p.health <= 0 && !gameOverTriggered) {
            p.health = 0;
            gameOverTriggered = true;
            callbacksRef.current.onGameOver();
          }
        }

        if (victoryPending) {
          victoryTimer -= rawDelta;
          if (Math.random() < 0.2) {
            burstPool.spawnBurst(p.x + 220 + (Math.random() - 0.5) * 140, 360, 0xfacc15, 14, 7);
          }
          if (victoryTimer <= 0) {
            victoryPending = false;
            callbacksRef.current.onVictory();
          }
        }

        // Retain wide free-roam corridor behind player for bidirectional exploration
        terrain = terrain.filter((s) => s.x + s.width > p.x - 2600);
        decor = decor.filter((d) => d.x + d.width > p.x - 2600);

        // 3. Sync 3D Scene Objects
        const activeBiome = resolveSoloBiomeStage(curSettings.world, p.distance);
        if (activeBiome !== lastBiomeReported) {
          lastBiomeReported = activeBiome;
          callbacksRef.current.onBiomeChange?.(activeBiome);
          pushMissionLog(
            `biome_${activeBiome}`,
            `Entering ${activeBiome === 'CYBER' ? 'Cyber Metropolis' : activeBiome === 'VOLCANIC' ? 'Volcanic Fortress' : 'Biolume Jungle'}`,
            'world',
            'info',
            4
          );
        }

        const pWX = toWorldX(p.x);
        const pWY = toWorldY(p.y);

        const activeBossNear = enemies.find(
          (en) => en.type === 'BOSS' && en.health > 0 && Math.abs(en.x - p.x) < 920
        );
        const bossAtmosphereActive = Boolean(activeBossNear);
        if (bossAtmosphereActive !== bossAtmospherePrev) {
          bossAtmospherePrev = bossAtmosphereActive;
          setBossAtmosphereAudio(bossAtmosphereActive);
        }

        worldEnv.updateAtmosphere(
          curSettings,
          p.distance,
          pWX,
          pWY,
          totalTimeSec,
          dt,
          true,
          bossAtmosphereActive,
          () => {
            playThunderCrack();
            triggerShake(0.14, 6);
          }
        );
        terrainRenderer.syncTerrain(
          terrain,
          decor,
          activeBiome,
          true,
          totalTimeSec,
          bossAtmosphereActive,
          tripwires
        );

        heroRig.root.visible = !car.occupied;
        if (!car.occupied) {
          updateHeroRig(
            heroRig,
            {
              xPx: p.x,
              yPx: p.y,
              vx: p.vx,
              vy: p.vy,
              facing: p.facing,
              grounded: p.grounded,
              actionState: p.actionState,
              stateTimer: p.stateTimer,
              attackKind: lastAttackKind,
              aegisActiveTimer: abilities.aegisActiveTimer,
              hasDrone: false,
            },
            totalTimeSec
          );
        }

        if (curBonuses.droneSupport) {
          updateSupportDrone3D(
            supportDroneRig,
            {
              xPx: droneSim.x,
              yPx: droneSim.y,
              vx: droneSim.vx,
              facing: p.facing,
              fireFlashTimer: droneSim.fireFlashTimer,
              supportPulseTimer: droneSim.supportPulseTimer,
              targetPx: droneSim.lockedEnemy
                ? { x: droneSim.lockedEnemy.x, y: droneSim.lockedEnemy.y }
                : null,
            },
            totalTimeSec
          );
        }

        updateHypercar3D(
          hypercarRig,
          {
            xPx: car.x,
            yPx: car.y,
            vx: car.vx,
            facing: car.facing,
            occupied: car.occupied,
            nitroActive: car.nitroActive,
            wheelSpin: car.wheelSpin,
            pitch: car.pitch,
            firingMinigun: car.firingMinigunTimer > 0,
            missileCooldownRatio: car.missileCooldown / car.missileMaxCooldown,
          },
          totalTimeSec
        );

        // Sync Stylish 3D Female Allies & City NPCs
        const activeNpcIds = new Set<string>();
        for (const npc of cityNpcs) {
          if (Math.abs(npc.x - p.x) > 1600) continue;
          activeNpcIds.add(npc.id);
          let nEntry = npcMeshes.get(npc.id);
          if (!nEntry) {
            nEntry = buildCityNpc3D(npc, textures.shadowDecal);
            scene.add(nEntry.root);
            npcMeshes.set(npc.id, nEntry);
          }
          updateCityNpc3D(nEntry, npc, p.x, totalTimeSec);
        }
        for (const [id, nEntry] of npcMeshes.entries()) {
          if (!activeNpcIds.has(id)) {
            scene.remove(nEntry.root);
            nEntry.dispose();
            npcMeshes.delete(id);
          }
        }

        dashGhosts.update(dt);
        orbitalRig.update(
          abilities.orbitalBeamTimer > 0,
          abilities.orbitalChargeTimer > 0,
          orbitalTargetX,
          totalTimeSec,
          Math.min(1, abilities.orbitalBeamTimer / 0.65)
        );
        projPool.sync(projectiles, totalTimeSec);
        burstPool.update(dt);

        // Sync 3D Enemy & Boss Meshes
        const activeEnemyIds = new Set<string>();
        let activeBossHud: BossHudState | null = null;
        for (const e of enemies) {
          if (Math.abs(e.x - p.x) > 1200 && e.type !== 'BOSS') continue;
          activeEnemyIds.add(e.id);
          let entry = enemyMeshes.get(e.id);
          if (!entry) {
            entry = buildEnemy3D(e);
            scene.add(entry.group);
            enemyMeshes.set(e.id, entry);
          }
          updateEnemy3D(entry, e, totalTimeSec);

          if (e.type === 'BOSS' && Math.abs(e.x - p.x) < 920) {
            const counterDash = getBossCounterDashState(e);
            const isFinisher = Boolean(counterDash);
            activeBossHud = {
              id: e.bossId || 'malakor',
              name: e.name,
              title: e.bossTitle || 'Apex Overlord',
              health: Math.max(0, e.health),
              maxHealth: e.maxHealth,
              phase: e.phase || 1,
              rageMode: Boolean(e.rageMode),
              milestoneMeters: e.milestoneMeters || 2000,
              armorPct: e.isStunned ? 0 : Math.round((e.armorFactor || 0) * 100),
              unblockableAlert:
                (e.unblockableTimer ?? 0) > 0
                  ? 'UNBLOCKABLE ULTIMATE — CYBER-DASH [Q] NOW!'
                  : null,
              finisherAlert: isFinisher
                ? counterDash?.phase === 'PERFECT'
                  ? `COUNTER-DASH WINDOW OPEN — PRESS [Q / SHIFT] (+${counterDash.bonusPct}% DMG)!`
                  : 'SHIELD-BREAK FINISHER INCOMING — PREPARE COUNTER-DASH [Q]!'
                : null,
              counterDash,
              darkSkyActive: true,
            };
          }
        }
        for (const [id, entry] of enemyMeshes.entries()) {
          if (!activeEnemyIds.has(id)) {
            scene.remove(entry.group);
            entry.dispose();
            enemyMeshes.delete(id);
          }
        }

        // Sync 2000m Princess Crystal Cage
        const cageItem = decor.find((d) => d.type === 'PRINCESS_CAGE');
        if (cageItem) {
          if (!princessCageRig) {
            princessCageRig = buildPrincessCage3D(cageItem);
            scene.add(princessCageRig.group);
          }
          princessCageRig.update(totalTimeSec);
        }

        // Dynamic angled 2.5D/3D Camera with Hypercar speed FOV + zoom & trauma shake
        if (cameraZoomTimer > 0) cameraZoomTimer = Math.max(0, cameraZoomTimer - rawDelta);
        if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - rawDelta);
        else shakeIntensity = 0;

        const targetFov = car.occupied ? (car.nitroActive ? 54 : 47) : 42;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * Math.min(1, rawDelta * 6);
          camera.updateProjectionMatrix();
        }

        const zoomBias = (cameraZoomTimer > 0 ? -2.8 : activeBossHud ? 1.6 : 0) + (car.occupied ? 3.1 : 0);
        const targetCamX = pWX + (car.occupied ? 3.2 : 2.4) + Math.max(-2.4, Math.min(2.4, p.vx * 0.16));
        const targetCamY = Math.max(2.3, Math.min(8.2, pWY + (car.occupied ? 3.1 : 2.45)));
        const targetCamZ = 14.2 + zoomBias;

        camera.position.x += (targetCamX - camera.position.x) * Math.min(1, rawDelta * 7.5);
        camera.position.y += (targetCamY - camera.position.y) * Math.min(1, rawDelta * 6);
        camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, rawDelta * 4.5);

        const sOffX = shakeTimer > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
        const sOffY = shakeTimer > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
        camera.position.x += sOffX;
        camera.position.y += sOffY;

        camera.lookAt(camera.position.x - 0.25, Math.max(1.2, pWY + 1.45), 0);
        camera.rotation.z += Math.max(-0.035, Math.min(0.035, -p.vx * 0.0035));

        // Throttled React HUD sync (~20Hz) + Floating Damage Projection + Vehicle & NPC Prompts
        hudSyncAcc += rawDelta;
        if (hudSyncAcc >= 0.05) {
          hudSyncAcc = 0;
          callbacksRef.current.onPlayerStateUpdate({ ...p });
          callbacksRef.current.onAbilitiesUpdate?.({ ...abilities });
          callbacksRef.current.onBossUpdate?.(activeBossHud);

          const distToCarM = Math.round(Math.abs(p.x - car.x) / 16);
          callbacksRef.current.onVehicleUpdate?.({
            occupied: car.occupied,
            nearCar: !car.occupied && Math.abs(p.x - car.x) < 165,
            distanceToCarM: distToCarM,
            speedKmh: Math.round(Math.abs(car.vx) * 14.8),
            nitro: Math.round(car.nitro),
            nitroActive: car.nitroActive,
            missileCooldown: car.missileCooldown,
            missileMaxCooldown: car.missileMaxCooldown,
            empLockoutTimer: car.empLockoutTimer,
          });

          const nearNpcNow = cityNpcs.find((n) => Math.abs(n.x - p.x) < 130) || null;
          callbacksRef.current.onNearbyNpcChange?.(
            nearNpcNow
              ? {
                  id: nearNpcNow.id,
                  role: nearNpcNow.role,
                  name: nearNpcNow.name,
                  title: nearNpcNow.title,
                  actionLabel: nearNpcNow.actionLabel,
                  dialogue: nearNpcNow.dialogue,
                  accentColor: nearNpcNow.accentColor,
                  cooldownReady: nearNpcNow.cooldownTimer <= 0,
                }
              : null
          );

          const droneSpec = getDroneModelById(curBonuses.activeDroneModel);
          callbacksRef.current.onDroneUpdate?.({
            enabled: curBonuses.droneSupport,
            modelId: droneSpec.id,
            name: droneSpec.name,
            roleLabel: droneSpec.roleLabel,
            accentColor: droneSpec.accentColor,
            statusText: curBonuses.droneSupport ? droneSim.statusText : 'OFFLINE',
            overclocked: curLoadout.gadgetIds.includes('gdg_combat_drone'),
          });

          const cw = container.clientWidth || 1200;
          const ch = container.clientHeight || 675;
          for (let i = worldDmgs.length - 1; i >= 0; i--) {
            worldDmgs[i].age += 0.05;
            worldDmgs[i].wy += 0.09;
            if (worldDmgs[i].age > 0.78) worldDmgs.splice(i, 1);
          }
          const projected: FloatingDamage[] = worldDmgs.map((d) => {
            tempVec3.set(d.wx, d.wy, 0).project(camera);
            return {
              id: d.id,
              screenX: (tempVec3.x * 0.5 + 0.5) * cw,
              screenY: (-tempVec3.y * 0.5 + 0.5) * ch,
              amount: d.amount,
              crit: d.crit,
              label: d.label,
              color: d.color,
              age: d.age,
            };
          });
          callbacksRef.current.onFloatingDamagesUpdate?.(projected);
        }

        pipeline.render(scene, camera);
      } else if (!contextLost) {
        // Keep rendering cleanly when paused so screen doesn't freeze blank
        pipeline.render(scene, camera);
      }

      animHandle = pipeline.afterDraw(tick);
    };

    animHandle = pipeline.afterDraw(tick);

    return () => {
      disposed = true;
      setBossAtmosphereAudio(false);
      pipeline.cancelAfterDraw(animHandle);
      resizeObserver.disconnect();
      pipeline.renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      pipeline.renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseWindowBlur);
      pipeline.renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      pipeline.renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const entry of enemyMeshes.values()) {
        scene.remove(entry.group);
        entry.dispose();
      }
      enemyMeshes.clear();
      if (princessCageRig) {
        scene.remove(princessCageRig.group);
        princessCageRig.dispose();
      }
      for (const nEntry of npcMeshes.values()) {
        scene.remove(nEntry.root);
        nEntry.dispose();
      }
      npcMeshes.clear();
      scene.remove(hypercarRig.root);
      hypercarRig.dispose();
      scene.remove(supportDroneRig.root);
      supportDroneRig.dispose();
      scene.remove(heroRig.root);
      heroRig.dispose();
      dashGhosts.dispose();
      orbitalRig.dispose();
      projPool.dispose();
      burstPool.dispose();
      terrainRenderer.dispose();
      worldEnv.dispose();
      textures.dispose();
      pipeline.dispose();
    };
  }, [characterClass]);

  return <div ref={mountRef} className="w-full h-full relative overflow-hidden bg-zinc-950" />;
}
