import { map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { make } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Thing } from "./thing.js";


export class Enemy extends Thing {

  static cumulative_ids: { [key: string]: number } = {};
  static cumulative_team_ids: { [team: string]: number } = {};

  spawner: Spawner;
  wave_number = -1;
  player_position: vector3 = player.position;
  is_seeing_player = false;

  constructor(spawner: Spawner) {
    super();
    this.spawner = spawner;
    this.is_enemy = true;
  }

  make_enemy(key: string, position: vector3_, room_id: string, id?: string) {
    if (make[key] == undefined) return console.error(`[enemy/make_enemy] no such enemy: '${key}'`);
    this.make(key);
    this.create_room(room_id);
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
  }

  shoot() {
    if (this.is_seeing_player) player.enemy_can_see = true;
    super.shoot();
  }

  remove() {
    this.remove_spawner();
    super.remove();
  }

  remove_spawner() {
    this.spawner.enemies.remove(this);
    this.spawner.calc_progress();
  }

  remove_static() {
    this.remove_spawner();
    if (this.is_removed) return;
    this.remove_death();
    delete this.health; // important! prevents remove on tick (health.is_zero)
    if (this.body) this.body.isStatic = true;
    for (const shoot of this.shoots) shoot.update_shape(1);
    this.remove_children();
    this.remove_shoots();
  }

  remove_deco() {
    this.remove_spawner();
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
  static spawners_rooms: { [key: string]: Spawner[] } = {};
  
  static cumulative_id = 0;

  static tick_spawners() {
    for (const spawner of Spawner.spawners) { 
      spawner.tick();
    }
  }

  static check_progress(spawner_id: string): number {
    return this.spawners_lookup[spawner_id]?.wave_progress ?? -1;
  }

  static get_enemy(spawner_id: string): Enemy | undefined {
    return Spawner.spawners_lookup[spawner_id]?.enemies?.[0];
  }

  uid: number = ++Spawner.cumulative_id;
  id: string = "generic spawner #" + this.uid;
  room_id: string = "";

  spawn?: enemy_spawn;
  waves: enemy_wave[] = [];
  wave_progress = 0;
  vertices: vector3_[] = [];
  enemies: Enemy[] = [];
  delays: { enemy: string, time: number }[] = [];
  permanent = false;
  removed = false;

  constructor() {
    Spawner.spawners.push(this);
  }

  make_map(o: map_shape_type) {
    this.vertices = vector.clone_list(o.vertices);
    this.create_id(o.id);
    if (o.options.room_id) {
      this.room_id = o.options.room_id;
      if (Spawner.spawners_rooms[this.room_id] == undefined) Spawner.spawners_rooms[this.room_id] = [];
      Spawner.spawners_rooms[this.room_id].push(this);
    }
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
    e.make_enemy(key, position ?? this.random_position(), this.room_id);
    e.wave_number = this.wave_progress + 1;
    e.create_room(this.room_id);
    this.enemies.push(e);
    return e;
  }

  do_waves() {

  }

  calc_progress() {
    if (this.removed) return;
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
    this.removed = true;
    Spawner.spawners.remove(this);
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