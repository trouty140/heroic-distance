import React, { useState } from 'react';
import { Award, Edit3, Check, X, LogOut, Crosshair, Trophy } from 'lucide-react';
import type { PlayerLoadout, UserAccount } from '../types';
import { getOperatorById, getWeaponById } from '../config/armory';
import { getRankFromStats } from '../utils/authStorage';
import { TacticalAvatarCrest } from './AuthScreen';
import { playUiClick } from '../utils/audio';

interface PlayerProfileCardProps {
  account: UserAccount;
  loadout: PlayerLoadout;
  onUpdateBio: (nextBio: string) => void;
  onSignOut: () => void;
}

export default function PlayerProfileCard({
  account,
  loadout,
  onUpdateBio,
  onSignOut,
}: PlayerProfileCardProps) {
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(account.bio);

  const rank = getRankFromStats(account.stats);
  const operator = getOperatorById(loadout.operatorId);
  const weapon = getWeaponById(loadout.weaponId);

  const handleSaveBio = () => {
    const trimmed = bioDraft.trim() || 'Ready for deployment.';
    onUpdateBio(trimmed.slice(0, 64));
    setEditingBio(false);
    playUiClick();
  };

  return (
    <div className="tac-panel border border-zinc-700/80 rounded-xl p-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-xl bg-zinc-950/90 border border-cyan-500/35 shadow-[0_0_16px_-6px_rgba(34,211,238,0.45)] shrink-0">
            <TacticalAvatarCrest avatarId={account.avatarId} size={40} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white truncate tracking-wide">
                {account.username}
              </span>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border"
                style={{
                  color: rank.accentHex,
                  borderColor: `${rank.accentHex}55`,
                  backgroundColor: `${rank.accentHex}15`,
                }}
              >
                <Award className="w-3 h-3" />
                {rank.tier}
              </span>
            </div>

            {editingBio ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  maxLength={64}
                  aria-label="Callsign bio"
                  className="px-2 py-0.5 rounded bg-zinc-950 border border-cyan-500/60 text-[11px] text-white w-40 focus:outline-none"
                />
                <button
                  onClick={handleSaveBio}
                  aria-label="Save bio"
                  className="tac-bevel-btn p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    playUiClick();
                    setBioDraft(account.bio);
                    setEditingBio(false);
                  }}
                  aria-label="Cancel bio edit"
                  className="tac-bevel-btn p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-zinc-400 truncate max-w-[190px]">
                  {account.bio}
                </span>
                <button
                  onClick={() => {
                    playUiClick();
                    setBioDraft(account.bio);
                    setEditingBio(true);
                  }}
                  aria-label="Edit callsign bio"
                  className="text-zinc-500 hover:text-cyan-300 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            playUiClick();
            onSignOut();
          }}
          title="Switch / Sign Out Account"
          className="tac-bevel-btn px-2 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
        >
          <LogOut className="w-3 h-3" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Rank XP bar + Quick Stats */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
          <span>Rank Score {rank.points}</span>
          <span>
            {rank.tier === 'Legendary' ? 'Max Rank' : `Next ${rank.nextThreshold}`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${rank.progressPct}%`, backgroundColor: rank.accentHex }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-zinc-800/80 text-[11px] font-mono tabular-nums text-zinc-300">
        <span className="inline-flex items-center gap-1">
          <Crosshair className="w-3 h-3 text-rose-400" />
          {account.stats.enemiesDefeated} Kills
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy className="w-3 h-3 text-amber-400" />
          {account.stats.highestDistance}m Best
        </span>
        <span className="text-cyan-300 truncate max-w-[140px]">
          {operator.name.split('"')[1] || operator.name} · {weapon.name.split(' ')[0]}
        </span>
      </div>
    </div>
  );
}
