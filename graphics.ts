type Color = number | string;

interface Framebuffer {
  width: number;
  height: number;
  fb: Color[];
}

//  Row major
type Mat4 = [Vec4, Vec4, Vec4, Vec4];

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

interface ProjectionData {
  fov_rad: number;
  near: number;
  far: number;
}

interface RenderPass {
  cameraFront: Vec3;
  cameraPosition: Vec3;
  triangles: number[];
  modelMatrix: Mat4 | null | undefined;
  projection: ProjectionData | null | undefined;
  colors: Color | Color[] | null | undefined;
  borderColor: Color | null | undefined;
  cullScalar: number | null;
}

interface Render {
  legends: string[][];
  solids: string[];
  map: string;
}

function fbGetRender(
  fb: Framebuffer,
  tilesXCount: number,
  tilesYCount: number
): Render {
  let legends = [];
  let solids = [];
  let map = "\n";

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
      let ident = String.fromCharCode(xi + tilesXCount * yi + 48);
      map += ident;
      solids.push(ident);
      legends.push([ident, tileSprite]);
    }
    map += "\n";
  }

  return {
    legends,
    solids,
    map,
  };
}

function fbNew(width: number, height: number): Framebuffer {
  let fb: Array<Color> = [];
  for (let i = 0; i < width * height; i++) {
    fb.push(0);
  }

  return {
    width,
    height,
    fb,
  };
}

function fbPut(fb: Framebuffer, x: number, y: number, color: Color) {
  if (x < fb.width && x >= 0 && y < fb.height && y >= 0) {
    fb.fb[fb.width * Math.floor(y) + Math.floor(x)] = color;
  }
}

function fbGetColor(fb: Framebuffer, x: number, y: number): Color {
  return fb.fb[y * fb.width + x];
}

function fbClearColor(fb: Framebuffer, color: Color) {
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      fb.fb[y * fb.width + x] = color;
    }
  }
}

function fbRender(fb: Framebuffer, pass: RenderPass) {
  let triangles: number[] = [];

  if (pass.projection) {
    let projectionData = pass.projection!;
    for (let i = 0; i < pass.triangles.length; i += 3) {
      let vec4 = [
        pass.triangles[i + 0],
        pass.triangles[i + 1],
        pass.triangles[i + 2],
        1.0,
      ] as Vec4;

      let projection = mat4GetProjection(
        1.0,
        projectionData.fov_rad,
        projectionData.near,
        projectionData.far
      );

      let projected = vec4;

      let modelView = null;
      modelView = pass.modelMatrix;
      let view = mat4GetLookAt(
        pass.cameraPosition,
        vecAddVec(pass.cameraPosition, pass.cameraFront),
        [0, 1, 0]
      );
      if (modelView != null) {
        modelView = mat4MulMat4(modelView, view);
      } else {
        modelView = view;
      }
      modelView = mat4MulMat4(modelView, projection);
      projected = mat4MulVec4(modelView, projected);
      // projected = mat4MulVec4(projection, projected);

      projected = vec4ScaleWithW(projected);

      triangles.push(projected[0]);
      triangles.push(projected[1]);
      triangles.push(projected[2]);
    }
  } else {
    triangles = Array.from(pass.triangles);
  }

  for (let i = 0; i < triangles.length; i += 9) {
    let vertexA = [
      triangles[i + 0 + 0],
      triangles[i + 1 + 0],
      triangles[i + 2 + 0],
    ] as Vec3;
    let vertexB = [
      triangles[i + 0 + 3],
      triangles[i + 1 + 3],
      triangles[i + 2 + 3],
    ] as Vec3;
    let vertexC = [
      triangles[i + 0 + 6],
      triangles[i + 1 + 6],
      triangles[i + 2 + 6],
    ] as Vec3;

    let normal = vecNormalize(
      vec3CrossProduct(
        vecAddVec(vertexA, vecMulScalar(vertexB, -1)),
        vecAddVec(vertexA, vecMulScalar(vertexC, -1))
      )
    );

    let viewToVertex = vecNormalize(
      vecAddVec(vertexA, vecMulScalar(pass.cameraPosition, -1))
    );

    let dot = vecDot(normal, viewToVertex);
    pass.cullScalar != null && (dot *= pass.cullScalar);

    if (dot < 0.0) {
      vertexA = vecAddScalar(vertexA, 1.0);
      vertexB = vecAddScalar(vertexB, 1.0);
      vertexC = vecAddScalar(vertexC, 1.0);

      vertexA[0] *= fb.width * 0.5;
      vertexB[0] *= fb.width * 0.5;
      vertexC[0] *= fb.width * 0.5;

      vertexA[1] *= fb.height * 0.5;
      vertexB[1] *= fb.height * 0.5;
      vertexC[1] *= fb.height * 0.5;

      if (pass.borderColor != null) {
        fbDrawTriangle(fb, vertexA, vertexB, vertexC, pass.borderColor);
      }
      if (pass.colors != null) {
        let color: Color;
        if (typeof pass.colors != "string" && typeof pass.colors != "number") {
          color = (pass.colors as Color[])[Math.floor(i / 9)];
        } else {
          color = pass.colors as Color;
        }
        color != null && fbFillTriangle(fb, vertexA, vertexB, vertexC, color);
      }
    }
  }
}

