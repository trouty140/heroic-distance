import React, { useState, useEffect, useRef } from 'react';
import type {
  BiomeStageId,
  BossHudState,
  BossId,
  CurrencyWallet,
  DroneHudState,
  DroneModelId,
  FloatingDamage,
  GadgetId,
  GamePhase,
  GameSettings,
  GameStats,
  GraphicsQuality,
  MissionLogEntry,
  NearbyNpcPrompt,
  OperatorId,
  PlayerLoadout,
  PlayerState,
  PvpRoomSummary,
  SpecialAbilityState,
  StoreItem,
  UpgradeId,
  UserAccount,
  VehicleHudState,
  VillainCommEvent,
  WeaponId,
  WorldId,
} from './types';
import IntroScreen from './components/IntroScreen';
import AuthScreen from './components/AuthScreen';
import HUD from './components/HUD';
import UpgradeScreen from './components/UpgradeScreen';
import OutroCinematic from './components/OutroCinematic';
import GameCanvas, {
  type ControlActionKind,
  type VirtualControlInput,
} from './components/GameCanvas';
import PvpArena from './components/PvpArena';
import SettingsModal from './components/SettingsModal';
import ArmoryModal from './components/ArmoryModal';
import LeaderboardModal from './components/LeaderboardModal';
import PrivateLinkModal from './components/PrivateLinkModal';
import { DEFAULT_GAME_SETTINGS } from './config/worlds';
import { DEFAULT_LOADOUT, DEFAULT_OWNED_ITEMS } from './config/armory';
import {
  createGuestAccount,
  getActiveAccount,
  signOutAccount,
  updateActiveAccount,
} from './utils/authStorage';
import { Skull, Coins, RefreshCw, Trophy, Settings, Briefcase, Clock } from 'lucide-react';
import * as Sound from './utils/audio';

const SETTINGS_STORAGE_KEY = 'heroic_roguelike_settings';
const SUPPLY_STORAGE_KEY = 'heroic_roguelike_supply_ts';

function normalizeQuality(raw: unknown): GraphicsQuality {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'ultra') return raw;
  if (raw === 'standard') return 'medium';
  return DEFAULT_GAME_SETTINGS.graphicsQuality;
}

