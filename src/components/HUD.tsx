import React, { useEffect, useRef, useState } from 'react';
import {
  Shield,
  Heart,
  Coins,
  Milestone,
  Zap,
  Flame,
  Pause,
  Play,
  Home,
  Sliders,
  Crosshair,
  Skull,
  Wind,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Sword,
  AlertTriangle,
  Car,
  Gauge,
  MessageSquare,
  Radio,
  Wrench,
  Radar,
  Eye,
  EyeOff,
} from 'lucide-react';
import type {
  BiomeStageId,
  BossHudState,
  DroneHudState,
  FloatingDamage,
  GameSettings,
  MissionLogEntry,
  NearbyNpcPrompt,
  PlayerState,
  SpecialAbilityState,
  VehicleHudState,
  VillainCommEvent,
} from '../types';
import { WORLD_CONFIGS, WEATHER_OPTIONS, resolveEffectiveWeather } from '../config/worlds';
import { getWeatherProfile } from '../config/weatherSystem';
import { playUiClick } from '../utils/audio';
import type { ControlActionKind, VirtualControlInput } from './GameCanvas';

interface HUDProps {
  player: PlayerState;
  abilities: SpecialAbilityState;
  boss: BossHudState | null;
  floatingDamages: FloatingDamage[];
  biomeStage: BiomeStageId;
  calloutText?: string | null;
  missionLogs: MissionLogEntry[];
  vehicleState: VehicleHudState;
  nearbyNpc: NearbyNpcPrompt | null;
  droneState?: DroneHudState | null;
  villainComm?: VillainCommEvent | null;
  onOpenArmory?: () => void;
  onTriggerAction: (kind: ControlActionKind) => void;
  onVirtualHoldChange: (field: keyof VirtualControlInput, active: boolean) => void;
  onPauseToggle: () => void;
  isPaused: boolean;
  onQuit: () => void;
  onOpenSettings: () => void;
  settings: GameSettings;
}

const BIOME_LABELS: Record<BiomeStageId, string> = {
  JUNGLE: 'Biolume Jungle',
  VOLCANIC: 'Volcanic Fortress',
  CYBER: 'Cyber Metropolis',
};

function useAutoTouchDetected(): boolean {
  const [isTouchOrCompact, setIsTouchOrCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 1024
    );
  });

  useEffect(() => {
    const evaluate = () => {
      setIsTouchOrCompact(
        window.matchMedia?.('(pointer: coarse)').matches ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth < 1024
      );
    };
    window.addEventListener('resize', evaluate);
    return () => window.removeEventListener('resize', evaluate);
  }, []);

  return isTouchOrCompact;
}

