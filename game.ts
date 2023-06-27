import { WebEngineAPI, webEngine } from "sprig/web";
import {
  fbNew,
  fbGetRender,
  fbClearColor,
  fbRender,
  mat4Identity,
  mat4Translate,
  mat4Scale,
  mat4Rotate,
  Vec3,
  Framebuffer,
  Color,
  vecMulScalar,
  vecDistance,
  vecSubVec,
  vecAddVec,
  vecNormalize,
  vec3CrossProduct,
  fbClearDepth,
  vecLength,
  vecDot,
  RenderPass,
} from "./graphics";
import { verticesBobPerson, verticesCube } from "./models";
import {
  soundPickUp,
  soundExplosion,
  soundPew,
  soundDeath,
  soundEnemyAttack,
  soundStageUp,
  soundSettingChange,
  soundMenuMusic,
} from "./sounds";

//
//   ____    _____   _____
// /\  _`\ /\  __`\/\  __`\  /'\_/`\
// \ \ \L\ \ \ \/\ \ \ \/\ \/\      \
//  \ \ ,  /\ \ \ \ \ \ \ \ \ \ \__\ \
//   \ \ \\ \\ \ \_\ \ \ \_\ \ \ \_/\ \
//    \ \_\ \_\ \_____\ \_____\ \_\\ \_\
//     \/_/\/ /\/_____/\/_____/\/_/ \/_/
//
// This is ROOM, a DOOM inspired 3D [pew pew]-er, built for the sprig.
//
// /   w   [oooo]   i   \
// \ a s d [oooo] j k l /
//
// w = Forward      i = Pew Pew
// s = Go Left      j = Look Left
// d = Go Right     l = Look Right
// a = Backward     k = Look Behind
//
// Trapped in a claustrophobic room, you must survive for as long as possible.
// Your health slowly drains, so you must run around and collect medkits.
// Be sure to avoid the spin-y people.
// They are not your friend.
//
// Hey, why does this code look weird?
// Well, ROOM was written in typescript and compiled into javascript.
// The original source is at https://github.com/davnotdev/Room.
//
// Want to edit the game?
// Go ahead! 
// Game logic is in the game.ts section.
// You can create your own models in the models.ts section.
// Sounds are at the very bottom.
// If you touch graphics.ts, try not to freeze the game!
//

// -- Framebuffer Globals --

var api: WebEngineAPI;

const FPS = 24;
var tileXCount = 0;
var tileYCount = 0;

const RES_LEVELS = [
  [1, 1],
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
  [4, 4],
  [5, 4],
  [6, 6],
  [8, 8],
  [10, 8],
  [20, 16],
];
var selectedResLevel = 6;

var fb: Framebuffer;
recreateFramebuffer();

// -- Bullet Globals --

const BULLET_DAMAGE = 40;
const BULLET_COOLDOWN_THRESHOLD = 0.12;
const BULLET_MAX_DISTANCE = 40;
const BULLET_SPEED = 2.5;

interface Bullet {
  origin: Vec3;
  position: Vec3;
  direction: Vec3;
}
var bullets: Bullet[] = [];

// -- Player Globals --

const PLAYER_MAX_HEALTH = 50;
const PLAYER_POISON_TICK = 0.01;
const PLAYER_MAX_VELOCITY = 0.65;
const PLAYER_FRICTION_SCALAR = 0.006;
const PLAYER_WALL_BOUNCE_SCALAR = 0.8;
const PLAYER_ACCELERATION = 0.13;

interface Player {
  position: Vec3;
  velocity: Vec3;
  direction: Vec3;
  health: number;
  bobTick: number;
  yaw: number;
  lastBulletTime: number;
}
var player: Player;
var playerDead: boolean = false;

const MEDKIT_HEAL_AMOUNT = 18;
const MEDKIT_PLAYER_SPAWN_MIN_RADIUS = 40;
const MEDKIT_PLAYER_SPAWN_MAX_RADIUS = 200;
const MEDKIT_PICKUP_RANGE = 5;
const MEDKIT_POPUP_RISE_SPEED = 0.3;
const MEDKIT_POPUP_MAX_HEIGHT = 4;

