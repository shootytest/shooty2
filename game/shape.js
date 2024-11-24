import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { vector, vector3 } from "../util/vector.js";
import { player } from "./player.js";
/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {
    static shapes = [];
    static draw_shapes = [];
    static cumulative_id = 0;
    static type = "shape";
    static from_map(thing, o) {
        const s = new Shape(thing);
        s.z = o.z;
        s.vertices = vector3.create_many(o.vertices, o.z);
        s.closed_loop = !(o.options?.open_loop);
        if (o.computed == undefined) {
            throw "map shape not computed yet!";
        }
        for (const v of s.vertices) {
            v.x -= o.computed.centroid.x;
            v.y -= o.computed.centroid.y;
        }
        s.style = o.style;
        s.init_computed();
        return s;
    }
    ;
    static circle(thing, radius, z = 0, x_offset = 0, y_offset = 0) {
        return Polygon.make(thing, radius, 0, 0, z, x_offset, y_offset);
    }
    ;
    static filter(aabb) {
        const result = [];
        for (const s of Shape.shapes) {
            if (s.computed == undefined || s.thing == undefined)
                continue;
            s.computed_aabb = vector3.aabb_add(s.computed.aabb3, s.thing.position);
            const inside = vector3.aabb_intersect(s.computed_aabb, aabb);
            if (inside) {
                result.push(s);
            }
        }
        return result;
    }
    ;
    static compute() {
        const cam = vector3.create2(camera.location, camera.z);
        const screen_topleft = camera.screen2world({ x: 0, y: 0 });
        const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
        const screen_aabb = {
            min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -Infinity, max_z: Infinity,
        };
        Shape.draw_shapes = Shape.filter(screen_aabb);
        for (const s of Shape.draw_shapes) {
            if (s.computed == undefined) {
                s.init_computed();
            }
            if (s.computed != undefined) { // always true at this point
                // compute vertices
                s.computed.vertices = vector3.clone_list(s.vertices);
                // rotate by thing angle
                if (s.thing.angle) {
                    for (const v of s.computed.vertices) {
                        const rotated = vector.rotate(vector.create(), v, s.thing.angle);
                        v.x = rotated.x;
                        v.y = rotated.y;
                    }
                }
                // translate by thing position
                vector3.add_to_list(s.computed.vertices, vector3.flatten(s.thing.position));
                // compute distance (whatever for? i forgot)
                s.computed.distance2 = vector.length2(vector.sub(s.computed.centroid, cam));
                // compute location on screen using camera transformation
                s.compute_screen();
            }
        }
    }
    ;
    static draw() {
        // hope this doesn't take too long per tick...
        Shape.compute();
        for (const s of Shape.draw_shapes) {
            s.draw();
        }
        ctx.globalAlpha = 1;
    }
    ;
    // gets screen vertices for everything on screen
    // for visibility purposes
    static get_vertices() {
        const verticess = [];
        for (const s of Shape.draw_shapes) {
            const vs = s.computed?.vertices;
            if (!vs)
                continue;
            if (s.thing.is_player)
                continue;
            if (s.z !== player.z) {
                // todo when the time comes...
                continue;
            }
            if (s.closed_loop)
                vs.push(vs[0]);
            verticess.push(vs);
        }
        return verticess;
    }
    ;
    id = ++Shape.cumulative_id;
    thing;
    z = 0;
    vertices = [];
    closed_loop = true;
    // computed
    computed;
    computed_aabb; // for use in Shape.filter()
    style = {};
    constructor(thing) {
        this.thing = thing;
        Shape.shapes.push(this);
    }
    get is_added() {
        return this.thing != undefined;
    }
    init_computed() {
        this.computed = {
            aabb: vector.make_aabb(this.vertices),
            aabb3: vector3.make_aabb(this.vertices),
            centroid: vector3.mean(this.vertices),
            vertices: vector3.clone_list(this.vertices),
        };
    }
    add(thing) {
        thing.shapes.push(this);
        this.thing = thing;
    }
    calculate() {
        // ok there's nothing to do here because the vertices _are_ the data
        return;
    }
    draw() {
        if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0)
            return;
        const style = this.style;
        // ctx.save("draw_shape");
        // if (this.thing) ctx.rotate(this.thing?.angle);
        ctx.begin();
        this.draw_path();
        ctx.lineCap = "square";
        ctx.globalAlpha = style.opacity ?? 1;
        if (style.stroke) {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * 2;
            ctx.stroke();
        }
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.globalAlpha = style.fill_opacity ?? 1;
            ctx.fill();
        }
        // ctx.restore("draw_shape");
    }
    draw_path() {
        if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0)
            return;
        ctx.lines_v(this.computed.screen_vertices, this.closed_loop);
    }
    compute_screen() {
        if (this.computed?.vertices == undefined)
            return;
        const vs = [];
        for (const world_v of this.computed.vertices) {
            const v = camera.world3screen(world_v);
            vs.push(vector3.create2(v, world_v.z - camera.look_z));
        }
        this.computed.screen_vertices = vs;
    }
}
export class Polygon extends Shape {
    static type = "polygon";
    static make(thing, radius, sides, angle, z = 0, x_offset = 0, y_offset = 0) {
        const s = new Polygon(thing);
        s.radius = radius;
        s.sides = sides;
        s.angle = angle;
        s.z = z;
        s.x_offset = x_offset;
        s.y_offset = y_offset;
        s.calculate();
        s.init_computed();
        return s;
    }
    radius = 0;
    sides = 3;
    angle = 0;
    x_offset = 0;
    y_offset = 0;
    calculate() {
        this.vertices = [];
        const sides = (this.sides === 0) ? 16 : this.sides;
        const r = this.radius;
        const x = this.x_offset;
        const y = this.y_offset;
        let a = this.angle;
        for (let i = 0; i < sides + 1; ++i) {
            a += Math.PI * 2 / sides;
            this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), this.z));
        }
    }
    draw_path() {
        if (this.sides === 0) {
            if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0)
                return;
            const [c, r] = this.computed.screen_vertices;
            ctx.circle(c.x, c.y, r.x);
        }
        else {
            super.draw_path();
        }
    }
    compute_screen() {
        if (this.sides === 0) {
            if (this.computed?.centroid == undefined)
                return;
            let c = this.computed.centroid;
            if (this.thing)
                c = vector3.add(c, vector3.flatten(this.thing.position));
            let r = vector3.create(this.radius, 0, this.z);
            r = vector3.add(r, vector3.create2(camera.position));
            const vs = [];
            for (const world_v of [c, r]) {
                const v = camera.world3screen(world_v);
                vs.push(vector3.create2(v, world_v.z - camera.look_z));
            }
            this.computed.screen_vertices = vs;
        }
        else {
            super.compute_screen();
        }
    }
}
export class Line extends Shape {
    static type = "line";
}
