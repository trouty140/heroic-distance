import React, { useEffect, useState } from 'react';
import {
  X,
  CloudRain,
  Sparkles,
  Volume2,
  VolumeX,
  Globe,
  Sliders,
  Music,
  Zap,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Sword,
  Crosshair,
  Wind,
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  CheckCircle2,
  User,
} from 'lucide-react';
import type {
  GameSettings,
  GraphicsQuality,
  TouchControlsMode,
  UserAccount,
  WeatherCondition,
  WorldId,
} from '../types';
import { WORLD_LIST, WEATHER_OPTIONS } from '../config/worlds';
import { changeAccountPassword, renameAccountUsername } from '../utils/authStorage';
import { TacticalAvatarCrest } from './AuthScreen';
import { playPowerUp, playSlash, playUiClick } from '../utils/audio';

export type SettingsTab = 'graphics' | 'worlds' | 'controls' | 'account';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onWorldChange?: (world: WorldId) => void;
  initialTab?: SettingsTab;
  account?: UserAccount | null;
  isGuestPass?: boolean;
  onAccountUpdated?: (account: UserAccount) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onWorldChange,
  initialTab,
  account,
  isGuestPass = false,
  onAccountUpdated,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'graphics');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState(account?.username || '');
  const [renamePassword, setRenamePassword] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState<string | null>(null);

  const canManageAccount = Boolean(account && !isGuestPass);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab && (initialTab !== 'account' || canManageAccount)) {
      setActiveTab(initialTab);
    } else if (!canManageAccount && activeTab === 'account') {
      setActiveTab('graphics');
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
    setPwError(null);
    setPwSuccess(null);
    setNewUsername(account?.username || '');
    setRenamePassword('');
    setRenameError(null);
    setRenameSuccess(null);
  }, [isOpen, initialTab, canManageAccount, account?.username]);

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    setPwError(null);
    setPwSuccess(null);

    if (!account) {
      setPwError('No active operative account found.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passcode and confirmation do not match.');
      return;
    }

    const res = changeAccountPassword({
      username: account.username,
      currentPassword,
      newPassword,
    });
    if (res.ok === false) {
      setPwError(res.error);
      return;
    }

    playPowerUp();
    onAccountUpdated?.(res.account);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwSuccess(`Passcode updated for ${res.account.username}. Use your new passcode next time you log in.`);
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    setRenameError(null);
    setRenameSuccess(null);

    if (!account) {
      setRenameError('No active operative account found.');
      return;
    }

    const res = renameAccountUsername({
      currentUsername: account.username,
      newUsername,
      currentPassword: renamePassword,
    });
    if (res.ok === false) {
      setRenameError(res.error);
      return;
    }

    playPowerUp();
    onAccountUpdated?.(res.account);
    setNewUsername(res.account.username);
    setRenamePassword('');
    setRenameSuccess(`Callsign updated to ${res.account.username}.`);
  };

  const handleQualityPreset = (quality: GraphicsQuality) => {
    playUiClick();
    onUpdateSettings({
      ...settings,
      graphicsQuality: quality,
      volumetricLighting: quality !== 'low',
      rayTracedReflections: quality === 'high' || quality === 'ultra',
      particlesEnabled: true,
    });
  };

  const handleWorldSelect = (worldId: WorldId) => {
    playUiClick();
    onUpdateSettings({ ...settings, world: worldId });
    onWorldChange?.(worldId);
  };

  const handleWeatherSelect = (weather: WeatherCondition) => {
    playUiClick();
    onUpdateSettings({ ...settings, weather });
  };

  const handleTouchModeSelect = (mode: TouchControlsMode) => {
    playUiClick();
    onUpdateSettings({ ...settings, touchControlsMode: mode });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto tac-gunmetal tac-glass border border-cyan-500/35 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-zinc-800/90 pb-4">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white tracking-wider uppercase">
                Game Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Configure 3D graphics, audio mixer, worlds, and CODM-style HUD controls.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="tac-bevel-btn p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="relative z-10 flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
          {(
            [
              {
                id: 'graphics',
                label: 'Graphics & Audio',
                icon: <Sparkles className="w-3.5 h-3.5" />,
              },
              {
                id: 'worlds',
                label: 'Worlds & Weather',
                icon: <Globe className="w-3.5 h-3.5" />,
              },
              {
                id: 'controls',
                label: 'Controls',
                icon: <Gamepad2 className="w-3.5 h-3.5" />,
              },
              ...(canManageAccount
                ? [
                    {
                      id: 'account' as const,
                      label: 'Username & Passcode',
                      icon: <KeyRound className="w-3.5 h-3.5" />,
                    },
                  ]
                : []),
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playUiClick();
                  setActiveTab(tab.id);
                }}
                className={`tac-bevel-btn px-3.5 py-2 rounded-lg border text-xs font-display font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer ${
                  selected
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-zinc-950/75 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: GRAPHICS & AUDIO */}
        {activeTab === 'graphics' && (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Graphics Quality Presets</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'low', label: 'Low', desc: 'Max FPS · No shadows/bloom' },
                    { id: 'medium', label: 'Medium', desc: 'Soft shadows · Light bloom' },
                    { id: 'high', label: 'High', desc: 'HD shadows · Reflections' },
                    { id: 'ultra', label: 'Ultra', desc: '2K shadows · Max bloom & rays' },
                  ] as const
                ).map((preset) => {
                  const active = settings.graphicsQuality === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleQualityPreset(preset.id)}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-950/45 border-amber-400 text-white'
                          : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Volumetric God-Rays</div>
                    <div className="text-[10px] text-zinc-500">Sunbeams & mist shafts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.volumetricLighting}
                    onChange={(e) => {
                      playUiClick();
                      onUpdateSettings({ ...settings, volumetricLighting: e.target.checked });
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Wet Reflections</div>
                    <div className="text-[10px] text-zinc-500">Specular horizon & puddles</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.rayTracedReflections}
                    onChange={(e) => {
                      playUiClick();
                      onUpdateSettings({ ...settings, rayTracedReflections: e.target.checked });
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Weather Particles</div>
                    <div className="text-[10px] text-zinc-500">Rain, snow, ash & spores</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.particlesEnabled}
                    onChange={(e) => {
                      playUiClick();
                      onUpdateSettings({ ...settings, particlesEnabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* Sound FX & Audio Controls */}
            <section className="flex flex-col gap-3 bg-zinc-950/70 border border-zinc-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-500" />
                  )}
                  <span>Sound FX & Music Mixer</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playSlash()}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Test SFX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playUiClick();
                      onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled });
                    }}
                    className={`tac-bevel-btn px-3 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      settings.soundEnabled
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500 text-rose-300'
                    }`}
                  >
                    {settings.soundEnabled ? 'Audio Unmuted' : 'Muted'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-mono tabular-nums">
                    <span>Master Volume</span>
                    <span className="text-amber-400">{Math.round(settings.masterVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.masterVolume * 100)}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, masterVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-mono tabular-nums">
                    <span>Sound FX (SFX)</span>
                    <span className="text-cyan-400">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.sfxVolume * 100)}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, sfxVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Music className="w-3 h-3 text-purple-400" />
                      Music
                    </span>
                    <span className="text-purple-300">{Math.round(settings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.musicVolume * 100)}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, musicVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </label>
              </div>
            </section>
          </>
        )}

        {/* TAB 2: WORLDS & WEATHER */}
        {activeTab === 'worlds' && (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>World Environment</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {WORLD_LIST.map((world) => {
                  const active = settings.world === world.id;
                  return (
                    <button
                      key={world.id}
                      onClick={() => handleWorldSelect(world.id)}
                      className={`text-left rounded-xl overflow-hidden border transition-all cursor-pointer flex flex-col ${
                        active
                          ? 'border-amber-400 bg-zinc-800/80 ring-1 ring-amber-400/40'
                          : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                      }`}
                    >
                      <div className="relative h-24 w-full bg-zinc-950 overflow-hidden">
                        {!failedImages[world.id] ? (
                          <img
                            src={world.backdropSrc}
                            alt={world.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [world.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-xs text-zinc-400"
                            style={{
                              background: `linear-gradient(135deg, ${world.skyTop}, ${world.skyBottom})`,
                            }}
                          >
                            {world.shortName}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <span className="absolute bottom-2 left-2.5 text-xs font-semibold text-white">
                          {world.name}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[11px] font-medium text-zinc-300">{world.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <CloudRain className="w-4 h-4 text-sky-400" />
                  <span>Weather Condition (Manual Selection)</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Extreme weathers add tactical modifiers
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {WEATHER_OPTIONS.map((w) => {
                  const active = settings.weather === w.id;
                  const extremeTone =
                    w.id === 'acid_rain'
                      ? 'border-emerald-400/80 bg-emerald-950/55 text-emerald-100'
                      : w.id === 'solar_flare'
                      ? 'border-orange-400/80 bg-orange-950/55 text-orange-100'
                      : w.id === 'void_storm'
                      ? 'border-purple-400/80 bg-purple-950/55 text-purple-100'
                      : 'bg-sky-950/50 border-sky-400 text-white';

                  return (
                    <button
                      key={w.id}
                      onClick={() => handleWeatherSelect(w.id)}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? extremeTone
                          : w.isExtreme
                          ? 'bg-zinc-950/75 border-zinc-700 text-zinc-200 hover:border-zinc-500'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold whitespace-nowrap truncate">
                          {w.label}
                        </span>
                        {w.isExtreme && (
                          <span className="text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded bg-black/50 border border-white/15 text-amber-300 shrink-0">
                            MOD
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2 leading-tight">
                        {w.summary}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* TAB 3: CONTROLS (TOUCH/CLICK HUD + KEYBOARD LAYOUT DIAGRAM) */}
        {activeTab === 'controls' && (
          <div className="flex flex-col gap-5">
            {/* On-Screen Touch & Click Controls Configuration */}
            <section className="flex flex-col gap-4 bg-zinc-950/75 border border-zinc-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>On-Screen Touch & Click Controls</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Works simultaneously with mouse, touch & keyboard
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'auto',
                      label: 'Auto',
                      desc: 'Show on touch & compact screens',
                    },
                    {
                      id: 'always',
                      label: 'Always Show',
                      desc: 'Visible on all devices',
                    },
                    {
                      id: 'hide',
                      label: 'Hide',
                      desc: 'Hide on-screen buttons',
                    },
                  ] as const
                ).map((mode) => {
                  const active = settings.touchControlsMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleTouchModeSelect(mode.id)}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-950/50 border-cyan-400 text-white'
                          : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{mode.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-mono tabular-nums">
                    <span>Button Opacity</span>
                    <span className="text-cyan-400">{Math.round(settings.controlOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    value={Math.round(settings.controlOpacity * 100)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        controlOpacity: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300 font-mono tabular-nums">
                    <span>Button Size</span>
                    <span className="text-amber-400">{Math.round(settings.controlScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={75}
                    max={135}
                    value={Math.round(settings.controlScale * 100)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        controlScale: Number(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* Control Layout Diagram */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <Gamepad2 className="w-4 h-4 text-amber-400" />
                  <span>Control Layout Diagram</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Parry Guard: [S / ↓ / L]
                </span>
              </div>

              {/* Visual HUD Schematic */}
              <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-4 overflow-hidden">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 text-center mb-3">
                  CODM Tactical HUD & Keybind Map
                </div>

                <div
                  className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 transition-opacity"
                  style={{
                    opacity: settings.touchControlsMode === 'hide' ? 0.35 : settings.controlOpacity,
                  }}
                >
                  {/* Left Zone Preview */}
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="flex items-center gap-2 origin-bottom-left transition-transform"
                      style={{ transform: `scale(${Math.min(1.12, Math.max(0.82, settings.controlScale * 0.9))})` }}
                    >
                      <div className="relative w-12 h-12 rounded-xl border-2 border-cyan-500/50 bg-zinc-900 flex items-center justify-center text-cyan-300">
                        <ChevronLeft className="w-6 h-6" />
                        <span className="absolute -top-2 -right-1 px-1 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono">
                          [A]
                        </span>
                      </div>
                      <div className="relative w-12 h-12 rounded-xl border-2 border-cyan-500/50 bg-zinc-900 flex items-center justify-center text-cyan-300">
                        <ChevronRight className="w-6 h-6" />
                        <span className="absolute -top-2 -right-1 px-1 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[8px] font-mono">
                          [D]
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Left / Right Movement (A, D, ←, →)
                    </span>
                  </div>

                  {/* Center Zone Indicator */}
                  <div className="hidden md:flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
                    <span className="text-[10px] font-mono text-zinc-400">Distance Bar</span>
                    <div className="w-28 h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-red-500" />
                    <span className="text-[9px] font-mono text-zinc-500">0m → 2000m</span>
                  </div>

                  {/* Right Zone Preview */}
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="relative w-[178px] h-[132px] origin-bottom-right transition-transform"
                      style={{ transform: `scale(${Math.min(1.1, Math.max(0.82, settings.controlScale * 0.88))})` }}
                    >
                      <div className="absolute left-0 bottom-[52px] w-9 h-9 rounded-full border border-cyan-500/60 bg-zinc-900 flex items-center justify-center text-cyan-300">
                        <Wind className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-1.5 px-1 rounded bg-zinc-950 border border-zinc-700 text-[7px] font-mono">
                          [Q]
                        </span>
                      </div>
                      <div className="absolute left-[36px] top-[6px] w-9 h-9 rounded-full border border-sky-400/60 bg-zinc-900 flex items-center justify-center text-sky-300">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-1.5 px-1 rounded bg-zinc-950 border border-zinc-700 text-[7px] font-mono">
                          [E]
                        </span>
                      </div>
                      <div className="absolute left-[84px] top-0 w-9 h-9 rounded-full border border-amber-400/60 bg-zinc-900 flex items-center justify-center text-amber-300">
                        <Crosshair className="w-3.5 h-3.5" />
                        <span className="absolute -bottom-1.5 px-1 rounded bg-zinc-950 border border-zinc-700 text-[7px] font-mono">
                          [R]
                        </span>
                      </div>

                      <div className="absolute right-0 top-1 w-11 h-11 rounded-full border-2 border-sky-400/60 bg-zinc-900 flex flex-col items-center justify-center text-sky-200">
                        <ArrowUp className="w-4 h-4" />
                        <span className="text-[7px] font-bold">JUMP</span>
                      </div>
                      <div className="absolute right-[62px] bottom-0 w-11 h-11 rounded-full border-2 border-amber-500/60 bg-zinc-900 flex flex-col items-center justify-center text-amber-200">
                        <Sword className="w-4 h-4" />
                        <span className="text-[7px] font-bold">SLASH</span>
                      </div>
                      <div className="absolute right-0 bottom-0 w-13 h-13 rounded-full border-2 border-cyan-400/75 bg-zinc-900 flex flex-col items-center justify-center text-cyan-200">
                        <Crosshair className="w-4 h-4" />
                        <span className="text-[7px] font-bold">SHOOT</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Jump · Slash · Shoot · Special Powers
                    </span>
                  </div>
                </div>
              </div>

              {/* Keybind Reference Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { action: 'Move Left / Right', bind: 'A / D or Arrow Keys' },
                  { action: 'Jump / Double Jump', bind: 'W / Space / Arrow Up' },
                  { action: 'Shoot Rifle / Minigun', bind: 'J or Left-Click' },
                  { action: 'Sword Slash / Car Missile', bind: 'K or Right-Click' },
                  { action: 'Cyber-Dash / Car Nitro', bind: 'Q / 1 / Shift' },
                  { action: 'Aegis Shield Dome', bind: 'E / 2' },
                  { action: 'Orbital Rail-Strike', bind: 'R / 3' },
                  { action: 'Deflect / Parry', bind: 'S / Arrow Down / L' },
                  { action: 'Drive / Exit / Call Hypercar', bind: 'F' },
                  { action: 'Interact with Ally NPC', bind: 'G' },
                ].map((row) => (
                  <div
                    key={row.action}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800"
                  >
                    <span className="text-zinc-300 font-medium">{row.action}</span>
                    <span className="font-mono text-[11px] font-semibold text-amber-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                      {row.bind}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: ACCOUNT & PASSCODE */}
        {activeTab === 'account' && account && !isGuestPass && (
          <div className="relative z-10 flex flex-col gap-4">
            <div className="bg-zinc-950/75 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <TacticalAvatarCrest avatarId={account.avatarId} size={40} />
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-white truncate">
                    {account.username}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {account.passwordHash
                      ? 'Local passcode protection enabled'
                      : 'Cloud-restored operative · Set a local passcode below'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-[10px] font-mono font-bold uppercase text-amber-300 shrink-0">
                Active Operative
              </span>
            </div>

            <form
              onSubmit={handleUsernameSubmit}
              className="bg-zinc-950/75 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>Change Callsign (Username)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  3–18 chars · letters, numbers, _ or -
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="settings-new-username"
                    className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    New Callsign (Username)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-new-username"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      maxLength={18}
                      placeholder="Enter new callsign"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {Boolean(account.passwordHash) && (
                  <div>
                    <label
                      htmlFor="settings-rename-password"
                      className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
                    >
                      Confirm with Passcode
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="settings-rename-password"
                        type={showPasswords ? 'text' : 'password'}
                        value={renamePassword}
                        onChange={(e) => setRenamePassword(e.target.value)}
                        placeholder="Enter current passcode"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {renameError && (
                <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200">
                  {renameError}
                </div>
              )}

              {renameSuccess && (
                <div className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{renameSuccess}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="tac-bevel-btn px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Update Username</span>
                </button>
              </div>
            </form>

            <form
              onSubmit={handlePasswordSubmit}
              className="bg-zinc-950/75 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Change Account Passcode</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setShowPasswords((prev) => !prev);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>

              {Boolean(account.passwordHash) && (
                <div>
                  <label
                    htmlFor="settings-current-password"
                    className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    Current Passcode
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-current-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current passcode"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="settings-new-password"
                    className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    New Passcode
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-new-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="settings-confirm-password"
                    className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    Confirm New Passcode
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-confirm-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new passcode"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {pwError && (
                <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200">
                  {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pwSuccess}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="tac-bevel-btn px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-display font-bold uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{account.passwordHash ? 'Update Passcode' : 'Set Passcode'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="relative z-10 flex justify-end border-t border-zinc-800/80 pt-4">
          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="tac-bevel-btn px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