interface Medkit {
  position: Vec3;
}
var medkit: Medkit | null = null;

interface MedkitHealPopup {
  y: number;
}
var medkitHealPopups: MedkitHealPopup[] = [];

// -- Enemy Globals --

const ENEMY_DAMAGE = 0.2;
const ENEMY_MAX_DODGE = 0.3;
const ENEMY_REACH = 1.8;
const ENEMY_SPEED_INCREMENT_SCALAR = 0.0006;
const ENEMY_PLAYER_SPAWN_MIN_RADIUS = 60;
const ENEMY_PLAYER_SPAWN_MAX_RADIUS = 350;

interface Enemy {
  speed: number;
  health: number;
  color: number;
  position: Vec3;
  dodgeEntropy: number;
}
var enemies: Enemy[] = [];

// -- Stage Globals --

const ENEMY_CAP_STAGES = [3, 5, 8, 20, 30, 40, 9999];
const ENEMY_SPAWN_FREQUENCY_STAGES = [0.03, 0.1, 0.15, 0.3, 0.4, 0.5, 10];
const KILL_SCREEN_STAGE = 6;

function getStageNumber() {
  if (startTime <= 20) {
    return 0;
  } else if (startTime <= 100) {
    return 1;
  } else if (startTime <= 200) {
    return 2;
  } else if (startTime <= 300) {
    return 3;
  } else if (startTime <= 400) {
    return 4;
  } else if (startTime <= 999) {
    return 5;
  } else {
    return KILL_SCREEN_STAGE;
  }
}

// -- Explosion Globals --

const EXPLOSION_MAX_SIZE = 2.0;
const EXPLOSION_GROWTH_INCREMENT = 0.3;

interface Explosion {
  position: Vec3;
  sizeScalar: number;
}
var explosions: Explosion[] = [];

// -- Map Settings --

interface MapSetting {
  name: string;
  bound: number;
  wallCount: number;
  wallMaxScale: number;
}

const MAP_SETTINGS: MapSetting[] = [
  {
    name: "SS ",
    bound: 60,
    wallCount: 12,
    wallMaxScale: 4,
  },
  {
    name: " S ",
    bound: 75,
    wallCount: 24,
    wallMaxScale: 4,
  },
  {
    name: " M ",
    bound: 85,
    wallCount: 30,
    wallMaxScale: 5,
  },
  {
    name: " L ",
    bound: 100,
    wallCount: 40,
    wallMaxScale: 7,
  },
  {
    name: "XL ",
    bound: 150,
    wallCount: 110,

    wallMaxScale: 8,
  },
  {
    name: "XXL",
    bound: 500,
    wallCount: 1300,
    wallMaxScale: 12,
  },
  {
    name: "XXX",
    bound: 800,
    wallCount: 2500,
    wallMaxScale: 12,
  },
];
var selectedMapSetting = 2;

const MAP_WALL_Y = 6;
const MAP_WALL_TO_WALL_MIN_DISTANCE = 20;

interface Wall {
  scale: Vec3;
  position: Vec3;
  color: Color;
}
var walls: Wall[] = [];

function incMapSetting() {
  api.playTune(soundSettingChange());
  selectedMapSetting += 1;
  if (selectedMapSetting >= MAP_SETTINGS.length)
    selectedMapSetting = MAP_SETTINGS.length - 1;
}

function decMapSetting() {
  api.playTune(soundSettingChange());
  selectedMapSetting -= 1;
  if (selectedMapSetting < 0) selectedMapSetting = 0;
}

// -- Game State --

enum GameState {
  MENU,
  PLAY,
}

var gameState = GameState.MENU;
let startTime = 0;

// -- Spawn Functions --

