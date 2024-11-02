import { math } from "./math.js";
;
;
;
;
;
export const vector = {
    create: (x = 0, y = 0) => {
        return { x, y };
    },
    create3: (v) => {
        return {
            x: v.x,
            y: v.y
        };
    },
    clone: (v) => {
        return vector.create(v.x, v.y);
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
    sub: (v1, v2) => {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
        };
    },
    length2: (v) => {
        return v.x * v.x + v.y * v.y;
    },
    length: (v) => {
        return Math.sqrt(vector.length2(v));
    },
    normalise: (v) => {
        let l = vector.length(v);
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
    createpolar: (theta, r = 1) => {
        return vector.create(r * Math.cos(theta), r * Math.sin(theta));
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
    make_aabb: (vertices) => {
        let aabb = {
            min_x: vertices[0].x,
            max_x: vertices[0].x,
            min_y: vertices[0].y,
            max_y: vertices[0].y,
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
    }
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
    sub: (v1, v2) => {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z
        };
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
        let mean = { x: 0, y: 0, z: 0, };
        for (const v of vertices) {
            mean = vector3.add(mean, v);
        }
        return vector3.div(mean, vertices.length);
    },
    make_aabb: (vertices) => {
        let aabb = {
            min_x: vertices[0].x,
            max_x: vertices[0].x,
            min_y: vertices[0].y,
            max_y: vertices[0].y,
            min_z: vertices[0].z,
            max_z: vertices[0].z,
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
    }
};
