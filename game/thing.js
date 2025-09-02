// import spam
import { world } from "../index.js";
import { Bodies, Body, Composite, Query, Vector } from "../matter.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { Health } from "./health.js";
import { make, make_shapes, override_object, make_shoot, shallow_clone_array, clone_object, multiply_object } from "./make.js";
import { save } from "./save.js";
import { Polygon, Shape } from "./shape.js";
import { Shoot } from "./shoot.js";
/**
 * the thing class... i probably have made like 5 of these (in other projects :)
 * this should cover all "things"
 * maybe this is everything (update: i made a spawner class that isn't a thing :O)
 */
export class Thing {
    static time = 0;
    static things = [];
    static things_lookup = {};
    static things_rooms = {};
    static cumulative_id = 0;
    static tick_things = () => {
        this.update_body_list();
        Thing.time++;
        for (const thing of Thing.things) {
            thing.tick();
        }
    };
    static body_list = [];
    static update_body_list() {
        const result = [];
        for (const s of Shape.draw_shapes) {
            if (s.seethrough)
                continue;
            const body = s.thing.body;
            if (body != undefined && !result.includes(body)) {
                if (body.walls) {
                    for (const w of body.walls) {
                        if (!result.includes(w))
                            result.push(w);
                    }
                }
                else {
                    result.push(body);
                }
            }
        }
        Thing.body_list = result;
        return result;
    }
    ;
    uid = ++Thing.cumulative_id;
    id = "generic thing #" + this.uid;
    body = undefined; // physics body
    options = {};
    object = {}; // for any random things
    shapes = [];
    shoots = [];
    team = 0;
    damage = 0;
    health;
    ability;
    target = {
        position: vector3.create(),
        angle: 0,
        facing: vector.create(),
        velocity: vector.create(),
        vz: 0,
    };
    is_player = false;
    is_touching_player = false;
    is_bullet = false;
    is_enemy = false;
    is_removed = false;
    random_number = math.rand();
    player_position = vector3.create();
    is_seeing_player = false;
    constructor() {
        Thing.things.push(this);
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
        return math.round_dp(this.target.position.z, 3);
    }
    set z(z) {
        this.target.position.z = z;
    }
    get angle() {
        return (this.body) ? this.body.angle : this.target.angle;
    }
    set angle(angle) {
        this.target.angle = angle;
    }
    get velocity() {
        return vector.clone((this.body) ? this.body.velocity : this.target.velocity);
    }
    set velocity(velocity) {
        this.target.velocity.x = velocity.x;
        this.target.velocity.y = velocity.y;
    }
    get thing_time() {
        return Thing.time;
    }
    get room_id() {
        return this.options.room_id ?? "";
    }
    set room_id(room_id) {
        this.options.room_id = room_id;
    }
    get has_behaviour() {
        return this.options.shoot_mode != undefined || this.options.shoot_mode_idle != undefined || this.options.move_mode != undefined || this.options.move_mode_idle != undefined || this.options.face_mode != undefined || this.options.face_mode_idle != undefined;
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
        this.create_room();
        if (!this.body && !this.options.decoration) {
            const body_options = this.create_body_options();
            this.create_body(body_options);
        }
        if (this.body)
            this.body.label = o.id;
        this.make_shoot(this.options.shoots);
        this.make_the_rest();
        if (this.options.spawn_permanent && save.check_switch(this.id)) {
            this.remove(); // or die?
        }
    }
    make(key, reset = false) {
        const o = make[key];
        if (reset)
            this.options = {};
        override_object(this.options, o);
        this.make_shape(key, reset);
        this.make_shoot(this.options.shoots, reset);
        this.make_the_rest();
        return this.options;
    }
    make_shape(key, reset = false) {
        if (reset)
            for (const shape of shallow_clone_array(this.shapes))
                shape.remove();
        const shapes = make_shapes[key] ?? [];
        for (const o of shapes) {
            Shape.from_make(this, o);
        }
    }
    make_shoot(shoots = [], reset = false) {
        if (reset)
            for (const shoot of shallow_clone_array(this.shoots))
                shoot.remove();
        for (const shoot_key of shoots) {
            const S = make_shoot[shoot_key];
            if (S) {
                this.add_shoot(S);
            }
            else
                console.error(`[thing/make] thing id '${this.id}': make_shoot '${shoot_key}' doesn't exist!`);
        }
    }
    make_the_rest() {
        if (this.options.damage != undefined)
            this.damage = this.options.damage;
        if (this.options.team != undefined)
            this.team = this.options.team;
        if (this.options.health != undefined) {
            if (this.health == undefined)
                this.health = new Health(this);
            this.health.make(this.options.health);
        }
        if (this.options.ability != undefined) {
            if (this.ability == undefined)
                this.ability = new Health(this);
            this.ability.make(this.options.ability);
        }
    }
    create_id(id) {
        this.id = id;
        Thing.things_lookup[id] = this;
        return;
    }
    create_room(room_id) {
        if (room_id)
            this.room_id = room_id;
        else
            room_id = this.room_id;
        if (Thing.things_rooms[room_id] == undefined)
            Thing.things_rooms[room_id] = [];
        Thing.things_rooms[room_id].push(this);
        return;
    }
    create_body_options(filter) {
        const result = {
            isStatic: !this.options.movable,
            isSensor: this.options.sensor,
            angle: this.options.angle == undefined ? this.target.angle : vector.deg_to_rad(this.options.angle),
            friction: this.options.friction_contact ?? 0.1,
            frictionAir: this.options.friction ?? 0.01,
            restitution: this.options.restitution ?? 0,
            density: this.options.density ?? 1,
        };
        if (filter)
            result.collisionFilter = filter;
        else if (this.options.wall_filter)
            result.collisionFilter = filters[this.options.wall_filter];
        return result;
    }
    create_body(options = {}, shape_index = 0) {
        if (this.shapes.length <= shape_index) {
            throw `thing '${this.id}': shape index ${shape_index} >= length ${this.shapes.length}`;
        }
        const s = this.shapes[shape_index];
        let body;
        let add_body = true;
        if (s instanceof Polygon && s.sides === 0) {
            body = Bodies.circle(s.offset.x, s.offset.y, s.radius, options);
            Body.setPosition(body, this.target.position);
            // Body.setAngle(body, this.target.angle);
        }
        else { // just use vertices
            if (s.closed_loop && s.vertices.length > 2) {
                body = Bodies.fromVertices(s.offset.x, s.offset.y, [s.vertices], options);
                if (body.parts.length >= 2 || !(s instanceof Polygon)) {
                    for (const b of body.parts) {
                        b.thing = this;
                        b.label = this.id;
                    }
                    const offset_3_hour = vector.sub(vector.aabb2bounds(vector.make_aabb(s.vertices)).min, body.bounds.min);
                    body.offset = offset_3_hour;
                    Body.setPosition(body, vector.add(this.target.position, offset_3_hour));
                }
                else {
                    Body.setPosition(body, this.target.position);
                    // Body.setAngle(body, this.target.angle);
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
    die() {
        const id = this.id.split("#")[0].trim();
        const bypass_remove = detector.before_death_fns[id]?.(this);
        if (bypass_remove)
            return;
        this.remove_death();
        this.remove_break();
        this.remove();
    }
    remove() {
        if (this.is_removed)
            return;
        this.remove_list();
        this.remove_body();
        this.remove_children();
        this.remove_shapes();
        this.remove_shoots();
        this.is_removed = true;
    }
    remove_death() {
        if (this.is_removed)
            return;
        if (this.options.death != undefined) {
            for (const d of this.options.death) {
                if (d.type === "none")
                    continue;
                let S = make_shoot[d.type] ?? {};
                if (d.stats) {
                    S = clone_object(S);
                    override_object(S, d.stats);
                }
                if (d.stats_mult) {
                    if (!d.stats)
                        S = clone_object(S);
                    multiply_object(S, d.stats_mult);
                }
                if (S) {
                    const shoot = this.add_shoot(S);
                    shoot.stats.angle = (shoot.stats.angle ?? 0) + (d.angle ?? 0);
                    shoot.stats.offset = vector.add(shoot.stats.offset ?? vector.create(), d.offset ?? vector.create());
                    for (let i = 0; i < (d.repeat ?? 1); i++) {
                        const b = shoot.shoot_bullet();
                        b.bullet_keep = true;
                        if (d.angle_increment)
                            shoot.stats.angle = (shoot.stats.angle ?? 0) + d.angle_increment;
                        if (d.offset_increment)
                            shoot.stats.offset = vector.add(shoot.stats.offset ?? vector.create(), d.offset_increment);
                    }
                }
                else
                    console.error(`[thing/bullet/remove] thing id '${this.id}': make_shoot '${d.type}' doesn't exist!`);
            }
        }
        if (this.options.spawn_permanent) { // death is permanent
            save.set_switch(this.id);
        }
    }
    remove_break() {
        if (this.is_removed)
            return;
        const v = this.options.breakable ? this.target.velocity : this.velocity;
        // v.z = 0.025;
        this.shapes[0]?.break({ type: "fade", velocity: vector.create(), opacity_mult: 0.5 });
    }
    remove_list() {
        for (const array of [
            Thing.things,
            Thing.things_rooms[this.room_id],
            this.bullet_shoot?.bullets
        ]) {
            // remove this from array
            array?.remove(this);
        }
        delete Thing.things_lookup[this.id];
    }
    remove_body() {
        if (this.body != undefined) {
            // remove from world
            Composite.remove(world, this.body);
            const walls = this.body.walls ?? [];
            for (const wall of walls) {
                Composite.remove(world, wall);
            }
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
            for (const c of shallow_clone_array(shoot.bullets)) {
                if (c.bullet_keep)
                    continue;
                c.remove();
            }
        }
    }
    remove_shapes() {
        for (const shape of shallow_clone_array(this.shapes)) {
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
            detector.sensor_during_fns[this.id]?.(this);
        }
        for (const shoot of this.shoots) {
            shoot.tick();
        }
        if (this.health?.is_zero) {
            this.die();
        }
        else {
            this.health?.tick();
            this.ability?.tick();
        }
        if (this.has_behaviour)
            this.tick_behaviour();
    }
    shoot(index = -1) {
        if (index >= 0) {
            if (index < this.shoots.length)
                this.shoots[index].shoot();
            else
                console.error(`[thing/shoot] in thing '${this.id}': index ${index} out of range`);
        }
        else {
            for (const shoot of this.shoots) {
                shoot.shoot();
            }
        }
    }
    hit(_damage) {
        // do nothing when hit
    }
    update_angle(smoothness = 1) {
        if (this.body == undefined)
            return;
        if (this.target.facing != undefined)
            this.target.angle = vector.direction(vector.sub(this.target.facing, this.position));
        Body.setAngle(this.body, math.lerp_angle(this.angle, this.target.angle, smoothness));
    }
    // useful
    lookup(id) {
        return Thing.things_lookup[id];
    }
    // behaviour functions
    tick_behaviour() {
        const player = Thing.things_lookup["player"];
        this.can_see_player();
        if (this.is_seeing_player && this.options.focus_camera) {
            player.camera_target_target = this.position;
        }
        this.do_shoot(this.is_seeing_player ? (this.options.shoot_mode ?? "none") : (this.options.shoot_mode_idle ?? "none"));
        this.do_face(this.is_seeing_player ? (this.options.face_mode ?? "none") : (this.options.face_mode_idle ?? "none"));
        this.do_move(this.is_seeing_player ? (this.options.move_mode ?? "none") : (this.options.move_mode_idle ?? "none"));
    }
    can_see_player() {
        const player = Thing.things_lookup["player"];
        if (this.options.enemy_detect_range === 0 || vector.length2(vector.sub(this.position, player.position)) > (this.options.enemy_detect_range ?? 1000) ** 2) {
            this.is_seeing_player = false;
            return false;
        }
        const player_size = player.shapes[0]?.radius ?? 0;
        const checks = [
            vector3.clone(player.position),
            vector3.add(player.position, vector3.create(player_size, 0, 0)),
            vector3.add(player.position, vector3.create(0, player_size, 0)),
            vector3.add(player.position, vector3.create(-player_size, 0, 0)),
            vector3.add(player.position, vector3.create(0, -player_size, 0)),
        ];
        for (const check of checks) {
            if (Query.ray(Thing.body_list, this.position, check).length === 0) {
                this.is_seeing_player = true;
                this.player_position = check;
                return check;
            }
        }
        this.is_seeing_player = false;
        return false;
    }
    do_shoot(shoot_mode) {
        if (shoot_mode === "none") {
        }
        else if (shoot_mode === "normal") {
            this.shoot();
        }
    }
    do_face(face_mode) {
        const player = Thing.things_lookup["player"];
        if (face_mode === "none") {
        }
        else if (face_mode === "static") {
        }
        else if (face_mode === "predict2") {
            const predict_amount = (this.options.face_predict_amount ?? 1);
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3 * predict_amount));
            this.update_angle(this.options.face_smoothness ?? 0.3);
        }
        else if (face_mode === "predict") {
            const predict_amount = (this.options.face_predict_amount ?? 1);
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3 * predict_amount));
            this.update_angle(this.options.face_smoothness ?? 0.3);
        }
        else if (face_mode === "spin") {
            this.target.angle = this.angle + (this.options.spin_speed ?? 0.01) * (this.random_number >= 0.5 ? 1 : -1);
            this.target.facing = vector.add(this.position, vector.createpolar(this.target.angle));
            if (this.body)
                Body.setAngle(this.body, this.target.angle);
        }
        else if (face_mode === "direct") {
            this.target.facing = this.player_position;
            this.update_angle(this.options.face_smoothness ?? 1);
        }
    }
    do_move(move_mode) {
        if (move_mode === "none") {
        }
        else if (move_mode === "static") {
        }
        else if (move_mode === "hover") {
            const dist2 = vector.length2(vector.sub(this.position, this.player_position));
            this.push_to(this.target.facing, (this.options.move_speed ?? 1) * ((dist2 < (this.options.move_hover_distance ?? 300) ** 2) ? -1 : 1));
        }
        else if (move_mode === "direct") {
            this.push_to(this.target.facing, (this.options.move_speed ?? 1));
        }
        else if (move_mode === "spiral") {
            const v = vector.rotate(vector.create(), vector.sub(this.position, this.player_position), vector.deg_to_rad(80));
            this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (this.options.move_speed ?? 1));
        }
        else if (move_mode === "circle") {
            this.push_to(this.target.facing, (this.options.move_speed ?? 1));
        }
    }
    // physics body functions
    translate_wall(vector) {
        if (!this.body)
            return;
        this.translate(vector);
        const walls = this.body.walls ?? [];
        for (const wall of walls) {
            Body.setPosition(wall, Vector.add(wall.position, vector));
        }
    }
    translate(v) {
        if (!this.body)
            return;
        Body.setPosition(this.body, Vector.add(this.body.position, v));
    }
    teleport_to(v) {
        if (!this.body)
            return;
        Body.setPosition(this.body, v);
    }
    reset_velocity() {
        if (!this.body)
            return;
        Body.setVelocity(this.body, vector.create());
    }
    push_to(target, amount) {
        const push = vector.createpolar(Vector.angle(this.position, target), amount * (this.body?.mass ?? 1) * config.physics.force_factor);
        if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
            Body.applyForce(this.body, this.position, push);
        }
    }
    push_in_direction(angle, amount) {
        const push = vector.createpolar(angle, amount * (this.body?.mass ?? 1) * config.physics.force_factor);
        if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
            Body.applyForce(this.body, this.position, push);
        }
    }
    push_by(amount) {
        if (this.body != undefined && this.position != undefined && amount.x != undefined && amount.y != undefined) {
            Body.applyForce(this.body, this.position, vector.mult(amount, this.body.mass * config.physics.force_factor));
        }
    }
    add_shoot(stats, shape) {
        const shoot = new Shoot(this, stats, shape);
        this.shoots.push(shoot);
        return shoot;
    }
}
export class Bullet extends Thing {
    is_bullet = true;
    bullet_shoot;
    bullet_time = -1;
    bullet_keep = false;
    tick() {
        super.tick();
        if (this.bullet_time >= 0 && this.bullet_time <= Thing.time) {
            this.die();
        }
    }
}
