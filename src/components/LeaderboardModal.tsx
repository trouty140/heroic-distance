import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Trophy,
  RefreshCw,
  Skull,
  Milestone,
  Award,
  Medal,
  ShieldAlert,
} from 'lucide-react';
import type { LeaderboardEntry, LeaderboardSortMode, UserAccount } from '../types';
import {
  fetchGlobalLeaderboard,
  type GlobalLeaderboardResponse,
} from '../services/leaderboardService';
import { TacticalAvatarCrest } from './AuthScreen';
import { playUiClick } from '../utils/audio';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount | null;
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  account,
}: LeaderboardModalProps) {
  const [sortMode, setSortMode] = useState<LeaderboardSortMode>('composite');
  const [data, setData] = useState<GlobalLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStandings = useCallback(
    async (mode: LeaderboardSortMode) => {
      setLoading(true);
      try {
        const res = await fetchGlobalLeaderboard(account, mode);
        setData(res);
      } finally {
        setLoading(false);
      }
    },
    [account]
  );

  useEffect(() => {
    if (!isOpen) return;
    loadStandings(sortMode);
  }, [isOpen, sortMode, loadStandings]);

  if (!isOpen) return null;

  const getRankMedalStyle = (rank: number) => {
    if (rank === 1)
      return 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_16px_-4px_rgba(251,191,36,0.6)]';
    if (rank === 2)
      return 'bg-slate-300/15 border-slate-300 text-slate-200 shadow-[0_0_14px_-4px_rgba(203,213,225,0.45)]';
    if (rank === 3)
      return 'bg-orange-500/20 border-orange-400 text-orange-300 shadow-[0_0_14px_-4px_rgba(251,146,60,0.45)]';
    return 'bg-zinc-900/90 border-zinc-700/80 text-zinc-400';
  };

  const renderEntryRow = (entry: LeaderboardEntry, highlightSelfBand = false) => {
    const isTopThree = entry.rank <= 3;
    return (
      <div
        key={`${entry.username}-${entry.rank}-${highlightSelfBand ? 'self' : 'row'}`}
        className={`grid grid-cols-12 items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
          entry.isSelf
            ? 'bg-cyan-950/45 border-cyan-400/75 shadow-[0_0_24px_-8px_rgba(34,211,238,0.55)]'
            : isTopThree
            ? 'tac-panel border-amber-500/30'
            : 'bg-zinc-950/75 border-zinc-800/90 hover:border-zinc-700'
        }`}
      >
        {/* Rank Badge */}
        <div className="col-span-2 sm:col-span-1 flex items-center">
          <span
            className={`w-8 h-8 rounded-lg border font-display font-bold text-xs flex items-center justify-center tabular-nums ${getRankMedalStyle(
              entry.rank
            )}`}
          >
            {entry.rank <= 3 ? <Medal className="w-4 h-4" /> : `#${entry.rank}`}
          </span>
        </div>

        {/* Operative Identity */}
        <div className="col-span-6 sm:col-span-5 flex items-center gap-2.5 min-w-0">
          <TacticalAvatarCrest avatarId={entry.avatarId} size={34} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
                {entry.username}
              </span>
              {entry.isSelf && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-zinc-950 text-[9px] font-mono font-extrabold uppercase shrink-0">
                  YOU
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
              <span style={{ color: entry.rankAccentHex }} className="font-semibold">
                {entry.rankTier}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{entry.operatorName}</span>
            </div>
          </div>
        </div>

        {/* Distance */}
        <div className="col-span-2 text-right font-mono tabular-nums">
          <div className="text-xs font-bold text-amber-300">{entry.highestDistance}m</div>
          <div className="text-[9px] text-zinc-500 uppercase hidden sm:block">Best Dist</div>
        </div>

        {/* Kills */}
        <div className="col-span-2 text-right font-mono tabular-nums">
          <div className="text-xs font-bold text-rose-300">{entry.enemiesDefeated}</div>
          <div className="text-[9px] text-zinc-500 uppercase hidden sm:block">Slain</div>
        </div>

        {/* Composite Rank Score */}
        <div className="hidden sm:block sm:col-span-2 text-right font-mono tabular-nums">
          <div className="text-xs font-bold text-cyan-300">
            {entry.compositeScore.toLocaleString()}
          </div>
          <div className="text-[9px] text-zinc-500 uppercase">Rating</div>
        </div>
      </div>
    );
  };

  const selfInTopTen = Boolean(data?.topTen.some((e) => e.isSelf));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Global Leaderboards"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] tac-gunmetal tac-glass border border-cyan-500/35 rounded-2xl overflow-hidden flex flex-col">
        {/* Subtle Tactical Scanline Overlay */}
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-45" />

        {/* Top Beveled Header */}
        <header className="relative z-10 px-5 py-4 border-b border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-[0_0_20px_-6px_rgba(251,191,36,0.6)]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">
                Global Vanguard Network
              </div>
              <h2 className="font-display text-xl font-bold text-white tracking-wide uppercase">
                Top 10 Global Leaderboards
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playUiClick();
                loadStandings(sortMode);
              }}
              disabled={loading}
              className="tac-bevel-btn px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                onClose();
              }}
              aria-label="Close Leaderboards"
              className="tac-bevel-btn p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Sort Controls & Telemetry */}
        <div className="relative z-10 px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-zinc-800 gap-1">
            {(
              [
                {
                  id: 'composite',
                  label: 'Overall Rank',
                  icon: <Award className="w-3.5 h-3.5" />,
                },
                {
                  id: 'distance',
                  label: 'Max Distance',
                  icon: <Milestone className="w-3.5 h-3.5" />,
                },
                {
                  id: 'kills',
                  label: 'Enemies Slain',
                  icon: <Skull className="w-3.5 h-3.5" />,
                },
              ] as const
            ).map((tab) => {
              const active = sortMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setSortMode(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono tabular-nums text-zinc-400">
            {data
              ? `${data.totalTrackedOperatives.toLocaleString()} Active Operatives Indexed`
              : 'Querying Command Servers...'}
          </div>
        </div>

        {/* Standings List */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {/* Column Header */}
          <div className="grid grid-cols-12 gap-2 px-3.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            <div className="col-span-2 sm:col-span-1">Rank</div>
            <div className="col-span-6 sm:col-span-5">Operative & Tier</div>
            <div className="col-span-2 text-right">Distance</div>
            <div className="col-span-2 text-right">Slain</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Rating</div>
          </div>

          {loading && !data ? (
            <div className="py-12 text-center text-xs font-mono text-cyan-300">
              Decrypting Global Vanguard Standings...
            </div>
          ) : (
            data?.topTen.map((entry) => renderEntryRow(entry))
          )}

          {data?.selfEntry && !selfInTopTen && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-400 px-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Your Current Global Standing</span>
              </div>
              {renderEntryRow(data.selfEntry, true)}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="relative z-10 px-5 py-3 border-t border-zinc-800/80 bg-zinc-950/75 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
          <span>Rating = (Best Distance × 2) + (Enemies Defeated × 28)</span>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="tac-bevel-btn px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
