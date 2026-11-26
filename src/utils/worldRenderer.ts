import type {
  GameSettings,
  TerrainSegment,
  DecorItem,
  WorldId,
  WeatherCondition,
  OperatorId,
  WeaponId,
} from '../types';
import { WORLD_CONFIGS, resolveEffectiveWeather } from '../config/worlds';

export interface CharacterRenderData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  facing: 'left' | 'right';
  characterClass: 'vanguard' | 'shadowblade' | 'spellweaver';
  operatorId?: OperatorId;
  weaponId?: WeaponId;
  hasDrone?: boolean;
  actionState: 'IDLE' | 'RUNNING' | 'JUMPING' | 'ATTACKING' | 'DASHING' | 'PARRYING' | 'HIT' | 'DEAD';
  stateTimer: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  label?: string;
  isLocal?: boolean;
}

export function renderWorldBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  frameCount: number,
  settings: GameSettings,
  backdropImg: HTMLImageElement | null
) {
  const world = WORLD_CONFIGS[settings.world];
  const isUltra = settings.graphicsQuality === 'ultra';
  const isHigh = settings.graphicsQuality === 'high' || isUltra;

  // Base gradient fallback / sky tone
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, world.skyTop);
  skyGrad.addColorStop(0.55, world.skyMid);
  skyGrad.addColorStop(1, world.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Photorealistic generated UE5 world backdrop with seamless mirrored parallax tiling
  if (backdropImg && backdropImg.complete && backdropImg.naturalWidth > 0) {
    const scale = Math.max(width / backdropImg.naturalWidth, height / backdropImg.naturalHeight);
    const drawW = backdropImg.naturalWidth * scale;
    const drawH = backdropImg.naturalHeight * scale;
    const parallaxOffset = ((cameraX * 0.14) % (drawW * 2) + drawW * 2) % (drawW * 2);

    ctx.save();
    ctx.globalAlpha = isHigh ? 0.92 : 0.78;

    // Draw mirrored tiles so transitions are completely seamless
    const startX = -parallaxOffset;
    for (let tile = -1; tile <= 2; tile++) {
      const tx = startX + tile * drawW;
      if (tx + drawW < -50 || tx > width + 50) continue;
      ctx.save();
      const mirrored = Math.abs(tile) % 2 === 1;
      if (mirrored) {
        ctx.translate(tx + drawW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(backdropImg, 0, (height - drawH) * 0.4, drawW, drawH);
      } else {
        ctx.drawImage(backdropImg, tx, (height - drawH) * 0.4, drawW, drawH);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Atmospheric depth scrim for crisp foreground legibility
  const depthScrim = ctx.createLinearGradient(0, 0, 0, height);
  depthScrim.addColorStop(0, 'rgba(2, 6, 15, 0.28)');
  depthScrim.addColorStop(0.55, 'rgba(2, 6, 15, 0.12)');
  depthScrim.addColorStop(1, 'rgba(2, 6, 15, 0.58)');
  ctx.fillStyle = depthScrim;
  ctx.fillRect(0, 0, width, height);

  // Volumetric lighting & world-specific atmospheric shafts
  if (settings.volumetricLighting && isHigh) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (settings.world === 'postapoc') {
      // Dusty golden sunbeams piercing through broken skyscrapers
      for (let b = 0; b < 5; b++) {
        const bx = 140 + b * 240 - ((cameraX * 0.06) % 240);
        const beamGrad = ctx.createLinearGradient(bx, 0, bx + 180, height * 0.85);
        beamGrad.addColorStop(0, 'rgba(253, 186, 116, 0.17)');
        beamGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.07)');
        beamGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 90, 0);
        ctx.lineTo(bx + 290, height * 0.88);
        ctx.lineTo(bx + 120, height * 0.88);
        ctx.closePath();
        ctx.fill();
      }
    } else if (settings.world === 'scifi') {
      // Bioluminescent canopy light shafts & crashed starship beacon glow
      for (let b = 0; b < 4; b++) {
        const bx = 180 + b * 310 - ((cameraX * 0.05) % 310);
        const beamGrad = ctx.createLinearGradient(bx, 0, bx + 120, height * 0.85);
        beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.12)');
        beamGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.07)');
        beamGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 70, 0);
        ctx.lineTo(bx + 210, height * 0.86);
        ctx.lineTo(bx + 80, height * 0.86);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Medieval global illumination storm shafts & distant keep glow
      for (let b = 0; b < 3; b++) {
        const bx = 220 + b * 360 - ((cameraX * 0.05) % 360);
        const beamGrad = ctx.createLinearGradient(bx, 0, bx + 140, height * 0.85);
        beamGrad.addColorStop(0, 'rgba(226, 232, 240, 0.11)');
        beamGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 95, 0);
        ctx.lineTo(bx + 240, height * 0.85);
        ctx.lineTo(bx + 90, height * 0.85);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Subtle volumetric ground mist band
    if (isUltra) {
      const mistOffset = Math.sin(frameCount * 0.015) * 35;
      const mistGrad = ctx.createLinearGradient(0, 390, 0, 520);
      mistGrad.addColorStop(0, 'rgba(0,0,0,0)');
      mistGrad.addColorStop(0.5, world.fogColor);
      mistGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, 390 + mistOffset * 0.15, width, 130);
    }

    ctx.restore();
  }
}

