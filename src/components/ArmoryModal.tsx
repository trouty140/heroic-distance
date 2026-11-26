import React, { useMemo, useState } from 'react';
import {
  X,
  Coins,
  Gem,
  Shield,
  Crosshair,
  Cpu,
  UserCheck,
  Check,
  Gift,
  ArrowRightLeft,
  Sparkles,
  Radar,
  HeartPulse,
  Power,
  Target,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type {
  CurrencyWallet,
  DailyMissionsState,
  DroneModelId,
  GadgetId,
  ItemRarity,
  OperatorId,
  PlayerLoadout,
  StoreCategory,
  StoreItem,
  WeaponId,
} from '../types';
import {
  DRONE_MODELS,
  GADGET_ITEMS,
  OPERATOR_ITEMS,
  WEAPON_ITEMS,
  computeLoadoutBonuses,
  getDroneModelById,
  getGadgetById,
  getOperatorById,
  getWeaponById,
} from '../config/armory';
import {
  DAILY_MISSIONS,
  countClaimableDailyMissions,
  ensureTodayDailyMissions,
  formatDailyMissionProgressLabel,
  getTimeUntilDailyReset,
} from '../config/dailyMissions';
import { PedestalCardCanvas3D, PedestalInspector3D } from '../three/StorePedestal3D';
import { playPowerUp, playUiClick } from '../utils/audio';

interface ArmoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: CurrencyWallet;
  ownedItems: string[];
  loadout: PlayerLoadout;
  canClaimSupply: boolean;
  onClaimSupply: () => void;
  onConvertCoinsToCredits: () => void;
  onBuyItem: (item: StoreItem, currency: 'coins' | 'credits') => void;
  onEquipOperator: (id: OperatorId) => void;
  onEquipWeapon: (id: WeaponId) => void;
  onToggleGadget: (id: GadgetId, targetSlot?: 0 | 1) => void;
  onToggleDroneEnabled: () => void;
  onSelectDroneModel: (id: DroneModelId) => void;
  dailyMissions: DailyMissionsState;
  onClaimDailyMission: (missionId: string) => void;
  onClaimAllDailyMissions: () => void;
}

const RARITY_STYLES: Record<
  ItemRarity,
  { border: string; label: string; glow: string; badgeBg: string }
> = {
  Rare: {
    border: 'border-cyan-500/45 hover:border-cyan-400',
    label: 'text-cyan-400',
    glow: 'shadow-[0_0_24px_-8px_rgba(6,182,212,0.35)]',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
  },
  Epic: {
    border: 'border-rose-500/45 hover:border-rose-400',
    label: 'text-rose-400',
    glow: 'shadow-[0_0_24px_-8px_rgba(244,63,94,0.38)]',
    badgeBg: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
  },
  Legendary: {
    border: 'border-amber-400/55 hover:border-amber-300',
    label: 'text-amber-400',
    glow: 'shadow-[0_0_28px_-8px_rgba(251,191,36,0.45)]',
    badgeBg: 'bg-amber-500/15 border-amber-400/45 text-amber-300',
  },
  Mythic: {
    border: 'border-purple-400/70 hover:border-purple-300',
    label: 'text-purple-300',
    glow: 'shadow-[0_0_32px_-6px_rgba(192,132,252,0.55)]',
    badgeBg: 'bg-purple-500/20 border-purple-400/60 text-purple-200',
  },
};

const COMPARE_METRICS: {
  key: 'maxHealthAdd' | 'maxShieldAdd' | 'attackPowerAdd' | 'critChanceAdd' | 'reloadSpeedBonus' | 'moveSpeedAdd';
  label: string;
  maxScale: number;
  isPct?: boolean;
}[] = [
  { key: 'maxHealthAdd', label: 'Max HP', maxScale: 80 },
  { key: 'maxShieldAdd', label: 'Armor Shield', maxScale: 60 },
  { key: 'attackPowerAdd', label: 'Attack Power', maxScale: 40 },
  { key: 'critChanceAdd', label: 'Crit Chance', maxScale: 0.35, isPct: true },
  { key: 'reloadSpeedBonus', label: 'Fire / Reload', maxScale: 0.3, isPct: true },
  { key: 'moveSpeedAdd', label: 'Mobility', maxScale: 2.0 },
];

