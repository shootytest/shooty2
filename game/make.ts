import { style_type } from "../util/map_type.js";
import { vector, vector3_ } from "../util/vector.js";


// types

export interface maketype {

  make_parent?: string[];

  // display options
  style?: string;
  style_?: style_type; // consider renaming to style_override (not really)
  
  // game booleans
  decoration?: boolean; // this won't add a physics object
  sensor?: boolean; // invisible physics sensor
  invisible?: boolean; // invisible shape
  movable?: boolean; // dynamic physics object
  seethrough?: boolean; // visibility
  keep_bullets?: boolean; // don't delete bullets if they collide
  wall_filter?: wall_filter_type; // normal wall (nothing can pass) / window (players can't pass but bullets can) / curtain (bullets can't pass but players can)
  switch?: boolean;
  collectible?: maketype_collect;

  shoots?: string[];

  damage?: number;
  team?: number;
  health?: maketype_health;
  ability?: maketype_health;
  hide_health?: boolean;
  hide_health_until?: number;

  // physics stuff
  angle?: number;
  friction?: number;
  friction_contact?: number;
  restitution?: number;
  density?: number;

  // enemy stuff
  breakable?: boolean;
  shoot_mode?: shoot_mode;
  move_mode?: move_mode;
  face_mode?: face_mode;
  shoot_mode_idle?: shoot_mode;
  move_mode_idle?: move_mode;
  face_mode_idle?: face_mode;
  face_predict_amount?: number;
  move_hover_distance?: number;
  move_speed?: number;
  spin_speed?: number;
  face_smoothness?: number;
  enemy_detect_range?: number;
  focus_camera?: boolean;
  focus_camera_range?: number;
  death?: bullet_death_type[];

};

export type shoot_mode = "none" | "normal" | "always";
export type move_mode = "none" | "static" | "hover" | "direct" | "spiral" | "circle";
export type face_mode = "none" | "static" | "predict" | "predict2" | "direct" | "spin";
export type wall_filter_type = "wall" | "window" | "curtain";
// not to be confused with typeface

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
  restore_health?: boolean;
};

export interface maketype_shape {

  type: "circle" | "polygon" | "line";
  style?: string;
  style_?: style_type;
  z?: number;
  sides?: number;
  radius?: number;
  angle?: number;
  offset?: vector;
  scale?: vector;
  v1?: vector;
  v2?: vector;
  blinking?: boolean;
  glowing?: number;
  shoot?: string;
  shoot_?: shoot_stats;

};

