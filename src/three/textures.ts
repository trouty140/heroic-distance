import * as THREE from 'three';

export interface MaterialTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface WorldTextureBundle {
  jungleStone: MaterialTextureSet;
  volcanicBasalt: MaterialTextureSet;
  cyberMetal: MaterialTextureSet;
  medievalSlate: MaterialTextureSet;
  wetAsphalt: MaterialTextureSet;
  billboardMaps: THREE.CanvasTexture[];
  hijackBillboardMaps: THREE.CanvasTexture[];
  waterfallMap: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
  shadowDecal: THREE.CanvasTexture;
  dispose: () => void;
}

function createCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function buildNormalFromHeight(heightCanvas: HTMLCanvasElement, strength = 2.6): THREE.CanvasTexture {
  const size = heightCanvas.width;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, size, size).data;

  const [outCanvas, outCtx] = createCanvas(size);
  const outImg = outCtx.createImageData(size, size);
  const dst = outImg.data;

  const sample = (x: number, y: number) => {
    const cx = ((x % size) + size) % size;
    const cy = ((y % size) + size) % size;
    return srcData[(cy * size + cx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      let nx = (hL - hR) * strength;
      let ny = (hU - hD) * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function configureRepeatTexture(tex: THREE.CanvasTexture, isColor: boolean, rx = 2, ry = 1) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
}

function addMicroGrain(
  aCtx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  rCtx: CanvasRenderingContext2D,
  size: number,
  seedOffset: number
) {
  for (let i = 0; i < 420; i++) {
    const x = ((i * 97 + seedOffset * 31) % size);
    const y = ((i * 53 + seedOffset * 17) % size);
    const w = 2 + (i % 5);
    const h = 2 + ((i * 3) % 4);
    const delta = (i % 2 === 0 ? 1 : -1) * (10 + (i % 14));
    aCtx.fillStyle = delta > 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.08)';
    aCtx.fillRect(x, y, w, h);

    const hv = 128 + delta * 2;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(x, y, w, h);

    const rv = 110 + ((i * 7) % 60);
    rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.35)`;
    rCtx.fillRect(x, y, w + 1, h + 1);
  }
}

function createJungleStoneSet(): MaterialTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size);
  const [heightC, hCtx] = createCanvas(size);
  const [roughC, rCtx] = createCanvas(size);

  aCtx.fillStyle = '#11252b';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#b0b0b0';
  rCtx.fillRect(0, 0, size, size);

  // Sculpted stone slabs + mossy veins
  for (let i = 0; i < 120; i++) {
    const x = (Math.sin(i * 19.7) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 31.3) * 0.5 + 0.5) * size;
    const w = 28 + (i % 6) * 16;
    const h = 20 + (i % 5) * 12;
    const shade = 22 + (i % 7) * 6;
    aCtx.fillStyle = `rgb(${shade - 6}, ${shade + 16}, ${shade + 22})`;
    aCtx.fillRect(x, y, w, h);

    aCtx.strokeStyle = 'rgba(4, 14, 18, 0.45)';
    aCtx.lineWidth = 2;
    aCtx.strokeRect(x, y, w, h);

    const hVal = 108 + (i % 8) * 16;
    hCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
    hCtx.fillRect(x, y, w, h);

    const rVal = i % 4 === 0 ? 64 : 138 + (i % 5) * 18;
    rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
    rCtx.fillRect(x, y, w, h);
  }

  // Mossy wet specular puddles & biolume flecks
  for (let i = 0; i < 72; i++) {
    const x = (i * 79) % size;
    const y = (i * 113) % size;
    aCtx.fillStyle = i % 4 === 0 ? 'rgba(34, 211, 238, 0.36)' : 'rgba(16, 185, 129, 0.34)';
    aCtx.beginPath();
    aCtx.arc(x, y, 6 + (i % 10), 0, Math.PI * 2);
    aCtx.fill();

    // Glossy wet patch
    rCtx.fillStyle = 'rgb(42,42,42)';
    rCtx.beginPath();
    rCtx.arc(x, y, 10 + (i % 8), 0, Math.PI * 2);
    rCtx.fill();
  }

  addMicroGrain(aCtx, hCtx, rCtx, size, 1);

  const map = new THREE.CanvasTexture(albedoC);
  configureRepeatTexture(map, true, 2, 1);
  const normalMap = buildNormalFromHeight(heightC, 3.0);
  normalMap.repeat.set(2, 1);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  configureRepeatTexture(roughnessMap, false, 2, 1);
  return { map, normalMap, roughnessMap };
}

function createVolcanicSet(): MaterialTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size);
  const [heightC, hCtx] = createCanvas(size);
  const [roughC, rCtx] = createCanvas(size);

  aCtx.fillStyle = '#1b1114';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#909090';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#c4c4c4';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 130; i++) {
    const x = (i * 89) % size;
    const y = (i * 53) % size;
    const r = 16 + (i % 6) * 10;
    const c = 24 + (i % 6) * 6;
    aCtx.fillStyle = `rgb(${c + 12}, ${c}, ${c + 2})`;
    aCtx.fillRect(x, y, r, r * 0.85);

    const hv = 98 + (i % 7) * 20;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(x, y, r, r * 0.85);
  }

  // Glowing magma fissures + glassy obsidian specular veins
  aCtx.strokeStyle = '#f97316';
  aCtx.lineWidth = 3.2;
  hCtx.strokeStyle = '#282828';
  hCtx.lineWidth = 4;
  rCtx.strokeStyle = '#383838';
  rCtx.lineWidth = 4;
  for (let i = 0; i < 18; i++) {
    const startX = (i * 67) % size;
    const startY = (i * 109) % size;
    const midX = (startX + 42) % size;
    const midY = (startY + 28) % size;
    const endX = (startX + 86) % size;
    const endY = (startY + 48) % size;

    [aCtx, hCtx, rCtx].forEach((ctx) => {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(midX, midY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  }

  addMicroGrain(aCtx, hCtx, rCtx, size, 2);

  const map = new THREE.CanvasTexture(albedoC);
  configureRepeatTexture(map, true, 2, 1);
  const normalMap = buildNormalFromHeight(heightC, 3.2);
  normalMap.repeat.set(2, 1);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  configureRepeatTexture(roughnessMap, false, 2, 1);
  return { map, normalMap, roughnessMap };
}

function createCyberMetalSet(): MaterialTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size);
  const [heightC, hCtx] = createCanvas(size);
  const [roughC, rCtx] = createCanvas(size);

  aCtx.fillStyle = '#141a24';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#a4a4a4';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#686868';
  rCtx.fillRect(0, 0, size, size);

  // Brushed anisotropic horizontal streaks
  for (let y = 0; y < size; y += 2) {
    const delta = (Math.sin(y * 0.65) * 9) | 0;
    aCtx.fillStyle = `rgb(${22 + delta}, ${28 + delta}, ${40 + delta})`;
    aCtx.fillRect(0, y, size, 1);
  }

  // Tech panel bevel seams + bolted corners
  aCtx.strokeStyle = '#090d14';
  aCtx.lineWidth = 6;
  hCtx.strokeStyle = '#323232';
  hCtx.lineWidth = 6;
  for (let g = 0; g < size; g += 128) {
    aCtx.strokeRect(g + 3, 3, 122, 250);
    aCtx.strokeRect(g + 3, 259, 122, 250);
    hCtx.strokeRect(g + 3, 3, 122, 250);
    hCtx.strokeRect(g + 3, 259, 122, 250);

    // Corner rivets
    hCtx.fillStyle = '#d8d8d8';
    for (const rx of [g + 16, g + 112]) {
      for (const ry of [16, 240, 272, 496]) {
        hCtx.beginPath();
        hCtx.arc(rx, ry, 4, 0, Math.PI * 2);
        hCtx.fill();
      }
    }
  }

  // Cyan & amber emissive trim + glossy wet reflection stripe
  aCtx.fillStyle = 'rgba(56, 189, 248, 0.6)';
  aCtx.fillRect(0, 253, size, 6);
  rCtx.fillStyle = 'rgb(28,28,28)';
  rCtx.fillRect(0, 240, size, 32);

  addMicroGrain(aCtx, hCtx, rCtx, size, 3);

  const map = new THREE.CanvasTexture(albedoC);
  configureRepeatTexture(map, true, 2, 1);
  const normalMap = buildNormalFromHeight(heightC, 2.5);
  normalMap.repeat.set(2, 1);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  configureRepeatTexture(roughnessMap, false, 2, 1);
  return { map, normalMap, roughnessMap };
}

function createMedievalSlateSet(): MaterialTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size);
  const [heightC, hCtx] = createCanvas(size);
  const [roughC, rCtx] = createCanvas(size);

  aCtx.fillStyle = '#1c2636';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#5c5c5c';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#868686';
  rCtx.fillRect(0, 0, size, size);

  const rows = 6;
  const cols = 6;
  const bw = size / cols;
  const bh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset;
      const y = r * bh;
      const shade = 36 + ((r * 7 + c * 11) & 15);
      aCtx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 18})`;
      aCtx.fillRect(x + 3, y + 3, bw - 6, bh - 6);

      const hv = 152 + ((r + c * 3) & 23);
      hCtx.fillStyle = `rgb(${hv}, ${hv}, ${hv})`;
      hCtx.fillRect(x + 4, y + 4, bw - 8, bh - 8);

      // Wet cobblestone specular puddles
      rCtx.fillStyle = (r + c) % 3 === 0 ? 'rgb(38,38,38)' : 'rgb(138,138,138)';
      rCtx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }

  addMicroGrain(aCtx, hCtx, rCtx, size, 4);

  const map = new THREE.CanvasTexture(albedoC);
  configureRepeatTexture(map, true, 2, 1);
  const normalMap = buildNormalFromHeight(heightC, 3.1);
  normalMap.repeat.set(2, 1);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  configureRepeatTexture(roughnessMap, false, 2, 1);
  return { map, normalMap, roughnessMap };
}

function createWaterfallTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(128);
  ctx.clearRect(0, 0, 128, 128);
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
  grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.78)');
  grad.addColorStop(1, 'rgba(6, 182, 212, 0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 42; i++) {
    const x = (i * 19) % 128;
    const y = (i * 23) % 128;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.fillRect(x, y, 2, 28);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlowSpriteTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShadowDecalTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWetAsphaltSet(): MaterialTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size);
  const [heightC, hCtx] = createCanvas(size);
  const [roughC, rCtx] = createCanvas(size);

  aCtx.fillStyle = '#0c1018';
  aCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#5a5a5a';
  rCtx.fillRect(0, 0, size, size);

  // Rain-slick glossy puddle reflections across wet asphalt
  for (let i = 0; i < 28; i++) {
    const x = (i * 107) % size;
    const y = (i * 73) % size;
    const rw = 42 + (i % 5) * 18;
    const rh = 18 + (i % 4) * 10;
    aCtx.fillStyle = 'rgba(18, 28, 44, 0.55)';
    aCtx.beginPath();
    aCtx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    aCtx.fill();

    rCtx.fillStyle = 'rgb(16, 16, 16)';
    rCtx.beginPath();
    rCtx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Glowing cyan highway shoulder + amber dashed center line
  aCtx.fillStyle = '#22d3ee';
  aCtx.fillRect(0, 18, size, 8);
  aCtx.fillRect(0, size - 26, size, 8);

  aCtx.fillStyle = '#f59e0b';
  for (let x = 16; x < size; x += 96) {
    aCtx.fillRect(x, size / 2 - 4, 52, 8);
  }

  addMicroGrain(aCtx, hCtx, rCtx, size, 7);

  const map = new THREE.CanvasTexture(albedoC);
  configureRepeatTexture(map, true, 3, 1);
  const normalMap = buildNormalFromHeight(heightC, 1.8);
  normalMap.repeat.set(3, 1);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  configureRepeatTexture(roughnessMap, false, 3, 1);
  return { map, normalMap, roughnessMap };
}

