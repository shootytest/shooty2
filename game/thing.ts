// import spam
import { world } from "../index.js";
import { Bodies, Body, Bounds, Composite, IBodyDefinition, ICollisionFilter, Query, Vector } from "../matter.js";
import { config } from "../util/config.js";
import { map_shape_options_type, map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { Health } from "./health.js";
import { make, make_shapes, shoot_stats, override_object, make_shoot, shallow_clone_array, multiply_and_override_object, clone_object, maketype_shape, shoot_mode, face_mode, move_mode, multiply_object, maketype_behaviour } from "./make.js";
import type { Player } from "./player.js";
import { save } from "./save.js";
import { Polygon, Shape } from "./shape.js";
import { Shoot } from "./shoot.js";

/**
 * the thing class... i probably have made like 5 of these (in other projects :)
 * this should cover all "things"
 * maybe this is everything (update: i made a spawner class that isn't a thing :O)
 */
export class Thing {

  static time: number = 0;
  static tick_time: number = 0;

  static things: Thing[] = [];
  static things_lookup: { [key: string]: Thing } = {};
  static things_rooms: { [room_key: string]: Thing[] } = {};

  static cumulative_id = 0;

  static tick_things(dt: number) { // except player
    this.update_body_list();
    Thing.tick_time++;
    Thing.time += dt;
    for (const thing of Thing.things) {
      if (!thing.is_player) thing.tick(dt);
    }
  };

  static body_list: Matter.Body[] = [];
  static update_body_list() {
    const result: Matter.Body[] = [];
    for (const s of Shape.draw_shapes) {
      if (s.seethrough) continue;
      const body = s.thing.body;
      if (body != undefined && !result.includes(body)) {
        if ((body as any).walls) {
          for (const w of (body as any).walls) {
            if (!result.includes(w)) result.push(w);
          }
        } else {
          result.push(body);
        }
      }
    }
    Thing.body_list = result;
    return result;
  };

  uid: number = ++Thing.cumulative_id;
  id: string = "generic thing #" + this.uid;

  body?: Body = undefined; // physics body
  options: map_shape_options_type = {};

  object: { [key: string]: any } = {}; // for any random things

  shapes: Shape[] = [];
  shoots: Shoot[] = [];

  team = 0;
  damage = 0;
  health?: Health;
  ability?: Health;
  parent: Thing = this;

  target: {
    position: vector3,
    angle: number,
    facing: vector,
    velocity: vector,
    vz: number,
  } = {
    position: vector3.create(),
    angle: 0,
    facing: vector.create(),
    velocity: vector.create(),
    vz: 0,
  };

  is_player: boolean = false;
  is_touching_player: boolean = false;

  is_bullet: boolean = false;
  is_enemy: boolean = false;
  is_removed: boolean = false;

  behaviour: {
    type: string;
    map: { [key: string]: maketype_behaviour };
    time: number;
    shoot_count: number;
    wander_reached: boolean;
    wander_time: number;
  } = {
    type: "",
    map: {},
    time: 0,
    shoot_count: 0,
    wander_reached: true,
    wander_time: -1,
  };

  random_number = math.rand();
  original_position: vector3 = vector3.create(); // for behaviour
  player_position: vector3 = vector3.create(); // for enemies' target
  is_seeing_player = false;

  constructor() {
    Thing.things.push(this);
  }

  get position(): vector3 {
    return (this.body) ? vector3.create2(vector.sub(this.body.position, this.body.offset ?? vector.create()), this.target.position.z) : vector3.clone(this.target.position);
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
    return math.round_z(this.target.position.z);
  }

  set z(z: number) {
    this.target.position.z = z;
  }

  get radius(): number {
    return this.shapes[0].r ?? 0;
  }

  get angle() {
    return (this.body) ? this.body.angle : this.target.angle;
  }
  set angle(angle) {
    this.target.angle = angle;
  }

  get velocity(): vector {
    return vector.clone((this.body) ? this.body.velocity : this.target.velocity);
  }
  set velocity(velocity: vector) {
    this.target.velocity.x = velocity.x;
    this.target.velocity.y = velocity.y;
  }

  get thing_time(): number {
    return Thing.time;
  }

  get room_id(): string {
    return this.options.room_id ?? "";
  }
  set room_id(room_id: string) {
    this.options.room_id = room_id;
  }

  get is_wall(): boolean {
    return (this.options.wall_filter != undefined && this.options.wall_filter !== "none");
  }

  get cover_z(): boolean {
    return (this.options.cover_z == undefined)
      ? (this.is_wall || Boolean(this.options.sensor) || !this.options.seethrough)
      : (this.options.cover_z);
  }

  make_map(o: map_shape_type) {
    if (o.computed == undefined) {
      throw "map shape not computed yet!";
    }
    this.options = {};
    const make_options = make[o.options.make_id ?? "default"] ?? make.default;
    if (o.options.make_id) override_object(this.options, make_options);
    override_object(this.options, o.options);
    const _s = Shape.from_map(this, o);
    if (this.shapes.length <= 1) this.position = this.options.force_max_z ? vector3.mean_but_somehow_max_z(o.computed.vertices) : vector3.mean(o.computed.vertices);
    else console.error("[thing/make_map] i feel this shouldn't happen...");
    vector3.add_to_list(_s.vertices, vector3.create(0, 0, -this.z)); // move shape vertices back
    this.create_id(o.id);
    this.create_room();
    if (!this.body && !this.options.decoration) {
      const body_options = this.create_body_options();
      this.create_body(body_options);
    }
    if (this.body) this.body.label = o.id;
    this.make_shoot(this.options.shoots);
    this.make_the_rest();
    if (this.options.spawn_permanent && save.check_switch(this.id)) {
      this.remove(); // or die?
    }
    if (this.options.sensor) {
      // check if player on sensor right now... just in case the physics engine doesn't like me
      const vs = this.shapes[0].computed?.vertices;
      if (vs && math.is_circle_in_polygon(Thing.things_lookup.player.position, Thing.things_lookup.player.radius, vector.add_list(vs, this.position))) {
        this.object.run_start = true;
      }
    }
  }

  make(key: string, reset = false) {
    const o = make[key];
    if (reset) this.options = {};
    override_object(this.options, o);
    this.make_shape_key(key, reset);
    this.make_shoot(this.options.shoots, reset);
    this.make_the_rest();
    return this.options;
  }

  make_shape_key(key: string, reset = false) {
    if (reset) for (const shape of shallow_clone_array(this.shapes)) shape.remove();
    const shapes: maketype_shape[] = make_shapes[key] ?? [];
    for (const o of shapes) {
      Shape.from_make(this, o);
    }
  }

  make_shape(m: maketype_shape | maketype_shape[], reset = false) {
    if (reset) for (const shape of shallow_clone_array(this.shapes)) shape.remove();
    for (const o of Array.isArray(m) ? m : [m]) {
      Shape.from_make(this, o);
    }
  }

  make_shoot(shoots: string[] = [], reset = false) {
    if (reset) for (const shoot of shallow_clone_array(this.shoots)) shoot.remove();
    for (const shoot_key of shoots) {
      const S = make_shoot[shoot_key];
      if (S) {
        this.add_shoot(S);
      } else console.error(`[thing/make] thing id '${this.id}': make_shoot '${shoot_key}' doesn't exist!`);
    }
  }

  make_the_rest() {
    if (this.options.damage != undefined) this.damage = this.options.damage;
    if (this.options.team != undefined) this.team = this.options.team;
    if (this.options.health != undefined) {
      if (this.health == undefined) this.health = new Health(this);
      this.health.make(this.options.health);
    }
    if (this.options.ability != undefined) {
      if (this.ability == undefined) this.ability = new Health(this);
      this.ability.make(this.options.ability);
    }
  }

  create_id(id: string) {
    this.id = id;
    Thing.things_lookup[id] = this;
    return;
  }

  create_room(room_id?: string) {
    if (room_id) this.room_id = room_id;
    else room_id = this.room_id;
    if (Thing.things_rooms[room_id] == undefined) Thing.things_rooms[room_id] = [];
    Thing.things_rooms[room_id].push(this);
    return;
  }

  create_body_options(filter?: ICollisionFilter): IBodyDefinition {
    const result: IBodyDefinition = {
      isStatic: !this.options.movable,
      isSensor: this.options.sensor,
      angle: this.options.angle == undefined ? this.target.angle : vector.deg_to_rad(this.options.angle),
      friction: this.options.friction_contact ?? 0.1,
      frictionAir: this.options.friction ?? 0.01,
      restitution: this.options.restitution ?? 0,
      density: this.options.density ?? 1,
    };
    if (filter) result.collisionFilter = filter;
    // else if (this.options.sensor) result.collisionFilter = filters.all;
    else if (this.options.wall_filter) result.collisionFilter = filters[this.options.wall_filter];
    return result;
  }

  create_body(options: IBodyDefinition = {}, shape_index: number = 0) {
    if (this.shapes.length <= shape_index) {
      throw `thing '${this.id}': shape index ${shape_index} >= length ${this.shapes.length}`;
    }
    const s = this.shapes[shape_index];
    let body: Body;
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
            (b as any).thing = this;
            b.label = this.id;
          }
          const offset_3_hour = vector.sub(vector.aabb2bounds(vector.make_aabb(s.vertices)).min, body.bounds.min);
          body.offset = offset_3_hour;
          Body.setPosition(body, vector.add(this.target.position, offset_3_hour));
        } else {
          Body.setPosition(body, this.target.position);
          // Body.setAngle(body, this.target.angle);
        }
      } else {
        // console.log(s.vertices);
        // console.log(math.expand_lines(s.vertices, 1));
        // const composite = Composite.create();
        const vertices = vector3.add_list(s.vertices, vector3.create(0, 0, this.z));
        const sm = vector.mean(vertices);
        if (s.closed_loop) vertices.push(vertices[0]); // must be after calculating the mean!
        const [expanded, zs] = math.expand_lines(vertices, config.physics.wall_width);
        const normals: vector[] = [];
        if (this.options.force_wall_body) for (const vs of expanded) normals.push(vector.normalise(vector.rotate90(vector.sub(vs[2], vs[1]))));
        const b = Bodies.fromVertices(sm.x, sm.y, expanded, options);
        const walls: Matter.Body[] = [];
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
          (b_ as any).thing = this;
          if (this.options.force_wall_body/* && z_offset !== (this.options.force_wall_ground ?? 0)*/) {
            (b_ as any).z = z_offset;
            (b_ as any).normal = normals[i]; // unused for now
          }
          // Composite.add(composite, b);
          Composite.add(world, b_);
          Body.setPosition(b_, vector.add(this.target.position, vm));
          Body.setAngle(b_, 0);
          walls.push(b_);
        }
        // Composite.add(world, composite);
        (b as any).thing = this;
        (b as any).walls = walls;
        body = b;
        add_body = false;
      }
    }
    this.body = body;
    (this.body as any).thing = this;
    if (/*s.z === 0 &&*/ add_body) Composite.add(world, this.body); // todo handle other z?
    Body.setVelocity(body, this.target.velocity);
  }

  die() {
    const id = this.id.split("#")[0].trim();
    this.die_xp();
    const bypass_remove = detector.before_death_fns[id]?.(this);
    if (bypass_remove) return;
    this.remove_death();
    this.remove_break();
    this.remove();
  }

  die_xp() {
    if (this.options.xp) { // add xp if needed
      const player = Thing.things_lookup["player"] as Player;
      player.add_xp(this.options.xp);
    }
  }

  remove() {
    if (this.is_removed) return;
    this.remove_list();
    this.remove_body();
    this.remove_children();
    this.remove_shapes();
    this.remove_shoots();
    this.is_removed = true;
  }

  remove_death() {
    if (this.is_removed) return;
    if (this.options.death != undefined) {
      for (const d of this.options.death) {
        if (d.type === "none") continue;
        let S = make_shoot[d.type] ?? {};
        if (d.stats) {
          S = clone_object(S);
          override_object(S, d.stats);
        }
        if (d.stats_mult) {
          if (!d.stats) S = clone_object(S);
          multiply_object(S, d.stats_mult);
        }
        if (S) {
          const shoot = this.add_shoot(S);
          shoot.stats.angle = (shoot.stats.angle ?? 0) + (d.angle ?? 0);
          shoot.stats.offset = vector.add(shoot.stats.offset ?? vector.create(), d.offset ?? vector.create());
          for (let i = 0; i < (d.repeat ?? 1); i++) {
            const b = shoot.shoot_bullet();
            b.bullet_keep = true;
            if (d.angle_increment) shoot.stats.angle = (shoot.stats.angle ?? 0) + d.angle_increment;
            if (d.offset_increment) shoot.stats.offset = vector.add(shoot.stats.offset ?? vector.create(), d.offset_increment);
          }
        } else console.error(`[thing/bullet/remove_death] thing id '${this.id}': make_shoot '${d.type}' doesn't exist!`);
      }
    }
    if (this.options.spawn_permanent) { // death is permanent
      save.set_switch(this.id);
    }
  }

  remove_break() {
    if (this.is_removed) return;
    const v: vector3_ = this.options.breakable ? this.target.velocity : this.velocity;
    // v.z = 0.025;
    for (const shape of this.shapes ?? []) {
      shape.break({ type: "fade", velocity: vector.create(), opacity_mult: 0.5 });
    }
  }

  remove_list() {
    for (const array of [
      Thing.things,
      Thing.things_rooms[this.room_id],
      (this as unknown as Bullet).bullet_shoot?.bullets]
    ) {
      // remove this from array
      array?.remove(this);
    }
    delete Thing.things_lookup[this.id];
  }

  remove_body() {
    if (this.body != undefined) {
      // remove from world
      Composite.remove(world, this.body);
      const walls = (this.body as any).walls as Matter.Body[] ?? [];
      for (const wall of walls) {
        Composite.remove(world, wall);
      }
      this.body = undefined;
      return true;
    } else {
      return false;
    }
  }

  remove_children() {
    for (const shoot of this.shoots) {
      // if (this.keep_children) return;
      for (const c of shallow_clone_array(shoot.bullets)) {
        if (c.bullet_keep) continue;
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

  tick(dt: number) {
    detector.tick_fns[this.id]?.(this);
    if (this.is_touching_player && !this.is_player) {
      detector.sensor_during_fns[this.id]?.(this, dt);
      if (!this.options.sensor) { // is a floor
        if (this.options.sensor_fov_mult != undefined) (Thing.things_lookup.player as Player).fov_mult = this.options.sensor_fov_mult || 1;
        if (!this.options.sensor_dont_set_room) (Thing.things_lookup.player as Player).change_room(this.room_id);
        this.is_touching_player = false;
      }
    } else {
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
    } else {
      this.health?.tick();
      this.ability?.tick();
    }
    if (this.options.zzz_sleeping) {
      // make zzz particles around 4 times a second
      if (Thing.time >= this.behaviour.time) {
        this.shapes[0].zzz();
        this.behaviour.time = Thing.time + (0.25 * config.seconds);
      }
    } else {
      // handle behaviour
      this.tick_behaviour();
    }
    if (this.options.repel_range && this.options.repel_force) {
      // handle repelling
      const r = this.options.repel_range;
      for (const b of Query.region(world.bodies, Bounds.create([vector.add(this.position, vector.create(-r, -r)), vector.add(this.position, vector.create(r, r))]))) {
        const dv = vector.sub(b.position, this.position);
        const other = ((b as any).thing as Thing);
        if (vector.length2(dv) < (r + other.radius) ** 2) {
          const pushforce = vector.normalise(dv, this.options.repel_force);
          other.push_by(pushforce);
        }
      };
    }
  }

  shoot(index: number | number[] = -1) {
    if (Array.isArray(index)) {
      let number_of_shoots = 0;
      for (const i of index) {
        number_of_shoots += this.shoots[i].shoot();
      }
      return number_of_shoots;
    } else if (index >= 0) {
      if (index < this.shoots.length) return this.shoots[index].shoot();
      else { console.error(`[thing/shoot] in thing '${this.id}': index ${index} out of range`); return 0; }
    } else {
      let number_of_shoots = 0;
      for (const shoot of this.shoots) {
        number_of_shoots += shoot.shoot();
      }
      return number_of_shoots;
    }
  }

  hit(_damage: number) {
    // do nothing when hit
  }

  update_angle(smoothness = 1) {
    if (this.body == undefined) return;
    if (this.target.facing != undefined) this.target.angle = vector.direction(vector.sub(this.target.facing, this.position));
    Body.setAngle(this.body, math.lerp_angle(this.angle, this.target.angle, smoothness));
  }

  // useful
  lookup(id: string) {
    return Thing.things_lookup[id];
  }
  all_things() {
    return Thing.things;
  }


  // behaviour functions

  tick_behaviour() {
    if (!this.options.behaviour) return;
    const player = Thing.things_lookup.player as Player;
    this.can_see_player();
    if (this.is_seeing_player) {
      if (this.behaviour.type !== "normal") {
        this.behaviour.time = 0;
        this.behaviour.type = "normal";
      }
      if (this.options.focus_camera) {
        player.camera_target_target = this.position;
      }
    } else {
      if (this.behaviour.type !== "idle") {
        this.behaviour.time = 0;
        this.behaviour.type = "idle";
      }
    }
    if (this.behaviour.time >= 0 && this.behaviour.time < Thing.time) this.switch_behaviour();
    let b = this.behaviour.map[this.behaviour.type];
    if (!b) return;
    if (b.shoot_mode) this.do_shoot(b);
    if (b.face_mode) this.do_face(b);
    if (b.move_mode) this.do_move(b);
    // this.do_shoot(this.is_seeing_player ? (this.options.shoot_mode ?? "none") : (this.options.shoot_mode_idle ?? "none"));
    // this.do_face(this.is_seeing_player ? (this.options.face_mode ?? "none") : (this.options.face_mode_idle ?? "none"));
    // this.do_move(this.is_seeing_player ? (this.options.move_mode ?? "none") : (this.options.move_mode_idle ?? "none"));
  }

  can_see_player() {
    const player = Thing.things_lookup["player"] as Player;
    if (this.options.enemy_detect_range === 0 || vector.length2(vector.sub(this.position, player.position)) > (this.options.enemy_detect_range ?? 1000) ** 2) {
      this.is_seeing_player = false;
      return false;
    }
    const player_size = (player.shapes[0] as Polygon)?.radius ?? 0;
    const checks = [
      vector3.clone(player.position),
      vector3.add(player.position, vector3.create(player_size, 0, 0)),
      vector3.add(player.position, vector3.create(0, player_size, 0)),
      vector3.add(player.position, vector3.create(-player_size, 0, 0)),
      vector3.add(player.position, vector3.create(0, -player_size, 0)),
    ];
    for (const check of checks) {
      if (!math.is_line_intersecting_polygons(this.position, check, Shape.see_vertices)) {
      // if (Query.ray(Thing.body_list, this.position, check).length === 0) {
        this.is_seeing_player = true;
        this.player_position = check;
        return check;
      }
    }
    this.is_seeing_player = false;
    return false;
  }

  switch_behaviour(): void {
    if (!this.options.behaviour) return;
    let result = this.options.behaviour[this.behaviour.type];
    if (Array.isArray(result)) {
      if (result[0].chance) {
        const chances = result.map(a => a.chance!);
        result = math.randpick_weighted(result, chances);
      } else {
        result = math.randpick(result);
      }
    } else if (!result) return;
    this.behaviour.map[this.behaviour.type] = result;
    if (result.time == undefined || result.time < 0) this.behaviour.time = -1;
    else this.behaviour.time = Thing.time + Math.round((result.time + (result.shoot_cooldown ?? 0)) * config.seconds);
    this.behaviour.shoot_count = 0;
    this.behaviour.wander_reached = true;
    this.behaviour.wander_time = -1;
  }

  do_shoot(b: maketype_behaviour) {
    const shoot_mode = b.shoot_mode;
    if (b.shoot_cooldown && this.behaviour.time - Math.round(b.shoot_cooldown * config.seconds) < Thing.time) return;
    if (shoot_mode === "none") {

    } else if (shoot_mode === "normal") {
      this.shoot(b.shoot_index);
    } else if (shoot_mode === "single") {
      if (this.behaviour.shoot_count < (b.shoot_single_limit ?? 1)) {
        this.behaviour.shoot_count += this.shoot(b.shoot_index);
      }
    } else if (shoot_mode === "burst") {
      this.shoot(b.shoot_index);
    }
    return;
  }

  do_face(b: maketype_behaviour) {
    const face_mode = b.face_mode;
    const player = Thing.things_lookup["player"];
    if (face_mode === "none") {
      // do nothing
    } else if (face_mode === "static") {
      // do nothing
    } else if (face_mode === "predict2") {
      const predict_mult = (b.face_predict_amount ?? 1);
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3 * predict_mult));
      this.update_angle(b.face_smoothness ?? 0.3);
    } else if (face_mode === "predict") {
      const predict_mult = (b.face_predict_amount ?? 1);
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3 * predict_mult));
      this.update_angle(b.face_smoothness ?? 0.3);
    } else if (face_mode === "spin") {
      this.target.angle = this.target.angle + (b.spin_speed ?? 0.01) * (this.random_number >= 0.5 ? 1 : -1);
      this.target.facing = vector.add(this.position, vector.createpolar(this.target.angle));
      if (this.body) Body.setAngle(this.body, this.target.angle);
    } else if (face_mode === "direct") {
      this.target.facing = this.player_position;
      this.update_angle(b.face_smoothness ?? 1);
    } else if (face_mode === "wander") {
      if (this.behaviour.wander_reached || Thing.time >= this.behaviour.wander_time) {
        if (b.wander_time != undefined) this.behaviour.wander_time = Thing.time + ((b.wander_time ?? 1) + (b.wander_cooldown ?? 0)) * config.seconds;
        this.target.facing = math.rand_point_in_circle(this.original_position, b.wander_distance ?? 0);
        this.behaviour.wander_reached = false;
      }
      this.update_angle(b.face_smoothness ?? 1);
    }
  }

  do_move(b: maketype_behaviour) {
    const move_mode = b.move_mode;
    if (move_mode === "none") {
      // do nothing
    } else if (move_mode === "static") {
      // do nothing
    } else if (move_mode === "hover") {
      const dist2 = vector.length2(vector.sub(this.position, this.player_position));
      this.push_to(this.target.facing, (b.move_speed ?? 1) * ((dist2 < (b.move_hover_distance ?? 300) ** 2) ? -1 : 1));
    } else if (move_mode === "direct") {
      this.push_to(this.target.facing, (b.move_speed ?? 1));
    } else if (move_mode === "spiral") {
      const v = vector.rotate(vector.create(), vector.sub(this.position, this.player_position), vector.deg_to_rad(80));
      this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (b.move_speed ?? 1));
    } else if (move_mode === "wander") {
      if (this.behaviour.wander_reached) {
        return;
      } else if (b.wander_time != undefined && Thing.time >= this.behaviour.wander_time - (b.wander_cooldown ?? 0) * config.seconds) {
        this.behaviour.wander_reached = true;
      } else if (vector.length2(vector.sub(this.target.facing, this.position)) < 10) {
        // reached
        this.behaviour.wander_time = Thing.time + (b.wander_cooldown ?? 0) * config.seconds;
        this.behaviour.wander_reached = true;
      } else {
        this.push_to(this.target.facing, (b.move_speed ?? 1));
      }
    }
  }

  // physics body functions

  translate(v: vector) {
    if (!this.body) return;
    Body.setPosition(this.body, Vector.add(this.body.position, v));
    const walls = (this.body as any).walls as Matter.Body[] ?? [];
    for (const wall of walls) {
      Body.setPosition(wall, Vector.add(wall.position, v));
    }
  }

  teleport_to(v: vector) {
    if (!this.body) return;
    Body.setPosition(this.body, v);
  }

  set_velocity(v: vector) {
    if (!this.body) return;
    Body.setVelocity(this.body, v);
  }

  reset_velocity() {
    if (!this.body) return;
    Body.setVelocity(this.body, vector.create());
  }

  push_to(target: vector, amount: number) {
    const push = vector.createpolar(Vector.angle(this.position, target), amount * (this.body?.mass ?? 1) * config.physics.force_factor);
    if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
      Body.applyForce(this.body, this.position, push);
    }
  }

  push_in_direction(angle: number, amount: number) {
    const push = vector.createpolar(angle, amount * (this.body?.mass ?? 1) * config.physics.force_factor);
    if (this.body != undefined && this.position != undefined && push.x != undefined && push.y != undefined) {
      Body.applyForce(this.body, this.position, push);
    }
  }

  push_by(amount: vector) {
    if (this.body != undefined && this.position != undefined && amount.x != undefined && amount.y != undefined) {
      Body.applyForce(this.body, this.position, vector.mult(amount, this.body.mass * config.physics.force_factor));
    }
  }

  add_shoot(stats: shoot_stats, shape?: Shape) {
    const shoot = new Shoot(this, stats, shape);
    this.shoots.push(shoot);
    return shoot;
  }

}

export class Bullet extends Thing {

  is_bullet: boolean = true;
  bullet_shoot?: Shoot;
  bullet_time: number = -1;
  bullet_total_time: number = -1;
  bullet_keep: boolean = false;

  get bullet_time_ratio() { // goes up over time
    return 1 - (this.bullet_time - Thing.time) / this.bullet_total_time;
  }

  tick(dt: number) {
    super.tick(dt);
    if (this.bullet_time >= 0 && this.bullet_time <= Thing.time) {
      this.die();
    }
  }

}