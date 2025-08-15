import { Vector } from "../matter.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3_ } from "../util/vector.js";
import { filters } from "./detector.js";
import { Shape } from "./shape.js";
import { Thing } from "./thing.js";


export class Shoot {

  thing: Thing;
  shape?: Shape;
  index: number = -1;

  active = false;
  time = 0;
  duration = 0;
  duration_time = 0;
  delay = 0;
  offset: vector3_ = vector.create();

  bullets: Thing[] = [];

  stats: shoot_stats;

  constructor(thing: Thing, stats: shoot_stats = {}, shape?: Shape) {
    this.thing = thing;
    this.shape = shape;
    if (this.shape) this.shape.activate_scale = true;
    this.stats = stats;
  }

  set_stats(new_stats: shoot_stats) {
    for (const [k, v] of Object.entries(new_stats)) {
      (this.stats as any)[k] = v;
    }
  }

  tick() {
    if (this.time < (this.stats.reload ?? 0)) {
      this.time++;
      if (this.shape) {
        const ratio = math.bound(this.time / (this.stats.reload ?? 1), 0, 1);
        this.shape.scale = vector.create(ratio, ratio);
      }
    }
  }

  shoot() {
    const S = this.stats;
    const reload = S.reload ?? 0;
    while (reload != undefined && this.time >= reload) {
      this.shoot_bullet();
      this.time -= reload;
    }
  }

  shoot_bullet() {

    if (this.thing.body == undefined) return;

    const S = this.stats;

    const position: vector = vector.add(this.thing.position, Vector.rotate(vector.create((this.offset.x || 0), (this.offset.y || 0)), this.thing.angle));
    const bullet = new Thing();
    bullet.position = position;
    bullet.is_bullet = true;
    bullet.options = {
      seethrough: true,
      movable: true,
    };

    const angle = math.randgauss(this.thing.angle + (vector.deg_to_rad(S.angle ?? 0)), S.spread ?? 0);
    const spreadv = S.spread_speed ?? 0;
    let speed = spreadv === 0 ? (S.speed ?? 0) : math.randgauss(S.speed ?? 0, spreadv);
    const thing_velocity = Vector.rotate(this.thing.velocity, -angle).x;
    if (speed !== 0) speed += thing_velocity * config.physics.velocity_shoot_boost * (S.boost_mult ?? 1);
    bullet.velocity = vector.createpolar(angle, speed);
    bullet.angle = angle;
    bullet.bullet_time = Thing.time + (S.time ?? 200);
    bullet.target.facing = vector.clone(this.thing.target.facing);
    this.bullets.push(bullet);

    const s = Shape.circle(bullet, S.size ?? 0);
    s.thing = bullet;
    s.seethrough = true;
    s.style.stroke = "#eeeeee";
    bullet.shapes.push(s);

    bullet.create_body({
      isStatic: false,
      frictionAir: S.friction ?? 0,
      restitution: 0,
      collisionFilter: filters.player_bullet,
    });

    if (S.recoil !== 0 && speed && S.speed) {
      let recoil = (S.recoil == undefined) ? 1 : S.recoil;
      recoil *= speed * (bullet.body?.mass || 0) * config.physics.force_factor * config.physics.recoil_factor;
      this.thing.push_in_direction(angle, -recoil);
    }
  }

  remove_bullet(bullet: Thing) {
    const index = this.bullets.indexOf(bullet);
    if (index >= 0) {
      this.bullets.splice(index, 1);
    }
  }

};


export type shoot_stats = {
  parent?: string[];
  type?: string;
  size?: number;
  reload?: number;
  duration_reload?: number;
  speed?: number;
  angle?: number;
  spread?: number;
  spread_size?: number;
  spread_speed?: number;
  damage?: number;
  health?: number;
  time?: number;
  friction?: number;
  recoil?: number;
  delay?: number;
  offset?: vector3_;
  target_type?: string;
  boost_mult?: number;
  move?: boolean;
  always_shoot?: boolean;
};