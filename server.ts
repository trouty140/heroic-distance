import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

type WorldId = 'scifi' | 'medieval' | 'postapoc';
type CharacterClass = 'vanguard' | 'shadowblade' | 'spellweaver';
type OperatorId = 'op_specter_cyan' | 'op_phantom_crimson' | 'op_aegis_gold' | 'op_void_valkyrie';
type WeaponId =
  | 'wpn_carbon_gold_ar'
  | 'wpn_crimson_railcarbine'
  | 'wpn_olive_arc_rifle'
  | 'wpn_mythic_katana'
  | 'wpn_mythic_railblade';
type GadgetId =
  | 'gdg_reactive_armor'
  | 'gdg_quick_mag'
  | 'gdg_combat_drone'
  | 'gdg_kinetic_servo'
  | 'gdg_mythic_wings';
type ActionState = 'IDLE' | 'RUNNING' | 'JUMPING' | 'ATTACKING' | 'DASHING' | 'PARRYING' | 'HIT' | 'DEAD';

interface ServerPlayer {
  id: string;
  name: string;
  characterClass: CharacterClass;
  operatorId: OperatorId;
  weaponId: WeaponId;
  gadgetIds: GadgetId[];
  hasDrone: boolean;
  damageBonus: number;
  critBonus: number;
  attackCooldownMs: number;
  dashCooldownMs: number;
  lifestealPercent: number;
  lastDroneFireAt: number;
  world: WorldId;
  roomId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  actionState: ActionState;
  kills: number;
  deaths: number;
  alive: boolean;
  respawnTimer: number;
  attackCooldownUntil: number;
  dashCooldownUntil: number;
  parryCooldownUntil: number;
  stateExpiresAt: number;
  ws: WebSocket;
}

interface ServerProjectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  type: 'FIREBALL' | 'PLASMA';
}

interface GlobalRoom {
  id: string;
  name: string;
  world: WorldId;
  maxPlayers: number;
  players: Map<string, ServerPlayer>;
  projectiles: ServerProjectile[];
}

const ARENA_WIDTH = 1600;
const GROUND_Y = 500;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 48;

const CLASS_STATS: Record<CharacterClass, { maxHealth: number; maxShield: number; baseDamage: number; critChance: number }> = {
  vanguard: { maxHealth: 150, maxShield: 50, baseDamage: 22, critChance: 0.12 },
  shadowblade: { maxHealth: 105, maxShield: 25, baseDamage: 24, critChance: 0.35 },
  spellweaver: { maxHealth: 120, maxShield: 25, baseDamage: 18, critChance: 0.18 },
};

function sanitizeOperator(op: unknown): OperatorId {
  if (
    op === 'op_specter_cyan' ||
    op === 'op_phantom_crimson' ||
    op === 'op_aegis_gold' ||
    op === 'op_void_valkyrie'
  ) {
    return op;
  }
  return 'op_specter_cyan';
}

function sanitizeWeapon(wpn: unknown): WeaponId {
  if (
    wpn === 'wpn_carbon_gold_ar' ||
    wpn === 'wpn_crimson_railcarbine' ||
    wpn === 'wpn_olive_arc_rifle' ||
    wpn === 'wpn_mythic_katana' ||
    wpn === 'wpn_mythic_railblade'
  ) {
    return wpn;
  }
  return 'wpn_carbon_gold_ar';
}

function sanitizeGadgets(raw: unknown): GadgetId[] {
  if (!Array.isArray(raw)) return ['gdg_reactive_armor'];
  const valid: GadgetId[] = [];
  for (const item of raw) {
    if (
      (item === 'gdg_reactive_armor' ||
        item === 'gdg_quick_mag' ||
        item === 'gdg_combat_drone' ||
        item === 'gdg_kinetic_servo' ||
        item === 'gdg_mythic_wings') &&
      !valid.includes(item)
    ) {
      valid.push(item);
      if (valid.length === 2) break;
    }
  }
  return valid;
}

