import type {
  DroneModelId,
  DroneModelSpec,
  GadgetId,
  OperatorId,
  PlayerLoadout,
  StatBoosts,
  StoreItem,
  WeaponId,
} from '../types';

export const OPERATOR_ITEMS: StoreItem[] = [
  {
    id: 'op_specter_cyan',
    category: 'operators',
    name: 'Kaelen "Specter" Vance',
    subtitle: 'Carbon-Fiber Recon Specialist',
    rarity: 'Rare',
    costCoins: 0,
    costCredits: 0,
    accentColor: '#06b6d4',
    baseColor: '#111827',
    asymmetryNote: 'Facial scar · One-shoulder cape · Cyan cybernetic left arm',
    description:
      'Armored in matte carbon fiber with weathered leather straps, a cyan tactical visor, and a cybernetic left gauntlet.',
    statLabels: ['+25 Max HP', '+20 Shield', '+10% Reload Speed'],
    boosts: {
      maxHealthAdd: 25,
      maxShieldAdd: 20,
      reloadSpeedBonus: 0.1,
    },
    characterClass: 'vanguard',
  },
  {
    id: 'op_phantom_crimson',
    category: 'operators',
    name: 'Ronan "Wraith" Kade',
    subtitle: 'Obsidian Infiltration Assassin',
    rarity: 'Epic',
    costCoins: 650,
    costCredits: 80,
    accentColor: '#ef4444',
    baseColor: '#0f172a',
    asymmetryNote: 'Brow scar · Single-shoulder cloak · Forearm blade prosthetic',
    description:
      'Deep navy stealth armor paired with crimson visor optics, double-jump thrusters, and lethal crit calibration.',
    statLabels: ['+1.2 Move Speed', '+18% Crit Chance', '-3 Dash Cooldown'],
    boosts: {
      moveSpeedAdd: 1.2,
      critChanceAdd: 0.18,
      dashCooldownReduction: 3,
    },
    characterClass: 'shadowblade',
  },
  {
    id: 'op_aegis_gold',
    category: 'operators',
    name: 'Marcus "Aegis" Thorne',
    subtitle: 'Titanium Siege Commander',
    rarity: 'Legendary',
    costCoins: 1200,
    costCredits: 150,
    accentColor: '#facc15',
    baseColor: '#1c241b',
    asymmetryNote: 'Right pauldron mantle · Heavy gold servo prosthetic arm',
    description:
      'Olive-black titanium plating with glowing gold core conduits and an armored servo arm built for sustained firefights.',
    statLabels: ['+50 Max HP', '+35 Shield', '+12 Attack Power'],
    boosts: {
      maxHealthAdd: 50,
      maxShieldAdd: 35,
      attackPowerAdd: 12,
    },
    characterClass: 'spellweaver',
  },
  {
    id: 'op_void_valkyrie',
    category: 'operators',
    name: 'Seraphina "Nebula" Voss',
    subtitle: 'Apex Void-Wing Sovereign',
    rarity: 'Mythic',
    costCoins: 2200,
    costCredits: 260,
    accentColor: '#c084fc',
    baseColor: '#1e1033',
    asymmetryNote: 'Holographic void halo · Twin plasma thrusters · Prismatic visor',
    description:
      'Mythic orbital-grade exo-frame wielding twin void wing emitters, enhanced shield capacitors, and lethal agility.',
    statLabels: ['+65 Max HP', '+50 Shield', '+18 ATK', '+15% Crit'],
    boosts: {
      maxHealthAdd: 65,
      maxShieldAdd: 50,
      attackPowerAdd: 18,
      critChanceAdd: 0.15,
      moveSpeedAdd: 1.4,
    },
    characterClass: 'shadowblade',
  },
];

