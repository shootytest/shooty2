import { Body, Query } from "../matter.js";
import { map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { face_mode, make, move_mode, shoot_mode } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Polygon, Shape } from "./shape.js";
import { Thing } from "./thing.js";


export class Enemy extends Thing {

  static cumulative_ids: { [key: string]: number } = {};
  static cumulative_team_ids: { [team: string]: number } = {};

  static tick() {
    this.update_body_list();
  }

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
    Enemy.body_list = result;
    return result;
  }

  spawner: Spawner;
  wave_number = -1;
  random_number = 0;
  player_position: vector3 = player.position;
  is_seeing_player = false;

  constructor(spawner: Spawner) {
    super();
    this.spawner = spawner;
    this.is_enemy = true;
  }

  make_enemy(key: string, position: vector3_, id?: string) {
    if (make[key] == undefined) return console.error(`[enemy/make_enemy] no such enemy: '${key}'`);
    this.make(key);
    if (id) this.create_id(id);
    else {
      if (Enemy.cumulative_ids[key] == undefined) Enemy.cumulative_ids[key] = 1;
      id = key + " #" + Enemy.cumulative_ids[key]++;
      this.create_id(id);
      if (Enemy.cumulative_team_ids[this.team] == undefined) Enemy.cumulative_team_ids[this.team] = 1;
      this.team += (Enemy.cumulative_team_ids[this.team]++) * 0.000000000001; // a trillion possible enemies per team
    }
    this.position = position;
    if (!this.options.angle) this.angle = math.rand(0, Math.PI * 2);
    this.random_number = math.rand();
    if (!this.options.decoration) this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = id;
    if (this.options.switch && save.check_switch(this.spawner.id)) {
      this.shapes[0].glowing = 1;
    }
  }

  die() {
    const id = this.spawner.id;
    const bypass_remove = detector.before_death_fns[id]?.(this);
    if (bypass_remove) return;
    super.die();
  }

  tick() {
    super.tick();
    // this.tick_enemy();
  }

  tick_enemy() {
    this.can_see_player();
    this.do_shoot(this.is_seeing_player ? (this.options.shoot_mode ?? "none") : (this.options.shoot_mode_idle ?? "none"));
    this.do_face(this.is_seeing_player ? (this.options.face_mode ?? "none") : (this.options.face_mode_idle ?? "none"));
    this.do_move(this.is_seeing_player ? (this.options.move_mode ?? "none") : (this.options.move_mode_idle ?? "none"));
  }

  can_see_player() {
    if (this.options.enemy_detect_range === 0 || vector.length2(vector.sub(this.position, player.position)) > (this.options.enemy_detect_range ?? 1000) ** 2) {
      this.is_seeing_player = false;
      return false;
    }
    const player_size = (player.shapes[0] as Polygon)?.radius ?? 0;
    const checks = [
      player.position,
      vector3.add(player.position, vector3.create(player_size, 0, 0)),
      vector3.add(player.position, vector3.create(0, player_size, 0)),
      vector3.add(player.position, vector3.create(-player_size, 0, 0)),
      vector3.add(player.position, vector3.create(0, -player_size, 0)),
    ];
    for (const check of checks) {
      if (Query.ray(Enemy.body_list, this.position, check).length === 0) {
        this.is_seeing_player = true;
        this.player_position = check;
        return check;
      }
    }
    this.is_seeing_player = false;
    return false;
  }

  do_shoot(shoot_mode: shoot_mode) {
    if (shoot_mode === "none") {

    } else if (shoot_mode === "normal") {
      this.shoot();
    }
  }

  do_face(face_mode: face_mode) {
    if (face_mode === "none") {

    } else if (face_mode === "static") {

    } else if (face_mode === "predict2") {
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3));
      this.update_angle(this.options.face_smoothness ?? 0.3);
    } else if (face_mode === "predict") {
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3));
      this.update_angle(this.options.face_smoothness ?? 0.3);
    } else if (face_mode === "spin") {
      this.target.angle = this.angle + (this.options.spin_speed ?? 0.01) * (this.random_number >= 0.5 ? 1 : -1);
      this.target.facing = vector.add(this.position, vector.createpolar(this.target.angle));
      if (this.body) Body.setAngle(this.body, this.target.angle);
    } else if (face_mode === "direct") {
      this.target.facing = this.player_position;
      this.update_angle(this.options.face_smoothness ?? 1);
    }
  }

  do_move(move_mode: move_mode) {
    if (move_mode === "none") {

    } else if (move_mode === "static") {

    } else if (move_mode === "hover") {
      const dist2 = vector.length2(vector.sub(this.position, this.player_position));
      this.push_to(this.target.facing, (this.options.move_speed ?? 1) * ((dist2 < (this.options.move_hover_distance ?? 300) ** 2) ? -1 : 1));
    } else if (move_mode === "direct") {
      this.push_to(this.target.facing, (this.options.move_speed ?? 1));
    } else if (move_mode === "spiral") {
      const v = vector.rotate(vector.create(), vector.sub(this.position, this.player_position), vector.deg_to_rad(80));
      this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (this.options.move_speed ?? 1));
    } else if (move_mode === "circle") {
      this.push_to(this.target.facing, (this.options.move_speed ?? 1));
    }
  }

  shoot() {
    if (this.is_seeing_player) player.enemy_can_see = true;
    super.shoot();
  }

  remove() {
    const index = this.spawner.enemies.indexOf(this);
    if (index != undefined && index > -1) {
      this.spawner.enemies.splice(index, 1);
    }
    this.spawner.calc_progress();
    super.remove();
  }

  remove_static() {
    const index = this.spawner.enemies.indexOf(this);
    if (index != undefined && index > -1) {
      this.spawner.enemies.splice(index, 1);
    }
    this.spawner.calc_progress();
    if (this.is_removed) return;
    this.remove_death();
    delete this.health; // important! prevents remove on tick (health.is_zero)
    if (this.body) this.body.isStatic = true;
    for (const shoot of this.shoots) shoot.update_shape(1);
    this.remove_children();
    this.remove_shoots();
  }

  remove_deco() {
    const index = this.spawner.enemies.indexOf(this);
    if (index != undefined && index > -1) {
      this.spawner.enemies.splice(index, 1);
    }
    this.spawner.calc_progress();
    if (this.is_removed) return;
    delete this.health;
    this.remove_death();
    this.remove_body();
    for (const shoot of this.shoots) shoot.update_shape(1);
    this.remove_children();
    this.remove_shoots();
  }

};


