import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { canvas, ctx } from "../util/canvas.js";
import { color, color2hex } from "../util/color.js";
import { config } from "../util/config.js";
import { style_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { SVG } from "../util/svg.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { player } from "./player.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";
import { ui } from "./ui.js";


export class Particle {

  static particles: Particle[] = [];

  static tick_particles(dt: number) {
    for (const particle of Particle.particles) {
      particle.tick(dt);
    }
  }

  static draw_particles(z?: number) {
    if (player.map_mode) return;
    if (z) z = math.round_to(z, 0.001);
    for (const particle of Particle.particles) {
      if (z != undefined && !math.equal(math.round_to(particle.z, 0.001), z)) continue;
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

  static make(vertices: vector3_[], velocity?: vector, acceleration?: vector, jerk?: vector): Particle {
    const p = new Particle();
    p.vertices = vertices;
    if (velocity) p.velocity = velocity;
    if (acceleration) p.acceleration = acceleration;
    if (jerk) p.jerk = jerk;
    return p;
  }

  static make_circle(radius: number, offset: vector3 = vector3.create()): Particle {
    const p = new Particle();
    p.vertices = [offset, vector3.create(radius, 0, 0), vector3.create(-123, -123, -123)];
    return p;
  }

  static make_icon(icon: string, radius: number, position: vector, velocity?: vector, acceleration?: vector, jerk?: vector): Particle {
    const p = new Particle();
    p.vertices = [position, vector.add(position, vector.create(radius))];
    p.icon = icon;
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
  screen_vertices: vector[] = [];
  is_screen: boolean = false; // indicates if the particle's vertices are in screen coordinates
  wraparound: boolean = false;

  icon: string = "";

  z: number = 0;
  z_velocity: number = 0;
  z_acceleration: number = 0;
  z_bounds: [number, number] = [0, 1];
  angle: number = 0;
  angular_velocity: number = 0;
  angular_acceleration: number = 0;
  offset: vector3_ = vector.create();
  velocity: vector3_ = vector.create();
  acceleration: vector3_ = vector.create();
  jerk: vector3_ = vector.create();

  target?: vector3_;
  smoothness?: number;

  opacity: number = 1;
  style: style_type = {};

  time: number = -1;
  fade_time: number = -1;
  max_offset_length?: number;

  object: { [key: string]: any } = {};

  remove_fn?: () => void;

  constructor() {
    Particle.particles.push(this);
  }

  get total_z(): number {
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

  tick(dt: number) {
    if (this.target != undefined) {
      const offset = vector.lerp(this.offset, this.target, this.smoothness ?? 0.1);
      this.offset.x = offset.x;
      this.offset.y = offset.y;
    } else {
      const mult = dt / config.seconds;
      this.offset = vector3.add_(this.offset, vector3.mult_(this.velocity, mult));
      this.velocity = vector3.add_(this.velocity, vector3.mult_(this.acceleration, mult));
      this.acceleration = vector3.add_(this.acceleration, vector3.mult_(this.jerk, mult));

      this.angle += this.angular_velocity * mult;
      if (this.angular_velocity) this.angle %= Math.PI * 2;
      this.angular_velocity += this.angular_acceleration * mult;
      if (this.angular_acceleration) this.angular_velocity %= Math.PI * 2;

      this.z += this.z_velocity;
      this.z_velocity += this.z_acceleration;
      if (this.z < this.z_bounds[0] || this.z > this.z_bounds[1]) {
        this.remove();
        return;
      }

      if (this.max_offset_length != undefined && vector.length2(this.offset) > this.max_offset_length ** 2) this.remove();
      if (this.wraparound) {
        if (this.is_screen) {
          this.offset.x += canvas.width;
          this.offset.y += canvas.height;
          this.offset.x %= canvas.width;
          this.offset.y %= canvas.height;
        } else if (!player.paused && (ui.time - ui.pause.end_time) > 0.1 * config.seconds) {
          vector.aabb_wraparound(Shape.memo_aabb3[(math.floor(this.z_bounds[0] * 10) / 10).toFixed(1)], this.offset);
        }
      }
    }
    if (Thing.time > this.time) {
      this.remove();
      return;
    } else if (this.fade_time > 0) {
      this.opacity = (this.time - Thing.time) / this.fade_time;
    }
    if (this.object.theme && ui.particles.theme !== this.object.theme) this.remove();
  }

  draw() {
    const style = this.style;
    if (this.icon) {
      this.compute_screen();
      const [c, r] = this.screen_vertices;
      ctx.fillStyle = color2hex(style.fill ?? color.error);
      ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1) * this.opacity;
      ctx.svg(this.icon as keyof typeof SVG, Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
    } else {
      ctx.beginPath();
      this.draw_path();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const opacity_mult = (style.opacity ?? 1) * this.opacity;
      if (style.fill) {
        ctx.fillStyle = color2hex(style.fill ?? color.error);
        ctx.globalAlpha = opacity_mult * (style.fill_opacity ?? 1);
        ctx.fill();
      }
      if (style.stroke) {
        ctx.strokeStyle = color2hex(style.stroke ?? color.error);
        ctx.globalAlpha = opacity_mult * (style.stroke_opacity ?? 1);
        ctx.lineWidth = (style.width ?? 1) * camera.scale * camera.zscale(this.total_z, true) * config.graphics.linewidth_mult;
        ctx.stroke();
      }
    }
  }

  draw_path() {
    this.compute_screen();
    if (this.is_circle) {
      const [c, r] = this.screen_vertices;
      ctx.circle(Math.round(c.x + this.offset.x), Math.round(c.y + this.offset.y), r.x);
    } else if (this.icon) {
      console.error("[particle/draw_path] icons don't have paths to draw");
    } else {
      ctx.lines_v(this.screen_vertices, true);
    }
  }

  compute_screen() {
    if (this.is_screen) {
      this.screen_vertices = [];
      for (const vertex of this.vertices) {
        this.screen_vertices.push(vector.add(vector.rotate(vector.create(), vertex, this.angle), this.offset));
      }
    } else {
      const vs: vector3[] = [];
      for (const vertex of this.is_circle ? this.vertices : vector.rotate_list(this.vertices, this.angle)) {
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
    this.remove_fn?.();
    Particle.particles.remove(this);
  }

};