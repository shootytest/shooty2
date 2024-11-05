import { vector, vector3 } from "../util/vector.js";
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
        s.init_computed();
        return s;
    }
    static circle(radius, x_offset = 0, y_offset = 0) {
        return Polygon.make(radius, 0, 0, x_offset, y_offset);
    }
    static filter(aabb) {
        const result = [];
        for (const s of Shape.shapes) {
            if (s.computed == undefined)
                continue;
            const inside = vector3.aabb_intersect(s.computed.aabb3, aabb);
            if (inside) {
                result.push(s);
            }
        }
        return result;
    }
    id = ++Shape.cumulative_id;
    thing;
    z = 0;
    vertices = [];
    // computed
    computed;
    constructor(thing) {
        this.thing = thing;
        Shape.shapes.push(this);
    }
    get is_added() {
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
    add(thing) {
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
    static type = "polygon";
    static make(radius, sides, angle, x_offset, y_offset) {
        const s = new Polygon();
        s.radius = radius;
        s.sides = sides;
        s.angle = angle;
        s.x_offset = x_offset;
        s.y_offset = y_offset;
        return s;
    }
    radius = 0;
    sides = 3;
    angle = 0;
    x_offset = 0;
    y_offset = 0;
    calculate() {
        this.vertices = [];
        const sides = (this.sides === 0) ? 16 : this.sides;
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
    draw() {
    }
}
export class Line extends Shape {
    static type = "line";
}
