import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { config } from "../util/config.js";
import { style_type } from "../util/map_type.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";


export class Particle {

  static particles: Particle[] = [];

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

  static make(screen_vertices: vector3_[], velocity?: vector, acceleration?: vector, jerk?: vector): Particle {
    const p = new Particle();
    p.vertices = screen_vertices;
    if (velocity) p.velocity = velocity;
    if (acceleration) p.acceleration = acceleration;
    if (jerk) p.jerk = jerk;
    return p;
  }

  static make_target(screen_vertices: vector3_[], target: vector, smoothness?: number): Particle {
    const p = new Particle();
    p.vertices = screen_vertices;
    p.centralise();
    p.target = target;
    p.smoothness = smoothness ?? 0.1;
    return p;
  }


  vertices: vector3_[] = [];
  is_screen = false; // indicates if the particle's vertices are in screen coordinates
  z: number = 0;
  screen_vertices: vector[] = [];
  offset: vector3_ = vector.create();
  velocity: vector3_ = vector.create();
  acceleration: vector3_ = vector.create();
  jerk: vector3_ = vector.create();
  target?: vector3_;
  smoothness?: number;
  opacity: number = 1;
  fade: number = -1;
  style: style_type = {};
  time: number = -1;


  constructor() {
    Particle.particles.push(this);
  }

  get is_circle() {
    return this.vertices[2]?.x === -123 && this.vertices[2]?.y === -123 && this.vertices[2]?.z === -123;
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
    } else {
      this.offset = vector3.add_(this.offset, this.velocity);
      this.velocity = vector3.add_(this.velocity, this.acceleration);
      this.acceleration = vector3.add_(this.acceleration, this.jerk);
    }
    if (Thing.time > this.time) {
      this.remove();
    } else if (this.fade > 0) {
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
    this.compute_screen();
    if (this.is_circle) {
      const [c, r] = this.screen_vertices;
      ctx.circle(Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
    } else {
      ctx.lines_v(this.screen_vertices, true);
    }
  }

  compute_screen() {
    if (this.is_screen) this.screen_vertices = this.vertices;
    else {
      const vs: vector3[] = [];
      for (const vertex of this.vertices) {
        const world_v = vector3.create2(vector.add(vertex, this.offset), this.z + (this.offset.z ?? 0));
        const v = camera.world3screen(world_v, player);
        vs.push(vector3.create2(v, world_v.z - camera.look_z));
      }
      if (this.is_circle) {
        vs[1] = vector3.sub(vs[1], vs[0]);
      }
      this.screen_vertices = vs;
    }
  }

  remove() {
    const index = Particle.particles.indexOf(this);
    if (index != undefined && index > -1) {
      Particle.particles.splice(index, 1);
    }
  }

};