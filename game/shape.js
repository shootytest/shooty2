import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { color, color2hex, STYLES, STYLES_, THEMES } from "../util/color.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { clone_object, make_rooms, make_shoot, multiply_and_override_object, override_object } from "./make.js";
import { Particle } from "./particle.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";
import { ui } from "./ui.js";
/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {
    static shapes = [];
    static draw_shapes = [];
    static floor_shapes = [];
    static map_shapes = [];
    static draw_zs = [];
    static cumulative_id = 0;
    static type = "shape";
    static from_map(thing, o) {
        const s = new Shape(thing);
        // s.map_shape_type_object = o;
        s.offset.z = 0; // o.z;
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
        if (thing.options.style) {
            s.style = clone_object(STYLES_[thing.options.style] ?? STYLES.error);
            s.has_style = true;
        }
        if (thing.options.style_)
            override_object(s.style, thing.options.style_);
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
        const offset = vector3.create(o.offset?.x ?? 0, o.offset?.y ?? 0, o.z);
        if (o.type === "polygon") {
            s = Shape.polygon(thing, o.radius ?? 0, o.sides ?? 0, o.angle ?? 0, offset);
        }
        else if (o.type === "circle") {
            s = Shape.circle(thing, o.radius ?? 0, offset);
        }
        else if (o.type === "line") {
            s = Shape.line(thing, o.v1 ?? vector.create(), o.v2 ?? vector.create(), o.z);
        }
        else {
            console.error(`[shape/from_make] shape type '${o.type}' doesn't exist!`);
            s = new Shape(thing);
        }
        s.options = o;
        s.seethrough = Boolean(thing.options.seethrough);
        if (o.style || thing.options.style) {
            s.style = clone_object(STYLES_[o.style ?? thing.options.style ?? "error"] ?? STYLES.error);
            s.has_style = true;
        }
        if (thing.options.style_)
            override_object(s.style, thing.options.style_);
        if (o.style_ != undefined)
            override_object(s.style, o.style_);
        if (o.shoot) {
            let S = make_shoot[o.shoot];
            if (o.shoot_ != undefined) {
                S = clone_object(S);
                override_object(S, o.shoot_);
            }
            if (S) {
                thing.add_shoot(S, s);
            }
            else
                console.error(`[shape/from_make] make_shoot '${o.shoot}' doesn't exist!`);
        }
        return s;
    }
    static polygon(thing, radius, sides, angle = 0, offset) {
        return Polygon.make(thing, radius, sides, angle, offset);
    }
    ;
    static circle(thing, radius, offset) {
        return Polygon.make(thing, radius, 0, 0, offset);
    }
    ;
    static line(thing, v1, v2 = vector.create(), z = 0) {
        const s = new Shape(thing);
        s.closed_loop = false;
        s.vertices = vector3.create_many([v1, v2], z);
        s.calculate();
        s.init_computed();
        return s;
    }
    ;
    static filter(screen_aabb) {
        const result = [];
        const memo_aabb3 = {};
        for (const s of Shape.shapes) {
            if (s.computed == undefined || s.thing == undefined || s.thing.options.invisible || (player.map_mode && !s.is_map && !s.thing.is_player))
                continue;
            // cullingz
            const z = s.z, z_string = Number(s.z.toFixed(3));
            if (s.computed.z_range)
                if (s.max_z < camera.look_z - 1 - math.epsilon || s.min_z > camera.z + math.epsilon)
                    continue;
                else if (z < camera.look_z - 1 - math.epsilon || z > camera.z + math.epsilon)
                    continue;
            s.computed_aabb = vector3.aabb_add(s.computed.aabb3, s.thing.position); // bottleneck :(
            if (memo_aabb3[z_string] == undefined) {
                const z_scale = camera.zscale_inverse(z >= 0 ? 0 : z);
                memo_aabb3[z_string] = vector3.aabb_scale(screen_aabb, vector3.create(z_scale, z_scale, 1));
            }
            const inside = vector3.aabb_intersect(s.computed_aabb, memo_aabb3[z_string]);
            s.computed.on_screen = inside;
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
            min_x: screen_topleft.x - config.graphics.shape_cull_padding,
            min_y: screen_topleft.y - config.graphics.shape_cull_padding,
            max_x: screen_bottomright.x + config.graphics.shape_cull_padding,
            max_y: screen_bottomright.y + config.graphics.shape_cull_padding,
            min_z: -Number.MAX_SAFE_INTEGER,
            max_z: Number.MAX_SAFE_INTEGER
        };
        Shape.draw_shapes = Shape.filter(screen_aabb);
        Shape.floor_shapes = [];
        Shape.map_shapes = [];
        for (const s of Shape.draw_shapes) {
            if (s.thing.options.floor || s.options.floor)
                Shape.floor_shapes.push(s);
            if ((s.thing.options.is_map || s.options.is_map) && !s.thing.options.map_parent)
                Shape.map_shapes.push(s);
            if (s.computed == undefined) {
                s.init_computed();
            }
            // compute location on screen using camera transformation
            s.compute_screen();
        }
        if (player.paused && !player.map_mode)
            Shape.draw_shapes.remove(player.shapes[0]);
        Shape.draw_zs = [...new Set(Shape.draw_shapes.map(s => s.z))];
        // sort everything
        Shape.draw_zs.sort((s1, s2) => s1 - s2);
        const draw_shapes_sort = (s1, s2) => {
            if (math.equal(s1.z, s2.z)) { // in the event of equal z...
                if (s1.thing.is_player && !s2.thing.is_player)
                    return 1; // players always above
                if (s2.thing.is_player && !s1.thing.is_player)
                    return -1;
                const o1 = s1.thing.options, o2 = s2.thing.options;
                if (o1.force_above && !o2.force_above)
                    return 1; // force
                if (o2.force_above && !o1.force_above)
                    return -1;
                if (o1.map_parent && !o2.map_parent)
                    return 1; // map children always above
                if (o2.map_parent && !o1.map_parent)
                    return -1;
                if (o1.floor && !o2.floor)
                    return -1; // floors always below
                if (o2.floor && !o1.floor)
                    return 1;
                if (o1.floor && o2.floor) {
                    if (o1.safe_floor && !o2.safe_floor)
                        return -1; // safe floors even more below
                    if (o2.safe_floor && !o1.safe_floor)
                        return 1;
                }
                return 0;
            }
            else
                return s1.z - s2.z; // lower z first
        };
        Shape.draw_shapes.sort(draw_shapes_sort);
        Shape.map_shapes.sort((s1, s2) => draw_shapes_sort(s1, s2));
        Shape.floor_shapes.sort((s1, s2) => -draw_shapes_sort(s1, s2)); // reverse of draw_shapes
        // nowhere else to put this... handle particles
        for (const p of Particle.particles) {
            if (p.z !== 0) {
                const z = math.round_to(p.z, 0.001);
                if (!Shape.draw_zs.includes(z))
                    Shape.draw_zs.push(z);
            }
        }
        Particle.particles.sort((p1, p2) => p1.z - p2.z);
        Shape.see_vertices = Shape.calc_vertices();
        Shape.see_other_vertices = Shape.calc_other_vertices();
    }
    ;
    static draw(z) {
        for (const s of Shape.draw_shapes) {
            if (z != undefined && !math.equal(s.z, z))
                continue;
            s.draw_all();
        }
        ctx.globalAlpha = 1;
    }
    ;
    // calculates world vertices for everything on screen for visibility purposes
    static see_z_range = [0, 0];
    static see_vertices = [];
    static see_other_vertices = {};
    static calc_vertices() {
        const result = [];
        let min_z = 9999999, max_z = -9999999;
        for (const s of Shape.draw_shapes) {
            const vs = s.computed?.vertices;
            if (!vs)
                continue;
            if (s.seethrough)
                continue;
            if (s.z < min_z)
                min_z = s.z;
            if (s.z > max_z)
                max_z = s.z;
            if (s.closed_loop)
                vs.push(vs[0]);
            result.push(vs);
        }
        if (Shape.draw_shapes.length > 0)
            Shape.see_z_range = [min_z, max_z];
        return result;
    }
    ;
    static calc_other_vertices() {
        const result = {};
        for (const s of Shape.draw_shapes) {
            const vs = s.computed?.vertices;
            if (!vs)
                continue;
            if (s.translucent <= 0 || !s.seethrough)
                continue;
            if (s.closed_loop)
                vs.push(vs[0]);
            const translucent = math.round_to(s.translucent, 0.001).toFixed(3) + "|" + s.z.toFixed(3);
            if (!result[translucent])
                result[translucent] = [];
            result[translucent]?.push(vs);
        }
        return result;
    }
    ;
    id = ++Shape.cumulative_id;
    thing;
    index = -1;
    vertices = [];
    offset = vector3.create();
    scale = vector.create(1, 1);
    opacity = 1;
    activate_scale = false;
    closed_loop = true;
    options = {
        type: "none",
    };
    translucent = 0;
    get z() {
        return this.offset.z + this.thing.z;
    }
    get avg_z() {
        if (!this.thing.options.force_max_z)
            return this.z;
        else
            return this.computed?.mean.z ?? this.z;
    }
    get min_z() {
        return this.computed?.z_range?.[0] ?? this.z;
    }
    get max_z() {
        return this.computed?.z_range?.[1] ?? this.z;
    }
    get r() {
        return 0;
    }
    get seethrough() {
        return !(this.translucent >= 1 - math.epsilon);
    }
    set seethrough(see) {
        if (see)
            this.translucent = 0;
        else
            this.translucent = 1;
    }
    get is_map() {
        return Boolean(this.thing.options.is_map || this.options.is_map);
    }
    // computed
    computed;
    computed_aabb; // for use in Shape.filter()
    // map_shape_type_object?: map_shape_type;
    style = {};
    has_style = false;
    constructor(thing) {
        this.thing = thing;
        this.add(thing);
    }
    get is_added() {
        return this.thing != undefined;
    }
    get is_circle() {
        return this.computed?.screen_vertices?.[2]?.x === -123 && this.computed?.screen_vertices?.[2]?.y === -123 && this.computed?.screen_vertices?.[2]?.z === -123;
    }
    get has_shadow() {
        // no shadows for now...
        return false;
        // return !this.thing.is_player && this.thing.parent.is_player;
        // return !this.thing.options.decoration && !this.thing.cover_z && Math.abs(this.z - camera.look_z) > math.epsilon && !this.thing.is_player;
    }
    init_computed() {
        const calc_vertices = vector3.add_list(this.vertices, this.offset), vertices = vector3.clone_list(this.vertices);
        if (this.activate_scale)
            vector3.scale_to_list(calc_vertices, this.scale);
        const aabb = vector.make_aabb(calc_vertices), aabb3 = vector3.make_aabb(calc_vertices), mean = this.closed_loop ? vector3.create2(Vertices.centre(calc_vertices), vector3.meanz(calc_vertices)) : vector3.mean(calc_vertices); // don't be mean...
        if (this.computed == undefined) {
            this.computed = { aabb, aabb3, mean, vertices };
        }
        else {
            this.computed.aabb = aabb;
            this.computed.aabb3 = aabb3;
            this.computed.mean = mean;
            this.computed.vertices = calc_vertices;
        }
        const z_range = vector3.z_range(this.vertices);
        if (!math.equal(z_range[0], z_range[1])) {
            this.computed.z_range = z_range;
        }
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
        this.computed.aabb = vector.make_aabb(this.computed.vertices);
        this.computed.aabb3 = vector3.make_aabb(this.computed.vertices);
        // translate by thing position
        vector3.add_to_list(this.computed.vertices, this.thing.position);
        // no need to compute distance to camera centre... maybe next time? (for 3d optimisation? what)
        // this.computed.distance2 = vector.length2(vector.sub(this.computed.mean, camera.location3));
        const screen_vs = [];
        const shadow_vs = []; // only use if shadows enabled
        for (const world_v of this.computed.vertices) {
            const v = camera.world3screen(world_v, player);
            screen_vs.push(vector3.create2(v, world_v.z - camera.look_z));
        }
        if (this.has_shadow) {
            for (const world_v of this.computed.vertices)
                shadow_vs.push(vector3.create2(camera.world3screen(vector3.create2(world_v, camera.look_z)), camera.look_z));
        }
        this.computed.screen_vertices = screen_vs;
        this.computed.shadow_vertices = shadow_vs;
        // todo compute shadow_vertices
    }
    add(thing) {
        this.thing = thing;
        this.thing.shapes.push(this);
        this.index = this.thing.shapes.length - 1;
        Shape.shapes.push(this);
    }
    calculate() {
        // nothing to do here because the vertices are already the data
        return;
    }
    color2hex(c) {
        if (this.is_map)
            return "" + (THEMES[make_rooms[this.thing.room_id].theme][c] ?? c);
        else
            return color2hex(c);
    }
    draw_all() {
        if (ui.map.hide_map && this.is_map)
            return;
        if (this.options.clip)
            this.draw_clip();
        else
            this.draw();
        this.draw_glow();
        this.draw_blink();
        if (this.index <= 0) {
            this.draw_health();
            this.draw_repel();
        }
    }
    draw(style_mult, shadow = false) {
        if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0 || this.computed.shadow_vertices == undefined)
            return;
        let style = this.style;
        if (style_mult) {
            style = clone_object(this.style);
            multiply_and_override_object(style, style_mult);
        }
        ctx.beginPath();
        this.draw_path(shadow ? this.computed.shadow_vertices : this.computed.screen_vertices);
        const override_pause_opacity = this.thing.is_player && this.index >= 1 && player.paused && !player.map_mode;
        const opacity_mult = this.opacity * (style.opacity ?? 1) * (this.is_map ? ui.map.opacity : 1) * (override_pause_opacity ? config.graphics.pause_opacity : 1);
        if (style.stroke) {
            ctx.strokeStyle = this.color2hex(style.stroke);
            ctx.globalAlpha = opacity_mult * (style.stroke_opacity ?? 1);
            ctx.lineWidth = (style.width ?? 1) * camera.scale * camera.zscale(this.avg_z, true) * config.graphics.linewidth_mult * (this.translucent <= math.epsilon ? 1 : 1.8); // * (this.thing.options.seethrough && this.thing.is_wall ? 0.5 : 1);
            ctx.stroke();
        }
        if (style.fill && this.closed_loop) {
            ctx.fillStyle = this.color2hex(style.fill);
            ctx.globalAlpha = opacity_mult * (style.fill_opacity ?? 1);
            ctx.fill();
        }
        if (!shadow && (this.computed.shadow_vertices?.length ?? 0) >= 1) {
            this.draw({ opacity: 0.5, }, true);
        }
    }
    draw_path(vertices) {
        ctx.lines_v(vertices, this.closed_loop);
    }
    draw_health() {
        if (this.computed?.screen_vertices == undefined || !this.computed.on_screen || this.thing.health == undefined)
            return;
        if (this.thing.options.hide_health) {
            if (this.thing.options.wall_filter) {
                const until = this.thing.options.hide_health_until;
                if (until && until < (this.thing.health?.value ?? 0))
                    return;
                const ratio = math.bound(until ? this.thing.health.value / until : this.thing.health.ratio, 0, 1);
                this.translucent = ratio;
                this.style.stroke_opacity = ratio;
            }
            return;
        }
        const ratio = this.thing.health.display_ratio;
        if (math.equal(ratio, 1))
            return;
        ctx.ctx.save();
        const c = this.is_circle ? this.computed.screen_vertices[0] : vector.aabb_centre(vector.make_aabb(this.computed.screen_vertices));
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        const angle = (this.thing.is_player ? 0 : this.thing.angle) - (Thing.time / config.seconds * config.graphics.health_rotate_speed);
        ctx.arc_v(c, 123456, angle % (Math.PI * 2), (angle + Math.PI * 2 * ratio) % (Math.PI * 2));
        ctx.lineTo(c.x, c.y);
        ctx.clip();
        const health_color = this.style.health ?? color.red;
        const health_opacity = this.style.health_opacity ?? 0.3;
        const style_mult = {
            stroke_opacity: health_opacity,
            fill_opacity: health_opacity,
        };
        if (this.style.stroke) {
            style_mult.stroke = health_color;
            style_mult.fill_opacity = 0;
        }
        else if (this.style.fill)
            style_mult.fill = health_color;
        // else console.error(`[shape/draw_health] no fill or stroke in ${this.thing.id}`);
        this.draw(style_mult);
        ctx.ctx.restore();
    }
    draw_blink() {
        if (!this.options.blinking && (!this.thing.health?.invincible))
            return;
        if (this.thing.is_player && player.paused)
            return;
        const style_mult = {
            stroke_opacity: math.bounce(Thing.time, config.graphics.blink_time) * 0.5,
            fill_opacity: math.bounce(Thing.time, config.graphics.blink_time) * 0.5,
        };
        if (this.style.fill)
            style_mult.fill = color.blackground;
        if (this.style.stroke)
            style_mult.stroke = color.blackground;
        this.draw(style_mult);
    }
    draw_glow() {
        if (!this.options.glowing || this.options.glowing < 0)
            return;
        const glow = this.options.glowing;
        const frac = glow - Math.floor(glow);
        const style_mult = {
            fill: this.style.stroke,
            fill_opacity: ((this.style.stroke_opacity ?? 1) / (this.style.fill_opacity || 1)) * (frac === 0 ? 0.8 : frac),
        };
        ctx.ctx.shadowBlur = config.graphics.shadowblur;
        ctx.ctx.shadowColor = this.color2hex(this.style.stroke ?? color.white);
        for (let i = 0; i < glow; i++)
            this.draw(style_mult);
        ctx.ctx.shadowBlur = 0;
    }
    draw_clip() {
        if (this.computed?.screen_vertices == undefined || !this.computed.on_screen || !this.options.clip)
            return;
        const clip = this.options.clip;
        let ratio = 0; // can be negative too!
        let angle = 0; // -Thing.time / config.seconds * config.graphics.health_rotate_speed;
        if (clip.timing === "fixed") {
            ratio = clip.end - clip.start;
            angle = clip.start * Math.PI * 2;
        }
        else if (clip.timing === "bullet") {
            ratio = 1 - (this.thing.bullet_time_ratio - clip.start) / (clip.end - clip.start);
        }
        // handle edge cases
        if (ratio <= math.epsilon)
            return;
        else if (ratio >= 1 - math.epsilon)
            return this.draw();
        // clip!
        ctx.ctx.save();
        const c = this.is_circle ? this.computed.screen_vertices[0] : vector.aabb_centre(vector.make_aabb(this.computed.screen_vertices));
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.arc_v(c, 123456, angle % (Math.PI * 2), (angle + Math.PI * 2 * ratio) % (Math.PI * 2));
        ctx.lineTo(c.x, c.y);
        ctx.clip();
        this.draw();
        ctx.ctx.restore();
    }
    draw_repel() {
        if (!this.thing.options.repel_range || this.computed?.screen_vertices == undefined || !this.computed?.on_screen)
            return;
        const c = this.is_circle ? this.computed.screen_vertices[0] : vector.aabb_centre(vector.make_aabb(this.computed.screen_vertices));
        const r = this.thing.options.repel_range * camera.scale * camera.zscale(this.thing.z);
        ctx.beginPath();
        ctx.circle_v(c, r);
        ctx.globalAlpha = 1;
        ctx.lineWidth = (this.style.width ?? 1) * camera.scale * camera.zscale(this.z, true) * config.graphics.linewidth_mult;
        ctx.strokeStyle = color.white + "88";
        ctx.fillStyle = color.white + "22";
        ctx.fill();
        ctx.stroke();
    }
    remove() {
        for (const array of [Shape.shapes, this.thing.shapes]) {
            // remove this from array
            array?.remove(this);
        }
    }
    scale_size(size) {
        this.offset = vector3.mult(this.offset, size);
        vector3.scale_to_list(this.vertices, vector.create(size, size));
    }
    break(o = {}) {
        if (this.computed?.vertices == undefined || !this.computed.on_screen)
            return;
        const style = clone_object(this.style);
        style.opacity = (style.opacity ?? 1) * (o.opacity_mult ?? 0.4);
        const time = (o.time ?? 0.2) * config.seconds;
        const p = new Particle();
        p.style = style;
        p.time = Thing.time + time;
        p.z = this.z;
        if (o.type === "triangulate" && this.computed.vertices.length <= 2) {
            console.error(`[shape/break] can't triangulate 2 or less vertices!`);
            o.type = "fade";
        }
        if (o.type === "triangulate") {
            const mean = vector.mean(this.computed.vertices);
            for (const triangle of math.triangulate_polygon(this.computed.vertices)) {
                // todo huh why wasn't i creating a new particle for each triangle?
                const c = vector.sub(vector.mean(triangle), mean);
                p.vertices = triangle;
                p.velocity = vector.mult(c, o.speed ?? 0.1);
            }
        }
        else if (o.type === "fade") {
            p.vertices = this.computed.vertices;
            p.fade_time = time;
        }
        if (o.velocity)
            p.velocity = o.velocity;
        return p;
    }
    zzz() {
        if (this.computed?.vertices == undefined || !this.computed.on_screen)
            return;
        const p = Particle.make_icon("z", Math.min(this.r / 2, 50), vector3.create2(math.rand_point_in_circle(this.thing.position, this.r / 2), this.thing.position.z), vector3.create2(math.rand_point_in_circle(vector.create(), 10), 0.5));
        p.time = Thing.time + (2 * config.seconds);
        p.style.fill = this.style.fill;
        p.style.opacity = 0.3;
        p.z = this.z;
        return p;
    }
}
;
export class Polygon extends Shape {
    static type = "polygon";
    static make(thing, radius, sides, angle, offset = vector3.create()) {
        const s = new Polygon(thing);
        s.closed_loop = true;
        s.radius = radius;
        s.sides = sides;
        s.angle = angle;
        s.offset.x = offset.x;
        s.offset.y = offset.y;
        if (offset.z)
            s.offset.z = offset.z;
        s.calculate();
        s.init_computed();
        return s;
    }
    radius = 0;
    sides = 0;
    angle = 0;
    get r() {
        return this.radius;
    }
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
            this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), 0));
            a += Math.PI * 2 / sides;
        }
    }
    draw_path(vertices) {
        if (this.sides === 0) {
            const [c, r] = vertices;
            ctx.circle(c.x, c.y, r.x);
        }
        else {
            super.draw_path(vertices);
        }
    }
    compute_screen() {
        if (this.sides === 0) {
            if (this.computed == undefined)
                return;
            let c = vector3.clone(this.offset);
            let r = vector3.create(this.radius, 0, 0);
            const rotated = vector.rotate(vector.create(), c, this.thing.angle);
            c.x = rotated.x;
            c.y = rotated.y;
            c = vector3.add(c, this.thing.position);
            r = vector3.add(r, c);
            const screen_vs = [];
            const shadow_vs = [];
            for (const world_v of [c, r]) {
                const v = camera.world3screen(world_v, player);
                screen_vs.push(vector3.create2(v, world_v.z - camera.look_z));
            }
            screen_vs[1] = vector3.sub(screen_vs[1], screen_vs[0]);
            const shhh = vector3.create(-123, -123, -123);
            screen_vs.push(shhh);
            if (this.has_shadow) {
                for (const world_v of [c, r])
                    shadow_vs.push(vector3.create2(camera.world3screen(vector3.create2(world_v, camera.look_z)), camera.look_z));
                shadow_vs[1] = vector3.sub(shadow_vs[1], shadow_vs[0]);
                const shhh = vector3.create(-123, -123, -123);
                shadow_vs.push(shhh);
            }
            this.computed.screen_vertices = screen_vs;
            this.computed.vertices = [c, r, shhh];
            this.computed.shadow_vertices = shadow_vs;
        }
        else {
            super.compute_screen();
        }
    }
    scale_size(size) {
        this.offset = vector3.mult(this.offset, size);
        this.radius *= size;
        this.calculate();
    }
}
;