function createBillboardTexture(title: string, subtitle: string, primaryHex: string, secondaryHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512);
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, 512, 512);

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, primaryHex);
  grad.addColorStop(1, secondaryHex);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.globalAlpha = 1;

  // Holographic scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 512; y += 8) {
    ctx.fillRect(0, y, 512, 2);
  }

  // Framing brackets
  ctx.strokeStyle = primaryHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 86, 476, 340);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 232);

  ctx.fillStyle = primaryHex;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(subtitle, 256, 298);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createWorldTextureBundle(): WorldTextureBundle {
  const jungleStone = createJungleStoneSet();
  const volcanicBasalt = createVolcanicSet();
  const cyberMetal = createCyberMetalSet();
  const medievalSlate = createMedievalSlateSet();
  const wetAsphalt = createWetAsphaltSet();
  const billboardMaps = [
    createBillboardTexture('CHIRON-X HYPER', 'NITRO ARSENAL // [F] DRIVE', '#22d3ee', '#0284c7'),
    createBillboardTexture('NEO-SECTOR 09', 'SAFE PLAZA // ALLIES ONLINE', '#f59e0b', '#dc2626'),
    createBillboardTexture('APEX GARAGE', '3D ARMORY & TUNING BAY', '#c084fc', '#22d3ee'),
  ];
  const hijackBillboardMaps = [
    createBillboardTexture('NO ESCAPE', 'SIGNAL HIJACKED // HUNT PROTOCOL', '#ef4444', '#7f1d1d'),
    createBillboardTexture('BOW OR BURN', 'OVERLORD INTERCEPT ACTIVE', '#f43f5e', '#4c0519'),
    createBillboardTexture('TARGET LOCKED', 'VOID WARLORDS CLOSING IN', '#d946ef', '#7f1d1d'),
  ];
  const waterfallMap = createWaterfallTexture();
  const glowSprite = createGlowSpriteTexture();
  const shadowDecal = createShadowDecalTexture();

  const disposeSet = (s: MaterialTextureSet) => {
    s.map.dispose();
    s.normalMap.dispose();
    s.roughnessMap.dispose();
  };

  return {
    jungleStone,
    volcanicBasalt,
    cyberMetal,
    medievalSlate,
    wetAsphalt,
    billboardMaps,
    hijackBillboardMaps,
    waterfallMap,
    glowSprite,
    shadowDecal,
    dispose: () => {
      disposeSet(jungleStone);
      disposeSet(volcanicBasalt);
      disposeSet(cyberMetal);
      disposeSet(medievalSlate);
      disposeSet(wetAsphalt);
      billboardMaps.forEach((b) => b.dispose());
      hijackBillboardMaps.forEach((b) => b.dispose());
      waterfallMap.dispose();
      glowSprite.dispose();
      shadowDecal.dispose();
    },
  };
}
