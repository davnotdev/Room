// This is ROOM's software rasterizer.
// There are some things you should be aware of.
//
// 1:
// This works by rendering out to sprites called "tiles".
// These tiles are then laid out on the map.
// (The map is created ahead of time.)
//
// 2:
// Depth testing is backwards.
// Referencing ROOM's code, the depth is checked like so:
// `z != null && z < fb.fbDepth[idx]`
// This means that you should do this to clear the depth buffer:
// fbClearDepth(fb, 1000);
//
// 3:
// Depth values are not interpolated.
// This results in strange bugs but is good enough for ROOM.
//
// 4:
// Matrices are row major, NOT column major.
//
// 5.
// Angles are ALWAYS specified in radians.
//
// ---
//
// Have fun playing around with this :)
//

// -- Rendering Types --

type Color = number | string;
type Depth = number;

interface Framebuffer {
  width: number;
  height: number;
  fbColor: Color[];
  fbDepth: Depth[];
  map: string;
}

interface ProjectionData {
  fov_rad: number;
  near: number;
  far: number;
}

interface RenderPass {
// Normalized vector representing camera's direction.
  cameraFront: Vec3;
  cameraPosition: Vec3;
  triangles: number[];
  modelMatrix: Mat4;
  projection: ProjectionData | null | undefined;
// In array form, you can provide a color to each triangle.
  colors: Color | Color[] | null | undefined;
  borderColor: Color | null | undefined;
// Either leave this null or 1.
// Set to -1 to cull front faces.
  cullScalar: number | null;
  enableDepth: boolean | null | undefined;
}

// -- Math Types --

// Row major
type Mat4 = [Vec4, Vec4, Vec4, Vec4];

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

// -- Framebuffer Functions --

// We need a unique character to represent each tile.
function fbGetLegendIdent(tilesXCount: number, tileX: number, tileY: number) {
  return String.fromCharCode(tileX + tilesXCount * tileY + 48);
}

// Render into legends.
// From ROOM's code:
// ```
// let legends = fbGetRender(fb, tileXCount, tileYCount);
// setLegend(...legends);
// ```
function fbGetRender(
  fb: Framebuffer,
  tilesXCount: number,
  tilesYCount: number
): [string, string][] {
  let legends: [string, string][] = [];

  for (let yi = 0; yi < tilesYCount; yi++) {
    for (let xi = 0; xi < tilesXCount; xi++) {
      let tileSprite = "\n";
      let offsetX = xi * 16;
      let offsetY = yi * 16;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let color = fbGetColor(fb, x + offsetX, y + offsetY);
          tileSprite += color;
        }
        tileSprite += "\n";
      }
      let ident = fbGetLegendIdent(tilesXCount, xi, yi);
      legends.push([ident, tileSprite]);
    }
  }

  return legends;
}

function fbNew(tilesXCount: number, tilesYCount: number): Framebuffer {
  let width = tilesXCount * 16;
  let height = tilesYCount * 16;

  let fbColor: Array<Color> = [];
  for (let i = 0; i < width * height; i++) {
    fbColor.push(0);
  }

  let fbDepth: Array<Depth> = [];
  for (let i = 0; i < width * height; i++) {
    fbDepth.push(0);
  }

  let map = "\n";

  for (let yi = 0; yi < tilesYCount; yi++) {
    for (let xi = 0; xi < tilesXCount; xi++) {
      let ident = fbGetLegendIdent(tilesXCount, xi, yi);
      map += ident;
    }
    map += "\n";
  }

  return {
    width,
    height,
    map,
    fbColor,
    fbDepth,
  };
}

function fbPut(
  fb: Framebuffer,
  x: number,
  y: number,
  z: number | null,
  color: Color
) {
  if (x < fb.width && x >= 0 && y < fb.height && y >= 0) {
    let idx = fb.width * Math.floor(y) + Math.floor(x);
    if (z != null && z < fb.fbDepth[idx]) {
      fb.fbDepth[idx] = z;
      fb.fbColor[idx] = color;
    } else if (z == null) {
      fb.fbColor[idx] = color;
    }
  }
}

function fbGetColor(fb: Framebuffer, x: number, y: number): Color {
  return fb.fbColor[y * fb.width + x];
}

function fbClearColor(fb: Framebuffer, color: Color) {
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      fb.fbColor[y * fb.width + x] = color;
    }
  }
}

// Read my note about depth at the top of the file.
function fbClearDepth(fb: Framebuffer, depth: Depth) {
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      fb.fbDepth[y * fb.width + x] = depth;
    }
  }
}

