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
};