function spawnWalls() {
  let settings = MAP_SETTINGS[selectedMapSetting];

  let north = {
    scale: [1, MAP_WALL_Y, settings.bound] as Vec3,
    position: [settings.bound, 0, 0] as Vec3,
    color: "1",
  };
  let south = {
    scale: [1, MAP_WALL_Y, settings.bound] as Vec3,
    position: [-settings.bound, 0, 0] as Vec3,
    color: "1",
  };
  let west = {
    scale: [settings.bound, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, settings.bound] as Vec3,
    color: "1",
  };
  let east = {
    scale: [settings.bound, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, -settings.bound] as Vec3,
    color: "1",
  };

  walls.push(north);
  walls.push(south);
  walls.push(west);
  walls.push(east);

  for (let i = 0; i < settings.wallCount; i++) {
    let scaleX = Math.random() * settings.wallMaxScale + 3;
    let scaleZ = Math.random() * settings.wallMaxScale + 3;
    let positionX = Math.random() * (settings.bound - 2) * 2 - settings.bound;
    let positionZ = Math.random() * (settings.bound - 2) * 2 - settings.bound;

    let failedWall = false;
    for (let wi in walls) {
      let other = walls[wi];
      if (
        vecDistance(
          [other.position[0], 0, other.position[2]],
          [positionX, 0, positionZ]
        ) < MAP_WALL_TO_WALL_MIN_DISTANCE
      ) {
        failedWall = true;
        break;
      }
    }

    if (
      Math.abs(positionX) < settings.wallMaxScale + 4 ||
      Math.abs(positionZ) < settings.wallMaxScale + 4
    ) {
      failedWall = true;
    }

    if (
      settings.bound - Math.abs(positionX) < 18 ||
      settings.bound - Math.abs(positionZ) < 18
    ) {
      failedWall = true;
    }

    if (failedWall) {
      i--;
      continue;
    }

    let wall = {
      scale: [scaleX, MAP_WALL_Y, scaleZ] as Vec3,
      position: [positionX, 0, positionZ] as Vec3,
      color: "1",
    };
    walls.push(wall);
  }
}

function spawnMedkit(argPositionX: number | null, argPositionZ: number | null) {
  let finalPositionX = argPositionX;
  let finalPositionZ = argPositionZ;
  if (argPositionX == null && argPositionZ == null) {
    let mapSetting = MAP_SETTINGS[selectedMapSetting];
    while (true) {
      let positionX = Math.random() * mapSetting.bound * 2 - mapSetting.bound;
      let positionZ = Math.random() * mapSetting.bound * 2 - mapSetting.bound;

      let distToPlayer = vecDistance(player.position, [
        positionX,
        0,
        positionZ,
      ]);
      if (
        getCollisionWall([positionX, 0, positionZ]) == null &&
        distToPlayer <= MEDKIT_PLAYER_SPAWN_MAX_RADIUS &&
        distToPlayer >= MEDKIT_PLAYER_SPAWN_MIN_RADIUS
      ) {
        if (finalPositionX == null) {
          finalPositionX = positionX;
        }
        if (finalPositionZ == null) {
          finalPositionZ = positionZ;
        }
        break;
      }
    }
  }
  medkit = {
    position: [finalPositionX!, 3, finalPositionZ!],
  };
}

function spawnMedkitHealPopup() {
  let popup = {
    y: 0,
  };
  medkitHealPopups.push(popup);
}

function spawnEnemy() {
  let stage = getStageNumber();
  if (enemies.length >= ENEMY_CAP_STAGES[stage]) return;

  let mapSetting = MAP_SETTINGS[selectedMapSetting];

  let position;
  while (true) {
    let positionX = Math.random() * mapSetting.bound * 2 - mapSetting.bound;
    let positionY = Math.random() * mapSetting.bound * 2 - mapSetting.bound;
    position = [positionX, 0, positionY] as Vec3;
    let distToPlayer = vecDistance(player.position, position);
    if (
      distToPlayer >= ENEMY_PLAYER_SPAWN_MIN_RADIUS &&
      distToPlayer <= ENEMY_PLAYER_SPAWN_MAX_RADIUS
    ) {
      break;
    }
  }

  let randomSpeed = Math.random() * 0.4 + 0.1;
  let randomHealth = Math.random() * 100 + 40;
  let numColors = [0, 3, 5, 7, 4, 6, 8, 9];
  let randomColor = Math.floor(Math.random() * 8);
  let randomDodge;
  if (Math.random() >= 0.8) {
    randomDodge = 0;
  } else {
    randomDodge = Math.random() * ENEMY_MAX_DODGE;
  }
  let enemy = {
    speed: randomSpeed,
    health: randomHealth,
    color: numColors[randomColor],
    dodgeEntropy: randomDodge,
    position,
  };
  enemies.push(enemy);
}

