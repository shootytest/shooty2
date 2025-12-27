import { STYLES } from "../util/color.js";
import { style_type } from "../util/map_type.js";
import { vector, vector3_ } from "../util/vector.js";
import { enemy_spawn } from "./enemy.js";

import load_bullets from "../make/bullets.js";
import load_collects from "../make/collects.js";
import load_deco from "../make/deco.js";
import load_enemies from "../make/enemies.js";
import load_env from "../make/env.js";
import load_items from "../make/items.js";
import load_players from "../make/players.js";
import load_shoots from "../make/shoots.js";



// types

export interface maketype {

  make_parent?: string[];

  // display options
  style?: keyof typeof STYLES;
  style_?: style_type; // consider renaming to style_override (not really)
  force_layer?: number;

  // game booleans
  decoration?: boolean; // this won't add a physics object
  floor?: boolean; // a floor the player can stand on
  safe_floor?: boolean; // save player position when on this floor
  sensor?: boolean; // invisible physics sensor (covers all z values)
  invisible?: boolean; // invisible shape
  movable?: boolean; // dynamic physics object
  draggable?: boolean; // draggable using the mouse
  seethrough?: boolean; // visibility
  keep_bullets?: boolean; // don't delete bullets if they collide
  switch?: boolean;
  switch_enemy?: boolean; // switches that enemies can also hit
  checkpoint?: boolean;
  cover_z?: boolean; // override cover z
  wall_filter?: wall_filter_type; // none (not a wall) / normal wall (nothing can pass) / window (players can't pass but bullets can) / curtain (bullets can't pass but players can)
  wall_team?: number; // team the wall lets through

  shoots?: string[];

  damage?: number;
  team?: number;
  health?: maketype_health;
  ability?: maketype_health;
  hide_health?: boolean;
  hide_health_until?: number; // use with hide_health for fake walls
  shield?: maketype_health;
  hide_shield?: boolean;
  translucent?: number;
  translucent_color?: string;

  // physics stuff
  angle?: number;
  friction?: number;
  friction_contact?: number;
  restitution?: number;
  density?: number;
  force_wall_body?: boolean;
  force_max_z?: boolean;

  // enemy stuff
  breakable?: boolean;
  behaviour?: { [key: string]: maketype_behaviour | maketype_behaviour[] };
  enemy_detect_range?: number;
  enemy_safe?: boolean;
  focus_camera?: boolean;
  zzz_sleeping?: boolean;
  repel_force?: number;
  repel_range?: number;
  repel_angles?: [number, number][];

  // special drops
  xp?: number;
  death?: bullet_death_type[];
  collectible?: maketype_collect;

  // shapey stuff
  shapey?: boolean;

};

export type shoot_mode = "none" | "normal" | "single" | "burst";
export type move_mode = "none" | "static" | "hover" | "direct" | "spiral" | "wander";
export type face_mode = "none" | "static" | "predict" | "predict2" | "direct" | "spin" | "wander";
export type wall_filter_type = "none" | "wall" | "window" | "curtain";

export interface maketype_behaviour {

  chance?: number;
  time?: number;

  shoot_mode?: shoot_mode;
  shoot_index?: number | number[];
  shoot_cooldown?: number;
  shoot_single_limit?: number;

  face_mode?: face_mode;
  face_smoothness?: number;
  face_predict_amount?: number;
  spin_speed?: number;

  move_mode?: move_mode;
  move_hover_distance?: number;
  move_speed?: number;

  wander_time?: number;
  wander_distance?: number;
  wander_cooldown?: number;

};

export interface maketype_health {
  value?: number;
  capacity?: number;
  regen?: number;
  regen_time?: number;
  invincible?: boolean;
};

export interface maketype_collect {
  currency_name?: string;
  currency_amount?: number;
  gun?: string;
  allow_bullet_collect?: boolean;
  restore_health?: number;
  restore_all_health?: boolean;
  shapey?: string;
};

export interface maketype_shape {

  // the shape itself
  type: "circle" | "arc" | "polygon" | "line" | "polyline" | "none";
  style?: keyof typeof STYLES;
  style_?: style_type;
  z?: number;
  sides?: number;
  radius?: number;
  angle?: number;
  offset?: vector;
  scale?: vector;
  v1?: vector; // for lines
  v2?: vector;
  vs?: vector[]; // for polylines
  open_loop?: boolean;
  arc_start?: number; // for arcs
  arc_end?: number;

  // affects display
  force_layer?: number;
  filter?: string; // use sparingly
  blinking?: boolean;
  glowing?: number;
  highlight?: number;
  highlight_color?: string;
  clip?: maketype_shape_clip;

  // affects gameplay
  shoot?: string;
  shoot_?: shoot_stats;
  floor?: boolean;
  safe_floor?: boolean;
  is_map?: boolean;
  shapey_area?: boolean;

};

export interface maketype_shape_clip {
  shape: "circle";
  timing: "fixed" | "bullet";
  start: number;
  end: number;
};

export interface shoot_stats {
  parent?: string[];
  mult?: string[];
  mods?: bullet_mod[];
  make?: string;
  size?: number;
  spread_size?: number;
  random_size?: number;
  reload?: number;
  duration_reload?: number;
  speed?: number;
  spread_speed?: number;
  random_speed?: number;
  angular_speed?: number;
  spread_angular_speed?: number;
  random_angular_speed?: number;
  angle?: number;
  spread_angle?: number;
  random_angle?: number;
  damage?: number;
  health?: number;
  time?: number;
  friction?: number;
  restitution?: number;
  density?: number;
  recoil?: number;
  delay?: number;
  offset?: vector3_;
  target_type?: string;
  boost_mult?: number;
  detect_range_mult?: number;
  move?: boolean;
  always_shoot?: boolean;
  death?: bullet_death_type[];
  style?: string;
  style_?: style_type;
};

