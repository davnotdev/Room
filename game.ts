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
} from "./graphics";
import { verticesBobPerson, verticesCube } from "./models";

//
//   ____    _____   _____
// /\  _`\ /\  __`\/\  __`\  /'\_/`\
// \ \ \L\ \ \ \/\ \ \ \/\ \/\      \
//  \ \ ,  /\ \ \ \ \ \ \ \ \ \ \__\ \
//   \ \ \\ \\ \ \_\ \ \ \_\ \ \ \_/\ \
//    \ \_\ \_\ \_____\ \_____\ \_\\ \_\
//     \/_/\/ /\/_____/\/_____/\/_/ \/_/
//
// Sprig is a simple console.
// That's good. Simplicity is good.
// Sprig is a limited console.
// That's also good. Limitations inspire creativity.
// But what if we ignored those limits and pushed it somewhere it's not meant to go?
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

// -- Game Globals --

const FPS = 24;
var tileXCount = 0;
var tileYCount = 0;

const RES_LEVELS = [
  [1, 1],
  [2, 2],
  [4, 3],
  [5, 4],
  [6, 6],
  [8, 8],
  [10, 8],
  [20, 16],
];
var selectedResLevel = 3;

const ENEMY_CAP = 15;

const BULLET_DAMAGE = 40;
const BULLET_COOLDOWN_THRESHOLD = 0.14;

var fb: Framebuffer;
recreateFramebuffer();

const PLAYER_MAX_HEALTH = 50;
const PLAYER_POISON_TICK = 0.012;

const ENEMY_SPAWN_FREQUENCY_STAGES = [0.05, 0.1, 0.18, 0.25, 3];
const KILL_SCREEN_STAGE = 4;

const ENEMY_DAMAGE = 0.22;
const MEDKIT_HEAL_AMOUNT = 13;

enum GameState {
  MENU,
  PLAY,
}

var gameState = GameState.MENU;

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

interface Enemy {
  speed: number;
  health: number;
  color: number;
  position: Vec3;
}
var enemies: Enemy[] = [];

interface Bullet {
  origin: Vec3;
  position: Vec3;
  direction: Vec3;
}
var bullets: Bullet[] = [];

interface Explosion {
  position: Vec3;
  sizeScalar: number;
}
var explosions: Explosion[] = [];

interface Medkit {
  position: Vec3;
}

var medkit: Medkit | null = null;

interface Wall {
  rot: number;
  scale: Vec3;
  position: Vec3;
  color: Color;
}
var walls: Wall[] = [];

const MAP_BOUND = 85;
const MAP_WALL_Y = 6;
const MAP_WALL_MAX_SCALE = 7;
const MAP_WALL_COUNT = 30;
const MAP_WALL_TO_WALL_MIN_DISTANCE = 20;

let startTime = 0;

function getStageNumber() {
  if (startTime <= 15) {
    return 0;
  } else if (startTime <= 100) {
    return 1;
  } else if (startTime <= 230) {
    return 2;
  } else if (startTime <= 999) {
    return 3;
  } else {
    return KILL_SCREEN_STAGE;
  }
}

// -- Spawn Functions --

function spawnWalls() {
  let north = {
    rot: 0,
    scale: [1, MAP_WALL_Y, MAP_BOUND] as Vec3,
    position: [MAP_BOUND, 0, 0] as Vec3,
    color: "1",
  };
  let south = {
    rot: 0,
    scale: [1, MAP_WALL_Y, MAP_BOUND] as Vec3,
    position: [-MAP_BOUND, 0, 0] as Vec3,
    color: "1",
  };
  let west = {
    rot: 0,
    scale: [MAP_BOUND, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, MAP_BOUND] as Vec3,
    color: "1",
  };
  let east = {
    rot: 0,
    scale: [MAP_BOUND, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, -MAP_BOUND] as Vec3,
    color: "1",
  };

  walls.push(north);
  walls.push(south);
  walls.push(west);
  walls.push(east);

  for (let i = 0; i < MAP_WALL_COUNT; i++) {
    let scaleX = (Math.random() * MAP_WALL_MAX_SCALE) / 2 - MAP_WALL_MAX_SCALE;
    let scaleZ = (Math.random() * MAP_WALL_MAX_SCALE) / 2 - MAP_WALL_MAX_SCALE;
    let positionX = Math.random() * (MAP_BOUND - 2) * 2 - MAP_BOUND;
    let positionZ = Math.random() * (MAP_BOUND - 2) * 2 - MAP_BOUND;

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
      Math.abs(positionX) < MAP_WALL_MAX_SCALE ||
      Math.abs(positionZ) < MAP_WALL_MAX_SCALE
    ) {
      failedWall = true;
    }

    if (
      MAP_BOUND - Math.abs(positionX) < 18 ||
      MAP_BOUND - Math.abs(positionZ) < 18
    ) {
      failedWall = true;
    }

    if (failedWall) {
      i--;
      continue;
    }

    let wall = {
      rot: 0,
      scale: [scaleX, MAP_WALL_Y, scaleZ] as Vec3,
      position: [positionX, 0, positionZ] as Vec3,
      color: "1",
    };
    walls.push(wall);
  }
}

