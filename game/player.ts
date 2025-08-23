import { camera } from "../util/camera.js";
import { config } from "../util/config.js";
import { keys } from "../util/key.js";
import { vector, vector3 } from "../util/vector.js";
import { filters } from "./detector.js";
import { player_save, save } from "./save.js";
import { Thing } from "./thing.js";

export class Player extends Thing {

  autoshoot = false;
  fov_mult = 1;
  autosave_time = -1;

  constructor() {
    super();

    this.is_player = true;
    this.team = 1;
    this.make("player", true);
    // this.make_shape("player_basic");

    this.create_id("player");
    this.position = vector3.create();
  }

  create_player() {
    this.create_body(this.create_body_options(filters.thing(this.team)));
    if (this.body) this.body.label = "player";
  }

  tick() {
    super.tick();
    const controls = {
      up: keys["ArrowUp"] === true || (keys["KeyW"] === true),
      down: keys["ArrowDown"] === true || (keys["KeyS"] === true),
      left: keys["ArrowLeft"] === true || (keys["KeyA"] === true),
      right: keys["ArrowRight"] === true || (keys["KeyD"] === true),
      toggle_autoshoot: keys["KeyF"] === true,
      shoot: keys["Mouse"] === true || (keys["Space"] === true),
      rshoot: keys["MouseRight"] === true || ((keys["ShiftLeft"] === true || keys["ShiftRight"] === true)),
      facingx: Math.floor(camera.mouse_v.x),
      facingy: Math.floor(camera.mouse_v.y),
      exit: (keys["KeyP"] === true),
    };
    this.target.facing = vector.add(vector.sub(camera.mouse_v, camera.world2screen(this.position)), this.position);
    const move_x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const move_y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
    const move_v = vector.normalise(vector.create(move_x, move_y));
    if (this.body) {
      this.push_by(vector.mult(move_v, this.options.move_speed ?? config.physics.player_speed));
      this.update_angle();
    }
    if (controls.toggle_autoshoot) {
      this.autoshoot = !this.autoshoot;
    }
    if (controls.shoot || this.autoshoot) {
      this.shoot();
    }
    if (Thing.time >= this.autosave_time) {
      if (this.autosave_time < 0) this.autosave_time = Thing.time + config.game.autosave_interval;
      else this.save();
    }
  }

  hit(damage: number) {
    super.hit(damage);
    if (damage > 0) this.health?.set_invincible(config.game.invincibility_time);
  }

  camera_position() {
    return vector.add(this.position, vector.mult(camera.mouse_v, 1 / 30 * camera.scale));
    // todo remove
    // let v = vector.sub(this.target.facing, camera.world2screen(this.position));
    // v = vector.normalise(v, vector.length(v) / 30 * camera.scale);
    // return vector.add(this.position, v);
  }

  camera_scale() {
    const v = camera.halfscreen;
    return Math.sqrt(v.x * v.y) / 500 / this.fov_mult;
  }

  remake_shoot(shoot_id: string) {
    this.make_shape("player", true);
    this.make_shape("player_" + shoot_id);
  }

  save(): player_save {
    this.autosave_time = Thing.time + config.game.autosave_interval;
    const o = {
      position: this.position,
      fov_mult: this.fov_mult,
      health: this.health?.value ?? 0,
      ability: this.ability?.value ?? 0,
    } as player_save;
    if (this.shoots.length > 0) o.shoots = ["basic"];
    save.save.player = o;
    save.changed();
    return o;
  }

  load(o: player_save) {
    if (o.position) {
      this.position = o.position;
      this.teleport_to(o.position);
    }
    if (o.fov_mult) this.fov_mult = o.fov_mult;
    if (this.health && o.health) this.health.value = o.health;
    if (this.ability && o.ability) this.ability.value = o.ability;
    // this.make("player", true);
    if (o.shoots) {
      this.remake_shoot(o.shoots[0]);
    }
  }

};

export const player: Player = new Player();