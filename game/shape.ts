import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { color, STYLES } from "../util/color.js";
import { config } from "../util/config.js";
import { map_shape_compute_type, map_shape_type, style_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { AABB3, vector, vector3 } from "../util/vector.js";
import { clone_object, make_shoot, maketype_shape, multiply_and_override_object, override_object } from "./make.js";
import { Particle } from "./particle.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";

/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {

  static shapes: Shape[] = [];
  static draw_shapes: Shape[] = [];
  static draw_zs: number[] = [];

  static cumulative_id = 0;
  static type: string = "shape";

  static from_map(thing: Thing, o: map_shape_type): Shape {
    const s = new Shape(thing);
    
    // s.map_shape_type_object = o;
    s.z = o.z;

    // booleans
    s.closed_loop = !(thing.options.open_loop);
    s.seethrough = Boolean(thing.options.seethrough);

    // handle vertices
    s.vertices = vector3.create_many(o.vertices, o.z);
    if (o.computed == undefined) throw "map shape not computed yet!";
    const dv = (thing.shapes.length >= 2) ? thing.position : o.computed.mean;
    for (const v of s.vertices) {
      v.x -= dv.x;
      v.y -= dv.y;
    }

    s.style = clone_object(STYLES[thing.options.style ?? "error"] ?? STYLES.error);
    if (thing.options.style_ != undefined) override_object(s.style, thing.options.style_);
    s.init_computed();

    if (thing.shapes.length >= 2) { // runs for merged shapes
      s.offset.x = thing.position.x - o.computed.mean.x;
      s.offset.y = thing.position.y - o.computed.mean.y;
    }

    return s;
  };

  static from_make(thing: Thing, o: maketype_shape): Shape {
    let s: Shape;
    if (o.type === "polygon") {
      s = Shape.polygon(thing, o.radius ?? 0, o.sides ?? 0, o.angle ?? 0, o.z, o.offset);
    } else if (o.type === "circle") {
      s = Shape.circle(thing, o.radius ?? 0, o.z, o.offset);
    } else if (o.type === "line") {
      s = Shape.line(thing, o.v1 ?? vector.create(), o.v2 ?? vector.create(), o.z);
    } else {
      console.error(`[shape/from_make] shape type '${o.type}' doesn't exist!`);
      s = new Shape(thing);
    }
    s.blinking = Boolean(o.blinking);
    s.glowing = o.glowing ?? 0;
    s.seethrough = Boolean(thing.options.seethrough);
    s.style = clone_object(STYLES[o.style ?? thing.options.style ?? "error"] ?? STYLES.error);
    if (thing.options.style_ != undefined) override_object(s.style, thing.options.style_);
    if (o.style_ != undefined) override_object(s.style, o.style_);
    if (o.shoot) {
      let S = make_shoot[o.shoot];
      if (o.shoot_ != undefined) {
        S = clone_object(S);
        override_object(S, o.shoot_);
      }
      if (S) {
        thing.add_shoot(S, s);
      } else console.error(`[shape/from_make] make_shoot '${o.shoot}' doesn't exist!`);
    }
    return s;
  }

  static polygon(thing: Thing, radius: number, sides: number, angle: number = 0, z: number = 0, offset?: vector): Polygon {
    return Polygon.make(thing, radius, sides, angle, z, offset);
  };

  static circle(thing: Thing, radius: number, z: number = 0, offset?: vector): Polygon {
    return Polygon.make(thing, radius, 0, 0, z, offset);
  };

  static line(thing: Thing, v1: vector, v2: vector = vector.create(), z: number = 0): Shape {
    const s = new Shape(thing);
    s.closed_loop = false;
    s.vertices = vector3.create_many([v1, v2], z);
    s.z = z;
    s.calculate();
    s.init_computed();
    return s;
  };

  static filter(screen_aabb: AABB3): Shape[] {
    const result: Shape[] = [];
    const memo_aabb3: { [key: string]: AABB3 } = {};
    for (const s of Shape.shapes) {
      if (s.computed == undefined || s.thing == undefined || s.thing.options.invisible) continue;
      s.computed_aabb = vector3.aabb_add(s.computed.aabb3, s.thing.position);
      if (memo_aabb3[s.z] == undefined) {
        const z_scale = camera.zscale_inverse(s.z ?? 0);
        memo_aabb3[s.z] = vector3.aabb_scale(screen_aabb, vector3.create(z_scale, z_scale, 1));
      }
      const inside = vector3.aabb_intersect(s.computed_aabb, memo_aabb3[s.z]);
      s.computed.on_screen = inside;
      if (inside) {
        result.push(s);
      }
    }
    return result;
  };

  static compute() {
    const screen_topleft = camera.screen2world({ x: 0, y: 0 });
    const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
    const screen_aabb: AABB3 = {
      min_x: screen_topleft.x - config.graphics.shape_cull_padding, min_y: screen_topleft.y - config.graphics.shape_cull_padding, max_x: screen_bottomright.x + config.graphics.shape_cull_padding, max_y: screen_bottomright.y + config.graphics.shape_cull_padding, min_z: -Number.MAX_SAFE_INTEGER, max_z: Number.MAX_SAFE_INTEGER,
    };
    Shape.draw_shapes = Shape.filter(screen_aabb);
    Shape.draw_zs = [0];
    for (const s of Shape.draw_shapes) {
      if (s.z !== 0 && !Shape.draw_zs.includes(s.z)) Shape.draw_zs.push(s.z);
      if (s.computed == undefined) {
        s.init_computed();
      }
      if (s.computed != undefined) { // always true at this point
        // compute location on screen using camera transformation
        s.compute_screen();
      }
    }
    Shape.draw_zs.sort();
  };

  static draw(z?: number) {
    // hope this doesn't take too long per tick...
    Shape.draw_shapes.sort((s1, s2) => {
      if (s1.thing.options.decoration && !s2.thing.options.decoration) return -1;
      if (s2.thing.options.decoration && !s1.thing.options.decoration) return 1;
      return s1.z - s2.z;
    });
    for (const s of Shape.draw_shapes) {
      if (z != undefined && s.z !== z) continue;
      s.draw();
      s.draw_glow();
      s.draw_blink();
      s.draw_health();
    }
    ctx.globalAlpha = 1;
  };

  // gets screen vertices for everything on screen
  // for visibility purposes
  static get_vertices() {
    const result: vector3[][] = [];
    for (const s of Shape.draw_shapes) {
      const vs = s.computed?.vertices;
      if (!vs) continue;
      if (s.seethrough) continue;
      if (s.thing.is_player) continue;
      if (s.z !== player.z) {
        // todo when the time comes...
        //continue;
      }
      if (s.closed_loop) vs.push(vs[0]);
      result.push(vs);
    }
    return result;
  };

  static get_other_vertices() {
    const result: { [ key: string ]: vector3[][] } = {};
    for (const s of Shape.draw_shapes) {
      const vs = s.computed?.vertices;
      if (!vs) continue;
      if (s.translucent <= 0 || !s.seethrough) continue;
      if (s.closed_loop) vs.push(vs[0]);
      const translucent = math.round_to(s.translucent, 0.0001).toFixed(4);
      if (!result[translucent]) result[translucent] = [];
      result[translucent]?.push(vs);
    }
    return result;
  };
  
  id: number = ++Shape.cumulative_id;
  public thing: Thing;
  index = -1;
  z: number = 0;

  vertices: vector3[] = [];
  offset: vector = vector.create();
  scale: vector = vector.create(1, 1);
  opacity: number = 1;
  activate_scale = false;
  closed_loop = true;
  translucent = 0;
  blinking = false;
  glowing = 0;

  get seethrough(): boolean {
    return !(this.translucent >= 1 - math.epsilon);
  }

  set seethrough(see: boolean) {
    if (see) this.translucent = 0;
    else this.translucent = 1;
  }

  // computed
  computed?: map_shape_compute_type;
  computed_aabb?: AABB3; // for use in Shape.filter()

  // map_shape_type_object?: map_shape_type;
  style: style_type = {};

  constructor(thing: Thing) {
    this.thing = thing;
    this.add(thing);
  }

  get is_added(): boolean {
    return this.thing != undefined;
  }

  get is_circle() {
    return this.computed?.screen_vertices?.[2]?.x === -123 && this.computed?.screen_vertices?.[2]?.y === -123 && this.computed?.screen_vertices?.[2]?.z === -123;
  }

  init_computed() {
    const calc_vertices = vector3.add_list(this.vertices, this.offset),
      vertices = vector3.clone_list(this.vertices);
    if (this.activate_scale) vector3.scale_to_list(calc_vertices, this.scale);
    const aabb = vector.make_aabb(calc_vertices),
      aabb3 = vector3.make_aabb(calc_vertices),
      mean = this.closed_loop ? vector3.create2(Vertices.centre(calc_vertices), this.z) : vector3.mean(calc_vertices); // don't use mean...
    if (this.computed == undefined) {
      this.computed = { aabb, aabb3, mean, vertices };
    } else {
      this.computed.aabb = aabb;
      this.computed.aabb3 = aabb3;
      this.computed.mean = mean;
      this.computed.vertices = vertices;
    }
  }

  add(thing: Thing) {
    this.thing = thing;
    this.thing.shapes.push(this);
    this.index = this.thing.shapes.length - 1;
    Shape.shapes.push(this);
  }

  calculate() {
    // ok there's nothing to do here because the vertices _are_ the data
    return;
  }

  draw(style_mult?: style_type) {
    if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0) return;
    let style = this.style;
    if (style_mult) {
      style = clone_object(this.style);
      multiply_and_override_object(style, style_mult);
    }
    ctx.beginPath();
    this.draw_path();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.globalAlpha = (style.opacity ?? 1) * (style.stroke_opacity ?? 1);
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * config.graphics.linewidth_mult * (this.translucent <= math.epsilon ? 1 : 1.8);
      ctx.stroke();
    }
    if (style.fill && this.closed_loop) {
      ctx.fillStyle = style.fill;
      ctx.globalAlpha = (style.opacity ?? 1) * (style.fill_opacity ?? 1);
      ctx.fill();
    }
  }

  draw_path() {
    if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0) return;
    ctx.lines_v(this.computed.screen_vertices, this.closed_loop);
  }

  draw_health() {
    if (this.computed?.screen_vertices == undefined || !this.computed.on_screen || this.thing.health == undefined || this.index >= 1) return;
    if (this.thing.options.hide_health) {
      if (this.thing.options.wall_filter) {
        const ratio = math.bound((this.thing.health?.ratio ?? 0), 0, 1);
        this.translucent = ratio;
        this.style.stroke_opacity = ratio;
      }
      return;
    }
    const ratio = this.thing.health.display_ratio;
    if (Math.abs(ratio - 1) < math.epsilon) return;
    ctx.ctx.save();
    const c = this.is_circle ? this.computed.screen_vertices[0] : vector.aabb_centre(vector.make_aabb(this.computed.screen_vertices));
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    const angle = -Thing.time / 10 * config.graphics.health_rotate_speed;
    ctx.arc_v(c, 123456, angle % (Math.PI * 2), (angle + Math.PI * 2 * ratio) % (Math.PI * 2));
    ctx.lineTo(c.x, c.y);
    ctx.clip();
    const health_color = this.style.health ?? color.red;
    const health_opacity = this.style.health_opacity ?? 0.3;
    const style_mult: style_type = {
      stroke_opacity: health_opacity,
      fill_opacity: health_opacity,
    };
    if (this.style.stroke) {
      style_mult.stroke = health_color;
      style_mult.fill_opacity = 0;
    } else if (this.style.fill) style_mult.fill = health_color;
    // else console.error(`[shape/draw_health] no fill or stroke in ${this.thing.id}`);
    this.draw(style_mult);
    ctx.ctx.restore();
  }

  draw_blink() {
    if (!this.blinking && (!this.thing.health?.invincible)) return;
    const style_mult: style_type = {
      stroke_opacity: math.bounce(Thing.time, 10) * 0.5,
      fill_opacity: math.bounce(Thing.time, 10) * 0.5,
    };
    if (this.style.fill) style_mult.fill = color.blackground;
    if (this.style.stroke) style_mult.stroke = color.blackground;
    this.draw(style_mult);
  }

  draw_glow() {
    if (this.glowing === 0) return;
    const frac = this.glowing - Math.floor(this.glowing);
    const style_mult: style_type = {
      fill: this.style.stroke,
      fill_opacity: ((this.style.stroke_opacity ?? 1) / (this.style.fill_opacity || 1)) * (frac === 0 ? 0.8 : frac),
    };
    ctx.ctx.shadowBlur = config.graphics.shadowblur;
    ctx.ctx.shadowColor = this.style.stroke ?? color.white;
    for (let i = 0; i < this.glowing; i++) this.draw(style_mult);
    ctx.ctx.shadowBlur = 0;
  }

  compute_screen() {
    if (this.computed?.vertices == undefined) return;
    // compute vertices and offset by shape offset
    this.computed.vertices = vector3.add_list(this.vertices, this.offset);
    if (this.activate_scale) vector3.scale_to_list(this.computed.vertices, this.scale);
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
    const vs: vector3[] = [];
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

  break(o: {
    type?: "fade" | "triangulate",
    speed?: number,
    velocity?: vector,
    time?: number,
    opacity_mult?: number,
  } = {}) {
    if (this.computed?.vertices == undefined || !this.computed.on_screen) return;
    const style: style_type = clone_object(this.style);
    style.opacity = (style.opacity ?? 1) * (o.opacity_mult ?? 0.4);
    const time = (o.time ?? 20);
    const p = new Particle();
    p.style = style;
    p.time = Thing.time + time;
    if (o.type === "triangulate" && this.computed.vertices.length <= 2) {
      console.error(`[shape/break] can't triangulate less than 2 vertices!`);
      o.type = "fade";
    }
    if (o.type === "triangulate") {
      const mean = vector.mean(this.computed.vertices);
      for (const triangle of math.triangulate_polygon(this.computed.vertices)) {
        const c = vector.sub(vector.mean(triangle), mean);
        p.vertices = triangle;
        p.velocity = vector.mult(c, o.speed ?? 0.1);
      }
    } else if (o.type === "fade") {
      p.vertices = this.computed.vertices;
      p.fade = time;
    }
    if (o.velocity) p.velocity = o.velocity;
    return p;
  }

}

