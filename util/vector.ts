import { math } from "./math.js";

export interface vector { x: number, y: number };
export interface vector3 extends vector { z: number };
export interface vector3_ extends vector { z?: number };
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
export interface circle extends vector {
  r: number,
};
export interface segment {
  p1: segment_point,
  p2: segment_point,
  d: number,
};
export interface segment_point extends vector {
  angle: number,
  begin: boolean,
  segment?: segment,
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
  clone_list: (vs: vector[]): vector[] => {
    const result: vector[] = [];
    for (const v of vs) {
      result.push(vector.clone(v));
    }
    return result;
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
  adds: (vs: vector[], v2: vector): vector[] => {
    const result = [];
    for (const v1 of vs) {
      result.push(vector.add(v1, v2));
    }
    return result;
  },
  sub: (v1: vector, v2: vector): vector => {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
    };
  },
  equal: (v1: vector, v2: vector): boolean => {
    return Math.abs(v1.x - v2.x) < math.epsilon && Math.abs(v1.y - v2.y) < math.epsilon;
  },
  length2: (v: vector) => {
    return v.x * v.x + v.y * v.y;
  },
  length: (v: vector) => {
    return Math.sqrt(vector.length2(v));
  },
  normalise: (v: vector, mult = 1) => {
    let l = vector.length(v) / mult;
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
  direction: (v: vector) => {
    return Math.atan2(v.y, v.x);
  },
  createpolar: (theta: number, r = 1) => {
    return vector.create(r * Math.cos(theta), r * Math.sin(theta));
  },
  createpolar_deg: (theta: number, r = 1) => {
    return vector.createpolar(vector.deg_to_rad(theta), r);
  },
  lerp: (v1: vector, v2: vector, t: number): vector => {
    return vector.add(vector.mult(v1, 1 - t), vector.mult(v2, t));
  },
  deg_to_rad: (degrees: number): number => {
    return degrees / 180 * Math.PI;
  },
  rad_to_deg: (radians: number): number => {
    return radians * 180 / Math.PI;
  },
  rad_to_vector: (radians: number): vector => { // copy of createpolar
    return vector.create(Math.cos(radians), Math.sin(radians));
  },
  rotate: (center: vector, v: vector, angle: number): vector => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = (cos * (v.x - center.x)) - (sin * (v.y - center.y)) + center.x;
    const ny = (cos * (v.y - center.y)) + (sin * (v.x - center.x)) + center.y;
    return vector.create(nx, ny);
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
  centroid: (vertices: vector[]): vector => {
    const first = vertices[0], last = vertices[vertices.length-1];
    if (first.x != last.x || first.y != last.y) vertices.push(first);
    let twice_area = 0, x = 0, y = 0, n = vertices.length, p1, p2, f;
    for (var i = 0, j = n - 1; i < n; j = i++) {
        p1 = vertices[i];
        p2 = vertices[j];
        f = p1.x * p2.y - p2.x * p1.y;
        twice_area += f;          
        x += (p1.x + p2.x) * f;
        y += (p1.y + p2.y) * f;
    }
    f = twice_area * 3;
    return { x: x / f, y: y / f, };
  },
  dot: (v1: vector, v2: vector): number => {
    return v1.x * v2.x + v1.y * v2.y;
  },
  hypot2: (v1: vector, v2: vector): number => {
    return vector.dot(vector.sub(v1, v2), vector.sub(v1, v2));
  },
  proj: (v1: vector, v2: vector) => {
    const k = vector.dot(v1, v2) / vector.dot(v2, v2);
    return vector.create(k * v2.x, k * v2.y);
  },
  make_aabb: (vertices: vector[] = []): AABB => {
    let aabb: AABB = {
      min_x: Number.POSITIVE_INFINITY,
      max_x: Number.NEGATIVE_INFINITY,
      min_y: Number.POSITIVE_INFINITY,
      max_y: Number.NEGATIVE_INFINITY,
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
  },
  aabb_combine: (a: AABB, b: AABB): AABB => {
    return {
      min_x: Math.min(a.min_x, b.min_x),
      max_x: Math.max(a.max_x, b.max_x),
      min_y: Math.min(a.min_y, b.min_y),
      max_y: Math.max(a.max_y, b.max_y),
    };
  },
  aabb_add: (a: AABB, v: vector): AABB => {
    return {
      min_x: a.min_x + v.x,
      max_x: a.max_x + v.x,
      min_y: a.min_y + v.y,
      max_y: a.max_y + v.y,
    };
  },
  aabb2v: (a: AABB): vector => {
    return {
      x: a.max_x - a.min_x,
      y: a.max_y - a.min_y,
    };
  },
  aabb2bounds: (a: AABB): { min: vector, max: vector } => {
    return {
      min: vector.create(a.min_x, a.min_y),
      max: vector.create(a.max_x, a.max_y)
    };
  },
  aabb2vs: (a: AABB): vector[] => {
    return [
      { x: a.min_x, y: a.min_y },
      { x: a.max_x, y: a.max_y },
    ];
  },
  aabb_centre: (a: AABB): vector => {
    return {
      x: (a.max_x + a.min_x) / 2,
      y: (a.max_y + a.min_y) / 2,
    };
  },
};

export const vector3 = {
  create: (x = 0, y = 0, z = 0): vector3 => {
    return {x, y, z};
  },
  create_: (v: vector3_, z = 0): vector3 => {
    return { x: v.x, y: v.y, z: v.z === undefined ? z : v.z };
  },
  create_many: (v_list: vector3_[], z = 0): vector3[] => {
    const result: vector3[] = [];
    for (const v of v_list) {
      result.push(vector3.create_(v, z));
    }
    return result;
  },
  create2: (v: vector, z = 0): vector3 => {
    return { x: v.x, y: v.y, z };
  },
  clone: (v: vector3): vector3 => {
    return vector3.create(v.x, v.y, v.z);
  },
  clone_list: (vs: vector3[]): vector3[] => {
    const result: vector3[] = [];
    for (const v of vs) {
      result.push(vector3.clone(v));
    }
    return result;
  },
  clone_list_: (vs: vector3_[]): vector3_[] => {
    const result: vector3_[] = [];
    for (const v of vs) {
      const v_ = { x: v.x, y: v.y } as vector3_;
      if (v.z) v_.z = v.z;
      result.push(v_);
    }
    return result;
  },
  flatten: (v: vector, z = 0): vector3 => {
    return { x: v.x, y: v.y, z };
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
  neg: (v: vector3): vector3 => {
    return {
      x: -v.x,
      y: -v.y,
      z: -v.z
    };
  },
  neg2: (v: vector3): vector3 => {
    return {
      x: -v.x,
      y: -v.y,
      z: v.z
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
  add_list: (vs: vector3[], v_add: vector3_): vector3[] => {
    const result: vector3[] = [];
    const v2 = vector3.create_(v_add);
    for (const v1 of vs) {
      result.push(vector3.add(v1, v2));
    }
    return result;
  },
  add_to_list: (vs: vector3[], v_add: vector3_): void => {
    for (const v of vs) {
      v.x += v_add.x;
      v.y += v_add.y;
      if (v_add.z !== undefined) v.z += v_add.z;
    }
    return;
  },
  scale_to_list: (vs: vector3[], v_scale: vector3_): void => {
    for (const v of vs) {
      v.x *= v_scale.x;
      v.y *= v_scale.y;
      if (v_scale.z !== undefined) v.z *= v_scale.z;
    }
    return;
  },
  mult_to_list: (vs: vector3[], mult: number): void => {
    for (const v of vs) {
      v.x *= mult;
      v.y *= mult;
      v.z *= mult;
    }
    return;
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
  createpolar_deg: (theta: number, r = 1, z = 0) => {
    return vector3.createpolar(vector3.deg_to_rad(theta), r, z);
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
  centroid: (vertices: vector3[]): vector3 => {
    const first = vertices[0], last = vertices[vertices.length-1];
    if (first.x != last.x || first.y != last.y) vertices.push(first);
    let twice_area = 0, x = 0, y = 0, z = 0, n = vertices.length, p1, p2, f;
    for (var i = 0, j = n - 1; i < n; j = i++) {
        p1 = vertices[i];
        p2 = vertices[j];
        f = p1.x * p2.y - p2.x * p1.y;
        twice_area += f;
        x += (p1.x + p2.x) * f;
        y += (p1.y + p2.y) * f;
    }
    for (const v of vertices) z += v.z;
    f = twice_area * 3;
    return { x: x / f, y: y / f, z: z / vertices.length };
  },
  make_aabb: (vertices: vector3[]): AABB3 => {
    let aabb: AABB3 = {
      min_x: Number.POSITIVE_INFINITY,
      max_x: Number.NEGATIVE_INFINITY,
      min_y: Number.POSITIVE_INFINITY,
      max_y: Number.NEGATIVE_INFINITY,
      min_z: Number.POSITIVE_INFINITY,
      max_z: Number.NEGATIVE_INFINITY,
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
  },
  aabb_combine: (a: AABB3, b: AABB3): AABB3 => {
    return {
      min_x: Math.min(a.min_x, b.min_x),
      max_x: Math.max(a.max_x, b.max_x),
      min_y: Math.min(a.min_y, b.min_y),
      max_y: Math.max(a.max_y, b.max_y),
      min_z: Math.min(a.min_z, b.min_z),
      max_z: Math.max(a.max_z, b.max_z),
    };
  },
  aabb_add: (a: AABB3, v: vector3): AABB3 => {
    return {
      min_x: a.min_x + v.x,
      max_x: a.max_x + v.x,
      min_y: a.min_y + v.y,
      max_y: a.max_y + v.y,
      min_z: a.min_z + v.z,
      max_z: a.max_z + v.z,
    };
  },
  aabb2v: (a: AABB3): vector3 => {
    return {
      x: a.max_x - a.min_x,
      y: a.max_y - a.min_y,
      z: a.max_z - a.min_z,
    };
  },
  aabb2vs: (a: AABB3): vector3[] => {
    return [
      { x: a.min_x, y: a.min_y, z: a.min_z },
      { x: a.max_x, y: a.max_y, z: a.max_z },
    ];
  },
  aabb_centre: (a: AABB3): vector3 => {
    return {
      x: (a.max_x + a.min_x) / 2,
      y: (a.max_y + a.min_y) / 2,
      z: (a.max_z + a.min_z) / 2,
    };
  },

};