function spawnMedkit() {
  while (true) {
    let positionX = Math.random() * MAP_BOUND * 2 - MAP_BOUND;
    let positionZ = Math.random() * MAP_BOUND * 2 - MAP_BOUND;

    if (isNotInsideWalls([positionX, 0, positionZ])) {
      medkit = {
        position: [positionX, 3, positionZ],
      };
      break;
    }
  }
}

function spawnEnemy(position: Vec3) {
  if (enemies.length >= ENEMY_CAP && getStageNumber() != KILL_SCREEN_STAGE)
    return;

  let randomSpeed = Math.random() * 0.08;
  let randomHealth = Math.random() * 100 + 40;
  let numColors = [0, 3, 5, 7, 4, 6, 8, 9];
  let randomColor = Math.floor(Math.random() * 8);
  let enemy = {
    speed: randomSpeed,
    health: randomHealth,
    color: numColors[randomColor],
    position,
  };
  enemies.push(enemy);
}

function spawnBullet(origin: Vec3, direction: Vec3) {
  let bullet = {
    origin,
    direction,
    position: origin,
  };
  bullets.push(bullet);
}

function spawnExplosion(position: Vec3) {
  let explosion = {
    position,
    sizeScalar: 0.2,
  };
  explosions.push(explosion);
}

// -- Tick Functions --

function tickPlayer() {
  const PLAYER_MAX_VELOCITY = 0.65;
  const PLAYER_FRICTION_SCALAR = 0.005;

  player.direction[0] = Math.cos(player.yaw);
  player.direction[2] = Math.sin(player.yaw);
  player.direction = vecNormalize(player.direction);

  if (vecLength(player.velocity) > PLAYER_MAX_VELOCITY) {
    player.velocity = vecMulScalar(
      vecNormalize(player.velocity),
      PLAYER_MAX_VELOCITY
    );
  }

  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(vecNormalize(player.velocity), -PLAYER_FRICTION_SCALAR)
  );

  const PLAYER_WALL_BIAS = 3;

  let next_position = vecAddVec(player.position, player.velocity);
  if (
    isNotInsideWalls(
      vecAddVec(next_position, vecMulScalar(player.direction, PLAYER_WALL_BIAS))
    )
  ) {
    player.position = next_position;
  }
}

function tickBullets() {
  const BULLET_MAX_DISTANCE = 30;
  const BULLET_SPEED = 2;
  for (let i in bullets) {
    let bullet = bullets[i];
    bullet.position = vecAddVec(
      bullet.position,
      vecMulScalar(bullet.direction, BULLET_SPEED)
    );
  }

  bullets = bullets.filter(
    (bullet) =>
      vecDistance(bullet.position, bullet.origin) <= BULLET_MAX_DISTANCE
  );
}

function tickEnemies() {
  const ENEMY_MAX_CLOSE_UP = 1.7;
  const ENEMY_SPEED_INCREMENT = 0.0002 * Math.abs(getStageNumber() - 2);
  for (let i in enemies) {
    let enemy = enemies[i];

    enemy.speed += ENEMY_SPEED_INCREMENT;

    if (vecDistance(player.position, enemy.position) >= ENEMY_MAX_CLOSE_UP) {
      let direction = vecSubVec(player.position, enemy.position);
      let next_position = vecAddVec(
        enemy.position,
        vecMulScalar(direction, enemy.speed)
      );
      if (isNotInsideWalls(enemy.position)) {
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
      player.health -= ENEMY_DAMAGE;
    }
    if (hitByBullet(enemy.position)) {
      enemy.health -= BULLET_DAMAGE;
      if (enemy.health <= 0) {
        spawnExplosion(enemy.position);
      }
    }
  }
  enemies = enemies.filter((enemy) => enemy.health > 0);
}

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
  const EXPLOSION_MAX_SIZE = 2.0;
  const EXPLOSION_GROWTH_INCREMENT = 0.3;
  for (let i in explosions) {
    let explosion = explosions[i];
    explosion.sizeScalar += EXPLOSION_GROWTH_INCREMENT;
  }
  explosions = explosions.filter(
    (explosion) => explosion.sizeScalar <= EXPLOSION_MAX_SIZE
  );
}