function fbRender(fb: Framebuffer, pass: RenderPass) {
  for (let i = 0; i < pass.triangles.length; i += 9) {
    let vertexA = [
      pass.triangles[i + 0 + 0],
      pass.triangles[i + 1 + 0],
      pass.triangles[i + 2 + 0],
    ] as Vec3;
    let vertexB = [
      pass.triangles[i + 0 + 3],
      pass.triangles[i + 1 + 3],
      pass.triangles[i + 2 + 3],
    ] as Vec3;
    let vertexC = [
      pass.triangles[i + 0 + 6],
      pass.triangles[i + 1 + 6],
      pass.triangles[i + 2 + 6],
    ] as Vec3;

    // Local Space => World Space
    let worldVertexA = vec4IntoVec3(
      mat4MulVec4(pass.modelMatrix, [...vertexA, 1])
    );
    let worldVertexB = vec4IntoVec3(
      mat4MulVec4(pass.modelMatrix, [...vertexB, 1])
    );
    let worldVertexC = vec4IntoVec3(
      mat4MulVec4(pass.modelMatrix, [...vertexC, 1])
    );

    let normal = vecNormalize(
      vec3CrossProduct(
        vecSubVec(worldVertexB, worldVertexA),
        vecSubVec(worldVertexC, worldVertexA)
      )
    );

    // Cull out faces that are away from the camera.
    let cullScalar = pass.cullScalar != null ? pass.cullScalar : 1;
    if (
      vecDot(normal, vecSubVec(worldVertexA, pass.cameraPosition)) *
        cullScalar <
      0
    ) {
      let view = mat4GetLookAt(
        pass.cameraPosition,
        vecAddVec(pass.cameraPosition, pass.cameraFront),
        [0, 1, 0]
      );
      
      // World Space => View Space
      let viewVertexA = vec4IntoVec3(mat4MulVec4(view, [...worldVertexA, 1]));
      let viewVertexB = vec4IntoVec3(mat4MulVec4(view, [...worldVertexB, 1]));
      let viewVertexC = vec4IntoVec3(mat4MulVec4(view, [...worldVertexC, 1]));

      // Depth clipping: remove triangles behind the camera.
      let clippedTriangles;
      if (pass.projection != null) {
        clippedTriangles = triangleClipPlane(
          [0, 0, pass.projection.near],
          [0, 0, 1],
          [viewVertexA, viewVertexB, viewVertexC]
        );
      } else {
        clippedTriangles = [[viewVertexA, viewVertexB, viewVertexC]];
      }
      for (let cti in clippedTriangles) {
        let triangle = clippedTriangles[cti];

        if (pass.projection != null) {
          let projectionData = pass.projection!;

          let projection = mat4GetProjection(
            1.0,
            projectionData.fov_rad,
            projectionData.near,
            projectionData.far
          );

          // View Space => Clip Space
          let projectedVertexA = mat4MulVec4(projection, [...triangle[0], 1]);
          let projectedVertexB = mat4MulVec4(projection, [...triangle[1], 1]);
          let projectedVertexC = mat4MulVec4(projection, [...triangle[2], 1]);

          vertexA = vec4IntoVec3(vec4ScaleWithW(projectedVertexA));
          vertexB = vec4IntoVec3(vec4ScaleWithW(projectedVertexB));
          vertexC = vec4IntoVec3(vec4ScaleWithW(projectedVertexC));
        }

        // Clip Space => Screen Space
        vertexA = vecAddScalar(vertexA, 1.0);
        vertexB = vecAddScalar(vertexB, 1.0);
        vertexC = vecAddScalar(vertexC, 1.0);
        vertexA[0] *= fb.width * 0.5;
        vertexB[0] *= fb.width * 0.5;
        vertexC[0] *= fb.width * 0.5;
        vertexA[1] *= fb.height * 0.5;
        vertexB[1] *= fb.height * 0.5;
        vertexC[1] *= fb.height * 0.5;
        vertexA[2] *= fb.width * 0.5;
        vertexB[2] *= fb.width * 0.5;
        vertexC[2] *= fb.width * 0.5;

        // Clip out vertices outside the view frustum.
        // New triangles may be formed here.
        let finalTriangles: [Vec3, Vec3, Vec3][] = [];
        finalTriangles.push([vertexA, vertexB, vertexC]);
        let testPlanes: [Vec3, Vec3][] = [
          [
            [0, 0, 0],
            [0, 1, 0],
          ],
          [
            [0, fb.height - 1, 0],
            [0, -1, 0],
          ],
          [
            [0, 0, 0],
            [1, 0, 0],
          ],
          [
            [fb.width - 1, 0, 0],
            [-1, 0, 0],
          ],
        ];
        for (let p in testPlanes) {
          let nextTests: [Vec3, Vec3, Vec3][] = [];
          for (let t in finalTriangles) {
            nextTests.push(
              ...triangleClipPlane(
                testPlanes[p][0],
                testPlanes[p][1],
                finalTriangles[t]
              )
            );
          }
          finalTriangles = nextTests;
        }

        // Draw the triangles left.
        for (let t in finalTriangles) {
          let finalTriangle = finalTriangles[t];
          let vertexA = finalTriangle[0] as Vec3;
          let vertexB = finalTriangle[1] as Vec3;
          let vertexC = finalTriangle[2] as Vec3;
          if (pass.borderColor != null) {
            fbDrawTriangle(
              fb,
              vertexA,
              vertexB,
              vertexC,
              pass.borderColor,
              pass.enableDepth!
            );
          }
          if (pass.colors != null) {
            let color: Color;
            if (
              typeof pass.colors != "string" &&
              typeof pass.colors != "number"
            ) {
              color = (pass.colors as Color[])[Math.floor(i / 9)];
            } else {
              color = pass.colors as Color;
            }
            color != null &&
              fbFillTriangle(
                fb,
                vertexA,
                vertexB,
                vertexC,
                color,
                pass.enableDepth!
              );
          }
        }
      }
    }
  }
}

