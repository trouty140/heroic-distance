import React, { useState } from 'react';
import {
  Shield,
  Flame,
  Sword,
  Trophy,
  Zap,
  Settings,
  Swords,
  Users,
  Coins,
  Gem,
  Briefcase,
  Link2,
} from 'lucide-react';
import type {
  CurrencyWallet,
  GameSettings,
  GameStats,
  PlayerLoadout,
  PvpRoomSummary,
  UserAccount,
  WorldId,
} from '../types';
import { WORLD_LIST, WEATHER_OPTIONS, resolveEffectiveWeather } from '../config/worlds';
import {
  computeLoadoutBonuses,
  getGadgetById,
  getOperatorById,
  getWeaponById,
} from '../config/armory';
import { PedestalCardCanvas3D } from '../three/StorePedestal3D';
import type { User as FirebaseUser } from 'firebase/auth';
import PlayerProfileCard, { type CloudSyncStatus } from './PlayerProfileCard';
import { playUiClick } from '../utils/audio';

interface IntroScreenProps {
  account: UserAccount;
  onUpdateBio: (nextBio: string) => void;
  onSignOut: () => void;
  cloudUser: FirebaseUser | null;
  cloudSyncState: CloudSyncStatus;
  cloudBusy: boolean;
  isGuestPass?: boolean;
  onConnectCloudDb: () => Promise<void>;
  onDisconnectCloudDb: () => Promise<void>;
  onSyncCloudNow: () => Promise<void>;
  onStartGame: (characterClass: 'vanguard' | 'shadowblade' | 'spellweaver') => void;
  onStartPvp: (
    characterClass: 'vanguard' | 'shadowblade' | 'spellweaver',
    playerName: string
  ) => void;
  stats: GameStats;
  settings: GameSettings;
  wallet: CurrencyWallet;
  loadout: PlayerLoadout;
  onSelectWorld: (world: WorldId) => void;
  onOpenSettings: () => void;
  onOpenArmory: () => void;
  onOpenLeaderboard: () => void;
  onOpenPrivateLink: () => void;
  pvpRooms: PvpRoomSummary[];
}