export const WEAPON_ITEMS: StoreItem[] = [
  {
    id: 'wpn_carbon_gold_ar',
    category: 'weapons',
    name: 'Valkyrie Carbon-Gold AR',
    subtitle: 'Energy-Core Tactical Rifle',
    rarity: 'Rare',
    costCoins: 0,
    costCredits: 0,
    accentColor: '#06b6d4',
    baseColor: '#18181b',
    weaponKind: 'rifle',
    description:
      'Carbon-weave assault rifle with gold hardware, holographic optic, and a cyan plasma core.',
    statLabels: ['+8 Attack Power', '+8% Crit Chance', 'Cyan Energy Bolts'],
    boosts: {
      attackPowerAdd: 8,
      critChanceAdd: 0.08,
    },
  },
  {
    id: 'wpn_crimson_railcarbine',
    category: 'weapons',
    name: 'Ares-45 Crimson Railcarbine',
    subtitle: 'Bayonet Plasma Carbine',
    rarity: 'Epic',
    costCoins: 550,
    costCredits: 70,
    accentColor: '#ef4444',
    baseColor: '#0f172a',
    weaponKind: 'carbine',
    description:
      'High-cycle navy steel railcarbine with crimson holographic sight and a glowing plasma bayonet edge.',
    statLabels: ['+14 Attack Power', '+15% Reload Speed', '+14% Crit Chance'],
    boosts: {
      attackPowerAdd: 14,
      reloadSpeedBonus: 0.15,
      critChanceAdd: 0.14,
    },
  },
  {
    id: 'wpn_olive_arc_rifle',
    category: 'weapons',
    name: 'Aegis X-1 Arc Pulse Rifle',
    subtitle: 'Heavy Neon-Coil Cannon',
    rarity: 'Legendary',
    costCoins: 1100,
    costCredits: 140,
    accentColor: '#38bdf8',
    baseColor: '#273022',
    weaponKind: 'pulse',
    description:
      'Olive titanium pulse cannon trimmed in gold with twin overcharged arc coils delivering heavy kinetic bursts.',
    statLabels: ['+22 Attack Power', '+20% Crit Chance', '+12% Reload Speed'],
    boosts: {
      attackPowerAdd: 22,
      critChanceAdd: 0.2,
      reloadSpeedBonus: 0.12,
    },
  },
  {
    id: 'wpn_mythic_katana',
    category: 'weapons',
    name: 'Eclipse Plasma Katana',
    subtitle: 'Mythic Monomolecular Blade',
    rarity: 'Mythic',
    costCoins: 1850,
    costCredits: 220,
    accentColor: '#f43f5e',
    baseColor: '#18181b',
    weaponKind: 'katana',
    description:
      'Forged titanium katana with a superheated crimson plasma edge, cryo-vented tsuba guard, and wide 3D slash arcs.',
    statLabels: ['+30 Attack Power', '+28% Crit Chance', '+10% Lifesteal'],
    boosts: {
      attackPowerAdd: 30,
      critChanceAdd: 0.28,
      lifestealPercent: 0.1,
    },
  },
  {
    id: 'wpn_mythic_railblade',
    category: 'weapons',
    name: 'Helios Nova-Edge Gunblade',
    subtitle: 'Mythic Plasma Greatsword + Rail',
    rarity: 'Mythic',
    costCoins: 2400,
    costCredits: 290,
    accentColor: '#facc15',
    baseColor: '#241b0c',
    weaponKind: 'gunblade',
    description:
      'Apex mythic hybrid greatsword combining dual accelerator rails, floating gold core rings, and solar blade arcs.',
    statLabels: ['+36 Attack Power', '+24% Crit Chance', '+22% Reload'],
    boosts: {
      attackPowerAdd: 36,
      critChanceAdd: 0.24,
      reloadSpeedBonus: 0.22,
    },
  },
];

