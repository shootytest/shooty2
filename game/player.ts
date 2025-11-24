import { make_from_map_shape, MAP } from "../index.js";
import { camera } from "../util/camera.js";
import { config } from "../util/config.js";
import { keys } from "../util/key.js";
import { math } from "../util/math.js";
import { vector, vector3, vector3_ } from "../util/vector.js";
import { filters } from "./detector.js";
import { Spawner } from "./enemy.js";
import { maketype_collect, override_object, shallow_clone_array } from "./make.js";
import { player_save, player_stats, save } from "./save.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";
import { ui } from "./ui.js";

export class Player extends Thing {

  autoshoot: boolean = false;
  fov_mult: number = 1;
  autosave_time: number = -1;
  last_floor_time: number = -1;
  die_time: number = 0;
  old_position: vector3_ = vector.create();
  checkpoint: vector3 = vector3.create();
  checkpoint_room: string = "";
  current_gun: string = "";
  enemy_can_see: boolean = false;
  guns: string[] = [];
  xp: number = 0;
  level: number = 0;
  stats: player_stats = {
    game_time: 0,
    total_time: 0,
    deaths: 0,
    pixels_walked: 0,
    clicks: [0, 0, 0],
    enemies_killed: {}, // todo
    bullets_shot: {},
    currencies_total: {},
  };

  on_floor: number = 0; // 2 = safe, 1 = not safe, 0 = fallllling
  floor_z: number = 0;
  is_safe: boolean = true;

  map_room: string = "";
  map_offset: vector = vector.create();
  map_scale: number = 1;

  camera_target: vector3_ = vector.create();
  camera_target_target: vector3_ = vector.create();
  room_list: string[] = [];

  paused: boolean = false;
  map_mode: boolean = false;

  constructor() {
    super();

    this.is_player = true;
    this.team = 1;
    this.make("player", true);
    if (this.health) this.health.display = 0; // start smooth animation from zero instead of full health

    this.create_id("player");
    this.position = vector3.create();
  }

  create_player() {
    this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = "player";
  }