function fbDrawTriangle(
  fb: Framebuffer,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  borderColor: Color,
  enableDepth: boolean
) {
  fbDrawLine(fb, a, b, borderColor, enableDepth);
  fbDrawLine(fb, b, c, borderColor, enableDepth);
  fbDrawLine(fb, a, c, borderColor, enableDepth);
}

function interpolate(i0: number, d0: number, i1: number, d1: number): number[] {
  if (i0 == i1) {
    return [d0];
  }

  var values = [];
  var a = (d1 - d0) / (i1 - i0);
  var d = d0;
  for (var i = i0; i <= i1; i++) {
    values.push(d);
    d += a;
  }

  return values;
}

function fbDrawLine(
  fb: Framebuffer,
  a: Vec3,
  b: Vec3,
  color: Color,
  enableDepth: boolean
) {
  var dx = b[0] - a[0];
  var dy = b[1] - a[1];

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      var swap = a;
      a = b;
      b = swap;
    }

    var ys = interpolate(a[0], a[1], b[0], b[1]);
    for (var x = a[0]; x <= b[0]; x += 1) {
      // Crude estimation of depth.
      fbPut(fb, x, ys[Math.floor(x - a[0])], enableDepth ? a[2] : null, color);
    }
  } else {
    if (dy < 0) {
      var swap = a;
      a = b;
      b = swap;
    }

    var xs = interpolate(a[1], a[0], b[1], b[0]);
    for (var y = a[1]; y <= b[1]; y += 1) {
      // Crude estimation of depth.
      fbPut(fb, xs[Math.floor(y - a[1])], y, enableDepth ? a[2] : null, color);
    }
  }
}

function fbFillTriangle(
  fb: Framebuffer,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  color: Color,
  enableDepth: boolean
) {
  if (b[1] < a[1]) {
    var swap = a;
    a = b;
    b = swap;
  }
  if (c[1] < a[1]) {
    var swap = a;
    a = c;
    c = swap;
  }
  if (c[1] < b[1]) {
    var swap = b;
    b = c;
    c = swap;
  }

  var x01 = interpolate(a[1], a[0], b[1], b[0]);
  var x12 = interpolate(b[1], b[0], c[1], c[0]);
  var x02 = interpolate(a[1], a[0], c[1], c[0]);

  x01.pop();
  x12.pop();
  x02.pop();
  var x012 = x01.concat(x12);

  var x_left, x_right;
  var m = Math.floor(x02.length / 2);
  if (x02[m] < x012[m]) {
    x_left = x02;
    x_right = x012;
  } else {
    x_left = x012;
    x_right = x02;
  }

  for (var y = a[1]; y <= c[1]; y += 1) {
    for (
      var x = x_left[Math.floor(y - a[1])];
      x <= x_right[Math.floor(y - a[1])];
      x += 1
    ) {
      // Crude estimation of depth.
      fbPut(fb, x, y, enableDepth ? a[2] : null, color);
    }
  }
}

// -- Matrix 4 Functions --

function mat4Identity(): Mat4 {
  return [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0],
  ];
}

function mat4Translate(mat: Mat4, translation: Vec3): Mat4 {
  let result = Array.from(mat) as Mat4;
  result[3][0] += translation[0];
  result[3][1] += translation[1];
  result[3][2] += translation[2];
  return result;
}