export const GADGET_ITEMS: StoreItem[] = [
  {
    id: 'gdg_reactive_armor',
    category: 'gadgets',
    name: 'Titan Reactive Armor Plate',
    subtitle: 'Modular Kinetic Chest Rig',
    rarity: 'Rare',
    costCoins: 0,
    costCredits: 0,
    accentColor: '#facc15',
    baseColor: '#27272a',
    description:
      'Titanium plating bound in weathered leather straps with a gold kinetic shield emitter visible on your chest rig.',
    statLabels: ['+45 Max HP', '+30 Max Shield'],
    boosts: {
      maxHealthAdd: 45,
      maxShieldAdd: 30,
    },
  },
  {
    id: 'gdg_quick_mag',
    category: 'gadgets',
    name: 'T-Core Rapid-Reload Unit',
    subtitle: 'Overclocked Speed Magazine',
    rarity: 'Epic',
    costCoins: 450,
    costCredits: 55,
    accentColor: '#06b6d4',
    baseColor: '#18181b',
    description:
      'Carbon-fiber speed loader and capacitor unit that cuts weapon cycling and dash recovery delays.',
    statLabels: ['+25% Reload Speed', '-6 Dash Cooldown'],
    boosts: {
      reloadSpeedBonus: 0.25,
      dashCooldownReduction: 6,
    },
  },
  {
    id: 'gdg_combat_drone',
    category: 'gadgets',
    name: 'Sentinel MK-IV Overclock Core',
    subtitle: 'Autonomous Drone Booster',
    rarity: 'Legendary',
    costCoins: 850,
    costCredits: 105,
    accentColor: '#22d3ee',
    baseColor: '#09090b',
    description:
      'Overclocks your active Tactical Support Drone with +25% fire/support cycle speed, bonus plasma damage, and critical targeting.',
    statLabels: ['Overclocks Drone', '+8% Crit Chance', '+6 Attack Power'],
    boosts: {
      droneSupport: true,
      critChanceAdd: 0.08,
      attackPowerAdd: 6,
    },
  },
  {
    id: 'gdg_kinetic_servo',
    category: 'gadgets',
    name: 'Apex Nanite Servo Rig',
    subtitle: 'Bio-Kinetic Exosuit Booster',
    rarity: 'Rare',
    costCoins: 350,
    costCredits: 40,
    accentColor: '#34d399',
    baseColor: '#0f172a',
    description:
      'Lightweight exosuit servos paired with combat nanites that restore health on every strike and boost sprint agility.',
    statLabels: ['+8% Lifesteal', '+1.0 Move Speed'],
    boosts: {
      lifestealPercent: 0.08,
      moveSpeedAdd: 1.0,
    },
  },
  {
    id: 'gdg_mythic_wings',
    category: 'gadgets',
    name: 'Valkyrie Chrono-Thruster Pack',
    subtitle: 'Mythic Aero-Jump Harness',
    rarity: 'Mythic',
    costCoins: 1700,
    costCredits: 210,
    accentColor: '#a855f7',
    baseColor: '#1e1033',
    description:
      'Equips glowing articulated 3D thruster wings on your operator, granting an extra air jump, speed surge, and attack amp.',
    statLabels: ['+1 Air Jump', '+1.6 Move Speed', '+14 Attack Power'],
    boosts: {
      doubleJumpAdd: 1,
      moveSpeedAdd: 1.6,
      attackPowerAdd: 14,
    },
  },
];

export const DRONE_MODELS: DroneModelSpec[] = [
  {
    id: 'drone_sentinel',
    name: 'Sentinel Attack Drone',
    shortName: 'Sentinel',
    roleLabel: 'ASSAULT',
    accentColor: '#22d3ee',
    description:
      'Twin-rotor interceptor armed with rapid cyan plasma repeaters and kinetic shield micro-buffers.',
    activeBehavior: 'Auto-fires plasma bursts at hostiles & grants periodic +3 Shield',
    statLabels: ['+6 Attack Power', '+10% Crit Chance'],
    boosts: {
      attackPowerAdd: 6,
      critChanceAdd: 0.1,
    },
  },
  {
    id: 'drone_aegis',
    name: 'Aegis Shield Drone',
    shortName: 'Aegis',
    roleLabel: 'SHIELD',
    accentColor: '#38bdf8',
    description:
      'Armored orbital defense orb projecting continuous shield harmonics and close-range disruptor bolts.',
    activeBehavior: 'Pulses +6 minor Shield every 2.8s & engages close enemies',
    statLabels: ['+25 Max Shield', '+2.2/s Shield Regen'],
    boosts: {
      maxShieldAdd: 25,
      droneShieldRegenAdd: 2.2,
    },
  },
  {
    id: 'drone_medic',
    name: 'Healing Drone',
    shortName: 'Healing',
    roleLabel: 'MEDIC',
    accentColor: '#34d399',
    description:
      'Bio-nanite support unit that continuously repairs operator armor plating and reinforces shields.',
    activeBehavior: 'Restores +5 HP & +3 Shield every 3.2s + light stun fire',
    statLabels: ['+30 Max HP', '+6% Lifesteal'],
    boosts: {
      maxHealthAdd: 30,
      lifestealPercent: 0.06,
    },
  },
  {
    id: 'drone_scanner',
    name: 'Scanner Drone',
    shortName: 'Scanner',
    roleLabel: 'RECON',
    accentColor: '#facc15',
    description:
      'Stealth radar unit that paints enemy weak points with laser telemetry and salvages extra bounty gold.',
    activeBehavior: 'Marks targets (+18% DMG) + fires precision bolts & +25% Gold',
    statLabels: ['+18% Crit Chance', '+1.2 Speed', '+25% Gold'],
    boosts: {
      critChanceAdd: 0.18,
      moveSpeedAdd: 1.2,
      droneGoldMultiplier: 0.25,
      droneScanBonus: 0.18,
    },
  },
];