export interface shoot_stats {
  parent?: string[];
  mult?: string[];
  make?: string;
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
  restitution?: number;
  density?: number;
  recoil?: number;
  delay?: number;
  offset?: vector3_;
  target_type?: string;
  boost_mult?: number;
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


export type dictionary = { [key: string]: any };


// make

export const make: { [key: string]: maketype } = {};
export const make_: { [key: string]: maketype } = {};

export const make_shapes: { [key: string]: maketype_shape[] } = {};

export const make_shoot: { [key: string]: shoot_stats } = {};


// @default

make.default = { };



// @environment

// @walls

make.wall = {
  wall_filter: "wall",
};

make.wall_tutorial = {
  make_parent: ["wall"],
  style: "tutorial",
};

make.wall_tutorial_window = {
  // make_parent: ["wall_tutorial"], // hmmm it's not needed for now
  style: "tutorial_window",
  wall_filter: "window",
  keep_bullets: true,
  seethrough: true,
};

make.wall_tutorial_curtain = {
  style: "tutorial_curtain",
  wall_filter: "curtain",
  seethrough: true,
};

make.wall_tutorial_rock = {
  make_parent: ["wall_tutorial"],
  style: "tutorial_filled",
  keep_bullets: true,
};

make.wall_tutorial_spike = {
  make_parent: ["wall_tutorial"],
  style: "tutorial_spike",
  keep_bullets: false,
  seethrough: true,
  damage: 100,
};

make.wall_tutorial_rock_breakable = {
  make_parent: ["wall_tutorial"],
  hide_health: true,
  team: 7,
  health: {
    capacity: 500,
  },
};

make.wall_tutorial_fake = {
  make_parent: ["wall"],
  style: "tutorial",
  style_: {
    opacity: 0.65,
  },
  hide_health: true,
  hide_health_until: 450,
  health: {
    capacity: 700,
  },
};

// @floors

make.floor = {
  decoration: true,
  seethrough: true,
  keep_bullets: true,
};

make.floor_tutorial = {
  make_parent: ["floor"],
  style: "tutorial_floor",
};

// @sensors

make.sensor = {
  style: "sensor",
  sensor: true,
  invisible: true,
  seethrough: true,
  keep_bullets: true,
};

make.switch = {
  style: "switch",
  team: 0, // "team: 1" keeps bullets...
  switch: true,
  seethrough: true,
  restitution: 0,
};
make_shapes.switch = [{
  type: "circle",
  radius: 15,
}];

make.sensor_path = {
  style: "sensor_path",
  decoration: true,
  invisible: true,
  seethrough: true,
  keep_bullets: true,
};

// @decorations

make.icon = {
  decoration: true,
  seethrough: true,
};

make.icon_tutorial = {
  make_parent: ["icon"],
  style: "tutorial",
};

make.deco = {
  decoration: true,
  seethrough: true,
};

make.deco_gun_basic = {
  make_parent: ["deco"],
  style: "collect_gun",
  style_: {
    stroke_opacity: 0.3,
    fill_opacity: 0,
  }
};
make_shapes.deco_gun_basic = [];
for (let i = 0; i < 10; i++) {
  make_shapes.deco_gun_basic.push({
    type: "polygon",
    sides: 7,
    angle: 0.175 * i,
    radius: 330 - i * 30,
    z: -0.5 + i * 0.05,
  });
}





// @player

make.player = {
  style: "player",
  movable: true,
  seethrough: true,
  damage: 0,
  team: 1,
  friction: 0.2,
  friction_contact: 0,
  restitution: 0.1,
  move_speed: 10,
  health: {
    capacity: 500,
    regen: 0,
    regen_time: 0,
  },
};
make_shapes.player = [{
  type: "circle",
  radius: 31,
}];

make_shapes.player_basic = [{
  type: "line",
  v2: vector.createpolar_deg(0, 30),
  shoot: "player_basic",
}];





// @enemies

make.enemy = {
  movable: true,
  seethrough: true,
  friction: 0.1,
  restitution: 0,
};

make.enemy_breakable = {
  make_parent: ["enemy"],
  breakable: true,
  friction: 1,
  restitution: 0,
  density: 1000,
  health: {
    capacity: 0.1,
  },
};

make.enemy_tutorial = {
  make_parent: ["enemy"],
  style: "tutorial_enemy",
  team: 7,
};

make.enemy_tutorial_block = {
  make_parent: ["enemy_tutorial"],
  style: "tutorial_enemy_coin",
  movable: false,
  seethrough: false,
  angle: 0,
  health: {
    capacity: 500,
  },
  death: [
    { type: "collect_coin", stats: { make: "collect_coin_1", speed: 1.5 }, repeat: 6, angle_increment: 60 },
  ],
};
make_shapes.enemy_tutorial_block = [{
  type: "polygon",
  sides: 7,
  radius: 50,
}];

make.enemy_tutorial_rocky = {
  make_parent: ["enemy_tutorial"],
  movable: false,
  style: "tutorial_enemy_coin",
  health: {
    capacity: 400,
  },
  death: [
    { type: "collect_coin", stats: { make: "collect_coin_1", speed: 2 }, repeat: 5, angle_increment: 72 },
    { type: "collect_coin", stats: { make: "collect_coin_5", speed: 0 }, repeat: 1 },
  ],
};
make_shapes.enemy_tutorial_rocky = [{
  type: "polygon",
  sides: 7,
  radius: 50,
  glowing: 0.1,
}, {
  type: "polygon",
  style: "coin_rock",
  sides: 7,
  radius: 25,
  glowing: 0.5,
}];

make.enemy_tutorial_rock_room4 = {
  make_parent: ["enemy_tutorial"],
  movable: false,
  seethrough: false,
  angle: 0,
  health: {
    capacity: 3000,
    value: 300,
  },
};
make_shapes.enemy_tutorial_rock_room4 = [{
  type: "polygon",
  sides: 7,
  radius: 50,
}];

make.enemy_tutorial_4way = {
  make_parent: ["enemy_tutorial"],
  movable: false,
  shoot_mode: "normal",
  shoot_mode_idle: "normal",
  move_mode: "static",
  face_mode: "static",
  angle: -360 / 14,
  enemy_detect_range: 400,
  focus_camera: true,
  health: {
    capacity: 750,
  },
};
make_shapes.enemy_tutorial_4way = [{
  type: "polygon",
  sides: 7,
  radius: 70,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 70),
  shoot: "enemy_4way",
}, {
  type: "line",
  v2: vector.createpolar_deg(6 * 360 / 7, 70),
  shoot: "enemy_4way",
  shoot_: { angle: 6 * 360 / 7 },
}, {
  type: "line",
  v2: vector.createpolar_deg(5 * 360 / 7, 70),
  shoot: "enemy_4way",
  shoot_: { angle: 5 * 360 / 7 },
}, {
  type: "line",
  v2: vector.createpolar_deg(4 * 360 / 7, 70),
  shoot: "enemy_4way",
  shoot_: { angle: 4 * 360 / 7 },
}];

