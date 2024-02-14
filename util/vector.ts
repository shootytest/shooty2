import { math } from "./math.js";

export interface vector { x: number, y: number };
export interface vector3 extends vector { z: number };
export interface AABB {
  min_x: number,
  max_x: number,
  min_y: number,
  max_y: number,
};
export interface AABB3 extends AABB {
  min_z: number,
  max_z: number,
};

export const vector = {
  create: (x = 0, y = 0): vector => {
    return {x, y};
  },
  create3: (v: vector3): vector => {
    return {
      x: v.x,
      y: v.y
    };
  },
  clone: (v: vector): vector => {
    return vector.create(v.x, v.y);
  },
  mult: (v: vector, scale: number): vector => {
    return {
      x: v.x * scale,
      y: v.y * scale,
    };
  },
  div: (v: vector, scale: number): vector => {
    return {
      x: v.x / scale,
      y: v.y / scale,
    };
  },
  add: (v1: vector, v2: vector): vector => {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y,
    };
  },
  sub: (v1: vector, v2: vector): vector => {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
    };
  },
  length2: (v: vector) => {
    return v.x * v.x + v.y * v.y;
  },
  length: (v: vector) => {
    return Math.sqrt(vector.length2(v));
  },
  normalise: (v: vector) => {
    let l = vector.length(v);
    if (!l) return v;
    return vector.div(v, l);
  },
  round: (v: vector) => {
    return vector.create(
      Math.round(v.x),
      Math.round(v.y),
    );
  },
  round_to: (v: vector, n: number = 1) => {
    return vector.create(
      math.round_to(v.x, n),
      math.round_to(v.y, n),
    );
  },
  createpolar: (theta: number, r = 1) => {
    return vector.create(r * Math.cos(theta), r * Math.sin(theta));
  },
  lerp: (v1: vector, v2: vector, t: number) => {
    return vector.add(vector.mult(v1, 1 - t), vector.mult(v2, t));
  },
  deg_to_rad: (degrees: number) => {
    return degrees / 180 * Math.PI;
  },
  rad_to_deg: (radians: number) => {
    return radians * 180 / Math.PI;
  },
  in_rect: (p: vector, x: number, y: number, w: number, h: number) => {
    return (p.x >= x && p.y >= y && p.x <= x + w && p.y <= y + h);
  },
  in_rectangle: (p: vector, x: number, y: number, w: number, h: number) => {
    return vector.in_rect(p, x - w / 2, y - h / 2, w, h);
  },
  in_aabb: (p: vector, aabb: AABB) => {
    return (p.x >= aabb.min_x && p.y >= aabb.min_y && p.x <= aabb.max_x && p.y <= aabb.max_y);
  },
  in_circle: (p: vector, c: vector, r: number) => {
    return vector.length2(vector.sub(p, c)) < r * r;
  },
  mean: (vertices: vector[]): vector => {
    let mean: vector = { x: 0, y: 0 };
    for (const v of vertices) {
      mean = vector.add(mean, v);
    }
    return vector.div(mean, vertices.length);
  },
  make_aabb: (vertices: vector[]): AABB => {
    let aabb: AABB = {
      min_x: vertices[0].x,
      max_x: vertices[0].x,
      min_y: vertices[0].y,
      max_y: vertices[0].y,
    };
    for (const v of vertices) {
      if (v.x < aabb.min_x) aabb.min_x = v.x;
      if (v.x > aabb.max_x) aabb.max_x = v.x;
      if (v.y < aabb.min_y) aabb.min_y = v.y;
      if (v.y > aabb.max_y) aabb.max_y = v.y;
    }
    return aabb;
  },
  aabb_intersect: (a: AABB, b: AABB): boolean => {
    return (a.min_x <= b.max_x && a.max_x >= b.min_x) &&
           (a.min_y <= b.max_y && a.max_y >= b.min_y);
  }
};

export const vector3 = {
  create: (x = 0, y = 0, z = 0): vector3 => {
    return {x, y, z};
  },
  create2: (v: vector, z = 0): vector3 => {
    return { x: v.x, y: v.y, z };
  },
  clone: (v: vector3): vector3 => {
    return vector3.create(v.x, v.y, v.z);
  },
  mult: (v: vector3, scale: number): vector3 => {
    return {
      x: v.x * scale,
      y: v.y * scale,
      z: v.z * scale
    };
  },
  mult2: (v: vector3, scale: number, z_scale: number = 1): vector3 => {
    return {
      x: v.x * scale,
      y: v.y * scale,
      z: v.z * z_scale
    };
  },
  div: (v: vector3, scale: number): vector3 => {
    return {
      x: v.x / scale,
      y: v.y / scale,
      z: v.z / scale
    };
  },
  add: (v1: vector3, v2: vector3): vector3 => {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y,
      z: v1.z + v2.z
    };
  },
  sub: (v1: vector3, v2: vector3): vector3 => {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
      z: v1.z - v2.z
    };
  },
  length2: (v: vector3) => {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  },
  length: (v: vector3) => {
    return Math.sqrt(vector3.length2(v));
  },
  normalise: (v: vector3) => {
    return vector3.div(v, vector3.length(v));
  },
  round: (v: vector3): vector3 => {
    return vector3.create(
      Math.round(v.x),
      Math.round(v.y),
      Math.round(v.z)
    );
  },
  round_to: (v: vector3, n: number = 1): vector3 => {
    return vector3.create(
      math.round_to(v.x, n),
      math.round_to(v.y, n),
      math.round_to(v.z, n)
    );
  },
  round_2: (v: vector3, n: number = 1): vector3 => {
    return vector3.create(
      math.round_to(v.x, n),
      math.round_to(v.y, n),
      v.z
    );
  },
  createpolar: (theta: number, r = 1, z = 0) => {
    return vector3.create(r * Math.cos(theta), r * Math.sin(theta), z);
  },
  lerp: (v1: vector3, v2: vector3, t: number) => {
    return vector3.add(vector3.mult(v1, 1 - t), vector3.mult(v2, t));
  },
  deg_to_rad: (degrees: number) => {
    return degrees / 180 * Math.PI;
  },
  rad_to_deg: (radians: number) => {
    return radians * 180 / Math.PI;
  },
  mean: (vertices: vector3[]): vector3 => {
    let mean: vector3 = { x: 0, y: 0, z: 0, };
    for (const v of vertices) {
      mean = vector3.add(mean, v);
    }
    return vector3.div(mean, vertices.length);
  },
  make_aabb: (vertices: vector3[]): AABB3 => {
    let aabb: AABB3 = {
      min_x: vertices[0].x,
      max_x: vertices[0].x,
      min_y: vertices[0].y,
      max_y: vertices[0].y,
      min_z: vertices[0].z,
      max_z: vertices[0].z,
    };
    for (const v of vertices) {
      if (v.x < aabb.min_x) aabb.min_x = v.x;
      if (v.x > aabb.max_x) aabb.max_x = v.x;
      if (v.y < aabb.min_y) aabb.min_y = v.y;
      if (v.y > aabb.max_y) aabb.max_y = v.y;
      if (v.z < aabb.min_z) aabb.min_z = v.z;
      if (v.z > aabb.max_z) aabb.max_z = v.z;
    }
    return aabb;
  },
  aabb_intersect: (a: AABB3, b: AABB3): boolean => {
    return (a.min_x <= b.max_x && a.max_x >= b.min_x) &&
           (a.min_y <= b.max_y && a.max_y >= b.min_y) &&
           (a.min_z <= b.max_z && a.max_z >= b.min_z);
  }
};