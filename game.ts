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
import { verticesPerson, verticesCube } from "./models";

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

const FPS = 20;
const TILE_X_COUNT = 10;
const TILE_Y_COUNT = 8;

const BULLET_DAMAGE = 30;

const fb = fbNew(TILE_X_COUNT, TILE_Y_COUNT);

const PLAYER_MAX_HEALTH = 500;

const ENEMY_SPAWN_FREQUENCY = 10;

interface Player {
  position: Vec3;
  velocity: Vec3;
  direction: Vec3;
  health: number;
  bobTick: number;
  yaw: number;
}
const player: Player = {
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  direction: [1, 0, 0],
  health: PLAYER_MAX_HEALTH,
  bobTick: 0,
  yaw: 0,
};

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

let startTime = 0;

interface Wall {
  rot: number;
  scale: Vec3;
  position: Vec3;
  color: Color;
}
var walls: Wall[] = [];

const MAP_MAX = 75;
const MAP_WALL_Y = 3;
const MAP_WALL_MAX_SIZE = 5;
const MAP_WALL_COUNT = 30;

// -- Spawn Functions --

function spawnWalls() {
  let north = {
    rot: 0,
    scale: [1, MAP_WALL_Y, MAP_MAX] as Vec3,
    position: [MAP_MAX, 0, 0] as Vec3,
    color: "1",
  };
  let south = {
    rot: 0,
    scale: [1, MAP_WALL_Y, MAP_MAX] as Vec3,
    position: [-MAP_MAX, 0, 0] as Vec3,
    color: "1",
  };
  let west = {
    rot: 0,
    scale: [MAP_MAX, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, MAP_MAX] as Vec3,
    color: "1",
  };
  let east = {
    rot: 0,
    scale: [MAP_MAX, MAP_WALL_Y, 1] as Vec3,
    position: [0, 0, -MAP_MAX] as Vec3,
    color: "1",
  };

  walls.push(north);
  walls.push(south);
  walls.push(west);
  walls.push(east);

  for (let i = 0; i < MAP_WALL_COUNT; i++) {
    let scaleX = (Math.random() * MAP_WALL_MAX_SIZE) / 2 - MAP_WALL_MAX_SIZE;
    let scaleZ = (Math.random() * MAP_WALL_MAX_SIZE) / 2 - MAP_WALL_MAX_SIZE;
    let positionX = Math.random() * (MAP_MAX - 2) * 2 - MAP_MAX;
    let positionZ = Math.random() * (MAP_MAX - 2) * 2 - MAP_MAX;

    let wall = {
      rot: 0,
      scale: [scaleX, MAP_WALL_Y, scaleZ] as Vec3,
      position: [positionX, 0, positionZ] as Vec3,
      color: "1",
    };
    walls.push(wall);
  }
}

function spawnEnemy(position: Vec3) {
  let randomSpeed = Math.random() * 2 + 0.3;
  let randomHealth = Math.random() * 50 + 30;
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
  const PLAYER_MAX_VELOCITY = 0.5;
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
  player.position = vecAddVec(player.position, player.velocity);
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
  const ENEMY_SPEED = 0.05;
  const ENEMY_MAX_CLOSE_UP = 1.5;
  for (let i in enemies) {
    let enemy = enemies[i];
    if (vecDistance(player.position, enemy.position) >= ENEMY_MAX_CLOSE_UP) {
      let direction = vecSubVec(player.position, enemy.position);
      enemy.position = vecAddVec(
        enemy.position,
        vecMulScalar(direction, ENEMY_SPEED)
      );
    } else {
      player.health -= 0.1;
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
  const HITBOX_RADIUS = 1.5;
  let newBullets = bullets.filter((bullet) => {
    return vecDistance(agent, bullet.position) >= HITBOX_RADIUS;
  });

  let ret = newBullets.length != bullets.length;
  bullets = newBullets;
  return ret;
}

function tickExplosions() {
  const EXPLOSION_MAX_SIZE = 4.0;
  const EXPLOSION_GROWTH_INCREMENT = 0.6;
  for (let i in explosions) {
    let explosion = explosions[i];
    explosion.sizeScalar += EXPLOSION_GROWTH_INCREMENT;
  }
  explosions = explosions.filter(
    (explosion) => explosion.sizeScalar <= EXPLOSION_MAX_SIZE
  );
}

function tick() {
  startTime += 1 / FPS;

  if (Math.abs(startTime % ENEMY_SPAWN_FREQUENCY) < 0.1) {
    spawnEnemy([
      Math.random() * MAP_MAX * 2 - MAP_MAX,
      0,
      Math.random() * MAP_MAX * 2 - MAP_MAX,
    ]);
  }

  tickPlayer();
  tickEnemies();
  tickBullets();
  tickExplosions();
}

// -- Game Start --

function init(api: WebEngineAPI) {
  api.onInput("w", controlForward);
  api.onInput("s", controlBackward);
  api.onInput("a", controlLeft);
  api.onInput("d", controlRight);

  api.onInput("i", controlPew);
  api.onInput("j", controlLookLeft);
  api.onInput("l", controlLookRight);
  api.onInput("k", controlLookBehind);

  // for (let i = -10; i < 10; i++) spawnEnemy([-6, 0, i * 5]);
  spawnEnemy([6, 0, 4]);
  spawnWalls();
}

// -- Controls --

const PLAYER_ACCELERATION = 0.1;

function playerBob() {
  player.bobTick += 1;
  player.position[1] = Math.sin(player.bobTick * 0.8) * 0.1 + 0.1;
}

function controlForward() {
  playerBob();
  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(player.direction, PLAYER_ACCELERATION)
  );
}

function controlBackward() {
  playerBob();
  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(player.direction, -PLAYER_ACCELERATION)
  );
}

