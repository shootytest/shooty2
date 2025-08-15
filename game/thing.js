import { world } from "../index.js";
import { Bodies, Body, Composite, Vector } from "../matter.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { detector } from "./detector.js";
import { Health } from "./health.js";
import { make, make_shapes, override_object, make_shoot } from "./make.js";
import { Polygon, Shape } from "./shape.js";
import { Shoot } from "./shoot.js";
/**
 * the thing class... i probably have made like 5 of these already
 * this covers all things (which interact with each other)
 * maybe this is everything
 */
export class Thing {
    static time = 0;
    static things = [];
    static things_lookup = {};
    static cumulative_id = 0;
    static tick_things = () => {
        Thing.time++;
        for (const thing of Thing.things) {
            thing.tick();
        }
    };
    uid = ++Thing.cumulative_id;
    id = "generic thing #" + this.uid;
    body = undefined; // physics body
    options = {};
    object = {};
    shapes = [];
    shoots = [];
    health;
    ability;
    target = {
        position: vector3.create(),
        angle: 0,
        facing: vector.create(),
        velocity: vector.create(),
    };
    is_player = false;
    is_touching_player = false;
    is_bullet = false;
    constructor() {
        Thing.things.push(this);
        this.health = new Health(this);
        this.ability = new Health(this);
    }
    get position() {
        return (this.body) ? vector3.create2(vector.sub(this.body.position, this.body.offset ?? vector.create()), this.target.position.z) : vector3.clone(this.target.position);
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
    make_map(o) {
        if (o.computed == undefined) {
            throw "map shape not computed yet!";
        }
        this.options = {};
        const make_options = make[o.options.make_id ?? "default"] ?? make.default;
        if (o.options.make_id)
            override_object(this.options, make_options);
        override_object(this.options, o.options);
        const s = Shape.from_map(this, o);
        if (this.shapes.length <= 1)
            this.position = /*(o.vertices.length >= 3 && !o.options.open_loop) ? Vertices.centre(o.computed.vertices) :*/ vector3.mean(o.computed.vertices);
        this.create_id(o.id);
        if (!this.body && !this.options.decoration)
            this.create_body({
                isStatic: !this.options.movable,
                isSensor: Boolean(this.options.sensor),
            });
        if (this.body)
            this.body.label = o.id;
    }
    make(key, reset = false) {
        const o = make[key];
        if (reset) {
            this.options = {};
            for (const shoot of this.shoots)
                shoot.remove();
        }
        override_object(this.options, o);
        this.make_shape(key, reset);
        for (const shoot_key of o.shoots ?? []) {
            const S = make_shoot[shoot_key];
            if (S) {
                this.add_shoot(S);
            }
            else
                console.error(`[thing/make] thing id '${this.id}': make_shoot '${shoot_key}' doesn't exist!`);
        }
    }
    make_shape(key, reset = false) {
        if (reset)
            for (const shape of this.shapes)
                shape.remove();
        const shapes = make_shapes[key];
        for (const o of shapes ?? []) {
            Shape.from_make(this, o);
        }
    }
    create_id(id) {
        this.id = id;
        Thing.things_lookup[id] = this;
        return;
    }
    create_body(options = {}, shape_index = 0) {
        if (this.shapes.length <= shape_index) {
            throw "shape index " + shape_index + " >= length " + this.shapes.length;
        }
        const s = this.shapes[shape_index];
        let body;
        let add_body = true;
        if (s instanceof Polygon && s.sides === 0) {
            body = Bodies.circle(s.offset.x, s.offset.y, s.radius, options);
            Body.setPosition(body, this.target.position);
            Body.setAngle(body, this.target.angle);
        }
        else { // just use vertices
            if (s.closed_loop && s.vertices.length > 2) {
                body = Bodies.fromVertices(s.offset.x, s.offset.y, [s.vertices], options);
                // console.log(vector.adds(vector.adds(s.vertices, this.target.position), vector.create(-14.28, -8.66)), body.vertices);
                const offset_3_hour = vector.sub(vector.aabb2bounds(vector.make_aabb(s.vertices)).min, body.bounds.min);
                body.offset = offset_3_hour;
                Body.setPosition(body, vector.add(this.target.position, offset_3_hour));
                Body.setAngle(body, this.target.angle);
                if (body.parts.length >= 2)
                    for (const b of body.parts) {
                        b.thing = this;
                        b.label = this.id;
                    }
            }
            else {
                // console.log(s.vertices);
                // console.log(math.expand_lines(s.vertices, 1));
                // const composite = Composite.create();
                const sm = vector.mean(s.vertices);
                const b = Bodies.fromVertices(sm.x, sm.y, math.expand_lines(s.vertices, config.physics.wall_width), options);
                const walls = [];
                b.density = 0;
                b.collisionFilter = { category: 0 };
                // Composite.add(composite, b);
                // Composite.add(world, b);
                Body.setPosition(b, vector.add(this.target.position, sm));
                Body.setAngle(b, 0);
                let i = 0;
                b.label = this.id + "_" + i;
                i++;
                for (const vs of math.expand_lines(s.vertices, config.physics.wall_width)) {
                    const vm = vector.mean(vs);
                    const b_ = Bodies.fromVertices(s.offset.x + vm.x, s.offset.y + vm.y, [vs], options);
                    b_.label = this.id + "_" + i;
                    i++;
                    b_.thing = this;
                    // Composite.add(composite, b);
                    Composite.add(world, b_);
                    Body.setPosition(b_, vector.add(this.target.position, vm));
                    Body.setAngle(b_, 0);
                    walls.push(b_);
                }
                // Composite.add(world, composite);
                b.thing = this;
                b.walls = walls;
                body = b;
                add_body = false;
            }
        }
        this.body = body;
        this.body.thing = this;
        if ( /*s.z === 0 &&*/add_body)
            Composite.add(world, this.body); // todo handle other z?
        Body.setVelocity(body, this.target.velocity);
    }
    remove() {
        this.remove_list();
        this.remove_body();
        this.remove_children();
        this.remove_shapes();
        this.remove_shoots();
    }
    remove_list() {
        for (const array of [Thing.things, this.bullet_shoot?.bullets]) {
            // remove this from array
            const index = array?.indexOf(this);
            if (index != undefined && index > -1) {
                array?.splice(index, 1);
            }
        }
        delete Thing.things_lookup[this.id];
    }
    remove_body() {
        if (this.body != undefined) {
            // remove from world
            Composite.remove(world, this.body);
            this.body = undefined;
            return true;
        }
        else {
            return false;
        }
    }
    remove_children() {
        for (const shoot of this.shoots) {
            // if (this.keep_children) return;
            for (const c of shoot.bullets) {
                // if (c.keep_this) continue;
                c.remove();
            }
        }
    }
    remove_shapes() {
        for (const shape of this.shapes) {
            shape.remove();
        }
        this.shapes = [];
    }
    remove_shoots() {
        this.shoots = [];
    }
    tick() {
        detector.tick_fns[this.id]?.(this);
        if (this.is_touching_player && !this.is_player) {
            detector.collision_during_fns[this.id]?.(this);
        }
        for (const shoot of this.shoots) {
            shoot.tick();
        }
    }
    // useful
    lookup(id) {
        return Thing.things_lookup[id];
    }
    // physics body functions
    translate_wall(vector) {
        if (!this.body)
            return;
        const walls = this.body.walls ?? [];
        Body.setPosition(this.body, Vector.add(this.body.position, vector));
        if (walls)
            for (const wall of walls) {
                Body.setPosition(wall, Vector.add(wall.position, vector));
            }
    }
    push_to(target, amount) {
        const push = vector.createpolar(Vector.angle(this.position, target), amount);
        if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
            Body.applyForce(this.body, this.position, push);
        }
    }
    push_in_direction(angle, amount) {
        const push = vector.createpolar(angle, amount);
        if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
            Body.applyForce(this.body, this.position, push);
        }
    }
    push_by(amount) {
        if (this.body != undefined && this.position != undefined && amount.x != undefined && amount.y != undefined) {
            Body.applyForce(this.body, this.position, amount);
        }
    }
    add_shoot(stats, shape) {
        this.shoots.push(new Shoot(this, stats, shape));
    }
}
export class Bullet extends Thing {
    is_bullet = true;
    bullet_shoot;
    bullet_time = -1;
    tick() {
        super.tick();
        if (this.bullet_time >= 0 && this.bullet_time <= Thing.time) {
            this.remove();
        }
    }
}
