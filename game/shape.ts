import { Vertices } from "../matter.js";
import { camera } from "../util/camera.js";
import { ctx } from "../util/canvas.js";
import { config } from "../util/config.js";
import { map_shape_compute_type, map_shape_type, style_type, STYLES } from "../util/map_type.js";
import { AABB3, vector, vector3 } from "../util/vector.js";
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
    s.closed_loop = !(o.options.open_loop);
    s.seethrough = Boolean(o.options.seethrough);

    // handle vertices
    s.vertices = vector3.create_many(o.vertices, o.z);
    if (o.computed == undefined) throw "map shape not computed yet!";
    const dv = (thing.shapes.length >= 1) ? thing.position : o.computed.mean;
    for (const v of s.vertices) {
      v.x -= dv.x;
      v.y -= dv.y;
    }

    s.style = STYLES[o.options.style ?? "test"] ?? STYLES.error;
    s.init_computed();

    if (thing.shapes.length >= 1) { // runs for merged shapes
      s.offset.x = thing.position.x - o.computed.mean.x;
      s.offset.y = thing.position.y - o.computed.mean.y;
    }

    return s;
  };

  static circle(thing: Thing, radius: number, z: number = 0, x_offset: number = 0, y_offset: number = 0): Polygon {
    return Polygon.make(thing, radius, 0, 0, z, x_offset, y_offset);
  };

  static filter(aabb: AABB3): Shape[] {
    const result: Shape[] = [];
    for (const s of Shape.shapes) {
      if (s.computed == undefined || s.thing == undefined || s.thing.options.invisible) continue;
      s.computed_aabb = vector3.aabb_add(s.computed.aabb3, s.thing.position);
      const inside = vector3.aabb_intersect(s.computed_aabb, aabb);
      if (inside) {
        result.push(s);
      }
    }
    return result;
  };

  static compute() {
    const cam = vector3.create2(camera.location, camera.z);
    const screen_topleft = camera.screen2world({ x: 0, y: 0 });
    const screen_bottomright = camera.screen2world({ x: ctx.canvas.width, y: ctx.canvas.height });
    const screen_aabb: AABB3 = {
      min_x: screen_topleft.x, min_y: screen_topleft.y, max_x: screen_bottomright.x, max_y: screen_bottomright.y, min_z: -Infinity, max_z: Infinity,
    };
    Shape.draw_shapes = Shape.filter(screen_aabb);
    Shape.draw_zs = [0];
    for (const s of Shape.draw_shapes) {
      if (s.z !== 0 && !Shape.draw_zs.includes(s.z)) Shape.draw_zs.push(s.z);
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
        s.computed.distance2 = vector.length2(vector.sub(s.computed.mean, cam));
        // compute location on screen using camera transformation
        s.compute_screen();
      }
    }
    Shape.draw_zs.sort();
  };

  static draw(z?: number) {
    // hope this doesn't take too long per tick...
    for (const s of Shape.draw_shapes) {
      if (z != undefined && s.z !== z) continue;
      s.draw();
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
  
  id: number = ++Shape.cumulative_id;
  public thing: Thing;
  z: number = 0;

  vertices: vector3[] = [];
  offset: vector3 = vector3.create();
  closed_loop = true;
  seethrough = false;

  // computed
  computed?: map_shape_compute_type;
  computed_aabb?: AABB3; // for use in Shape.filter()

  // map_shape_type_object?: map_shape_type;
  style: style_type = {};

  constructor(thing: Thing) {
    this.thing = thing;
    Shape.shapes.push(this);
  }

  get is_added(): boolean {
    return this.thing != undefined;
  }

  init_computed() {
    this.computed = {
      aabb: vector.make_aabb(this.vertices),
      aabb3: vector3.make_aabb(this.vertices),
      mean: this.closed_loop ? vector3.create2(Vertices.centre(this.vertices), this.z) : vector3.mean(this.vertices), // don't use mean...
      vertices: vector3.clone_list(this.vertices),
    };
  }

  add(thing: Thing) {
    thing.shapes.push(this);
    this.thing = thing;
  }

  calculate() {
    // ok there's nothing to do here because the vertices _are_ the data
    return;
  }

  draw() {
    if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0) return;
    const style = this.style;
    // ctx.save("draw_shape");
    // if (this.thing) ctx.rotate(this.thing?.angle);
    ctx.begin();
    this.draw_path();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = style.opacity ?? 1;
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.globalAlpha = style.stroke_opacity ?? 1;
      ctx.lineWidth = (style.width ?? 1) * camera.sqrtscale * config.graphics.linewidth_mult;
      ctx.stroke();
    }
    if (style.fill && this.closed_loop) {
      ctx.fillStyle = style.fill;
      ctx.globalAlpha = style.fill_opacity ?? 1;
      ctx.fill();
    }
    // ctx.restore("draw_shape");
  }

  draw_path() {
    if (this.computed?.screen_vertices == undefined || this.computed.screen_vertices.length <= 0) return;
    ctx.lines_v(this.computed.screen_vertices, this.closed_loop);
  }

  compute_screen() {
    if (this.computed?.vertices == undefined) return;
    const vs: vector3[] = [];
    for (const world_v of this.computed.vertices) {
      const v = camera.world3screen(world_v, player);
      vs.push(vector3.create2(v, world_v.z - camera.look_z));
    }
    this.computed.screen_vertices = vs;
  }

}

export class Polygon extends Shape {
  static type: string = "polygon";

  static make(thing: Thing, radius: number, sides: number, angle: number, z: number = 0, x_offset: number = 0, y_offset: number = 0): Polygon {
    const s = new Polygon(thing);
    s.radius = radius;
    s.sides = sides;
    s.angle = angle;
    s.z = z;
    s.offset.x = x_offset;
    s.offset.y = y_offset;
    s.calculate();
    s.init_computed();
    return s;
  }

  radius: number = 0;
  sides: number = 3;
  angle: number = 0;

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
      let c = this.computed.mean;
      if (this.thing) c = vector3.add(c, vector3.flatten(this.thing.position));
      let r = vector3.create(this.radius, 0, this.z);
      r = vector3.add(r, vector3.create2(camera.position));
      const vs: vector3[] = [];
      for (const world_v of [c, r]) {
        const v = camera.world3screen(world_v, player);
        vs.push(vector3.create2(v, world_v.z - camera.look_z));
      }
      this.computed.screen_vertices = vs;
    } else {
      super.compute_screen();
    }
  }

}

export class Line extends Shape {
  static type: string = "line";

}