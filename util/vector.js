import { math } from "./math.js";
;
;
;
;
;
;
;
;
export const vector = {
    create: (x = 0, y = 0) => {
        return { x, y };
    },
    clone: (v) => {
        return vector.create(v.x, v.y);
    },
    clone_list: (vs) => {
        const result = [];
        for (const v of vs) {
            result.push(vector.clone(v));
        }
        return result;
    },
    mult: (v, scale) => {
        return {
            x: v.x * scale,
            y: v.y * scale,
        };
    },
    div: (v, scale) => {
        return {
            x: v.x / scale,
            y: v.y / scale,
        };
    },
    add: (v1, v2) => {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
        };
    },
    add_all: (...vs) => {
        let result = vector.create();
        for (const v of vs)
            result = vector.add(result, v);
        return result;
    },
    add_list: (vs, v2) => {
        const result = [];
        for (const v1 of vs) {
            result.push(vector.add(v1, v2));
        }
        return result;
    },
    add_to_list: (vs, v_add) => {
        for (const v of vs) {
            v.x += v_add.x;
            v.y += v_add.y;
        }
        return;
    },
    mult_list: (vs, scale) => {
        const result = [];
        for (const v of vs) {
            result.push(vector.mult(v, scale));
        }
        return result;
    },
    mult_to_list: (vs, scale) => {
        for (const v of vs) {
            v.x *= scale;
            v.y *= scale;
        }
        return;
    },
    sub: (v1, v2) => {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
        };
    },
    equal: (v1, v2) => {
        return Math.abs(v1.x - v2.x) < math.epsilon && Math.abs(v1.y - v2.y) < math.epsilon;
    },
    length2: (v) => {
        return v.x * v.x + v.y * v.y;
    },
    length: (v) => {
        return Math.sqrt(vector.length2(v));
    },
    normalise: (v, mult = 1) => {
        let l = vector.length(v) / mult;
        if (!l)
            return v;
        return vector.div(v, l);
    },
    round: (v) => {
        return vector.create(Math.round(v.x), Math.round(v.y));
    },
    round_to: (v, n = 1) => {
        return vector.create(math.round_to(v.x, n), math.round_to(v.y, n));
    },
    direction: (v) => {
        return Math.atan2(v.y, v.x);
    },
    createpolar: (theta, r = 1) => {
        return vector.create(r * Math.cos(theta), r * Math.sin(theta));
    },
    createpolar_deg: (theta, r = 1) => {
        return vector.createpolar(vector.deg_to_rad(theta), r);
    },
    lerp: (v1, v2, t) => {
        return vector.add(vector.mult(v1, 1 - t), vector.mult(v2, t));
    },
    deg_to_rad: (degrees) => {
        return degrees / 180 * Math.PI;
    },
    rad_to_deg: (radians) => {
        return radians * 180 / Math.PI;
    },
    rad_to_vector: (radians) => {
        return vector.create(Math.cos(radians), Math.sin(radians));
    },
    rotate: (center, v, angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = (cos * (v.x - center.x)) - (sin * (v.y - center.y)) + center.x;
        const ny = (cos * (v.y - center.y)) + (sin * (v.x - center.x)) + center.y;
        return vector.create(nx, ny);
    },
    rotate90: (v) => {
        return vector.create(-v.y, v.x);
    },
    in_rect: (p, x, y, w, h) => {
        return (p.x >= x && p.y >= y && p.x <= x + w && p.y <= y + h);
    },
    in_rectangle: (p, x, y, w, h) => {
        return vector.in_rect(p, x - w / 2, y - h / 2, w, h);
    },
    in_aabb: (p, aabb) => {
        return (p.x >= aabb.min_x && p.y >= aabb.min_y && p.x <= aabb.max_x && p.y <= aabb.max_y);
    },
    in_circle: (p, c, r) => {
        return vector.length2(vector.sub(p, c)) < r * r;
    },
    mean: (vertices) => {
        let mean = { x: 0, y: 0 };
        for (const v of vertices) {
            mean = vector.add(mean, v);
        }
        return vector.div(mean, vertices.length);
    },
    centroid: (vertices) => {
        const first = vertices[0], last = vertices[vertices.length - 1];
        if (first.x != last.x || first.y != last.y)
            vertices.push(first);
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
    dot: (v1, v2) => {
        return v1.x * v2.x + v1.y * v2.y;
    },
    cross: (v1, v2) => {
        return v1.x * v2.y - v1.y * v2.x;
    },
    hypot2: (v1, v2) => {
        return vector.dot(vector.sub(v1, v2), vector.sub(v1, v2));
    },
    proj: (v1, v2) => {
        const k = vector.dot(v1, v2) / vector.dot(v2, v2);
        return vector.create(k * v2.x, k * v2.y);
    },
    make_aabb: (vertices = []) => {
        let aabb = {
            min_x: Number.POSITIVE_INFINITY,
            max_x: Number.NEGATIVE_INFINITY,
            min_y: Number.POSITIVE_INFINITY,
            max_y: Number.NEGATIVE_INFINITY,
        };
        for (const v of vertices) {
            if (v.x < aabb.min_x)
                aabb.min_x = v.x;
            if (v.x > aabb.max_x)
                aabb.max_x = v.x;
            if (v.y < aabb.min_y)
                aabb.min_y = v.y;
            if (v.y > aabb.max_y)
                aabb.max_y = v.y;
        }
        return aabb;
    },
    aabb_intersect: (a, b) => {
        return (a.min_x <= b.max_x && a.max_x >= b.min_x) &&
            (a.min_y <= b.max_y && a.max_y >= b.min_y);
    },
    aabb_combine: (a, b) => {
        return {
            min_x: Math.min(a.min_x, b.min_x),
            max_x: Math.max(a.max_x, b.max_x),
            min_y: Math.min(a.min_y, b.min_y),
            max_y: Math.max(a.max_y, b.max_y),
        };
    },
    aabb_add: (a, v) => {
        return {
            min_x: a.min_x + v.x,
            max_x: a.max_x + v.x,
            min_y: a.min_y + v.y,
            max_y: a.max_y + v.y,
        };
    },
    aabb2v: (a) => {
        return {
            x: a.max_x - a.min_x,
            y: a.max_y - a.min_y,
        };
    },
    aabb2bounds: (a) => {
        return {
            min: vector.create(a.min_x, a.min_y),
            max: vector.create(a.max_x, a.max_y)
        };
    },
    aabb2vs: (a) => {
        return [
            { x: a.min_x, y: a.min_y },
            { x: a.max_x, y: a.max_y },
        ];
    },
    aabb_centre: (a) => {
        return {
            x: (a.max_x + a.min_x) / 2,
            y: (a.max_y + a.min_y) / 2,
        };
    },
    aabb_scale: (a, scale) => {
        const v = vector.aabb_centre(a);
        return {
            min_x: v.x + (a.min_x - v.x) * scale.x,
            max_x: v.x + (a.max_x - v.x) * scale.x,
            min_y: v.y + (a.min_y - v.y) * scale.y,
            max_y: v.y + (a.max_y - v.y) * scale.y,
        };
    },
};
export const vector3 = {
    create: (x = 0, y = 0, z = 0) => {
        return { x, y, z };
    },
    create_: (v, z = 0) => {
        return { x: v.x, y: v.y, z: v.z === undefined ? z : v.z };
    },
    create_many: (v_list, z = 0) => {
        const result = [];
        for (const v of v_list) {
            result.push(vector3.create_(v, z));
        }
        return result;
    },
    create2: (v, z = 0) => {
        return { x: v.x, y: v.y, z };
    },
    clone: (v) => {
        return vector3.create(v.x, v.y, v.z);
    },
    clone_: (v) => {
        return {
            x: v.x,
            y: v.y,
            z: v.z,
        };
    },
    clone_list: (vs) => {
        const result = [];
        for (const v of vs) {
            result.push(vector3.clone(v));
        }
        return result;
    },
    clone_list_: (vs) => {
        const result = [];
        for (const v of vs) {
            const v_ = { x: v.x, y: v.y };
            if (v.z)
                v_.z = v.z;
            result.push(v_);
        }
        return result;
    },
    flatten: (v, z = 0) => {
        return { x: v.x, y: v.y, z };
    },
    mult: (v, scale) => {
        return {
            x: v.x * scale,
            y: v.y * scale,
            z: v.z * scale
        };
    },
    mult2: (v, scale, z_scale = 1) => {
        return {
            x: v.x * scale,
            y: v.y * scale,
            z: v.z * z_scale
        };
    },
    mult_: (v, scale) => {
        const result = vector.create(v.x * scale, v.y * scale);
        if (v.z != undefined)
            result.z = v.z * scale;
        return result;
    },
    neg: (v) => {
        return {
            x: -v.x,
            y: -v.y,
            z: -v.z
        };
    },
    neg2: (v) => {
        return {
            x: -v.x,
            y: -v.y,
            z: v.z
        };
    },
    div: (v, scale) => {
        return {
            x: v.x / scale,
            y: v.y / scale,
            z: v.z / scale
        };
    },
    add: (v1, v2) => {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
            z: v1.z + v2.z
        };
    },
    add_: (v1, v2) => {
        if (v1.z === undefined && v2.z === undefined)
            return vector.add(v1, v2);
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
            z: (v1.z ?? 0) + (v2.z ?? 0),
        };
    },
    add_all: (...vs) => {
        let result = vector3.create();
        for (const v of vs)
            result = vector3.add(result, v);
        return result;
    },
    add_list: (vs, v_add) => {
        const result = [];
        const v2 = vector3.create_(v_add);
        for (const v1 of vs) {
            result.push(vector3.add(v1, v2));
        }
        return result;
    },
    add_to_list: (vs, v_add) => {
        for (const v of vs) {
            v.x += v_add.x;
            v.y += v_add.y;
            if (v_add.z !== undefined && v.z !== undefined)
                v.z += v_add.z;
        }
        return;
    },
    scale_to_list: (vs, v_scale) => {
        for (const v of vs) {
            v.x *= v_scale.x;
            v.y *= v_scale.y;
            if (v_scale.z !== undefined)
                v.z *= v_scale.z;
        }
        return;
    },
    mult_to_list: (vs, mult) => {
        for (const v of vs) {
            v.x *= mult;
            v.y *= mult;
            v.z *= mult;
        }
        return;
    },
    round_list: (vs, multiple, z_multiple) => {
        const rounded = [];
        for (const v of vs) {
            const result = {
                x: math.round_to(v.x, multiple),
                y: math.round_to(v.y, multiple)
            };
            if (v.z)
                result.z = math.round_to(v.z, z_multiple ?? multiple);
            rounded.push(result);
        }
        return rounded;
    },
    sub: (v1, v2) => {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z
        };
    },
    equal: (v1, v2) => {
        return Math.abs(v1.x - v2.x) < math.epsilon && Math.abs(v1.y - v2.y) < math.epsilon && Math.abs(v1.z - v2.z) < math.epsilon;
    },
    length2: (v) => {
        return v.x * v.x + v.y * v.y + v.z * v.z;
    },
    length: (v) => {
        return Math.sqrt(vector3.length2(v));
    },
    normalise: (v) => {
        return vector3.div(v, vector3.length(v));
    },
    round: (v) => {
        return vector3.create(Math.round(v.x), Math.round(v.y), Math.round(v.z));
    },
    round_to: (v, n = 1) => {
        return vector3.create(math.round_to(v.x, n), math.round_to(v.y, n), math.round_to(v.z, n));
    },
    round_2: (v, n = 1) => {
        return vector3.create(math.round_to(v.x, n), math.round_to(v.y, n), v.z);
    },
    createpolar: (theta, r = 1, z = 0) => {
        return vector3.create(r * Math.cos(theta), r * Math.sin(theta), z);
    },
    createpolar_deg: (theta, r = 1, z = 0) => {
        return vector3.createpolar(vector3.deg_to_rad(theta), r, z);
    },
    lerp: (v1, v2, t) => {
        return vector3.add(vector3.mult(v1, 1 - t), vector3.mult(v2, t));
    },
    deg_to_rad: (degrees) => {
        return degrees / 180 * Math.PI;
    },
    rad_to_deg: (radians) => {
        return radians * 180 / Math.PI;
    },
    mean: (vertices) => {
        let mean = { x: 0, y: 0, z: 0 };
        for (const v of vertices) {
            mean = vector3.add(mean, v);
        }
        return vector3.div(mean, vertices.length);
    },
    mean_but_somehow_max_z: (vertices) => {
        let mean = { x: 0, y: 0 }, z = -9999999;
        for (const v of vertices) {
            mean = vector.add(mean, v);
            if (v.z > z)
                z = v.z;
        }
        return vector3.create2(vector.div(mean, vertices.length), z);
    },
    meanz: (vertices) => {
        let mean = 0;
        for (const v of vertices) {
            mean += v.z;
        }
        return mean / vertices.length;
    },
    z_range: (vertices) => {
        let min_z = 9999999, max_z = -9999999;
        for (const v of vertices) {
            if (v.z < min_z)
                min_z = v.z;
            if (v.z > max_z)
                max_z = v.z;
        }
        return [Number(min_z.toFixed(3)), Number(max_z.toFixed(3))];
    },
    centroid: (vertices) => {
        const first = vertices[0], last = vertices[vertices.length - 1];
        if (first.x != last.x || first.y != last.y)
            vertices.push(first);
        let twice_area = 0, x = 0, y = 0, z = 0, n = vertices.length, p1, p2, f;
        for (var i = 0, j = n - 1; i < n; j = i++) {
            p1 = vertices[i];
            p2 = vertices[j];
            f = p1.x * p2.y - p2.x * p1.y;
            twice_area += f;
            x += (p1.x + p2.x) * f;
            y += (p1.y + p2.y) * f;
        }
        for (const v of vertices)
            z += v.z;
        f = twice_area * 3;
        return { x: x / f, y: y / f, z: z / vertices.length };
    },
    make_aabb: (vertices) => {
        let aabb = {
            min_x: Number.POSITIVE_INFINITY,
            max_x: Number.NEGATIVE_INFINITY,
            min_y: Number.POSITIVE_INFINITY,
            max_y: Number.NEGATIVE_INFINITY,
            min_z: Number.POSITIVE_INFINITY,
            max_z: Number.NEGATIVE_INFINITY,
        };
        for (const v of vertices) {
            if (v.x < aabb.min_x)
                aabb.min_x = v.x;
            if (v.x > aabb.max_x)
                aabb.max_x = v.x;
            if (v.y < aabb.min_y)
                aabb.min_y = v.y;
            if (v.y > aabb.max_y)
                aabb.max_y = v.y;
            if (v.z < aabb.min_z)
                aabb.min_z = v.z;
            if (v.z > aabb.max_z)
                aabb.max_z = v.z;
        }
        return aabb;
    },
    aabb_intersect: (a, b) => {
        return (a.min_x <= b.max_x && a.max_x >= b.min_x) &&
            (a.min_y <= b.max_y && a.max_y >= b.min_y) &&
            (a.min_z <= b.max_z && a.max_z >= b.min_z);
    },
    aabb_combine: (a, b) => {
        return {
            min_x: Math.min(a.min_x, b.min_x),
            max_x: Math.max(a.max_x, b.max_x),
            min_y: Math.min(a.min_y, b.min_y),
            max_y: Math.max(a.max_y, b.max_y),
            min_z: Math.min(a.min_z, b.min_z),
            max_z: Math.max(a.max_z, b.max_z),
        };
    },
    aabb_add: (a, v) => {
        return {
            min_x: a.min_x + v.x,
            max_x: a.max_x + v.x,
            min_y: a.min_y + v.y,
            max_y: a.max_y + v.y,
            min_z: a.min_z + v.z,
            max_z: a.max_z + v.z,
        };
    },
    aabb2v: (a) => {
        return {
            x: a.max_x - a.min_x,
            y: a.max_y - a.min_y,
            z: a.max_z - a.min_z,
        };
    },
    aabb2vs: (a) => {
        return [
            { x: a.min_x, y: a.min_y, z: a.min_z },
            { x: a.max_x, y: a.max_y, z: a.max_z },
        ];
    },
    aabb_centre: (a) => {
        return {
            x: (a.max_x + a.min_x) / 2,
            y: (a.max_y + a.min_y) / 2,
            z: (a.max_z + a.min_z) / 2,
        };
    },
    aabb_scale: (a, scale) => {
        const v = vector3.aabb_centre(a);
        return {
            min_x: v.x + (a.min_x - v.x) * scale.x,
            max_x: v.x + (a.max_x - v.x) * scale.x,
            min_y: v.y + (a.min_y - v.y) * scale.y,
            max_y: v.y + (a.max_y - v.y) * scale.y,
            min_z: v.z + (a.min_z - v.z) * scale.z,
            max_z: v.z + (a.max_z - v.z) * scale.z,
        };
    },
};
