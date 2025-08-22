import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { maketype_health } from "./make.js";
import type { Player } from "./player.js";
import { Thing } from "./thing.js";


export class Health {

  thing: Thing;

  value = 0;
  capacity = 0;
  regen = 0;
  display = 0;

  invincible = false;
  invincible_time = -1234567890; // time above which invincible should be set to false

  hit_tick = 0; // e.g. poison damage
  hit_time = -1234567890; // time last hit
  hit_clear = 0; // time from last hit to regen

  constructor(thing: Thing) {
    this.thing = thing;
  }

  get ratio() {
    return this.value / this.capacity;
  }
  get percentage() {
    return this.ratio * 100;
  }
  get display_ratio() {
    return this.display / this.capacity;
  }

  get is_zero() {
    return this.capacity > math.epsilon_smaller && this.value <= math.epsilon_smaller;
  }

  make(o: maketype_health) {
    if (o.capacity != undefined) {
      this.capacity = o.capacity;
      this.value = this.capacity;
      this.display = this.value;
    }
    if (o.value != undefined) this.value = o.value;
    if (o.regen != undefined) this.regen = o.regen;
    if (o.regen_time != undefined) this.hit_clear = o.regen_time;
    if (o.invincible != undefined) this.invincible = o.invincible;
  }

  tick() {
    this.display = math.lerp(this.display, this.value, config.graphics.health_display_smoothness);
    const time = Thing.time;
    if (this.hit_tick > math.epsilon) {
      this.hit(this.hit_tick);
    }
    if ((time - this.hit_time) > this.hit_clear && this.regen !== 0 && this.value < this.capacity) {
      // can regenerate
      this.value += this.regen;
    }
    if (this.value > this.capacity) {
      this.value = this.capacity;
    }
    if (this.invincible && time >= this.invincible_time) {
      this.invincible = false;
    }
  }

  hit(amount: number) {
    if (this.invincible) return 0;
    const old_health = this.value;
    this.value -= amount;
    this.bound();
    this.hit_time = Thing.time;
    const real_damage = old_health - this.value;
    this.thing.hit(real_damage);
    return real_damage;
  }

  hit_all() {
    this.hit(this.capacity);
  }

  heal(amount: number) {
    const old_health = this.value;
    this.value += amount;
    this.bound();
    if (this.thing.is_player) {
      const player = this.thing as Player;
      /*ui.damage_numbers.push({
        x: player.x,
        y: player.y,
        d: old_health - this.value, // negative
      });*/
    }
  }

  heal_percent(health_percent: number) {
    this.heal(this.capacity * health_percent);
  }

  heal_all() {
    this.heal(this.capacity);
  }

  bound() {
    this.value = math.bound(this.value, 0, this.capacity);
  }

  restore_all() {
    this.value = this.capacity;
  }

  set_capacity(capacity: number) {
    this.capacity = capacity;
    this.value = capacity;
  }

  set_invincible(time: number) {
    this.invincible = true;
    this.invincible_time = Thing.time + time;
  }

  use(amount: number) {
    if (this.value < amount) {
      return false;
    }
    this.value -= amount;
    return true;
  }

}