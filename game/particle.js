import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { config } from "../util/config.js";
import { vector, vector3 } from "../util/vector.js";
import { Thing } from "./thing.js";
export class Particle {
    static particles = [];
    static tick_particles() {
        for (const particle of Particle.particles) {
            particle.tick();
        }
    }
    static draw_particles() {
        for (const particle of Particle.particles) {
            particle.draw();
        }
        ctx.globalAlpha = 1;
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
    static make_target(screen_vertices, target, smoothness) {
        const p = new Particle();
        p.vertices = screen_vertices;
        p.centralise();
        p.target = target;
        p.smoothness = smoothness ?? 0.1;
        return p;
    }
    vertices = [];
    offset = vector.create();
    velocity = vector.create();
    acceleration = vector.create();
    jerk = vector.create();
    target;
    smoothness;
    opacity = 1;
    fade = -1;
    style = {};
    time = -1;
    constructor() {
        Particle.particles.push(this);
    }
    centralise() {
        const c = Vertices.centre(this.vertices);
        vector3.add_to_list(this.vertices, vector.mult(c, -1));
        this.offset = vector3.add_(this.offset, vector3.create2(c));
    }
    tick() {
        if (this.target != undefined) {
            const offset = vector.lerp(this.offset, this.target, this.smoothness ?? 0.1);
            this.offset.x = offset.x;
            this.offset.y = offset.y;
        }
        else {
            this.offset = vector3.add_(this.offset, this.velocity);
            this.velocity = vector3.add_(this.velocity, this.acceleration);
            this.acceleration = vector3.add_(this.acceleration, this.jerk);
        }
        if (Thing.time > this.time) {
            this.remove();
        }
        else if (this.fade > 0) {
            this.opacity = (this.time - Thing.time) / this.fade;
        }
    }
    draw() {
        const style = this.style;
        ctx.beginPath();
        this.draw_path();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (style.stroke) {
            ctx.strokeStyle = style.stroke;
            ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1) * this.opacity;
            ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * config.graphics.linewidth_mult;
            ctx.stroke();
        }
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1) * this.opacity;
            ctx.fill();
        }
    }
    draw_path() {
        if (this.vertices[2].x === -123 && this.vertices[2].y === -123 && this.vertices[2].z === -123) {
            const [c, r] = this.vertices;
            ctx.circle(Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
        }
        else {
            ctx.lines_v(vector.add_list(this.vertices, this.offset), true);
        }
    }
    remove() {
        const index = Particle.particles.indexOf(this);
        if (index != undefined && index > -1) {
            Particle.particles.splice(index, 1);
        }
    }
}
;
