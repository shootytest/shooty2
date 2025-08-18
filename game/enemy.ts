import { Query } from "../matter.js";
import { map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { filters } from "./detector.js";
import { face_type, make, move_type } from "./make.js";
import { player } from "./player.js";
import { Polygon, Shape } from "./shape.js";
import { Thing } from "./thing.js";


export class Enemy extends Thing {

  static cumulative_ids: { [key: string]: number } = {};
  static cumulative_team_ids: { [team: string]: number } = {};

  spawner: Spawner;
  wave_number = -1;
  player_position: vector3 = player.position;

  constructor(spawner: Spawner) {
    super();
    this.spawner = spawner;
    this.is_enemy = true;
  }

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
    this.angle = math.rand(0, Math.PI * 2);
    this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = id;
    else console.error("[enemy/make_enemy] no body?");
  }

  tick() {
    super.tick();
    this.tick_enemy();
  }

  tick_enemy() {
    if (this.can_see_player()) this.shoot();
    this.face_enemy();
    this.move_enemy();
  }

  can_see_player() {
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
        this.player_position = check;
        return check;
      }
    }
    return false;
  }

  face_enemy() {
    const face_type = this.options.face_type ?? "none";
    if (face_type === "static") {

    } else if (face_type === "predict2") {
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, this.player_position)) ** 0.5) * 3));
      this.update_angle(this.options.face_smoothness ?? 0.3);
    } else if (face_type === "predict") {
      this.target.facing = vector.add(this.player_position, vector.mult(player.velocity, vector.length(vector.sub(this.position, this.player_position)) * 0.3));
      this.update_angle(this.options.face_smoothness ?? 0.3);
    } else if (face_type.startsWith("direct")) {
      this.target.facing = this.player_position;
      this.update_angle(this.options.face_smoothness ?? 1);
    }
  }

  move_enemy() {
    const move_type = this.options.move_type ?? "none";
    if (move_type === "static") {

    } else if (move_type === "hover") {
      const dist2 = vector.length2(vector.sub(this.position, this.player_position));
      this.push_to(this.target.facing, (this.options.move_speed ?? 1) * ((dist2 < (this.options.move_hover_distance ?? 300) ** 2) ? -1 : 1));
    } else if (move_type === "direct") {
      this.push_to(this.target.facing, (this.options.move_speed ?? 1));
    } else if (move_type === "spiral") {
      const v = vector.rotate(vector.create(), vector.sub(this.position, this.player_position), vector.deg_to_rad(80));
      this.push_to(vector.add(this.target.facing, vector.mult(v, 0.5)), (this.options.move_speed ?? 1));
    }
  }

  remove() {
    const index = this.spawner.enemies.indexOf(this);
    if (index != undefined && index > -1) {
      this.spawner.enemies.splice(index, 1);
    }
    this.spawner.calc_progress();
    super.remove();
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
  wave_type?: "";
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

  uid: number = ++Spawner.cumulative_id;
  id: string = "generic spawner #" + this.uid;

  spawn?: enemy_spawn;
  waves: enemy_wave[] = [];
  wave_progress = -1;
  vertices: vector3_[] = [];
  enemies: Enemy[] = [];
  delays: { enemy: string, time: number }[] = [];

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
  }

  create_id(id: string) {
    this.id = id;
    Spawner.spawners_lookup[id] = this;
  }

  tick() {
    if (this.spawn && this.wave_progress < 0 && this.enemies.length <= 0) {
      for (let i = 0; i < (this.spawn.repeat ?? 1); i++) {
        this.delays.push({ enemy: this.spawn.enemy, time: Thing.time + (this.spawn.delay ?? 0) + i * (this.spawn.repeat_delay ?? 0) });
      }
    } else if (this.waves.length >= 1 && this.wave_progress < this.waves.length) {
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
      this.wave_progress = this.enemies.length <= 0 ? 0 : -1;
    } else {
      // todo waves
    }
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

};