function spawnBullet(origin: Vec3, direction: Vec3) {
  api.playTune(soundPew());
  let bullet = {
    origin,
    direction,
    position: origin,
  };
  bullets.push(bullet);
}

function spawnExplosion(position: Vec3) {
  api.playTune(soundExplosion());
  let explosion = {
    position,
    sizeScalar: 0.2,
  };
  explosions.push(explosion);
}

// -- Game Start --

function initInput() {
  api.onInput("w", inputLeftUp);
  api.onInput("s", inputLeftDown);
  api.onInput("a", inputLeftLeft);
  api.onInput("d", inputLeftRight);

  api.onInput("i", inputRightUp);
  api.onInput("j", inputRightLeft);
  api.onInput("l", inputRightRight);
  api.onInput("k", inputRightDown);
}

function initGame() {
  player = {
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    direction: [1, 0, 0],
    health: PLAYER_MAX_HEALTH - MEDKIT_HEAL_AMOUNT,
    bobTick: 0,
    yaw: 0,
    lastBulletTime: 0,
  };
  playerDead = false;
  enemies = [];
  bullets = [];
  explosions = [];
  medkit = null;
  medkitHealPopups = [];
  walls = [];
  startTime = 0;

  spawnWalls();
  spawnMedkit(6, 0);
}

// -- Tick Functions --

function tickPlayer() {
  // Look in the direction you should be looking.
  player.direction[0] = Math.cos(player.yaw);
  player.direction[2] = Math.sin(player.yaw);
  player.direction = vecNormalize(player.direction);

  // Cap the speed.
  if (vecLength(player.velocity) > PLAYER_MAX_VELOCITY) {
    player.velocity = vecMulScalar(
      vecNormalize(player.velocity),
      PLAYER_MAX_VELOCITY
    );
  }

  // Friction.
  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(vecNormalize(player.velocity), -PLAYER_FRICTION_SCALAR)
  );

  // Move forward unless if there's a wall (then you should bounce!).
  let next_position = vecAddVec(player.position, player.velocity);
  let collisionWall = getCollisionWall(next_position);
  if (collisionWall == null) {
    player.position = next_position;
  } else {
    api.playTune(soundPew());
    // Over-engineered bouncing.
    let wallToPlayer = vecNormalize(
      vecSubVec(collisionWall.position, player.position)
    );
    // Well, our walls are never rotated anyway ¯\_ (ツ)_/¯.
    let possibleNormals: Vec3[] = [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 1],
    ];
    let normal = possibleNormals[0];
    let minDist = vecDistance(possibleNormals[0], wallToPlayer);
    for (let i in possibleNormals) {
      let n = possibleNormals[i];
      let dist = vecDistance(n, wallToPlayer);
      if (dist < minDist) {
        minDist = dist;
        normal = n;
      }
    }

    let reflected = vecAddVec(
      vecMulScalar(normal, -2 * vecDot(normal, player.velocity)),
      player.velocity
    );
    player.velocity = vecMulScalar(reflected, PLAYER_WALL_BOUNCE_SCALAR);
  }
}

function tickBullets() {
  // Bullet go forward.
  for (let i in bullets) {
    let bullet = bullets[i];
    bullet.position = vecAddVec(
      bullet.position,
      vecMulScalar(bullet.direction, BULLET_SPEED)
    );
  }

  // Remove bullets that have gone too far.
  bullets = bullets.filter(
    (bullet) =>
      vecDistance(bullet.position, bullet.origin) <= BULLET_MAX_DISTANCE
  );
}