  tick(dt: number) {
    if (vector.equal(this.camera_target_target, this.position)) {
      this.camera_target = this.position;
    }
    this.camera_target_target = this.position;
    const controls = {
      up: keys["ArrowUp"] === true || (keys["KeyW"] === true),
      down: keys["ArrowDown"] === true || (keys["KeyS"] === true),
      left: keys["ArrowLeft"] === true || (keys["KeyA"] === true),
      right: keys["ArrowRight"] === true || (keys["KeyD"] === true),
      top: keys["KeyQ"] === true,
      bottom: keys["KeyE"] === true,
      jump: (config.game.debug_mode || save.check_switch("jump")) && keys["Space"] === true,
      dash: (config.game.debug_mode || save.check_switch("dash")) && (keys["ShiftLeft"] === true || keys["ShiftRight"] === true),
      shoot: keys["Mouse"] === true || keys["KeyJ"] === true,
      rshoot: keys["MouseRight"] === true || keys["KeyK"] === true,
      facingx: Math.floor(camera.mouse_v.x),
      facingy: Math.floor(camera.mouse_v.y),
    };
    this.target.facing = vector.add(vector.sub(camera.mouse_v, camera.world2screen(this.position)), this.position);
    const move_x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const move_y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
    const move_z = (controls.jump ? 1 : 0);
    const move_v = vector.normalise(vector.create(move_x, move_y));
    if (this.body) {
      if (!this.paused) this.push_by(vector.mult(move_v, config.physics.player_speed));
      else if (this.map_mode) {
        this.map_offset = vector.add(this.map_offset, vector.mult(move_v, config.physics.player_speed * 10 / this.map_scale));
        this.map_scale = math.bound(this.map_scale + 0.05 * ((controls.top ? 1 : 0) - (controls.bottom ? 1 : 0)), 0.5, 2);
      }
      this.update_angle();
    }
    // update stats
    if (!this.paused) this.stats.game_time += dt;
    this.stats.total_time += dt;
    this.stats.pixels_walked += math.round(vector.length(vector.sub(this.position, this.old_position)));
    this.old_position = this.position;
    // handle floor checking, z movement, shooting, and autosaving only when unpaused
    if (!this.paused) {
      // floors and z stuff
      let on_floor = false;
      let safe_floor = true;
      let floor_z = (save.save.player.position?.z ?? 0) - 2;
      let on_floor_z = floor_z;
      let z = this.target.position.z;
      for (const s of Shape.floor_shapes) {
        if (s.computed && math.is_circle_in_polygon(this.position, this.radius, s.computed.vertices)) {
          if (s.z + math.epsilon < on_floor_z) break; // gone below the first floor level that the player is above
          floor_z = s.z;
          if (!on_floor) on_floor = s.z - math.epsilon <= z;
          if (on_floor) {
            on_floor_z = s.z;
            s.thing.is_touching_player = true;
            safe_floor = safe_floor && Boolean(s.thing.options.safe_floor);
          }
        }
      }
      const grounded = math.equal(z, floor_z);
      if (grounded) {
        this.target.vz = 0;
        if (on_floor) {
          // grounded
          this.last_floor_time = Thing.time;
          if (move_z > 0) this.jump(); // only jump while grounded
        } else {
          // fell
          z = this.fall_back();
        }
      }
      if (move_z > 0 && Thing.time - this.last_floor_time < config.physics.coyote_time) {
        this.jump(); // handle coyote time too
      }
      if (z < floor_z - 1.95) z = this.fall_back();
      else if (!this.map_mode && Shape.floor_shapes.length) {
        const v_mult = math.bound(dt / 167, 0, 3);
        z = math.bound(z + this.target.vz * v_mult, z < floor_z - 0.1 ? floor_z - 2 : floor_z, floor_z + 1000);
        if (Thing.time - this.die_time >= 0.5 * config.seconds) {
          this.target.vz = this.target.vz - config.physics.player_gravity * v_mult;
        }
      }
      // map
      if (this.is_safe) {
        for (const s of Shape.map_shapes) {
          if (s.computed && math.is_point_in_polygon(this.position, s.computed.vertices)) {
            const id = s.thing.id;
            if (id !== this.map_room) {
              save.visit_map(id);
              this.map_room = id;
            }
            continue;
          }
        }
      }
      // shoot
      if (controls.shoot || this.autoshoot) {
        this.shoot();
      }
      if (this.is_safe && (safe_floor && on_floor) && grounded && Thing.time >= this.autosave_time) { // only save while safe
        if (this.autosave_time < 0) this.autosave_time = Thing.time + config.game.autosave_interval;
        else this.save();
      }
      this.target.position.z = z;
      this.on_floor = (safe_floor && on_floor) ? 2 : (on_floor ? 1 : 0);
      this.floor_z = floor_z;
      // only do thing tick after all that
      super.tick(dt);
    }
  }

  jump(power = 1) {
    this.target.vz = power * config.physics.player_jump;
    this.die_time -= config.seconds;
  }

  die() {
    this.stats.deaths++;
    this.reset_velocity();
    // this.unload_all_rooms();
    this.change_room(this.checkpoint_room, true);
    this.reload_all_rooms();
    this.target.vz = 0;
    this.teleport_to(this.checkpoint);
    this.target.position.z = this.checkpoint.z;
    if (this.health) {
      this.health.heal_all();
      this.health.set_invincible(config.game.invincibility_time);
      this.die_time = Thing.time;
    }
  }

  fall_back() { // teleport player back after fall
    this.health?.hit(config.game.fall_damage);
    this.reset_velocity();
    this.target.vz = 0;
    this.teleport_to(save.save.player.position ?? this.checkpoint);
    this.target.position.z = save.save.player.position?.z ?? this.checkpoint.z ?? 0;
    return this.target.position.z;
  }

  hit(damage: number) {
    super.hit(damage);
    player.save_but_health_only(); // save when hit to prevent reloading tricks :(
    if (damage > 0) this.health?.set_invincible(config.game.invincibility_time);
  }

