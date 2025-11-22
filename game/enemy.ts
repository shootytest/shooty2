import { color, STYLES_ } from "../util/color.js";
import { config } from "../util/config.js";
import { map_shape_type } from "../util/map_type.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { detector, filters } from "./detector.js";
import { make, make_shapes, make_waves, maketype_wave, maketype_wave_round, shallow_clone_array } from "./make.js";
import { Particle } from "./particle.js";
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

  make_enemy(key: string, position: vector3, room_id: string, id?: string) {
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
    this.original_position = vector3.clone(position);
    if (!this.options.angle) this.angle = math.rand(0, Math.PI * 2);
    if (!this.options.decoration) this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = id;
    if (this.options.switch && save.check_switch(this.spawner.id)) {
      this.shapes[0].options.glowing = 1;
    }
  }

  die() {
    const id = this.spawner.id;
    const bypass_remove = detector.before_death_fns[id]?.(this);
    if (bypass_remove) super.die_xp();
    else super.die();
  }

  tick(dt: number) {
    if (this.is_seeing_player && !this.options.enemy_safe) player.enemy_can_see = true;
    super.tick(dt);
  }

  shoot(index: number | number[] = -1) {
    return super.shoot(index);
  }

  remove() {
    this.remove_spawner();
    super.remove();
  }

  remove_spawner() {
    const s = this.spawner;
    s.enemies.remove(this);
    if (s.parent !== s) s.parent.enemies.remove(this);
    s.calc_progress();
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
  type: string;
  delay?: number;
  repeat?: number;
  repeat_delay?: number;
};

export interface enemy_delay {
  type: string;
  time: number;
  position: vector3;
  particle?: Particle;
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

  z: number = 0;
  vertices: vector3_[] = [];

  spawn?: enemy_spawn;
  wave?: maketype_wave;
  waves: maketype_wave_round[] = [];
  wave_progress: number = 0;

  enemies: Enemy[] = [];
  total_enemies: number = -1;
  delays: enemy_delay[] = [];

  contains: string[] = [];
  parent: Spawner = this;
  children: Spawner[] = [];

  permanent = false;
  removed = false;

  constructor() {
    Spawner.spawners.push(this);
  }

  get is_done(): boolean {
    if (this.spawn) {
      return this.wave_progress >= 1;
    } else if (this.wave) {
      return this.wave_progress >= this.waves.length;
    } else {
      return false;
    }
  }

  make_map(o: map_shape_type) {
    this.vertices = vector.clone_list(o.vertices);
    this.create_id(o.id);
    if (o.options.room_id) {
      this.room_id = o.options.room_id;
      if (Spawner.spawners_rooms[this.room_id] == undefined) Spawner.spawners_rooms[this.room_id] = [];
      Spawner.spawners_rooms[this.room_id].push(this);
    }
    this.z = Number(o.z.toFixed(3));
    if (make_waves[o.id]) {
      this.contains = shallow_clone_array(o.options.contains ?? []);
      this.wave = make_waves[o.id];
      this.waves = this.wave.rounds;
    } else if (o.options.spawn_enemy) {
      this.spawn = {
        type: o.options.spawn_enemy ?? "enemy",
        delay: o.options.spawn_delay,
        repeat: o.options.spawn_repeat,
        repeat_delay: o.options.spawn_repeat_delay,
      };
    } else {
      // just a shape for others to use, do nothing
    }
    if (o.options.spawn_permanent) this.permanent = Boolean(o.options.spawn_permanent);
    if (this.permanent) {
      const stored = save.get_switch(this.id);
      if (this.spawn) {
        this.wave_progress = stored;
      } else if (this.wave && this.wave_progress >= this.waves.length) {
        this.wave_progress = stored;
      }
    }
  }

  create_id(id: string) {
    this.id = id;
    Spawner.spawners_lookup[id] = this;
  }

