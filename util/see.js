// CTS?
import { player } from "../game/player.js";
import { Shape } from "../game/shape.js";
import { camera } from "./camera.js";
import { ctx } from "./canvas.js";
import { math } from "./math.js";
import { vector } from "./vector.js";
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
export const do_visibility = () => {
    clip_visibility_polygon(player);
    Shape.draw(0);
    ctx.restore("see");
    /* // not so good
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      ctx.restore("see");
      clip_visibility_polygon(vector.add(player, vector.createpolar(Math.PI / 3 * i + camera.time / 10, 10)));
    }
    ctx.globalAlpha = 1;
    */
};
/*
export const undo_visibility = () => {

  ctx.restore("see");

};
*/
const clip_visibility_polygon = (v) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const radius = Math.sqrt(w * w + h * h) * 1.5; // multiplied by 1.5, just in case
    reset_lists();
    start.x = v.x;
    start.y = v.y;
    start.r = Math.max(w, h);
    const display_radius = start.r * camera.scale;
    add_wall({ x: -BIG_NUMBER, y: -BIG_NUMBER, }, { x: -BIG_NUMBER, y: BIG_NUMBER }, true);
    add_wall({ x: BIG_NUMBER, y: -BIG_NUMBER, }, { x: BIG_NUMBER, y: BIG_NUMBER }, true);
    add_wall({ x: -BIG_NUMBER, y: -BIG_NUMBER, }, { x: BIG_NUMBER, y: -BIG_NUMBER }, true);
    add_wall({ x: -BIG_NUMBER, y: BIG_NUMBER, }, { x: BIG_NUMBER, y: BIG_NUMBER }, true);
    for (const vertices of Shape.get_vertices()) {
        for (let i = 0; i < vertices.length - 1; i++) {
            add_wall(vertices[i], vertices[i + 1]);
        }
    }
    const result = collide.calculate_visibility(start, end_points);
    ctx.save("see");
    // clip
    const s = camera.world2screen(start);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    for (let i = 0; i < result.length; i++) {
        const triangle = result[i];
        const e1 = camera.world2screen(triangle[0]);
        const e2 = camera.world2screen(triangle[1]);
        // const e1 = triangle[0];
        // const e2 = triangle[1];
        ctx.lineTo(e1.x, e1.y);
        if (result[i + 1] && vector.equal(result[i + 1][0], triangle[1])) {
            continue;
        }
        ctx.lineTo(e2.x, e2.y);
        // ctx.lineTo(s.x, s.y); // removing this fixes the thin line missing bug! yay! (if there are any weird errors add this line back in and see)
    }
    // ctx.fillStyle = "#ff000055";
    // ctx.strokeStyle = "#00000000";
    // ctx.stroke();
    // ctx.fill();
    // actually clip
    ctx.clip();
    // clip the big circle too
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.arc(s.x, s.y, display_radius, 0, 2 * Math.PI);
    ctx.clip();
    // todo draw???
    draw_lighting(s, display_radius);
};
// call this function after clipping
export const draw_lighting = (centre, display_radius) => {
    const x = centre.x;
    const y = centre.y;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const min_radius = display_radius / 10;
    const max_radius = display_radius;
    const gradient = ctx.createRadialGradient(x, y, min_radius, x, y, max_radius);
    gradient.addColorStop(0, "#ffff1133");
    gradient.addColorStop(0.3 - math.bounce(camera.time, 30) * 0.1, "#eeee1022");
    gradient.addColorStop(0.7, "#dddd0911");
    gradient.addColorStop(1, "#00000000");
    ctx.fillStyle = gradient;
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
                    let index = open_segments.indexOf(endpoint.segment);
                    if (index > -1)
                        open_segments.splice(index, 1);
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
};