make.enemy_tutorial_easy = {
  make_parent: ["enemy_tutorial"],
  shoot_mode: "normal",
  move_mode: "direct",
  face_mode: "direct",
  move_speed: 3,
  enemy_detect_range: 500,
  health: {
    capacity: 250,
  },
  death: [
    { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread: -1 }, repeat: 2 },
  ],
};
make_shapes.enemy_tutorial_easy = [{
  type: "polygon",
  sides: 7,
  radius: 35,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 35),
  shoot: "enemy_easy",
}];

make.enemy_tutorial_bit = {
  make_parent: ["enemy_tutorial", "enemy_breakable"],
  face_mode_idle: "spin",
  move_mode_idle: "circle",
  enemy_detect_range: 0,
  style: "tutorial_breakable",
  style_: {
    opacity: 0.6,
  },
};
make_shapes.enemy_tutorial_bit = [{
  type: "polygon",
  sides: 7,
  radius: 10,
}];

make.enemy_tutorial_down = {
  make_parent: ["enemy_tutorial"],
  style: "tutorial",
  movable: false,
  shoot_mode: "normal",
  move_mode: "static",
  face_mode: "static",
  angle: 110,
  enemy_detect_range: 300,
};
make_shapes.enemy_tutorial_down = [{
  type: "polygon",
  sides: 7,
  radius: 50,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 50),
  shoot: "enemy_block",
}];

make.enemy_tutorial_boss = {
  make_parent: ["enemy_tutorial"],
  shoot_mode: "normal",
  move_mode: "static",
  face_mode: "predict2",
  // face_predict_amount: 0.7,
  movable: false,
  enemy_detect_range: 0,
  focus_camera: true,
  health: {
    capacity: 10000,
  },
  death: [
    { type: "collect_coin", stats: { make: "collect_coin_10", speed: 5 }, repeat: 36, angle_increment: 10 },
  ],
};
make_shapes.enemy_tutorial_boss = [{
  type: "polygon",
  sides: 7,
  radius: 150,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 150),
  shoot: "enemy_tutorial_boss",
}, {
  type: "line",
  style: "tutorial_boss",
  v2: vector.createpolar_deg(-360/14, 136),
  shoot: "enemy_tutorial_boss_split",
  shoot_: { delay: 0.5, angle: -360/14, },
}, {
  type: "line",
  style: "tutorial_boss",
  v2: vector.createpolar_deg(360/14, 136),
  shoot: "enemy_tutorial_boss_split",
  shoot_: { delay: 0.5, angle: 360/14, },
}];





// @bullets

make.bullet = {
  movable: true,
  seethrough: true,
};

make.bullet_homing = {
  make_parent: ["bullet"],
  move_mode: "direct",
  face_mode: "direct",
  move_speed: 5,
  enemy_detect_range: 1000,
};





// @collectibles

make.collect = {
  seethrough: true,
};

make.collect_coin = {
  make_parent: ["collect"],
  style: "collect_coin",
  movable: true,
  keep_bullets: true,
  team: -1,
  face_mode: "direct",
  move_mode: "direct",
  move_speed: 4.5,
  enemy_detect_range: 300,
};

make.collect_coin_1 = {
  make_parent: ["collect_coin"],
  collectible: {
    currency_name: "coin",
    currency_amount: 1,
  },
};
make_shapes.collect_coin_1 = [{
  type: "circle",
  radius: 4,
}];

make.collect_coin_5 = {
  make_parent: ["collect_coin"],
  collectible: {
    currency_name: "coin",
    currency_amount: 5,
  },
};
make_shapes.collect_coin_5 = [{
  type: "circle",
  radius: 7,
}];