function fbDrawTriangle(
  fb: Framebuffer,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  borderColor: Color
) {
  fbDrawLine(fb, a, b, borderColor);
  fbDrawLine(fb, b, c, borderColor);
  fbDrawLine(fb, a, c, borderColor);
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

function fbDrawLine(fb: Framebuffer, a: Vec3, b: Vec3, color: Color) {
  var dx = b[0] - a[0];
  var dy = b[1] - a[1];

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      var swap = a;
      a = b;
      b = swap;
    }

    var ys = interpolate(a[0], a[1], b[0], b[1]);
    for (var x = a[0]; x <= b[0]; x += 0.3) {
      fbPut(fb, x, ys[Math.floor(x - a[0])], color);
    }
  } else {
    if (dy < 0) {
      var swap = a;
      a = b;
      b = swap;
    }

    var xs = interpolate(a[1], a[0], b[1], b[0]);
    for (var y = a[1]; y <= b[1]; y += 0.3) {
      fbPut(fb, xs[Math.floor(y - a[1])], y, color);
    }
  }
}

function fbFillTriangle(
  fb: Framebuffer,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  color: Color
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

  for (var y = a[1]; y <= c[1]; y += 0.3) {
    for (
      var x = x_left[Math.floor(y - a[1])];
      x <= x_right[Math.floor(y - a[1])];
      x += 0.3
    ) {
      fbPut(fb, x, y, color);
    }
  }
}

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
  let s = Math.sin(angle);
  let c = Math.cos(angle);
  let rot_mat = [
    [
      c + rot[0] * rot[0] * (1 - c),
      rot[0] * rot[1] * (1 - c),
      rot[0] * rot[2] * (1 - c) + rot[1] * s,
      0.0,
    ],
    [
      rot[1] * rot[0] * (1 - c) + rot[2] * s,
      c + rot[0] * rot[0] * (1 - c),
      rot[1] * rot[2] * (1 - c) - rot[0] * s,
      0.0,
    ],
    [
      rot[2] * rot[0] * (1 - c) - rot[1] * s,
      rot[2] * rot[1] * (1 - c) + rot[0] * s,
      c + rot[2] * rot[2] * (1 - c),
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

function vec4ScaleWithW(vec: Vec4): Vec4 {
  let result = Array.from(vec) as Vec4;
  result[0] /= result[3] + 0.0001;
  result[1] /= result[3] + 0.0001;
  result[2] /= result[3] + 0.0001;
  return result;
}

function vec3CrossProduct(a: Vec3, b: Vec3): Vec3 {
  let result = [0.0, 0.0, 0.0] as Vec3;
  result[0] = a[1] * b[2] - a[2] * b[1];
  result[1] = a[2] * b[0] - a[0] * b[2];
  result[2] = a[0] * b[1] - a[1] * b[0];
  return result;
}

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
  let length = vecLength(v) + 0.0001;
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

export {
  fbNew,
  fbGetRender,
  fbDrawLine,
  fbClearColor,
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
  type Render,
  type RenderPass,
  type ProjectionData,
  type Color,
  type Vec3,
  type Vec4,
  type Mat4,
};