export interface enemy_spawn {
  enemy: string;
  position?: vector3_;
  delay?: number;
  repeat?: number;
  repeat_delay?: number;
};

export interface enemy_wave {
  enemies: enemy_spawn[];
  wave_number: number;
  wave_type?: "default" | "todo what is this";
};


export class Spawner {

  static spawners: Spawner[] = [];
  static spawners_lookup: { [key: string]: Spawner } = {};
  
  static cumulative_id = 0;

  static tick_spawners() {
    for (const spawner of Spawner.spawners) { 
      spawner.tick();
    }
  }

  static check_progress(spawner_id: string): number {
    return this.spawners_lookup[spawner_id]?.wave_progress ?? -1;
  }

  uid: number = ++Spawner.cumulative_id;
  id: string = "generic spawner #" + this.uid;

  spawn?: enemy_spawn;
  waves: enemy_wave[] = [];
  wave_progress = 0;
  vertices: vector3_[] = [];
  enemies: Enemy[] = [];
  delays: { enemy: string, time: number }[] = [];
  permanent = false;

  constructor() {
    Spawner.spawners.push(this);
  }

  make_map(o: map_shape_type) {
    this.vertices = vector.clone_list(o.vertices);
    this.create_id(o.id);
    this.spawn = {
      enemy: o.options.spawn_enemy ?? "enemy",
      delay: o.options.spawn_delay,
      repeat: o.options.spawn_repeat,
      repeat_delay: o.options.spawn_repeat_delay,
    };
    if (o.options.spawn_permanent) this.permanent = o.options.spawn_permanent;
    if (this.permanent) {
      this.wave_progress = save.get_switch(this.id);
    }
  }

  create_id(id: string) {
    this.id = id;
    Spawner.spawners_lookup[id] = this;
  }

  tick() {
    if (this.spawn && this.wave_progress <= 0 && this.enemies.length <= 0) {
      for (let i = 0; i < (this.spawn.repeat ?? 1); i++) {
        this.delays.push({ enemy: this.spawn.enemy, time: Thing.time + (this.spawn.delay ?? 0) + i * (this.spawn.repeat_delay ?? 0) });
      }
    } else if (this.waves.length >= 1 && this.wave_progress < this.waves.length + 1) {
      // todo waves
    }
    this.delays = this.delays.filter((d) => {
      if (Thing.time < d.time) return true;
      this.spawn_enemy(d.enemy);
      return false;
    });
  }

  spawn_enemy(key: string, position?: vector) {
    const e = new Enemy(this);
    e.make_enemy(key, position ?? this.random_position());
    this.enemies.push(e);
    return e;
  }

  do_waves() {

  }

  calc_progress() {
    if (this.spawn) {
      this.wave_progress = (this.enemies.length <= 0) ? 1 : 0;
    } else {
      // todo waves
    }
    if (this.permanent && this.wave_progress > -1) {
      save.set_switch(this.id, this.wave_progress);
    }
    detector.spawner_calc_fns[this.id]?.(this);
  }

  random_position(): vector {
    if (this.vertices.length === 0) {
      console.error("[spawner/random_position] no vertices in polygon!");
      return vector.create();
    }
    return math.rand_point_in_polygon(this.vertices);
  }

  remove() {
    const index = Spawner.spawners.indexOf(this);
    if (index != undefined && index > -1) {
      Spawner.spawners.splice(index, 1);
    }
    delete Spawner.spawners_lookup[this.id];
  }
  
  check_progress(spawner_id: string): number {
    return Spawner.check_progress(spawner_id);
  }

  // useful
  thing_lookup(thing_id: string) {
    return Thing.things_lookup[thing_id];
  }

};