function computePvpLoadoutStats(
  characterClass: CharacterClass,
  operatorId: OperatorId,
  weaponId: WeaponId,
  gadgetIds: GadgetId[]
) {
  const base = CLASS_STATS[characterClass];
  let maxHpAdd = 0;
  let maxShieldAdd = 0;
  let damageBonus = 0;
  let critBonus = 0;
  let reloadBonus = 0;
  let dashReductionMs = 0;
  let lifestealPercent = 0;
  let hasDrone = false;

  if (operatorId === 'op_specter_cyan') {
    maxHpAdd += 25;
    maxShieldAdd += 20;
    reloadBonus += 0.1;
  } else if (operatorId === 'op_phantom_crimson') {
    critBonus += 0.14;
    dashReductionMs += 60;
  } else if (operatorId === 'op_aegis_gold') {
    maxHpAdd += 45;
    maxShieldAdd += 30;
    damageBonus += 8;
  } else if (operatorId === 'op_void_valkyrie') {
    maxHpAdd += 55;
    maxShieldAdd += 40;
    damageBonus += 12;
    critBonus += 0.12;
  }

  if (weaponId === 'wpn_carbon_gold_ar') {
    damageBonus += 6;
    critBonus += 0.08;
  } else if (weaponId === 'wpn_crimson_railcarbine') {
    damageBonus += 10;
    reloadBonus += 0.15;
    critBonus += 0.12;
  } else if (weaponId === 'wpn_olive_arc_rifle') {
    damageBonus += 14;
    critBonus += 0.16;
    reloadBonus += 0.12;
  } else if (weaponId === 'wpn_mythic_katana') {
    damageBonus += 18;
    critBonus += 0.22;
    lifestealPercent += 0.08;
  } else if (weaponId === 'wpn_mythic_railblade') {
    damageBonus += 22;
    critBonus += 0.18;
    reloadBonus += 0.18;
  }

  for (const g of gadgetIds) {
    if (g === 'gdg_reactive_armor') {
      maxHpAdd += 40;
      maxShieldAdd += 25;
    } else if (g === 'gdg_quick_mag') {
      reloadBonus += 0.22;
      dashReductionMs += 120;
    } else if (g === 'gdg_combat_drone') {
      hasDrone = true;
      critBonus += 0.06;
    } else if (g === 'gdg_kinetic_servo') {
      lifestealPercent += 0.08;
    } else if (g === 'gdg_mythic_wings') {
      damageBonus += 10;
    }
  }

  return {
    maxHealth: base.maxHealth + maxHpAdd,
    maxShield: base.maxShield + maxShieldAdd,
    damageBonus,
    critBonus,
    attackCooldownMs: Math.max(150, Math.round(280 * (1 - Math.min(0.45, reloadBonus)))),
    dashCooldownMs: Math.max(320, 550 - dashReductionMs),
    lifestealPercent,
    hasDrone,
  };
}

const rooms: Map<WorldId, GlobalRoom> = new Map([
  [
    'scifi',
    {
      id: 'global-scifi',
      name: 'Nexus Biolume Basin',
      world: 'scifi',
      maxPlayers: 16,
      players: new Map(),
      projectiles: [],
    },
  ],
  [
    'medieval',
    {
      id: 'global-medieval',
      name: 'Frostpeak Keep',
      world: 'medieval',
      maxPlayers: 16,
      players: new Map(),
      projectiles: [],
    },
  ],
  [
    'postapoc',
    {
      id: 'global-postapoc',
      name: 'Sunbeam Overpass',
      world: 'postapoc',
      maxPlayers: 16,
      players: new Map(),
      projectiles: [],
    },
  ],
]);

function sanitizeWorld(world: unknown): WorldId {
  if (world === 'scifi' || world === 'medieval' || world === 'postapoc') {
    return world;
  }
  return 'scifi';
}

