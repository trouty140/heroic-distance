import React, { useState } from 'react';
import { Shield, Lock, User, LogIn, UserPlus, ChevronRight } from 'lucide-react';
import type { TacticalAvatarId, UserAccount } from '../types';
import { OPERATOR_ITEMS } from '../config/armory';
import { PedestalInspector3D } from '../three/StorePedestal3D';
import {
  TACTICAL_AVATARS,
  listSavedUsernames,
  loginAccount,
  registerAccount,
} from '../utils/authStorage';
import { playPowerUp, playUiClick } from '../utils/audio';

interface AuthScreenProps {
  onAuthenticated: (account: UserAccount) => void;
}

export function TacticalAvatarCrest({
  avatarId,
  size = 36,
}: {
  avatarId: TacticalAvatarId;
  size?: number;
}) {
  const cfg = TACTICAL_AVATARS.find((a) => a.id === avatarId) || TACTICAL_AVATARS[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label={cfg.label}
      className="shrink-0"
    >
      <polygon
        points="24,3 43,13 43,35 24,45 5,35 5,13"
        fill={cfg.secondaryHex}
        stroke={cfg.accentHex}
        strokeWidth="2.2"
      />
      {avatarId === 'avatar_specter' && (
        <>
          <path d="M12 22 L20 18 L28 18 L36 22 L32 28 L16 28 Z" fill={cfg.accentHex} fillOpacity="0.85" />
          <line x1="15" y1="23" x2="33" y2="23" stroke="#09090b" strokeWidth="2" />
        </>
      )}
      {avatarId === 'avatar_wraith' && (
        <>
          <path d="M14 16 L24 34 L34 16 L24 22 Z" fill={cfg.accentHex} />
          <circle cx="24" cy="17" r="3" fill="#ffffff" />
        </>
      )}
      {avatarId === 'avatar_aegis' && (
        <>
          <path d="M15 14 H33 V25 C33 31 24 36 24 36 C24 36 15 31 15 25 Z" stroke={cfg.accentHex} strokeWidth="2.5" fill={cfg.accentHex} fillOpacity="0.25" />
          <path d="M24 17 V31 M19 22 H29" stroke={cfg.accentHex} strokeWidth="2.2" />
        </>
      )}
      {avatarId === 'avatar_valkyrie' && (
        <>
          <path d="M10 20 L22 26 L24 12 L26 26 L38 20 L28 33 H20 Z" fill={cfg.accentHex} />
          <circle cx="24" cy="12" r="2.5" fill="#22d3ee" />
        </>
      )}
    </svg>
  );
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const savedNames = listSavedUsernames();
  const [mode, setMode] = useState<'login' | 'signup'>(savedNames.length > 0 ? 'login' : 'signup');
  const [username, setUsername] = useState(savedNames[0] || '');
  const [password, setPassword] = useState('');
  const [avatarId, setAvatarId] = useState<TacticalAvatarId>('avatar_specter');
  const [error, setError] = useState<string | null>(null);

  const previewOperator =
    avatarId === 'avatar_wraith'
      ? OPERATOR_ITEMS[1]
      : avatarId === 'avatar_aegis'
      ? OPERATOR_ITEMS[2]
      : avatarId === 'avatar_valkyrie'
      ? OPERATOR_ITEMS[3]
      : OPERATOR_ITEMS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    setError(null);

    if (mode === 'signup') {
      const res = registerAccount({ username, password, avatarId });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      playPowerUp();
      onAuthenticated(res.account);
    } else {
      const res = loginAccount({ username, password });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      playPowerUp();
      onAuthenticated(res.account);
    }
  };

  return (
    <div className="relative w-full h-full tac-gunmetal grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
      <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />

      {/* Left 3D Tactical Showcase Stage */}
      <div className="relative z-10 lg:col-span-6 bg-gradient-to-b from-zinc-900/60 via-zinc-950/75 to-zinc-950/90 border-b lg:border-b-0 lg:border-r border-cyan-500/20 p-6 flex flex-col justify-between min-h-[300px]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/35 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-300">
            <Shield className="w-3.5 h-3.5" />
            <span>Tactical Command Terminal</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-black text-white tracking-wider uppercase mt-2.5">
            Heroic Distance
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-md">
            Authenticate your operative profile to persist combat rank, Mythic armory unlocks, loadout, and global PvP callsign.
          </p>
        </div>

        <div className="relative h-64 md:h-80 w-full my-2 rounded-2xl tac-panel border border-cyan-500/25 overflow-hidden">
          <PedestalInspector3D item={previewOperator} size={360} />
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-t border-zinc-800/80 pt-3">
          <span>Showcase · {previewOperator.name}</span>
          <span className="text-amber-400 font-semibold uppercase">{previewOperator.rarity} Class</span>
        </div>
      </div>

      {/* Right Login / Sign-Up Form */}
      <div className="relative z-10 lg:col-span-6 p-6 md:p-10 flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto tac-glass border border-zinc-700/75 rounded-2xl p-6 flex flex-col gap-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-950/85 border border-zinc-800 gap-1">
            <button
              type="button"
              onClick={() => {
                playUiClick();
                setMode('login');
                setError(null);
              }}
              className={`tac-bevel-btn py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === 'login'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Operative Login</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                setMode('signup');
                setError(null);
              }}
              className={`tac-bevel-btn py-2.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === 'signup'
                  ? 'bg-cyan-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="auth-username" className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5">
                Tactical Callsign (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={18}
                  placeholder="e.g. GhostVanguard"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
              {mode === 'login' && savedNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-zinc-500">Saved:</span>
                  {savedNames.slice(0, 4).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        playUiClick();
                        setUsername(name);
                      }}
                      className="tac-bevel-btn px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-cyan-300 font-mono cursor-pointer"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5">
                Access Passcode (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <div className="text-xs font-display uppercase tracking-wider text-zinc-300 mb-2">
                  Select Tactical Emblem
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {TACTICAL_AVATARS.map((av) => {
                    const active = avatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          playUiClick();
                          setAvatarId(av.id);
                        }}
                        className={`tac-bevel-btn p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                          active
                            ? 'border-cyan-400 bg-cyan-950/40'
                            : 'border-zinc-800 bg-zinc-900/75 hover:border-zinc-700'
                        }`}
                      >
                        <TacticalAvatarCrest avatarId={av.id} size={34} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {av.label}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">{av.role}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="tac-bevel-btn w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>{mode === 'signup' ? 'Enlist & Enter Command' : 'Authenticate & Deploy'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Accounts save locally in your browser with persistent Coins, Credits, Armory skins, and combat Rank progression.
          </p>
        </div>
      </div>
    </div>
  );
}
