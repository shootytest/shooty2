import { Common } from "../matter.js";
import { vector, vector3 } from "./vector.js";

export const math = {

  // why???
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sqrt: Math.sqrt,
  max: Math.max,
  min: Math.min,
  abs: Math.abs,
  floor: Math.floor,
  round: Math.round,
  ceil: Math.ceil,
  pi: Math.PI,
  two_pi: Math.PI * 2,
  epsilon_bigger: 0.001,
  epsilon: 0.000001,
  epsilon_smaller: 0.000000001,
  sqrt2: Math.sqrt(2),
  sqrt3: Math.sqrt(3),
  halfsqrt2: Math.sqrt(2) / 2,
  halfsqrt3: Math.sqrt(3) / 2,

  a_bit_equal: (a: number, b: number): boolean => {
    return Math.abs(a - b) < math.epsilon_bigger;
  },
  equal: (a: number, b: number): boolean => {
    return Math.abs(a - b) < math.epsilon;
  },
  very_equal: (a: number, b: number): boolean => {
    return Math.abs(a - b) < math.epsilon_smaller;
  },

  dist2: (x: number, y: number): number => {
    return x * x + y * y;
  },
  dist: (x: number, y: number): number => {
    return Math.sqrt(math.dist2(x, y));
  },
  dist2_v: (p1: vector, p2: vector): number => {
    return math.dist2(p2.x - p1.x, p2.y - p1.y);
  },
  dist_v: (p1: vector, p2: vector): number => {
    return Math.sqrt(math.dist2_v(p1, p2));
  },

  atan2_v: (v: vector): number => {
    return Math.atan2(v.y, v.x);
  },

  lerp: (a: number, b: number, t: number): number => {
    return a * (1 - t) + b * t;
  },
  lerp_angle: (a: number, b: number, t: number): number => {
    return vector.direction(vector.add(vector.mult(vector.rad_to_vector(a), (1 - t)), vector.mult(vector.rad_to_vector(b), t)));
  },
  lerp_circle: (a: number, b: number, mod: number, t: number): number => {
    if (Math.abs(b - a) - mod / 2 < mod * 0.1) return math.lerp(a, b, t);
    const m = Math.PI * 2 / mod;
    return math.lerp_angle(a * m, b * m, t) / m;
  },
  lerp_color: (ca: string, cb: string, t: number): string => {
    const [rA, gA, bA] = ca.match(/\w\w/g)?.map((c: string) => parseInt(c, 16)) || [0, 0, 0];
    const [rB, gB, bB] = cb.match(/\w\w/g)?.map((c: string) => parseInt(c, 16)) || [0, 0, 0];
    const r = Math.round(rA + (rB - rA) * t).toString(16).padStart(2, "0");
    const g = Math.round(gA + (gB - gA) * t).toString(16).padStart(2, "0");
    const b = Math.round(bA + (bB - bA) * t).toString(16).padStart(2, "0");
    return "#" + r + g + b;
  },
  bounce: (time: number, period: number): number => {
    return Math.abs(period - time % (period * 2)) / period;
  },
  bound: (n: number, min: number, max: number): number => {
    return Math.max(Math.min(n, max), min);
  },

  component_to_hex: (component: number): string => {
    const hex = Math.round(component).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  },

  _randgen: new alea(),
  _randgens: {} as { [key: string]: alea },
  randseed: (seed: string) => {
    math._randgen = new alea(seed);
  },
  rand: (a = 1, b?: number): number => {
    if (b != undefined) {
      return a + math._randgen() * (b - a);
    } else {
      return math._randgen() * a;
    }
  },
  randangle: (): number => {
    return math.rand(0, math.two_pi);
  },
  randvector: (max_length: number = 1): vector => {
    return vector.createpolar(math.randangle(), max_length * math.sqrt(math.rand()));
  },
  randint: (a: number, b: number): number => {
    return Math.floor(math.rand(a, b + 1));
  },
  randbool: (): boolean => {
    return math._randgen() > 0.5;
  },
  randgauss: (mean: number, deviation: number): number => {
    if (deviation === 0) return mean;
    let x1, x2, w;
    do {
      x1 = 2 * math._randgen() - 1;
      x2 = 2 * math._randgen() - 1;
      w = x1 * x1 + x2 * x2;
    } while (0 === w || w >= 1);
    w = Math.sqrt(-2 * Math.log(w) / w);
    return mean + deviation * x1 * w;
  },
  randstring: (length = 10): string => {
    const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += letters.charAt(
        Math.floor(math._randgen() * letters.length),
      );
    }
    return result;
  },
  randpick: function<T>(array: T[]): T {
    return array[math.randint(0, array.length - 1)];
  },
  randpick_weighted: function<T>(array: T[], weights: number[]): T {
    let r = math._randgen();
    let total = 0, running = 0;
    for (const w of weights) total += w;
    r *= total;
    for (let i = 0; i < array.length; i++) {
      running += weights[i];
      if (r < running) return array[i];
    }
    return array[array.length - 1];
  },
  prng_array: (seed: string, length: number, fn: (n: number) => number = (n) => n) => { // lol
    const gen = new alea(seed);
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
      result.push(fn(gen()));
    }
    return result;
  },

  log_base: (a: number, b: number): number => {
    return Math.log(a) / Math.log(b);
  },
  log_clamp: (value: number, min: number, max: number): number => {
    return value * min / Math.pow(max / min, Math.floor(math.log_base(value, max / min)));
  },

  fastround: (value: number): number => { // obsolete (just as fast as math.round)
    return (value + (value > 0 ? 0.5 : -0.5)) << 0;
  },
  round_dp: (value: number, decimals: number): number => {
    if (math.abs(value) < Number('1e' + -decimals) / 2) return 0;
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e' + -decimals);
  },
  round_to: (value: number, multiple: number): number => {
    return Math.round(value / multiple) * multiple;
  },
  round_z: (z: number): number => {
    return Math.round(z * 1000) / 1000;
  },

  point_in_rect: (px: number, py: number, x: number, y: number, w: number, h: number): boolean => {
    return (px >= x && py >= y && px <= x + w && py <= y + h);
  },
  point_in_rectangle: (px: number, py: number, x: number, y: number, w: number, h: number): boolean => {
    return math.point_in_rect(px, py, x - w / 2, y - h / 2, w, h);
  },
  point_in_circle: (px: number, py: number, cx: number, cy: number, r: number): boolean => {
    return math.dist2(px - cx, py - cy) < r * r;
  },

  expand_line: (v1: vector, v2: vector, width: number): vector[] => {
    const v0 = vector.mean([v1, v2]);
    const v3 = vector.sub(v1, v2);
    const h = vector.length(v3) + width;
    const w = width;
    const { x, y } = v0;
    const a = math.atan2(-v3.x, v3.y); // math.atan(-v3.y / v3.x) + Math.PI / 2;
    const vs = [w / 2 * Math.cos(a), h / 2 * Math.sin(a), w / 2 * Math.sin(a), h / 2 * Math.cos(a)];
    const result: vector[] = [
      vector.create(x + vs[0] - vs[1], y + vs[2] + vs[3]),
      vector.create(x - vs[0] - vs[1], y - vs[2] + vs[3]),
      vector.create(x - vs[0] + vs[1], y - vs[2] - vs[3]),
      vector.create(x + vs[0] + vs[1], y + vs[2] - vs[3]),
    ];
    return result;
  },
  expand_lines: (vertices: vector3[], width: number): [vector[][], number[]] => {
    if (vertices.length < 2) {
      return [[[]], [0]];
    } else if (vertices.length === 2) {
      return [[math.expand_line(vertices[0], vertices[1], width)], [(vertices[0].z + vertices[1].z) / 2]];
    } else {
      const result: vector[][] = [];
      const zs: number[] = [];
      for (let i = 0; i < vertices.length - 1; i++) {
        if (vector.equal(vertices[i], vertices[i + 1]) || !math.equal(vertices[i].z, vertices[i + 1].z)) continue;
        const vs = math.expand_line(vertices[i], vertices[i + 1], width);
        result.push(vs);
        zs.push(vertices[i].z);
      }
      return [result, zs];
    }
  },
  expand_lines_working_i_guess_but_too_many_vertices: (vertices: vector[], width: number): vector[] => {
    if (vertices.length < 2) {
      return [];
    } else if (vertices.length === 2) {
      return math.expand_line(vertices[0], vertices[1], width);
    } else {
      const points: number[][] = [];
      for (const v of vertices) {
        points.push([v.x, v.y]);
      }
      const result: vector[] = [];
      const offset = new Common.polygonOffset();
      console.log(offset.data(points).offsetLine(width / 2));
      for (const vs of offset.data(points).offsetLine(width / 2)) {
        for (const v of vs) {
          result.push(vector.create(v[0], v[1]));
        }
      }
      return result;
    }
  },
  expand_lines_failed_skill_issue: (vertices: vector[], width: number): vector[] => {
    if (vertices.length < 2) {
      return [];
    } else if (vertices.length === 2) {
      return math.expand_line(vertices[0], vertices[1], width);
    }
    let v1: vector | undefined, v2: vector | undefined;
    const result_left: vector[] = [];
    const result_right: vector[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const vs = math.expand_line(vertices[i], vertices[i + 1], width);
      if (v1 === undefined || v2 === undefined) {
        result_left.push(vs[1]);
        result_right.push(vs[0]);
      } else {
        result_left.push(vector.mean([vs[0], v1]));
        result_right.push(vector.mean([vs[1], v2]));
      }
      v1 = vs[3];
      v2 = vs[2];
    }
    if (v2) result_left.push(v2);
    if (v1) result_right.push(v1);
    return result_left.concat(result_right.reverse());
  },
  expand_polygon: (vertices: vector[], width: number): vector[] => {
    if (Common.expand) {
      return Common.expand(vertices, width); // yay
    } else {
      // fallback to polygonOffset
      const points: number[][] = [];
      for (const v of vertices) {
        points.push([v.x, v.y]);
      }
      const result: vector[] = [];
      const offset = new Common.polygonOffset();
      for (const vs of offset.data(points).margin(width)) {
        for (const v of vs) {
          result.push(vector.create(v[0], v[1]));
        }
      }
      console.log(result);
      return result;
    }
  },
  expand_polygon_what_am_i_doing_this_definitely_wont_work: (vertices: vector[], width: number): vector[] => {
    const centre = vector.mean(vertices);
    const result: vector[] = [];
    for (const v of vertices) {
      result.push(vector.add(v, vector.createpolar(-vector.direction(vector.sub(v, centre)), width)));
    }
    return result;
  },

  triangulate_polygon: (vertices: vector[]): vector[][] => {
    const result: vector[][] = [];
    const flattened: number[] = [];
    for (const v of vertices) flattened.push(v.x, v.y);
    const triangulated = Common.earcut(flattened);
    for (let i = 0; i < triangulated.length; i += 3) {
      result.push([
        vector.clone(vertices[triangulated[i]]),
        vector.clone(vertices[triangulated[i + 1]]),
        vector.clone(vertices[triangulated[i + 2]]),
      ]);
    }
    // for (const triangle of triangulated) {
    //   result.push(triangle.map(coords => (vector.create(coords[0], coords[1]))));
    // }
    return result;
  },

  union_polygons: (polygons: vector[][]): vector[][] => {
    if (Common.union) {
      return Common.union(polygons);
    } else {
      return polygons;
    }
  },

  triangle_area: (triangle: vector[]): number => {
    const [a, b, c] = triangle;
    return 0.5 * ( (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  },

  circle_area: (radius: number): number => {
    return radius * radius * Math.PI;
  },

  polygon_area: (sides: number, radius: number): number => {
    return radius * radius * sides / 2 * Math.sin(math.two_pi / sides);
  },

  rand_point_in_circle: (centre: vector, radius: number): vector => {
    if (radius <= 0) return vector.clone(centre);
    return vector.add(centre, vector.createpolar(math.rand(0, Math.PI * 2), radius * math.sqrt(math.rand())));
  },

  rand_point_in_polygon: (vertices: vector[]): vector => {
    if (vertices.length === 1) return vertices[0];
    else if (vertices.length === 2) return vector.lerp(vertices[0], vertices[1], math.rand());
    const triangles = math.triangulate_polygon(vertices);
    const total_area = triangles.reduce((sum, triangle) => sum + math.triangle_area(triangle), 0);
    const distribution: number[] = [];
    for (let i = 0; i < triangles.length; i++) {
      const last = distribution[i - 1] || 0;
      const next = last + (math.triangle_area(triangles[i]) / total_area);
      distribution.push(next);
    }
    // choose a triangle
    const rand = math.rand();
    const t_index = distribution.findIndex(v => v > rand);
    const [a, b, c] = triangles[t_index];
    let r1 = math.rand(), r2 = math.rand();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    return vector.add_all(a, vector.mult(vector.sub(b, a), r1), vector.mult(vector.sub(c, a), r2));
  },

  is_point_in_polygon: (point: vector, polygon: vector[]): boolean => { // from metafloor/pointinpoly (MIT license)
    // if (Common.point_in_polygon) {
    //   return Common.point_in_polygon(point, polygon);
    // }
    const { x, y } = point;
    let c = false;
    for (let l = polygon.length, i = 0, j = l-1; i < l; j = i++) {
      const xj = polygon[j].x, yj = polygon[j].y, xi = polygon[i].x, yi = polygon[i].y;
      const where = (yi - yj) * (x - xi) - (xi - xj) * (y - yi);
      if (yj < yi) {
        if (y >= yj && y < yi) {
          if (where == 0) return true; // point on the line
          if (where > 0) {
            if (y == yj) { // ray intersects vertex
              if (y > polygon[j == 0 ? l-1 : j-1].y) {
                c = !c;
              }
            } else {
              c = !c;
            }
          }
        }
      } else if (yi < yj) {
        if (y > yi && y <= yj) {
          if (where == 0) return true; // point on the line
          if (where < 0) {
            if (y == yj) { // ray intersects vertex
              if (y < polygon[j == 0 ? l-1 : j-1].y) {
                c = !c;
              }
            } else {
              c = !c;
            }
          }
        }
      } else if (y == yi && (x >= xj && x <= xi || x >= xi && x <= xj)) {
        return true; // point on horizontal edge
      }
    }
    return c;
  },

  is_polygon_in_polygons: (polygon: vector[], polygons: vector[][]): boolean => { // not fully robust
    for (const v of polygon) {
      let inside = false;
      for (const u of polygons) {
        if (math.is_point_in_polygon(v, u)) {
          inside = true;
          continue;
        }
      }
      if (!inside) return false;
    }
    return true;
  },

  distance2_from_line_segment: function(centre: vector, p1: vector, p2: vector) {
    const v1 = vector.create(p2.x - p1.x, p2.y - p1.y);
    const v2 = vector.create(centre.x - p1.x, centre.y - p1.y);
    const d = (v2.x * v1.x + v2.y * v1.y) / (v1.y * v1.y + v1.x * v1.x);
    if (d >= 0 && d <= 1){
      const v3 = vector.create((v1.x * d + p1.x) - centre.x, (v1.y * d + p1.y) - centre.y);
      return vector.length2(v3);
    }
    const v3 = vector.create(centre.x - p2.x, centre.y - p2.y);
    return Math.min(vector.length2(v2), vector.length2(v3));
  },

  is_circle_in_polygon: (centre: vector, radius: number, polygon: vector[]): boolean => {
    if (math.is_point_in_polygon(centre, polygon)) return true;
    // check all the line intersections
    const radius2 = radius * radius;
    for (let i = 0; i < polygon.length; i++) {
      if (math.distance2_from_line_segment(centre, polygon[i], polygon[(i + 1) % polygon.length]) < radius2) return true;
    }
    return vector.length2(vector.sub(polygon[0], centre)) < radius2; // final check: if any point on the polygon lies in the circle
  },

  line_segment_intersection: (line1: [vector, vector], line2: [vector, vector]): boolean => {
    const [ p, p_ ] = line1, [ q, q_ ] = line2,
      r = vector.sub(p_, p), s = vector.sub(q_, q),
      c = vector.cross(r, s);
    if (math.equal(c, 0)) return false;
    const d = vector.sub(q, p),
      t = vector.cross(d, s), u = vector.cross(d, r),
      zero = -math.epsilon, one = c + math.epsilon;
    return (t >= zero && t <= one && u >= zero && u <= one);
  },

  is_line_intersecting_polygons: (v1: vector, v2: vector, polygons: vector[][]): boolean => {
    for (const polygon of polygons) {
      for (let i = 0; i < polygon.length - 1; i++) {
        if (math.line_segment_intersection([v1, v2], [polygon[i], polygon[i + 1]])) return true;
      }
    }
    return false;
  },

};