export default function HUD({
  player,
  abilities,
  boss,
  floatingDamages,
  biomeStage,
  calloutText,
  missionLogs,
  vehicleState,
  nearbyNpc,
  droneState,
  villainComm,
  onOpenArmory,
  onTriggerAction,
  onVirtualHoldChange,
  onPauseToggle,
  isPaused,
  onQuit,
  onOpenSettings,
  settings,
}: HUDProps) {
  const activeWorld = WORLD_CONFIGS[settings.world];
  const effectiveWeatherId = resolveEffectiveWeather(settings.world, settings.weather);
  const wxProfile = getWeatherProfile(effectiveWeatherId);
  const weatherLabel =
    WEATHER_OPTIONS.find((w) => w.id === effectiveWeatherId)?.label ?? 'Clear';

  const autoTouch = useAutoTouchDetected();
  const showTouchControls =
    settings.touchControlsMode === 'always' ||
    (settings.touchControlsMode === 'auto' && autoTouch);

  const [pressedControls, setPressedControls] = useState<Record<string, boolean>>({});
  const [keyActive, setKeyActive] = useState<Record<string, boolean>>({});
  const [damageFlashKey, setDamageFlashKey] = useState(0);
  const [missionLogOpen, setMissionLogOpen] = useState(false);
  const [seenLogCount, setSeenLogCount] = useState(0);
  const prevVitalsRef = useRef({ hp: player.health, sh: player.shield });
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (missionLogOpen) {
      setSeenLogCount(missionLogs.length);
      logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [missionLogs.length, missionLogOpen]);

  const unreadLogsCount = missionLogOpen ? 0 : Math.max(0, missionLogs.length - seenLogCount);

  useEffect(() => {
    const prev = prevVitalsRef.current;
    if (player.health < prev.hp - 0.5 || player.shield < prev.sh - 0.5) {
      setDamageFlashKey((k) => k + 1);
    }
    prevVitalsRef.current = { hp: player.health, sh: player.shield };
  }, [player.health, player.shield]);

  useEffect(() => {
    const mapKey = (key: string): string | null => {
      if (key === 'a' || key === 'arrowleft') return 'left';
      if (key === 'd' || key === 'arrowright') return 'right';
      if (key === 'w' || key === ' ' || key === 'arrowup') return 'jump';
      if (key === 'j') return 'shoot';
      if (key === 'k') return 'slash';
      if (key === 'q' || key === '1' || key === 'shift') return 'dash';
      if (key === 'e' || key === '2') return 'aegis';
      if (key === 'r' || key === '3') return 'orbital';
      if (key === 'f') return 'vehicle';
      if (key === 'g') return 'interact';
      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mapped = mapKey(e.key.toLowerCase());
      if (mapped) setKeyActive((prev) => (prev[mapped] ? prev : { ...prev, [mapped]: true }));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = mapKey(e.key.toLowerCase());
      if (mapped) setKeyActive((prev) => (!prev[mapped] ? prev : { ...prev, [mapped]: false }));
    };
    const onBlur = () => {
      setKeyActive({});
      setPressedControls({});
      onVirtualHoldChange('left', false);
      onVirtualHoldChange('right', false);
      onVirtualHoldChange('shootHeld', false);
      onVirtualHoldChange('slashHeld', false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [onVirtualHoldChange]);

  // Clear stuck virtual holds whenever paused or controls hidden
  useEffect(() => {
    if (isPaused || !showTouchControls) {
      setPressedControls({});
      onVirtualHoldChange('left', false);
      onVirtualHoldChange('right', false);
      onVirtualHoldChange('shootHeld', false);
      onVirtualHoldChange('slashHeld', false);
    }
  }, [isPaused, showTouchControls, onVirtualHoldChange]);

  const setHoldControl = (
    id: string,
    holdField: keyof VirtualControlInput | null,
    active: boolean,
    instantAction?: ControlActionKind
  ) => {
    setPressedControls((prev) => (prev[id] === active ? prev : { ...prev, [id]: active }));
    if (holdField) {
      onVirtualHoldChange(holdField, active);
    }
    if (active && instantAction) {
      onTriggerAction(instantAction);
    }
  };

  const totalTargetDistance = 2000;
  const progressPercent = Math.min((player.distance / totalTargetDistance) * 100, 100);

  const hpPercent = Math.max(0, Math.min(100, (player.health / Math.max(1, player.maxHealth)) * 100));
  const shieldPercent = Math.max(0, Math.min(100, (player.shield / Math.max(1, player.maxShield)) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (player.stamina / 100) * 100));
  const lowHealth = hpPercent <= 28;

  const abilityCards: {
    id: 'dash' | 'aegis' | 'orbital';
    keyLabel: string;
    shortKey: string;
    name: string;
    cooldown: number;
    maxCooldown: number;
    active: boolean;
    accent: string;
    ringColor: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'dash',
      keyLabel: vehicleState.occupied ? 'Shift / Q' : 'Q / 1',
      shortKey: 'Q',
      name: vehicleState.occupied ? 'Nitro Boost' : 'Cyber-Dash',
      cooldown: vehicleState.occupied ? 0 : abilities.dashCooldown,
      maxCooldown: abilities.dashMaxCooldown,
      active: vehicleState.occupied ? vehicleState.nitroActive : abilities.dashActiveTimer > 0,
      accent: 'border-cyan-400/70 text-cyan-300',
      ringColor: '#22d3ee',
      icon: <Wind className="w-4 h-4" />,
    },
    {
      id: 'aegis',
      keyLabel: 'E / 2',
      shortKey: 'E',
      name: 'Aegis Dome',
      cooldown: abilities.aegisCooldown,
      maxCooldown: abilities.aegisMaxCooldown,
      active: abilities.aegisActiveTimer > 0,
      accent: 'border-sky-400/70 text-sky-300',
      ringColor: '#38bdf8',
      icon: <Shield className="w-4 h-4" />,
    },
    {
      id: 'orbital',
      keyLabel: 'R / 3',
      shortKey: 'R',
      name: 'Orbital Strike',
      cooldown: abilities.orbitalCooldown,
      maxCooldown: abilities.orbitalMaxCooldown,
      active: abilities.orbitalChargeTimer > 0 || abilities.orbitalBeamTimer > 0,
      accent: 'border-amber-400/70 text-amber-300',
      ringColor: '#f59e0b',
      icon: <Crosshair className="w-4 h-4" />,
    },
  ];

  const isPressed = (id: string) => Boolean(pressedControls[id] || keyActive[id]);
  const counterDash = boss?.counterDash ?? null;
  const counterPhase = counterDash?.phase ?? null;
  const counterBonusActive = abilities.counterDashBonusTimer > 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Diegetic Visor Damage Flash Cracks Overlay (triggered on hit, fades smoothly) */}
      {damageFlashKey > 0 && (
        <div
          key={damageFlashKey}
          className="absolute inset-0 pointer-events-none animate-tac-damage z-30"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, transparent 48%, rgba(220, 38, 38, 0.34) 86%, rgba(153, 27, 27, 0.62) 100%)',
          }}
        >
          <svg
            viewBox="0 0 1000 562"
            preserveAspectRatio="none"
            className="w-full h-full opacity-85"
          >
            <g stroke="#fca5a5" strokeWidth="1.6" fill="none" strokeLinecap="round">
              <polyline points="0,35 72,74 114,58 168,118 192,165" />
              <polyline points="72,74 96,125 65,168" />
              <polyline points="1000,48 918,86 878,68 830,124 804,162" />
              <polyline points="918,86 894,138 928,178" />
              <polyline points="0,510 88,472 135,488 188,434" />
              <polyline points="1000,522 908,478 864,494 812,438" />
            </g>
          </svg>
        </div>
      )}

      {/* Extreme Weather Screen Filters (WebGL-safe, zero backdrop-blur) */}
      {effectiveWeatherId === 'acid_rain' && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, transparent 56%, rgba(74, 222, 128, 0.24) 100%)',
            backgroundImage:
              'radial-gradient(circle at 50% 50%, transparent 56%, rgba(74, 222, 128, 0.24) 100%), repeating-linear-gradient(104deg, transparent 0px, transparent 22px, rgba(74, 222, 128, 0.055) 22px, rgba(74, 222, 128, 0.055) 24px)',
          }}
        />
      )}
      {effectiveWeatherId === 'solar_flare' && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'radial-gradient(circle at 84% 12%, rgba(251, 146, 60, 0.28) 0%, rgba(249, 115, 22, 0.1) 36%, transparent 66%), radial-gradient(circle at 50% 50%, transparent 54%, rgba(251, 146, 60, 0.26) 100%)',
          }}
        />
      )}
      {effectiveWeatherId === 'void_storm' && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, transparent 52%, rgba(139, 92, 246, 0.30) 100%)',
            backgroundImage:
              'radial-gradient(circle at 50% 50%, transparent 52%, rgba(139, 92, 246, 0.30) 100%), repeating-linear-gradient(0deg, transparent 0px, transparent 5px, rgba(167, 139, 250, 0.035) 5px, rgba(167, 139, 250, 0.035) 6px)',
          }}
        />
      )}

      {/* Boss Crimson Storm Rim Accent */}
      {boss?.darkSkyActive && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            boxShadow: 'inset 0 0 85px rgba(220, 38, 38, 0.28)',
          }}
        />
      )}

      {/* Persistent Low-HP Visor Rim Warning */}
      {lowHealth && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            boxShadow: 'inset 0 0 70px rgba(220, 38, 38, 0.38)',
          }}
        />
      )}

      {/* Screen-Projected Floating Critical Damage Numbers */}
      {floatingDamages.map((d) => (
        <div
          key={d.id}
          className={`absolute font-mono font-black tracking-tight pointer-events-none transition-opacity z-30 ${
            d.crit ? 'text-lg drop-shadow-[0_2px_6px_rgba(250,204,21,0.8)]' : 'text-xs'
          }`}
          style={{
            left: `${d.screenX}px`,
            top: `${d.screenY}px`,
            color: d.color,
            opacity: Math.max(0, 1 - d.age / 0.78),
            transform: 'translate(-50%, -50%)',
          }}
        >
          {d.label ? `${d.label} ` : ''}
          {d.amount > 0 ? d.amount : ''}
        </div>
      ))}

      <div className="relative z-40 w-full h-full p-3 sm:p-4 flex flex-col justify-between">
        {/* Top Row: Curved Holographic Visor Vitals + Boss Threat + Controls */}
        <div className="flex items-start justify-between gap-4">
          {/* Top-Left: Curved Holographic Visor Telemetry Pod */}
          <div className="relative pointer-events-auto tac-hud-pod border border-cyan-500/35 rounded-tl-xl rounded-tr-2xl rounded-bl-2xl rounded-br-md p-3 md:p-3.5 max-w-xs overflow-hidden">
            {/* Corner Visor Brackets */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 260 116"
              preserveAspectRatio="none"
            >
              <path
                d="M2,18 L2,2 L26,2 M234,2 L258,2 L258,18 M2,98 L2,114 L22,114"
                stroke="rgba(34,211,238,0.55)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M12,112 Q130,104 248,112"
                stroke="rgba(245,158,11,0.35)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>

            <div className="relative flex flex-col gap-2">
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-400/90 border-b border-cyan-500/20 pb-1">
                <span>VISOR TELEMETRY</span>
                <span className={lowHealth ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {lowHealth ? 'CRITICAL' : 'NOMINAL'}
                </span>
              </div>

              {/* Curved/Segmented Health Gauge */}
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-red-950/70 border border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.35)]">
                  <Heart className="w-3.5 h-3.5 fill-red-400" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-zinc-300 mb-0.5">
                    <span className="font-display font-bold tracking-wider text-white">HULL HP</span>
                    <span>
                      {Math.round(player.health)} / {player.maxHealth}
                    </span>
                  </div>
                  <div className="relative w-40 sm:w-48 h-2.5 bg-zinc-950 rounded-r-full rounded-tl-sm overflow-hidden border border-red-500/35 skew-x-[-14deg]">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-150 shadow-[0_0_12px_rgba(244,63,94,0.65)]"
                      style={{ width: `${hpPercent}%` }}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(90deg, transparent 0px, transparent 14px, rgba(9,9,11,0.5) 14px, rgba(9,9,11,0.5) 16px)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Curved/Segmented Shield Gauge */}
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-sky-950/70 border border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-zinc-300 mb-0.5">
                    <span className="font-display font-bold tracking-wider text-sky-300">AEGIS</span>
                    <span>
                      {Math.round(player.shield)} / {player.maxShield}
                    </span>
                  </div>
                  <div className="relative w-40 sm:w-48 h-2 bg-zinc-950 rounded-r-full rounded-tl-sm overflow-hidden border border-sky-500/35 skew-x-[-14deg]">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300 transition-all duration-200 shadow-[0_0_10px_rgba(56,189,248,0.6)]"
                      style={{ width: `${shieldPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Curved Stamina Arc Bar */}
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-400/50 text-cyan-300">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between text-[10px] font-mono tabular-nums text-zinc-400 mb-0.5">
                    <span className="font-display font-bold tracking-wider text-cyan-300">THRUST</span>
                    <span>{Math.round(player.stamina)} / 100</span>
                  </div>
                  <div className="w-40 sm:w-48 h-1.5 bg-zinc-950 rounded-r-full overflow-hidden border border-cyan-500/30 skew-x-[-14deg]">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-300 transition-all duration-100"
                      style={{ width: `${staminaPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {droneState && droneState.enabled && (
              <div className="mt-2 pt-1.5 border-t border-cyan-500/20 flex items-center justify-between gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Radar
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: droneState.accentColor }}
                  />
                  <span className="text-white font-semibold truncate">{droneState.name}</span>
                  {droneState.overclocked && (
                    <span className="px-1 py-0.5 rounded bg-cyan-950 border border-cyan-400/50 text-[8px] text-cyan-300 font-bold">
                      OC
                    </span>
                  )}
                </div>
                <span
                  className="px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0"
                  style={{
                    borderColor: `${droneState.accentColor}55`,
                    color: droneState.accentColor,
                    backgroundColor: `${droneState.accentColor}16`,
                  }}
                >
                  {droneState.statusText}
                </span>
              </div>
            )}
          </div>

          {/* Center: Top-Rank Villain Boss Threat Telemetry + Hero Callout */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-md mx-auto">
            {boss && (
              <div className="w-full tac-hud-pod border border-red-500/65 rounded-xl px-4 py-2.5 shadow-[0_0_28px_-6px_rgba(239,68,68,0.55)]">
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Skull className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-display font-black text-white uppercase tracking-wide truncate">
                      {boss.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline truncate">
                      {boss.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] shrink-0">
                    {boss.darkSkyActive && (
                      <span className="px-1.5 py-0.5 rounded bg-red-950/90 border border-red-500/55 text-red-300 font-bold hidden sm:inline">
                        CRIMSON STORM
                      </span>
                    )}
                    {typeof boss.armorPct === 'number' && boss.armorPct > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-amber-500/45 text-amber-300 font-bold">
                        ARMOR {boss.armorPct}%
                      </span>
                    )}
                    {boss.rageMode && (
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                        ENRAGED +40% SPD
                      </span>
                    )}
                    <span className="text-zinc-200 tabular-nums font-semibold">
                      {Math.round(boss.health)} / {boss.maxHealth}
                    </span>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-red-500/35">
                  <div
                    className={`h-full transition-all duration-150 ${
                      boss.rageMode
                        ? 'bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400'
                        : 'bg-gradient-to-r from-rose-600 to-amber-500'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100))}%`,
                    }}
                  />
                </div>

                {boss.finisherAlert && (
                  <div
                    className={`mt-2 px-3 py-1 rounded-lg border text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors duration-100 ${
                      counterPhase === 'PERFECT'
                        ? 'bg-cyan-950/95 border-cyan-300 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.55)]'
                        : 'bg-rose-950/95 border-rose-400/85 text-rose-100'
                    }`}
                  >
                    <Skull className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    <span>{boss.finisherAlert}</span>
                  </div>
                )}

                {boss.unblockableAlert && (
                  <div className="mt-2 px-3 py-1 rounded-lg bg-red-950/90 border border-red-400/80 text-red-200 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{boss.unblockableAlert} · DODGE WITH CYBER-DASH [Q]</span>
                  </div>
                )}
              </div>
            )}

            {/* Counter-Dash Timing Indicator (highlights during Boss Finisher Combo) */}
            {counterDash && (
              <div
                className={`w-full tac-hud-pod rounded-xl px-3.5 py-2.5 border-2 transition-all duration-100 ${
                  counterPhase === 'PERFECT'
                    ? 'border-cyan-300 shadow-[0_0_28px_-2px_rgba(34,211,238,0.78)] scale-[1.015]'
                    : 'border-amber-400/80 shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.14em] mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Wind
                      className={`w-3.5 h-3.5 shrink-0 ${
                        counterPhase === 'PERFECT' ? 'text-cyan-300' : 'text-amber-300'
                      }`}
                    />
                    <span className={counterPhase === 'PERFECT' ? 'text-cyan-200' : 'text-amber-200'}>
                      {counterPhase === 'PERFECT'
                        ? 'COUNTER-DASH WINDOW OPEN!'
                        : 'COUNTER-DASH TIMING'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-cyan-400/60 text-cyan-300 font-black tabular-nums">
                      +{counterDash.bonusPct}% DMG
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border font-black ${
                        counterPhase === 'PERFECT'
                          ? 'bg-cyan-400 text-zinc-950 border-white'
                          : 'bg-zinc-900 text-amber-300 border-amber-400/60'
                      }`}
                    >
                      {counterPhase === 'PERFECT' ? 'DASH [Q / SHIFT]' : 'HOLD...'}
                    </span>
                  </div>
                </div>

                {/* Precision Timing Bar with Highlighted Perfect-Dodge Zone */}
                <div className="relative w-full h-3.5 bg-zinc-950 rounded-full border border-zinc-700/90 overflow-hidden">
                  {/* Approach Zone */}
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500/20"
                    style={{ width: `${counterDash.windowStart * 100}%` }}
                  />
                  {/* Perfect Dodge Sweet-Spot Zone */}
                  <div
                    className={`absolute inset-y-0 border-x-2 transition-colors duration-75 ${
                      counterPhase === 'PERFECT'
                        ? 'bg-gradient-to-r from-cyan-400/65 via-sky-300/75 to-amber-300/65 border-cyan-200'
                        : 'bg-cyan-500/25 border-cyan-400/70'
                    }`}
                    style={{
                      left: `${counterDash.windowStart * 100}%`,
                      width: `${(counterDash.windowEnd - counterDash.windowStart) * 100}%`,
                    }}
                  />
                  {/* Moving Progress Fill */}
                  <div
                    className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${
                      counterPhase === 'PERFECT'
                        ? 'bg-cyan-300/45'
                        : 'bg-amber-400/35'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, counterDash.progress * 100))}%` }}
                  />
                  {/* Timing Cursor Needle */}
                  <div
                    className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded-full transition-[left] duration-75 ${
                      counterPhase === 'PERFECT'
                        ? 'bg-white shadow-[0_0_10px_#22d3ee]'
                        : 'bg-amber-300 shadow-[0_0_8px_#f59e0b]'
                    }`}
                    style={{ left: `${Math.max(2, Math.min(98, counterDash.progress * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Active Counter-Dash Damage Bonus Banner */}
            {counterBonusActive && (
              <div className="w-full tac-hud-pod border border-cyan-300/85 rounded-xl px-3.5 py-1.5 shadow-[0_0_20px_-4px_rgba(34,211,238,0.65)] flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-[0.14em]">
                  <span className="text-cyan-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>PERFECT DODGE · +{abilities.counterDashDamageBonusPct}% DMG BONUS</span>
                  </span>
                  <span className="text-amber-300 tabular-nums">
                    {abilities.counterDashBonusTimer.toFixed(1)}s
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-cyan-400/40">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 transition-all duration-75"
                    style={{
                      width: `${Math.max(0, Math.min(100, (abilities.counterDashBonusTimer / 6.0) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Top-Center Villain Comms Transmission Banner (directly beneath Boss HP bar) */}
            {villainComm && (
              <div
                key={villainComm.id}
                className="w-full tac-hud-pod border border-red-500/75 rounded-xl px-3.5 py-2 shadow-[0_0_24px_-6px_rgba(220,38,38,0.65)] flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-[0.18em]">
                  <div className="flex items-center gap-1.5 text-red-300 font-bold truncate">
                    <Radio className="w-3 h-3 text-red-400 shrink-0" />
                    <span className="truncate">INCOMING INTERCEPT · {villainComm.bossName}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[8px] font-black tracking-wider shrink-0 ${
                      villainComm.tone === 'finisher'
                        ? 'bg-rose-950 border-rose-400/80 text-rose-200'
                        : villainComm.tone === 'pursuit'
                        ? 'bg-amber-950 border-amber-400/80 text-amber-200'
                        : villainComm.tone === 'ambush'
                        ? 'bg-red-950 border-red-400/80 text-red-200'
                        : 'bg-zinc-900 border-red-500/55 text-red-300'
                    }`}
                  >
                    {villainComm.tone === 'finisher'
                      ? 'FINISHER'
                      : villainComm.tone === 'pursuit'
                      ? 'PURSUIT'
                      : villainComm.tone === 'ambush'
                      ? 'AMBUSH'
                      : 'THREAT'}
                  </span>
                </div>
                <p className="text-xs font-display font-bold text-white tracking-wide leading-snug text-center">
                  “{villainComm.message}”
                </p>
              </div>
            )}

            {calloutText && (
              <div className="tac-hud-pod border border-amber-400/65 px-4 py-1.5 rounded-lg text-xs font-display font-black tracking-wider text-amber-300 uppercase shadow-lg">
                {calloutText}
              </div>
            )}

            {player.combo > 1 && (
              <div className="tac-hud-pod border border-amber-500/50 px-3.5 py-1 rounded-xl shadow-lg flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-red-500 fill-red-500" />
                <span className="font-display font-black text-lg text-amber-400 tracking-tight tabular-nums">
                  {player.combo}x Combo
                </span>
              </div>
            )}
          </div>

          {/* Top-Right: Game Metrics, Settings, Controls */}
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex items-center gap-1.5 pointer-events-auto tac-hud-pod px-2.5 py-1.5 rounded-xl border border-zinc-700/80">
              <button
                onClick={() => {
                  playUiClick();
                  onOpenSettings();
                }}
                className="tac-bevel-btn px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-cyan-400/60 text-zinc-200 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Game Settings"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={() => {
                  playUiClick();
                  onPauseToggle();
                }}
                className="tac-bevel-btn p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 text-zinc-200 cursor-pointer"
                title="Pause / Resume Game"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-amber-300" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  playUiClick();
                  onQuit();
                }}
                className="tac-bevel-btn p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-rose-400/60 text-rose-400 cursor-pointer"
                title="Return to Menu"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] font-mono text-zinc-200 tac-hud-pod px-3 py-1 rounded-lg border border-zinc-700/75">
              <span className="text-cyan-300">{BIOME_LABELS[biomeStage]}</span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span className="text-zinc-300">{activeWorld.shortName}</span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span
                className={wxProfile.isExtreme ? 'font-bold' : 'text-zinc-400'}
                style={wxProfile.isExtreme ? { color: wxProfile.accentColor } : undefined}
              >
                {weatherLabel}
              </span>
            </div>

            {wxProfile.isExtreme && (
              <div
                className="text-[10px] font-mono font-bold tac-hud-pod px-2.5 py-1 rounded-lg border shadow-md"
                style={{
                  borderColor: `${wxProfile.accentColor}70`,
                  color: wxProfile.accentColor,
                }}
              >
                {wxProfile.modifierSummary}
              </div>
            )}

            <div className="flex items-center gap-2 tac-hud-pod px-3 py-1.5 rounded-xl border border-amber-500/45 shadow-lg text-amber-400">
              <Coins className="w-4 h-4 stroke-[2.5]" />
              <span className="font-mono tabular-nums font-bold text-sm tracking-wide">
                {player.gold} <span className="text-xs text-amber-500/85 font-normal">Gold</span>
              </span>
            </div>

            {/* Right-Side Translucent Scrolling Tactical Mission Log (Hidden when not in use) */}
            {!missionLogOpen ? (
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setMissionLogOpen(true);
                  setSeenLogCount(missionLogs.length);
                }}
                className="pointer-events-auto tac-hud-pod tac-bevel-btn px-3 py-1.5 rounded-xl border border-cyan-500/40 hover:border-cyan-300/80 text-cyan-200 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.14em] cursor-pointer shadow-lg"
                title="Show Mission Log"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mission Log</span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[9px] tabular-nums leading-none ${
                    unreadLogsCount > 0
                      ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {unreadLogsCount > 0 ? `+${unreadLogsCount}` : missionLogs.length}
                </span>
                <Eye className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            ) : (
              <div className="pointer-events-auto tac-hud-pod border border-cyan-500/35 rounded-xl p-2 w-60 sm:w-72 text-left shadow-xl">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1 mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-300">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Mission Log</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono tabular-nums text-zinc-400">
                      {missionLogs.length} EVTS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playUiClick();
                        setMissionLogOpen(false);
                        setSeenLogCount(missionLogs.length);
                      }}
                      className="tac-bevel-btn px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 hover:text-white flex items-center gap-1 text-[9px] font-mono font-bold uppercase cursor-pointer"
                      title="Hide Mission Log"
                    >
                      <EyeOff className="w-2.5 h-2.5 text-cyan-300" />
                      <span>Hide</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-28 sm:max-h-36 overflow-y-auto pr-1 flex flex-col gap-1 text-[10px] font-mono">
                  {missionLogs.length === 0 ? (
                    <div className="text-zinc-500 py-1 text-[10px]">
                      Scanning sector frequencies...
                    </div>
                  ) : (
                    missionLogs.map((entry) => {
                      const catStyles: Record<MissionLogEntry['category'], string> = {
                        combat: 'bg-sky-950/90 border-sky-500/45 text-sky-300',
                        boss: 'bg-red-950/90 border-red-500/55 text-red-300',
                        vehicle: 'bg-cyan-950/90 border-cyan-400/55 text-cyan-300',
                        ally: 'bg-fuchsia-950/90 border-fuchsia-400/55 text-fuchsia-300',
                        world: 'bg-amber-950/90 border-amber-500/45 text-amber-300',
                      };
                      const catLabel: Record<MissionLogEntry['category'], string> = {
                        combat: 'COMBAT',
                        boss: 'BOSS',
                        vehicle: 'CAR',
                        ally: 'ALLY',
                        world: 'SECTOR',
                      };
                      const msgColor =
                        entry.severity === 'crit'
                          ? 'text-red-200 font-semibold'
                          : entry.severity === 'warn'
                          ? 'text-amber-200'
                          : entry.severity === 'success'
                          ? 'text-emerald-200'
                          : 'text-zinc-200';

                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-1.5 leading-snug border-b border-zinc-800/55 pb-1 last:border-b-0 last:pb-0"
                        >
                          <span className="text-[9px] text-zinc-500 tabular-nums shrink-0 mt-0.5">
                            {entry.timestamp}
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded border text-[8px] font-bold tracking-wider leading-none shrink-0 mt-0.5 ${catStyles[entry.category]}`}
                          >
                            {catLabel[entry.category]}
                          </span>
                          <span className={`${msgColor} break-words`}>{entry.message}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom HUD Row: Optional Touch/Click Controls + Distance Bar */}
        <div className="relative flex items-end justify-between gap-2 w-full">
          {/* Bottom-Left: Directional Movement Pad (CODM Style) */}
          {showTouchControls ? (
            <div
              className="pointer-events-auto touch-none flex items-center gap-2.5 origin-bottom-left"
              style={{
                opacity: settings.controlOpacity,
                transform: `scale(${settings.controlScale})`,
              }}
            >
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setHoldControl('left', 'left', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoldControl('left', 'left', false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  setHoldControl('left', 'left', false);
                }}
                onLostPointerCapture={() => setHoldControl('left', 'left', false)}
                className={`tac-hud-pod tac-bevel-btn relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer select-none ${
                  isPressed('left')
                    ? 'scale-95 bg-cyan-950/90 border-cyan-300 text-white shadow-[0_0_18px_rgba(34,211,238,0.45)]'
                    : 'border-cyan-500/45 text-cyan-200 hover:border-cyan-400/80'
                }`}
              >
                <ChevronLeft className="w-7 h-7 stroke-[2.5]" />
                <span className="absolute -top-2 -right-1.5 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[9px] font-mono font-bold text-cyan-300 leading-none">
                  [A]
                </span>
              </button>

              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setHoldControl('right', 'right', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoldControl('right', 'right', false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  setHoldControl('right', 'right', false);
                }}
                onLostPointerCapture={() => setHoldControl('right', 'right', false)}
                className={`tac-hud-pod tac-bevel-btn relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer select-none ${
                  isPressed('right')
                    ? 'scale-95 bg-cyan-950/90 border-cyan-300 text-white shadow-[0_0_18px_rgba(34,211,238,0.45)]'
                    : 'border-cyan-500/45 text-cyan-200 hover:border-cyan-400/80'
                }`}
              >
                <ChevronRight className="w-7 h-7 stroke-[2.5]" />
                <span className="absolute -top-2 -right-1.5 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[9px] font-mono font-bold text-cyan-300 leading-none">
                  [D]
                </span>
              </button>
            </div>
          ) : (
            <div className="w-4" />
          )}

          {/* Bottom-Center: Ally Prompt, Hypercar Controls/Telemetry, Abilities & Distance Bar */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto">
            {/* Nearby Female Ally NPC Prompt */}
            {nearbyNpc && (
              <div className="w-full pointer-events-auto tac-hud-pod border border-fuchsia-400/55 rounded-xl px-3 py-2 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300 shrink-0" />
                    <span className="font-display text-xs font-bold text-white truncate">
                      {nearbyNpc.name}
                    </span>
                    <span className="text-[10px] font-mono text-fuchsia-300/90 truncate">
                      · {nearbyNpc.title}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-300 truncate mt-0.5">
                    “{nearbyNpc.dialogue}”
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={!nearbyNpc.cooldownReady}
                    onClick={() => {
                      playUiClick();
                      onTriggerAction('interact');
                    }}
                    className={`tac-bevel-btn px-2.5 py-1.5 rounded-lg border text-[10px] font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      nearbyNpc.cooldownReady
                        ? 'bg-fuchsia-950/85 border-fuchsia-400 text-fuchsia-100 hover:bg-fuchsia-900'
                        : 'bg-zinc-900/80 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {nearbyNpc.cooldownReady ? `[G] ${nearbyNpc.actionLabel}` : 'Recharging'}
                  </button>

                  {nearbyNpc.role === 'mechanic' && onOpenArmory && (
                    <button
                      type="button"
                      onClick={() => {
                        playUiClick();
                        onOpenArmory();
                      }}
                      className="tac-bevel-btn px-2.5 py-1.5 rounded-lg border border-cyan-400/70 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 text-[10px] font-display font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Garage</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Hypercar Drive/Exit/Recall Action + Driving Telemetry Strip */}
            <div className="w-full flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onTriggerAction('vehicle');
                }}
                className={`tac-hud-pod tac-bevel-btn px-3 py-1.5 rounded-xl border text-[11px] font-display font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                  vehicleState.occupied
                    ? 'border-rose-400/70 text-rose-200 hover:border-rose-300'
                    : vehicleState.nearCar
                    ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                    : 'border-cyan-500/45 text-cyan-300 hover:border-cyan-400'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>
                  {vehicleState.occupied
                    ? 'Exit Chiron-X [F]'
                    : vehicleState.nearCar
                    ? 'Drive Chiron-X [F]'
                    : `Call Hypercar (${vehicleState.distanceToCarM}m) [F]`}
                </span>
              </button>

              {vehicleState.occupied && (
                <div className="tac-hud-pod border border-cyan-500/45 rounded-xl px-3 py-1.5 flex items-center gap-3 text-[10px] font-mono tabular-nums">
                  <div className="flex items-center gap-1 text-cyan-200 font-bold">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{Math.round(vehicleState.speedKmh)} KM/H</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {vehicleState.empLockoutTimer > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-violet-950/90 border border-violet-400/75 text-violet-200 font-bold">
                        EMP LOCKED {vehicleState.empLockoutTimer.toFixed(1)}s
                      </span>
                    ) : (
                      <span className={vehicleState.nitroActive ? 'text-sky-300 font-bold' : 'text-zinc-400'}>
                        NITRO
                      </span>
                    )}
                    <div
                      className={`w-16 h-1.5 rounded-full bg-zinc-950 border overflow-hidden ${
                        vehicleState.empLockoutTimer > 0 ? 'border-violet-400/60' : 'border-cyan-500/35'
                      }`}
                    >
                      <div
                        className={`h-full transition-all duration-75 ${
                          vehicleState.empLockoutTimer > 0
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-400'
                            : 'bg-gradient-to-r from-cyan-500 to-sky-300'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, vehicleState.nitro))}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={
                      vehicleState.missileCooldown <= 0.05
                        ? 'text-amber-300 font-bold'
                        : 'text-zinc-400'
                    }
                  >
                    {vehicleState.missileCooldown <= 0.05
                      ? 'MISSILE READY'
                      : `MSL ${vehicleState.missileCooldown.toFixed(1)}s`}
                  </span>
                </div>
              )}
            </div>

            {!showTouchControls && (
              <div className="flex items-center gap-2 pointer-events-auto">
                {abilityCards.map((ab) => {
                  const ready = ab.cooldown <= 0.05;
                  const pct = Math.min(100, (ab.cooldown / ab.maxCooldown) * 100);
                  const isCounterHighlight = ab.id === 'dash' && !vehicleState.occupied && counterPhase !== null;
                  return (
                    <button
                      key={ab.id}
                      type="button"
                      onClick={() => {
                        playUiClick();
                        onTriggerAction(ab.id);
                      }}
                      className={`tac-hud-pod tac-bevel-btn relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                        isCounterHighlight && counterPhase === 'PERFECT'
                          ? 'border-cyan-200 ring-2 ring-cyan-300 bg-cyan-950/85 text-white shadow-[0_0_20px_rgba(34,211,238,0.65)] scale-105'
                          : isCounterHighlight && counterPhase === 'CHARGING'
                          ? 'border-amber-300 ring-2 ring-amber-400/75 text-amber-100'
                          : ab.active
                          ? 'border-white ring-2 ring-cyan-400/70 text-white'
                          : ready
                          ? `${ab.accent} hover:border-white/60`
                          : 'border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {!ready && (
                        <div
                          className="absolute inset-y-0 left-0 bg-zinc-800/70 transition-all duration-100"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2">
                        {ab.icon}
                        <div className="text-left leading-tight">
                          <div className="font-display text-[11px] font-bold">
                            {isCounterHighlight && counterPhase === 'PERFECT'
                              ? 'COUNTER-DASH!'
                              : ab.name}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums opacity-85">
                            {isCounterHighlight && counterPhase === 'PERFECT'
                              ? `[${ab.keyLabel}] +${counterDash?.bonusPct ?? 45}%`
                              : ab.active
                              ? 'ACTIVE'
                              : ready
                              ? `[${ab.keyLabel}]`
                              : `${ab.cooldown.toFixed(1)}s`}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Distance Progress Bar */}
            <div className="w-full tac-hud-pod px-3.5 py-2.5 rounded-2xl border border-zinc-700/80 shadow-2xl flex flex-col gap-1 pointer-events-auto">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Milestone className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-display uppercase tracking-wider text-[10px]">Odyssey Distance</span>
                </div>
                <span className="font-bold text-white tracking-wide">
                  {Math.round(player.distance)}m{' '}
                  <span className="text-zinc-500 font-normal">/ {totalTargetDistance}m</span>
                </span>
              </div>

              <div className="relative w-full h-2 bg-zinc-950 rounded-full border border-zinc-800 overflow-visible">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-600 via-orange-500 to-red-600 rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute top-1/2 left-1/5 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 border border-zinc-950" />
                <div className="absolute top-1/2 left-2/5 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400 border border-zinc-950" />
                <div className="absolute top-1/2 left-3/5 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 border border-zinc-950" />
                <div className="absolute top-1/2 left-4/5 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-400 border border-zinc-950" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-100 border-2 border-amber-500 rounded-full shadow-lg transition-all duration-100"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-mono tabular-nums text-zinc-500 px-0.5">
                <span>0m</span>
                <span>400m</span>
                <span>800m</span>
                <span>1200m</span>
                <span>1600m</span>
                <span>2000m</span>
              </div>
            </div>
          </div>

          {/* Bottom-Right: CODM Action Cluster (Jump, Sword Slash, Shoot + 3 Ability Orbs) */}
          {showTouchControls ? (
            <div
              className="pointer-events-auto touch-none relative w-[206px] h-[168px] sm:w-[228px] sm:h-[182px] shrink-0 origin-bottom-right select-none"
              style={{
                opacity: settings.controlOpacity,
                transform: `scale(${settings.controlScale})`,
              }}
            >
              {/* Three Circular Special Ability Buttons in Arc */}
              {abilityCards.map((ab, idx) => {
                const ready = ab.cooldown <= 0.05;
                const cdRatio = ready ? 0 : Math.min(1, ab.cooldown / ab.maxCooldown);
                const isCounterHighlight = ab.id === 'dash' && !vehicleState.occupied && counterPhase !== null;
                const posClasses =
                  idx === 0
                    ? 'left-0 bottom-[66px]' // Cyber-Dash [Q]
                    : idx === 1
                    ? 'left-[42px] top-[8px]' // Aegis Dome [E]
                    : 'left-[100px] top-0'; // Orbital Strike [R]

                return (
                  <button
                    key={ab.id}
                    type="button"
                    aria-label={ab.name}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPressedControls((prev) => ({ ...prev, [ab.id]: true }));
                      onTriggerAction(ab.id);
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      setPressedControls((prev) => ({ ...prev, [ab.id]: false }));
                    }}
                    onPointerLeave={() =>
                      setPressedControls((prev) => ({ ...prev, [ab.id]: false }))
                    }
                    onPointerCancel={() =>
                      setPressedControls((prev) => ({ ...prev, [ab.id]: false }))
                    }
                    className={`tac-hud-pod tac-bevel-btn absolute ${posClasses} w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer ${
                      isPressed(ab.id)
                        ? 'scale-90'
                        : isCounterHighlight && counterPhase === 'PERFECT'
                        ? 'scale-110'
                        : 'scale-100'
                    } ${
                      isCounterHighlight && counterPhase === 'PERFECT'
                        ? 'bg-cyan-900/95 border-cyan-200 text-white ring-2 ring-amber-300 shadow-[0_0_20px_rgba(34,211,238,0.85)]'
                        : isCounterHighlight && counterPhase === 'CHARGING'
                        ? 'border-amber-300 text-amber-200 ring-2 ring-amber-400/70'
                        : ab.active
                        ? 'bg-cyan-950/90 border-white text-white shadow-[0_0_16px_rgba(34,211,238,0.65)]'
                        : ready
                        ? `${ab.accent}`
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                    style={
                      !ready
                        ? {
                            backgroundImage: `conic-gradient(rgba(15,23,42,0.88) ${cdRatio * 360}deg, transparent 0deg)`,
                          }
                        : undefined
                    }
                    title={`${ab.name} [${ab.keyLabel}]`}
                  >
                    {isCounterHighlight && counterPhase === 'PERFECT' && (
                      <span className="absolute -top-3 px-1 py-0.5 rounded bg-amber-400 text-zinc-950 border border-white text-[7px] font-mono font-black leading-none whitespace-nowrap">
                        COUNTER!
                      </span>
                    )}
                    {ready ? (
                      ab.icon
                    ) : (
                      <span className="text-[10px] font-mono font-black tabular-nums text-zinc-200">
                        {ab.cooldown.toFixed(1)}
                      </span>
                    )}
                    <span className="absolute -bottom-1.5 px-1 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono font-bold text-zinc-200 leading-none">
                      [{ab.shortKey}]
                    </span>
                  </button>
                );
              })}

              {/* Jump Button [W / Space] */}
              <button
                type="button"
                aria-label="Jump"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPressedControls((prev) => ({ ...prev, jump: true }));
                  onTriggerAction('jump');
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  setPressedControls((prev) => ({ ...prev, jump: false }));
                }}
                onPointerLeave={() => setPressedControls((prev) => ({ ...prev, jump: false }))}
                onPointerCancel={() => setPressedControls((prev) => ({ ...prev, jump: false }))}
                className={`tac-hud-pod tac-bevel-btn absolute right-1 top-2 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer ${
                  isPressed('jump')
                    ? 'scale-92 bg-sky-900/90 border-sky-300 text-white shadow-[0_0_16px_rgba(56,189,248,0.55)]'
                    : 'border-sky-400/60 text-sky-200 hover:border-sky-300'
                }`}
              >
                <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                <span className="text-[8px] font-display font-bold tracking-wider uppercase leading-none mt-0.5">
                  Jump
                </span>
                <span className="absolute -top-1.5 -left-2 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono font-bold text-sky-300 leading-none">
                  [W/SPC]
                </span>
              </button>

              {/* Sword Slash (Melee) Button [K / RMB] */}
              <button
                type="button"
                aria-label="Sword Slash"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setHoldControl('slash', 'slashHeld', true, 'slash');
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoldControl('slash', 'slashHeld', false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  setHoldControl('slash', 'slashHeld', false);
                }}
                onLostPointerCapture={() => setHoldControl('slash', 'slashHeld', false)}
                className={`tac-hud-pod tac-bevel-btn absolute right-[78px] bottom-1 w-14 h-14 sm:w-15 sm:h-15 rounded-full border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer ${
                  isPressed('slash')
                    ? 'scale-92 bg-amber-900/90 border-amber-300 text-white shadow-[0_0_18px_rgba(245,158,11,0.6)]'
                    : 'border-amber-500/65 text-amber-200 hover:border-amber-400'
                }`}
              >
                <Sword className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[8px] font-display font-bold tracking-wider uppercase leading-none mt-0.5">
                  {vehicleState.occupied ? 'Missile' : 'Slash'}
                </span>
                <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono font-bold text-amber-300 leading-none whitespace-nowrap">
                  [K/RMB]
                </span>
              </button>

              {/* Primary Shoot Button [J / LMB] */}
              <button
                type="button"
                aria-label={vehicleState.occupied ? 'Fire Minigun' : 'Shoot'}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setHoldControl('shoot', 'shootHeld', true, 'shoot');
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoldControl('shoot', 'shootHeld', false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  setHoldControl('shoot', 'shootHeld', false);
                }}
                onLostPointerCapture={() => setHoldControl('shoot', 'shootHeld', false)}
                className={`tac-hud-pod tac-bevel-btn absolute right-0 bottom-0 w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full border-2 flex flex-col items-center justify-center transition-transform duration-75 cursor-pointer ${
                  isPressed('shoot')
                    ? 'scale-92 bg-cyan-900/90 border-cyan-200 text-white shadow-[0_0_22px_rgba(34,211,238,0.65)]'
                    : 'border-cyan-400/75 text-cyan-200 hover:border-cyan-300'
                }`}
              >
                <Crosshair className="w-6 h-6 stroke-[2.2]" />
                <span className="text-[9px] font-display font-black tracking-wider uppercase leading-none mt-0.5">
                  {vehicleState.occupied ? 'Minigun' : 'Shoot'}
                </span>
                <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono font-bold text-cyan-300 leading-none whitespace-nowrap">
                  [J/LMB]
                </span>
              </button>
            </div>
          ) : (
            <div className="w-4" />
          )}
        </div>
      </div>
    </div>
  );
}
