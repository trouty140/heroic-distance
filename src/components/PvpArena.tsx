import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Sliders,
  LogOut,
  Send,
  Users,
  Swords,
  MessageSquare,
  Globe,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  GameSettings,
  PlayerLoadout,
  Projectile,
  PvpChatMessage,
  PvpCombatEvent,
  PvpPlayerSnapshot,
  PvpProjectileSnapshot,
  TerrainSegment,
  WorldId,
} from '../types';
import { WORLD_CONFIGS, WORLD_LIST } from '../config/worlds';
import { computeLoadoutBonuses } from '../config/armory';
import { createThreePipeline } from '../three/glContext';
import { createWorldTextureBundle } from '../three/textures';
import {
  buildHeroRig,
  createDashGhostPool,
  toWorldX,
  toWorldY,
  updateHeroRig,
  type HeroRig,
} from '../three/hero3d';
import { createProjectilePool } from '../three/enemies3d';
import {
  createBurstFxPool,
  createTerrainAndDecorRenderer,
  createWorldEnvironment,
} from '../three/world3d';
import { playDash, playExplosion, playHurt, playJump, playParry, playSlash, playUiClick } from '../utils/audio';

interface PvpArenaProps {
  playerName: string;
  characterClass: 'vanguard' | 'shadowblade' | 'spellweaver';
  loadout: PlayerLoadout;
  settings: GameSettings;
  onOpenSettings: () => void;
  onWorldSwitch: (world: WorldId) => void;
  onKillReward?: () => void;
  onExit: () => void;
}

const ARENA_WIDTH = 1600;

const ARENA_TERRAIN: TerrainSegment[] = [
  { x: 0, y: 500, width: ARENA_WIDTH, height: 120, color: '#1e293b', type: 'GROUND' },
  { x: 180, y: 380, width: 220, height: 24, color: '#334155', type: 'PLATFORM' },
  { x: 520, y: 310, width: 240, height: 24, color: '#334155', type: 'PLATFORM' },
  { x: 840, y: 310, width: 240, height: 24, color: '#334155', type: 'PLATFORM' },
  { x: 1200, y: 380, width: 220, height: 24, color: '#334155', type: 'PLATFORM' },
  { x: 680, y: 200, width: 240, height: 24, color: '#334155', type: 'PLATFORM' },
  { x: 100, y: 486, width: 44, height: 14, color: '#10b981', type: 'SPRING' },
  { x: 1456, y: 486, width: 44, height: 14, color: '#10b981', type: 'SPRING' },
];

