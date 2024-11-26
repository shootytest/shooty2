import { Common } from "../matter.js";
import { vector } from "./vector.js";
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
    epsilon_bigger: 0.001,
    epsilon: 0.000001,
    epsilon_smaller: 0.000000001,
    sqrt2: Math.sqrt(2),
    sqrt3: Math.sqrt(3),
    halfsqrt2: Math.sqrt(2) / 2,
    halfsqrt3: Math.sqrt(3) / 2,
    dist2: (x, y) => {
        return x * x + y * y;
    },
    dist: (x, y) => {
        return Math.sqrt(math.dist2(x, y));
    },
    dist2_v: (p1, p2) => {
        return math.dist2(p2.x - p1.x, p2.y - p1.y);
    },
    dist_v: (p1, p2) => {
        return Math.sqrt(math.dist2_v(p1, p2));
    },
    atan2_v: (v) => {
        return Math.atan2(v.y, v.x);
    },
    lerp: (a, b, t) => {
        return a * (1 - t) + b * t;
    },
    lerp_color: (ca, cb, t) => {
        const [rA, gA, bA] = ca.match(/\w\w/g)?.map((c) => parseInt(c, 16)) || [0, 0, 0];
        const [rB, gB, bB] = cb.match(/\w\w/g)?.map((c) => parseInt(c, 16)) || [0, 0, 0];
        const r = Math.round(rA + (rB - rA) * t).toString(16).padStart(2, "0");
        const g = Math.round(gA + (gB - gA) * t).toString(16).padStart(2, "0");
        const b = Math.round(bA + (bB - bA) * t).toString(16).padStart(2, "0");
        return "#" + r + g + b;
    },
    bounce: (time, period) => {
        return Math.abs(period - time % (period * 2)) / period;
    },
    bound: (n, min, max) => {
        return Math.max(Math.min(n, max), min);
    },
    component_to_hex: (component) => {
        const hex = Math.round(component).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    },
    rand: (a = 1, b) => {
        if (b != undefined) {
            return a + Math.random() * (b - a);
        }
        else {
            return Math.random() * a;
        }
    },
    randint: (a, b) => {
        return Math.floor(math.rand(a, b + 1));
    },
    randbool: () => {
        return Math.random() > 0.5;
    },
    randgauss: (mean, deviation) => {
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
            result += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return result;
    },
    randpick: (array) => {
        return array[math.randint(0, array.length - 1)];
    },
    log_base: (a, b) => {
        return Math.log(a) / Math.log(b);
    },
    log_clamp: (value, min, max) => {
        return value * min / Math.pow(max / min, Math.floor(math.log_base(value, max / min)));
    },
    fastround: (value) => {
        return (value + (value > 0 ? 0.5 : -0.5)) << 0;
    },
    round_dp: (value, decimals) => {
        if (math.abs(value) < Number('1e' + -decimals) / 2)
            return 0;
        return Number(Math.round(Number(value + 'e' + decimals)) + 'e' + -decimals);
    },
    round_to: (value, multiple) => {
        return Number(Math.round(value / multiple) * multiple);
    },
    point_in_rect: (px, py, x, y, w, h) => {
        return (px >= x && py >= y && px <= x + w && py <= y + h);
    },
    point_in_rectangle: (px, py, x, y, w, h) => {
        return math.point_in_rect(px, py, x - w / 2, y - h / 2, w, h);
    },
    point_in_circle: (px, py, cx, cy, r) => {
        return math.dist2(px - cx, py - cy) < r * r;
    },
    expand_line: (v1, v2, width) => {
        const v0 = vector.mean([v1, v2]);
        const v3 = vector.sub(v1, v2);
        const h = vector.length(v3) + width;
        const w = width;
        const { x, y } = v0;
        const a = math.atan2(-v3.x, v3.y);
        const vs = [w / 2 * Math.cos(a), h / 2 * Math.sin(a), w / 2 * Math.sin(a), h / 2 * Math.cos(a)];
        const result = [];
        result.push(vector.create(x + vs[0] - vs[1], y + vs[2] + vs[3]));
        result.push(vector.create(x - vs[0] - vs[1], y - vs[2] + vs[3]));
        result.push(vector.create(x - vs[0] + vs[1], y - vs[2] - vs[3]));
        result.push(vector.create(x + vs[0] + vs[1], y + vs[2] - vs[3]));
        return result;
    },
    expand_lines: (vertices, width) => {
        if (vertices.length < 2) {
            return [[]];
        }
        else if (vertices.length === 2) {
            return [math.expand_line(vertices[0], vertices[1], width)];
        }
        else {
            let result = [];
            for (let i = 0; i < vertices.length - 1; i++) {
                const vs = math.expand_line(vertices[i], vertices[i + 1], width);
                result.push(vs);
            }
            return result;
        }
    },
    expand_lines_working_i_guess_but_too_many_vertices: (vertices, width) => {
        if (vertices.length < 2) {
            return [];
        }
        else if (vertices.length === 2) {
            return math.expand_line(vertices[0], vertices[1], width);
        }
        else {
            const points = [];
            for (const v of vertices) {
                points.push([v.x, v.y]);
            }
            const result = [];
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
    expand_lines_failed_skill_issue: (vertices, width) => {
        if (vertices.length < 2) {
            return [];
        }
        else if (vertices.length === 2) {
            return math.expand_line(vertices[0], vertices[1], width);
        }
        let v1, v2;
        const result_left = [];
        const result_right = [];
        for (let i = 0; i < vertices.length - 1; i++) {
            const vs = math.expand_line(vertices[i], vertices[i + 1], width);
            if (v1 === undefined || v2 === undefined) {
                result_left.push(vs[1]);
                result_right.push(vs[0]);
            }
            else {
                result_left.push(vector.mean([vs[0], v1]));
                result_right.push(vector.mean([vs[1], v2]));
            }
            v1 = vs[3];
            v2 = vs[2];
        }
        if (v2)
            result_left.push(v2);
        if (v1)
            result_right.push(v1);
        return result_left.concat(result_right.reverse());
    }
};
