import React, { useState } from 'react';
import { Flame } from 'lucide-react';
import type { UpgradeItem, UpgradeId } from '../types';
import { playUiClick } from '../utils/audio';

interface UpgradeScreenProps {
  onUpgradeSelect: (upgradeId: UpgradeId) => void;
  gold: number;
}

export default function UpgradeScreen({ onUpgradeSelect, gold }: UpgradeScreenProps) {
  const [letsGoActive, setLetsGoActive] = useState(false);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [letsGoQuote, setLetsGoQuote] = useState('LET\'S GO!');

  const upgradePool: UpgradeItem[] = [
    {
      id: 'steel_skin',
      name: 'Steel-Skin Greaves',
      description: 'Increases Maximum Health permanently by +40 and immediately restores full health.',
      rarity: 'COMMON',
      cost: 15,
      icon: '🛡️'
    },
    {
      id: 'vampire_fangs',
      name: 'Vampiric Brand',
      description: 'Forges a life-steal bond on your sword. Every physical slash restores 10% of dealt damage.',
      rarity: 'RARE',
      cost: 30,
      icon: '🦇'
    },
    {
      id: 'thunder_dash',
      name: 'Cyclone Dash',
      description: 'Reduces Dash cooldown by 40% and deals small shockwave damage to nearby targets.',
      rarity: 'COMMON',
      cost: 20,
      icon: '⚡'
    },
    {
      id: 'dragon_breath',
      name: 'Dragonic Edge',
      description: 'Increases Sword Attack Damage by +8. Your heavy attacks emit small pyro bursts.',
      rarity: 'LEGENDARY',
      cost: 45,
      icon: '🔥'
    },
    {
      id: 'berserker',
      name: 'Berserker Crest',
      description: 'Gain +12 Attack Power, but reduces maximum health limit by 15 points. Ultimate glass-cannon.',
      rarity: 'RARE',
      cost: 25,
      icon: '💀'
    },
    {
      id: 'shield_battery',
      name: 'Aureole Battery',
      description: 'Regenerates +1 Shield armor point every second. Reduces block stamina cost.',
      rarity: 'RARE',
      cost: 35,
      icon: '🔋'
    },
    {
      id: 'eagle_eye',
      name: 'Elysian Gaze',
      description: 'Increases Critical Hit rate by +25% and expands parry perfect timing window.',
      rarity: 'COMMON',
      cost: 15,
      icon: '👁️'
    },
    {
      id: 'adrenaline_rush',
      name: 'Eternal Stamina',
      description: 'Unlocks an additional Air Double Jump and boosts run movement speed by 15%.',
      rarity: 'LEGENDARY',
      cost: 50,
      icon: '🌌'
    }
  ];

  // Helper to choose 3 random upgrades
  const [randomThree] = useState<UpgradeItem[]>(() => {
    // Shuffled pool
    const shuffled = [...upgradePool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  });

  const quotes = [
    "LET'S GO! NO RETREAT!",
    "LET'S GO! THE ODYSSEY CONTINUES!",
    "LET'S GO! THE DEMONS TREMBLE!",
    "LET'S GO! VICTORY AWAITS!",
    "LET'S GO! SHE IS WAITING FOR ME!"
  ];

  const handleSelection = (item: UpgradeItem) => {
    if (gold < item.cost) return; // Cant afford
    playUiClick();

    setSelectedItemName(item.name);
    // Pick random roaring quote
    const randQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setLetsGoQuote(randQuote);
    setLetsGoActive(true);

    // After animation closes, triggers callback
    setTimeout(() => {
      onUpgradeSelect(item.id);
      setLetsGoActive(false);
    }, 1800);
  };

  const getRarityStyle = (rarity: 'COMMON' | 'RARE' | 'LEGENDARY') => {
    switch (rarity) {
      case 'LEGENDARY':
        return {
          bg: 'bg-amber-950/40 border-amber-800 ring-2 ring-amber-500/20',
          text: 'text-amber-400 font-bold',
          badge: 'bg-amber-500 text-amber-950',
          particle: 'text-amber-500'
        };
      case 'RARE':
        return {
          bg: 'bg-purple-950/40 border-purple-800 ring-1 ring-purple-550/10',
          text: 'text-purple-400 font-bold',
          badge: 'bg-purple-600 text-white',
          particle: 'text-purple-500'
        };
      default:
        return {
          bg: 'bg-zinc-900/50 border-zinc-800',
          text: 'text-zinc-300 font-medium',
          badge: 'bg-zinc-700 text-zinc-100',
          particle: 'text-zinc-500'
        };
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 font-sans">
      {/* Cinematic Roaring Overlay "LET'S GO!" */}
      {letsGoActive && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="relative transform scale-110 md:scale-120">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 opacity-65 blur-xl" />
            <div className="relative tac-gunmetal border-2 border-amber-400/60 px-10 py-6 rounded-2xl shadow-2xl flex flex-col items-center">
              <span className="font-display text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-orange-400 select-none antialiased max-w-lg leading-none filter drop-shadow">
                {letsGoQuote}
              </span>
              <p className="mt-4 text-xs font-mono tracking-widest text-zinc-400 uppercase">
                Acquired: <strong className="text-white">{selectedItemName}</strong>
              </p>
              <div className="flex gap-1.5 mt-3">
                <Flame className="w-5 h-5 text-red-500" />
                <Flame className="w-5 h-5 text-orange-400" />
                <Flame className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Upgrades Panel Box */}
      <div className="w-full max-w-4xl tac-gunmetal tac-glass border border-amber-500/35 p-6 md:p-10 rounded-2xl shadow-2xl flex flex-col gap-8 relative overflow-hidden">
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />
        {/* Subtle glowing lines */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />

        {/* Header */}
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.22em] text-amber-400">
              Milestone Complete
            </h2>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-white tracking-wider uppercase mt-0.5">
              Acquiring Roguelike Perks
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Select one elite upgrade. These modifications persist until the final combat challenge.
            </p>
          </div>

          <div className="tac-panel flex flex-col items-center md:items-end border border-zinc-700/80 px-5 py-3 rounded-xl min-w-[150px]">
            <span className="text-[10px] uppercase font-mono text-zinc-400 tracking-wider">
              Your Treasury
            </span>
            <span className="text-xl font-bold font-mono text-amber-400 tracking-wide flex items-center gap-1.5 mt-0.5 tabular-nums">
              {gold} <span className="text-xs text-amber-500 font-normal">GOLD COINS</span>
            </span>
          </div>
        </div>

        {/* Upgrade Selection Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {randomThree.map((item) => {
            const style = getRarityStyle(item.rarity);
            const canAfford = gold >= item.cost;

            return (
              <div
                key={item.id}
                className={`tac-panel flex flex-col rounded-xl border p-5 relative transition-all duration-300 bg-gradient-to-b ${style.bg} ${
                  canAfford
                    ? 'hover:scale-[1.03] hover:shadow-xl'
                    : 'opacity-65 grayscale-[30%]'
                }`}
              >
                {/* Rarity Tag */}
                <div className="flex justify-between items-start gap-2 mb-4">
                  <div className="text-3xl filter drop-shadow">{item.icon}</div>
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded ${style.badge}`}>
                    {item.rarity}
                  </span>
                </div>

                {/* Info */}
                <h3 className="font-display font-bold text-lg text-white tracking-wide leading-tight mb-1">
                  {item.name}
                </h3>
                <p className="text-xs text-zinc-400 flex-grow leading-relaxed mb-6">
                  {item.description}
                </p>

                {/* Cost/Purchase Button */}
                <button
                  disabled={!canAfford}
                  onClick={() => handleSelection(item)}
                  className={`tac-bevel-btn w-full py-3 px-4 font-display font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    canAfford
                      ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <span>Purchase with</span>
                  <span className="font-mono font-bold text-sm flex items-center gap-0.5">
                    {item.cost}
                  </span>
                  <span>gold</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer/Help Info */}
        <div className="text-center">
          <p className="text-xs text-zinc-500">
            Gold is gathered from vanquished grunts, treasure chests, and secrets along the trail.
          </p>
        </div>

      </div>
    </div>
  );
}
