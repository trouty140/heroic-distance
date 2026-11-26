import React, { useState, useEffect } from 'react';
import { Heart, Crown, ArrowRight, RefreshCw } from 'lucide-react';
import type { GameStats } from '../types';
import { playUiClick } from '../utils/audio';

interface OutroCinematicProps {
  stats: GameStats;
  onRestart: () => void;
}

export default function OutroCinematic({ stats, onRestart }: OutroCinematicProps) {
  const [step, setStep] = useState(0); 
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; scale: number; speedY: number; rx: number }[]>([]);

  // Periodically generate floating romantic hearts once the kiss begins (step === 3)
  useEffect(() => {
    if (step !== 3) return;

    // Initial batch of hearts
    const initialHearts = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: 35 + Math.random() * 30, // center around 50%
      y: 40 + Math.random() * 20,
      scale: 0.5 + Math.random() * 1.5,
      speedY: -(0.5 + Math.random() * 1.5),
      rx: -15 + Math.random() * 30
    }));
    setHearts(initialHearts);

    const interval = setInterval(() => {
      setHearts((prev) => [
        ...prev.map(h => ({
          ...h,
          y: h.y + h.speedY,
          rx: h.rx + Math.sin(Date.now() / 300) * 0.5
        })).filter(h => h.y > -10),
        {
          id: Date.now(),
          x: 45 + Math.random() * 10,
          y: 60,
          scale: 0.5 + Math.random() * 1.2,
          speedY: -(0.8 + Math.random() * 1.2),
          rx: -10 + Math.random() * 20
        }
      ].slice(-80)); // caps limit
    }, 100);

    return () => clearInterval(interval);
  }, [step]);

  const dialogs = [
    {
      title: "The Tyrant Crumbles",
      narration: "With a final, devastating parry and horizontal slash, you shatter the Soul Core of the Dark Overlord. His majestic, fire-breathing body turns into pillars of cooling stone and burning ash. The dark citadel walls begin to crack, revealing bright light.",
      visual: "🌋"
    },
    {
      title: "Breaking the Chains",
      narration: "Aureole keys in hand, you rush to the obsidian prison cage. Your blade shines bright with holy power. With one sweeping blow, you smash the runic locks. The gates swing open, and princess Roselyn steps down, weeping in disbelief.",
      visual: "🔓"
    },
    {
      title: "Reuniting of Souls",
      narration: "You exchange breathless words. 'I've traversed mountains, caverns, and deep fire fields for you,' you whisper. Roselyn holds your hands tightly: 'I knew you would come. The legends spoke of your endless stride.'",
      visual: "🌹"
    },
    {
      title: "The Hero's Seal - True Love's Kiss",
      narration: "Drawing closer together under the clearing azure sky, you embrace. All trials, parries, and battle scars fade into eternity as you share a passionate, heroic kiss, blooming with pure life heart particles! You saved the realm, and her.",
      visual: "💋"
    },
    {
      title: "Saga Concluded: Eternal Legend",
      narration: "Your heroic voyage has ended. The bards will sing tales of the warrior who traveled over 2,000 meters of dread and flame to bring peace back to the kingdoms.",
      visual: "👑"
    }
  ];

  const handleNextStep = () => {
    playUiClick();
    if (step < dialogs.length - 1) {
      setStep(step + 1);
    }
  };

  const currentDialogue = dialogs[step];

  return (
    <div className="absolute inset-0 z-50 bg-black/98 flex flex-col justify-between p-6 md:p-12 text-white font-sans overflow-hidden">
      
      {/* Cinematic Top and Bottom Letterbox black bars */}
      <div className="absolute top-0 inset-x-0 h-16 bg-zinc-950/90 border-b border-zinc-900 z-10 flex items-center justify-between px-6">
        <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase font-semibold">
          Act IV: The Conquest of Hearts
        </span>
        <div className="flex gap-1">
          {dialogs.map((_, i) => (
            <div 
              key={i} 
              className={`w-3 h-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-amber-500' : 'bg-zinc-800'
              }`} 
            />
          ))}
        </div>
      </div>

      {/* Main Interactive Stage Box */}
      <div className="flex-grow flex items-center justify-center my-auto py-12 relative w-full max-w-4xl mx-auto">
        
        {/* STEP 3 SPECIFIC: KISS SCENE ANIMATION VIEW */}
        {step === 3 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden select-none">
            {/* Heart emitter particles exploding behind the dancers */}
            {hearts.map((h) => (
              <div
                key={h.id}
                className="absolute text-red-500 pointer-events-none transition-all duration-75 select-none text-2xl animate-fade-in"
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  transform: `scale(${h.scale}) translateX(${h.rx}px)`,
                  opacity: Math.max(0, 1 - (60 - h.y) / 40),
                }}
              >
                ❤️
              </div>
            ))}

            {/* Simulated Romantic Silhouette Clashing with high detail */}
            <div className="flex items-end gap-1 relative z-20 scale-125">
              {/* Male Hero Custom Avatar Element */}
              <div className="flex flex-col items-center">
                <div className="text-4xl">🤵‍♂️🗡️</div>
                <div className="w-10 h-1.5 bg-blue-500/20 rounded-full mt-1" />
              </div>

              {/* Heart floating core between them */}
              <div className="text-5xl text-red-500 relative -top-6">
                💖
              </div>

              {/* Princess Custom Avatar Element */}
              <div className="flex flex-col items-center">
                <div className="text-4xl">👸👑</div>
                <div className="w-15 h-1.5 bg-pink-500/20 rounded-full mt-1" />
              </div>
            </div>

            {/* Triumphant flash container under screen */}
            <div className="absolute bottom-4 text-center">
              <span className="text-xs uppercase font-mono tracking-widest text-amber-400 font-bold bg-amber-950/40 px-3 py-1 border border-amber-900 rounded-full">
                UNLIMITED LOVE UNFOLDING
              </span>
            </div>
          </div>
        )}

        {/* STEP 4 SPECIFIC: STATS BOARD ENDPAGE */}
        {step === 4 && (
          <div className="w-full max-w-xl tac-gunmetal tac-glass border border-amber-500/40 p-6 md:p-8 rounded-2xl shadow-2xl relative z-10 flex flex-col items-center text-center animate-fade-in">
            <div className="w-16 h-16 bg-amber-950/40 border border-amber-500/60 rounded-full flex items-center justify-center text-3xl mb-4 text-amber-400">
              <Crown className="w-8 h-8 stroke-[1.5]" />
            </div>

            <h2 className="font-display text-2xl font-black tracking-wider text-white uppercase">
              Campaign Complete!
            </h2>
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mt-1">
              Stats of your Heroic Triumph
            </p>

            {/* Achievement cards layout */}
            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              <div className="tac-panel p-4 border border-zinc-700/80 rounded-xl text-center">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Run Track</span>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-1">2,000 meters</p>
              </div>
              <div className="tac-panel p-4 border border-zinc-700/80 rounded-xl text-center">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Enemies Smashed</span>
                <p className="text-lg font-bold font-mono text-rose-400 mt-1">{stats.enemiesDefeated} Foes</p>
              </div>
              <div className="tac-panel p-4 border border-zinc-700/80 rounded-xl text-center">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Looted Treasury</span>
                <p className="text-lg font-bold font-mono text-amber-400 mt-1">{stats.goldCollected} Gold</p>
              </div>
              <div className="tac-panel p-4 border border-zinc-700/80 rounded-xl text-center">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Campaign Multiplier</span>
                <p className="text-lg font-bold font-mono text-cyan-400 mt-1">100% Love</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mt-6 leading-relaxed">
              Upon your return, your sword damage, shields level, and dash capabilities can be permanently reinforced for harder procedurally generated odyssey iterations.
            </p>

            <button
              onClick={() => {
                playUiClick();
                onRestart();
              }}
              className="tac-bevel-btn mt-8 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-display font-bold rounded-xl hover:from-emerald-500 hover:to-teal-400 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer uppercase text-xs tracking-wider"
            >
              <RefreshCw className="w-4 h-4" /> Start Next Generation Run
            </button>
          </div>
        )}

        {/* DEFAULT NARRATION (STEPS 0, 1, 2) */}
        {step < 4 && (
          <div className="flex flex-col items-center text-center relative z-10 max-w-2xl select-none">
            {step !== 3 && (
              <div className="w-20 h-20 tac-panel border border-zinc-700/80 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-2xl filter drop-shadow">
                {currentDialogue.visual}
              </div>
            )}

            {step !== 3 && (
              <>
                <h2 className="font-display text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500 tracking-wide uppercase">
                  {currentDialogue.title}
                </h2>
                <p className="text-sm md:text-base text-zinc-300 leading-relaxed mt-4 max-w-xl">
                  {currentDialogue.narration}
                </p>
              </>
            )}

            {step === 3 && (
              <div className="tac-panel border border-pink-500/40 px-6 py-4 rounded-xl max-w-md mt-[16rem]">
                <h2 className="font-display text-lg font-semibold text-pink-400 flex items-center justify-center gap-1">
                  <Heart className="w-4 h-4 fill-pink-500" /> True Love's Kiss
                </h2>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Both lovers lock in a beautiful warm embrace. Floating heart particles fill the sky. The age of darkness is shattered!
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Cinematic bottom dialog control panel */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-zinc-950/90 border-t border-zinc-900 z-10 flex items-center justify-between px-6 md:px-12">
        <span className="text-[10px] font-mono text-zinc-500 uppercase hidden md:block">
          Press "Continue Journey" to progress the cutscene
        </span>

        {step < 4 ? (
          <button
            onClick={handleNextStep}
            className="tac-bevel-btn w-full md:w-auto px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-display font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ml-auto"
          >
            <span>Continue Voyage</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-[10px] font-mono text-zinc-600 uppercase ml-auto">
            Storybook complete · Saved to Local Storage
          </span>
        )}
      </div>

    </div>
  );
}