export class Polygon extends Shape {
  static type: string = "polygon";

  static make(thing: Thing, radius: number, sides: number, angle: number, z: number = 0, offset: vector = vector.create()): Polygon {
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

  radius: number = 0;
  sides: number = 0;
  angle: number = 0;

  constructor(thing: Thing) {
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
      if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0) return;
      const [c, r] = this.computed.screen_vertices;
      ctx.circle(c.x, c.y, r.x);
    } else {
      super.draw_path();
    }
  }

  compute_screen() {
    if (this.sides === 0) {
      if (this.computed?.mean == undefined) return;
      let c = vector3.add(this.computed.mean, vector3.create2(this.offset));
      const rotated = vector.rotate(vector.create(), c, this.thing.angle);
      c.x = rotated.x;
      c.y = rotated.y;
      if (this.thing) c = vector3.add(c, vector3.clone(this.thing.position));
      let r = vector3.create(this.radius, 0, this.z);
      r = vector3.add(r, vector3.create2(this.thing.position));
      const vs: vector3[] = [];
      for (const world_v of [c, r]) {
        const v = camera.world3screen(world_v, player);
        vs.push(vector3.create2(v, world_v.z - camera.look_z));
      }
      vs[1] = vector3.sub(vs[1], vs[0]);
      const shhh = vector3.create(-123, -123, -123);
      vs.push(shhh);
      this.computed.screen_vertices = vs;
      this.computed.vertices = [c, r, shhh];
    } else {
      super.compute_screen();
    }
  }

}