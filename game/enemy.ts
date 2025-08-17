import { map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3_ } from "../util/vector.js";
import { filters } from "./detector.js";
import { make } from "./make.js";
import { player } from "./player.js";
import { Thing } from "./thing.js";


export class Enemy extends Thing {

  static cumulative_ids: { [key: string]: number } = {};
  static cumulative_team_ids: { [team: string]: number } = {};

  spawner: Spawner;
  wave_number = -1;

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
    this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = id;
    else console.error("[enemy/make_enemy] no body?");
  }

  tick() {
    super.tick();
    this.tick_enemy();
  }

  tick_enemy() {
    this.shoot();
    this.face_enemy();
    this.move_enemy();
  }

  face_enemy() {
    if (1) {
      this.target.facing = vector.add(player.position, vector.mult(player.velocity, (vector.length(vector.sub(this.position, player.position)) ** 0.5) * 3));
      this.update_angle(0.3);
    } else if (1) {
      this.target.facing = vector.add(player.position, vector.mult(player.velocity, vector.length(vector.sub(this.position, player.position)) * 0.3));
      this.update_angle(0.3);
    } else if (1) {
      this.target.facing = player.position;
      this.update_angle(1);
    }
  }

  move_enemy() {

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