export default function PvpArena({
  playerName,
  characterClass,
  loadout,
  settings,
  onOpenSettings,
  onWorldSwitch,
  onKillReward,
  onExit,
}: PvpArenaProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const loadoutRef = useRef(loadout);
  loadoutRef.current = loadout;
  const onKillRewardRef = useRef(onKillReward);
  onKillRewardRef.current = onKillReward;

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const selfIdRef = useRef<string | null>(null);

  const [playersList, setPlayersList] = useState<PvpPlayerSnapshot[]>([]);
  const remotePlayersRef = useRef<Map<string, PvpPlayerSnapshot>>(new Map());
  const projectilesRef = useRef<PvpProjectileSnapshot[]>([]);
  const pendingBurstsRef = useRef<{ x: number; y: number; color: number; count: number }[]>([]);

  const [chatMessages, setChatMessages] = useState<PvpChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [killFeed, setKillFeed] = useState<string[]>([]);

  const keysRef = useRef<Record<string, boolean>>({});
  const isTypingRef = useRef(false);

  const localPlayerRef = useRef({
    x: 400,
    y: 476,
    vx: 0,
    vy: 0,
    width: 32,
    height: 48,
    grounded: true,
    facing: 'right' as 'left' | 'right',
    health: characterClass === 'vanguard' ? 150 : characterClass === 'spellweaver' ? 120 : 105,
    maxHealth: characterClass === 'vanguard' ? 150 : characterClass === 'spellweaver' ? 120 : 105,
    shield: characterClass === 'vanguard' ? 50 : 25,
    maxShield: characterClass === 'vanguard' ? 50 : 25,
    stamina: 100,
    doubleJumpsLeft: characterClass === 'shadowblade' ? 2 : 1,
    actionState: 'IDLE' as PvpPlayerSnapshot['actionState'],
    stateTimer: 0,
    attackCooldown: 0,
    dashCooldown: 0,
    parryCooldown: 0,
    alive: true,
    respawnTimer: 0,
  });

  const enqueueBurst = useCallback((x: number, y: number, color: number, count = 12) => {
    pendingBurstsRef.current.push({ x, y, color, count });
  }, []);

  // WebSocket connection
  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        setReconnecting(false);
        ws.send(
          JSON.stringify({
            type: 'pvp:join',
            name: playerName,
            characterClass,
            operatorId: loadoutRef.current.operatorId,
            weaponId: loadoutRef.current.weaponId,
            gadgetIds: loadoutRef.current.gadgetIds.filter(Boolean),
            world: settingsRef.current.world,
          })
        );
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === 'pvp:init' || data.type === 'pvp:state') {
          if (data.selfId) {
            selfIdRef.current = data.selfId;
            setSelfId(data.selfId);
          }

          const incomingPlayers: PvpPlayerSnapshot[] = data.players || [];
          setPlayersList(incomingPlayers);

          const map = new Map<string, PvpPlayerSnapshot>();
          incomingPlayers.forEach((p) => {
            if (p.id === selfIdRef.current) {
              const lp = localPlayerRef.current;
              const wasDead = !lp.alive;
              lp.health = p.health;
              lp.maxHealth = p.maxHealth;
              lp.shield = p.shield;
              lp.maxShield = p.maxShield;
              lp.alive = p.alive;
              lp.respawnTimer = p.respawnTimer;
              if (data.type === 'pvp:init' || (wasDead && p.alive)) {
                lp.x = p.x;
                lp.y = p.y;
                lp.vx = 0;
                lp.vy = 0;
              }
            } else {
              map.set(p.id, p);
            }
          });
          remotePlayersRef.current = map;
          projectilesRef.current = data.projectiles || [];
        } else if (data.type === 'pvp:event') {
          const ev: PvpCombatEvent = data.event;
          if (ev.type === 'hit') {
            playHurt();
            enqueueBurst(ev.x, ev.y, ev.crit ? 0xfacc15 : 0xef4444, ev.crit ? 18 : 10);
          } else if (ev.type === 'parry') {
            playParry();
            enqueueBurst(ev.x, ev.y, 0x38bdf8, 14);
          } else if (ev.type === 'kill') {
            playExplosion();
            enqueueBurst(ev.x, ev.y, 0xf97316, 26);
            if (ev.attackerId === selfIdRef.current) {
              onKillRewardRef.current?.();
            }
            const all = [...remotePlayersRef.current.values()];
            const killer =
              ev.attackerId === selfIdRef.current
                ? playerName
                : all.find((p) => p.id === ev.attackerId)?.name || 'Warrior';
            const victim =
              ev.targetId === selfIdRef.current
                ? playerName
                : all.find((p) => p.id === ev.targetId)?.name || 'Opponent';
            setKillFeed((prev) => [`${killer} defeated ${victim}`, ...prev].slice(0, 4));
          } else if (ev.type === 'dash' && ev.attackerId !== selfIdRef.current) {
            enqueueBurst(ev.x, ev.y, 0x22d3ee, 8);
          } else if (ev.type === 'attack' && ev.attackerId !== selfIdRef.current) {
            playSlash();
          }
        } else if (data.type === 'pvp:chat') {
          const msg: PvpChatMessage = data.message;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg].slice(-40);
          });
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!unmounted) {
          setReconnecting(true);
          const delay = Math.min(4000, 600 * Math.pow(1.5, attempt));
          attempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [playerName, characterClass, enqueueBurst]);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pvp:switch_world', world: settings.world }));
    }
  }, [settings.world]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingRef.current) return;
      const key = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'w', 's'].includes(key)) {
        e.preventDefault();
      }
      keysRef.current[key] = true;
      keysRef.current[e.code.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 3D Three.js PvP Render & Physics Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const width = Math.max(container.clientWidth || 1200, 320);
    const height = Math.max(container.clientHeight || 675, 180);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 150);
    camera.position.set(14, 4.2, 16.5);

    const pipeline = createThreePipeline(container, scene, camera, settingsRef.current.graphicsQuality);
    const textures = createWorldTextureBundle();
    const worldEnv = createWorldEnvironment(scene, textures, pipeline.isSoftwareGl);
    const terrainRenderer = createTerrainAndDecorRenderer(scene, textures);
    const burstPool = createBurstFxPool(scene);
    const projPool = createProjectilePool(scene);
    const dashGhosts = createDashGhostPool(scene);

    const initBonuses = computeLoadoutBonuses(loadoutRef.current);
    let lastQuality = settingsRef.current.graphicsQuality;
    let currentAppearanceKey = `${loadoutRef.current.operatorId}|${loadoutRef.current.weaponId}|${loadoutRef.current.gadgetIds.join(',')}|${initBonuses.droneSupport}`;
    let localRig: HeroRig = buildHeroRig(
      {
        operatorId: loadoutRef.current.operatorId,
        weaponId: loadoutRef.current.weaponId,
        gadgetIds: loadoutRef.current.gadgetIds,
        hasDrone: initBonuses.droneSupport,
      },
      textures.shadowDecal
    );
    scene.add(localRig.root);

    const remoteRigs = new Map<string, HeroRig>();

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        pipeline.resize(rect.width, rect.height);
      }
    });
    resizeObserver.observe(container);

    let frameCount = 0;
    let attackPressed = false;
    let dashPressed = false;
    let animHandle = 0;
    let disposed = false;
    let lastTime = performance.now();
    let totalTimeSec = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (isTypingRef.current) return;
      if (e.button === 0 || e.button === 2) {
        e.preventDefault();
        attackPressed = true;
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    pipeline.renderer.domElement.addEventListener('mousedown', handleMouseDown);
    pipeline.renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      totalTimeSec += dt;
      frameCount++;

      const lp = localPlayerRef.current;
      const curSettings = settingsRef.current;
      if (curSettings.graphicsQuality !== lastQuality) {
        lastQuality = curSettings.graphicsQuality;
        pipeline.setQuality(lastQuality);
      }
      const curLoadout = loadoutRef.current;
      const curBonuses = computeLoadoutBonuses(curLoadout);
      const nextAppearanceKey = `${curLoadout.operatorId}|${curLoadout.weaponId}|${curLoadout.gadgetIds.join(',')}|${curBonuses.droneSupport}`;
      if (nextAppearanceKey !== currentAppearanceKey) {
        currentAppearanceKey = nextAppearanceKey;
        scene.remove(localRig.root);
        localRig.dispose();
        localRig = buildHeroRig(
          {
            operatorId: curLoadout.operatorId,
            weaponId: curLoadout.weaponId,
            gadgetIds: curLoadout.gadgetIds,
            hasDrone: curBonuses.droneSupport,
          },
          textures.shadowDecal
        );
        scene.add(localRig.root);
      }

      if (lp.attackCooldown > 0) lp.attackCooldown--;
      if (lp.dashCooldown > 0) lp.dashCooldown--;
      if (lp.parryCooldown > 0) lp.parryCooldown--;

      if (lp.alive) {
        const isW = keysRef.current['w'] || keysRef.current['space'] || keysRef.current['arrowup'];
        const isS = keysRef.current['s'] || keysRef.current['arrowdown'] || keysRef.current['l'];
        const isA = keysRef.current['a'] || keysRef.current['arrowleft'];
        const isD = keysRef.current['d'] || keysRef.current['arrowright'];
        const isShift = keysRef.current['shift'] || keysRef.current['q'];
        const isAttackKey = keysRef.current['j'] || keysRef.current['k'];

        if (isAttackKey) attackPressed = true;
        if (isShift) dashPressed = true;

        if (isS && lp.parryCooldown === 0 && lp.actionState !== 'PARRYING') {
          lp.actionState = 'PARRYING';
          lp.stateTimer = 18;
          lp.parryCooldown = 42;
          playParry();
          burstPool.spawnBurst(lp.x, lp.y, 0x38bdf8, 8, 3);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pvp:parry' }));
          }
        }

        if (lp.stateTimer > 0) {
          lp.stateTimer--;
          if (lp.stateTimer === 0) lp.actionState = 'IDLE';
        }

        if (lp.actionState !== 'PARRYING') {
          const maxSpeed = 5.8 + (characterClass === 'shadowblade' ? 1.4 : 0) + curBonuses.moveSpeedAdd;
          if (isD) {
            lp.vx += 0.65;
            lp.facing = 'right';
          } else if (isA) {
            lp.vx -= 0.65;
            lp.facing = 'left';
          } else {
            lp.vx *= 0.82;
          }
          if (lp.actionState !== 'DASHING') {
            lp.vx = Math.max(-maxSpeed, Math.min(maxSpeed, lp.vx));
          }
        } else {
          lp.vx *= 0.8;
        }

        if (isW) {
          keysRef.current['w'] = false;
          keysRef.current['space'] = false;
          keysRef.current['arrowup'] = false;
          if (lp.grounded) {
            lp.vy = -12.8;
            lp.grounded = false;
            playJump();
          } else if (lp.doubleJumpsLeft > 0) {
            lp.vy = -11.5;
            lp.doubleJumpsLeft--;
            playJump();
          }
        }

        if (dashPressed && lp.dashCooldown === 0) {
          dashPressed = false;
          if (lp.stamina >= 30) {
            lp.stamina -= 30;
            lp.actionState = 'DASHING';
            lp.stateTimer = 11;
            lp.dashCooldown = Math.max(16, 34 - curBonuses.dashCooldownReduction);
            const dashPow = 16 + (characterClass === 'shadowblade' ? 3 : 0) + curBonuses.moveSpeedAdd;
            lp.vx = lp.facing === 'right' ? dashPow : -dashPow;
            lp.vy = 0;
            playDash();
            dashGhosts.spawn(lp.x, lp.y, lp.facing, 0x22d3ee);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'pvp:dash', facing: lp.facing }));
            }
          }
        } else {
          dashPressed = false;
        }

        if (attackPressed && lp.attackCooldown === 0 && lp.actionState !== 'PARRYING') {
          attackPressed = false;
          lp.actionState = 'ATTACKING';
          lp.stateTimer = 12;
          lp.attackCooldown = Math.max(
            9,
            Math.round(17 * (1 - Math.min(0.45, curBonuses.reloadSpeedBonus)))
          );
          playSlash();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pvp:attack', facing: lp.facing }));
          }
        } else {
          attackPressed = false;
        }

        if (lp.actionState !== 'DASHING') lp.vy += 0.58;
        lp.x += lp.vx;
        lp.y += lp.vy;
        lp.x = Math.max(24, Math.min(ARENA_WIDTH - 24, lp.x));
        lp.stamina = Math.min(100, lp.stamina + 0.55);

        lp.grounded = false;
        ARENA_TERRAIN.forEach((seg) => {
          const pxL = lp.x - lp.width / 2;
          const pxR = lp.x + lp.width / 2;
          const pxB = lp.y + lp.height / 2;
          const pxT = lp.y - lp.height / 2;
          if (pxR > seg.x && pxL < seg.x + seg.width && pxB > seg.y && pxT < seg.y + seg.height) {
            if (lp.vy > 0 && pxB - lp.vy <= seg.y + 8) {
              lp.y = seg.y - lp.height / 2;
              lp.vy = 0;
              lp.grounded = true;
              lp.doubleJumpsLeft =
                (characterClass === 'shadowblade' ? 2 : 1) + curBonuses.doubleJumpAdd;
              if (seg.type === 'SPRING') {
                lp.vy = -17;
                lp.grounded = false;
                playJump();
                burstPool.spawnBurst(lp.x, lp.y + 20, 0x10b981, 10, 3);
              }
            }
          }
        });

        if (lp.stateTimer === 0) {
          if (!lp.grounded) lp.actionState = 'JUMPING';
          else if (Math.abs(lp.vx) > 0.6) lp.actionState = 'RUNNING';
          else lp.actionState = 'IDLE';
        }

        if (frameCount % 2 === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'pvp:move',
              x: lp.x,
              y: lp.y,
              vx: lp.vx,
              vy: lp.vy,
              facing: lp.facing,
              actionState: lp.actionState,
            })
          );
        }
      }

      while (pendingBurstsRef.current.length > 0) {
        const b = pendingBurstsRef.current.shift()!;
        burstPool.spawnBurst(b.x, b.y, b.color, b.count, 5);
      }

      const lpWX = toWorldX(lp.x);
      const lpWY = toWorldY(lp.y);

      worldEnv.updateAtmosphere(curSettings, 0, lpWX, lpWY, totalTimeSec, dt, false);
      terrainRenderer.syncTerrain(ARENA_TERRAIN, [], curSettings.world, false, totalTimeSec);

      localRig.root.visible = lp.alive;
      if (lp.alive) {
        updateHeroRig(
          localRig,
          {
            xPx: lp.x,
            yPx: lp.y,
            vx: lp.vx,
            vy: lp.vy,
            facing: lp.facing,
            grounded: lp.grounded,
            actionState: lp.actionState,
            stateTimer: lp.stateTimer,
            hasDrone: curBonuses.droneSupport,
          },
          totalTimeSec
        );
      }

      // Sync remote 3D players
      const activeRemoteIds = new Set<string>();
      remotePlayersRef.current.forEach((rp) => {
        if (!rp.alive) return;
        activeRemoteIds.add(rp.id);
        let rig = remoteRigs.get(rp.id);
        if (!rig) {
          rig = buildHeroRig(
            {
              operatorId: rp.operatorId || 'op_specter_cyan',
              weaponId: rp.weaponId || 'wpn_carbon_gold_ar',
              gadgetIds: rp.gadgetIds || [],
              hasDrone: Boolean(rp.hasDrone),
            },
            textures.shadowDecal
          );
          scene.add(rig.root);
          remoteRigs.set(rp.id, rig);
        }
        updateHeroRig(
          rig,
          {
            xPx: rp.x,
            yPx: rp.y,
            vx: rp.vx,
            vy: rp.vy,
            facing: rp.facing,
            grounded: rp.y >= 472,
            actionState: rp.actionState,
            stateTimer: 6,
            hasDrone: rp.hasDrone,
          },
          totalTimeSec
        );
      });
      for (const [id, rig] of remoteRigs.entries()) {
        if (!activeRemoteIds.has(id)) {
          scene.remove(rig.root);
          rig.dispose();
          remoteRigs.delete(id);
        }
      }

      const mappedProjectiles: Projectile[] = projectilesRef.current.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        radius: p.radius,
        damage: 10,
        type: p.type,
        owner: 'PLAYER',
        color: p.color,
      }));
      projPool.sync(mappedProjectiles, totalTimeSec);
      dashGhosts.update(dt);
      burstPool.update(dt);

      const targetCamX = Math.max(9, Math.min(ARENA_WIDTH / 28 - 9, lpWX));
      camera.position.x += (targetCamX - camera.position.x) * 0.14;
      camera.position.y += (Math.max(2.6, lpWY + 2.5) - camera.position.y) * 0.12;
      camera.position.z = 16.5;
      camera.lookAt(camera.position.x, Math.max(1.5, lpWY + 1.4), 0);

      pipeline.render(scene, camera);
      animHandle = pipeline.afterDraw(tick);
    };

    animHandle = pipeline.afterDraw(tick);

    return () => {
      disposed = true;
      pipeline.cancelAfterDraw(animHandle);
      resizeObserver.disconnect();
      pipeline.renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      pipeline.renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      for (const rig of remoteRigs.values()) {
        scene.remove(rig.root);
        rig.dispose();
      }
      remoteRigs.clear();
      scene.remove(localRig.root);
      localRig.dispose();
      dashGhosts.dispose();
      projPool.dispose();
      burstPool.dispose();
      terrainRenderer.dispose();
      worldEnv.dispose();
      textures.dispose();
      pipeline.dispose();
    };
  }, [characterClass, playerName]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'pvp:chat', text: trimmed }));
    setChatInput('');
  };

  const activeWorld = WORLD_CONFIGS[settings.world];
  const sortedLeaderboard = [...playersList].sort((a, b) => b.kills - a.kills);
  const localSnap = playersList.find((p) => p.id === selfId);

  return (
    <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
      <div ref={mountRef} className="w-full h-full relative" />

      {/* Top PvP HUD Bar (no backdrop-blur over WebGL) */}
      <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-3 pointer-events-none z-30">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="tac-hud-pod border border-cyan-500/35 rounded-xl px-3.5 py-2.5 flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-white">
                {connected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{activeWorld.arenaName}</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 tabular-nums font-mono">
                {connected
                  ? `${playersList.length} ${playersList.length === 1 ? 'player' : 'players'} online`
                  : reconnecting
                  ? 'Reconnecting...'
                  : 'Connecting...'}
              </div>
            </div>

            {localSnap && (
              <div className="border-l border-zinc-700/80 pl-3 text-xs font-mono tabular-nums">
                <span className="text-emerald-400 font-semibold">{localSnap.kills} K</span>
                <span className="text-zinc-600 mx-1.5">/</span>
                <span className="text-rose-400 font-semibold">{localSnap.deaths} D</span>
              </div>
            )}
          </div>

          <div className="tac-hud-pod flex items-center gap-1 border border-zinc-700/80 rounded-lg p-1">
            <Globe className="w-3.5 h-3.5 text-cyan-400 mx-1.5 shrink-0" />
            {WORLD_LIST.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  playUiClick();
                  onWorldSwitch(w.id);
                }}
                className={`tac-bevel-btn px-2.5 py-1 rounded text-[11px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                  settings.world === w.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {w.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Center Kill Feed */}
        <div className="hidden md:flex flex-col items-center gap-1">
          {playersList.length <= 1 && connected && (
            <div className="tac-hud-pod border border-cyan-500/35 px-3 py-1.5 rounded-lg text-xs text-zinc-200 font-mono">
              3D Global Arena Ready — Share link or open another tab to duel live
            </div>
          )}
          {killFeed.map((entry, idx) => (
            <div
              key={idx}
              className="tac-hud-pod border border-amber-500/40 px-3 py-1 rounded-md text-[11px] text-amber-300 flex items-center gap-1.5 font-mono"
            >
              <Swords className="w-3 h-3" />
              <span>{entry}</span>
            </div>
          ))}
        </div>

        {/* Right Controls & Leaderboard */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="tac-hud-pod flex items-center gap-1.5 border border-zinc-700/80 rounded-lg p-1.5">
            <button
              onClick={() => {
                playUiClick();
                setChatOpen((prev) => !prev);
              }}
              className="tac-bevel-btn px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 hover:border-cyan-400/60 text-zinc-200 text-xs font-display font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => {
                playUiClick();
                onOpenSettings();
              }}
              className="tac-bevel-btn px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 text-zinc-200 text-xs font-display font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-300" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                playUiClick();
                onExit();
              }}
              className="tac-bevel-btn px-2.5 py-1.5 rounded bg-zinc-900 border border-rose-500/40 hover:border-rose-400 text-rose-400 text-xs font-display font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>

          <div className="tac-hud-pod border border-zinc-700/80 rounded-xl p-2.5 min-w-[185px]">
            <div className="flex items-center gap-1.5 text-[11px] font-display uppercase tracking-wider font-semibold text-cyan-300 mb-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Global Fighters</span>
            </div>
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
              {sortedLeaderboard.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs font-mono tabular-nums"
                >
                  <span
                    className={`truncate max-w-[110px] ${
                      p.id === selfId ? 'text-cyan-300 font-semibold' : 'text-zinc-300'
                    }`}
                  >
                    {p.name}
                  </span>
                  <span className="text-zinc-400">{p.kills} K</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Respawn Overlay */}
      {localSnap && !localSnap.alive && (
        <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-20 pointer-events-none">
          <div className="tac-hud-pod border border-rose-500/60 rounded-xl px-6 py-4 text-center">
            <div className="font-display text-lg font-bold uppercase tracking-wider text-rose-400">
              You Were Vanquished
            </div>
            <div className="text-xs text-zinc-300 mt-1 font-mono tabular-nums">
              Respawning in {(localSnap.respawnTimer / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* Global Chat Box */}
      {chatOpen && (
        <div className="tac-hud-pod absolute bottom-3 left-3 w-72 sm:w-80 border border-zinc-700/80 rounded-xl overflow-hidden z-30 flex flex-col">
          <div className="max-h-32 overflow-y-auto p-2.5 flex flex-col gap-1 text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-zinc-500 text-[11px]">No messages yet. Say hello to the arena.</div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className={m.system ? 'text-amber-400/90 italic' : 'text-zinc-200'}>
                  {!m.system && <span className="font-semibold text-cyan-300">{m.senderName}: </span>}
                  <span>{m.text}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendChat} className="flex border-t border-zinc-800">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onFocus={() => {
                isTypingRef.current = true;
              }}
              onBlur={() => {
                isTypingRef.current = false;
              }}
              placeholder="Message global arena..."
              maxLength={160}
              className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              onClick={() => playUiClick()}
              className="px-3 text-amber-400 hover:text-amber-300 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Controls Quick Reference */}
      <div className="hidden md:flex tac-hud-pod absolute bottom-3 right-3 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-400 gap-3 z-20 pointer-events-none">
        <span>A/D Move</span>
        <span>W/Space Jump</span>
        <span>J/LMB Shoot</span>
        <span>K/RMB Slash</span>
        <span>Q/Shift Dash</span>
        <span>S/L Parry</span>
      </div>
    </div>
  );
}
