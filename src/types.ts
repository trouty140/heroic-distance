export type GamePhase = 'MENU' | 'PLAYING' | 'UPGRADE' | 'CINEMATIC' | 'GAMEOVER' | 'VICTORY' | 'PVP';

export type GameMode = 'SOLO' | 'PVP';

export type WorldId = 'scifi' | 'medieval' | 'postapoc';

export type WeatherCondition =
  | 'auto'
  | 'clear'
  | 'rain'
  | 'storm'
  | 'fog'
  | 'blizzard'
  | 'spores'
  | 'acid_rain'
  | 'solar_flare'
  | 'void_storm';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type TouchControlsMode = 'auto' | 'always' | 'hide';

export interface GameSettings {
  world: WorldId;
  weather: WeatherCondition;
  graphicsQuality: GraphicsQuality;
  volumetricLighting: boolean;
  rayTracedReflections: boolean;
  particlesEnabled: boolean;
  soundEnabled: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  touchControlsMode: TouchControlsMode;
  controlOpacity: number;
  controlScale: number;
}

export type BiomeType = 'FOREST' | 'CAVERN' | 'HELL' | 'SKY_CITADEL' | 'SANCTUM';

export type ItemRarity = 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export type StoreCategory = 'operators' | 'weapons' | 'gadgets';

export type OperatorId =
  | 'op_specter_cyan'
  | 'op_phantom_crimson'
  | 'op_aegis_gold'
  | 'op_void_valkyrie';

export type WeaponId =
  | 'wpn_carbon_gold_ar'
  | 'wpn_crimson_railcarbine'
  | 'wpn_olive_arc_rifle'
  | 'wpn_mythic_katana'
  | 'wpn_mythic_railblade';

export type GadgetId =
  | 'gdg_reactive_armor'
  | 'gdg_quick_mag'
  | 'gdg_combat_drone'
  | 'gdg_kinetic_servo'
  | 'gdg_mythic_wings';

export type DroneModelId =
  | 'drone_sentinel'
  | 'drone_aegis'
  | 'drone_medic'
  | 'drone_scanner';

export interface DroneModelSpec {
  id: DroneModelId;
  name: string;
  shortName: string;
  roleLabel: string;
  accentColor: string;
  description: string;
  activeBehavior: string;
  statLabels: string[];
  boosts: Partial<StatBoosts>;
}

export type TacticalAvatarId =
  | 'avatar_specter'
  | 'avatar_wraith'
  | 'avatar_aegis'
  | 'avatar_valkyrie';

export type RankTier =
  | 'Rookie'
  | 'Veteran'
  | 'Elite'
  | 'Pro'
  | 'Master'
  | 'Grandmaster'
  | 'Legendary';

export interface UserAccount {
  username: string;
  passwordHash: string;
  avatarId: TacticalAvatarId;
  bio: string;
  createdAt: number;
  stats: GameStats;
  wallet: CurrencyWallet;
  ownedItems: string[];
  loadout: PlayerLoadout;
}

export interface CurrencyWallet {
  coins: number;
  credits: number;
}

export interface StatBoosts {
  maxHealthAdd: number;
  maxShieldAdd: number;
  attackPowerAdd: number;
  critChanceAdd: number;
  reloadSpeedBonus: number;
  dashCooldownReduction: number;
  moveSpeedAdd: number;
  lifestealPercent: number;
  droneSupport: boolean;
  doubleJumpAdd: number;
  droneShieldRegenAdd: number;
  droneGoldMultiplier: number;
  droneScanBonus: number;
  activeDroneModel: DroneModelId | null;
}

export interface StoreItem {
  id: OperatorId | WeaponId | GadgetId;
  category: StoreCategory;
  name: string;
  subtitle: string;
  rarity: ItemRarity;
  costCoins: number;
  costCredits: number;
  accentColor: string;
  baseColor: string;
  asymmetryNote?: string;
  description: string;
  statLabels: string[];
  boosts: Partial<StatBoosts>;
  characterClass?: 'vanguard' | 'shadowblade' | 'spellweaver';
  weaponKind?: 'rifle' | 'carbine' | 'pulse' | 'katana' | 'gunblade';
}

export interface PlayerLoadout {
  operatorId: OperatorId;
  weaponId: WeaponId;
  gadgetIds: [GadgetId | null, GadgetId | null];
  droneEnabled?: boolean;
  droneModelId?: DroneModelId;
}

