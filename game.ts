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
} from "./graphics";

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
// \ s a d [oooo] j k l /
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

const fb = fbNew(TILE_X_COUNT * 16, TILE_Y_COUNT * 16);

interface Player {
  position: Vec3;
  direction: Vec3;
}
const player: Player = {
  position: [0, 0, 0],
  direction: [0, 0, 1],
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

// -- Tick Functions --

function tickBullets() {
  const MAX_BULLET_DISTANCE = 30;
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
      vecDistance(bullet.position, bullet.origin) <= MAX_BULLET_DISTANCE
  );
}

function tickEnemies() {
  const ENEMY_SPEED = 0.02;
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
    }
  }
  enemies = enemies.filter((enemy) => enemy.health > 0);
}

function hitByBullet(agent: Vec3): boolean {
  const HITBOX_RADIUS = 1;
  let newBullets = bullets.filter((bullet) => {
    return vecDistance(agent, bullet.position) >= HITBOX_RADIUS;
  });

  let ret = newBullets.length != bullets.length;
  bullets = newBullets;
  return ret;
}

function tick() {
  tickEnemies();
  tickBullets();
}

// -- Game Start --

function init(api: WebEngineAPI) {
  api.onInput("w", controlForward);
  api.onInput("s", controlBackward);
  api.onInput("a", controlLeft);
  api.onInput("d", controlRight);

  api.onInput("i", controlPew);

  spawnEnemy([0, 0, 50]);
}

// -- Controls --

function controlForward() {
  // TODO
  player.position[2] += 1.0;
}

function controlBackward() {
  player.position[2] -= 1.0;
}

function controlLeft() {
  // TODO
  player.position[0] += 1.0;
}

function controlRight() {
  // TODO
  player.position[0] -= 1.0;
}

function controlPew() {
  spawnBullet(player.position, player.direction);
}

// -- Renderer --

function render(ticks: number) {
  fbClearColor(fb, 0);

  // TODO
  let cameraPosition = player.position;

  for (let i in enemies) {
    let enemy = enemies[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, enemy.position);
    mv = mat4Translate(mv, [
      cameraPosition[0],
      cameraPosition[1],
      -cameraPosition[2],
    ]);
    mv = mat4Scale(mv, [1, 2, 1]);

    let render_pass = {
      viewOrigin: cameraPosition,
      borderColor: 0,
      colors: 3,
      triangles: verticesCube(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelViewMatrix: mv,
      cullScalar: 1,
    };
    fbRender(fb, render_pass as any);
    (render_pass.colors as any) = null;
    fbRender(fb, render_pass as any);
  }

  for (let i in bullets) {
    let bullet = bullets[i];

    let mv = mat4Identity();
    mv = mat4Translate(mv, bullet.position);
    mv = mat4Translate(mv, [
      cameraPosition[0],
      cameraPosition[1],
      -cameraPosition[2],
    ]);
    mv = mat4Scale(mv, [0.3, 0.3, 0.3]);

    let render_pass = {
      viewOrigin: cameraPosition,
      borderColor: "F",
      colors: "F",
      triangles: verticesCube(),
      projection: {
        fov_rad: Math.PI / 2.0,
        near: 0.1,
        far: 100.0,
      },
      modelViewMatrix: mv,
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

    let renderData = fbGetRender(fb, TILE_X_COUNT, TILE_Y_COUNT);
    api.setLegend(...(renderData.legends as [string, string][]));

    api.setMap(renderData.map);
    renderText(api);
  }, 1000 / FPS);
}

// -- 3D Models --

function verticesCube() {
  return [
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
    -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0,
    -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
  ];
}

// -- Sprig Web --

if (document) {
  const game = webEngine(
    document.getElementById("canvas") as HTMLCanvasElement
  );
  initEngine(game.api);
}