export const ALL_STORE_ITEMS: StoreItem[] = [
  ...OPERATOR_ITEMS,
  ...WEAPON_ITEMS,
  ...GADGET_ITEMS,
];

export const DEFAULT_OWNED_ITEMS: string[] = [
  'op_specter_cyan',
  'wpn_carbon_gold_ar',
  'gdg_reactive_armor',
];

export const DEFAULT_LOADOUT: PlayerLoadout = {
  operatorId: 'op_specter_cyan',
  weaponId: 'wpn_carbon_gold_ar',
  gadgetIds: ['gdg_reactive_armor', null],
  droneEnabled: true,
  droneModelId: 'drone_sentinel',
};

export function getOperatorById(id: OperatorId): StoreItem {
  return OPERATOR_ITEMS.find((item) => item.id === id) || OPERATOR_ITEMS[0];
}

export function getWeaponById(id: WeaponId): StoreItem {
  return WEAPON_ITEMS.find((item) => item.id === id) || WEAPON_ITEMS[0];
}

export function getGadgetById(id: GadgetId | null): StoreItem | null {
  if (!id) return null;
  return GADGET_ITEMS.find((item) => item.id === id) || null;
}

export function getDroneModelById(id?: DroneModelId | null): DroneModelSpec {
  if (!id) return DRONE_MODELS[0];
  return DRONE_MODELS.find((d) => d.id === id) || DRONE_MODELS[0];
}

export function computeLoadoutBonuses(loadout: PlayerLoadout): StatBoosts {
  const droneActive = loadout.droneEnabled ?? true;
  const droneSpec = getDroneModelById(loadout.droneModelId);

  const result: StatBoosts = {
    maxHealthAdd: 0,
    maxShieldAdd: 0,
    attackPowerAdd: 0,
    critChanceAdd: 0,
    reloadSpeedBonus: 0,
    dashCooldownReduction: 0,
    moveSpeedAdd: 0,
    lifestealPercent: 0,
    droneSupport: droneActive,
    doubleJumpAdd: 0,
    droneShieldRegenAdd: 0,
    droneGoldMultiplier: 0,
    droneScanBonus: 0,
    activeDroneModel: droneActive ? droneSpec.id : null,
  };

  const equipped: StoreItem[] = [
    getOperatorById(loadout.operatorId),
    getWeaponById(loadout.weaponId),
  ];

  loadout.gadgetIds.forEach((gId) => {
    const gadget = getGadgetById(gId);
    if (gadget) equipped.push(gadget);
  });

  equipped.forEach((item) => {
    const b = item.boosts;
    if (b.maxHealthAdd) result.maxHealthAdd += b.maxHealthAdd;
    if (b.maxShieldAdd) result.maxShieldAdd += b.maxShieldAdd;
    if (b.attackPowerAdd) result.attackPowerAdd += b.attackPowerAdd;
    if (b.critChanceAdd) result.critChanceAdd += b.critChanceAdd;
    if (b.reloadSpeedBonus) result.reloadSpeedBonus += b.reloadSpeedBonus;
    if (b.dashCooldownReduction) result.dashCooldownReduction += b.dashCooldownReduction;
    if (b.moveSpeedAdd) result.moveSpeedAdd += b.moveSpeedAdd;
    if (b.lifestealPercent) result.lifestealPercent += b.lifestealPercent;
    if (b.droneSupport) result.droneSupport = true;
    if (b.doubleJumpAdd) result.doubleJumpAdd += b.doubleJumpAdd;
  });

  if (result.droneSupport) {
    result.activeDroneModel = droneSpec.id;
    const db = droneSpec.boosts;
    if (db.maxHealthAdd) result.maxHealthAdd += db.maxHealthAdd;
    if (db.maxShieldAdd) result.maxShieldAdd += db.maxShieldAdd;
    if (db.attackPowerAdd) result.attackPowerAdd += db.attackPowerAdd;
    if (db.critChanceAdd) result.critChanceAdd += db.critChanceAdd;
    if (db.moveSpeedAdd) result.moveSpeedAdd += db.moveSpeedAdd;
    if (db.lifestealPercent) result.lifestealPercent += db.lifestealPercent;
    if (db.droneShieldRegenAdd) result.droneShieldRegenAdd += db.droneShieldRegenAdd;
    if (db.droneGoldMultiplier) result.droneGoldMultiplier += db.droneGoldMultiplier;
    if (db.droneScanBonus) result.droneScanBonus += db.droneScanBonus;
  }

  return result;
}