function controlLeft() {
  playerBob();
  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(
      vecNormalize(vec3CrossProduct(player.direction, [0, 1, 0])),
      PLAYER_ACCELERATION
    )
  );
}

function controlRight() {
  playerBob();
  player.velocity = vecAddVec(
    player.velocity,
    vecMulScalar(
      vecNormalize(vec3CrossProduct(player.direction, [0, 1, 0])),
      -PLAYER_ACCELERATION
    )
  );
}

function controlPew() {
  spawnBullet(player.position, player.direction);
}

function controlLookLeft() {
  player.yaw += Math.PI / 50;
}

function controlLookRight() {
  player.yaw -= Math.PI / 50;
}

function controlLookBehind() {
  player.yaw -= Math.PI;
}

// -- Renderer --

function render(ticks: number) {
  fbClearColor(fb, 2);
  fbClearDepth(fb, 1000);

  let cameraPosition = player.position;
  let cameraFront = vecNormalize(player.direction);

  for (let i in walls) {
    let wall = walls[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, wall.scale);
    mv = mat4Rotate(mv, wall.rot, [0, 1, 0]);
    mv = mat4Translate(mv, wall.position);

    let render_pass = {
      cameraPosition,
      cameraFront,
      borderColor: "0",
      colors: wall.color,
      triangles: verticesCube(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelMatrix: mv,
      enableDepth: true,
      cullScalar: 1,
    };
    fbRender(fb, render_pass as any);
  }

  for (let i in enemies) {
    let enemy = enemies[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, [0.015, -0.015, 0.01]);
    mv = mat4Rotate(mv, ticks * 2 * enemy.color, [0, 1, 0]);
    mv = mat4Translate(mv, vecSubVec(enemy.position, [0, -2, 0]));

    let render_pass = {
      cameraPosition,
      cameraFront,
      borderColor: enemy.color,
      colors: enemy.color,
      triangles: verticesPerson(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelMatrix: mv,
      enableDepth: true,
      cullScalar: 1,
    };
    fbRender(fb, render_pass as any);
  }

  for (let i in bullets) {
    let bullet = bullets[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, bullet.position);
    mv = mat4Scale(mv, [0.3, 0.3, 0.3]);

    let render_pass = {
      cameraPosition,
      cameraFront,
      borderColor: "F",
      colors: "F",
      triangles: verticesCube(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelMatrix: mv,
      enableDepth: true,
      cullScalar: 1,
    };
    fbRender(fb, render_pass as any);
  }

  for (let i in explosions) {
    let explosion = explosions[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, explosion.position);
    mv = mat4Scale(mv, vecMulScalar([1, 1, 1], explosion.sizeScalar));

    let render_pass = {
      cameraPosition,
      cameraFront,
      borderColor: 9,
      colors: 9,
      triangles: verticesCube(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelMatrix: mv,
      enableDepth: true,
      cullScalar: 1,
    };
    fbRender(fb, render_pass as any);
  }
}

function renderText(api: WebEngineAPI) {
  let healthColor;
  if (player.health < PLAYER_MAX_HEALTH / 2) {
    healthColor = "3";
  } else {
    healthColor = "D";
  }

  api.addText(`Score: ${Math.floor(startTime)}`, {
    x: 2,
    y: 0,
    color: "D",
  });
  api.addText(`Health: ${Math.floor(player.health)}/${PLAYER_MAX_HEALTH}`, {
    x: 2,
    y: 15,
    color: healthColor,
  });
}

function initEngine(api: WebEngineAPI) {
  api.setMap(`.`);

  init(api);

  let ticks = 0;
  setInterval(() => {
    ticks += 1 / FPS;

    tick();
    render(ticks);

    let legends = fbGetRender(fb, TILE_X_COUNT, TILE_Y_COUNT);
    api.setLegend(...(legends as [string, string][]));

    api.setMap(fb.map);
    renderText(api);
  }, 1000 / FPS);
}

// -- Sprig Web --

if (document) {
  const game = webEngine(
    document.getElementById("canvas") as HTMLCanvasElement
  );
  initEngine(game.api);
}
