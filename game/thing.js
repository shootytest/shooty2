import { world } from "../index.js";
import { Bodies, Composite } from "../matter.js";
import { vector, vector3 } from "../util/vector.js";
import { Polygon } from "./shape.js";
/**
 * the thing class... i don't know anymore i have made like 5 of these already... maybe more
 * this covers all things (which interact with each other)
 * maybe this is everything
 */
export class Thing {
    static things = [];
    static cumulative_id = 0;
    static tick_things = () => {
        for (const thing of Thing.things) {
            // thing.tick();
        }
    };
    id = ++Thing.cumulative_id;
    body = undefined; // physics body
    shapes = [];
    target = {
        position: vector3.create(),
        angle: 0,
        velocity: vector.create(),
    };
    constructor() {
        Thing.things.push(this);
    }
    create_body(shape_index = 0) {
        if (this.shapes.length <= shape_index) {
            throw "shape index " + shape_index + " >= length " + this.shapes.length;
        }
        const s = this.shapes[shape_index];
        const options = {};
        let body;
        if (s instanceof Polygon && s.sides === 0) {
            body = Bodies.circle(s.x_offset, s.y_offset, s.radius, options);
        }
        else { // just use vertices
            body = Bodies.fromVertices(0, 0, [s.vertices], options);
        }
        this.body = body;
        Composite.add(world, this.body);
    }
    get position() {
        return (this.body) ? vector3.create2(this.body.position, this.target.position.z) : vector3.clone(this.target.position);
    }
    set position(position) {
        this.target.position.x = position.x;
        this.target.position.y = position.y;
        if (position.z != undefined)
            this.target.position.z = position.z;
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
    get velocity() {
        return (this.body) ? vector.clone(this.body.velocity) : vector.create();
    }
    set velocity(velocity) {
        this.target.velocity.x = velocity.x;
        this.target.velocity.y = velocity.y;
    }
}