function tickMedkit() {
  const MEDKIT_PICKUP_RANGE = 5;
  if (medkit) {
    if (vecDistance(player.position, medkit.position) <= MEDKIT_PICKUP_RANGE) {
      medkit = null;
      player.health += MEDKIT_HEAL_AMOUNT;
      if (player.health > PLAYER_MAX_HEALTH) {
        player.health = PLAYER_MAX_HEALTH;
      }
    }
  } else {
    spawnMedkit();
  }
}

function tickPoison() {
  player.health -= PLAYER_POISON_TICK * (getStageNumber() + 1);
}

function tickEnemySpawn() {
  let spawnParam = ENEMY_SPAWN_FREQUENCY_STAGES[getStageNumber()];

  if (Math.abs(startTime % 8) < spawnParam) {
    spawnEnemy([
      Math.random() * MAP_BOUND * 2 - MAP_BOUND,
      0,
      Math.random() * MAP_BOUND * 2 - MAP_BOUND,
    ]);
  }
}

function tickGame() {
  if (player.health <= 0) {
    playerDead = true;
    setTimeout(() => {
      gameState = GameState.MENU;
    }, 5000);
  }

  if (!playerDead) {
    startTime += 1 / FPS;

    tickPlayer();
    tickEnemies();
    tickBullets();
    tickMedkit();
    tickExplosions();
    tickPoison();
    tickEnemySpawn();
  } else {
    if (player.direction[1] >= -Math.PI / 2) {
      player.direction[1] -= 0.2;
    }
  }
}

function tickMenu() {
  startTime += 1 / FPS;
}

// -- Collision Detection --

function isNotInsideWalls(d: Vec3): boolean {
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
      d[2] <= boxMaxZ &&
      Math.abs(d[0]) < MAP_BOUND &&
      Math.abs(d[2]) < MAP_BOUND
    ) {
      return false;
    }
  }
  return true;
}

// -- Game Start --

function initInput(api: WebEngineAPI) {
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
    health: PLAYER_MAX_HEALTH,
    bobTick: 0,
    yaw: 0,
    lastBulletTime: 0,
  };
  playerDead = false;
  enemies = [];
  bullets = [];
  explosions = [];
  medkit = null;
  walls = [];
  startTime = 0;

  spawnWalls();
}

// -- Input --

const PLAYER_ACCELERATION = 0.1;

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
      break;
    case GameState.PLAY:
      player.yaw += Math.PI / 30;
      break;
  }
}

function inputRightRight() {
  switch (gameState) {
    case GameState.MENU:
      break;
    case GameState.PLAY:
      player.yaw -= Math.PI / 30;
      break;
  }
}

// -- Renderer --

function incrementRes() {
  selectedResLevel += 1;
  if (selectedResLevel >= RES_LEVELS.length)
    selectedResLevel = RES_LEVELS.length - 1;
  recreateFramebuffer();
}

function decrementRes() {
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

  let baseRenderPass: any = {
    cameraPosition,
    cameraFront,
    projection: {
      fov_rad: Math.PI / 2.0,
      near: 0.1,
      far: 100.0,
    },
    enableDepth: true,
    cullScalar: 1,
  };

  for (let i in walls) {
    let wall = walls[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, wall.scale);
    mv = mat4Rotate(mv, wall.rot, [0, 1, 0]);
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
    baseRenderPass.colors = "F";
    baseRenderPass.borderColor = "F";
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

function renderGameText(api: WebEngineAPI) {
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
}

function renderMenuText(api: WebEngineAPI) {
  api.clearText();

  api.addText("ROOM", {
    x: 3,
    y: 1,
    color: "2",
  });

  api.addText("Use i & k", {
    x: 8,
    y: 3,
    color: "2",
  });
  api.addText("to adjust", {
    x: 8,
    y: 4,
    color: "2",
  });
  api.addText("resolution", {
    x: 8,
    y: 5,
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
    y: 8,
    color: "2",
  });
}

function initEngine(api: WebEngineAPI) {
  api.setMap(`.`);

  initInput(api);

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
    api.setLegend(...(legends as [string, string][]));

    api.setMap(fb.map);

    switch (gameState) {
      case GameState.MENU:
        renderMenuText(api);
        break;
      case GameState.PLAY:
        renderGameText(api);
        break;
    }
  }, 1000 / FPS);
}

// -- Sprig Web --

if (document) {
  const game = webEngine(
    document.getElementById("canvas") as HTMLCanvasElement
  );
  initEngine(game.api);
}