export default function App() {
  const [account, setAccount] = useState<UserAccount | null>(() => getActiveAccount());
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [characterClass, setCharacterClass] = useState<'vanguard' | 'shadowblade' | 'spellweaver'>('vanguard');
  const [playerName, setPlayerName] = useState(() => account?.username || 'VanguardOne');
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [armoryOpen, setArmoryOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [privateLinkOpen, setPrivateLinkOpen] = useState(false);
  const [guestPassExpiresAt, setGuestPassExpiresAt] = useState<number | null>(null);
  const [guestPassExpired, setGuestPassExpired] = useState(false);
  const [guestRemainingSec, setGuestRemainingSec] = useState(0);
  const abilityTriggerRef = useRef<((kind: ControlActionKind) => void) | null>(null);
  const virtualControlRef = useRef<VirtualControlInput>({
    left: false,
    right: false,
    shootHeld: false,
    slashHeld: false,
  });
  const [abilities, setAbilities] = useState<SpecialAbilityState>({
    dashCooldown: 0,
    dashMaxCooldown: 2.2,
    dashActiveTimer: 0,
    aegisCooldown: 0,
    aegisMaxCooldown: 9,
    aegisActiveTimer: 0,
    orbitalCooldown: 0,
    orbitalMaxCooldown: 16,
    orbitalChargeTimer: 0,
    orbitalBeamTimer: 0,
    counterDashBonusTimer: 0,
    counterDashDamageBonusPct: 45,
  });
  const [activeBoss, setActiveBoss] = useState<BossHudState | null>(null);
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);
  const [biomeStage, setBiomeStage] = useState<BiomeStageId>('JUNGLE');
  const [calloutText, setCalloutText] = useState<string | null>(null);
  const [missionLogs, setMissionLogs] = useState<MissionLogEntry[]>([]);
  const [vehicleState, setVehicleState] = useState<VehicleHudState>({
    occupied: false,
    nearCar: false,
    distanceToCarM: 16,
    speedKmh: 0,
    nitro: 100,
    nitroActive: false,
    missileCooldown: 0,
    missileMaxCooldown: 2.4,
    empLockoutTimer: 0,
  });
  const [nearbyNpc, setNearbyNpc] = useState<NearbyNpcPrompt | null>(null);
  const [droneState, setDroneState] = useState<DroneHudState | null>(null);
  const [villainComm, setVillainComm] = useState<VillainCommEvent | null>(null);
  const missionRunStartRef = useRef<number>(Date.now());
  const missionLogSeqRef = useRef<number>(0);

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_GAME_SETTINGS,
          ...parsed,
          graphicsQuality: normalizeQuality(parsed.graphicsQuality),
          masterVolume:
            typeof parsed.masterVolume === 'number'
              ? parsed.masterVolume
              : DEFAULT_GAME_SETTINGS.masterVolume,
          sfxVolume:
            typeof parsed.sfxVolume === 'number'
              ? parsed.sfxVolume
              : DEFAULT_GAME_SETTINGS.sfxVolume,
          musicVolume:
            typeof parsed.musicVolume === 'number'
              ? parsed.musicVolume
              : DEFAULT_GAME_SETTINGS.musicVolume,
          touchControlsMode:
            parsed.touchControlsMode === 'auto' ||
            parsed.touchControlsMode === 'always' ||
            parsed.touchControlsMode === 'hide'
              ? parsed.touchControlsMode
              : DEFAULT_GAME_SETTINGS.touchControlsMode,
          controlOpacity:
            typeof parsed.controlOpacity === 'number'
              ? Math.max(0.25, Math.min(1, parsed.controlOpacity))
              : DEFAULT_GAME_SETTINGS.controlOpacity,
          controlScale:
            typeof parsed.controlScale === 'number'
              ? Math.max(0.75, Math.min(1.35, parsed.controlScale))
              : DEFAULT_GAME_SETTINGS.controlScale,
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_GAME_SETTINGS;
  });

  const [wallet, setWallet] = useState<CurrencyWallet>(
    () => account?.wallet || { coins: 500, credits: 75 }
  );
  const [ownedItems, setOwnedItems] = useState<string[]>(
    () => account?.ownedItems || DEFAULT_OWNED_ITEMS
  );
  const [loadout, setLoadout] = useState<PlayerLoadout>(() => ({
    ...DEFAULT_LOADOUT,
    ...(account?.loadout || {}),
    droneEnabled: account?.loadout?.droneEnabled ?? true,
    droneModelId: account?.loadout?.droneModelId ?? 'drone_sentinel',
  }));
  const [stats, setStats] = useState<GameStats>(
    () =>
      account?.stats || {
        distanceRun: 0,
        enemiesDefeated: 0,
        damageDealt: 0,
        goldCollected: 0,
        runs: 0,
        highestDistance: 0,
      }
  );

  const [lastSupplyClaim, setLastSupplyClaim] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SUPPLY_STORAGE_KEY);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [pvpRooms, setPvpRooms] = useState<PvpRoomSummary[]>([]);

  const [player, setPlayer] = useState<PlayerState>({
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    width: 32,
    height: 48,
    grounded: false,
    facing: 'right',
    health: 100,
    maxHealth: 100,
    shield: 0,
    maxShield: 50,
    stamina: 100,
    gold: 0,
    distance: 0,
    doubleJumpsLeft: 1,
    attackCooldown: 0,
    dashCooldown: 0,
    hitCooldown: 0,
    parryCooldown: 0,
    combo: 0,
    comboTimer: 0,
    actionState: 'IDLE',
    stateTimer: 0,
  });

  const [milestonesDone, setMilestonesDone] = useState<number[]>([]);

  const [upgradeModifiers, setUpgradeModifiers] = useState({
    maxHpAdd: 0,
    lifestealPercent: 0,
    dashCooldownAdd: 0,
    dmgAdd: 0,
    shieldRegenRate: 0,
    critRateAdd: 0,
    doubleJumpsAdd: 0,
  });

  // Sync audio mixer settings & persist user preferences
  useEffect(() => {
    Sound.setAudioSettings({
      soundEnabled: settings.soundEnabled,
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
    });
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    if (isPaused || phase !== 'PLAYING') {
      Sound.setBossAtmosphereAudio(false);
    }
  }, [isPaused, phase]);

  // Verify 30-minute private invite token on mount (query param or HttpOnly cookie)
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('guest_invite');
    if (inviteToken) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    const verifyUrl = inviteToken
      ? `/api/private-links/verify?token=${encodeURIComponent(inviteToken)}`
      : '/api/private-links/verify';

    fetch(verifyUrl)
      .then(async (res) => {
        if (!res.ok) {
          if (inviteToken && active) {
            setGuestPassExpired(true);
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!active || !data?.valid || typeof data.expiresAt !== 'number') return;
        setGuestPassExpiresAt(data.expiresAt);
        setGuestRemainingSec(Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)));
        setAccount((prev) => prev || createGuestAccount(String(data.id || '').slice(0, 4)));
      })
      .catch(() => {
        // ignore network check if not an invite session
      });

    return () => {
      active = false;
    };
  }, []);

  // Live countdown & automatic lockout when 30-minute guest pass expires
  useEffect(() => {
    if (!guestPassExpiresAt) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((guestPassExpiresAt - Date.now()) / 1000));
      setGuestRemainingSec(rem);
      if (rem <= 0) {
        Sound.setBossAtmosphereAudio(false);
        setGuestPassExpired(true);
        setGuestPassExpiresAt(null);
        setIsPaused(false);
        setPhase('MENU');
        setAccount(null);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [guestPassExpiresAt]);

  // Persist account wallet, ownedItems, loadout, and stats inside localStorage account record
  useEffect(() => {
    if (!account) return;
    const updated = updateActiveAccount((prev) => ({
      ...prev,
      wallet,
      ownedItems,
      loadout,
      stats,
    }));
    if (updated) {
      setAccount(updated);
    }
  }, [wallet, ownedItems, loadout, stats]);

  // Poll live PvP room counts while on MENU
  useEffect(() => {
    if (!account || phase !== 'MENU') return;
    let active = true;

    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/pvp/rooms');
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.rooms)) {
          setPvpRooms(data.rooms);
        }
      } catch {
        // ignore transient network errors
      }
    };

    fetchRooms();
    const timer = setInterval(fetchRooms, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [account, phase]);

  const handleAuthenticated = (loggedIn: UserAccount) => {
    setAccount(loggedIn);
    setPlayerName(loggedIn.username);
    setWallet(loggedIn.wallet);
    setOwnedItems(Array.from(new Set([...DEFAULT_OWNED_ITEMS, ...loggedIn.ownedItems])));
    setLoadout({
      ...DEFAULT_LOADOUT,
      ...loggedIn.loadout,
      droneEnabled: loggedIn.loadout?.droneEnabled ?? true,
      droneModelId: loggedIn.loadout?.droneModelId ?? 'drone_sentinel',
    });
    setStats(loggedIn.stats);
    setPhase('MENU');
  };

  const handleUpdateBio = (nextBio: string) => {
    const updated = updateActiveAccount((prev) => ({ ...prev, bio: nextBio }));
    if (updated) setAccount(updated);
  };

  const handleSignOut = () => {
    signOutAccount();
    setAccount(null);
    setGuestPassExpiresAt(null);
    setPhase('MENU');
    setIsPaused(false);
    setSettingsOpen(false);
    setArmoryOpen(false);
    setLeaderboardOpen(false);
    setPrivateLinkOpen(false);
  };

  const showCallout = (msg: string, durationMs = 2600) => {
    setCalloutText(msg);
    window.setTimeout(() => {
      setCalloutText((prev) => (prev === msg ? null : prev));
    }, durationMs);
  };

  const appendMissionLog = (
    message: string,
    category: MissionLogEntry['category'] = 'combat',
    severity: MissionLogEntry['severity'] = 'info'
  ) => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - missionRunStartRef.current) / 1000));
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    missionLogSeqRef.current += 1;
    const entry: MissionLogEntry = {
      id: `mlog_${missionLogSeqRef.current}`,
      timestamp: `${mins}:${secs}`,
      message,
      category,
      severity,
    };
    setMissionLogs((prev) => [...prev.slice(-29), entry]);
  };

  const handleStartGame = (chosenClass: 'vanguard' | 'shadowblade' | 'spellweaver') => {
    Sound.startBackgroundMusic();
    setCharacterClass(chosenClass);
    setMilestonesDone([]);
    setActiveBoss(null);
    setFloatingDamages([]);
    setBiomeStage('JUNGLE');
    missionRunStartRef.current = Date.now();
    setMissionLogs([]);
    Sound.setBossAtmosphereAudio(false);
    setVillainComm(null);
    setVehicleState({
      occupied: false,
      nearCar: false,
      distanceToCarM: 16,
      speedKmh: 0,
      nitro: 100,
      nitroActive: false,
      missileCooldown: 0,
      missileMaxCooldown: 2.4,
      empLockoutTimer: 0,
    });
    setNearbyNpc(null);
    setUpgradeModifiers({
      maxHpAdd: 0,
      lifestealPercent: 0,
      dashCooldownAdd: 0,
      dmgAdd: 0,
      shieldRegenRate: 0,
      critRateAdd: 0,
      doubleJumpsAdd: 0,
    });

    setStats((prev) => ({ ...prev, runs: prev.runs + 1 }));
    setIsPaused(false);
    setPhase('PLAYING');
    showCallout("MISSION DEPLOYED · LET'S GO!");
  };

  const handleStartPvp = (
    chosenClass: 'vanguard' | 'shadowblade' | 'spellweaver',
    callsign: string
  ) => {
    Sound.startBackgroundMusic();
    setCharacterClass(chosenClass);
    setPlayerName(callsign || account?.username || 'Wanderer');
    setIsPaused(false);
    setPhase('PVP');
  };

  const handlePauseToggle = () => {
    setIsPaused((prev) => !prev);
  };

  const handleQuitGame = () => {
    Sound.setBossAtmosphereAudio(false);
    setPhase('MENU');
    setIsPaused(false);
    setActiveBoss(null);
    setVillainComm(null);
    setFloatingDamages([]);
    setNearbyNpc(null);
  };

  const handlePlayerStateUpdate = (state: PlayerState) => {
    setPlayer(state);

    if (state.distance >= 1600 && !milestonesDone.includes(1600)) {
      setMilestonesDone((prev) => [...prev, 1600]);
      setWallet((prev) => ({ ...prev, coins: prev.coins + 80, credits: prev.credits + 10 }));
      setIsPaused(true);
      setPhase('UPGRADE');
    }
  };

  const handleBossDefeated = (_bossId: BossId, milestoneMeters: number) => {
    if (!milestonesDone.includes(milestoneMeters)) {
      setMilestonesDone((prev) => [...prev, milestoneMeters]);
    }
    setWallet((prev) => ({
      coins: prev.coins + 120,
      credits: prev.credits + 20,
    }));
    showCallout("BOSS VANQUISHED! LET'S GO! (+120 COINS, +20 CREDITS)");
    setIsPaused(true);
    setPhase('UPGRADE');
  };

  const handleEnemySlain = (goldGained: number) => {
    setStats((prev) => ({
      ...prev,
      enemiesDefeated: prev.enemiesDefeated + 1,
      goldCollected: prev.goldCollected + goldGained,
    }));
    setWallet((prev) => ({
      ...prev,
      coins: prev.coins + goldGained,
    }));
  };

  const handleUpgradeSelect = (upgradeId: UpgradeId) => {
    setUpgradeModifiers((prev) => {
      const next = { ...prev };
      if (upgradeId === 'steel_skin') next.maxHpAdd += 40;
      else if (upgradeId === 'vampire_fangs') next.lifestealPercent += 0.15;
      else if (upgradeId === 'thunder_dash') next.dashCooldownAdd += 10;
      else if (upgradeId === 'dragon_breath') next.dmgAdd += 8;
      else if (upgradeId === 'berserker') {
        next.dmgAdd += 12;
        next.maxHpAdd -= 15;
      } else if (upgradeId === 'shield_battery') next.shieldRegenRate += 1.5;
      else if (upgradeId === 'eagle_eye') next.critRateAdd += 0.25;
      else if (upgradeId === 'adrenaline_rush') next.doubleJumpsAdd += 1;
      return next;
    });

    const upgradeCosts: Record<UpgradeId, number> = {
      steel_skin: 15,
      vampire_fangs: 30,
      thunder_dash: 20,
      dragon_breath: 45,
      berserker: 25,
      shield_battery: 35,
      eagle_eye: 15,
      adrenaline_rush: 50,
    };

    const cost = upgradeCosts[upgradeId] || 15;
    setPlayer((prev) => ({
      ...prev,
      gold: Math.max(0, prev.gold - cost),
      health: prev.maxHealth + (upgradeId === 'steel_skin' ? 40 : 0),
    }));

    setIsPaused(false);
    setPhase('PLAYING');
    showCallout("UPGRADE EQUIPPED · LET'S GO!");
  };

  const handleGameOverTrigger = () => {
    Sound.setBossAtmosphereAudio(false);
    setVillainComm(null);
    const runDist = Math.round(player.distance);
    setStats((prev) => ({
      ...prev,
      distanceRun: prev.distanceRun + runDist,
      highestDistance: Math.max(prev.highestDistance, runDist),
    }));
    setPhase('GAMEOVER');
  };

  const handleVictoryTrigger = () => {
    Sound.setBossAtmosphereAudio(false);
    setVillainComm(null);
    const runDist = 2000;
    setStats((prev) => ({
      ...prev,
      distanceRun: prev.distanceRun + runDist,
      highestDistance: Math.max(prev.highestDistance, runDist),
    }));
    setWallet((prev) => ({
      coins: prev.coins + 300,
      credits: prev.credits + 60,
    }));
    setOwnedItems((prev) => {
      const bonuses = ['op_phantom_crimson', 'wpn_crimson_railcarbine', 'op_aegis_gold'];
      const toUnlock = bonuses.find((id) => !prev.includes(id));
      return toUnlock ? [...prev, toUnlock] : prev;
    });
    setPhase('CINEMATIC');
  };

  const handleWorldSelect = (world: WorldId) => {
    setSettings((prev) => ({ ...prev, world }));
  };

  const handleOpenSettings = () => {
    if (phase === 'PLAYING') {
      setIsPaused(true);
    }
    setSettingsOpen(true);
  };

  const handleOpenArmory = () => {
    if (phase === 'PLAYING') {
      setIsPaused(true);
    }
    setArmoryOpen(true);
  };

  const canClaimSupply = Date.now() - lastSupplyClaim > 1000 * 60 * 60 * 12;

  const handleClaimSupply = () => {
    if (!canClaimSupply) return;
    const now = Date.now();
    setLastSupplyClaim(now);
    try {
      localStorage.setItem(SUPPLY_STORAGE_KEY, String(now));
    } catch {
      // ignore
    }
    Sound.playPowerUp();
    setWallet((prev) => ({
      coins: prev.coins + 200,
      credits: prev.credits + 30,
    }));
  };

  const handleConvertCoinsToCredits = () => {
    if (wallet.coins < 250) return;
    Sound.playCoin();
    setWallet((prev) => ({
      coins: prev.coins - 250,
      credits: prev.credits + 35,
    }));
  };

  const handleBuyItem = (item: StoreItem, currency: 'coins' | 'credits') => {
    if (ownedItems.includes(item.id)) return;
    if (currency === 'coins') {
      if (wallet.coins < item.costCoins) return;
      setWallet((prev) => ({ ...prev, coins: prev.coins - item.costCoins }));
    } else {
      if (wallet.credits < item.costCredits) return;
      setWallet((prev) => ({ ...prev, credits: prev.credits - item.costCredits }));
    }
    Sound.playPowerUp();
    setOwnedItems((prev) => [...prev, item.id]);

    if (item.category === 'operators') {
      setLoadout((prev) => ({ ...prev, operatorId: item.id as OperatorId }));
    } else if (item.category === 'weapons') {
      setLoadout((prev) => ({ ...prev, weaponId: item.id as WeaponId }));
    } else {
      setLoadout((prev) => {
        const gId = item.id as GadgetId;
        if (prev.gadgetIds.includes(gId)) return prev;
        if (!prev.gadgetIds[0]) return { ...prev, gadgetIds: [gId, prev.gadgetIds[1]] };
        if (!prev.gadgetIds[1]) return { ...prev, gadgetIds: [prev.gadgetIds[0], gId] };
        return { ...prev, gadgetIds: [prev.gadgetIds[0], gId] };
      });
    }
  };

  const handleEquipOperator = (id: OperatorId) => {
    if (!ownedItems.includes(id)) return;
    Sound.playCoin();
    setLoadout((prev) => ({ ...prev, operatorId: id }));
  };

  const handleEquipWeapon = (id: WeaponId) => {
    if (!ownedItems.includes(id)) return;
    Sound.playCoin();
    setLoadout((prev) => ({ ...prev, weaponId: id }));
  };

  const handleToggleGadget = (id: GadgetId, targetSlot: 0 | 1 = 0) => {
    if (!ownedItems.includes(id)) return;
    Sound.playCoin();
    setLoadout((prev) => {
      const next: [GadgetId | null, GadgetId | null] = [...prev.gadgetIds] as [
        GadgetId | null,
        GadgetId | null,
      ];
      const existingIdx = next.indexOf(id);
      if (existingIdx !== -1) {
        next[existingIdx] = null;
      } else {
        next[targetSlot] = id;
      }
      return { ...prev, gadgetIds: next };
    });
  };

  const handleToggleDroneEnabled = () => {
    Sound.playCoin();
    setLoadout((prev) => ({
      ...prev,
      droneEnabled: !(prev.droneEnabled ?? true),
    }));
  };

  const handleSelectDroneModel = (modelId: DroneModelId) => {
    Sound.playCoin();
    setLoadout((prev) => ({
      ...prev,
      droneEnabled: true,
      droneModelId: modelId,
    }));
  };

  const handlePvpKillReward = () => {
    setStats((prev) => ({
      ...prev,
      enemiesDefeated: prev.enemiesDefeated + 1,
    }));
    setWallet((prev) => ({
      coins: prev.coins + 35,
      credits: prev.credits + 8,
    }));
  };

  return (
    <div className="relative w-screen h-screen bg-zinc-950 flex flex-col items-center justify-center overflow-hidden p-2 md:p-5 select-none font-sans">
      <div className="relative w-full max-w-6xl aspect-video bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex items-center justify-center">
        {guestPassExpired ? (
          <div className="relative w-full h-full flex items-center justify-center p-6 tac-gunmetal">
            <div className="max-w-md w-full tac-panel border border-rose-500/50 rounded-2xl p-6 text-center shadow-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/70 border border-rose-500/45 text-[11px] font-mono uppercase tracking-widest text-rose-300 mb-3">
                <Clock className="w-3.5 h-3.5" />
                30-Min Private Link Expired
              </div>
              <h2 className="font-display text-2xl font-black text-white uppercase tracking-wide">
                Session Expired
              </h2>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                This 30-minute private invite pass has expired or been revoked by the host. Ask the
                host to generate a new private link, or sign in with your own operative account.
              </p>
              <button
                type="button"
                onClick={() => {
                  Sound.playUiClick();
                  setGuestPassExpired(false);
                }}
                className="tac-bevel-btn mt-5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Open Operative Sign-In
              </button>
            </div>
          </div>
        ) : !account ? (
          <AuthScreen onAuthenticated={handleAuthenticated} />
        ) : (
          <>
            {guestPassExpiresAt && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-3 py-1 rounded-full bg-zinc-950/90 border border-cyan-500/45 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 shadow-lg">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>
                  30m Private Guest Pass · {String(Math.floor(guestRemainingSec / 60)).padStart(2, '0')}:
                  {String(guestRemainingSec % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {phase === 'MENU' && (
              <IntroScreen
                account={account}
                onUpdateBio={handleUpdateBio}
                onSignOut={handleSignOut}
                stats={stats}
                settings={settings}
                wallet={wallet}
                loadout={loadout}
                pvpRooms={pvpRooms}
                onSelectWorld={handleWorldSelect}
                onOpenSettings={handleOpenSettings}
                onOpenArmory={handleOpenArmory}
                onOpenLeaderboard={() => setLeaderboardOpen(true)}
                onOpenPrivateLink={() => setPrivateLinkOpen(true)}
                onStartGame={handleStartGame}
                onStartPvp={handleStartPvp}
              />
            )}

            {(phase === 'PLAYING' || phase === 'UPGRADE') && (
              <div className="absolute inset-0 w-full h-full">
                <GameCanvas
                  characterClass={characterClass}
                  loadout={loadout}
                  onPlayerStateUpdate={handlePlayerStateUpdate}
                  onAbilitiesUpdate={setAbilities}
                  onBossUpdate={setActiveBoss}
                  onVehicleUpdate={setVehicleState}
                  onNearbyNpcChange={setNearbyNpc}
                  onDroneUpdate={setDroneState}
                  onVillainComm={setVillainComm}
                  onMissionLog={appendMissionLog}
                  onFloatingDamagesUpdate={setFloatingDamages}
                  onBiomeChange={(nextBiome) => {
                    setBiomeStage(nextBiome);
                    showCallout(
                      nextBiome === 'VOLCANIC'
                        ? 'ENTERING VOLCANIC FORTRESS'
                        : nextBiome === 'CYBER'
                        ? 'ENTERING CYBER METROPOLIS'
                        : 'BIOLUME JUNGLE'
                    );
                  }}
                  onBossDefeated={handleBossDefeated}
                  onEnemyKilled={handleEnemySlain}
                  onVictory={handleVictoryTrigger}
                  onGameOver={handleGameOverTrigger}
                  abilityTriggerRef={abilityTriggerRef}
                  virtualControlRef={virtualControlRef}
                  isPaused={isPaused}
                  settings={settings}
                  upgradeModifiers={upgradeModifiers}
                />

                <HUD
                  player={player}
                  abilities={abilities}
                  boss={activeBoss}
                  floatingDamages={floatingDamages}
                  biomeStage={biomeStage}
                  calloutText={calloutText}
                  missionLogs={missionLogs}
                  vehicleState={vehicleState}
                  nearbyNpc={nearbyNpc}
                  droneState={droneState}
                  villainComm={villainComm}
                  onOpenArmory={handleOpenArmory}
                  onTriggerAction={(kind) => abilityTriggerRef.current?.(kind)}
                  onVirtualHoldChange={(field, active) => {
                    virtualControlRef.current[field] = active;
                  }}
                  onPauseToggle={handlePauseToggle}
                  isPaused={isPaused}
                  onQuit={handleQuitGame}
                  onOpenSettings={handleOpenSettings}
                  settings={settings}
                />

                {isPaused && phase === 'PLAYING' && !settingsOpen && !armoryOpen && (
                  <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-center pointer-events-auto">
                    <div className="relative w-84 p-6 border border-cyan-500/35 tac-gunmetal tac-glass rounded-2xl shadow-2xl overflow-hidden">
                      <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />
                      <div className="relative z-10">
                        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">
                          Tactical Pause
                        </div>
                        <h3 className="font-display text-xl font-bold text-white tracking-wider uppercase mt-1">
                          Mission Suspended
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Adjust graphics, audio, loadout, or resume your run.
                        </p>

                        <div className="flex flex-col gap-2.5 mt-6">
                          <button
                            onClick={() => {
                              Sound.playUiClick();
                              setIsPaused(false);
                            }}
                            className="tac-bevel-btn w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Resume Run
                          </button>
                          <button
                            onClick={() => {
                              Sound.playUiClick();
                              handleOpenArmory();
                            }}
                            className="tac-bevel-btn w-full py-2.5 bg-zinc-900 border border-cyan-500/45 hover:bg-zinc-800 text-cyan-300 font-display text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>3D Armory & Loadout</span>
                          </button>
                          <button
                            onClick={() => {
                              Sound.playUiClick();
                              handleOpenSettings();
                            }}
                            className="tac-bevel-btn w-full py-2.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-100 font-display text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-amber-400" />
                            <span>Graphics & Sound Settings</span>
                          </button>
                          <button
                            onClick={() => {
                              Sound.playUiClick();
                              handleQuitGame();
                            }}
                            className="tac-bevel-btn w-full py-2.5 bg-zinc-900 border border-rose-500/35 hover:bg-zinc-800 text-rose-400 font-display text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Return to Menu
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {phase === 'PVP' && (
              <PvpArena
                playerName={playerName}
                characterClass={characterClass}
                loadout={loadout}
                settings={settings}
                onOpenSettings={handleOpenSettings}
                onWorldSwitch={handleWorldSelect}
                onKillReward={handlePvpKillReward}
                onExit={handleQuitGame}
              />
            )}

            {phase === 'UPGRADE' && (
              <UpgradeScreen gold={player.gold} onUpgradeSelect={handleUpgradeSelect} />
            )}

            {phase === 'GAMEOVER' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-50 overflow-y-auto">
                <div className="relative w-full max-w-md tac-gunmetal tac-glass border border-rose-500/45 rounded-2xl p-7 flex flex-col items-center overflow-hidden">
                  <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />
                  <div className="relative z-10 flex flex-col items-center w-full">
                    <div className="w-16 h-16 bg-red-950/50 border border-red-500/60 rounded-full flex items-center justify-center text-red-400 mb-4 shadow-[0_0_24px_-4px_rgba(239,68,68,0.6)]">
                      <Skull className="w-8 h-8 stroke-[1.5]" />
                    </div>

                    <h1 className="font-display text-3xl md:text-4xl font-black text-white tracking-wider uppercase">
                      You Were Vanquished
                    </h1>
                    <p className="text-xs font-mono text-zinc-400 mt-2">
                      Distance reached:{' '}
                      <span className="text-zinc-100 font-bold tabular-nums">
                        {Math.round(player.distance)}m
                      </span>
                    </p>

                    <div className="grid grid-cols-2 gap-4 w-full mt-7">
                      <div className="tac-panel p-3 border border-zinc-700/80 rounded-xl">
                        <span className="text-xs text-zinc-400 flex justify-center items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" /> Best Distance
                        </span>
                        <p className="text-md font-bold text-white mt-1 font-mono tabular-nums">
                          {stats.highestDistance}m
                        </p>
                      </div>
                      <div className="tac-panel p-3 border border-zinc-700/80 rounded-xl">
                        <span className="text-xs text-zinc-400 flex justify-center items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-yellow-500" /> Gold Earned
                        </span>
                        <p className="text-md font-bold text-white mt-1 font-mono tabular-nums">
                          {player.gold} Gold
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        Sound.playUiClick();
                        setPhase('MENU');
                      }}
                      className="tac-bevel-btn mt-7 w-full py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-display font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <RefreshCw className="w-4 h-4" /> Play Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'CINEMATIC' && (
              <OutroCinematic stats={stats} onRestart={() => setPhase('MENU')} />
            )}
          </>
        )}
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      <ArmoryModal
        isOpen={armoryOpen}
        onClose={() => setArmoryOpen(false)}
        wallet={wallet}
        ownedItems={ownedItems}
        loadout={loadout}
        canClaimSupply={canClaimSupply}
        onClaimSupply={handleClaimSupply}
        onConvertCoinsToCredits={handleConvertCoinsToCredits}
        onBuyItem={handleBuyItem}
        onEquipOperator={handleEquipOperator}
        onEquipWeapon={handleEquipWeapon}
        onToggleGadget={handleToggleGadget}
        onToggleDroneEnabled={handleToggleDroneEnabled}
        onSelectDroneModel={handleSelectDroneModel}
      />

      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        account={account}
      />

      <PrivateLinkModal
        isOpen={privateLinkOpen}
        onClose={() => setPrivateLinkOpen(false)}
      />
    </div>
  );
}
