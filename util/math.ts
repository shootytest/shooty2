import { vector } from "./vector";

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
  sqrt2: Math.sqrt(2),
  sqrt3: Math.sqrt(3),
  halfsqrt2: Math.sqrt(2) / 2,
  halfsqrt3: Math.sqrt(3) / 2,

  dist2: (x: number, y: number) => {
    return x * x + y * y;
  },
  dist: (x: number, y: number) => {
    return Math.sqrt(math.dist2(x, y));
  },
  dist2_v: (p1: vector, p2: vector) => {
    return math.dist2(p2.x - p1.x, p2.y - p1.y);
  },
  dist_v: (p1: vector, p2: vector) => {
    return Math.sqrt(math.dist2_v(p1, p2));
  },

  lerp: (a: number, b: number, t: number) => {
    return a * (1 - t) + b * t;
  },
  lerp_color: (ca: string, cb: string, t: number) => {
    const [rA, gA, bA] = ca.match(/\w\w/g)?.map((c: string) => parseInt(c, 16)) || [0, 0, 0];
    const [rB, gB, bB] = cb.match(/\w\w/g)?.map((c: string) => parseInt(c, 16)) || [0, 0, 0];
    const r = Math.round(rA + (rB - rA) * t).toString(16).padStart(2, "0");
    const g = Math.round(gA + (gB - gA) * t).toString(16).padStart(2, "0");
    const b = Math.round(bA + (bB - bA) * t).toString(16).padStart(2, "0");
    return "#" + r + g + b;
  },
  bounce: (time: number, period: number) => {
    return Math.abs(period - time % (period * 2)) / period;
  },
  bound: (n: number, min: number, max: number) => {
    return Math.max(Math.min(n, max), min);
  },

  component_to_hex: (component: number) => {
    const hex = Math.round(component).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  },

  rand: (a = 1, b?: number) => {
    if (b != undefined) {
      return a + Math.random() * (b - a);
    } else {
      return Math.random() * a;
    }
  },
  randint: (a: number, b: number) => {
    return Math.floor(math.rand(a, b + 1));
  },
  randbool: () => {
    return Math.random() > 0.5;
  },
  randgauss: (mean: number, deviation: number) => {
    let x1, x2, w;
    do {
      x1 = 2 * Math.random() - 1;
      x2 = 2 * Math.random() - 1;
      w = x1 * x1 + x2 * x2;
    } while (0 === w || w >= 1);
    w = Math.sqrt(-2 * Math.log(w) / w);
    return mean + deviation * x1 * w;
  },
  randstring: (length = 10) => {
    const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += letters.charAt(
        Math.floor(Math.random() * letters.length),
      );
    }
    return result;
  },
  randpick: (array: any[]) => {
    return array[math.randint(0, array.length - 1)];
  },

  log_base: (a: number, b: number) => {
    return Math.log(a) / Math.log(b);
  },
  log_clamp: (value: number, min: number, max: number) => {
    return value * min / Math.pow(max / min, Math.floor(math.log_base(value, max / min)));
  },

  fastround: (value: number) => { // obsolete (just as fast as math.round)
    return (value + (value > 0 ? 0.5 : -0.5)) << 0;
  },
  round_dp: (value: number, decimals: number) => {
    if (math.abs(value) < Number('1e' + -decimals) / 2) return 0;
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e' + -decimals);
  },
  round_to: (value: number, multiple: number) => {
    return Number(Math.round(value / multiple) * multiple);
  },

  point_in_rect: (px: number, py: number, x: number, y: number, w: number, h: number) => {
    return (px >= x && py >= y && px <= x + w && py <= y + h);
  },
  point_in_rectangle: (px: number, py: number, x: number, y: number, w: number, h: number) => {
    return math.point_in_rect(px, py, x - w / 2, y - h / 2, w, h);
  },
  point_in_circle: (px: number, py: number, cx: number, cy: number, r: number) => {
    return math.dist2(px - cx, py - cy) < r * r;
  },

};