function tickEnemies() {
  let enemySpeedIncrement = ENEMY_SPEED_INCREMENT_SCALAR;
  for (let i in enemies) {
    let enemy = enemies[i];

    // Add speed. They will always outrun you. (Not really.)
    enemy.speed += enemySpeedIncrement;

    // Get closer if enemy isn't already too close.
    if (vecDistance(player.position, enemy.position) >= ENEMY_REACH) {
      let direction = vecNormalize(vecSubVec(player.position, enemy.position));
      // Adding dodge makes things more interesting.
      let dodgeDirection = vecMulScalar(
        vec3CrossProduct(direction, [0, 1, 0]),
        Math.sin(startTime * 6 * enemy.dodgeEntropy) * enemy.dodgeEntropy
      );
      let next_position = vecAddVec(
        enemy.position,
        vecMulScalar(direction, enemy.speed)
      );
      next_position = vecAddVec(next_position, dodgeDirection);
      // Don't go through walls. Go around instead. (Or try to anyway.)
      if (getCollisionWall(enemy.position) == null) {
        enemy.position = next_position;
      } else {
        // Pretty scuffed solution, but hey.
        enemy.position = vecAddVec(
          enemy.position,
          vecMulScalar(
            vec3CrossProduct([0, 1, 0], player.direction),
            enemy.speed
          )
        );
      }
    } else {
      // BAM. Attack the player.
      api.playTune(soundEnemyAttack());
      player.health -= ENEMY_DAMAGE;
    }
    // BAM. Attacked by player.
    if (hitByBullet(enemy.position)) {
      enemy.health -= BULLET_DAMAGE;
      if (enemy.health <= 0) {
        spawnExplosion(enemy.position);
      }
    }
  }
  // Remove the deceased.
  enemies = enemies.filter((enemy) => enemy.health > 0);
}

// Check if hit by bullet.
// Destroy the bullet if so.
function hitByBullet(agent: Vec3): boolean {
  const HITBOX_RADIUS = 2.5;
  let newBullets = bullets.filter((bullet) => {
    return vecDistance(agent, bullet.position) >= HITBOX_RADIUS;
  });

  let ret = newBullets.length != bullets.length;
  bullets = newBullets;
  return ret;
}

function tickExplosions() {
  // BOOM!
  for (let i in explosions) {
    let explosion = explosions[i];
    explosion.sizeScalar += EXPLOSION_GROWTH_INCREMENT;
  }
  // If too big, remove.
  explosions = explosions.filter(
    (explosion) => explosion.sizeScalar <= EXPLOSION_MAX_SIZE
  );
}

function tickMedkit() {
  if (medkit) {
    // Pick up the medkit if it's close enough.
    if (vecDistance(player.position, medkit.position) <= MEDKIT_PICKUP_RANGE) {
      api.playTune(soundPickUp());
      medkit = null;
      spawnMedkitHealPopup();

      player.health += MEDKIT_HEAL_AMOUNT;
      if (player.health > PLAYER_MAX_HEALTH) {
        player.health = PLAYER_MAX_HEALTH;
      }
    }
  } else {
    // Spawn medkit if there isn't aleady one.
    spawnMedkit(null, null);
  }
}

function tickPoison() {
  player.health -= PLAYER_POISON_TICK * (getStageNumber() + 1);
}

function tickMedkitHealPopup() {
  // Popup go up.
  for (let i in medkitHealPopups) {
    let popup = medkitHealPopups[i];
    popup.y += MEDKIT_POPUP_RISE_SPEED;
  }
  // Popup go away.
  medkitHealPopups = medkitHealPopups.filter(
    (popup) => popup.y <= MEDKIT_POPUP_MAX_HEIGHT
  );
}

function tickEnemySpawn() {
  // Spawn enemies based on stage #.
  let spawnParam = ENEMY_SPAWN_FREQUENCY_STAGES[getStageNumber()];

  if (Math.abs(startTime % 8) < spawnParam) {
    spawnEnemy();
  }
}

