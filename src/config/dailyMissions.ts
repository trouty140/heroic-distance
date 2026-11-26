import type { DailyMissionDef, DailyMissionObjectiveType, DailyMissionsState } from '../types';

export const DAILY_MISSIONS: DailyMissionDef[] = [
  {
    id: 'daily_run_500m',
    title: 'Run 500m',
    description: 'Cover 500 meters across hostile sectors on foot or in the hypercar.',
    objectiveType: 'distance',
    target: 500,
    unitLabel: 'm',
    rewardCoins: 180,
    rewardCredits: 25,
    tier: 'Recon',
  },
  {
    id: 'daily_kills_50',
    title: 'Defeat 50 Enemies',
    description: 'Eliminate 50 hostile units across Solo Odyssey or Global PvP.',
    objectiveType: 'kills',
    target: 50,
    rewardCoins: 240,
    rewardCredits: 35,
    tier: 'Assault',
  },
  {
    id: 'daily_gold_150',
    title: 'Collect 150 Gold',
    description: 'Loot 150 Gold from fallen enemies and sector caches.',
    objectiveType: 'gold',
    target: 150,
    rewardCoins: 160,
    rewardCredits: 20,
    tier: 'Recon',
  },
  {
    id: 'daily_runs_2',
    title: 'Deploy 2 Missions',
    description: 'Launch 2 Solo Odyssey deployments from Command Menu.',
    objectiveType: 'runs',
    target: 2,
    rewardCoins: 120,
    rewardCredits: 15,
    tier: 'Recon',
  },
  {
    id: 'daily_boss_1',
    title: 'Vanquish 1 Sector Boss',
    description: 'Defeat any Top-Rank Villain Boss (Vex, Ignis, Specter-9, or Malakor).',
    objectiveType: 'bosses',
    target: 1,
    rewardCoins: 350,
    rewardCredits: 55,
    tier: 'Apex',
  },
];

export function getTodayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createEmptyDailyMissionsState(dateKey = getTodayDateKey()): DailyMissionsState {
  return {
    dateKey,
    progress: {
      daily_run_500m: 0,
      daily_kills_50: 0,
      daily_gold_150: 0,
      daily_runs_2: 0,
      daily_boss_1: 0,
    },
    claimedIds: [],
  };
}

export function ensureTodayDailyMissions(
  existing?: DailyMissionsState | null
): DailyMissionsState {
  const today = getTodayDateKey();
  if (!existing || existing.dateKey !== today) {
    return createEmptyDailyMissionsState(today);
  }
  const normalizedProgress: Record<string, number> = {};
  for (const m of DAILY_MISSIONS) {
    const raw = existing.progress?.[m.id];
    normalizedProgress[m.id] =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  }
  const validIds = new Set(DAILY_MISSIONS.map((m) => m.id));
  const claimedIds = Array.isArray(existing.claimedIds)
    ? Array.from(new Set(existing.claimedIds.filter((id) => validIds.has(id))))
    : [];
  return {
    dateKey: today,
    progress: normalizedProgress,
    claimedIds,
  };
}

export function advanceDailyMissionProgress(
  state: DailyMissionsState,
  objectiveType: DailyMissionObjectiveType,
  amount: number
): DailyMissionsState {
  if (amount <= 0) return state;
  const current = ensureTodayDailyMissions(state);
  let changed = false;
  const nextProgress = { ...current.progress };

  for (const mission of DAILY_MISSIONS) {
    if (mission.objectiveType !== objectiveType) continue;
    const prev = nextProgress[mission.id] || 0;
    const next = Math.min(mission.target, prev + Math.floor(amount));
    if (next !== prev) {
      nextProgress[mission.id] = next;
      changed = true;
    }
  }

  return changed ? { ...current, progress: nextProgress } : current;
}

export function countClaimableDailyMissions(state: DailyMissionsState): number {
  const normalized = ensureTodayDailyMissions(state);
  return DAILY_MISSIONS.filter((m) => {
    const prog = normalized.progress[m.id] || 0;
    return prog >= m.target && !normalized.claimedIds.includes(m.id);
  }).length;
}

export function getTimeUntilDailyReset(): { hours: number; minutes: number } {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalMin = Math.floor(diffMs / 60000);
  return {
    hours: Math.floor(totalMin / 60),
    minutes: totalMin % 60,
  };
}