export interface GameStats {
  distanceRun: number;
  enemiesDefeated: number;
  damageDealt: number;
  goldCollected: number;
  runs: number;
  highestDistance: number;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  stamina: number;
  maxStamina: number;
  attackPower: number;
  critChance: number;
  parryWindow: number;
  doubleJumpsMax: number;
  dashPower: number;
}

export type UpgradeId =
  | 'steel_skin'
  | 'vampire_fangs'
  | 'thunder_dash'
  | 'dragon_breath'
  | 'berserker'
  | 'shield_battery'
  | 'eagle_eye'
  | 'adrenaline_rush';

export interface UpgradeItem {
  id: UpgradeId;
  name: string;
  description: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  cost: number;
  icon: string;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  facing: 'left' | 'right';
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  stamina: number;
  gold: number;
  distance: number;
  doubleJumpsLeft: number;

  attackCooldown: number;
  dashCooldown: number;
  hitCooldown: number;
  parryCooldown: number;

  combo: number;
  comboTimer: number;
  actionState: 'IDLE' | 'RUNNING' | 'JUMPING' | 'ATTACKING' | 'DASHING' | 'PARRYING' | 'HIT' | 'DEAD';
  stateTimer: number;
}

export type EnemyType =
  | 'SCOUT'
  | 'ARCHER'
  | 'HARPY'
  | 'HEAVY'
  | 'BOSS'
  | 'INTERCEPTOR'
  | 'HOVER_BIKE';

export type BossId = 'vex' | 'ignis' | 'specter9' | 'malakor';

export type BiomeStageId = 'JUNGLE' | 'VOLCANIC' | 'CYBER';

export interface SpecialAbilityState {
  dashCooldown: number;
  dashMaxCooldown: number;
  dashActiveTimer: number;
  aegisCooldown: number;
  aegisMaxCooldown: number;
  aegisActiveTimer: number;
  orbitalCooldown: number;
  orbitalMaxCooldown: number;
  orbitalChargeTimer: number;
  orbitalBeamTimer: number;
  counterDashBonusTimer: number;
  counterDashDamageBonusPct: number;
}

export interface CounterDashWindowHud {
  phase: 'CHARGING' | 'PERFECT';
  progress: number;
  windowStart: number;
  windowEnd: number;
  bonusPct: number;
  rushHitsLeft: number;
}

export interface BossHudState {
  id: BossId;
  name: string;
  title: string;
  health: number;
  maxHealth: number;
  phase: 1 | 2;
  rageMode: boolean;
  milestoneMeters: number;
  armorPct?: number;
  unblockableAlert?: string | null;
  finisherAlert?: string | null;
  counterDash?: CounterDashWindowHud | null;
  darkSkyActive?: boolean;
}

export interface VillainCommEvent {
  id: string;
  bossId: BossId;
  bossName: string;
  bossTitle: string;
  accentColor: string;
  message: string;
  tone: 'taunt' | 'ambush' | 'pursuit' | 'finisher';
  timestamp: number;
}

export interface HazardTripwire {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  disarmed: boolean;
  color: string;
}

export interface FloatingDamage {
  id: string;
  screenX: number;
  screenY: number;
  amount: number;
  crit: boolean;
  label?: string;
  color: string;
  age: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  bossId?: BossId;
  bossTitle?: string;
  milestoneMeters?: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  maxHealth: number;
  health: number;
  damage: number;
  facing: 'left' | 'right';
  behavior: 'PATROL' | 'CHARGE' | 'ATTACK' | 'STUNNED' | 'FLIGHT' | 'TELEGRAPH' | 'RAGE';
  behaviorTimer: number;
  attackCooldown: number;
  specialCooldown?: number;
  telegraphTimer?: number;
  telegraphTargetX?: number;
  telegraphTargetY?: number;
  isStunned: boolean;
  stunDuration: number;
  shieldChance?: number;
  shieldActive?: boolean;
  armorFactor?: number;
  dodgeCooldown?: number;
  blockTimer?: number;
  blockCooldown?: number;
  leapCooldown?: number;
  comboStep?: number;
  comboTimer?: number;
  unblockableTimer?: number;
  unblockableKind?: 'VEX_CLEAVE' | 'IGNIS_SUPERNOVA' | 'SPECTER_EXECUTION' | 'MALAKOR_OMEGA';
  minionCooldown?: number;
  hazardCooldown?: number;
  empCooldown?: number;
  finisherCooldown?: number;
  finisherWindupTimer?: number;
  finisherTotalWindup?: number;
  finisherRushHitsLeft?: number;
  ambushTriggered?: boolean;
  pursuitVehicle?: boolean;
  rageMode?: boolean;
  phase?: 1 | 2;
  cloneOffsets?: number[];
  color: string;
  scoreValue: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  type:
    | 'ARROW'
    | 'FIREBALL'
    | 'SHOCKWAVE'
    | 'PLASMA'
    | 'METEOR'
    | 'VOID_BEAM'
    | 'LASER_BARRAGE'
    | 'LAVA_PILLAR'
    | 'MISSILE'
    | 'EMP_MISSILE';
  owner: 'PLAYER' | 'ENEMY';
  color: string;
  life?: number;
  deflected?: boolean;
  unblockable?: boolean;
  homing?: boolean;
  isEmp?: boolean;
}

