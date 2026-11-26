import {
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, googleProvider } from '../firebase';
import { DEFAULT_LOADOUT, DEFAULT_OWNED_ITEMS } from '../config/armory';
import {
  DAILY_MISSIONS,
  createEmptyDailyMissionsState,
  ensureTodayDailyMissions,
} from '../config/dailyMissions';
import type {
  DailyMissionsState,
  GadgetId,
  TacticalAvatarId,
  UserAccount,
} from '../types';

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAINS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
export const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatCloudErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message || '';
  if (raw.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized for Firebase Google Sign-In. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains, or sign in from the AI Studio preview URL.`;
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Allow popups for this site and try again.';
  }
  if (raw.includes('auth/popup-closed-by-user') || raw.includes('auth/cancelled-popup-request')) {
    return 'Google sign-in popup was closed before completion.';
  }
  if (raw.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Too many recovery attempts. Please wait a few minutes before requesting another email.';
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in provider is not enabled yet in Firebase Console → Authentication → Sign-in method.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Network error while contacting Firebase Auth. Check your connection and try again.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No Firebase Auth user was found for that email address.';
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // not JSON
  }
  return raw || fallback;
}

const VALID_AVATARS: TacticalAvatarId[] = [
  'avatar_specter',
  'avatar_wraith',
  'avatar_aegis',
  'avatar_valkyrie',
];

function clampNumber(val: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18);
  return cleaned.length >= 3 ? cleaned : 'Operative';
}

function sanitizeDailyMissionsForCloud(raw?: DailyMissionsState | null): {
  dateKey: string;
  progress: {
    daily_run_500m: number;
    daily_kills_50: number;
    daily_gold_150: number;
    daily_runs_2: number;
    daily_boss_1: number;
  };
  claimedIds: string[];
} {
  const normalized = ensureTodayDailyMissions(raw);
  const allowedIds = new Set(DAILY_MISSIONS.map((m) => m.id));
  return {
    dateKey: normalized.dateKey,
    progress: {
      daily_run_500m: clampNumber(normalized.progress.daily_run_500m, 0, 100000, 0),
      daily_kills_50: clampNumber(normalized.progress.daily_kills_50, 0, 10000, 0),
      daily_gold_150: clampNumber(normalized.progress.daily_gold_150, 0, 100000, 0),
      daily_runs_2: clampNumber(normalized.progress.daily_runs_2, 0, 1000, 0),
      daily_boss_1: clampNumber(normalized.progress.daily_boss_1, 0, 1000, 0),
    },
    claimedIds: normalized.claimedIds.filter((id) => allowedIds.has(id)).slice(0, 5),
  };
}

export interface CloudOperativePayload {
  uid: string;
  username: string;
  avatarId: TacticalAvatarId;
  bio: string;
  wallet: {
    coins: number;
    credits: number;
  };
  stats: {
    distanceRun: number;
    enemiesDefeated: number;
    damageDealt: number;
    goldCollected: number;
    runs: number;
    highestDistance: number;
  };
  ownedItems: string[];
  loadout: {
    operatorId: string;
    weaponId: string;
    gadgetIds: string[];
    droneEnabled: boolean;
    droneModelId: string;
  };
  dailyMissions: {
    dateKey: string;
    progress: {
      daily_run_500m: number;
      daily_kills_50: number;
      daily_gold_150: number;
      daily_runs_2: number;
      daily_boss_1: number;
    };
    claimedIds: string[];
  };
}

export function sanitizeOperativeForCloud(
  uid: string,
  account: UserAccount
): CloudOperativePayload {
  const avatarId: TacticalAvatarId = VALID_AVATARS.includes(account.avatarId)
    ? account.avatarId
    : 'avatar_specter';

  const mergedOwned = Array.from(
    new Set([...DEFAULT_OWNED_ITEMS, ...(account.ownedItems || [])])
  )
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim().slice(0, 64))
    .slice(0, 40);

  const rawGadgets: (GadgetId | null)[] = Array.isArray(account.loadout?.gadgetIds)
    ? [...account.loadout.gadgetIds]
    : [];
  const safeGadgets = rawGadgets
    .filter((g): g is GadgetId => typeof g === 'string' && g.trim().length > 0)
    .map((g) => g.trim().slice(0, 40))
    .slice(0, 2);

  return {
    uid,
    username: sanitizeUsername(account.username || 'Operative'),
    avatarId,
    bio: String(account.bio || 'Ready for deployment.').slice(0, 140),
    wallet: {
      coins: clampNumber(account.wallet?.coins, 0, 10000000, 500),
      credits: clampNumber(account.wallet?.credits, 0, 10000000, 75),
    },
    stats: {
      distanceRun: clampNumber(account.stats?.distanceRun, 0, 100000000, 0),
      enemiesDefeated: clampNumber(account.stats?.enemiesDefeated, 0, 10000000, 0),
      damageDealt: clampNumber(account.stats?.damageDealt, 0, 1000000000, 0),
      goldCollected: clampNumber(account.stats?.goldCollected, 0, 100000000, 0),
      runs: clampNumber(account.stats?.runs, 0, 1000000, 0),
      highestDistance: clampNumber(account.stats?.highestDistance, 0, 100000, 0),
    },
    ownedItems: mergedOwned.length > 0 ? mergedOwned : [...DEFAULT_OWNED_ITEMS],
    loadout: {
      operatorId: String(account.loadout?.operatorId || DEFAULT_LOADOUT.operatorId).slice(0, 40),
      weaponId: String(account.loadout?.weaponId || DEFAULT_LOADOUT.weaponId).slice(0, 40),
      gadgetIds: safeGadgets,
      droneEnabled: Boolean(account.loadout?.droneEnabled ?? true),
      droneModelId: String(account.loadout?.droneModelId || 'drone_sentinel').slice(0, 40),
    },
    dailyMissions: sanitizeDailyMissionsForCloud(account.dailyMissions),
  };
}

export function cloudDocToUserAccount(data: Record<string, unknown>): UserAccount {
  const walletRaw = (data.wallet || {}) as Record<string, unknown>;
  const statsRaw = (data.stats || {}) as Record<string, unknown>;
  const loadoutRaw = (data.loadout || {}) as Record<string, unknown>;
  const gadgetsRaw = Array.isArray(loadoutRaw.gadgetIds) ? loadoutRaw.gadgetIds : [];
  const g0 = typeof gadgetsRaw[0] === 'string' ? (gadgetsRaw[0] as GadgetId) : null;
  const g1 = typeof gadgetsRaw[1] === 'string' ? (gadgetsRaw[1] as GadgetId) : null;

  let createdAtMs = Date.now();
  const rawCreated = data.createdAt as Timestamp | number | undefined;
  if (rawCreated && typeof rawCreated === 'object' && 'toMillis' in rawCreated) {
    createdAtMs = rawCreated.toMillis();
  } else if (typeof rawCreated === 'number') {
    createdAtMs = rawCreated;
  }

  const avatarCandidate = data.avatarId as TacticalAvatarId;
  const avatarId: TacticalAvatarId = VALID_AVATARS.includes(avatarCandidate)
    ? avatarCandidate
    : 'avatar_specter';

  const rawDaily = data.dailyMissions as DailyMissionsState | undefined;

  return {
    username: typeof data.username === 'string' ? data.username : 'Operative',
    passwordHash: '',
    avatarId,
    bio: typeof data.bio === 'string' ? data.bio : 'Ready for deployment.',
    createdAt: createdAtMs,
    wallet: {
      coins: clampNumber(walletRaw.coins, 0, 10000000, 500),
      credits: clampNumber(walletRaw.credits, 0, 10000000, 75),
    },
    stats: {
      distanceRun: clampNumber(statsRaw.distanceRun, 0, 100000000, 0),
      enemiesDefeated: clampNumber(statsRaw.enemiesDefeated, 0, 10000000, 0),
      damageDealt: clampNumber(statsRaw.damageDealt, 0, 1000000000, 0),
      goldCollected: clampNumber(statsRaw.goldCollected, 0, 100000000, 0),
      runs: clampNumber(statsRaw.runs, 0, 1000000, 0),
      highestDistance: clampNumber(statsRaw.highestDistance, 0, 100000, 0),
    },
    ownedItems: Array.isArray(data.ownedItems)
      ? Array.from(
          new Set([
            ...DEFAULT_OWNED_ITEMS,
            ...data.ownedItems.filter((x): x is string => typeof x === 'string'),
          ])
        )
      : [...DEFAULT_OWNED_ITEMS],
    loadout: {
      operatorId:
        typeof loadoutRaw.operatorId === 'string'
          ? (loadoutRaw.operatorId as UserAccount['loadout']['operatorId'])
          : DEFAULT_LOADOUT.operatorId,
      weaponId:
        typeof loadoutRaw.weaponId === 'string'
          ? (loadoutRaw.weaponId as UserAccount['loadout']['weaponId'])
          : DEFAULT_LOADOUT.weaponId,
      gadgetIds: [g0, g1],
      droneEnabled:
        typeof loadoutRaw.droneEnabled === 'boolean' ? loadoutRaw.droneEnabled : true,
      droneModelId:
        typeof loadoutRaw.droneModelId === 'string'
          ? (loadoutRaw.droneModelId as UserAccount['loadout']['droneModelId'])
          : 'drone_sentinel',
    },
    dailyMissions: rawDaily
      ? ensureTodayDailyMissions(rawDaily)
      : createEmptyDailyMissionsState(),
  };
}

export async function connectCloudStorageDb(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function disconnectCloudStorageDb(): Promise<void> {
  await signOut(auth);
}

export async function sendOperativePasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function fetchCloudOperative(uid: string): Promise<UserAccount | null> {
  const path = `operatives/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'operatives', uid));
    if (!snap.exists()) return null;
    return cloudDocToUserAccount(snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertCloudOperative(
  uid: string,
  account: UserAccount
): Promise<void> {
  const path = `operatives/${uid}`;
  const ref = doc(db, 'operatives', uid);
  const sanitized = sanitizeOperativeForCloud(uid, account);

  let exists = false;
  try {
    const existingSnap = await getDoc(ref);
    exists = existingSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (exists) {
    try {
      await updateDoc(ref, {
        username: sanitized.username,
        avatarId: sanitized.avatarId,
        bio: sanitized.bio,
        wallet: sanitized.wallet,
        stats: sanitized.stats,
        ownedItems: sanitized.ownedItems,
        loadout: sanitized.loadout,
        dailyMissions: sanitized.dailyMissions,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(ref, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