function mat4Scale(mat: Mat4, scale: Vec3): Mat4 {
  let result = Array.from(mat) as Mat4;
  result[0][0] *= scale[0];
  result[1][1] *= scale[1];
  result[2][2] *= scale[2];
  return result;
}

function mat4Rotate(mat: Mat4, angle: number, rot: Vec3): Mat4 {
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  let axis = vecNormalize(rot);
  let rot_mat = [
    [
      c + axis[0] * axis[0] * (1 - c),
      axis[0] * axis[1] * (1 - c) - axis[2] * s,
      axis[0] * axis[2] * (1 - c) + axis[1] * s,
      0.0,
    ],
    [
      axis[1] * axis[0] * (1 - c) + axis[2] * s,
      c + axis[1] * axis[1] * (1 - c),
      axis[1] * axis[2] * (1 - c) - axis[0] * s,
      0.0,
    ],
    [
      axis[2] * axis[0] * (1 - c) - axis[1] * s,
      axis[2] * axis[1] * (1 - c) + axis[0] * s,
      c + axis[2] * axis[2] * (1 - c),
      0.0,
    ],
    [0.0, 0.0, 0.0, 1.0],
  ] as Mat4;

  return mat4MulMat4(mat, rot_mat);
}

function mat4GetProjection(
  aspect: number,
  fov_rad: number,
  near: number,
  far: number
): Mat4 {
  return [
    [aspect / Math.tan(fov_rad / 2), 0.0, 0.0, 0.0],
    [0.0, 1 / Math.tan(fov_rad / 2), 0.0, 0.0],
    [0.0, 0.0, far / (far - near), 1.0],
    [0.0, 0.0, (-far * near) / (far - near), 0.0],
  ];
}

function mat4GetLookAt(position: Vec3, center: Vec3, up: Vec3): Mat4 {
  let dir = vecSubVec(center, position);
  let right = vecNormalize(vec3CrossProduct(up, dir));
  let matUp = vec3CrossProduct(dir, right);

  return [
    [right[0], matUp[0], dir[0], 0],
    [right[1], matUp[1], dir[1], 0],
    [right[2], matUp[2], dir[2], 0],
    [
      -vecDot(position, right),
      -vecDot(position, matUp),
      -vecDot(position, dir),
      1,
    ],
  ];
}

function mat4MulMat4(b: Mat4, a: Mat4): Mat4 {
  let result = mat4Identity();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      result[r][c] =
        b[r][0] * a[0][c] +
        b[r][1] * a[1][c] +
        b[r][2] * a[2][c] +
        b[r][3] * a[3][c];
    }
  }
  return result;
}

function mat4MulVec4(mat: Mat4, vec: Vec4): Vec4 {
  let result = [0, 0, 0, 0] as Vec4;

  result[0] =
    vec[0] * mat[0][0] +
    vec[1] * mat[1][0] +
    vec[2] * mat[2][0] +
    vec[3] * mat[3][0];
  result[1] =
    vec[0] * mat[0][1] +
    vec[1] * mat[1][1] +
    vec[2] * mat[2][1] +
    vec[3] * mat[3][1];
  result[2] =
    vec[0] * mat[0][2] +
    vec[1] * mat[1][2] +
    vec[2] * mat[2][2] +
    vec[3] * mat[3][2];
  result[3] =
    vec[0] * mat[0][3] +
    vec[1] * mat[1][3] +
    vec[2] * mat[2][3] +
    vec[3] * mat[3][3];

  return result;
}

// -- Vector 4 Functions --

function vec4ScaleWithW(vec: Vec4): Vec4 {
  let result = Array.from(vec) as Vec4;
  if (result[3] != 0) {
    result[0] /= result[3];
    result[1] /= result[3];
    result[2] /= result[3];
  }
  return result;
}

function vec4IntoVec3(vec: Vec4): Vec3 {
  return [vec[0], vec[1], vec[2]];
}

// -- Vector 3 Functions --

function vec3CrossProduct(a: Vec3, b: Vec3): Vec3 {
  let result = [0.0, 0.0, 0.0] as Vec3;
  result[0] = a[1] * b[2] - a[2] * b[1];
  result[1] = a[2] * b[0] - a[0] * b[2];
  result[2] = a[0] * b[1] - a[1] * b[0];
  return result;
}

// -- General Vector Functions --

function vecAddVec<V extends Vec3 | Vec4>(a: V, b: V): V {
  let result = Array.from(a) as V;
  for (let i = 0; i < a.length; i++) {
    result[i] += b[i];
  }
  return result;
}

