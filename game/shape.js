import { vector3 } from "../util/vector.js";
/**
 * the Shape class holds shape data only
 * this class covers all shape types (e.g. part of a thing's body, decoration to be drawn on screen, icon)
 */
export class Shape {
    static shapes = [];
    static cumulative_id = 0;
    static type = "shape";
    static from_map(o) {
        const s = new Shape();
        s.vertices = vector3.create_many(o.vertices, o.z);
        return s;
    }
    id = ++Shape.cumulative_id;
    thing = undefined;
    z = 0;
    vertices = [];
    constructor(thing) {
        this.thing = thing;
        Shape.shapes.push(this);
    }
    get is_added() {
        return this.thing != undefined;
    }
    add(thing) {
        thing.shapes.push(this);
        this.thing = thing;
    }
    calculate() {
        // ok there's nothing to do here because the vertices _are_ the data
        return;
    }
}
export class Polygon extends Shape {
    static type = "polygon";
    radius = 0;
    sides = 3;
    angle = 0;
    x_offset = 0;
    y_offset = 0;
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
    static type = "line";
}