  tick() {
    if (this.spawn && this.wave_progress <= 0 && this.total_enemies < 0) {
      this.total_enemies = this.do_spawn(this.spawn);
    } else if (this.wave && this.waves.length >= 1 && this.wave_progress < this.waves.length) {
      if (this.total_enemies < 0) {
        this.do_waves(this.waves[this.wave_progress]);
      } else {
        // todo other types of wave?
      }
    } else {
      // ???
    }
    this.delays = this.delays.filter((d) => {
      if (Thing.time < d.time) return true;
      this.spawn_enemy(d.type, d.position);
      return false;
    });
  }

  do_spawn(spawn: enemy_spawn) {
    for (let i = 0; i < (spawn.repeat ?? 1); i++) {
      const seconds = ((spawn.delay ?? 0) + i * (spawn.repeat_delay ?? 0));
      const delay: enemy_delay = {
        type: spawn.type,
        time: Thing.time + seconds * config.seconds,
        position: vector3.create2(this.random_position(), this.z),
      };
      if (seconds > 0) {
        const p = Particle.make_icon("spawn",
          (make_shapes[spawn.type]?.[0]?.radius ?? 30) * 2,
          delay.position,
        );
        p.time = delay.time;
        const style = make[spawn.type]?.style;
        if (style !== undefined) {
          p.style.fill = STYLES_[style].fill;
        } else {
          p.style.fill = color.spawner;
        }
        p.style.opacity = 0.8;
        p.z = this.z;
        delay.particle = p;
      }
      this.delays.push(delay);
    }
    return spawn.repeat ?? 1;
  }

  do_waves(wave: maketype_wave_round) {
    let total = 0;
    for (const e of wave.enemies) {
      let spawner: Spawner = this;
      if (typeof e.spawner === "number") {
        spawner = this.spawner_lookup(this.contains[e.spawner]);
      } else if (typeof e.spawner === "string") {
        spawner = this.spawner_lookup(e.spawner);
      }
      if (spawner == undefined) return;
      spawner.parent = this;
      if (!this.children.includes(spawner)) this.children.push(spawner);
      total += spawner.do_spawn(e);
    }
    this.total_enemies = total;
  }

  spawn_enemy(type: string, position?: vector3) {
    const e = new Enemy(this);
    e.make_enemy(type, position ?? vector3.create2(this.random_position(), this.z), this.room_id);
    e.wave_number = this.wave_progress + 1;
    e.create_room(this.room_id);
    this.enemies.push(e);
    if (this.parent !== this) this.parent.enemies.push(e);
    detector.before_spawn_fns[this.id]?.(e);
    detector.before_spawn_fns[type]?.(e);
    return e;
  }

  calc_progress() {
    if (this.removed) return;
    if (this.parent !== this) this.parent.calc_progress();
    if (this.spawn) {
      this.wave_progress = (this.enemies.length <= 0) ? 1 : 0;
    } else if (this.wave) {
      if (this.enemies.length <= 0 && this.children_delay_count() <= 0) {
        this.wave_progress += 1;
        if (this.wave_progress < this.waves.length) {
          this.do_waves(this.waves[this.wave_progress]);
        }
      }
    } else {
      // ???
    }
    if (this.permanent && this.wave_progress > -1) {
      save.set_switch(this.id, this.wave_progress);
    }
    detector.spawner_calc_fns[this.id]?.(this);
  }

  children_delay_count(): number {
    let total = 0;
    for (const c of this.children) {
      total += c.delays.length;
    }
    return total;
  }

  random_position(): vector {
    if (this.vertices.length === 0) {
      console.error("[spawner/random_position] no vertices in polygon!");
      return vector3.create(0, 0, this.z);
    }
    return vector3.create2(math.rand_point_in_polygon(this.vertices), this.z);
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
    // if (!thing) console.error("[enemy/thing_lookup] thing id not found: " + thing_id);
    // return thing;
  }

  spawner_lookup(spawner_id: string) {
    return Spawner.spawners_lookup[spawner_id];
  }

};