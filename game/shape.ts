import Matter from "../matter.js";
import { map_shape_compute_type, map_shape_type, shape_style } from "../util/map_type.js";
import { AABB, AABB3, vector, vector3 } from "../util/vector.js";
import { Thing } from "./thing.js";

/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {

  static shapes: Shape[] = [];

  static cumulative_id = 0;
  static type: string = "shape";

  static from_map(o: map_shape_type): Shape {
    const s = new Shape();
    
    s.vertices = vector3.create_many(o.vertices, o.z);
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

  static circle(radius: number, z: number = 0, x_offset: number = 0, y_offset: number = 0): Polygon {
    return Polygon.make(radius, 0, 0, z, x_offset, y_offset);
  }

  static filter(aabb: AABB3): Shape[] {
    const result: Shape[] = [];
    for (const s of Shape.shapes) {
      if (s.computed == undefined) continue;
      const inside = vector3.aabb_intersect(s.computed.aabb3, aabb);
      if (inside) {
        result.push(s);
      }
    }
    return result;
  }
  
  id: number = ++Shape.cumulative_id;
  thing?: Thing;
  z: number = 0;

  vertices: vector3[] = [];

  // computed
  computed?: map_shape_compute_type;

  style: shape_style = {};

  constructor(thing?: Thing) {
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
      centroid: vector3.mean(this.vertices),
      vertices: this.vertices
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

  }

}

export class Polygon extends Shape {
  static type: string = "polygon";

  static make(radius: number, sides: number, angle: number, z: number = 0, x_offset: number = 0, y_offset: number = 0): Polygon {
    const s = new Polygon();
    s.radius = radius;
    s.sides = sides;
    s.angle = angle;
    s.z = z;
    s.x_offset = x_offset;
    s.y_offset = y_offset;
    return s;
  }

  radius: number = 0;
  sides: number = 3;
  angle: number = 0;
  x_offset: number = 0;
  y_offset: number = 0;

  calculate() {
    this.vertices = [];
    const sides = (this.sides === 0) ? 16 : this.sides;
    const r = this.radius;
    const x = this.x_offset;
    const y = this.y_offset;
    let a = this.angle;
    // this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), this.z));
    for (let i = 0; i < sides; ++i) {
      a += Math.PI * 2 / sides;
      this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), this.z));
    }
  }

  draw() {

  }

}

export class Line extends Shape {
  static type: string = "line";

}