export interface bullet_death_type {
  type: string;
  stats?: shoot_stats;
  stats_mult?: shoot_stats;
  angle?: number;
  offset?: vector;
  repeat?: number;
  angle_increment?: number;
  offset_increment?: vector;
};

export interface bullet_mod {
  stats: shoot_stats;
  id?: string;
  period?: number;
  chance?: number;
  chance_increment?: number;
  calc?: {
    number: number;
    stats: shoot_stats;
    period?: number;
    chance?: number;
  };
};


// waves

export interface maketype_wave {
  rounds: maketype_wave_round[];
};

export interface maketype_wave_round {
  enemies: maketype_wave_enemy[];
};

export interface maketype_wave_enemy extends enemy_spawn {
  // enemy_spawn for reference
  // type: string;
  // delay?: number;
  // repeat?: number;
  // repeat_delay?: number;
  spawner?: number | string; // index or id both accepted
};


// make

export const make: { [key: string]: maketype } = {};
export const make_: { [key: string]: maketype } = {};

export const make_shapes: { [key: string]: maketype_shape[] } = {};

export const make_shoot: { [key: string]: shoot_stats } = {};


// default

make.default = { };


// any order should work

load_env();
load_deco();
load_players();
load_bullets();
load_enemies();
load_collects();
load_items();
load_shoots();



const calculated_keys: string[] = ["default"];
const calculated_shoot_keys: string[] = [];


// clone functions

export type dictionary = { [key: string]: any };

export const shallow_clone_array = function<T>(arr: T[]): T[] {
  const result: T[] = [];
  for (const a of arr) result.push(a);
  return result;
};

export const clone_object = function(obj: dictionary) {
  const result: dictionary = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      result[k] = [];
      for (const a of v) result[k].push(typeof a === "object" && !Array.isArray(a) ? clone_object(a) : a);
    } else if (typeof v === "object") {
      result[k] = clone_object(v);
    } else {
      result[k] = v;
    }
  }
  return result;
};


export const override_object = function(m_target: dictionary, m_override: dictionary) {
  for (const [k, v] of Object.entries(m_override)) {
    if (Array.isArray(v)) {
      if (m_target[k] == undefined) m_target[k] = [];
      for (const [i, a] of v.entries()) {
        const is_object = typeof a === "object" && !Array.isArray(a);
        if (i >= m_target[k].length) m_target[k].push(is_object ? clone_object(a) : a);
        else if (is_object) override_object(m_target[k][i], a);
        else m_target[k][i] = a;
      }
    } else if (typeof v === "object") {
      if (m_target[k] == undefined) m_target[k] = {};
      override_object(m_target[k], v);
    } else {
      m_target[k] = v;
    }
  }
};

export const multiply_object = function(o_target: dictionary, o_multiply: dictionary) {
  for (const [k, v] of Object.entries(o_multiply)) {
    if (typeof v !== "number") continue;
    if (o_target[k] == undefined) continue;
    o_target[k] *= v;
  }
};

export const multiply_and_override_object = function(m_target: dictionary, m_override: dictionary) {
  for (const [k, v] of Object.entries(m_override)) {
    if (typeof v === "number") {
      m_target[k] = (m_target[k] ?? 1) * v;
    } else if (Array.isArray(v)) {
      if (m_target[k] == undefined) m_target[k] = [];
      for (const [i, a] of v.entries()) {
        if (i >= m_target[k].length) m_target[k].push(typeof a === "object" ? clone_object(a) : a);
        else if (typeof a === "object" && !Array.isArray(a)) override_object(m_target[k][i], a);
        else m_target[k][i] = a;
      }
    } else if (typeof v === "object") {
      if (m_target[k] == undefined) m_target[k] = {};
      override_object(m_target[k], v);
    } else {
      m_target[k] = v;
    }
  }
};


const calculate_make = function(key: string) {
  const m = make[key];
  const result: maketype = {};
  let first_one = true;
  for (const parent_key of m.make_parent ?? []) {
    if (make[parent_key]) {
      if (!calculated_keys.includes(parent_key)) calculate_make(parent_key);
      override_object(result, first_one ? make[parent_key] : make_[parent_key]);
      if (parent_key !== "default") first_one = false;
    } else console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
  }
  override_object(result, m);
  make[key] = result;
  calculated_keys.push(key);
};

// copy make to make_
for (const k of Object.keys(make)) {
  make_[k] = {};
  override_object(make_[k], make[k]);
}

for (const k of Object.keys(make)) {
  calculate_make(k);
}


const calculate_make_shoot = function(key: string) {
  const m = make_shoot[key];
  const result: shoot_stats = {};
  for (const parent_key of m.parent ?? []) {
    if (make_shoot[parent_key]) {
      if (!calculated_shoot_keys.includes(parent_key)) calculate_make_shoot(parent_key);
      override_object(result, make_shoot[parent_key]);
    } else console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
  }
  for (const mult_key of m.mult ?? []) {
    if (make_shoot[mult_key]) {
      if (!calculated_shoot_keys.includes(mult_key)) calculate_make_shoot(mult_key);
      multiply_object(result, make_shoot[mult_key]);
    } else console.error(`[make] while computing '${key}': make_shoot '${mult_key}' doesn't exist!`);
  }
  override_object(result, m);
  make_shoot[key] = result;
  calculated_shoot_keys.push(key);
};

for (const k of Object.keys(make_shoot)) {
  calculate_make_shoot(k);
}


// debug
// console.log(make);
// console.log(make_shapes);
// console.log(make_shoot);
// must import
// console.log(make_rooms);
// console.log(make_waves);
// console.log(make_data);