  camera_position() {
    this.camera_target = vector.lerp(this.camera_target, this.camera_target_target, config.graphics.camera_target_smoothness);
    const position = vector.lerp(this.camera_target, this.position, 0.5);
    if (this.map_mode) return vector.add(position, this.map_offset);
    return vector.add(position, vector.mult(vector.sub(camera.mouse_v, camera.halfscreen), config.graphics.camera_mouse_look_factor / camera.scale));
    // todo remove
    // let v = vector.sub(this.target.facing, camera.world2screen(this.position));
    // v = vector.normalise(v, vector.length(v) / 30 * camera.scale);
    // return vector.add(this.position, v);
  }

  camera_scale() {
    const v = camera.halfscreen;
    let s = Math.sqrt(v.x * v.y) / 500 / this.fov_mult;
    if (this.map_mode) s /= 5 / this.fov_mult / this.map_scale;
    else if (this.paused) s *= 10 * this.fov_mult;
    return s;
  }

  camera_zs() {
    const look_z = math.lerp(camera.look_z, this.z, config.graphics.camera_smoothness);
    return [ look_z + 1, look_z ];
  }

  remake_shoot(shoot_id?: string) {
    if (!shoot_id) shoot_id = this.current_gun;
    this.make_shape_key("player", true);
    this.make_shape_key("player_" + shoot_id);
  }

  save_but_health_only() {
    save.save.player.health = this.health?.value ?? 0;
    save.save.player.ability = this.ability?.value ?? 0;
  }

  save() {
    if (this.enemy_can_see) {
      this.enemy_can_see = false; // hmmm
      player.save_but_health_only();
      save.changed();
      return false;
    } else {
      this.autosave_time = Thing.time + config.game.autosave_interval;
      const o: player_save = {
        position: this.position,
        room_id: this.room_id,
        fov_mult: this.fov_mult,
        health: this.health?.value ?? 0,
        ability: this.ability?.value ?? 0,
        xp: this.xp,
        checkpoint: this.checkpoint,
        checkpoint_room: this.checkpoint_room,
        current_gun: this.current_gun,
        guns: this.guns,
        stats: this.stats,
      };
      save.save.player = o;
      save.changed();
      return true;
    }
  }

  load(o: player_save) {
    if (o.position) {
      this.position = o.position;
      this.old_position = o.position;
      this.reset_velocity();
      this.teleport_to(o.position);
    }
    this.change_room(o.room_id ?? MAP.computed?.shape_map.start.options.room_connections?.[0] ?? "", true);
    this.target.vz = 0;
    if (o.checkpoint) this.checkpoint = vector3.clone(o.checkpoint);
    if (o.checkpoint_room) this.checkpoint_room = o.checkpoint_room;
    if (o.fov_mult) this.fov_mult = o.fov_mult;
    if (this.health && o.health) this.health.value = o.health;
    if (this.ability && o.ability) this.ability.value = o.ability;
    // o.current_gun = "basic"; o.guns = ["basic"];
    if (o.guns) this.guns = o.guns;
    if (o.current_gun) {
      this.current_gun = o.current_gun;
      this.remake_shoot();
    }
    if (o.xp) {
      this.xp = 0;
      this.add_xp(o.xp);
      ui.xp.change = 0;
    }
    if (o.stats) override_object(this.stats, o.stats);
  }

  add_xp(xp: number) {
    this.xp += xp;
    this.level = this.xp2level(this.xp);
    ui.xp.add(xp);
  }

  xp2level(xp: number) {
    return Math.floor((Math.sqrt(xp * 8 / config.game.level_1_xp + 1) - 1) / 2); // [△] 1 + 2 + 3 + ...
  }

  level2xp(level: number) {
    return config.game.level_1_xp / 2 * level * (level + 1);
  }

  collect(o: maketype_collect) {
    if (o.restore_all_health) this.health?.heal_all();
    else if (o.restore_health) this.health?.heal(o.restore_health);
    if (o.gun) {
      if (!this.guns.includes(o.gun)) this.guns.push(o.gun);
      this.current_gun = o.gun;
      this.remake_shoot();
    }
    if (o.currency_name) {
      save.add_currency(o.currency_name, o.currency_amount);
      ui.collect.add(o.currency_name, o.currency_amount);
    }
  }

