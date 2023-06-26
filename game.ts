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
// a = Backward     k =
//

// -- Game Globals --

const FPS = 20;
const TILE_X_COUNT = 10;
const TILE_Y_COUNT = 8;

const BULLET_DAMAGE = 999;

const fb = fbNew(TILE_X_COUNT, TILE_Y_COUNT);

interface Player {
  position: Vec3;
  velocity: Vec3;
  direction: Vec3;
  bobTick: number;
  yaw: number;
}
const player: Player = {
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  direction: [1, 0, 0],
  bobTick: 0,
  yaw: 0,
};

interface Enemy {
  speed: number;
  health: number;
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

// -- Spawn Functions --

function spawnEnemy(position: Vec3) {
  let randomSpeed = Math.random() * 2 + 0.3;
  let randomHealth = Math.random() * 50 + 30;
  let enemy = {
    speed: randomSpeed,
    health: randomHealth,
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

function clamp(n: number, low: number, high: number): number {
  if (n < low) {
    return low;
  } else if (n > high) {
    return high;
  } else {
    return n;
  }
}

function tickPlayer() {
  const PLAYER_MAX_VELOCITY = 0.4;
  const PLAYER_FRICTION_SCALAR = 0.01;

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
  const ENEMY_SPEED = 0.1;
  const ENEMY_MAX_CLOSE_UP = 6;
  for (let i in enemies) {
    let enemy = enemies[i];
    if (vecDistance(player.position, enemy.position) >= ENEMY_MAX_CLOSE_UP) {
      let direction = vecSubVec(player.position, enemy.position);
      enemy.position = vecAddVec(
        enemy.position,
        vecMulScalar(direction, ENEMY_SPEED)
      );
    }
    if (hitByBullet(enemy.position)) {
      enemy.health -= BULLET_DAMAGE;
      spawnExplosion(enemy.position);
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
  const EXPLOSION_MAX_SIZE = 3.0;
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

  // for (let i = -10; i < 10; i++) spawnEnemy([-6, 0, i * 5]);
  spawnEnemy([6, 0, 4]);
}

// -- Controls --

const PLAYER_ACCELERATION = 0.1;

function playerBob() {
  player.bobTick += 1;
  player.position[1] = Math.sin(player.bobTick * 0.6) * 0.08 + 0.08;
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

// -- Renderer --

function render(ticks: number) {
  fbClearColor(fb, 2);
  fbClearDepth(fb, 1000);

  let cameraPosition = player.position;
  let cameraFront = vecNormalize(player.direction);

  for (let i in enemies) {
    let enemy = enemies[i];

    let mv = mat4Identity();
    mv = mat4Scale(mv, [0.015, -0.015, 0.01]);
    mv = mat4Rotate(mv, ticks, [0, 1, 0]);
    mv = mat4Translate(mv, vecSubVec(enemy.position, [0, -2, 0]));

    let render_pass = {
      cameraPosition,
      cameraFront,
      borderColor: 0,
      colors: 5,
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
    // (render_pass.colors as any) = null;
    // fbRender(fb, render_pass as any);
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
  api.addText("Hello World", {
    x: 5,
    y: 2,
    color: "3",
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