function sanitizeClass(cls: unknown): CharacterClass {
  if (cls === 'vanguard' || cls === 'shadowblade' || cls === 'spellweaver') {
    return cls;
  }
  return 'vanguard';
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Wanderer';
  const cleaned = name.replace(/[^\w\s-]/g, '').trim().slice(0, 18);
  return cleaned || 'Wanderer';
}

function randomSpawnX(): number {
  return 160 + Math.random() * (ARENA_WIDTH - 320);
}

function serializePlayer(p: ServerPlayer) {
  return {
    id: p.id,
    name: p.name,
    characterClass: p.characterClass,
    operatorId: p.operatorId,
    weaponId: p.weaponId,
    hasDrone: p.hasDrone,
    world: p.world,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    facing: p.facing,
    health: p.health,
    maxHealth: p.maxHealth,
    shield: p.shield,
    maxShield: p.maxShield,
    actionState: p.actionState,
    kills: p.kills,
    deaths: p.deaths,
    alive: p.alive,
    respawnTimer: p.respawnTimer,
  };
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: GlobalRoom, payload: unknown) {
  const serialized = JSON.stringify(payload);
  room.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(serialized);
    }
  });
}

function broadcastRoomState(room: GlobalRoom) {
  broadcastRoom(room, {
    type: 'pvp:state',
    roomId: room.id,
    world: room.world,
    players: Array.from(room.players.values()).map(serializePlayer),
    projectiles: room.projectiles,
  });
}

function broadcastSystemChat(room: GlobalRoom, text: string) {
  broadcastRoom(room, {
    type: 'pvp:chat',
    message: {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: 'system',
      senderName: 'Arena',
      text,
      timestamp: Date.now(),
      system: true,
    },
  });
}

