// Web Audio API Procedural Synth + Background Music Controller with Master / SFX / Music Gain Control
let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let masterVolume = 0.85;
let sfxVolume = 0.9;
let musicVolume = 0.65;

let bgmAudio: HTMLAudioElement | null = null;
let bgmWanted = false;
let bossAudioActive = false;
let synthPulseInterval: number | null = null;
let bossBassInterval: number | null = null;
let synthStep = 0;
let bossStep = 0;

function getSfxGain(): number {
  if (!soundEnabled) return 0;
  return Math.max(0, Math.min(1, masterVolume * sfxVolume));
}

function getMusicGain(): number {
  if (!soundEnabled) return 0;
  return Math.max(0, Math.min(1, masterVolume * musicVolume));
}

function ensureBgmAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!bgmAudio) {
    bgmAudio = new Audio('/assets/aistudio/geo_e4589e09.mp3');
    bgmAudio.loop = true;
    bgmAudio.volume = getMusicGain() * (bossAudioActive ? 0.24 : 0.55);
    bgmAudio.preload = 'auto';
  }
  return bgmAudio;
}

function startBossDeepBassSynth() {
  if (typeof window === 'undefined' || bossBassInterval !== null) return;
  const bossNotes = [36.71, 36.71, 38.89, 32.7, 36.71, 41.2, 34.65, 30.87];
  bossBassInterval = window.setInterval(() => {
    const gainLvl = getMusicGain();
    if (!bossAudioActive || !bgmWanted || gainLvl <= 0.01) return;
    try {
      const ctx = getAudioContext();
      const note = bossNotes[bossStep % bossNotes.length];
      const subOsc = ctx.createOscillator();
      const growlOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(note, ctx.currentTime);

      growlOsc.type = 'sawtooth';
      growlOsc.frequency.setValueAtTime(note * 2, ctx.currentTime);
      growlOsc.frequency.exponentialRampToValueAtTime(note * 1.92, ctx.currentTime + 0.36);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(bossStep % 4 === 0 ? 290 : 185, ctx.currentTime);
      filter.Q.setValueAtTime(4.5, ctx.currentTime);

      const peak = (bossStep % 2 === 0 ? 0.24 : 0.16) * gainLvl;
      g.gain.setValueAtTime(peak, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.004, ctx.currentTime + 0.38);

      subOsc.connect(filter);
      growlOsc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);

      subOsc.start();
      growlOsc.start();
      subOsc.stop(ctx.currentTime + 0.39);
      growlOsc.stop(ctx.currentTime + 0.39);
      bossStep++;
    } catch {
      // ignore suspended audio context before interaction
    }
  }, 400);
}

export function setBossAtmosphereAudio(active: boolean) {
  bossAudioActive = active;
  if (active) {
    startBossDeepBassSynth();
  }
  if (bgmAudio) {
    bgmAudio.volume = getMusicGain() * (bossAudioActive ? 0.22 : 0.55);
  }
}

function startSynthBassPulse() {
  if (typeof window === 'undefined' || synthPulseInterval !== null) return;
  // Subtle dynamic Web Audio ambient synth pulse when music volume > 0
  const notes = [55, 55, 65.41, 73.42, 55, 82.41, 65.41, 49];
  synthPulseInterval = window.setInterval(() => {
    const gainLvl = getMusicGain();
    if (!bgmWanted || bossAudioActive || gainLvl <= 0.01) return;
    // Only play Web Audio synth accompaniment if HTMLAudio isn't actively outputting or as subtle sub-layer
    if (bgmAudio && !bgmAudio.paused) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(notes[synthStep % notes.length], ctx.currentTime);
      synthStep++;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, ctx.currentTime);
      g.gain.setValueAtTime(0.05 * gainLvl, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime + 0.34);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore suspended audio context before interaction
    }
  }, 380);
}

export function startBackgroundMusic() {
  bgmWanted = true;
  startSynthBassPulse();
  if (bossAudioActive) startBossDeepBassSynth();
  if (!soundEnabled) return;
  const audio = ensureBgmAudio();
  if (!audio) return;
  audio.muted = false;
  audio.volume = getMusicGain() * (bossAudioActive ? 0.22 : 0.55);
  if (audio.paused) {
    audio.play().catch(() => {
      // Autoplay will resume on next user gesture
    });
  }
}