export default function IntroScreen({
  account,
  onUpdateBio,
  onSignOut,
  cloudUser,
  cloudSyncState,
  cloudBusy,
  isGuestPass,
  onConnectCloudDb,
  onDisconnectCloudDb,
  onSyncCloudNow,
  onStartGame,
  onStartPvp,
  stats,
  settings,
  wallet,
  loadout,
  onSelectWorld,
  onOpenSettings,
  onOpenArmory,
  onOpenLeaderboard,
  onOpenPrivateLink,
  pvpRooms,
}: IntroScreenProps) {
  const [selectedClass, setSelectedClass] = useState<'vanguard' | 'shadowblade' | 'spellweaver'>('vanguard');
  const [playerName, setPlayerName] = useState(account.username);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const classes = [
    {
      id: 'vanguard' as const,
      name: 'Vanguard',
      title: 'Iron Bulwark',
      icon: Shield,
      activeBorder: 'border-cyan-400 bg-cyan-950/30 text-cyan-300 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]',
      description: 'Heavily armored specialist with bonus starting shield and high maximum health.',
      stats: { HP: '150', ATK: '18', CRIT: '10%', SPD: 'Normal' },
    },
    {
      id: 'shadowblade' as const,
      name: 'Shadowblade',
      title: 'Swift Phantom',
      icon: Zap,
      activeBorder: 'border-rose-400 bg-rose-950/30 text-rose-300 shadow-[0_0_24px_-8px_rgba(251,113,133,0.45)]',
      description: 'Agile infiltrator featuring native double jump, swift dashes, and high crit rate.',
      stats: { HP: '105', ATK: '20', CRIT: '35%', SPD: 'Fast' },
    },
    {
      id: 'spellweaver' as const,
      name: 'Spellweaver',
      title: 'Crimson Pyromancer',
      icon: Flame,
      activeBorder: 'border-amber-400 bg-amber-950/30 text-amber-300 shadow-[0_0_24px_-8px_rgba(251,191,36,0.45)]',
      description: 'Arcane tactical combatant launching high-velocity fire and plasma projectiles.',
      stats: { HP: '120', ATK: '22', CRIT: '15%', SPD: 'Medium' },
    },
  ];

  const effectiveWeather = resolveEffectiveWeather(settings.world, settings.weather);
  const weatherLabel =
    WEATHER_OPTIONS.find((w) => w.id === effectiveWeather)?.label ?? 'Clear';
  const totalOnline = pvpRooms.reduce((acc, r) => acc + r.playerCount, 0);

  const activeOperator = getOperatorById(loadout.operatorId);
  const activeWeapon = getWeaponById(loadout.weaponId);
  const gadget1 = getGadgetById(loadout.gadgetIds[0]);
  const gadget2 = getGadgetById(loadout.gadgetIds[1]);
  const loadoutBonuses = computeLoadoutBonuses(loadout);

  return (
    <div className="relative w-full h-full flex flex-col justify-between tac-gunmetal p-4 md:p-6 overflow-y-auto">
      <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />

      {/* Top Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/90 pb-3">
        <div className="flex items-center gap-5">
          <span className="font-display font-black text-lg tracking-wider uppercase text-white whitespace-nowrap shrink-0">
            Heroic Distance
          </span>
          <div className="hidden md:flex items-center gap-2.5 text-xs text-zinc-400 font-mono tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              Best {stats.highestDistance}m
            </span>
            <span aria-hidden="true">·</span>
            <span>{weatherLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{settings.graphicsQuality} GFX</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="tac-panel flex items-center gap-3 px-3 py-1.5 rounded-lg border border-zinc-700/80 text-xs font-mono tabular-nums">
            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
              <Coins className="w-3.5 h-3.5" />
              {wallet.coins}
            </span>
            <span className="text-zinc-700">|</span>
            <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold">
              <Gem className="w-3.5 h-3.5" />
              {wallet.credits}
            </span>
          </div>

          <button
            onClick={() => {
              playUiClick();
              onOpenPrivateLink();
            }}
            className="tac-bevel-btn px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/45 text-xs font-display font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Create 30-Minute Expiring Private Link"
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Private Link</span>
          </button>

          <button
            onClick={() => {
              playUiClick();
              onOpenLeaderboard();
            }}
            className="tac-bevel-btn px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-500/45 text-xs font-display font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboards</span>
          </button>

          <button
            onClick={() => {
              playUiClick();
              onOpenArmory();
            }}
            className="tac-bevel-btn px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>3D Armory</span>
          </button>

          <button
            onClick={() => {
              playUiClick();
              onOpenSettings();
            }}
            aria-label="Open Settings"
            className="tac-bevel-btn px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-display font-semibold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-4 my-auto py-3">
        {/* Top Row: Realm Cards (8 cols) + CODM Player Profile Card (4 cols) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="font-display text-xl md:text-2xl font-extrabold text-white tracking-wide uppercase">
                  Select Realm & Combat Mode
                </h1>
                <p className="text-xs text-zinc-400">
                  Equip Mythic blades, operators & thrusters in the 3D Armory before deploying.
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-zinc-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{totalOnline} Global PvP Online</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-grow">
              {WORLD_LIST.map((world) => {
                const isSelected = settings.world === world.id;
                const roomInfo = pvpRooms.find((r) => r.world === world.id);
                const playerCount = roomInfo ? roomInfo.playerCount : 0;

                return (
                  <button
                    key={world.id}
                    onClick={() => {
                      playUiClick();
                      onSelectWorld(world.id);
                    }}
                    className={`tac-panel tac-bevel-btn group text-left rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col ${
                      isSelected
                        ? 'border-amber-400 ring-1 ring-amber-400/50'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="relative h-24 w-full bg-zinc-900 overflow-hidden">
                      {!failedImages[world.id] ? (
                        <img
                          src={world.backdropSrc}
                          alt={world.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [world.id]: true }))
                          }
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-sm font-semibold text-zinc-300"
                          style={{
                            background: `linear-gradient(135deg, ${world.skyTop}, ${world.skyBottom})`,
                          }}
                        >
                          {world.name}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                      <div className="absolute bottom-2 left-2.5 right-2.5">
                        <div className="font-display text-xs font-bold text-white leading-tight uppercase tracking-wide">
                          {world.name}
                        </div>
                        <div className="text-[10px] text-zinc-300 truncate">{world.subtitle}</div>
                      </div>
                    </div>
                    <div className="p-2.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
                      <span className="truncate">{world.arenaName}</span>
                      <span className="text-emerald-400 shrink-0">{playerCount} PvP</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CODM-Style Player Profile Card */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <PlayerProfileCard
              account={account}
              loadout={loadout}
              onUpdateBio={onUpdateBio}
              onSignOut={onSignOut}
              cloudUser={cloudUser}
              cloudSyncState={cloudSyncState}
              cloudBusy={cloudBusy}
              isGuestPass={isGuestPass}
              onConnectCloudDb={onConnectCloudDb}
              onDisconnectCloudDb={onDisconnectCloudDb}
              onSyncCloudNow={onSyncCloudNow}
            />
          </div>
        </section>

        {/* Bottom Row: Active 3D Loadout Banner + Class + Launch */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 flex flex-col gap-3">
            {/* Compact 3D Equipped Loadout Strip */}
            <div className="tac-panel border border-zinc-700/80 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg overflow-hidden border border-cyan-500/45 shrink-0"
                  style={{
                    background: `radial-gradient(circle at 50% 45%, ${activeOperator.accentColor}2c, #09090b 80%)`,
                  }}
                >
                  <PedestalCardCanvas3D item={activeOperator} hovered size={112} />
                </div>
                <div>
                  <div className="font-display text-xs font-bold text-white tracking-wide">
                    {activeOperator.name}
                    <span className="mx-1.5 text-zinc-600">·</span>
                    <span className="text-amber-400 font-semibold">{activeWeapon.name}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                    Gadgets: {gadget1 ? gadget1.name : 'None'}
                    {gadget2 ? ` · ${gadget2.name}` : ''}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-cyan-400 mt-0.5">
                    +{loadoutBonuses.maxHealthAdd} HP · +{loadoutBonuses.attackPowerAdd} ATK
                    {loadoutBonuses.doubleJumpAdd > 0 ? ` · +${loadoutBonuses.doubleJumpAdd} Jump` : ''}
                    {loadoutBonuses.droneSupport
                      ? ` · ${
                          loadout.droneModelId === 'drone_aegis'
                            ? 'Aegis Shield Drone'
                            : loadout.droneModelId === 'drone_medic'
                            ? 'Healing Drone'
                            : loadout.droneModelId === 'drone_scanner'
                            ? 'Scanner Drone'
                            : 'Sentinel Drone'
                        }`
                      : ''}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  playUiClick();
                  onOpenArmory();
                }}
                className="tac-bevel-btn px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-display font-semibold uppercase tracking-wider text-cyan-300 cursor-pointer whitespace-nowrap"
              >
                Customize 3D Loadout
              </button>
            </div>

            {/* Class Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-grow">
              {classes.map((cls) => {
                const Icon = cls.icon;
                const isSelected = selectedClass === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => {
                      playUiClick();
                      setSelectedClass(cls.id);
                    }}
                    className={`tac-panel tac-bevel-btn flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? `${cls.activeBorder} border-2`
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-mono text-zinc-400">{cls.title}</span>
                    </div>
                    <h3 className="font-display font-bold text-sm text-white mt-1.5 uppercase tracking-wide">
                      {cls.name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1 flex-grow">{cls.description}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 pt-2 border-t border-zinc-800/80 font-mono tabular-nums text-[10px] text-zinc-400">
                      <span>HP {cls.stats.HP}</span>
                      <span>ATK {cls.stats.ATK}</span>
                      <span>CRIT {cls.stats.CRIT}</span>
                      <span>SPD {cls.stats.SPD}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Launch Controls */}
          <div className="lg:col-span-4 tac-panel border border-zinc-700/80 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <label className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5" htmlFor="pvp-callsign">
                Online PvP Callsign
              </label>
              <input
                id="pvp-callsign"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={18}
                placeholder="Enter callsign..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  playUiClick();
                  onStartPvp(selectedClass, playerName.trim() || account.username);
                }}
                className="tac-bevel-btn w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold uppercase tracking-wider text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Swords className="w-4 h-4" />
                <span>Enter Global PvP Arena</span>
              </button>

              <button
                onClick={() => {
                  playUiClick();
                  onStartGame(selectedClass);
                }}
                className="tac-bevel-btn w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-display font-semibold uppercase tracking-wider text-xs rounded-lg border border-zinc-600 transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Sword className="w-4 h-4 text-orange-400" />
                <span>Start Solo Odyssey (2,000m)</span>
              </button>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono text-center">
              Move A/D · Jump W/Space · Shoot J/LMB · Slash K/RMB · Dash Q · Aegis E · Orbital R
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