make.collect_coin_10 = {
  make_parent: ["collect_coin"],
  collectible: {
    currency_name: "coin",
    currency_amount: 10,
  },
};
make_shapes.collect_coin_10 = [{
  type: "circle",
  radius: 8,
}];

make.collect_gun = {
  make_parent: ["collect"],
  style: "collect_gun",
  movable: false,
};

make.collect_gun_basic = {
  make_parent: ["collect_gun"],
  face_mode_idle: "spin",
  spin_speed: 0.02,
  enemy_detect_range: 0,
  collectible: {
    gun: "basic",
    restore_health: true,
  },
};
make_shapes.collect_gun_basic = [{
  type: "circle",
  radius: 30,
  glowing: 0.1,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 30),
}];





// @shoots

make_shoot.player = {
  make: "bullet",
  size: 9,
  reload: 30,
  speed: 8,
  spread: 0.03,
  friction: 0.0025,
  restitution: 1,
  recoil: 1,
  damage: 100,
  time: 50,
};

make_shoot.half_reload = {
  reload: 0.5,
};

make_shoot.player_basic = {
  parent: ["player"],
};

make_shoot.collect_coin = {
  speed: 2.5,
  spread: 0.03,
  spread_speed: 0.1,
  friction: 0.06,
};

make_shoot.enemy = {
  make: "bullet",
  size: 10,
  reload: 25,
  speed: 8,
  friction: 0,
  restitution: 1,
  recoil: 1,
  damage: 100,
  time: 60,
};

make_shoot.enemy_easy = {
  parent: ["enemy"],
  size: 11,
  spread: 0.05,
  reload: 70,
  speed: 4,
  time: 120,
};

make_shoot.enemy_block = {
  parent: ["enemy"],
  size: 13,
  spread: 0,
  reload: 3,
  speed: 10,
  time: 100,
  density: 999999,
  damage: 0,
};

make_shoot.enemy_4way = {
  parent: ["enemy"],
  size: 12,
  reload: 60,
  speed: 4,
  recoil: 0,
  time: 100,
};

make_shoot.enemy_tutorial_boss = {
  parent: ["enemy"],
  size: 17,
  reload: 20,
  speed: 10,
  spread: 0.06,
  damage: 200,
  time: 500,
  death: [{
    type: "enemy_tutorial_boss",
    stats: { make: "bullet_homing", death: [{type: "none"}], speed: 15, friction: 0.06, time: 120, damage: 200, },
    repeat: 1,
    angle: 180,
    offset: vector.create(0, -10),
  }],
};

make_shoot.enemy_tutorial_boss_split = {
  parent: ["enemy"],
  style: "tutorial_boss",
  size: 24,
  reload: 20,
  speed: 20,
  spread: 0.1,
  damage: 200,
  time: 50,
  friction: 0.05,
  death: [{ type: "enemy_tutorial_boss_splitted", repeat: 7, angle_increment: 360/7, }],
};

make_shoot.enemy_tutorial_boss_splitted = {
  parent: ["enemy"],
  size: 10,
  speed: 20,
  spread: 0.04,
  damage: 100,
  time: 60,
  friction: 0.05,
};



const calculated_keys: string[] = ["default"];
const calculated_shoot_keys: string[] = [];

// for (const m of Object.values(make)) {
//   if (m.make_parent == undefined) m.make_parent = ["default"];
//   else m.make_parent.unshift("default");
// }

// clone functions

export const shallow_clone_array = function(arr: any[]) {
  const result: any[] = [];
  for (const a of arr) result.push(a);
  return result;
};

export const clone_object = function(obj: dictionary) {
  const result: dictionary = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      result[k] = [];
      for (const a of v) result[k].push(typeof a === "object" ? clone_object(a) : a);
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
        if (i >= m_target[k].length) m_target[k].push(typeof a === "object" ? clone_object(a) : a);
        else if (typeof a === "object") override_object(m_target[k][i], a);
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
        else if (typeof a === "object") override_object(m_target[k][i], a);
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

/*
const calculate_make_shape = function(key: string) {
  const m = make_shape[key];
  const result: maketype_shape = {};
  for (const parent_key of m.shape_parent ?? []) {
    if (!calculated_shape_keys.includes(parent_key)) calculate_make_shape(parent_key);
    override_object(result, make_shape[parent_key]);
  }
  override_object(result, m);
  make_shape[key] = result;
  calculated_shape_keys.push(key);
};

for (const k of Object.keys(make_shape)) {
  calculate_make_shape(k);
}
*/


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