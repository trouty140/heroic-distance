import type { WeatherCondition, WorldId, GameSettings } from '../types';
import scifiBackdrop from '../assets/images/world_scifi_jungle_1795582866735.jpg';
import medievalBackdrop from '../assets/images/world_medieval_castle_1795582866482.jpg';
import postapocBackdrop from '../assets/images/world_postapoc_ruins_1795582866464.jpg';

export interface WorldConfig {
  id: WorldId;
  name: string;
  shortName: string;
  arenaName: string;
  subtitle: string;
  description: string;
  backdropSrc: string;
  defaultWeather: Exclude<WeatherCondition, 'auto'>;
  accentColor: string;
  badgeClass: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  fogColor: string;
  groundTop: string;
  groundBottom: string;
  surfaceAccent: string;
  reflectionTint: string;
  sunbeamColor: string;
}

export const WORLD_CONFIGS: Record<WorldId, WorldConfig> = {
  scifi: {
    id: 'scifi',
    name: 'Sci-Fi World',
    shortName: 'Sci-Fi Jungle',
    arenaName: 'Nexus Biolume Basin',
    subtitle: 'Alien Jungle & Crashed Starship',
    description:
      'Photorealistic alien jungle alive with bioluminescent flora, a massive crashed starship wreck, volumetric mist, and ray-traced river reflections.',
    backdropSrc: scifiBackdrop,
    defaultWeather: 'spores',
    accentColor: '#06b6d4',
    badgeClass: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30',
    skyTop: '#030b14',
    skyMid: '#072230',
    skyBottom: '#0c3b47',
    fogColor: 'rgba(14, 165, 233, 0.16)',
    groundTop: '#0d3b3e',
    groundBottom: '#041216',
    surfaceAccent: '#22d3ee',
    reflectionTint: 'rgba(6, 182, 212, 0.24)',
    sunbeamColor: 'rgba(56, 189, 248, 0.12)',
  },
  medieval: {
    id: 'medieval',
    name: 'Medieval Fantasy World',
    shortName: 'Medieval Citadel',
    arenaName: 'Frostpeak Keep',
    subtitle: 'Snowy Mountain Castle & Storm Clouds',
    description:
      'Ancient stone fortress carved into snowy peaks beneath thunderous storm clouds, flickering torchlight on wet cobblestones, and rolling volumetric fog.',
    backdropSrc: medievalBackdrop,
    defaultWeather: 'storm',
    accentColor: '#f59e0b',
    badgeClass: 'text-amber-300 border-amber-500/40 bg-amber-950/30',
    skyTop: '#070b14',
    skyMid: '#182132',
    skyBottom: '#2d3748',
    fogColor: 'rgba(148, 163, 184, 0.18)',
    groundTop: '#334155',
    groundBottom: '#0f172a',
    surfaceAccent: '#f59e0b',
    reflectionTint: 'rgba(245, 158, 11, 0.22)',
    sunbeamColor: 'rgba(226, 232, 240, 0.10)',
  },
  postapoc: {
    id: 'postapoc',
    name: 'Post-Apocalyptic World',
    shortName: 'Overgrown Ruins',
    arenaName: 'Sunbeam Overpass',
    subtitle: 'Overgrown City Ruins at Sunset',
    description:
      'Sun-drenched overgrown skyscraper ruins, rusted vehicles draped in thick ivy, dusty golden sunbeams, and sharp ray-traced shadows.',
    backdropSrc: postapocBackdrop,
    defaultWeather: 'fog',
    accentColor: '#f97316',
    badgeClass: 'text-orange-300 border-orange-500/40 bg-orange-950/30',
    skyTop: '#1a0e0a',
    skyMid: '#5c2814',
    skyBottom: '#b45309',
    fogColor: 'rgba(251, 146, 60, 0.16)',
    groundTop: '#3f3f46',
    groundBottom: '#18181b',
    surfaceAccent: '#4ade80',
    reflectionTint: 'rgba(251, 146, 60, 0.22)',
    sunbeamColor: 'rgba(253, 186, 116, 0.16)',
  },
};

export const WORLD_LIST: WorldConfig[] = [
  WORLD_CONFIGS.scifi,
  WORLD_CONFIGS.medieval,
  WORLD_CONFIGS.postapoc,
];

export const WEATHER_OPTIONS: {
  id: WeatherCondition;
  label: string;
  summary: string;
  isExtreme?: boolean;
}[] = [
  { id: 'auto', label: 'World Default', summary: 'Matches each world automatically' },
  { id: 'clear', label: 'Clear Sky', summary: 'Crisp lighting and subtle dust motes' },
  { id: 'rain', label: 'Heavy Rain', summary: 'Rainfall streaks with wet surface ripples' },
  { id: 'storm', label: 'Thunderstorm', summary: 'Gale rain, dark clouds, lightning bolts' },
  { id: 'fog', label: 'Volumetric Fog', summary: 'Dense drifting mist and light shafts' },
  { id: 'blizzard', label: 'Snow Blizzard', summary: 'Swirling snowfall and frost haze' },
  { id: 'spores', label: 'Biolume Spores', summary: 'Glowing floating spores and mist' },
  {
    id: 'acid_rain',
    label: 'Acid Rain',
    summary: '-1.5 Shield/s corrosion · +12% DMG & +8% Crit',
    isExtreme: true,
  },
  {
    id: 'solar_flare',
    label: 'Solar Flare',
    summary: '+18% Weapon DMG · +25% Stamina Drain',
    isExtreme: true,
  },
  {
    id: 'void_storm',
    label: 'Void Storm',
    summary: '+15% Move/Dash Speed · Void Lightning',
    isExtreme: true,
  },
];

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  world: 'scifi',
  weather: 'auto',
  graphicsQuality: 'high',
  volumetricLighting: true,
  rayTracedReflections: true,
  particlesEnabled: true,
  soundEnabled: true,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  musicVolume: 0.65,
  touchControlsMode: 'always',
  controlOpacity: 0.88,
  controlScale: 1,
};

export function resolveEffectiveWeather(
  world: WorldId,
  weather: WeatherCondition
): Exclude<WeatherCondition, 'auto'> {
  if (weather === 'auto') {
    return WORLD_CONFIGS[world].defaultWeather;
  }
  return weather;
}