var lastStageNumber = getStageNumber();
function tickGame() {
  // Game over.
  if (player.health <= 0) {
    api.playTune(soundDeath());
    playerDead = true;
    setTimeout(() => {
      gameState = GameState.MENU;
    }, 3000);
  }

  if (!playerDead) {
    startTime += 1 / FPS;

    if (lastStageNumber != getStageNumber()) {
      api.playTune(soundStageUp());
    }
    lastStageNumber = getStageNumber();

    tickPlayer();
    tickEnemies();
    tickBullets();
    tickMedkit();
    tickExplosions();
    tickPoison();
    tickEnemySpawn();
    tickMedkitHealPopup();
  } else {
    // Look up when you die.
    if (player.direction[1] >= -Math.PI / 2) {
      player.direction[1] -= 0.2;
    }
  }
}

function tickMenu() {
  startTime += 1 / FPS;
}

// -- Collision Detection --

function getCollisionWall(d: Vec3): Wall | null {
  for (let i in walls) {
    let wall = walls[i];
    let boxMinX = Math.min(
      wall.position[0] - wall.scale[0],
      wall.position[0] + wall.scale[0]
    );
    let boxMaxX = Math.max(
      wall.position[0] - wall.scale[0],
      wall.position[0] + wall.scale[0]
    );
    let boxMinZ = Math.min(
      wall.position[2] - wall.scale[2],
      wall.position[2] + wall.scale[2]
    );
    let boxMaxZ = Math.max(
      wall.position[2] - wall.scale[2],
      wall.position[2] + wall.scale[2]
    );
    if (
      d[0] >= boxMinX &&
      d[0] <= boxMaxX &&
      d[2] >= boxMinZ &&
      d[2] <= boxMaxZ
    ) {
      return wall;
    }
  }
  return null;
}

// -- Input --

function playerBob() {
  player.bobTick += 1;
  player.position[1] = Math.sin(player.bobTick * 0.8) * 0.2 + 0.1;
}

function inputLeftUp() {
  switch (gameState) {
    case GameState.MENU:
      gameState = GameState.PLAY;
      initGame();
      break;
    case GameState.PLAY:
      playerBob();
      player.velocity = vecAddVec(
        player.velocity,
        vecMulScalar(player.direction, PLAYER_ACCELERATION)
      );
      break;
  }
}

function inputLeftDown() {
  switch (gameState) {
    case GameState.MENU:
      break;
    case GameState.PLAY:
      playerBob();
      player.velocity = vecAddVec(
        player.velocity,
        vecMulScalar(player.direction, -PLAYER_ACCELERATION)
      );
      break;
  }
}

function inputLeftLeft() {
  switch (gameState) {
    case GameState.MENU:
      break;
    case GameState.PLAY:
      playerBob();
      player.velocity = vecAddVec(
        player.velocity,
        vecMulScalar(
          vecNormalize(vec3CrossProduct(player.direction, [0, 1, 0])),
          PLAYER_ACCELERATION
        )
      );
      break;
  }
}

function inputLeftRight() {
  switch (gameState) {
    case GameState.MENU:
      break;
    case GameState.PLAY:
      playerBob();
      player.velocity = vecAddVec(
        player.velocity,
        vecMulScalar(
          vecNormalize(vec3CrossProduct(player.direction, [0, 1, 0])),
          -PLAYER_ACCELERATION
        )
      );
      break;
  }
}

function inputRightUp() {
  switch (gameState) {
    case GameState.MENU:
      incrementRes();
      break;
    case GameState.PLAY:
      if (startTime - player.lastBulletTime >= BULLET_COOLDOWN_THRESHOLD) {
        spawnBullet(vecAddVec(player.position, [0, 2, 0]), player.direction);
        player.lastBulletTime = startTime;
      }
      break;
  }
}

