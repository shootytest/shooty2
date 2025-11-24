import { clone_object, make_rooms } from "../game/make.js";
import { Particle } from "../game/particle.js";
import { player } from "../game/player.js";
import { Shape } from "../game/shape.js";
import { Common } from "../matter.js";
import { camera } from "./camera.js";
import { canvas, ctx } from "./canvas.js";
import { color, color_mix, current_theme, THEMES, THEMES_UID_MAX } from "./color.js";
import { config } from "./config.js";
import { math } from "./math.js";
import { vector } from "./vector.js";
let w = canvas.width;
let h = canvas.height;
window.addEventListener("resize", function (_) {
    w = canvas.width;
    h = canvas.height;
});
const PI = Math.PI;
const BIG_NUMBER = 1234567890;
const start = {
    x: 0, y: 0, r: 0,
};
const points = [];
const bodies = [];
const end_points = [];
const reset_lists = () => {
    points.length = 0;
    bodies.length = 0;
    end_points.length = 0;
};
const add_wall = (p1, p2, force = false) => {
    const segment = collide.make_segment(start, p1, p2);
    let points_on_screen = 0;
    if (collide.segment_circle(p1, p2, start, start.r)) {
        points.push(p1, p2);
        points_on_screen += 2;
    }
    if (points_on_screen <= 0 && !force)
        return;
    end_points.push(...collide.get_endpoints_from_segments([segment]));
};
// tick
let see_time = 0;
let wall_opacity = 0;
export const do_visibility = (_dt) => {
    see_time += _dt;
    // precompute stuff
    Shape.compute();
    const path = calc_visibility_path_2(player, Shape.see_vertices);
    const other_vertices = Shape.see_other_vertices;
    const other_list = {};
    const inverted = invert_path(path);
    let has_other_vertices = false;
    for (const other_key in other_vertices) {
        const [alpha, z] = other_key.split("|").map((n) => Number(n));
        const inverted = invert_path(calc_visibility_path_2(player, other_vertices[other_key]));
        for (let z2 = Math.floor(z * 10) / 10; z2 < math.round_to(player.z + 1, 0.1); z2 += 0.1) {
            const zs = z2.toFixed(3);
            if (!other_list[zs])
                other_list[zs] = [];
            other_list[zs].push({ alpha, z, inverted });
        }
        has_other_vertices = true;
    }
    // handle z stuff and calculate wall opacity
    const additional_zs = [];
    const see_lowest_z = Shape.see_z_range[0];
    wall_opacity = 0;
    for (let z = Math.floor(see_lowest_z * 10) / 10 /* + ((performance.now() / 300) % 1) / 10 */; z < math.round_to(player.z + 1, 0.1); z += 0.1) {
        additional_zs.push(Number(z.toFixed(3)));
        wall_opacity += 1;
    }
    wall_opacity = math.bound(360 / wall_opacity, 10, 255);
    const draw_zs = [...new Set(additional_zs.concat(Shape.draw_zs))];
    draw_zs.sort((s1, s2) => s1 - s2);
    // actually draw stuff
    for (const z of draw_zs) {
        ctx.ctx.save();
        clip_visibility_path(player, path, z);
        Shape.draw(z);
        Particle.draw_particles(z);
        const zs = z.toFixed(3);
        if (has_other_vertices && other_list[zs]) {
            for (const other of other_list[zs]) {
                ctx.ctx.save();
                ctx.fillStyle = math.equal(z, other.z) ? color_mix(current_theme.dark, color.blackground, 0.5) + math.component_to_hex(other.alpha * 255) : (color.blackground + math.component_to_hex(other.alpha * wall_opacity * 2));
                clip_path(player, other.inverted, z, true);
                ctx.ctx.restore();
            }
        }
        ctx.ctx.restore();
        if (math.equal(Math.floor(z * 10), z * 10)) {
            ctx.ctx.save();
            clip_inverted_path(player, inverted, z);
            ctx.ctx.restore();
        }
        // if ((Math.floor(see_time / config.seconds * 5) % 16) / 10 - 0.5 < z) break;
    }
    // what is this
    // ctx.ctx.save();
    // clip_inverted_path(player, inverted, 0);
    // ctx.ctx.restore();
    // const [min_z, max_z] = Shape.see_z_range;
    // for (let z = 0 /* Math.floor(min_z * 10) / 10 + ((performance.now() / 300) % 1) / 10 */; z < math.round_to(player.z + 1, 0.1); z += 0.1) {
    //   ctx.ctx.save();
    //   clip_inverted_path(player, inverted, z);
    //   ctx.ctx.restore();
    // }
    // do translucent walls
    // ctx.save("see");
    // clip_visibility_path(player, path, 0);
    // for (const other_key in other_vertices) {
    //   const other_list = other_vertices[other_key];
    //   const alpha = Number(other_key);
    //   const path = calc_visibility_path_2(player, other_list);
    //   const inverted = invert_path(path);
    //   ctx.fillStyle = color.blackground + math.component_to_hex(alpha * 255);
    //   clip_path(player, inverted, see_lowest_z, true);
    //   for (let z = Math.floor(see_lowest_z * 10) / 10; z < math.round_to(player.z + 1, 0.1); z += 0.1) {
    //     ctx.fillStyle = math.equal(z, see_lowest_z) ? (current_theme.dark + math.component_to_hex(alpha * 128)) : (color.blackground + math.component_to_hex(alpha * wall_opacity));
    //     clip_path(player, inverted, z, true);
    //   }
    // }
    // ctx.restore("see");
    /* // not so good
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      ctx.restore("see");
      clip_visibility_polygon(vector.add(player, vector.createpolar(Math.PI / 3 * i + camera.time / 10, 10)));
    }
    ctx.globalAlpha = 1;
    */
};
export const tick_colours = (dt) => {
    const room = make_rooms[player.room_id];
    let theme = THEMES[room.theme];
    if (room.theme_mix) {
        theme = mix_themes(room.theme, room.theme_mix, room.theme_mix_strength);
    }
    if (!room.calc_theme)
        room.calc_theme = clone_object(theme);
    const is_instant = dt >= 10 * config.seconds;
    const mix_factor = is_instant ? 1 : (0.1 + 0.9 * math.bound(1 - Math.abs(theme.uid - current_theme.uid), 0, 1) ** 3);
    if (math.equal(current_theme.uid, theme.uid)) {
        // exit if themes are already the same
        return;
    }
    for (let key in theme) {
        if (key === "uid") {
            if (is_instant)
                current_theme.uid = theme.uid;
            else
                current_theme.uid = math.lerp(current_theme.uid, theme.uid, math.bound(0.04 * dt / 160, 0, 1));
        }
        else {
            const c1 = current_theme[key], c2 = theme[key];
            if (c1 == undefined || c2 == undefined || typeof c1 === "number" || typeof c2 === "number")
                continue;
            current_theme[key] = color_mix(c1, c2, mix_factor); // any >:(
        }
    }
};
let uid = THEMES_UID_MAX + 1;
const memo_themes = {};
const mix_themes = (one, two, strength) => {
    const t1 = THEMES[one], t2 = THEMES[two];
    const str = (strength ?? 0.5).toFixed(3);
    const s = one + "_" + two + "_" + str;
    if (memo_themes[s])
        return memo_themes[s]; // no need to clone, just remember this function returns the same object
    else {
        strength = Number(str);
        const result = clone_object(t1);
        for (let key in t1) {
            if (key === "uid")
                continue;
            const c1 = t1[key], c2 = t2[key];
            if (c1 == undefined || c2 == undefined)
                continue;
            result[key] = chroma.color(c1).mix(chroma.color(c2), strength, "lab").hex();
        }
        result.uid = uid++;
        memo_themes[s] = result;
        return result;
    }
};
for (const room of Object.values(make_rooms)) {
    let theme = THEMES[room.theme];
    if (room.theme_mix)
        theme = mix_themes(room.theme, room.theme_mix, room.theme_mix_strength);
    room.calc_theme = clone_object(theme);
}
const calc_visibility_path = (v) => {
    // const radius = Math.sqrt(w * w + h * h) * 1.5; // multiplied by 1.5, just in case
    reset_lists();
    start.x = Math.round(v.x);
    start.y = Math.round(v.y);
    start.r = Math.max(w, h);
    // const display_radius = start.r * camera.scale;
    add_wall({ x: -BIG_NUMBER, y: -BIG_NUMBER, }, { x: -BIG_NUMBER, y: BIG_NUMBER }, true);
    add_wall({ x: BIG_NUMBER, y: -BIG_NUMBER, }, { x: BIG_NUMBER, y: BIG_NUMBER }, true);
    add_wall({ x: -BIG_NUMBER, y: -BIG_NUMBER, }, { x: BIG_NUMBER, y: -BIG_NUMBER }, true);
    add_wall({ x: -BIG_NUMBER, y: BIG_NUMBER, }, { x: BIG_NUMBER, y: BIG_NUMBER }, true);
    for (const vertices of Shape.see_vertices) {
        for (let i = 0; i < vertices.length - 1; i++) {
            add_wall(vertices[i], vertices[i + 1]);
        }
    }
    const result = collide.calculate_visibility(start, end_points);
    // clip
    // todo reverse triangulation
    const s = camera.world2screen(start);
    const path = new Path2D();
    path.moveTo(Math.round(s.x), Math.round(s.y));
    for (let i = 0; i < result.length; i++) {
        const triangle = result[i];
        const e1 = camera.world2screen(triangle[0]);
        const e2 = camera.world2screen(triangle[1]);
        // const e1 = triangle[0];
        // const e2 = triangle[1];
        path.lineTo(Math.round(e1.x), Math.round(e1.y));
        if (result[i + 1] && vector.equal(result[i + 1][0], triangle[1])) {
            continue;
        }
        path.lineTo(Math.round(e2.x), Math.round(e2.y));
        // ctx.lineTo(s.x, s.y); // removing this fixes the thin line missing bug! yay! (if there are any weird errors add this line back in and see)
    }
    return path;
    // ctx.fillStyle = "#ff000055";
    // ctx.strokeStyle = "#00000000";
    // ctx.stroke();
    // ctx.fill();
    // clip the big circle too
    // ctx.beginPath();
    // ctx.moveTo(s.x, s.y);
    // ctx.arc(s.x, s.y, display_radius, 0, 2 * Math.PI);
    // ctx.clip();
};
const calc_visibility_path_2 = (v, vertices_list) => {
    start.x = Math.round(v.x);
    start.y = Math.round(v.y);
    start.r = Math.max(w, h);
    const viewport_1 = camera.screen2world(vector.create(-Math.round(w) * 999, -Math.round(h) * 999));
    const viewport_2 = camera.screen2world(vector.create(Math.round(w) * 1000, Math.round(h) * 1000));
    const result = collide.get_visibility_polygon(start, vertices_list, viewport_1, viewport_2);
    // clip
    // const s = camera.world2screen(start);
    const path = new Path2D();
    let first = true;
    let first_e = vector.create();
    for (const r of result) {
        const e = camera.world2screen(vector.create(r[0], r[1]));
        if (first) {
            first = false;
            first_e = e;
            path.moveTo(Math.round(e.x), Math.round(e.y));
        }
        else {
            path.lineTo(Math.round(e.x), Math.round(e.y));
        }
    }
    path.lineTo(Math.round(first_e.x), Math.round(first_e.y));
    return path;
};
const invert_path = (path) => {
    const inverted = new Path2D();
    inverted.rect(w * 2, h * 2, -w * 3, -h * 3);
    inverted.addPath(path);
    return inverted;
};
const clip_path = (center, path, z, fill_instead = false) => {
    if (z === 1)
        return; // todo remove
    const s = camera.world2screen(center);
    // const scale = inverted ? 1 / (1 - z) : camera.zscale(z);
    const scale = camera.zscale(z);
    ctx.translate(s.x, s.y);
    ctx.scale(scale, scale);
    ctx.translate(-s.x, -s.y);
    if (fill_instead)
        ctx.ctx.fill(path, "evenodd");
    else
        ctx.clip_path(path, "evenodd");
    ctx.resetTransform();
};
const clip_visibility_path = (center, path, z) => {
    clip_path(center, path, z);
    if (z === 0) {
        const s = camera.world2screen(center);
        draw_lighting(s, Math.sqrt(w * h) * camera.scale);
    }
};
const clip_inverted_path = (center, inverted, z) => {
    clip_path(center, inverted, z);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.fillStyle = math.equal(z, Shape.see_z_range[0]) ? (current_theme.dark + "80") : (color.blackground + math.component_to_hex(wall_opacity));
    ctx.fill();
};
// call this function after clipping
export const draw_lighting = (centre, display_radius) => {
    return;
    const x = centre.x;
    const y = centre.y;
    const min_radius = display_radius * 0.2;
    const max_radius = display_radius;
    const gradient = ctx.createRadialGradient(x, y, min_radius, x, y, max_radius);
    gradient.addColorStop(0, "#11ffff33");
    gradient.addColorStop(0.3 - math.bounce(camera.time, 30) * 0.1, "#10eeee22");
    gradient.addColorStop(0.7, "#09dddd11");
    gradient.addColorStop(1, color.blackground + "00");
    ctx.fillStyle = color.black + "00"; // gradient;
    ctx.beginPath();
    ctx.circle(x, y, max_radius);
    ctx.fill();
};
export const collide = {
    point_circle: (point, x, y, r) => {
        const dx = x - point.x;
        const dy = y - point.y;
        r = r || 0;
        return dx * dx + dy * dy <= r * r;
    },
    circle_circle: (c1, c2, r1, r2 = 0) => {
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const r = r1 + r2;
        return dx * dx + dy * dy <= r * r;
    },
    line_circle: (line_a, line_b, circle, radius, nearest) => {
        radius = radius || circle.r;
        if (radius == undefined) {
            console.error(new Error("somehow radius is undefined, why"));
            return false;
        }
        // check to see if start or end points lie within circle
        if (collide.point_circle(line_a, circle.x, circle.y, radius)) {
            if (nearest) {
                nearest.x = line_a.x;
                nearest.y = line_a.y;
            }
            return true;
        }
        if (collide.point_circle(line_b, circle.x, circle.y, radius)) {
            if (nearest) {
                nearest.x = line_a.x;
                nearest.y = line_a.y;
            }
            return true;
        }
        const x1 = line_a.x, y1 = line_a.y, x2 = line_b.x, y2 = line_b.y, cx = circle.x, cy = circle.y;
        // vector d
        const dx = x2 - x1;
        const dy = y2 - y1;
        // vector lc
        const lcx = cx - x1;
        const lcy = cy - y1;
        // project lc onto d, resulting in vector p
        const d2 = dx * dx + dy * dy; // length ^ 2 of d
        let px = dx;
        let py = dy;
        if (d2 > 0) {
            const dp = (lcx * dx + lcy * dy) / d2;
            px *= dp;
            py *= dp;
        }
        if (!nearest) {
            nearest = { x: 0, y: 0 };
        }
        nearest.x = x1 + px;
        nearest.y = y1 + py;
        // length^2 of p
        const p2 = px * px + py * py;
        // check collision
        return collide.point_circle(nearest, circle.x, circle.y, radius)
            && p2 <= d2 && (px * dx + py * dy) >= 0;
    },
    point_rect: (point, x, y, w, h) => {
        const px = point.x;
        const py = point.y;
        return px >= x && px <= x + w && py >= y && py <= y + h;
    },
    point_rectangle: (point, x, y, w, h) => {
        const w2 = w / 2;
        const h2 = h / 2;
        return collide.point_rect(point, x - w2, y - h2, w, h);
    },
    distance_from_segment_to_point_squared: (p1, p2, point) => {
        // Compute vectors AC and AB
        const AC = vector.sub(point, p1);
        const AB = vector.sub(p2, p1);
        // Get point D by taking the projection of AC onto AB then adding the offset of A
        const D = vector.add(vector.proj(AC, AB), p1);
        const AD = vector.sub(D, p1);
        // D might not be on AB so calculate k of D down AB (aka solve AD = k * AB)
        // We can use either component, but choose larger value to reduce the chance of dividing by zero
        const k = Math.abs(AB.x) > Math.abs(AB.y) ? AD.x / AB.x : AD.y / AB.y;
        // Check if D is off either end of the line segment
        if (k <= 0.0) {
            return vector.hypot2(point, p1);
        }
        else if (k >= 1.0) {
            return vector.hypot2(point, p2);
        }
        return vector.hypot2(point, D);
    },
    segment_circle: (p1, p2, point_circle, radius) => {
        return collide.distance_from_segment_to_point_squared(p1, p2, point_circle) <= radius * radius;
    },
    // added and modified from https://github.com/Silverwolf90/2d-visibility/blob/master/src/
    calculate_segment_angles: (source, segment) => {
        const x = source.x;
        const y = source.y;
        const dx = 0.5 * (segment.p1.x + segment.p2.x) - x;
        const dy = 0.5 * (segment.p1.y + segment.p2.y) - y;
        segment.d = (dx * dx) + (dy * dy);
        segment.p1.angle = Math.atan2(segment.p1.y - y, segment.p1.x - x);
        segment.p2.angle = Math.atan2(segment.p2.y - y, segment.p2.x - x);
    },
    calculate_segment_beginning: (segment) => {
        let angle = segment.p2.angle - segment.p1.angle;
        if (angle <= -PI)
            angle += 2 * PI;
        if (angle > PI)
            angle -= 2 * PI;
        segment.p1.begin = angle > 0;
        segment.p2.begin = !segment.p1.begin;
    },
    make_segment: (source, p1, p2) => {
        // copy of calculate_segment_angles
        const x = source.x;
        const y = source.y;
        const dx = 0.5 * (p1.x + p2.x) - x;
        const dy = 0.5 * (p1.y + p2.y) - y;
        const d = (dx * dx) + (dy * dy);
        const p1a = Math.atan2(p1.y - y, p1.x - x);
        const p2a = Math.atan2(p2.y - y, p2.x - x);
        let angle = p2a - p1a;
        if (angle <= -PI)
            angle += 2 * PI;
        if (angle > PI)
            angle -= 2 * PI;
        const p1b = angle > 0;
        const p2b = !p1b;
        const segment = {
            p1: { x: p1.x, y: p1.y, angle: p1a, begin: p1b },
            p2: { x: p2.x, y: p2.y, angle: p2a, begin: p2b },
            d: d,
        };
        segment.p1.segment = segment;
        segment.p2.segment = segment;
        return segment;
    },
    endpoint_sort_comparator: (p1, p2) => {
        if (p1.angle > p2.angle)
            return 1;
        if (p1.angle < p2.angle)
            return -1;
        if (!p1.begin && p2.begin)
            return 1;
        if (p1.begin && !p2.begin)
            return -1;
        return 0;
    },
    left_of: (segment, point) => {
        const cross_product = (segment.p2.x - segment.p1.x) * (point.y - segment.p1.y)
            - (segment.p2.y - segment.p1.y) * (point.x - segment.p1.x);
        return cross_product < 0;
    },
    lerp_vector: (p1, p2, f) => {
        return vector.create(p1.x * (1 - f) + p2.x * f, p1.y * (1 - f) + p2.y * f);
    },
    segment_in_front: (seg1, seg2, relative_point) => {
        const A1 = collide.left_of(seg1, collide.lerp_vector(seg2.p1, seg2.p2, 0.0001));
        const A2 = collide.left_of(seg1, collide.lerp_vector(seg2.p2, seg2.p1, 0.0001));
        const A3 = collide.left_of(seg1, relative_point);
        const B1 = collide.left_of(seg2, collide.lerp_vector(seg1.p1, seg1.p2, 0.0001));
        const B2 = collide.left_of(seg2, collide.lerp_vector(seg1.p2, seg1.p1, 0.0001));
        const B3 = collide.left_of(seg2, relative_point);
        if (B1 === B2 && B2 !== B3)
            return true;
        if (A1 === A2 && A2 === A3)
            return true;
        if (A1 === A2 && A2 !== A3)
            return false;
        if (B1 === B2 && B2 === B3)
            return false;
        return false;
    },
    line_intersection: (p1, p2, p3, p4) => {
        const s = ((p4.x - p3.x) * (p1.y - p3.y) -
            (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) -
            (p4.x - p3.x) * (p2.y - p1.y));
        return vector.create(p1.x + s * (p2.x - p1.x), p1.y + s * (p2.y - p1.y));
    },
    triangle_points: (origin_point, angle1, angle2, segment) => {
        const p1 = origin_point;
        const p2 = vector.create(origin_point.x + Math.cos(angle1), origin_point.y + Math.sin(angle1));
        const p3 = vector.create(0, 0);
        const p4 = vector.create(0, 0);
        if (segment) {
            p3.x = segment.p1.x;
            p3.y = segment.p1.y;
            p4.x = segment.p2.x;
            p4.y = segment.p2.y;
        }
        else {
            p3.x = origin_point.x + Math.cos(angle1) * 200;
            p3.y = origin_point.y + Math.sin(angle1) * 200;
            p4.x = origin_point.x + Math.cos(angle2) * 200;
            p4.y = origin_point.y + Math.sin(angle2) * 200;
        }
        const start = collide.line_intersection(p3, p4, p1, p2);
        p2.x = origin_point.x + Math.cos(angle2);
        p2.y = origin_point.y + Math.sin(angle2);
        const end = collide.line_intersection(p3, p4, p1, p2);
        return [start, end];
    },
    calculate_visibility: (origin, endpoints) => {
        const open_segments = [];
        const output = [];
        let begin_angle = 0;
        endpoints.sort(collide.endpoint_sort_comparator);
        for (let pass = 0; pass < 2; pass += 1) {
            for (let i = 0; i < endpoints.length; i += 1) {
                const endpoint = endpoints[i];
                const open_segment = open_segments[0];
                if (!endpoint.segment)
                    continue;
                if (endpoint.begin) {
                    let index = 0;
                    let segment = open_segments[index];
                    while (segment && collide.segment_in_front(endpoint.segment, segment, origin)) {
                        index += 1;
                        segment = open_segments[index];
                    }
                    if (!segment) {
                        open_segments.push(endpoint.segment);
                    }
                    else {
                        open_segments.splice(index, 0, endpoint.segment);
                    }
                }
                else {
                    open_segments.remove(endpoint.segment);
                }
                if (open_segment !== open_segments[0]) {
                    if (pass === 1) {
                        const triangle_points = collide.triangle_points(origin, begin_angle, endpoint.angle, open_segment);
                        if (!vector.equal(triangle_points[0], triangle_points[1]))
                            output.push(triangle_points);
                    }
                    begin_angle = endpoint.angle;
                }
            }
        }
        return output;
    },
    _flat_map: (cb, array) => {
        return array.reduce((flat_array, item) => flat_array.concat(cb(item)), []);
    },
    get_endpoints_from_segments: (segments) => {
        return collide._flat_map((segment) => [segment.p1, segment.p2], segments);
    },
    // use library wow
    get_visibility_polygon: (start, vertices, viewport_1, viewport_2) => {
        let segments = Common.visibilityPolygon.convertToSegments([[[-BIG_NUMBER, -BIG_NUMBER], [BIG_NUMBER, -BIG_NUMBER], [BIG_NUMBER, BIG_NUMBER], [-BIG_NUMBER, BIG_NUMBER]]]);
        for (const vs of vertices) {
            for (let i = 0; i < vs.length - 1; i++) {
                segments.push([[Math.round(vs[i].x), Math.round(vs[i].y)], [Math.round(vs[i + 1].x), Math.round(vs[i + 1].y)]]);
            }
        }
        segments = Common.visibilityPolygon.breakIntersections(segments);
        return Common.visibilityPolygon.computeViewport([start.x, start.y], segments, [viewport_1.x, viewport_1.y], [viewport_2.x, viewport_2.y]);
    },
};