export function renderEnhancedTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainSegment[],
  cameraX: number,
  frameCount: number,
  settings: GameSettings
) {
  const worldId = settings.world;
  const isHigh = settings.graphicsQuality !== 'low';
  const isUltra = settings.graphicsQuality === 'ultra';

  terrain.forEach((seg) => {
    const sx = seg.x - cameraX;
    if (sx + seg.width < -120 || sx > 1320) return;

    if (seg.type === 'GROUND') {
      // World-specific PBR ground materials
      const bodyGrad = ctx.createLinearGradient(sx, seg.y, sx, seg.y + seg.height);
      if (worldId === 'scifi') {
        bodyGrad.addColorStop(0, '#07242b');
        bodyGrad.addColorStop(0.35, '#05151a');
        bodyGrad.addColorStop(1, '#02080a');
      } else if (worldId === 'medieval') {
        bodyGrad.addColorStop(0, '#1e293b');
        bodyGrad.addColorStop(0.4, '#0f172a');
        bodyGrad.addColorStop(1, '#020617');
      } else {
        bodyGrad.addColorStop(0, '#292524');
        bodyGrad.addColorStop(0.4, '#1c1917');
        bodyGrad.addColorStop(1, '#09090b');
      }
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(sx, seg.y, seg.width, seg.height);

      // Top walkable PBR surface trim
      if (worldId === 'scifi') {
        // Wet alien moss & glowing shallow river sheen
        const topGrad = ctx.createLinearGradient(sx, seg.y, sx, seg.y + 16);
        topGrad.addColorStop(0, '#14b8a6');
        topGrad.addColorStop(0.45, '#0f766e');
        topGrad.addColorStop(1, '#042f2e');
        ctx.fillStyle = topGrad;
        ctx.fillRect(sx, seg.y, seg.width, 14);

        if (isHigh) {
          // Bioluminescent flora nodes along jungle edge
          for (let g = 18; g < seg.width - 12; g += 48) {
            const pulse = 0.65 + Math.sin(frameCount * 0.07 + g) * 0.35;
            ctx.fillStyle = g % 96 === 18 ? `rgba(34, 211, 238, ${pulse})` : `rgba(192, 132, 252, ${pulse})`;
            ctx.beginPath();
            ctx.arc(sx + g, seg.y - 3, 3.5, 0, Math.PI * 2);
            ctx.fill();
            if (isUltra) {
              const halo = ctx.createRadialGradient(sx + g, seg.y - 3, 1, sx + g, seg.y - 3, 18);
              halo.addColorStop(0, g % 96 === 18 ? 'rgba(34, 211, 238, 0.35)' : 'rgba(192, 132, 252, 0.35)');
              halo.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = halo;
              ctx.beginPath();
              ctx.arc(sx + g, seg.y - 3, 18, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else if (worldId === 'medieval') {
        // Wet cobblestone blocks + snow patches + flickering torch pools
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx, seg.y, seg.width, 16);
        for (let c = 0; c < seg.width; c += 28) {
          const brickW = Math.min(25, seg.width - c - 2);
          if (brickW <= 0) break;
          ctx.fillStyle = c % 56 === 0 ? '#475569' : '#334155';
          ctx.fillRect(sx + c + 1, seg.y + 1, brickW, 12);
          // Wet specular highlight edge
          ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
          ctx.fillRect(sx + c + 2, seg.y + 1, brickW - 2, 2);
        }
        // Snow frost dusting on cobblestone edges
        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        for (let s = 20; s < seg.width - 30; s += 110) {
          ctx.beginPath();
          ctx.ellipse(sx + s, seg.y + 2, 18, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Flickering torch sconces along fortress ground
        if (isHigh) {
          for (let t = 70; t < seg.width - 40; t += 190) {
            const tx = sx + t;
            const ty = seg.y - 28;
            ctx.fillStyle = '#475569';
            ctx.fillRect(tx - 2, ty, 4, 28);
            const flicker = Math.sin(frameCount * 0.25 + t) * 2.5;
            if (isUltra) {
              const torchGlow = ctx.createRadialGradient(tx, ty, 2, tx, ty + 14, 58 + flicker * 2);
              torchGlow.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
              torchGlow.addColorStop(0.45, 'rgba(234, 88, 12, 0.2)');
              torchGlow.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = torchGlow;
              ctx.beginPath();
              ctx.arc(tx, ty + 10, 60, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(tx, ty - 2, 5 + flicker * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(tx, ty - 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // Post-apoc cracked asphalt + thick creeping ivy
        ctx.fillStyle = '#44403c';
        ctx.fillRect(sx, seg.y, seg.width, 14);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.16)';
        ctx.fillRect(sx, seg.y, seg.width, 2);

        // Creeping ivy leaves draping down from asphalt edge
        ctx.fillStyle = '#15803d';
        for (let v = 10; v < seg.width - 15; v += 36) {
          const drop = 10 + (v % 18);
          ctx.fillRect(sx + v, seg.y + 4, 8, drop);
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(sx + v + 4, seg.y + 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#15803d';
        }
      }

      // Reflective water/puddle highlight strip at ground top when Ray-Traced Reflections enabled
      if (settings.rayTracedReflections && isHigh) {
        const reflGrad = ctx.createLinearGradient(sx, seg.y, sx, seg.y + 12);
        reflGrad.addColorStop(0, WORLD_CONFIGS[worldId].reflectionTint);
        reflGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = reflGrad;
        ctx.fillRect(sx, seg.y, seg.width, 12);
      }
    } else if (seg.type === 'PLATFORM') {
      const platGrad = ctx.createLinearGradient(sx, seg.y, sx + seg.width, seg.y);
      if (worldId === 'scifi') {
        platGrad.addColorStop(0, '#0f172a');
        platGrad.addColorStop(0.5, '#1e293b');
        platGrad.addColorStop(1, '#0f172a');
      } else if (worldId === 'medieval') {
        platGrad.addColorStop(0, '#1e293b');
        platGrad.addColorStop(0.5, '#334155');
        platGrad.addColorStop(1, '#0f172a');
      } else {
        platGrad.addColorStop(0, '#451a03');
        platGrad.addColorStop(0.5, '#57534e');
        platGrad.addColorStop(1, '#292524');
      }
      ctx.fillStyle = platGrad;
      ctx.fillRect(sx, seg.y, seg.width, seg.height);

      // Specular metallic/stone top rim
      ctx.fillStyle =
        worldId === 'scifi'
          ? 'rgba(34, 211, 238, 0.45)'
          : worldId === 'medieval'
          ? 'rgba(226, 232, 240, 0.35)'
          : 'rgba(251, 146, 60, 0.35)';
      ctx.fillRect(sx, seg.y, seg.width, 3);

      // Cast ray-traced contact shadow below platform
      if (isUltra) {
        const shadowGrad = ctx.createLinearGradient(sx, seg.y + seg.height, sx, seg.y + seg.height + 16);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(sx + 6, seg.y + seg.height, seg.width - 12, 16);
      }
    } else if (seg.type === 'LAVA') {
      const lavaGrad = ctx.createLinearGradient(sx, seg.y, sx, seg.y + seg.height);
      lavaGrad.addColorStop(0, '#fb923c');
      lavaGrad.addColorStop(0.5, '#ea580c');
      lavaGrad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = lavaGrad;
      ctx.fillRect(sx, seg.y, seg.width, seg.height);

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(sx, seg.y);
      for (let w = 0; w <= seg.width; w += 18) {
        const wY = seg.y + Math.sin(frameCount * 0.1 + w * 0.08) * 3;
        ctx.lineTo(sx + w, wY);
      }
      ctx.lineTo(sx + seg.width, seg.y + 8);
      ctx.lineTo(sx, seg.y + 8);
      ctx.closePath();
      ctx.fill();
    } else if (seg.type === 'SPIKES') {
      const spCount = Math.ceil(seg.width / 16);
      for (let s = 0; s < spCount; s++) {
        const spX = sx + s * 16;
        const spY = seg.y;
        const spGrad = ctx.createLinearGradient(spX, spY, spX + 16, spY);
        spGrad.addColorStop(0, '#475569');
        spGrad.addColorStop(0.5, '#cbd5e1');
        spGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = spGrad;
        ctx.beginPath();
        ctx.moveTo(spX, spY + seg.height);
        ctx.lineTo(spX + 8, spY + 4);
        ctx.lineTo(spX + 16, spY + seg.height);
        ctx.closePath();
        ctx.fill();
      }
    } else if (seg.type === 'SPRING') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx, seg.y + 6, seg.width, seg.height - 6);
      ctx.fillStyle = worldId === 'scifi' ? '#06b6d4' : '#10b981';
      ctx.fillRect(sx, seg.y, seg.width, 6);
    } else if (seg.type === 'BRIDGE') {
      ctx.fillStyle = '#78350f';
      for (let p = 0; p < seg.width; p += 20) {
        ctx.fillRect(sx + p, seg.y + 2, 16, seg.height - 4);
      }
    }
  });
}

export function renderRayTracedReflections(
  ctx: CanvasRenderingContext2D,
  characters: CharacterRenderData[],
  cameraX: number,
  frameCount: number,
  settings: GameSettings,
  groundY = 500
) {
  if (!settings.rayTracedReflections || settings.graphicsQuality === 'low') return;

  const isUltra = settings.graphicsQuality === 'ultra';
  const alphaBase = isUltra ? 0.28 : 0.16;

  ctx.save();
  // Clip reflections strictly inside the ground water/wet cobblestone surface band
  ctx.beginPath();
  ctx.rect(0, groundY, 1200, 60);
  ctx.clip();

  characters.forEach((char) => {
    if (char.health <= 0) return;
    const px = char.x - cameraX;
    if (px < -100 || px > 1300) return;

    const distFromGround = Math.max(0, groundY - (char.y + char.height / 2));
    if (distFromGround > 170) return;

    const fade = Math.max(0, 1 - distFromGround / 170);
    const rippleOffset = Math.sin(frameCount * 0.14 + char.x * 0.04) * 3;
    const reflY = groundY + (groundY - char.y) * 0.72 + 12;

    ctx.save();
    ctx.globalAlpha = alphaBase * fade;
    ctx.translate(px + rippleOffset, reflY);
    ctx.scale(1, -0.78);

    const bodyColor =
      char.operatorId === 'op_specter_cyan'
        ? '#06b6d4'
        : char.operatorId === 'op_phantom_crimson'
        ? '#ef4444'
        : char.operatorId === 'op_aegis_gold'
        ? '#facc15'
        : char.characterClass === 'vanguard'
        ? '#06b6d4'
        : char.characterClass === 'shadowblade'
        ? '#ef4444'
        : '#facc15';

    ctx.fillStyle = bodyColor;
    ctx.fillRect(-char.width / 2, -char.height / 2, char.width, char.height);

    // Reflected weapon glow
    if (char.actionState === 'ATTACKING') {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(char.facing === 'right' ? 10 : -24, -12, 14, 24);
    }

    // Reflected parry barrier aura
    if (char.actionState === 'PARRYING') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  });

  // Shimmering horizontal water scanline ripples
  ctx.fillStyle = WORLD_CONFIGS[settings.world].reflectionTint;
  for (let i = 0; i < 14; i++) {
    const ry = groundY + 4 + i * 4;
    const rx = ((i * 197 + frameCount * 1.4) % 1300) - 100;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(rx, ry, 55 + (i % 3) * 20, 1.5);
  }

  ctx.restore();
}

export function renderHeroCharacter(
  ctx: CanvasRenderingContext2D,
  char: CharacterRenderData,
  cameraX: number,
  frameCount: number,
  isUltra: boolean
) {
  if (char.health <= 0) return;

  const px = char.x - cameraX;
  const dirSign = char.facing === 'right' ? 1 : -1;

  let bobbingY = 0;
  let runningLean = 0;
  let legAngle = 0;

  if (char.actionState === 'RUNNING' || (Math.abs(char.vx) > 0.3 && char.grounded)) {
    bobbingY = Math.sin(frameCount * 0.28) * 3;
    legAngle = Math.sin(frameCount * 0.32) * 12;
    runningLean = char.vx * 0.025 * dirSign;
  } else if (char.actionState === 'JUMPING' || !char.grounded) {
    bobbingY = -2;
    legAngle = -5;
    runningLean = char.vy * 0.015 * dirSign;
  } else {
    bobbingY = Math.sin(frameCount * 0.14) * 1.5;
  }

  // Ground contact shadow
  if (char.grounded && isUltra) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(px, char.y + char.height / 2 + 2, char.width * 0.65, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(px, char.y + bobbingY);
  ctx.rotate(runningLean);

  // Resolve operator palette (dark base + single bright high-contrast accent)
  const opId: OperatorId =
    char.operatorId ||
    (char.characterClass === 'shadowblade'
      ? 'op_phantom_crimson'
      : char.characterClass === 'spellweaver'
      ? 'op_aegis_gold'
      : 'op_specter_cyan');

  const palette =
    opId === 'op_phantom_crimson'
      ? {
          armorDark: '#090d1a',
          armorMid: '#172038',
          accent: '#ef4444',
          capeDark: '#1e1b24',
          capeEdge: '#7f1d1d',
          leather: '#5c3a21',
          skin: '#c69372',
        }
      : opId === 'op_aegis_gold'
      ? {
          armorDark: '#161b14',
          armorMid: '#2a3326',
          accent: '#facc15',
          capeDark: '#1c1917',
          capeEdge: '#854d0e',
          leather: '#6b4226',
          skin: '#bf8b68',
        }
      : {
          armorDark: '#0d1016',
          armorMid: '#1e2430',
          accent: '#06b6d4',
          capeDark: '#111827',
          capeEdge: '#0e7490',
          leather: '#6d4427',
          skin: '#ce9c7a',
        };

  // Autonomous Hovering Combat Drone behind trailing shoulder
  if (char.hasDrone) {
    const droneX = -24 * dirSign;
    const droneY = -char.height / 2 - 14 + Math.sin(frameCount * 0.12) * 4;
    ctx.save();
    ctx.translate(droneX, droneY);

    // Subtle rotor blur
    ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.fillRect(-13, -6, 10, 2);
    ctx.fillRect(3, -6, 10, 2);

    // Carbon chassis
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-9, -4, 18, 9, 3);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glowing cyan optic core
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(3 * dirSign, 0.5, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Asymmetric one-shoulder tactical cape
  const cpGrad = ctx.createLinearGradient(-12 * dirSign, -10, -44 * dirSign - char.vx * 1.4, 22);
  cpGrad.addColorStop(0, palette.capeDark);
  cpGrad.addColorStop(1, palette.capeEdge);
  ctx.fillStyle = cpGrad;

  ctx.beginPath();
  ctx.moveTo(-4 * dirSign, -char.height / 2 + 9);
  const billOsc = Math.sin(frameCount * 0.2 + char.vx) * 6;
  ctx.bezierCurveTo(
    -26 * dirSign - char.vx * 1.6,
    -14 + billOsc,
    -46 * dirSign - char.vx * 2.9,
    14 - billOsc,
    -8 * dirSign,
    char.height / 2 - 5
  );
  ctx.closePath();
  ctx.fill();

  // Accent emblem stripe on cape shoulder
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-7 * dirSign, -char.height / 2 + 12);
  ctx.lineTo(-18 * dirSign, -char.height / 2 + 17);
  ctx.stroke();

  // Back prosthetic / cybernetic arm (asymmetry)
  ctx.save();
  ctx.translate(-10 * dirSign, -6);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-3.5, 0, 7, 17);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(-1.5, 4, 3, 9);
  ctx.restore();

  // Sleek dark carbon-fiber / tactical torso armor
  const armorGrad = ctx.createLinearGradient(-char.width / 2, 0, char.width / 2, 0);
  armorGrad.addColorStop(0, palette.armorDark);
  armorGrad.addColorStop(0.5, palette.armorMid);
  armorGrad.addColorStop(1, palette.armorDark);
  ctx.fillStyle = armorGrad;
  ctx.beginPath();
  ctx.roundRect(-char.width / 2, -char.height / 2 + 11, char.width, char.height - 19, 3);
  ctx.fill();

  if (isUltra) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Weathered diagonal leather tactical strap across chest
  ctx.strokeStyle = palette.leather;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-11 * dirSign, -char.height / 2 + 12);
  ctx.lineTo(11 * dirSign, 6);
  ctx.stroke();

  // Metallic buckle on leather strap
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(2 * dirSign - 2, -6, 4, 4);

  // Glowing chest tactical conduit accent
  ctx.fillStyle = palette.accent;
  ctx.fillRect(-2, -10, 4, 9);
  ctx.fillRect(-6, -7, 12, 2);

  // Asymmetric armored pauldron on lead shoulder
  ctx.fillStyle = palette.armorMid;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(dirSign === 1 ? 6 : -17, -char.height / 2 + 10, 11, 9, 2);
  ctx.fill();
  ctx.stroke();

  // MetaHuman-inspired tactical head, intense eyes, facial scar & glowing visor accent
  ctx.save();
  // Head silhouette / dark hair
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(-9, -char.height / 2 - 2, 18, 16, 4);
  ctx.fill();

  // Face skin region
  ctx.fillStyle = palette.skin;
  ctx.fillRect(dirSign === 1 ? -3 : -8, -char.height / 2 + 2, 11, 10);

  // Intense expressive glowing visor / tactical eye accent
  ctx.fillStyle = palette.accent;
  const eyeX = dirSign === 1 ? 1 : -8;
  ctx.fillRect(eyeX, -char.height / 2 + 4.5, 7, 2.8);

  // Subtle diagonal facial scar
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(eyeX + (dirSign === 1 ? 1 : 4), -char.height / 2 + 2);
  ctx.lineTo(eyeX + (dirSign === 1 ? 4 : 1), -char.height / 2 + 9);
  ctx.stroke();

  // Lower tactical respirator / collar guard
  ctx.fillStyle = palette.armorDark;
  ctx.fillRect(-8, -char.height / 2 + 9, 16, 4.5);
  ctx.restore();

  // Tactical armored legs + boots
  ctx.fillStyle = palette.armorDark;
  ctx.save();
  ctx.translate(-5 * dirSign, char.height / 2 - 8);
  ctx.rotate((legAngle * Math.PI) / 180);
  ctx.fillRect(-3.5, 0, 7, 9);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(-1, 2, 2, 4);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(-4, 7, 8.5, 3.5);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = palette.armorMid;
  ctx.translate(5 * dirSign, char.height / 2 - 8);
  ctx.rotate((-legAngle * Math.PI) / 180);
  ctx.fillRect(-3.5, 0, 7, 9);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(-4, 7, 8.5, 3.5);
  ctx.restore();

  // Equipped Primary Weapon (Tactical Rifle / Railcarbine / Arc Cannon)
  const weaponId: WeaponId = char.weaponId || 'wpn_carbon_gold_ar';
  ctx.save();
  ctx.translate(10 * dirSign, -1);
  let attackRotate = 0;
  if (char.actionState === 'ATTACKING') {
    attackRotate = dirSign * (-0.35 + (char.stateTimer / 12) * 0.55);
  }
  ctx.rotate(attackRotate);

  if (weaponId === 'wpn_crimson_railcarbine') {
    // Navy steel railcarbine + crimson plasma core + bayonet
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(dirSign === 1 ? -4 : -24, -4, 28, 7);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(dirSign === 1 ? 4 : -14, -2.5, 10, 3);
    // Bayonet
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(dirSign === 1 ? 16 : -26, 2, 10, 2);
  } else if (weaponId === 'wpn_olive_arc_rifle') {
    // Heavy olive titanium + gold trim + neon blue arc coils
    ctx.fillStyle = '#364130';
    ctx.fillRect(dirSign === 1 ? -6 : -26, -5, 32, 9);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(dirSign === 1 ? -2 : -18, -6, 16, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(dirSign === 1 ? 4 : -14, -2.5, 12, 3.5);
  } else {
    // Carbon-gold AR with glowing cyan energy core
    ctx.fillStyle = '#18181b';
    ctx.fillRect(dirSign === 1 ? -5 : -25, -4, 30, 7);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(dirSign === 1 ? 18 : -27, -3, 9, 4);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(dirSign === 1 ? 4 : -13, -2.5, 9, 3);
  }
  // Magazine & grip
  ctx.fillStyle = '#09090b';
  ctx.fillRect(dirSign === 1 ? 2 : -6, 2, 4, 7);
  ctx.restore();

  // Parry shield dome
  if (char.actionState === 'PARRYING') {
    const shieldRadius = 38;
    const barrier = ctx.createRadialGradient(0, 0, shieldRadius * 0.7, 0, 0, shieldRadius);
    barrier.addColorStop(0, 'rgba(56, 189, 248, 0)');
    barrier.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
    barrier.addColorStop(0.9, 'rgba(14, 165, 233, 0.45)');
    barrier.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = barrier;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Dash speed aura
  if (char.actionState === 'DASHING') {
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26 * dirSign, -12);
    ctx.lineTo(-48 * dirSign, -12);
    ctx.moveTo(-22 * dirSign, 4);
    ctx.lineTo(-42 * dirSign, 4);
    ctx.stroke();
  }

  ctx.restore();

  // Overhead PvP nameplate + HP/Shield bar
  if (char.label) {
    const barW = 54;
    const barY = char.y - char.height / 2 - 22;
    ctx.save();
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(char.label, px + 1, barY - 7);
    ctx.fillStyle = char.isLocal ? '#38bdf8' : '#f8fafc';
    ctx.fillText(char.label, px, barY - 8);

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(px - barW / 2, barY, barW, 5);
    ctx.fillStyle = char.isLocal ? '#22c55e' : '#ef4444';
    ctx.fillRect(px - barW / 2, barY, Math.max(0, (char.health / char.maxHealth) * barW), 5);

    if (char.shield > 0 && char.maxShield > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px - barW / 2, barY - 3, Math.max(0, (char.shield / char.maxShield) * barW), 2);
    }
    ctx.restore();
  }
}

export function renderWeatherLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameCount: number,
  settings: GameSettings
) {
  if (!settings.particlesEnabled) return;

  const weather = resolveEffectiveWeather(settings.world, settings.weather);
  const densityScale = settings.graphicsQuality === 'ultra' ? 1 : settings.graphicsQuality === 'high' ? 0.7 : 0.4;

  ctx.save();

  if (weather === 'rain' || weather === 'storm') {
    const count = Math.round((weather === 'storm' ? 110 : 65) * densityScale);
    ctx.strokeStyle = weather === 'storm' ? 'rgba(186, 230, 253, 0.36)' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = weather === 'storm' ? 1.5 : 1.1;

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const rx = ((i * 193 - frameCount * (weather === 'storm' ? 14 : 9)) % (width + 160) + (width + 160)) % (width + 160) - 80;
      const ry = ((i * 271 + frameCount * (weather === 'storm' ? 22 : 16)) % (height + 80)) - 40;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - (weather === 'storm' ? 9 : 4), ry + (weather === 'storm' ? 22 : 15));
    }
    ctx.stroke();

    // Storm lightning flash & branching bolt
    if (weather === 'storm') {
      const cycle = frameCount % 260;
      if (cycle === 12 || cycle === 14 || cycle === 18) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.24)';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(240, 249, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let lx = 250 + ((frameCount * 37) % 700);
        let ly = 0;
        ctx.moveTo(lx, ly);
        for (let seg = 0; seg < 6; seg++) {
          lx += (seg % 2 === 0 ? 1 : -1) * (15 + (seg * 7) % 20);
          ly += 55;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    }
  } else if (weather === 'blizzard') {
    const count = Math.round(90 * densityScale);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
    for (let i = 0; i < count; i++) {
      const sx = ((i * 173 - frameCount * 4.5 + Math.sin(frameCount * 0.04 + i) * 18) % (width + 80) + (width + 80)) % (width + 80) - 40;
      const sy = ((i * 229 + frameCount * (2.5 + (i % 3) * 0.8)) % (height + 40)) - 20;
      const r = 1.4 + (i % 3) * 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Frost edge vignette
    const frostGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.65);
    frostGrad.addColorStop(0, 'rgba(0,0,0,0)');
    frostGrad.addColorStop(1, 'rgba(224, 242, 254, 0.14)');
    ctx.fillStyle = frostGrad;
    ctx.fillRect(0, 0, width, height);
  } else if (weather === 'fog') {
    // Volumetric rolling fog bands
    for (let band = 0; band < 4; band++) {
      const fy = 210 + band * 95;
      const fx = Math.sin(frameCount * 0.008 + band * 1.7) * 90;
      const fogGrad = ctx.createLinearGradient(0, fy - 45, 0, fy + 55);
      fogGrad.addColorStop(0, 'rgba(0,0,0,0)');
      fogGrad.addColorStop(0.5, WORLD_CONFIGS[settings.world].fogColor);
      fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(fx - 100, fy - 45, width + 200, 100);
    }
  } else if (weather === 'spores') {
    const count = Math.round(55 * densityScale);
    for (let i = 0; i < count; i++) {
      const px = ((i * 157 + frameCount * -0.6 + Math.sin(frameCount * 0.03 + i) * 16) % (width + 60) + (width + 60)) % (width + 60) - 30;
      const py = ((i * 313 + frameCount * -0.45) % (height + 60) + (height + 60)) % (height + 60) - 30;
      const rad = 1.6 + Math.sin(frameCount * 0.08 + i) * 0.8;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(52, 211, 153, 0.65)' : i % 3 === 1 ? 'rgba(34, 211, 238, 0.65)' : 'rgba(192, 132, 252, 0.6)';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.8, rad), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Clear sky gentle atmospheric dust motes
    const count = Math.round(28 * densityScale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < count; i++) {
      const mx = ((i * 191 + frameCount * 0.35) % width);
      const my = ((i * 257 + Math.sin(frameCount * 0.02 + i) * 20) % height);
      ctx.beginPath();
      ctx.arc(mx, my, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
