import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { config } from "../util/config.js";
import { map_serialiser, STYLES } from "../util/map_type.js";
import { vector, vector3 } from "../util/vector.js";
import { make_shoot } from "./make.js";
import { player } from "./player.js";
/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {
    static shapes = [];
    static draw_shapes = [];
    static draw_zs = [];
    static cumulative_id = 0;
    static type = "shape";
    static from_map(thing, o) {
        const s = new Shape(thing);
        // s.map_shape_type_object = o;
        s.z = o.z;
        // booleans
        s.closed_loop = !(thing.options.open_loop);
        s.seethrough = Boolean(thing.options.seethrough);
        // handle vertices
        s.vertices = vector3.create_many(o.vertices, o.z);
        if (o.computed == undefined)
            throw "map shape not computed yet!";
        const dv = (thing.shapes.length >= 2) ? thing.position : o.computed.mean;
        for (const v of s.vertices) {
            v.x -= dv.x;
            v.y -= dv.y;
        }
        s.style = map_serialiser.clone_style(thing.options.style == undefined ? STYLES.error : (STYLES[thing.options.style] ?? STYLES.error));
        s.init_computed();
        if (thing.shapes.length >= 2) { // runs for merged shapes
            s.offset.x = thing.position.x - o.computed.mean.x;
            s.offset.y = thing.position.y - o.computed.mean.y;
        }
        return s;
    }
    ;
    static from_make(thing, o) {
        let s;
        if (o.type === "polygon") {
            s = Shape.polygon(thing, o.radius ?? 0, o.sides ?? 0, o.angle ?? 0, o.z, o.offset);
        }
        else if (o.type === "circle") {
            s = Shape.circle(thing, o.radius ?? 0, o.z, o.offset);
        }
        else if (o.type === "line") {
            s = Shape.line(thing, o.v1 ?? vector.create(), o.v2 ?? vector.create(), o.z);
        }
        else {
            s = new Shape(thing);
        }
        s.seethrough = Boolean(thing.options.seethrough);
        s.style = map_serialiser.clone_style(thing.options.style == undefined ? STYLES.error : (STYLES[thing.options.style] ?? STYLES.error));
        if (o.shoot) {
            const S = make_shoot[o.shoot];
            if (S) {
                thing.add_shoot(S, s);
            }
            else
                console.error(`[shape/from_make] make_shoot '${o.shoot}' doesn't exist!`);
        }
        return s;
    }
    static polygon(thing, radius, sides, angle = 0, z = 0, offset) {
        return Polygon.make(thing, radius, sides, angle, z, offset);
    }
    ;
    static circle(thing, radius, z = 0, offset) {
        return Polygon.make(thing, radius, 0, 0, z, offset);
    }
    ;
    static line(thing, v1, v2 = vector.create(), z = 0) {
        const s = new Shape(thing);
        s.closed_loop = false;
        s.vertices = vector3.create_many([v1, v2], z);
        s.z = z;
        s.calculate();
        s.init_computed();
        return s;
    }
    ;
    static filter(aabb) {
        const result = [];
        for (const s of Shape.shapes) {
            if (s.computed == undefined || s.thing == undefined || s.thing.options.invisible)
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
        const screen_topleft = camera.screen2world({ x: 0, y: 0 });
        const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
        const screen_aabb = {
            min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -Infinity, max_z: Infinity,
        };
        Shape.draw_shapes = Shape.filter(screen_aabb);
        Shape.draw_zs = [0];
        for (const s of Shape.draw_shapes) {
            if (s.z !== 0 && !Shape.draw_zs.includes(s.z))
                Shape.draw_zs.push(s.z);
            if (s.computed == undefined) {
                s.init_computed();
            }
            if (s.computed != undefined) { // always true at this point
                // compute location on screen using camera transformation
                s.compute_screen();
            }
        }
        Shape.draw_zs.sort();
    }
    ;
    static draw(z) {
        // hope this doesn't take too long per tick...
        Shape.draw_shapes.sort((s1, s2) => {
            if (s1.thing.options.decoration && !s2.thing.options.decoration)
                return -1;
            if (s2.thing.options.decoration && !s1.thing.options.decoration)
                return 1;
            return s1.z - s2.z;
        });
        for (const s of Shape.draw_shapes) {
            if (z != undefined && s.z !== z)
                continue;
            s.draw();
        }
        ctx.globalAlpha = 1;
    }
    ;
    // gets screen vertices for everything on screen
    // for visibility purposes
    static get_vertices() {
        const result = [];
        for (const s of Shape.draw_shapes) {
            const vs = s.computed?.vertices;
            if (!vs)
                continue;
            if (s.seethrough)
                continue;
            if (s.thing.is_player)
                continue;
            if (s.z !== player.z) {
                // todo when the time comes...
                //continue;
            }
            if (s.closed_loop)
                vs.push(vs[0]);
            result.push(vs);
        }
        return result;
    }
    ;
    id = ++Shape.cumulative_id;
    thing;
    z = 0;
    vertices = [];
    offset = vector.create();
    scale = vector.create(1, 1);
    opacity = 1;
    activate_scale = false;
    closed_loop = true;
    seethrough = false;
    // computed
    computed;
    computed_aabb; // for use in Shape.filter()
    // map_shape_type_object?: map_shape_type;
    style = {};
    constructor(thing) {
        this.thing = thing;
        this.add(thing);
    }
    get is_added() {
        return this.thing != undefined;
    }
    init_computed() {
        this.computed = {
            aabb: vector.make_aabb(this.vertices),
            aabb3: vector3.make_aabb(this.vertices),
            mean: this.closed_loop ? vector3.create2(Vertices.centre(this.vertices), this.z) : vector3.mean(this.vertices),
            vertices: vector3.clone_list(this.vertices),
        };
    }
    add(thing) {
        this.thing = thing;
        this.thing.shapes.push(this);
        Shape.shapes.push(this);
    }
    calculate() {
        // ok there's nothing to do here because the vertices _are_ the data
        return;
    }
    draw() {
        if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0)
            return;
        const style = this.style;
        ctx.beginPath();
        this.draw_path();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = style.opacity ?? 1;
        if (style.stroke) {
            ctx.strokeStyle = style.stroke;
            ctx.globalAlpha = style.stroke_opacity ?? 1;
            ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * config.graphics.linewidth_mult * (this.seethrough ? 1 : 1.8);
            ctx.stroke();
        }
        if (style.fill && this.closed_loop) {
            ctx.fillStyle = style.fill;
            ctx.globalAlpha = style.fill_opacity ?? 1;
            ctx.fill();
        }
    }
    draw_path() {
        if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0)
            return;
        ctx.lines_v(this.computed.screen_vertices, this.closed_loop);
    }
    compute_screen() {
        if (this.computed?.vertices == undefined)
            return;
        // compute vertices and offset by shape offset
        this.computed.vertices = vector3.add_list(this.vertices, this.offset);
        if (this.activate_scale)
            vector3.scale_to_list(this.computed.vertices, this.scale);
        // rotate by thing angle
        if (this.thing.angle) {
            for (const v of this.computed.vertices) {
                const rotated = vector.rotate(vector.create(), v, this.thing.angle);
                v.x = rotated.x;
                v.y = rotated.y;
            }
        }
        // translate by thing position
        vector3.add_to_list(this.computed.vertices, vector3.clone(this.thing.position));
        // no need to compute distance to camera centre... maybe next time for optimisation?
        // this.computed.distance2 = vector.length2(vector.sub(this.computed.mean, camera.location3));
        const vs = [];
        for (const world_v of this.computed.vertices) {
            const v = camera.world3screen(world_v, player);
            vs.push(vector3.create2(v, world_v.z - camera.look_z));
        }
        this.computed.screen_vertices = vs;
    }
    remove() {
        for (const array of [Shape.shapes, this.thing.shapes]) {
            // remove this from array
            const index = array?.indexOf(this);
            if (index != undefined && index > -1) {
                array?.splice(index, 1);
            }
        }
    }
}
export class Polygon extends Shape {
    static type = "polygon";
    static make(thing, radius, sides, angle, z = 0, offset = vector.create()) {
        const s = new Polygon(thing);
        s.closed_loop = true;
        s.radius = radius;
        s.sides = sides;
        s.angle = angle;
        s.z = z;
        s.offset.x = offset.x;
        s.offset.y = offset.y;
        s.calculate();
        s.init_computed();
        return s;
    }
    radius = 0;
    sides = 3;
    angle = 0;
    constructor(thing) {
        super(thing);
    }
    calculate() {
        this.vertices = [];
        const sides = (this.sides === 0) ? 16 : this.sides;
        const r = this.radius;
        const x = this.offset.x;
        const y = this.offset.y;
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
            if (this.computed?.mean == undefined)
                return;
            let c = vector3.add(this.computed.mean, vector3.create2(this.offset));
            const rotated = vector.rotate(vector.create(), c, this.thing.angle);
            c.x = rotated.x;
            c.y = rotated.y;
            if (this.thing)
                c = vector3.add(c, vector3.clone(this.thing.position));
            let r = vector3.create(this.radius, 0, this.z);
            r = vector3.add(r, vector3.create2(this.thing.position));
            const vs = [];
            for (const world_v of [c, r]) {
                const v = camera.world3screen(world_v, player);
                vs.push(vector3.create2(v, world_v.z - camera.look_z));
            }
            vs[1] = vector3.sub(vs[1], vs[0]);
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
