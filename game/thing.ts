import { world } from "../index.js";
import { Bodies, Body, Composite, IBodyDefinition } from "../matter.js";
import { map_shape_type } from "../util/map_type.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { Polygon, Shape } from "./shape.js";

/**
 * the thing class... i don't know anymore i have made like 5 of these already... maybe more
 * this covers all things (which interact with each other)
 * maybe this is everything
 */
export class Thing {

  static things: Thing[] = [];
  static things_lookup: { [key: string]: Thing } = {};
  
  static cumulative_id = 0;

  static tick_things = () => {
    for (const thing of Thing.things) {
      thing.tick();
    }
  }
  
  uid: number = ++Thing.cumulative_id;
  id: string = "generic thing #" + this.uid;

  body?: Body = undefined; // physics body
  shapes: Shape[] = [];
  
  target: {
    position: vector3,
    angle: number,
    facing: vector,
    velocity: vector,
  } = {
    position: vector3.create(),
    angle: 0,
    facing: vector.create(),
    velocity: vector.create(),
  }

  is_player: boolean = false;

  constructor() {
    Thing.things.push(this);
  }
  
  get position(): vector3 {
    return (this.body) ? vector3.create2(this.body.position, this.target.position.z) : vector3.clone(this.target.position);
  }
  set position(position: vector3_) {
    this.target.position.x = position.x;
    this.target.position.y = position.y;
    if (position.z != undefined) this.target.position.z = position.z;
  }

  get x() {
    return this.position.x;
  }
  get y() {
    return this.position.y;
  }
  get z() {
    return this.position.z;
  }
  
  get angle() {
    return (this.body) ? this.body.angle : this.target.angle;
  }
  set angle(angle) {
    this.target.angle = angle;
  }

  get velocity(): vector {
    return (this.body) ? vector.clone(this.body.velocity) : vector.create();
  }
  set velocity(velocity: vector) {
    this.target.velocity.x = velocity.x;
    this.target.velocity.y = velocity.y;
  }

  make_map(o: map_shape_type) {
    if (o.computed == undefined) {
      throw "map shape not computed yet!";
    }
    const s = Shape.from_map(this, o);
    s.thing = this;
    this.shapes.push(s);
    this.position = o.computed.centroid;
    if (this.id.startsWith("generic thing #")) this.create_id(o.id);
    if (!this.body) this.create_body({
      isStatic: !o.options?.movable,
    });
  }

  create_id(id: string) {
    this.id = id;
    Thing.things_lookup[id] = this;
    return;
  }

  create_body(options: IBodyDefinition = {}, shape_index: number = 0) {
    if (this.shapes.length <= shape_index) {
      throw "shape index " + shape_index + " >= length " + this.shapes.length;
    }
    const s = this.shapes[shape_index];
    let body: Body;
    if (s instanceof Polygon && s.sides === 0) {
      body = Bodies.circle(s.x_offset, s.y_offset, s.radius, options);
    }
    else { // just use vertices
      body = Bodies.fromVertices(0, 0, [s.vertices], options);
    }
    Body.setPosition(body, this.target.position);
    Body.setAngle(body, this.target.angle);
    this.body = body;
    if (s.z === 0) Composite.add(world, this.body);
    Body.setVelocity(body, this.target.velocity);
  }

  tick() {

  }

}