export function pauseBackgroundMusic() {
  bgmWanted = false;
  bossAudioActive = false;
  if (bgmAudio && !bgmAudio.paused) {
    bgmAudio.pause();
  }
}

export function setAudioSettings(opts: {
  soundEnabled: boolean;
  masterVolume?: number;
  sfxVolume?: number;
  musicVolume?: number;
}) {
  soundEnabled = opts.soundEnabled;
  if (typeof opts.masterVolume === 'number') masterVolume = opts.masterVolume;
  if (typeof opts.sfxVolume === 'number') sfxVolume = opts.sfxVolume;
  if (typeof opts.musicVolume === 'number') musicVolume = opts.musicVolume;

  if (bgmAudio) {
    bgmAudio.muted = !soundEnabled;
    bgmAudio.volume = getMusicGain() * (bossAudioActive ? 0.22 : 0.55);
    if (!soundEnabled) {
      bgmAudio.pause();
    } else if (bgmWanted && bgmAudio.paused) {
      bgmAudio.play().catch(() => {});
    }
  } else if (soundEnabled && bgmWanted) {
    startBackgroundMusic();
  }
}

export function setAudioEnabled(enabled: boolean) {
  setAudioSettings({ soundEnabled: enabled });
}

export function isAudioEnabled(): boolean {
  return soundEnabled;
}

function getAudioContext(): AudioContext {
  if (!soundEnabled) {
    throw new Error('Audio muted');
  }
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playUiClick() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.11 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.055);
  } catch {}
}

export function playGunfire() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();

    // Plasma punch + transient snap
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(95, ctx.currentTime + 0.11);
    g.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.12);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function playJump() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15 * vol, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function playSlash() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const ring = ctx.createOscillator();
    const gain = ctx.createGain();
    const ringGain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.14);

    ring.type = 'triangle';
    ring.frequency.setValueAtTime(1850, ctx.currentTime);
    ring.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.11);

    ringGain.gain.setValueAtTime(0.11 * vol, ctx.currentTime);
    ringGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);

    osc.start();
    ring.start();
    osc.stop(ctx.currentTime + 0.14);
    ring.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function playHurt() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(68, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.24 * vol, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function playParry() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2200, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1400, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.28 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function playDash() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function playCoin() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime);
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.14 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

export function playExplosion() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.48;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.36 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.48);

    // Sub-bass boom
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.42);
    subGain.gain.setValueAtTime(0.32 * vol, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.42);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    sub.connect(subGain);
    subGain.connect(ctx.destination);

    noise.start();
    sub.start();
    noise.stop(ctx.currentTime + 0.48);
    sub.stop(ctx.currentTime + 0.44);
  } catch {}
}

export function playPowerUp() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(960, ctx.currentTime + 0.38);

    gain.gain.setValueAtTime(0.16 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export function playAegisShield() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(220, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.25);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function playOrbitalStrike() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const sub = ctx.createOscillator();
    const beam = ctx.createOscillator();
    const gain = ctx.createGain();

    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.65);

    beam.type = 'square';
    beam.frequency.setValueAtTime(1200, ctx.currentTime);
    beam.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.55);

    gain.gain.setValueAtTime(0.28 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.65);

    sub.connect(gain);
    beam.connect(gain);
    gain.connect(ctx.destination);
    sub.start();
    beam.start();
    sub.stop(ctx.currentTime + 0.65);
    beam.stop(ctx.currentTime + 0.65);
  } catch {}
}

export function playBossRoar() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(48, ctx.currentTime + 0.52);

    gain.gain.setValueAtTime(0.26 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {}
}

export function playHypercarEnter() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.28);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(520, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.34);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + 0.34);
    osc2.stop(ctx.currentTime + 0.22);
  } catch {}
}

export function playNitroBoost() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {}
}

export function playMinigun() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(680 + Math.random() * 110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

export function playMissileLaunch() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function playNpcInteract() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.14 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

export function playThunderCrack() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const bufferSize = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.22));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.55);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.58);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 0.6);
  } catch {}
}

export function playEmpHit() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1450, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(95, ctx.currentTime + 0.34);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(840, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(52, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.24 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.006, ctx.currentTime + 0.36);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.36);
    osc2.stop(ctx.currentTime + 0.36);
  } catch {}
}

export function playTripwireAlarm() {
  try {
    const vol = getSfxGain();
    if (vol <= 0) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.frequency.setValueAtTime(620, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(1120, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.16 * vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}


