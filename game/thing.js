// import spam
import { world } from "../index.js";
import { Bodies, Body, Bounds, Composite, Query, Vector } from "../matter.js";
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
    static tick_time = 0;
    static things = [];
    static things_lookup = {};
    static things_rooms = {};
    static cumulative_id = 0;
    static lookup(id) {
        return Thing.things_lookup[id];
    }
    static tick_things(dt) {
        this.update_body_list();
        Thing.tick_time++;
        Thing.time += dt;
        for (const thing of Thing.things) {
            if (!thing.is_player)
                thing.tick(dt);
        }
    }
    ;
    static tick_map_things(dt) {
        for (const thing of Thing.things) {
            if (thing.options.is_map)
                thing.tick(dt);
        }
    }
    ;
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
    remove_fn;
    shapes = [];
    shoots = [];
    team = 0;
    damage = 0;
    health;
    ability;
    shield;
    parent = this;
    target = {
        position: vector3.create(),
        angle: 0,
        facing: vector.create(),
        angular_velocity: 0,
        velocity: vector.create(),
        vz: 0,
    };
    is_player = false;
    is_touching_player = false;
    is_bullet = false;
    is_enemy = false;
    is_removed = false;
    behaviour = {
        type: "",
        map: {},
        time: 0,
        shoot_count: 0,
        wander_reached: true,
        wander_time: -1,
    };
    random_number = math.rand();
    original_position = vector3.create(); // for behaviour
    player_position = vector3.create(); // for enemies' target
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
        return math.round_z(this.target.position.z);
    }
    set z(z) {
        this.target.position.z = z;
    }
    get radius() {
        return this.shapes[0].r ?? 0;
    }
    get angle() {
        return (this.body) ? this.body.angle : this.target.angle;
    }
    set angle(angle) {
        this.target.angle = angle;
    }
    get angular_velocity() {
        return (this.body) ? this.body.angularVelocity : this.target.angular_velocity;
    }
    set angular_velocity(angular_velocity) {
        this.target.angular_velocity = angular_velocity;
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
    original_room_id = "";
    get room_id() {
        return this.options.room_id ?? "";
    }
    set room_id(room_id) {
        this.options.room_id = room_id;
    }
    get is_wall() {
        return (this.options.wall_filter != undefined && this.options.wall_filter !== "none");
    }
    get cover_z() {
        return (this.options.cover_z == undefined)
            ? (this.is_wall || Boolean(this.options.sensor) || !this.options.seethrough)
            : (this.options.cover_z);
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
        const _s = Shape.from_map(this, o);
        if (this.shapes.length <= 1)
            this.position = this.options.force_max_z ? vector3.mean_but_somehow_max_z(o.computed.vertices) : vector3.mean(o.computed.vertices);
        else
            console.error("[thing/make_map] i feel this shouldn't happen...");
        this.original_position = vector3.clone(this.position);
        vector3.add_to_list(_s.vertices, vector3.create(0, 0, -this.z)); // move shape vertices back
        this.create_id(o.id);
        this.create_room();
        if (!this.body && !this.options.decoration) {
            this.create_body();
        }
        if (this.body)
            this.body.label = o.id;
        this.make_shoot(this.options.shoots);
        this.make_the_rest();
        if (this.options.spawn_permanent && save.check_switch(this.id)) {
            this.remove(); // or die? // todo unimportant: make it die earlier in this function maybe
        }
        if (this.options.sensor) {
            // check if player is on the sensor just as it spawns... just in case matter.js doesn't like me
            const vs = this.shapes[0].computed?.vertices;
            if (vs && math.is_circle_in_polygon(Thing.things_lookup.player.position, Thing.things_lookup.player.radius, vector.add_list(vs, this.position))) {
                this.object.run_start = true;
            }
        }
    }
    make_object(o, reset = false) {
        if (reset)
            this.options = {};
        override_object(this.options, o);
        if (this.options.shoots?.length ?? 0)
            this.make_shoot(this.options.shoots, true);
        this.make_the_rest();
        return this.options;
    }
    make(key, reset = false) {
        const o = make[key];
        if (!o) {
            console.error(`make not found: ${key}`);
            return;
        }
        if (reset)
            this.options = {};
        override_object(this.options, o);
        this.make_shape_key(key, reset);
        this.make_shoot(this.options.shoots, reset);
        this.make_the_rest();
        return this.options;
    }
    make_shape_key(key, reset = false) {
        if (reset)
            for (const shape of shallow_clone_array(this.shapes))
                shape.remove();
        const shapes = make_shapes[key] ?? [];
        const result = [];
        for (const o of shapes) {
            result.push(Shape.from_make(this, o));
        }
        return result;
    }
    make_shape(m, reset = false) {
        if (reset)
            for (const shape of shallow_clone_array(this.shapes))
                shape.remove();
        for (const o of Array.isArray(m) ? m : [m]) {
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
                this.health = new Health(this, "health");
            this.health.make(this.options.health);
        }
        if (this.options.ability != undefined) {
            if (this.ability == undefined)
                this.ability = new Health(this, "ability");
            this.ability.make(this.options.ability);
        }
        if (this.options.shield != undefined) {
            if (this.shield == undefined)
                this.shield = new Health(this, "shield");
            this.shield.make(this.options.shield);
        }
        // do coin attractor (for coins)
        if (this.options.collectible?.currency_name === "coin" && this.options.enemy_detect_range) {
            this.options.enemy_detect_range *= config.game.coin_attractor_mult;
        }
    }
    create_id(id) {
        this.id = id;
        Thing.things_lookup[id] = this;
        if (id !== "player") { // important! if not circular stuff happens
            detector.make_fns[id]?.(this);
        }
        return;
    }
    create_room(room_id) {
        if (room_id)
            this.room_id = room_id;
        else
            room_id = this.room_id;
        this.original_room_id = room_id;
        if (Thing.things_rooms[room_id] == undefined)
            Thing.things_rooms[room_id] = [];
        Thing.things_rooms[room_id].push(this);
        return;
    }
    set_room(room_id) {
        if (this.body?.isStatic)
            return false;
        if (room_id === this.room_id)
            return false;
        Thing.things_rooms[this.room_id].remove(this);
        this.room_id = room_id;
        if (Thing.things_rooms[room_id] == undefined)
            Thing.things_rooms[room_id] = [];
        Thing.things_rooms[room_id].push(this);
        return true;
    }
    create_body_options(filter) {
        const result = {
            isStatic: !this.options.movable,
            isSensor: this.options.sensor,
            angle: this.options.angle == undefined ? this.target.angle : math.deg_to_rad(this.options.angle),
            friction: this.options.friction_contact ?? 0.1,
            frictionAir: this.options.friction ?? 0.01,
            restitution: this.options.restitution ?? 0,
            density: this.options.density ?? 1,
        };
        if (filter)
            result.collisionFilter = filter;
        // else if (this.options.sensor) result.collisionFilter = filters.all;
        else if (this.options.wall_filter)
            result.collisionFilter = filters[this.options.wall_filter];
        return result;
    }
    create_body(options = this.create_body_options(), shape_index = 0) {
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
            if (s.closed_loop && s.vertices.length > 2 && !this.options.force_wall_body) {
                // body = Bodies.fromVertices(s.offset.x, s.offset.y, [math.expand_polygon(s.vertices, config.physics.wall_width)], options);
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
                const vertices = vector3.add_list(s.vertices, vector3.create(0, 0, this.z));
                const sm = vector.mean(vertices);
                if (s.closed_loop)
                    vertices.push(vertices[0]); // must be after calculating the mean!
                const [expanded, zs] = math.expand_lines(vertices, config.physics.wall_width);
                const normals = [];
                if (this.options.force_wall_body)
                    for (const vs of expanded)
                        normals.push(vector.normalise(vector.rotate90(vector.sub(vs[2], vs[1]))));
                const b = Bodies.fromVertices(sm.x, sm.y, expanded, options);
                const walls = [];
                b.density = 0;
                b.collisionFilter = { category: 0 };
                // Composite.add(composite, b);
                // Composite.add(world, b);
                Body.setPosition(b, vector.add(this.target.position, sm));
                Body.setAngle(b, 0);
                b.label = this.id + "`" + 0;
                for (let i = 0; i < expanded.length; i++) {
                    const vs = expanded[i], z_offset = zs[i];
                    const vm = vector.mean(vs);
                    const b_ = Bodies.fromVertices(s.offset.x + vm.x, s.offset.y + vm.y, [vs], options);
                    b_.label = this.id + "`" + (i + 1);
                    b_.thing = this;
                    if (this.options.force_wall_body /* && z_offset !== (this.options.force_wall_ground ?? 0)*/) {
                        b_.z = z_offset;
                        b_.normal = normals[i]; // unused for now
                    }
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
        if (add_body)
            Composite.add(world, this.body);
        Body.setVelocity(body, this.target.velocity);
        Body.setAngularVelocity(body, this.target.angular_velocity);
    }
    die() {
        const id = this.id.split("#")[0].trim();
        this.die_xp();
        const bypass_remove = detector.before_death_fns[id]?.(this);
        if (bypass_remove)
            return;
        this.remove_death();
        this.remove_break();
        this.remove();
    }
    die_xp() {
        if (this.options.xp) { // add xp if needed
            const player = Thing.things_lookup["player"];
            player.add_xp(this.options.xp);
        }
    }
    remove() {
        if (this.is_removed)
            return;
        this.remove_fn?.();
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
                // do coin drop rate multiplier
                if (d.type === "collect_coin") {
                    if (!d.repeat)
                        d.repeat = 1;
                    d.repeat *= config.game.coin_drop_mult;
                    d.repeat = math.round_rand(d.repeat);
                }
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
                    console.error(`[thing/bullet/remove_death] thing id '${this.id}': make_shoot '${d.type}' doesn't exist!`);
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
        for (const shape of this.shapes ?? []) {
            shape.break({ type: "fade", velocity: vector.create(), opacity_mult: 0.5 });
        }
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
    tick(dt) {
        detector.tick_fns[this.id]?.(this);
        if (this.is_touching_player && !this.is_player) {
            detector.sensor_during_fns[this.id]?.(this, dt);
            if (!this.options.sensor) { // is a floor
                if (this.options.sensor_fov_mult != undefined)
                    Thing.things_lookup.player.fov_mult = this.options.sensor_fov_mult || 1;
                if (!this.options.sensor_dont_set_room)
                    Thing.things_lookup.player.change_room(this.room_id);
                this.is_touching_player = false;
            }
        }
        else {
            if (this.object.run_start) { // needs to run the start function...
                this.object.run_start = false;
                this.is_touching_player = true;
                detector.sensor_start_fns[this.id]?.(this);
            }
        }
        for (const shoot of this.shoots) {
            shoot.tick(dt);
        }
        if (this.health?.is_zero) {
            this.die();
        }
        else {
            this.health?.tick();
            this.ability?.tick();
            this.shield?.tick();
        }
        if (this.shield?.is_zero && this.options.repel_range) {
            this.options.repel_range = math.max(this.options.repel_range / 1.1, 0);
            if (this.options.repel_range < 1)
                delete this.options.repel_range;
        }
        if (this.options.zzz_sleeping) {
            // make zzz particles around 4 times a second
            if (Thing.time >= this.behaviour.time) {
                this.shapes[0].zzz();
                this.behaviour.time = Thing.time + (0.25 * config.seconds);
            }
        }
        else {
            // handle behaviour
            this.tick_behaviour();
        }
        if (this.options.repel_range && this.options.repel_force) {
            // handle repelling
            const r = this.options.repel_range;
            const angles = this.options.repel_angles;
            for (const b of Query.region(world.bodies, Bounds.create([vector.add(this.position, vector.create(-r, -r)), vector.add(this.position, vector.create(r, r))]))) {
                const dv = vector.sub(b.position, this.position);
                if (angles && !math.angle_in_ranges(math.rad_to_deg(vector.angle(dv) - this.angle), angles))
                    continue;
                const other = b.thing;
                if (other.parent !== this && vector.length2(dv) < (r + other.radius) ** 2) {
                    const pushforce = vector.normalise(dv, this.options.repel_force * 100);
                    other.push_by(pushforce);
                }
            }
            ;
        }
    }
    shoot(index = -1) {
        if (Array.isArray(index)) {
            let number_of_shoots = 0;
            for (const i of index) {
                number_of_shoots += this.shoots[i].shoot();
            }
            return number_of_shoots;
        }
        else if (index >= 0) {
            if (index < this.shoots.length)
                return this.shoots[index].shoot();
            else {
                console.error(`[thing/shoot] in thing '${this.id}': index ${index} out of range`);
                return 0;
            }
        }
        else {
            let number_of_shoots = 0;
            for (const shoot of this.shoots) {
                number_of_shoots += shoot.shoot();
            }
            return number_of_shoots;
        }
    }
    hit(_type, _damage) {
        // do nothing when hit (for now)
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
    all_things() {
        return Thing.things;
    }
    // behaviour functions
    tick_behaviour() {
        if (!this.options.behaviour)
            return;
        const player = Thing.things_lookup.player;
        this.can_see_player();
        if (this.is_seeing_player) {
            this.set_room(player.room_id);
            if (this.behaviour.type !== "normal") {
                this.behaviour.time = 0;
                this.behaviour.type = "normal";
            }
            if (this.options.focus_camera) {
                player.camera_target_target = this.position;
            }
        }
        else {
            if (this.behaviour.type !== "idle") {
                this.behaviour.time = 0;
                this.behaviour.type = "idle";
            }
        }
        if (this.behaviour.time >= 0 && this.behaviour.time < Thing.time)
            this.switch_behaviour();
        let b = this.behaviour.map[this.behaviour.type];
        if (!b)
            return;
        if (b.shoot_mode)
            this.do_shoot(b);
        if (b.face_mode)
            this.do_face(b);
        if (b.move_mode)
            this.do_move(b);
        // this.do_shoot(this.is_seeing_player ? (this.options.shoot_mode ?? "none") : (this.options.shoot_mode_idle ?? "none"));
        // this.do_face(this.is_seeing_player ? (this.options.face_mode ?? "none") : (this.options.face_mode_idle ?? "none"));
        // this.do_move(this.is_seeing_player ? (this.options.move_mode ?? "none") : (this.options.move_mode_idle ?? "none"));
    }
    can_see_player() {
        const player = Thing.things_lookup["player"];
        if (!this.options.enemy_detect_range || vector.length2(vector.sub(this.position, player.position)) > this.options.enemy_detect_range ** 2) {
            this.is_seeing_player = false;
            return false;
        }
        const player_size = player.radius;
        const checks = [
            vector3.clone(player.position),
            vector3.add(player.position, vector3.create(player_size, 0)),
            vector3.add(player.position, vector3.create(0, player_size)),
            vector3.add(player.position, vector3.create(-player_size, 0)),
            vector3.add(player.position, vector3.create(0, -player_size)),
        ];
        for (const check of checks) {
            if (!math.is_line_intersecting_polygons(this.position, check, this.team < 0 ? Shape.see_vertices : Shape.enemy_block_vertices)) {
                // if (Query.ray(Thing.body_list, this.position, check).length === 0) {
                this.is_seeing_player = true;
                this.player_position = check;
                return check;
            }
        }
        this.is_seeing_player = false;
        return false;
    }
    switch_behaviour() {
        if (!this.options.behaviour)
            return;
        let result = this.options.behaviour[this.behaviour.type];
        if (Array.isArray(result)) {
            if (result[0].chance) {
                const chances = result.map(a => a.chance);
                result = math.randpick_weighted(result, chances);
            }
            else {
                result = math.randpick(result);
            }
        }
        else if (!result)
            return;
        this.behaviour.map[this.behaviour.type] = result;
        if (result.time == undefined || result.time < 0)
            this.behaviour.time = -1;
        else
            this.behaviour.time = Thing.time + Math.round((result.time + (result.shoot_cooldown ?? 0)) * config.seconds);
        this.behaviour.shoot_count = 0;
        this.behaviour.wander_reached = true;
        this.behaviour.wander_time = -1;
    }
    do_shoot(b) {
        const shoot_mode = b.shoot_mode;
        if (b.shoot_cooldown && this.behaviour.time - Math.round(b.shoot_cooldown * config.seconds) < Thing.time)
            return;
        if (shoot_mode === "none") {
        }
        else if (shoot_mode === "normal") {
            this.shoot(b.shoot_index);
        }
        else if (shoot_mode === "single") {
            if (this.behaviour.shoot_count < (b.shoot_single_limit ?? 1)) {
                this.behaviour.shoot_count += this.shoot(b.shoot_index);
            }
        }
        else if (shoot_mode === "burst") {
            this.shoot(b.shoot_index);
        }
        return;
    }
    do_face(b) {
        const face_mode = b.face_mode;
        const player = Thing.things_lookup["player"];
        if (face_mode === "none") {
            // do nothing
        }
        else if (face_mode === "static") {
            // do nothing
        }
        else if (face_mode === "predict2") {
            const predict_mult = (b.face_predict_amount ?? 1);
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3 * predict_mult));
            this.update_angle(b.face_smoothness ?? 0.3);
        }
        else if (face_mode === "predict") {
            const predict_mult = (b.face_predict_amount ?? 1);
            this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3 * predict_mult));
            this.update_angle(b.face_smoothness ?? 0.3);
        }
        else if (face_mode === "spin") {
            this.target.angle = this.target.angle + 0.01 * (b.spin_speed ?? 1) * (this.random_number >= 0.5 ? 1 : -1);
            this.target.facing = vector.add(this.position, vector.createpolar(this.target.angle));
            if (this.body)
                Body.setAngle(this.body, this.target.angle);
        }
        else if (face_mode === "direct") {
            this.target.facing = this.player_position;
            this.update_angle(b.face_smoothness ?? 1);
        }
        else if (face_mode === "wander") {
            if (this.behaviour.wander_reached || Thing.time >= this.behaviour.wander_time) {
                if (b.wander_time != undefined)
                    this.behaviour.wander_time = Thing.time + ((b.wander_time ?? 1) + (b.wander_cooldown ?? 0)) * config.seconds;
                this.target.facing = math.rand_point_in_circle(this.original_position, b.wander_distance ?? 0);
                this.behaviour.wander_reached = false;
            }
            this.update_angle(b.face_smoothness ?? 1);
        }
    }
    do_move(b) {
        const move_mode = b.move_mode;
        if (move_mode === "none") {
            // do nothing
        }
        else if (move_mode === "static") {
            // do nothing
        }
        else if (move_mode === "hover") {
            const dist2 = vector.length2(vector.sub(this.position, this.player_position));
            this.push_to(this.target.facing, (b.move_speed ?? 1) * ((dist2 < (b.move_hover_distance ?? 300) ** 2) ? -1 : 1));
        }
        else if (move_mode === "direct") {
            this.push_to(this.target.facing, (b.move_speed ?? 1));
        }
        else if (move_mode === "spiral") {
            const v = vector.rotate(vector.sub(this.position, this.player_position), math.deg_to_rad(80));
            this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (b.move_speed ?? 1));
        }
        else if (move_mode === "wander") {
            if (this.behaviour.wander_reached) {
                return;
            }
            else if (b.wander_time != undefined && Thing.time >= this.behaviour.wander_time - (b.wander_cooldown ?? 0) * config.seconds) {
                this.behaviour.wander_reached = true;
            }
            else if (vector.length2(vector.sub(this.target.facing, this.position)) < 10) {
                // reached
                this.behaviour.wander_time = Thing.time + (b.wander_cooldown ?? 0) * config.seconds;
                this.behaviour.wander_reached = true;
            }
            else {
                this.push_to(this.target.facing, (b.move_speed ?? 1));
            }
        }
    }
    // physics body functions
    translate(v) {
        if (!this.body)
            return;
        Body.setPosition(this.body, Vector.add(this.body.position, v));
        const walls = this.body.walls ?? [];
        for (const wall of walls) {
            Body.setPosition(wall, Vector.add(wall.position, v));
        }
    }
    teleport_to(v) {
        if (!this.body)
            return;
        Body.setPosition(this.body, v);
    }
    set_velocity(v) {
        if (!this.body)
            return;
        Body.setVelocity(this.body, v);
    }
    set_angular_velocity(w) {
        if (!this.body)
            return;
        Body.setAngularVelocity(this.body, w);
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
    rotate_to(amount = 0) {
        if (this.body != undefined) {
            Body.setAngle(this.body, amount);
        }
    }
    rotate_by(amount, point = this.position) {
        if (this.body != undefined) {
            Body.rotate(this.body, amount, point);
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
    bullet_total_time = -1;
    bullet_keep = false;
    get bullet_time_ratio() {
        return 1 - (this.bullet_time - Thing.time) / this.bullet_total_time;
    }
    tick(dt) {
        super.tick(dt);
        if (this.bullet_time >= 0 && this.bullet_time <= Thing.time) {
            this.die();
        }
    }
}