function inputRightDown() {
  switch (gameState) {
    case GameState.MENU:
      decrementRes();
      break;
    case GameState.PLAY:
      player.yaw -= Math.PI;
      break;
  }
}

function inputRightLeft() {
  switch (gameState) {
    case GameState.MENU:
      decMapSetting();
      break;
    case GameState.PLAY:
      player.yaw += Math.PI / 30;
      break;
  }
}

function inputRightRight() {
  switch (gameState) {
    case GameState.MENU:
      incMapSetting();
      break;
    case GameState.PLAY:
      player.yaw -= Math.PI / 30;
      break;
  }
}

// -- Renderer --

function incrementRes() {
  api.playTune(soundSettingChange());
  selectedResLevel += 1;
  if (selectedResLevel >= RES_LEVELS.length)
    selectedResLevel = RES_LEVELS.length - 1;
  recreateFramebuffer();
}

function decrementRes() {
  api.playTune(soundSettingChange());
  selectedResLevel -= 1;
  if (selectedResLevel < 0) selectedResLevel = 0;
  recreateFramebuffer();
}

function recreateFramebuffer() {
  let res = RES_LEVELS[selectedResLevel];
  tileXCount = res[0];
  tileYCount = res[1];
  fb = fbNew(tileXCount, tileYCount);
}

function renderGame() {
  fbClearColor(fb, 2);
  fbClearDepth(fb, 1000);

  let cameraPosition = player.position;
  let cameraFront = vecNormalize(player.direction);

  let baseRenderPass: RenderPass = {
    cameraPosition,
    cameraFront,
    projection: {
      fov_rad: Math.PI / 2.0,
      near: 0.1,
      far: 100.0,
    },
    enableDepth: true,
    cullScalar: 1,

    modelMatrix: mat4Identity(),
    colors: "0",
    borderColor: "0",
    triangles: [],
  };

  for (let i in walls) {
    let wall = walls[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, wall.scale);
    mv = mat4Translate(mv, wall.position);

    baseRenderPass.modelMatrix = mv;
    baseRenderPass.colors = "1";
    baseRenderPass.borderColor = "0";
    baseRenderPass.triangles = verticesCube();

    fbRender(fb, baseRenderPass);
  }

  for (let i in enemies) {
    let enemy = enemies[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, [0.015, -0.015, 0.01]);
    mv = mat4Rotate(mv, startTime * 2 * enemy.color, [0, 1, 0]);
    mv = mat4Translate(mv, vecSubVec(enemy.position, [0, -2, 0]));

    baseRenderPass.modelMatrix = mv;
    baseRenderPass.colors = enemy.color;
    baseRenderPass.borderColor = enemy.color;
    baseRenderPass.triangles = verticesBobPerson();

    fbRender(fb, baseRenderPass);
  }

  for (let i in bullets) {
    let bullet = bullets[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, bullet.position);
    mv = mat4Scale(mv, [0.3, 0.3, 0.3]);

    baseRenderPass.modelMatrix = mv;
    baseRenderPass.colors = "6";
    baseRenderPass.borderColor = "6";
    baseRenderPass.triangles = verticesCube();

    fbRender(fb, baseRenderPass);
  }

  for (let i in explosions) {
    let explosion = explosions[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, explosion.position);
    mv = mat4Scale(mv, vecMulScalar([1, 1, 1], explosion.sizeScalar));

    baseRenderPass.modelMatrix = mv;
    baseRenderPass.colors = "9";
    baseRenderPass.borderColor = "9";
    baseRenderPass.triangles = verticesCube();

    fbRender(fb, baseRenderPass);
  }

  if (medkit) {
    let mv = mat4Identity();
    mv = mat4Scale(mv, [1.2, 0.3, 1.2]);
    mv = mat4Rotate(mv, startTime, [0, 1, 0]);
    mv = mat4Translate(mv, medkit.position);

    baseRenderPass.modelMatrix = mv;
    baseRenderPass.colors = "3";
    baseRenderPass.borderColor = "3";
    baseRenderPass.triangles = verticesCube();
    baseRenderPass.enableDepth = false;

    fbRender(fb, baseRenderPass);
  }
}

