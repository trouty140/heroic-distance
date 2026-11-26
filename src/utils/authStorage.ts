import type {
  GameStats,
  RankTier,
  TacticalAvatarId,
  UserAccount,
} from '../types';
import { DEFAULT_LOADOUT, DEFAULT_OWNED_ITEMS } from '../config/armory';

const ACCOUNTS_KEY = 'heroic_distance_accounts_v1';
const SESSION_KEY = 'heroic_distance_session_v1';

export const TACTICAL_AVATARS: {
  id: TacticalAvatarId;
  label: string;
  role: string;
  accentHex: string;
  secondaryHex: string;
}[] = [
  {
    id: 'avatar_specter',
    label: 'Specter Visor',
    role: 'Recon Ghost',
    accentHex: '#22d3ee',
    secondaryHex: '#083344',
  },
  {
    id: 'avatar_wraith',
    label: 'Crimson Wraith',
    role: 'Strike Assassin',
    accentHex: '#ef4444',
    secondaryHex: '#450a0a',
  },
  {
    id: 'avatar_aegis',
    label: 'Golden Aegis',
    role: 'Siege Commander',
    accentHex: '#facc15',
    secondaryHex: '#422006',
  },
  {
    id: 'avatar_valkyrie',
    label: 'Void Valkyrie',
    role: 'Mythic Sovereign',
    accentHex: '#c084fc',
    secondaryHex: '#3b0764',
  },
];