export default function ArmoryModal({
  isOpen,
  onClose,
  wallet,
  ownedItems,
  loadout,
  canClaimSupply,
  onClaimSupply,
  onConvertCoinsToCredits,
  onBuyItem,
  onEquipOperator,
  onEquipWeapon,
  onToggleGadget,
  onToggleDroneEnabled,
  onSelectDroneModel,
  dailyMissions,
  onClaimDailyMission,
  onClaimAllDailyMissions,
}: ArmoryModalProps) {
  const [activeTab, setActiveTab] = useState<StoreCategory | 'daily'>('operators');
  const [activeGadgetSlot, setActiveGadgetSlot] = useState<0 | 1>(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string>(loadout.operatorId);

  const normalizedDaily = useMemo(
    () => ensureTodayDailyMissions(dailyMissions),
    [dailyMissions]
  );
  const claimableDailyCount = useMemo(
    () => countClaimableDailyMissions(normalizedDaily),
    [normalizedDaily]
  );
  const resetWindow = getTimeUntilDailyReset();

  const itemsForTab: StoreItem[] =
    activeTab === 'operators'
      ? OPERATOR_ITEMS
      : activeTab === 'weapons'
      ? WEAPON_ITEMS
      : GADGET_ITEMS;

  const activeOperator = getOperatorById(loadout.operatorId);
  const activeWeapon = getWeaponById(loadout.weaponId);
  const gadgetSlot1 = getGadgetById(loadout.gadgetIds[0]);
  const gadgetSlot2 = getGadgetById(loadout.gadgetIds[1]);
  const activeDrone = getDroneModelById(loadout.droneModelId);
  const droneEnabled = loadout.droneEnabled ?? true;
  const bonuses = computeLoadoutBonuses(loadout);

  const inspectedItem = useMemo(() => {
    const found = itemsForTab.find((it) => it.id === inspectedId);
    return found || itemsForTab[0];
  }, [itemsForTab, inspectedId]);

  const baselineItem: StoreItem | null = useMemo(() => {
    if (activeTab === 'operators') return activeOperator;
    if (activeTab === 'weapons') return activeWeapon;
    return activeGadgetSlot === 0 ? gadgetSlot1 : gadgetSlot2;
  }, [activeTab, activeOperator, activeWeapon, activeGadgetSlot, gadgetSlot1, gadgetSlot2]);

  if (!isOpen) return null;

  const isEquipped = (item: StoreItem) => {
    if (item.category === 'operators') return loadout.operatorId === item.id;
    if (item.category === 'weapons') return loadout.weaponId === item.id;
    return loadout.gadgetIds.includes(item.id as GadgetId);
  };

  const handleEquip = (item: StoreItem) => {
    playUiClick();
    if (item.category === 'operators') {
      onEquipOperator(item.id as OperatorId);
    } else if (item.category === 'weapons') {
      onEquipWeapon(item.id as WeaponId);
    } else {
      onToggleGadget(item.id as GadgetId, activeGadgetSlot);
    }
  };

  const handleSwitchTab = (tab: StoreCategory | 'daily') => {
    playUiClick();
    setActiveTab(tab);
    if (tab === 'operators') setInspectedId(loadout.operatorId);
    else if (tab === 'weapons') setInspectedId(loadout.weaponId);
    else if (tab === 'gadgets')
      setInspectedId(loadout.gadgetIds[activeGadgetSlot] || GADGET_ITEMS[0].id);
  };

  const inspRarity = RARITY_STYLES[inspectedItem.rarity];
  const inspOwned = ownedItems.includes(inspectedItem.id);
  const inspEquipped = isEquipped(inspectedItem);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-5">
      <div className="relative w-full max-w-6xl max-h-[94vh] tac-gunmetal tac-glass border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />

        {/* Top Armory Header */}
        <header className="relative z-10 px-5 py-3.5 border-b border-zinc-800/90 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg md:text-xl font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>3D Tactical Armory & Mythic Vault</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Live 3D holographic pedestal showcase · Compare stats and equip Operators, Blades, Rifles & Gadgets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="tac-panel flex items-center gap-3.5 px-3 py-1.5 rounded-xl border border-zinc-700/80 font-mono tabular-nums text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Coins className="w-4 h-4" />
                <span>{wallet.coins}</span>
              </div>
              <span className="text-zinc-700">|</span>
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Gem className="w-4 h-4" />
                <span>{wallet.credits}</span>
              </div>
            </div>

            <button
              onClick={() => {
                playUiClick();
                onConvertCoinsToCredits();
              }}
              disabled={wallet.coins < 250}
              title="Exchange 250 Coins for 35 Credits"
              className="tac-bevel-btn px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>250 → 35 Cr</span>
            </button>

            <button
              onClick={() => {
                playUiClick();
                onClaimSupply();
              }}
              disabled={!canClaimSupply}
              className={`tac-bevel-btn px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap ${
                canClaimSupply
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{canClaimSupply ? 'Supply Drop' : 'Claimed'}</span>
            </button>

            <button
              onClick={() => {
                playUiClick();
                onClose();
              }}
              aria-label="Close Armory"
              className="tac-bevel-btn p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active Loadout Strip + Combined Totals */}
        <section className="relative z-10 px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/45 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleSwitchTab('operators')}
              className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'operators'
                  ? 'border-cyan-400/70 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Operator</span>
                <UserCheck className="w-3 h-3 text-cyan-400" />
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">{activeOperator.name}</div>
              <div className={`text-[10px] font-mono ${RARITY_STYLES[activeOperator.rarity].label}`}>
                {activeOperator.rarity}
              </div>
            </button>

            <button
              onClick={() => handleSwitchTab('weapons')}
              className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'weapons'
                  ? 'border-amber-400/70 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Weapon</span>
                <Crosshair className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">{activeWeapon.name}</div>
              <div className={`text-[10px] font-mono ${RARITY_STYLES[activeWeapon.rarity].label}`}>
                {activeWeapon.rarity}
              </div>
            </button>

            <button
              onClick={() => {
                setActiveGadgetSlot(0);
                handleSwitchTab('gadgets');
              }}
              className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'gadgets' && activeGadgetSlot === 0
                  ? 'border-cyan-400/70 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Gadget 1</span>
                <Cpu className="w-3 h-3 text-cyan-400" />
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">
                {gadgetSlot1 ? gadgetSlot1.name : 'Empty'}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                {gadgetSlot1 ? gadgetSlot1.rarity : 'Equip slot 1'}
              </div>
            </button>

            <button
              onClick={() => {
                setActiveGadgetSlot(1);
                handleSwitchTab('gadgets');
              }}
              className={`text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'gadgets' && activeGadgetSlot === 1
                  ? 'border-cyan-400/70 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Gadget 2</span>
                <Shield className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">
                {gadgetSlot2 ? gadgetSlot2.name : 'Empty'}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                {gadgetSlot2 ? gadgetSlot2.rarity : 'Equip slot 2'}
              </div>
            </button>
          </div>

          <div className="lg:col-span-4 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-3 gap-x-2 gap-y-1 font-mono tabular-nums text-[10px]">
            <div>
              <span className="text-zinc-500 block">HP Bonus</span>
              <span className="text-white font-semibold">+{bonuses.maxHealthAdd}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Shield</span>
              <span className="text-cyan-400 font-semibold">+{bonuses.maxShieldAdd}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Attack</span>
              <span className="text-amber-400 font-semibold">+{bonuses.attackPowerAdd}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Crit</span>
              <span className="text-rose-400 font-semibold">+{Math.round(bonuses.critChanceAdd * 100)}%</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Air Jump</span>
              <span className="text-purple-300 font-semibold">+{bonuses.doubleJumpAdd}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Drone</span>
              <span className={bonuses.droneSupport ? 'text-cyan-400 font-semibold' : 'text-zinc-500'}>
                {bonuses.droneSupport ? activeDrone.shortName : 'Off'}
              </span>
            </div>
          </div>

          {/* Tactical Support Drone Loadout Toggle & Model Selector */}
          <div className="lg:col-span-12 rounded-xl border border-cyan-500/30 bg-zinc-950/85 p-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onToggleDroneEnabled();
                }}
                aria-pressed={droneEnabled}
                className={`tac-bevel-btn px-2.5 py-1.5 rounded-lg border text-[11px] font-display font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                  bonuses.droneSupport
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>Support Drone: {bonuses.droneSupport ? 'ON' : 'OFF'}</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="truncate">{activeDrone.name}</span>
                  <span
                    className="px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0"
                    style={{
                      borderColor: `${activeDrone.accentColor}66`,
                      color: activeDrone.accentColor,
                      backgroundColor: `${activeDrone.accentColor}1a`,
                    }}
                  >
                    {activeDrone.roleLabel}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                  {activeDrone.activeBehavior}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0">
              {DRONE_MODELS.map((model) => {
                const selected = activeDrone.id === model.id;
                const DroneIcon =
                  model.id === 'drone_aegis'
                    ? Shield
                    : model.id === 'drone_medic'
                    ? HeartPulse
                    : model.id === 'drone_scanner'
                    ? Radar
                    : Crosshair;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      playUiClick();
                      onSelectDroneModel(model.id);
                    }}
                    className={`tac-bevel-btn px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-950/75 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: model.accentColor,
                            boxShadow: `0 0 14px -4px ${model.accentColor}66`,
                          }
                        : undefined
                    }
                    title={model.description}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-display font-bold truncate">
                        {model.shortName}
                      </span>
                      <DroneIcon
                        className="w-3 h-3 shrink-0"
                        style={{ color: model.accentColor }}
                      />
                    </div>
                    <div className="text-[9px] font-mono text-zinc-400 truncate mt-0.5">
                      {model.statLabels.join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Category Tabs */}
        <div className="relative z-10 px-5 pt-3 pb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-950/90 rounded-xl border border-zinc-800">
            <button
              onClick={() => handleSwitchTab('operators')}
              className={`tac-bevel-btn px-3.5 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'operators' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Operators ({OPERATOR_ITEMS.length})
            </button>
            <button
              onClick={() => handleSwitchTab('weapons')}
              className={`tac-bevel-btn px-3.5 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'weapons' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Swords & Rifles ({WEAPON_ITEMS.length})
            </button>
            <button
              onClick={() => handleSwitchTab('gadgets')}
              className={`tac-bevel-btn px-3.5 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'gadgets' ? 'bg-purple-500 text-white' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Gadgets & Thrusters ({GADGET_ITEMS.length})
            </button>
            <button
              onClick={() => handleSwitchTab('daily')}
              className={`tac-bevel-btn px-3.5 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                activeTab === 'daily'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Daily</span>
              {claimableDailyCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    activeTab === 'daily'
                      ? 'bg-zinc-950 text-emerald-300'
                      : 'bg-amber-500 text-zinc-950'
                  }`}
                >
                  {claimableDailyCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'gadgets' && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>Target Slot:</span>
              <button
                onClick={() => {
                  playUiClick();
                  setActiveGadgetSlot(0);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                  activeGadgetSlot === 0
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                Slot 1
              </button>
              <button
                onClick={() => {
                  playUiClick();
                  setActiveGadgetSlot(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                  activeGadgetSlot === 1
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                Slot 2
              </button>
            </div>
          )}
        </div>

        {/* Main 2-Column Store Body (or Daily Missions Tracker when Daily tab active) */}
        {activeTab === 'daily' ? (
          <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 pb-5 pt-1 overflow-y-auto">
            {/* Left Daily Missions List */}
            <div className="lg:col-span-7 flex flex-col gap-3 content-start">
              {DAILY_MISSIONS.map((mission) => {
                const rawProg = normalizedDaily.progress[mission.id] || 0;
                const progress = Math.min(mission.target, rawProg);
                const pct = Math.min(100, Math.round((progress / mission.target) * 100));
                const isComplete = progress >= mission.target;
                const isClaimed = normalizedDaily.claimedIds.includes(mission.id);
                const tierColor =
                  mission.tier === 'Apex'
                    ? 'bg-purple-500/20 border-purple-400/55 text-purple-200'
                    : mission.tier === 'Assault'
                    ? 'bg-rose-500/20 border-rose-400/55 text-rose-200'
                    : 'bg-cyan-500/15 border-cyan-500/45 text-cyan-300';

                return (
                  <article
                    key={mission.id}
                    className={`tac-panel rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                      isComplete && !isClaimed
                        ? 'border-emerald-400/75 shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]'
                        : isClaimed
                        ? 'border-zinc-800/90 opacity-75'
                        : 'border-zinc-700/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${tierColor}`}
                          >
                            {mission.tier}
                          </span>
                          <h3 className="font-display text-sm font-bold text-white tracking-wide">
                            {mission.title}
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{mission.description}</p>
                      </div>

                      <div className="flex items-center gap-2 font-mono tabular-nums text-xs shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                          <Coins className="w-3.5 h-3.5" />
                          +{mission.rewardCoins}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold">
                          <Gem className="w-3.5 h-3.5" />
                          +{mission.rewardCredits}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                          <span
                            className={
                              isClaimed
                                ? 'text-zinc-400'
                                : isComplete
                                ? 'text-emerald-300 font-bold'
                                : 'text-zinc-200 font-semibold'
                            }
                          >
                            {formatDailyMissionProgressLabel(mission, progress)}
                          </span>
                          <span
                            className={
                              isClaimed
                                ? 'text-zinc-500'
                                : isComplete
                                ? 'text-emerald-400 font-bold'
                                : 'text-cyan-300'
                            }
                          >
                            {isClaimed
                              ? 'Completed'
                              : isComplete
                              ? 'Ready to Claim!'
                              : `${mission.target - progress}${mission.unitLabel || ''} left (${pct}%)`}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={mission.title}
                          aria-valuemin={0}
                          aria-valuemax={mission.target}
                          aria-valuenow={progress}
                          className="relative h-3 w-full rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden shadow-inner"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isClaimed
                                ? 'bg-zinc-600'
                                : isComplete
                                ? 'bg-gradient-to-r from-emerald-500 to-lime-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                                : 'bg-gradient-to-r from-cyan-500 to-sky-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          {/* Subtle quarter milestone ticks */}
                          <div className="pointer-events-none absolute inset-0 flex justify-evenly">
                            <span className="w-px h-full bg-zinc-900/70" />
                            <span className="w-px h-full bg-zinc-900/70" />
                            <span className="w-px h-full bg-zinc-900/70" />
                          </div>
                        </div>
                      </div>

                      {isClaimed ? (
                        <span className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Claimed</span>
                        </span>
                      ) : isComplete ? (
                        <button
                          type="button"
                          onClick={() => {
                            playPowerUp();
                            onClaimDailyMission(mission.id);
                          }}
                          className="tac-bevel-btn px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>Claim</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300 font-mono font-bold text-[11px] shrink-0">
                          {pct}%
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Right Daily Briefing & Claim All Summary */}
            <aside className="lg:col-span-5 tac-panel border border-zinc-700/80 rounded-xl p-4 flex flex-col gap-4 h-fit sticky top-0">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
                    Daily Operations
                  </div>
                  <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide mt-0.5">
                    Bounty Directive
                  </h3>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Resets {resetWindow.hours}h {String(resetWindow.minutes).padStart(2, '0')}m
                  </span>
                </div>
              </div>

              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                {(() => {
                  const doneCount = DAILY_MISSIONS.filter(
                    (m) => (normalizedDaily.progress[m.id] || 0) >= m.target
                  ).length;
                  const overallPct = Math.round(
                    (DAILY_MISSIONS.reduce(
                      (acc, m) => acc + Math.min(1, (normalizedDaily.progress[m.id] || 0) / m.target),
                      0
                    ) /
                      DAILY_MISSIONS.length) *
                      100
                  );
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-400">Objectives Completed</span>
                        <span className="text-white font-bold">
                          {doneCount} / {DAILY_MISSIONS.length} ({overallPct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                          style={{ width: `${overallPct}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Claimed Today</span>
                  <span className="text-emerald-400 font-bold">
                    {normalizedDaily.claimedIds.length} / {DAILY_MISSIONS.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-zinc-800/80">
                  <span className="text-zinc-400">Total Daily Pool</span>
                  <span className="text-amber-300 font-bold">
                    +{DAILY_MISSIONS.reduce((sum, m) => sum + m.rewardCoins, 0)} Coins · +
                    {DAILY_MISSIONS.reduce((sum, m) => sum + m.rewardCredits, 0)} Cr
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={claimableDailyCount === 0}
                onClick={() => {
                  playPowerUp();
                  onClaimAllDailyMissions();
                }}
                className="tac-bevel-btn w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border disabled:border-zinc-800 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Gift className="w-4 h-4" />
                <span>
                  {claimableDailyCount > 0
                    ? `Claim All Ready (${claimableDailyCount})`
                    : 'No Unclaimed Rewards Ready'}
                </span>
              </button>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Progress updates live during Solo Odyssey deployments and Global PvP combat. When connected to your Cloud Storage Database, daily mission progress syncs automatically across devices.
              </p>
            </aside>
          </div>
        ) : (
        <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 pb-5 pt-1 overflow-y-auto">
          {/* Left Grid of Live 3D Pedestal Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5 content-start">
            {itemsForTab.map((item) => {
              const owned = ownedItems.includes(item.id);
              const equipped = isEquipped(item);
              const selected = inspectedItem.id === item.id;
              const rarityStyle = RARITY_STYLES[item.rarity];
              const gadgetSlotIndex =
                item.category === 'gadgets' ? loadout.gadgetIds.indexOf(item.id as GadgetId) : -1;

              return (
                <article
                  key={item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId((prev) => (prev === item.id ? null : prev))}
                  onClick={() => {
                    playUiClick();
                    setInspectedId(item.id);
                  }}
                  className={`tac-panel rounded-xl border cursor-pointer ${rarityStyle.border} ${
                    selected ? `ring-2 ring-white/40 ${rarityStyle.glow}` : ''
                  } flex flex-col overflow-hidden transition-all`}
                >
                  {/* Live Rotating 3D Holographic Pedestal Preview (Zero 2D Icons) */}
                  <div
                    className="relative h-44 w-full overflow-hidden border-b border-zinc-800/80"
                    style={{
                      background: `radial-gradient(circle at 50% 42%, ${item.accentColor}2a, #09090b 78%)`,
                    }}
                  >
                    <PedestalCardCanvas3D item={item} hovered={hoveredId === item.id} size={210} />
                    <span
                      className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${rarityStyle.badgeBg}`}
                    >
                      {item.rarity}
                    </span>
                    {equipped && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[10px] font-mono font-bold">
                        Equipped
                      </span>
                    )}
                  </div>

                  {/* Card Info & Quick Buy/Equip */}
                  <div className="p-3.5 flex flex-col gap-2.5 flex-grow justify-between">
                    <div>
                      <div className="text-[11px] text-zinc-400 truncate">{item.subtitle}</div>
                      <h3 className="font-display text-sm font-bold text-white mt-0.5 truncate">
                        {item.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono tabular-nums text-[10px] text-zinc-300">
                        {item.statLabels.map((lbl) => (
                          <span key={lbl}>{lbl}</span>
                        ))}
                      </div>
                    </div>

                    <div
                      className="pt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {owned ? (
                        <button
                          onClick={() => handleEquip(item)}
                          className={`tac-bevel-btn w-full py-2 px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            equipped
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950'
                          }`}
                        >
                          {equipped ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {item.category === 'gadgets'
                                  ? `Slot ${gadgetSlotIndex + 1} · Unequip`
                                  : 'Equipped'}
                              </span>
                            </>
                          ) : (
                            <span>
                              {item.category === 'gadgets'
                                ? `Equip Slot ${activeGadgetSlot + 1}`
                                : 'Equip'}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => {
                              playUiClick();
                              onBuyItem(item, 'coins');
                            }}
                            disabled={wallet.coins < item.costCoins}
                            className="tac-bevel-btn py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border disabled:border-zinc-800 text-zinc-950 text-[11px] font-bold font-mono tabular-nums flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Coins className="w-3 h-3" />
                            <span>{item.costCoins}</span>
                          </button>
                          <button
                            onClick={() => {
                              playUiClick();
                              onBuyItem(item, 'credits');
                            }}
                            disabled={wallet.credits < item.costCredits}
                            className="tac-bevel-btn py-1.5 px-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border disabled:border-zinc-800 text-zinc-950 text-[11px] font-bold font-mono tabular-nums flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Gem className="w-3 h-3" />
                            <span>{item.costCredits}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Right Interactive 3D CODM Inspector & Stat Comparison Bars */}
          <aside className="lg:col-span-5 tac-panel border border-zinc-700/80 rounded-xl p-4 flex flex-col gap-3.5 h-fit sticky top-0">
            <div
              className="relative h-64 w-full rounded-xl overflow-hidden border border-zinc-800"
              style={{
                background: `radial-gradient(circle at 50% 45%, ${inspectedItem.accentColor}30, #09090b 80%)`,
              }}
            >
              <PedestalInspector3D item={inspectedItem} size={340} />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${inspRarity.badgeBg}`}
                >
                  {inspectedItem.rarity}
                </span>
                <span className="text-[11px] font-mono text-zinc-300 bg-zinc-950/85 border border-zinc-800 px-2 py-0.5 rounded">
                  3D Holographic Preview
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold text-white">{inspectedItem.name}</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {inspectedItem.description}
              </p>
              {inspectedItem.asymmetryNote && (
                <p className="text-[11px] text-cyan-300/80 font-mono mt-1.5">
                  {inspectedItem.asymmetryNote}
                </p>
              )}
            </div>

            {/* Stat Comparison Bars vs Currently Equipped */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-zinc-800 pb-1.5">
                <span>Stat Comparison</span>
                <span className="truncate max-w-[180px]">
                  vs {baselineItem ? baselineItem.name : 'Empty Slot'}
                </span>
              </div>

              {COMPARE_METRICS.map((metric) => {
                const candVal = Number(inspectedItem.boosts[metric.key] ?? 0);
                const baseVal = Number(baselineItem?.boosts[metric.key] ?? 0);
                if (candVal === 0 && baseVal === 0) return null;

                const candPct = Math.min(100, Math.round((candVal / metric.maxScale) * 100));
                const diff = candVal - baseVal;
                const formatVal = (v: number) =>
                  metric.isPct ? `${Math.round(v * 100)}%` : `${Number(v.toFixed(1))}`;

                return (
                  <div key={metric.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-zinc-300">{metric.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">+{formatVal(candVal)}</span>
                        {diff !== 0 && (
                          <span
                            className={
                              diff > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                            }
                          >
                            ({diff > 0 ? '+' : ''}
                            {formatVal(diff)})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${candPct}%`,
                          backgroundColor: inspectedItem.accentColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {inspectedItem.boosts.droneSupport && (
                <div className="text-[11px] font-mono text-cyan-300 pt-1">
                  + Autonomous 3D Combat Overwatch Drone
                </div>
              )}
              {inspectedItem.boosts.doubleJumpAdd && (
                <div className="text-[11px] font-mono text-purple-300 pt-1">
                  + {inspectedItem.boosts.doubleJumpAdd} Bonus Mid-Air Thruster Jump
                </div>
              )}
              {inspectedItem.boosts.lifestealPercent && (
                <div className="text-[11px] font-mono text-rose-300 pt-1">
                  + {Math.round(inspectedItem.boosts.lifestealPercent * 100)}% Combat Lifesteal
                </div>
              )}
            </div>

            {/* Primary Inspector Action */}
            <div>
              {inspOwned ? (
                <button
                  onClick={() => handleEquip(inspectedItem)}
                  className={`tac-bevel-btn w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    inspEquipped
                      ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {inspEquipped
                      ? 'Currently Equipped'
                      : inspectedItem.category === 'gadgets'
                      ? `Equip to Slot ${activeGadgetSlot + 1}`
                      : 'Equip to Active Loadout'}
                  </span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      playUiClick();
                      onBuyItem(inspectedItem, 'coins');
                    }}
                    disabled={wallet.coins < inspectedItem.costCoins}
                    className="tac-bevel-btn py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border disabled:border-zinc-800 text-zinc-950 text-xs font-bold font-mono tabular-nums flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Buy {inspectedItem.costCoins}</span>
                  </button>
                  <button
                    onClick={() => {
                      playUiClick();
                      onBuyItem(inspectedItem, 'credits');
                    }}
                    disabled={wallet.credits < inspectedItem.costCredits}
                    className="tac-bevel-btn py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:border disabled:border-zinc-800 text-zinc-950 text-xs font-bold font-mono tabular-nums flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Gem className="w-4 h-4" />
                    <span>Buy {inspectedItem.costCredits}</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
        )}
      </div>
    </div>
  );
}