function applyDamage(
  room: GlobalRoom,
  attacker: ServerPlayer,
  target: ServerPlayer,
  rawDamage: number,
  isCrit: boolean
) {
  const now = Date.now();
  if (!target.alive) return;

  if (target.actionState === 'DASHING') {
    broadcastRoom(room, {
      type: 'pvp:event',
      event: {
        type: 'dodge',
        attackerId: attacker.id,
        targetId: target.id,
        x: target.x,
        y: target.y,
      },
    });
    return;
  }

  if (target.actionState === 'PARRYING') {
    attacker.actionState = 'HIT';
    attacker.stateExpiresAt = now + 350;
    broadcastRoom(room, {
      type: 'pvp:event',
      event: {
        type: 'parry',
        attackerId: attacker.id,
        targetId: target.id,
        x: target.x,
        y: target.y,
      },
    });
    return;
  }

  let remaining = rawDamage;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }

  if (remaining > 0) {
    target.health = Math.max(0, target.health - remaining);
    target.actionState = 'HIT';
    target.stateExpiresAt = now + 220;
  }

  if (attacker.lifestealPercent > 0 && attacker.alive) {
    attacker.health = Math.min(attacker.maxHealth, attacker.health + rawDamage * attacker.lifestealPercent);
  }

  broadcastRoom(room, {
    type: 'pvp:event',
    event: {
      type: 'hit',
      attackerId: attacker.id,
      targetId: target.id,
      x: target.x,
      y: target.y,
      damage: Math.round(rawDamage),
      crit: isCrit,
    },
  });

  if (target.health <= 0) {
    target.alive = false;
    target.actionState = 'DEAD';
    target.deaths += 1;
    target.respawnTimer = 3000;
    attacker.kills += 1;

    broadcastRoom(room, {
      type: 'pvp:event',
      event: {
        type: 'kill',
        attackerId: attacker.id,
        targetId: target.id,
        x: target.x,
        y: target.y,
      },
    });
    broadcastSystemChat(room, `${attacker.name} vanquished ${target.name}!`);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 30-Minute Expiring Private Access Link Store (HMAC-signed + server-tracked TTL)
  const INVITE_TTL_MS = 30 * 60 * 1000;
  const inviteSecret = process.env.INVITE_SECRET || crypto.randomBytes(32).toString('hex');
  interface PrivateInviteRecord {
    id: string;
    token: string;
    createdAt: number;
    expiresAt: number;
    revoked: boolean;
  }
  const privateInvites = new Map<string, PrivateInviteRecord>();

  const pruneExpiredInvites = () => {
    const now = Date.now();
    for (const [id, rec] of privateInvites.entries()) {
      if (rec.revoked || rec.expiresAt <= now) {
        privateInvites.delete(id);
      }
    }
  };

  const signInvitePayload = (id: string, expiresAt: number): string => {
    const sig = crypto
      .createHmac('sha256', inviteSecret)
      .update(`${id}.${expiresAt}`)
      .digest('base64url');
    return `${id}.${expiresAt}.${sig}`;
  };

  const verifyInviteToken = (
    rawToken: unknown
  ): { valid: true; record: PrivateInviteRecord; remainingSeconds: number } | { valid: false; reason: string } => {
    if (typeof rawToken !== 'string' || !rawToken.includes('.')) {
      return { valid: false, reason: 'Invalid private invite token.' };
    }
    const parts = rawToken.trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Malformed invite token.' };
    }
    const [id, expStr, providedSig] = parts;
    const expiresAt = Number(expStr);
    if (!id || !Number.isFinite(expiresAt)) {
      return { valid: false, reason: 'Malformed invite payload.' };
    }
    const expectedSig = crypto
      .createHmac('sha256', inviteSecret)
      .update(`${id}.${expiresAt}`)
      .digest('base64url');
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Invite signature mismatch.' };
    }
    const rec = privateInvites.get(id);
    if (!rec || rec.revoked) {
      return { valid: false, reason: 'Private invite has been revoked or expired.' };
    }
    const remainingMs = rec.expiresAt - Date.now();
    if (remainingMs <= 0) {
      privateInvites.delete(id);
      return { valid: false, reason: 'This 30-minute private link has expired.' };
    }
    return {
      valid: true,
      record: rec,
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  };

  const parseCookieToken = (cookieHeader: string | undefined): string | null => {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'hd_guest_invite') {
        try {
          return decodeURIComponent(rest.join('='));
        } catch {
          return rest.join('=');
        }
      }
    }
    return null;
  };

  app.post('/api/private-links', (_req, res) => {
    pruneExpiredInvites();
    const id = crypto.randomBytes(8).toString('hex');
    const createdAt = Date.now();
    const expiresAt = createdAt + INVITE_TTL_MS;
    const token = signInvitePayload(id, expiresAt);
    const record: PrivateInviteRecord = {
      id,
      token,
      createdAt,
      expiresAt,
      revoked: false,
    };
    privateInvites.set(id, record);
    res.json({
      id,
      token,
      createdAt,
      expiresAt,
      ttlSeconds: Math.floor(INVITE_TTL_MS / 1000),
      invitePath: `/invite/${token}`,
    });
  });

  app.get('/api/private-links', (_req, res) => {
    pruneExpiredInvites();
    const now = Date.now();
    const links = Array.from(privateInvites.values())
      .filter((rec) => !rec.revoked && rec.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((rec) => ({
        id: rec.id,
        token: rec.token,
        createdAt: rec.createdAt,
        expiresAt: rec.expiresAt,
        remainingSeconds: Math.max(0, Math.ceil((rec.expiresAt - now) / 1000)),
        invitePath: `/invite/${rec.token}`,
      }));
    res.json({ links });
  });

  app.get('/api/private-links/verify', (req, res) => {
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const cookieToken = parseCookieToken(req.headers.cookie);
    const check = verifyInviteToken(queryToken || cookieToken);
    if (check.valid === false) {
      res.status(410).json({ valid: false, reason: check.reason });
      return;
    }
    res.json({
      valid: true,
      id: check.record.id,
      expiresAt: check.record.expiresAt,
      remainingSeconds: check.remainingSeconds,
    });
  });

  app.delete('/api/private-links/:id', (req, res) => {
    const rec = privateInvites.get(req.params.id);
    if (rec) {
      rec.revoked = true;
      privateInvites.delete(req.params.id);
    }
    res.json({ ok: true });
  });

  app.get('/invite/:token', (req, res) => {
    const check = verifyInviteToken(req.params.token);
    if (check.valid === false) {
      res.status(410).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Private Invite Expired · Heroic Distance</title>
    <style>
      body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#090b10; color:#e4e4e7; font-family:system-ui,sans-serif; padding:24px; }
      .card { max-width:440px; width:100%; background:#0f141e; border:1px solid rgba(239,68,68,0.55); border-radius:16px; padding:28px; box-shadow:0 20px 50px rgba(0,0,0,0.75); text-align:center; }
      .tag { display:inline-block; font-size:11px; font-family:monospace; letter-spacing:0.18em; text-transform:uppercase; color:#fca5a5; background:rgba(127,29,29,0.45); border:1px solid rgba(248,113,113,0.4); padding:4px 10px; border-radius:6px; margin-bottom:14px; }
      h1 { margin:0 0 10px; font-size:22px; color:#fff; letter-spacing:0.04em; text-transform:uppercase; }
      p { margin:0; font-size:14px; line-height:1.5; color:#a1a1aa; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="tag">Access Revoked / Expired</div>
      <h1>Private Link Expired</h1>
      <p>${check.reason} Ask the host to generate a fresh 30-minute private invite link.</p>
    </div>
  </body>
</html>`);
      return;
    }

    res.setHeader(
      'Set-Cookie',
      `hd_guest_invite=${encodeURIComponent(check.record.token)}; Path=/; Max-Age=${check.remainingSeconds}; HttpOnly; SameSite=Lax`
    );
    res.redirect(302, `/?guest_invite=${encodeURIComponent(check.record.token)}`);
  });

  app.get('/api/pvp/rooms', (_req, res) => {
    const summary = Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      world: room.world,
      playerCount: room.players.size,
      maxPlayers: room.maxPlayers,
    }));
    res.json({ rooms: summary });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url && request.url.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (process.env.NODE_ENV === 'production') {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    let currentPlayer: ServerPlayer | null = null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;
      const now = Date.now();

      if (type === 'pvp:join') {
        const world = sanitizeWorld(msg.world);
        const characterClass = sanitizeClass(msg.characterClass);
        const operatorId = sanitizeOperator(msg.operatorId);
        const weaponId = sanitizeWeapon(msg.weaponId);
        const gadgetIds = sanitizeGadgets(msg.gadgetIds);
        const name = sanitizeName(msg.name);
        const room = rooms.get(world)!;

        if (currentPlayer) {
          const oldRoom = rooms.get(currentPlayer.world);
          oldRoom?.players.delete(currentPlayer.id);
          if (oldRoom) broadcastRoomState(oldRoom);
        }

        const loadoutStats = computePvpLoadoutStats(characterClass, operatorId, weaponId, gadgetIds);
        const spawnX = randomSpawnX();
        currentPlayer = {
          id: playerId,
          name,
          characterClass,
          operatorId,
          weaponId,
          gadgetIds,
          hasDrone: loadoutStats.hasDrone,
          damageBonus: loadoutStats.damageBonus,
          critBonus: loadoutStats.critBonus,
          attackCooldownMs: loadoutStats.attackCooldownMs,
          dashCooldownMs: loadoutStats.dashCooldownMs,
          lifestealPercent: loadoutStats.lifestealPercent,
          lastDroneFireAt: 0,
          world,
          roomId: room.id,
          x: spawnX,
          y: GROUND_Y - PLAYER_HEIGHT / 2,
          vx: 0,
          vy: 0,
          facing: 'right',
          health: loadoutStats.maxHealth,
          maxHealth: loadoutStats.maxHealth,
          shield: loadoutStats.maxShield,
          maxShield: loadoutStats.maxShield,
          actionState: 'IDLE',
          kills: 0,
          deaths: 0,
          alive: true,
          respawnTimer: 0,
          attackCooldownUntil: 0,
          dashCooldownUntil: 0,
          parryCooldownUntil: 0,
          stateExpiresAt: 0,
          ws,
        };

        room.players.set(playerId, currentPlayer);

        sendJson(ws, {
          type: 'pvp:init',
          selfId: playerId,
          roomId: room.id,
          world: room.world,
          players: Array.from(room.players.values()).map(serializePlayer),
          projectiles: room.projectiles,
        });

        broadcastSystemChat(room, `${name} entered ${room.name}.`);
        broadcastRoomState(room);
        return;
      }

      if (!currentPlayer) return;
      const room = rooms.get(currentPlayer.world);
      if (!room) return;

      if (type === 'pvp:switch_world') {
        const nextWorld = sanitizeWorld(msg.world);
        if (nextWorld === currentPlayer.world) return;

        room.players.delete(currentPlayer.id);
        broadcastSystemChat(room, `${currentPlayer.name} warped to another realm.`);
        broadcastRoomState(room);

        const nextRoom = rooms.get(nextWorld)!;
        currentPlayer.world = nextWorld;
        currentPlayer.roomId = nextRoom.id;
        currentPlayer.x = randomSpawnX();
        currentPlayer.y = GROUND_Y - PLAYER_HEIGHT / 2;
        currentPlayer.vx = 0;
        currentPlayer.vy = 0;
        currentPlayer.health = currentPlayer.maxHealth;
        currentPlayer.shield = currentPlayer.maxShield;
        currentPlayer.alive = true;
        currentPlayer.actionState = 'IDLE';

        nextRoom.players.set(currentPlayer.id, currentPlayer);
        sendJson(ws, {
          type: 'pvp:init',
          selfId: currentPlayer.id,
          roomId: nextRoom.id,
          world: nextRoom.world,
          players: Array.from(nextRoom.players.values()).map(serializePlayer),
          projectiles: nextRoom.projectiles,
        });
        broadcastSystemChat(nextRoom, `${currentPlayer.name} entered ${nextRoom.name}.`);
        broadcastRoomState(nextRoom);
        return;
      }

      if (type === 'pvp:move' && currentPlayer.alive) {
        const nx = typeof msg.x === 'number' && Number.isFinite(msg.x) ? msg.x : currentPlayer.x;
        const ny = typeof msg.y === 'number' && Number.isFinite(msg.y) ? msg.y : currentPlayer.y;
        const nvx = typeof msg.vx === 'number' && Number.isFinite(msg.vx) ? msg.vx : 0;
        const nvy = typeof msg.vy === 'number' && Number.isFinite(msg.vy) ? msg.vy : 0;
        currentPlayer.x = Math.max(24, Math.min(ARENA_WIDTH - 24, nx));
        currentPlayer.y = Math.max(24, Math.min(560, ny));
        currentPlayer.vx = Math.max(-25, Math.min(25, nvx));
        currentPlayer.vy = Math.max(-25, Math.min(25, nvy));
        currentPlayer.facing = msg.facing === 'left' ? 'left' : 'right';

        if (
          now > currentPlayer.stateExpiresAt &&
          (msg.actionState === 'IDLE' || msg.actionState === 'RUNNING' || msg.actionState === 'JUMPING')
        ) {
          currentPlayer.actionState = msg.actionState;
        }
        return;
      }

      if (type === 'pvp:dash' && currentPlayer.alive) {
        if (now < currentPlayer.dashCooldownUntil) return;
        currentPlayer.facing = msg.facing === 'left' ? 'left' : 'right';
        currentPlayer.actionState = 'DASHING';
        currentPlayer.stateExpiresAt = now + 220;
        currentPlayer.dashCooldownUntil = now + currentPlayer.dashCooldownMs;
        broadcastRoom(room, {
          type: 'pvp:event',
          event: {
            type: 'dash',
            attackerId: currentPlayer.id,
            x: currentPlayer.x,
            y: currentPlayer.y,
          },
        });
        return;
      }

      if (type === 'pvp:parry' && currentPlayer.alive) {
        if (now < currentPlayer.parryCooldownUntil) return;
        currentPlayer.actionState = 'PARRYING';
        currentPlayer.stateExpiresAt = now + 320;
        currentPlayer.parryCooldownUntil = now + 700;
        return;
      }

      if (type === 'pvp:attack' && currentPlayer.alive) {
        if (now < currentPlayer.attackCooldownUntil || currentPlayer.actionState === 'PARRYING') return;
        currentPlayer.facing = msg.facing === 'left' ? 'left' : 'right';
        currentPlayer.actionState = 'ATTACKING';
        currentPlayer.stateExpiresAt = now + 220;
        currentPlayer.attackCooldownUntil = now + currentPlayer.attackCooldownMs;

        broadcastRoom(room, {
          type: 'pvp:event',
          event: {
            type: 'attack',
            attackerId: currentPlayer.id,
            x: currentPlayer.x,
            y: currentPlayer.y,
          },
        });

        const isRight = currentPlayer.facing === 'right';
        const swordReach = 68;
        const swordHeight = 56;
        const reachX = isRight ? currentPlayer.x : currentPlayer.x - swordReach;
        const reachY = currentPlayer.y - swordHeight / 2;
        const stats = CLASS_STATS[currentPlayer.characterClass];

        room.players.forEach((target) => {
          if (target.id === currentPlayer!.id || !target.alive) return;
          const overlaps =
            reachX + swordReach > target.x - PLAYER_WIDTH / 2 &&
            reachX < target.x + PLAYER_WIDTH / 2 &&
            reachY + swordHeight > target.y - PLAYER_HEIGHT / 2 &&
            reachY < target.y + PLAYER_HEIGHT / 2;

          if (overlaps) {
            const isCrit = Math.random() < Math.min(0.65, stats.critChance + currentPlayer!.critBonus);
            const dmg = (stats.baseDamage + currentPlayer!.damageBonus) * (isCrit ? 1.7 : 1);
            applyDamage(room, currentPlayer!, target, dmg, isCrit);
          }
        });

        const shotColor =
          currentPlayer.weaponId === 'wpn_crimson_railcarbine'
            ? '#ef4444'
            : currentPlayer.weaponId === 'wpn_olive_arc_rifle'
            ? '#38bdf8'
            : '#06b6d4';

        room.projectiles.push({
          id: `pvp_proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId: currentPlayer.id,
          x: currentPlayer.x + (isRight ? 20 : -20),
          y: currentPlayer.y - 3,
          vx: isRight ? 14 : -14,
          vy: currentPlayer.characterClass === 'spellweaver' ? -0.4 : 0,
          radius: currentPlayer.characterClass === 'spellweaver' ? 9 : 6,
          damage: 11 + Math.round(currentPlayer.damageBonus * 0.45),
          color: currentPlayer.characterClass === 'spellweaver' ? '#f97316' : shotColor,
          type: currentPlayer.characterClass === 'spellweaver' ? 'FIREBALL' : 'PLASMA',
        });
        return;
      }

      if (type === 'pvp:chat') {
        if (typeof msg.text !== 'string') return;
        const clean = msg.text.trim().slice(0, 160);
        if (!clean) return;
        broadcastRoom(room, {
          type: 'pvp:chat',
          message: {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            senderId: currentPlayer.id,
            senderName: currentPlayer.name,
            text: clean,
            timestamp: Date.now(),
          },
        });
      }
    });

    ws.on('close', () => {
      if (!currentPlayer) return;
      const room = rooms.get(currentPlayer.world);
      if (!room) return;
      room.players.delete(currentPlayer.id);
      broadcastSystemChat(room, `${currentPlayer.name} left the arena.`);
      broadcastRoomState(room);
    });
  });

  // Authoritative 30Hz PvP simulation tick
  setInterval(() => {
    const now = Date.now();
    rooms.forEach((room) => {
      if (room.players.size === 0) {
        room.projectiles = [];
        return;
      }

      room.players.forEach((player) => {
        if (!player.alive) {
          player.respawnTimer = Math.max(0, player.respawnTimer - 33);
          if (player.respawnTimer === 0) {
            player.alive = true;
            player.health = player.maxHealth;
            player.shield = player.maxShield;
            player.x = randomSpawnX();
            player.y = GROUND_Y - PLAYER_HEIGHT / 2;
            player.vx = 0;
            player.vy = 0;
            player.actionState = 'IDLE';
          }
        } else {
          if (
            now > player.stateExpiresAt &&
            (player.actionState === 'ATTACKING' ||
              player.actionState === 'DASHING' ||
              player.actionState === 'PARRYING' ||
              player.actionState === 'HIT')
          ) {
            player.actionState = 'IDLE';
          }
          // Subtle shield regen out of combat
          if (player.shield < player.maxShield) {
            player.shield = Math.min(player.maxShield, player.shield + 0.05);
          }

          // Server-authoritative Combat Drone auto-fire in PvP
          if (player.hasDrone && now - player.lastDroneFireAt > 2100) {
            let nearestTarget: ServerPlayer | null = null;
            let bestDist = 360;
            room.players.forEach((other) => {
              if (other.id === player.id || !other.alive) return;
              const d = Math.hypot(other.x - player.x, other.y - player.y);
              if (d < bestDist) {
                bestDist = d;
                nearestTarget = other;
              }
            });
            if (nearestTarget) {
              const targetRef = nearestTarget as ServerPlayer;
              const dx = targetRef.x - player.x;
              const dy = targetRef.y - (player.y - 26);
              const mag = Math.max(1, Math.hypot(dx, dy));
              player.lastDroneFireAt = now;
              room.projectiles.push({
                id: `pvp_drone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                ownerId: player.id,
                x: player.x,
                y: player.y - 26,
                vx: (dx / mag) * 13,
                vy: (dy / mag) * 13,
                radius: 5,
                damage: 10,
                color: '#22d3ee',
                type: 'PLASMA',
              });
            }
          }
        }
      });

      const survivingProjectiles: ServerProjectile[] = [];
      for (const proj of room.projectiles) {
        proj.x += proj.vx;
        proj.y += proj.vy;
        if (proj.x < -50 || proj.x > ARENA_WIDTH + 50 || proj.y < -50 || proj.y > 650) {
          continue;
        }

        let consumed = false;
        const attacker = room.players.get(proj.ownerId);

        for (const target of room.players.values()) {
          if (target.id === proj.ownerId || !target.alive) continue;
          const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
          if (dist < proj.radius + 18) {
            if (target.actionState === 'PARRYING') {
              proj.ownerId = target.id;
              proj.vx = -proj.vx * 1.35;
              proj.color = '#38bdf8';
              proj.type = 'PLASMA';
              broadcastRoom(room, {
                type: 'pvp:event',
                event: {
                  type: 'parry',
                  attackerId: proj.ownerId,
                  targetId: target.id,
                  x: target.x,
                  y: target.y,
                },
              });
            } else {
              if (attacker) {
                applyDamage(room, attacker, target, proj.damage, false);
              }
              consumed = true;
            }
            break;
          }
        }

        if (!consumed) {
          survivingProjectiles.push(proj);
        }
      }
      room.projectiles = survivingProjectiles;

      broadcastRoomState(room);
    });
  }, 33);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