function hashPasswordSync(username: string, password: string): string {
  const input = `${username.toLowerCase()}::hd_salt_v1::${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function readAccountsMap(): Record<string, UserAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAccountsMap(map: Record<string, UserAccount>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function getActiveSessionUsername(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function getActiveAccount(): UserAccount | null {
  const uname = getActiveSessionUsername();
  if (!uname) return null;
  const map = readAccountsMap();
  return map[uname.toLowerCase()] || null;
}

export function listSavedUsernames(): string[] {
  return Object.values(readAccountsMap()).map((u) => u.username);
}

export function registerAccount(opts: {
  username: string;
  password: string;
  avatarId: TacticalAvatarId;
  autoLogin?: boolean;
}): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const cleanName = opts.username.trim();
  if (cleanName.length < 3 || cleanName.length > 18) {
    return { ok: false, error: 'Callsign must be between 3 and 18 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
    return { ok: false, error: 'Use only letters, numbers, underscores, or hyphens.' };
  }
  if (opts.password.length < 4) {
    return { ok: false, error: 'Passcode must be at least 4 characters.' };
  }

  const key = cleanName.toLowerCase();
  const map = readAccountsMap();
  if (map[key]) {
    return { ok: false, error: 'An operative with that callsign already exists.' };
  }

  const account: UserAccount = {
    username: cleanName,
    passwordHash: hashPasswordSync(cleanName, opts.password),
    avatarId: opts.avatarId,
    bio: 'Ready for deployment.',
    createdAt: Date.now(),
    stats: {
      distanceRun: 0,
      enemiesDefeated: 0,
      damageDealt: 0,
      goldCollected: 0,
      runs: 0,
      highestDistance: 0,
    },
    wallet: { coins: 500, credits: 75 },
    ownedItems: [...DEFAULT_OWNED_ITEMS],
    loadout: {
      operatorId: DEFAULT_LOADOUT.operatorId,
      weaponId: DEFAULT_LOADOUT.weaponId,
      gadgetIds: [...DEFAULT_LOADOUT.gadgetIds] as [typeof DEFAULT_LOADOUT.gadgetIds[0], typeof DEFAULT_LOADOUT.gadgetIds[1]],
      droneEnabled: true,
      droneModelId: 'drone_sentinel',
    },
  };

  map[key] = account;
  writeAccountsMap(map);
  if (opts.autoLogin !== false) {
    try {
      localStorage.setItem(SESSION_KEY, cleanName);
    } catch {}
  }
  return { ok: true, account };
}

export function activateCloudAccount(cloudAccount: UserAccount): UserAccount {
  const map = readAccountsMap();
  const key = cloudAccount.username.toLowerCase();
  const existing = map[key];
  const merged: UserAccount = {
    ...cloudAccount,
    passwordHash: existing?.passwordHash || cloudAccount.passwordHash || '',
  };
  map[key] = merged;
  writeAccountsMap(map);
  try {
    localStorage.setItem(SESSION_KEY, merged.username);
  } catch {}
  return merged;
}

export function loginAccount(opts: {
  username: string;
  password: string;
}): { ok: true; account: UserAccount } | { ok: false; error: string } {
  const cleanName = opts.username.trim();
  if (!cleanName || !opts.password) {
    return { ok: false, error: 'Enter both your callsign and passcode.' };
  }
  const map = readAccountsMap();
  const found = map[cleanName.toLowerCase()];
  if (!found) {
    return { ok: false, error: 'Operative callsign not found. Sign up to create one.' };
  }
  if (found.passwordHash !== hashPasswordSync(found.username, opts.password)) {
    return { ok: false, error: 'Incorrect passcode.' };
  }
  try {
    localStorage.setItem(SESSION_KEY, found.username);
  } catch {}
  return { ok: true, account: found };
}

export function updateActiveAccount(
  updater: (prev: UserAccount) => UserAccount
): UserAccount | null {
  const uname = getActiveSessionUsername();
  if (!uname) return null;
  const map = readAccountsMap();
  const key = uname.toLowerCase();
  const existing = map[key];
  if (!existing) return null;
  const updated = updater(existing);
  map[key] = updated;
  writeAccountsMap(map);
  return updated;
}

export function signOutAccount() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export interface RankEvaluation {
  tier: RankTier;
  points: number;
  nextThreshold: number;
  progressPct: number;
  accentHex: string;
}

const RANK_THRESHOLDS: { tier: RankTier; minPoints: number; accentHex: string }[] = [
  { tier: 'Rookie', minPoints: 0, accentHex: '#94a3b8' },
  { tier: 'Veteran', minPoints: 300, accentHex: '#34d399' },
  { tier: 'Elite', minPoints: 800, accentHex: '#22d3ee' },
  { tier: 'Pro', minPoints: 1500, accentHex: '#60a5fa' },
  { tier: 'Master', minPoints: 2500, accentHex: '#f43f5e' },
  { tier: 'Grandmaster', minPoints: 4000, accentHex: '#facc15' },
  { tier: 'Legendary', minPoints: 6000, accentHex: '#c084fc' },
];

export function getRankFromStats(stats: GameStats): RankEvaluation {
  const points = Math.round(
    stats.enemiesDefeated * 14 +
      stats.highestDistance * 0.65 +
      stats.distanceRun * 0.1 +
      stats.runs * 30
  );

  let idx = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (points >= RANK_THRESHOLDS[i].minPoints) idx = i;
  }

  const current = RANK_THRESHOLDS[idx];
  const next = RANK_THRESHOLDS[idx + 1];
  const progressPct = next
    ? Math.min(
        100,
        Math.max(
          4,
          Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100)
        )
      )
    : 100;

  return {
    tier: current.tier,
    points,
    nextThreshold: next ? next.minPoints : current.minPoints,
    progressPct,
    accentHex: current.accentHex,
  };
}

export function createGuestAccount(tag?: string): UserAccount {
  const code = (tag || Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 6);
  return {
    username: `Guest_${code}`,
    passwordHash: '',
    avatarId: 'avatar_specter',
    bio: '30-Minute Private Pass Operative',
    createdAt: Date.now(),
    stats: {
      distanceRun: 0,
      enemiesDefeated: 0,
      damageDealt: 0,
      goldCollected: 0,
      runs: 0,
      highestDistance: 0,
    },
    wallet: { coins: 500, credits: 75 },
    ownedItems: [...DEFAULT_OWNED_ITEMS],
    loadout: {
      operatorId: DEFAULT_LOADOUT.operatorId,
      weaponId: DEFAULT_LOADOUT.weaponId,
      gadgetIds: [...DEFAULT_LOADOUT.gadgetIds] as [
        typeof DEFAULT_LOADOUT.gadgetIds[0],
        typeof DEFAULT_LOADOUT.gadgetIds[1],
      ],
      droneEnabled: true,
      droneModelId: 'drone_sentinel',
    },
  };
}