export interface TerrainSegment {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'GROUND' | 'BRIDGE' | 'PLATFORM' | 'SPIKES' | 'LAVA' | 'SPRING' | 'RAMP' | 'HIGHWAY';
  rampEndY?: number;
}

export interface DecorItem {
  x: number;
  y: number;
  type:
    | 'TREE'
    | 'RUINS'
    | 'GRASS'
    | 'POTION'
    | 'CHEST'
    | 'GOLD_COIN'
    | 'PRINCESS_CAGE'
    | 'WATERFALL'
    | 'BILLBOARD'
    | 'GARAGE_BAY'
    | 'NEON_LAMP';
  width: number;
  height: number;
  collected?: boolean;
  variant?: number;
}

export interface MissionLogEntry {
  id: string;
  timestamp: string;
  message: string;
  category: 'combat' | 'boss' | 'vehicle' | 'ally' | 'world';
  severity: 'info' | 'warn' | 'crit' | 'success';
}

export type CityNpcRole = 'racer' | 'operator' | 'mechanic';

export interface CityNpc {
  id: string;
  role: CityNpcRole;
  name: string;
  title: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
  accentColor: string;
  actionLabel: string;
  dialogue: string;
  cooldownTimer: number;
}

export interface NearbyNpcPrompt {
  id: string;
  role: CityNpcRole;
  name: string;
  title: string;
  actionLabel: string;
  dialogue: string;
  accentColor: string;
  cooldownReady: boolean;
}

export interface VehicleHudState {
  occupied: boolean;
  nearCar: boolean;
  distanceToCarM: number;
  speedKmh: number;
  nitro: number;
  nitroActive: boolean;
  missileCooldown: number;
  missileMaxCooldown: number;
  empLockoutTimer: number;
}

export interface DroneHudState {
  enabled: boolean;
  modelId: DroneModelId;
  name: string;
  roleLabel: string;
  accentColor: string;
  statusText: string;
  overclocked: boolean;
}

export interface CombatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  style: 'SPARK' | 'BLOOD' | 'SHIELD' | 'DUST' | 'DASH' | 'GOLD' | 'FORCE' | 'HEART' | 'SMOKE';
}

export interface CinematicState {
  active: boolean;
  stage: 'BOSS_INTRO' | 'PRINCESS_RESCUE' | 'KISS' | 'FINISHED';
  timer: number;
  dialogIndex: number;
}

export interface PvpPlayerSnapshot {
  id: string;
  name: string;
  characterClass: 'vanguard' | 'shadowblade' | 'spellweaver';
  operatorId?: OperatorId;
  weaponId?: WeaponId;
  gadgetIds?: GadgetId[];
  hasDrone?: boolean;
  world: WorldId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  actionState: PlayerState['actionState'];
  kills: number;
  deaths: number;
  alive: boolean;
  respawnTimer: number;
}

export interface PvpProjectileSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'FIREBALL' | 'PLASMA';
}

export interface PvpRoomSummary {
  id: string;
  name: string;
  world: WorldId;
  playerCount: number;
  maxPlayers: number;
}

export interface PvpChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

export interface PvpCombatEvent {
  type: 'hit' | 'parry' | 'kill' | 'dodge' | 'dash' | 'attack';
  attackerId: string;
  targetId?: string;
  x: number;
  y: number;
  damage?: number;
  crit?: boolean;
}

export type LeaderboardSortMode = 'composite' | 'distance' | 'kills';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarId: TacticalAvatarId;
  rankTier: RankTier;
  rankAccentHex: string;
  highestDistance: number;
  enemiesDefeated: number;
  compositeScore: number;
  operatorName: string;
  isSelf?: boolean;
}