function renderMenu() {
  fbClearColor(fb, 0);

  let mv = mat4Identity();
  mv = mat4Scale(mv, [0.005, -0.008, 0.005]);
  mv = mat4Rotate(mv, startTime, [0, 1, 0]);
  mv = mat4Translate(mv, [1.5, 0.9, 0.8]);

  let renderPass = {
    cameraPosition: [0, 0, 0] as Vec3,
    cameraFront: [1, 0, 0] as Vec3,
    projection: {
      fov_rad: Math.PI / 2.0,
      near: 0.1,
      far: 100.0,
    },
    colors: "2",
    borderColor: "2",
    triangles: verticesBobPerson(),
    modelMatrix: mv,
    enableDepth: false,
    cullScalar: 1,
  };

  fbRender(fb, renderPass);
}

function renderGameText() {
  let healthColor;
  if (player.health < PLAYER_MAX_HEALTH / 2) {
    healthColor = "3";
  } else {
    healthColor = "D";
  }

  let stage = getStageNumber();
  let stageStr;
  if (stage == KILL_SCREEN_STAGE) {
    stageStr = "Kill Screen";
  } else {
    stageStr = `Stage: ${getStageNumber()}`;
  }

  let stageColor;
  if (stage == 0 || stage == 1) {
    stageColor = "D";
  } else if (stage == 2 || stage == 3) {
    stageColor = "3";
  } else {
    stageColor = "H";
  }

  api.clearText();

  api.addText(`Score: ${Math.floor(startTime)} ${stageStr}`, {
    x: 1,
    y: 0,
    color: stageColor,
  });
  api.addText(`Health: ${Math.floor(player.health)}/${PLAYER_MAX_HEALTH}`, {
    x: 2,
    y: 15,
    color: healthColor,
  });
  for (let i in medkitHealPopups) {
    let popup = medkitHealPopups[i];
    api.addText(`+${MEDKIT_HEAL_AMOUNT}`, {
      x: 8,
      y: 8 - Math.floor(popup.y),
      color: "4",
    });
  }
}

function renderMenuText() {
  api.clearText();

  api.addText("ROOM", {
    x: 3,
    y: 1,
    color: "2",
  });

  api.addText("i & k:", {
    x: 10,
    y: 2,
    color: "2",
  });
  api.addText("resolution", {
    x: 8,
    y: 3,
    color: "2",
  });
  api.addText("j & l:", {
    x: 10,
    y: 5,
    color: "2",
  });
  api.addText("map", {
    x: 11,
    y: 6,
    color: "2",
  });
  api.addText("W to Begin", {
    x: 8,
    y: 13,
    color: "2",
  });

  let res = RES_LEVELS[selectedResLevel];
  api.addText(`(${res[0]}:${res[1]})`, {
    x: 10,
    y: 9,
    color: "2",
  });

  let mapSetting = MAP_SETTINGS[selectedMapSetting];
  api.addText(`(${mapSetting.name})`, {
    x: 10,
    y: 10,
    color: "2",
  });
}

function initEngine() {
  api.setMap(`.`);

  // So that I don't get jumpscared by vite.
  setTimeout(() => {
    api.playTune(soundMenuMusic(), Infinity);
  }, 1000);

  initInput();

  setInterval(() => {
    switch (gameState) {
      case GameState.MENU:
        tickMenu();
        renderMenu();
        break;
      case GameState.PLAY:
        tickGame();
        renderGame();
        break;
    }

    let legends = fbGetRender(fb, tileXCount, tileYCount);
    api.setLegend(...legends);

    api.setMap(fb.map);

    switch (gameState) {
      case GameState.MENU:
        renderMenuText();
        break;
      case GameState.PLAY:
        renderGameText();
        break;
    }
  }, 1000 / FPS);
}

// -- Sprig Web --

if (document) {
  const game = webEngine(
    document.getElementById("canvas") as HTMLCanvasElement
  );
  api = game.api;
  initEngine();
}