function vecSubVec<V extends Vec3 | Vec4>(a: V, b: V): V {
  let result = Array.from(a) as V;
  for (let i = 0; i < a.length; i++) {
    result[i] -= b[i];
  }
  return result;
}

function vecDistance<V extends Vec3 | Vec4>(a: V, b: V): number {
  return vecLength(vecSubVec(b, a));
}

function vecAddScalar<V extends Vec3 | Vec4>(v: V, s: number): V {
  let result = Array.from(v) as V;
  for (let i = 0; i < v.length; i++) {
    result[i] += s;
  }
  return result;
}

function vecMulScalar<V extends Vec3 | Vec4>(a: V, b: number): V {
  let result = Array.from(a) as V;
  for (let i = 0; i < a.length; i++) {
    result[i] *= b;
  }
  return result;
}

function vecNormalize<V extends Vec3 | Vec4>(v: V): V {
  let length = vecLength(v);
  if (length == 0) {
    length += 0.00001;
  }
  return vecMulScalar(v, 1 / length);
}

function vecDot<V extends Vec3 | Vec4>(a: V, b: V): number {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }
  return result;
}

function vecLength<V extends Vec3 | Vec4>(v: V): number {
  let sqsum = 0;
  for (let i = 0; i < v.length; i++) {
    sqsum += v[i] * v[i];
  }
  return Math.sqrt(sqsum);
}

// -- Clipping --

function vecIntersectsPlane<V extends Vec3 | Vec4>(
  planePoint: V,
  planeNormal: V,
  lineStart: V,
  lineEnd: V
): V {
  let d = -vecDot(planeNormal, planePoint);
  let ad = vecDot(lineStart, planeNormal);
  let bd = vecDot(lineEnd, planeNormal);
  let td = bd - ad;
  if (td == 0) {
    td += 0.00001;
  }
  let t = (-d - ad) / td;
  let lineStartToEnd = vecSubVec(lineEnd, lineStart);
  let lineToIntersect = vecMulScalar(lineStartToEnd, t);
  return vecAddVec(lineStart, lineToIntersect);
}

function triangleClipPlane(
  planePoint: Vec3,
  planeNormal: Vec3,
  triangle: [Vec3, Vec3, Vec3]
): [Vec3, Vec3, Vec3][] {
  let dist = (point: Vec3): number => {
    return vecDot(planeNormal, point) - vecDot(planeNormal, planePoint);
  };

  let insidePoints = [];
  let outsidePoints = [];

  let d0 = dist(triangle[0]);
  let d1 = dist(triangle[1]);
  let d2 = dist(triangle[2]);

  if (d0 >= 0) {
    insidePoints.push(triangle[0]);
  } else {
    outsidePoints.push(triangle[0]);
  }
  if (d1 >= 0) {
    insidePoints.push(triangle[1]);
  } else {
    outsidePoints.push(triangle[1]);
  }
  if (d2 >= 0) {
    insidePoints.push(triangle[2]);
  } else {
    outsidePoints.push(triangle[2]);
  }

  if (insidePoints.length == 3) {
    return [triangle];
  }

  if (insidePoints.length == 1 && outsidePoints.length == 2) {
    return [
      [
        insidePoints[0],
        vecIntersectsPlane(
          planePoint,
          planeNormal,
          insidePoints[0],
          outsidePoints[0]
        ),
        vecIntersectsPlane(
          planePoint,
          planeNormal,
          insidePoints[0],
          outsidePoints[1]
        ),
      ],
    ];
  }

  if (insidePoints.length == 2 && outsidePoints.length == 1) {
    let ot = vecIntersectsPlane(
      planePoint,
      planeNormal,
      insidePoints[0],
      outsidePoints[0]
    );

    return [
      [insidePoints[0], insidePoints[1], ot],
      [
        insidePoints[1],
        ot,
        vecIntersectsPlane(
          planePoint,
          planeNormal,
          insidePoints[1],
          outsidePoints[0]
        ),
      ],
    ];
  }

  return [];
}

export {
  fbNew,
  fbGetRender,
  fbDrawLine,
  fbClearColor,
  fbClearDepth,
  fbRender,
  mat4MulMat4,
  mat4MulVec4,
  mat4Scale,
  mat4Rotate,
  mat4Translate,
  mat4Identity,
  vecAddVec,
  vecSubVec,
  vecLength,
  vecDistance,
  vecMulScalar,
  vecNormalize,
  vec3CrossProduct,
  vecIntersectsPlane,
  vecDot,
  type Framebuffer,
  type RenderPass,
  type ProjectionData,
  type Color,
  type Vec3,
  type Vec4,
  type Mat4,
};
