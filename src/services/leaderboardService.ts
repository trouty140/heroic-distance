import type {
  GameStats,
  LeaderboardEntry,
  LeaderboardSortMode,
  TacticalAvatarId,
  UserAccount,
} from '../types';
import { getOperatorById } from '../config/armory';
import { getRankFromStats } from '../utils/authStorage';

interface MockOperativeSeed {
  username: string;
  avatarId: TacticalAvatarId;
  highestDistance: number;
  enemiesDefeated: number;
  runs: number;
  operatorName: string;
}

const GLOBAL_OPERATIVE_SEEDS: MockOperativeSeed[] = [
  {
    username: 'Kaelen_Valkyrie',
    avatarId: 'avatar_valkyrie',
    highestDistance: 2000,
    enemiesDefeated: 342,
    runs: 18,
    operatorName: 'Void Valkyrie',
  },
  {
    username: 'NyxProtocol',
    avatarId: 'avatar_wraith',
    highestDistance: 2000,
    enemiesDefeated: 298,
    runs: 15,
    operatorName: 'Crimson Wraith',
  },
  {
    username: 'IronSentinel_X',
    avatarId: 'avatar_aegis',
    highestDistance: 1945,
    enemiesDefeated: 274,
    runs: 14,
    operatorName: 'Golden Aegis',
  },
  {
    username: 'CipherGhost',
    avatarId: 'avatar_specter',
    highestDistance: 1820,
    enemiesDefeated: 236,
    runs: 12,
    operatorName: 'Specter-07',
  },
  {
    username: 'AstraBlade_99',
    avatarId: 'avatar_valkyrie',
    highestDistance: 1680,
    enemiesDefeated: 208,
    runs: 11,
    operatorName: 'Void Valkyrie',
  },
  {
    username: 'VortexReaper',
    avatarId: 'avatar_wraith',
    highestDistance: 1510,
    enemiesDefeated: 184,
    runs: 9,
    operatorName: 'Crimson Wraith',
  },
  {
    username: 'TitanForge',
    avatarId: 'avatar_aegis',
    highestDistance: 1365,
    enemiesDefeated: 159,
    runs: 8,
    operatorName: 'Golden Aegis',
  },
  {
    username: 'ApexZero',
    avatarId: 'avatar_specter',
    highestDistance: 1220,
    enemiesDefeated: 132,
    runs: 7,
    operatorName: 'Specter-07',
  },
  {
    username: 'SolsticeOps',
    avatarId: 'avatar_aegis',
    highestDistance: 980,
    enemiesDefeated: 96,
    runs: 5,
    operatorName: 'Golden Aegis',
  },
  {
    username: 'ShadowVector',
    avatarId: 'avatar_wraith',
    highestDistance: 810,
    enemiesDefeated: 71,
    runs: 4,
    operatorName: 'Crimson Wraith',
  },
];

function computeCompositeScore(highestDistance: number, enemiesDefeated: number): number {
  return Math.round(highestDistance * 2 + enemiesDefeated * 28);
}

export interface GlobalLeaderboardResponse {
  topTen: LeaderboardEntry[];
  selfEntry: LeaderboardEntry | null;
  fetchedAt: number;
  totalTrackedOperatives: number;
}

export async function fetchGlobalLeaderboard(
  currentAccount?: UserAccount | null,
  sortMode: LeaderboardSortMode = 'composite'
): Promise<GlobalLeaderboardResponse> {
  // Simulate realistic network latency for mock global leaderboard API
  await new Promise((resolve) => setTimeout(resolve, 260));

  const entries: Omit<LeaderboardEntry, 'rank'>[] = GLOBAL_OPERATIVE_SEEDS.map((seed) => {
    const fakeStats: GameStats = {
      distanceRun: seed.highestDistance * Math.max(1, Math.floor(seed.runs * 0.6)),
      enemiesDefeated: seed.enemiesDefeated,
      damageDealt: seed.enemiesDefeated * 260,
      goldCollected: seed.enemiesDefeated * 18,
      runs: seed.runs,
      highestDistance: seed.highestDistance,
    };
    const rankEval = getRankFromStats(fakeStats);
    return {
      username: seed.username,
      avatarId: seed.avatarId,
      rankTier: rankEval.tier,
      rankAccentHex: rankEval.accentHex,
      highestDistance: seed.highestDistance,
      enemiesDefeated: seed.enemiesDefeated,
      compositeScore: computeCompositeScore(seed.highestDistance, seed.enemiesDefeated),
      operatorName: seed.operatorName,
      isSelf: false,
    };
  });

  if (currentAccount) {
    const existingIdx = entries.findIndex(
      (e) => e.username.toLowerCase() === currentAccount.username.toLowerCase()
    );
    const rankEval = getRankFromStats(currentAccount.stats);
    const activeOp = getOperatorById(currentAccount.loadout.operatorId);
    const selfRecord: Omit<LeaderboardEntry, 'rank'> = {
      username: currentAccount.username,
      avatarId: currentAccount.avatarId,
      rankTier: rankEval.tier,
      rankAccentHex: rankEval.accentHex,
      highestDistance: Math.round(currentAccount.stats.highestDistance),
      enemiesDefeated: currentAccount.stats.enemiesDefeated,
      compositeScore: computeCompositeScore(
        currentAccount.stats.highestDistance,
        currentAccount.stats.enemiesDefeated
      ),
      operatorName: activeOp.name.split('"')[1] || activeOp.name,
      isSelf: true,
    };

    if (existingIdx !== -1) {
      entries[existingIdx] = selfRecord;
    } else {
      entries.push(selfRecord);
    }
  }

  entries.sort((a, b) => {
    if (sortMode === 'distance') {
      if (b.highestDistance !== a.highestDistance) return b.highestDistance - a.highestDistance;
      return b.enemiesDefeated - a.enemiesDefeated;
    }
    if (sortMode === 'kills') {
      if (b.enemiesDefeated !== a.enemiesDefeated) return b.enemiesDefeated - a.enemiesDefeated;
      return b.highestDistance - a.highestDistance;
    }
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if (b.highestDistance !== a.highestDistance) return b.highestDistance - a.highestDistance;
    return b.enemiesDefeated - a.enemiesDefeated;
  });

  const ranked: LeaderboardEntry[] = entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  return {
    topTen: ranked.slice(0, 10),
    selfEntry: ranked.find((r) => r.isSelf) || null,
    fetchedAt: Date.now(),
    totalTrackedOperatives: 14820 + ranked.length,
  };
}
