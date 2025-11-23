import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { color, color2hex } from "../util/color.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";
export class Particle {
    static particles = [];
    static tick_particles(dt) {
        for (const particle of Particle.particles) {
            particle.tick(dt);
        }
    }
    static draw_particles(z) {
        if (player.map_mode)
            return;
        if (z)
            z = math.round_dp(z, 3);
        for (const particle of Particle.particles) {
            if (z != undefined && particle.z !== z)
                continue;
            particle.draw();
        }
        ctx.globalAlpha = 1;
    }
    static get_screen_particles() {
        return this.particles.filter((particle) => particle.is_screen);
    }
    static get_world_particles() {
        return this.particles.filter((particle) => !particle.is_screen);
    }
    static make(screen_vertices, velocity, acceleration, jerk) {
        const p = new Particle();
        p.vertices = screen_vertices;
        if (velocity)
            p.velocity = velocity;
        if (acceleration)
            p.acceleration = acceleration;
        if (jerk)
            p.jerk = jerk;
        return p;
    }
    static make_icon(icon, radius, position, velocity, acceleration, jerk) {
        const p = new Particle();
        p.vertices = [position, vector.add(position, vector.create(radius))];
        p.icon = icon;
        if (velocity)
            p.velocity = velocity;
        if (acceleration)
            p.acceleration = acceleration;
        if (jerk)
            p.jerk = jerk;
        return p;
    }
    static make_target(screen_vertices, target, smoothness) {
        const p = new Particle();
        p.vertices = screen_vertices;
        p.centralise();
        p.target = target;
        p.smoothness = smoothness ?? 0.1;
        return p;
    }
    vertices = [];
    is_screen = false; // indicates if the particle's vertices are in screen coordinates
    z = 0;
    screen_vertices = [];
    offset = vector.create();
    velocity = vector.create();
    acceleration = vector.create();
    jerk = vector.create();
    target;
    smoothness;
    opacity = 1;
    style = {};
    time = -1;
    fade_time = -1;
    max_offset_length;
    icon = "";
    constructor() {
        Particle.particles.push(this);
    }
    get total_z() {
        return this.z + (this.offset.z ?? 0);
    }
    get is_circle() {
        return this.vertices.length >= 3 && this.vertices[2]?.x === -123 && this.vertices[2]?.y === -123 && this.vertices[2]?.z === -123;
    }
    centralise() {
        const c = Vertices.centre(this.vertices);
        vector3.add_to_list(this.vertices, vector.mult(c, -1));
        this.offset = vector3.add_(this.offset, vector3.create2(c));
    }
    tick(dt) {
        if (this.target != undefined) {
            const offset = vector.lerp(this.offset, this.target, this.smoothness ?? 0.1);
            this.offset.x = offset.x;
            this.offset.y = offset.y;
        }
        else {
            const mult = dt / config.seconds;
            this.offset = vector3.add_(this.offset, vector3.mult_(this.velocity, mult));
            this.velocity = vector3.add_(this.velocity, vector3.mult_(this.acceleration, mult));
            this.acceleration = vector3.add_(this.acceleration, vector3.mult_(this.jerk, mult));
            if (this.max_offset_length != undefined && vector.length2(this.offset) > this.max_offset_length ** 2)
                this.remove();
        }
        if (Thing.time > this.time) {
            this.remove();
        }
        else if (this.fade_time > 0) {
            this.opacity = (this.time - Thing.time) / this.fade_time;
        }
    }
    draw() {
        const style = this.style;
        if (this.icon) {
            this.compute_screen();
            const [c, r] = this.screen_vertices;
            ctx.fillStyle = color2hex(style.fill ?? color.error);
            ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1) * this.opacity;
            ctx.svg(this.icon, Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
        }
        else {
            ctx.beginPath();
            this.draw_path();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            if (style.stroke) {
                ctx.strokeStyle = color2hex(style.stroke ?? color.error);
                ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1) * this.opacity;
                ctx.lineWidth = (style.width ?? 1) * camera.scale * camera.zscale(this.total_z, true) * config.graphics.linewidth_mult;
                ctx.stroke();
            }
            if (style.fill) {
                ctx.fillStyle = color2hex(style.fill ?? color.error);
                ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1) * this.opacity;
                ctx.fill();
            }
        }
    }
    draw_path() {
        this.compute_screen();
        if (this.is_circle) {
            const [c, r] = this.screen_vertices;
            ctx.circle(Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
        }
        else if (this.icon) {
            console.error("[particle/draw_path] why is this particle an icon");
        }
        else {
            ctx.lines_v(this.screen_vertices, true);
        }
    }
    compute_screen() {
        if (this.is_screen)
            this.screen_vertices = this.vertices;
        else {
            const vs = [];
            for (const vertex of this.vertices) {
                const world_v = vector3.create2(vector.add(vertex, this.offset), this.total_z);
                const v = camera.world3screen(world_v, player);
                vs.push(vector3.create2(v, world_v.z - camera.look_z));
            }
            if (this.is_circle || this.icon) {
                vs[1] = vector3.sub(vs[1], vs[0]);
            }
            this.screen_vertices = vs;
        }
    }
    remove() {
        Particle.particles.remove(this);
    }
}
;