  set_checkpoint(position: vector3, room_id?: string) {
    this.checkpoint = vector3.clone(position);
    this.checkpoint_room = room_id ?? this.room_id;
  }

  set_checkpoint_to_thing(thing: Thing, shape_position: boolean = false) {
    this.checkpoint = shape_position ? vector3.create2(vector.add(thing.position, vector.mean(thing.shapes[0].vertices)), thing.z) : thing.position;
    this.checkpoint_room = thing.room_id;
  }

  change_room(room_id: string, force: boolean = false) {
    if (!room_id || (!force && this.room_id === room_id)) return;
    const old_room_id = this.room_id;
    this.room_id = room_id;
    this.set_rooms(this.connected_rooms(1), this.connected_rooms(2));
    if (old_room_id !== (MAP.computed?.shape_map.start.options.room_connections?.[0] ?? "") && !this.room_list.includes(old_room_id)) {
      console.log(this.room_list);
      console.warn("[player/change_room] warning! player room list doesn't include the previous room id: " + old_room_id);
    }
  }

  connected_rooms(depth: number = 1, room_id?: string): string[] {
    if (!room_id) room_id = this.room_id;
    if (depth <= 0) return [room_id];
    const result: string[] = [];
    result.push(room_id);
    for (const id of (MAP.computed?.shape_map[room_id]?.options.room_connections ?? [])) {
      const new_depth = id.startsWith("station") ? depth - 0.5 : depth - 1;
      for (const i of this.connected_rooms(new_depth, id)) {
        if (result.includes(i)) continue;
        result.push(i);
      }
    }
    return result;
  }

  set_rooms(add_rooms: string[], dont_remove_rooms: string[] = add_rooms) {
    for (const room_id of add_rooms) {
      if (!this.room_list.includes(room_id)) this.load_room(room_id);
    }
    for (const room_id of shallow_clone_array(this.room_list)) {
      if (!dont_remove_rooms.includes(room_id)) this.unload_room(room_id);
    }
  }

  load_room(room_id: string) {
    // console.log("loading room " + room_id);
    for (const id of MAP.computed?.room_map[room_id] ?? []) {
      const s = MAP.computed?.shape_map[id];
      if (s && !s.options.map_parent) make_from_map_shape(s);
    }
    this.room_list.push(room_id);
  }

  unload_room(room_id: string) {
    // console.log("unloading room " + room_id);
    for (const spawner of shallow_clone_array(Spawner.spawners_rooms[room_id] ?? [])) {
      spawner.remove();
    }
    for (const thing of shallow_clone_array(Thing.things_rooms[room_id] ?? [])) {
      thing.remove();
    }
    this.room_list.remove(room_id);
  }

  reload_room(room_id: string) {
    this.unload_room(room_id);
    this.load_room(room_id);
  }

  unload_all_rooms() {
    for (const room_id of shallow_clone_array(this.room_list)) {
      this.unload_room(room_id);
    }
  }

  reload_all_rooms() {
    // console.log("reloading all rooms");
    for (const room_id of shallow_clone_array(this.room_list)) {
      this.reload_room(room_id);
    }
  }

  old_map_ids: string[] = [];

  activate_map() {
    this.map_offset = vector.create();
    this.map_scale = 1;
    this.old_map_ids = [];
    for (const thing of shallow_clone_array(Thing.things ?? [])) {
      if (thing.options.is_map) {
        player.old_map_ids.push(thing.id);
        thing.remove();
      }
    }
    for (const s of MAP.shapes ?? []) {
      if (!s.options.is_map) continue;
      if (Thing.things_lookup[s.id]) continue;
      if (save.check_map(s.options.map_parent ?? s.id)) {
        if (s.options.map_hide_when && save.check_map(s.options.map_hide_when)) continue;
        const t = make_from_map_shape(s);
        if (t) t.z = this.z;
      } else {
        // haven't visited yet
      }
    }
  }

  deactivate_map() {
    for (const thing of shallow_clone_array(Thing.things ?? [])) {
      if (thing.options.is_map) thing.remove();
    }
    for (const id of player.old_map_ids) {
      const s = MAP.computed?.shape_map[id];
      if (s) make_from_map_shape(s);
    }
  }

};

export const player = new Player();