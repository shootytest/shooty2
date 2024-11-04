import Matter from "../matter.js";
import { map_shape_type } from "../util/map_type.js";
import { vector, vector3 } from "../util/vector.js";
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
    return s;
  }
  
  id: number = ++Shape.cumulative_id;
  thing?: Thing = undefined;
  z: number = 0;

  vertices: vector3[] = [];

  constructor(thing?: Thing) {
    this.thing = thing;
    Shape.shapes.push(this);
  }

  get is_added(): boolean {
    return this.thing != undefined;
  }

  add(thing: Thing) {
    thing.shapes.push(this);
    this.thing = thing;
  }

  calculate() {
    // ok there's nothing to do here because the vertices _are_ the data
    return;
  }

}

export class Polygon extends Shape {
  static type: string = "polygon";

  radius: number = 0;
  sides: number = 3;
  angle: number = 0;
  x_offset: number = 0;
  y_offset: number = 0;

  calculate() {
    this.vertices = [];
    const sides = this.sides;
    const r = this.radius;
    const x = this.x_offset;
    const y = this.y_offset;
    let a = this.angle;
    this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), this.z));
    // draw one more side because lineCap is weird if it is square 
    for (let i = 0; i < sides + 1; ++i) {
      a += Math.PI * 2 / sides;
      this.vertices.push(vector3.create(x + r * Math.cos(a), y + r * Math.sin(a), this.z));
    }
  }

}

export class Line extends Shape {
  static type: string = "line";

}