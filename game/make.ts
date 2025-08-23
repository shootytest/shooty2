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

  shoots?: string[];

  damage?: number;
  team?: number;
  health?: maketype_health;
  ability?: maketype_health;
  hide_health?: boolean;

  // physics stuff
  angle?: number;
  friction?: number;
  friction_contact?: number;
  restitution?: number;
  density?: number;

  // enemy stuff
  breakable?: boolean;
  move_type?: move_type;
  face_type?: face_type;
  move_hover_distance?: number;
  move_speed?: number;
  face_smoothness?: number;
  enemy_detect_range?: number;
  death?: bullet_death_type[];

};

export type move_type = "none" | "static" | "hover" | "direct" | "spiral";
export type face_type = "none" | "static" | "predict" | "predict2" | "direct";
export type wall_filter_type = "wall" | "window" | "curtain";
// not to be confused with typeface

export interface maketype_health {
  value?: number;
  capacity?: number;
  regen?: number;
  regen_time?: number;
  invincible?: boolean;
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

make.default = { };


// walls

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


// floors

make.floor = {
  decoration: true,
  seethrough: true,
  keep_bullets: true,
};

make.floor_tutorial = {
  make_parent: ["floor"],
  style: "tutorial_floor",
};


// sensors

make.sensor = {
  style: "sensor",
  sensor: true,
  invisible: true,
  seethrough: true,
  keep_bullets: true,
};

make.switch = {
  style: "switch",
  switch: true,
  seethrough: true,
  restitution: 0,
};

make.sensor_path = {
  style: "sensor_path",
  invisible: true,
  seethrough: true,
  keep_bullets: true,
};

make.icon = {
  decoration: true,
  seethrough: true,
};

make.icon_tutorial = {
  make_parent: ["icon"],
  style: "tutorial",
};


// player

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


// enemies

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
  movable: false,
  seethrough: false,
  health: {
    capacity: 500,
  },
};

make.enemy_tutorial_4way = {
  make_parent: ["enemy_tutorial"],
  movable: false,
  angle: -360 / 14,
  health: {
    capacity: 750,
  },
};

make.enemy_tutorial_easy = {
  make_parent: ["enemy_tutorial"],
  move_type: "direct",
  face_type: "direct",
  move_speed: 2,
  enemy_detect_range: 500,
  health: {
    capacity: 250,
  },
};

make.enemy_tutorial_bit = {
  make_parent: ["enemy_tutorial", "enemy_breakable"],
  style: "tutorial_breakable",
  style_: {
    opacity: 0.6,
  },
};

make.bullet = {
  // sensor: true,
  movable: true,
  seethrough: true,
  keep_bullets: true,
};


// make_shape

export const make_shapes: { [key: string]: maketype_shape[] } = {};

make_shapes.player = [{
  type: "circle",
  radius: 31,
}];

make_shapes.player_basic = [{
  type: "line",
  v2: vector.createpolar_deg(0, 30),
  shoot: "player_basic",
}];

make_shapes.switch = [{
  type: "circle",
  radius: 15,
}];

make_shapes.enemy_tutorial_block = [{
  type: "polygon",
  // style: "tutorial_enemy_filled",
  sides: 7,
  radius: 50,
}];

make_shapes.enemy_tutorial_easy = [{
  type: "polygon",
  sides: 7,
  radius: 35,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 35),
  shoot: "enemy_easy",
}];

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
  shoot_: { angle: 6 * 360 / 7, delay: 2 / 4, },
}, {
  type: "line",
  v2: vector.createpolar_deg(5 * 360 / 7, 70),
  shoot: "enemy_4way",
  shoot_: { angle: 5 * 360 / 7, delay: 2 / 4, },
}, {
  type: "line",
  v2: vector.createpolar_deg(4 * 360 / 7, 70),
  shoot: "enemy_4way",
  shoot_: { angle: 4 * 360 / 7, delay: 2 / 4, },
}];

make_shapes.enemy_tutorial_bit = [{
  type: "polygon",
  sides: 7,
  radius: 10,
}];


// make_shoot

export const make_shoot: { [key: string]: shoot_stats } = {};

make_shoot.player = {
  make: "bullet",
  size: 9,
  reload: 30,
  speed: 4,
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

make_shoot.enemy = {
  make: "bullet",
  size: 10,
  reload: 25,
  speed: 4,
  friction: 0,
  restitution: 1,
  recoil: 1,
  damage: 100,
  time: 60,
};

make_shoot.enemy_easy = {
  parent: ["enemy"],
  size: 11,
  reload: 70,
  speed: 2,
  time: 100,
};

make_shoot.enemy_4way = {
  parent: ["enemy"],
  size: 12,
  reload: 55,
  speed: 2.5,
  recoil: 0,
  time: 100,
};



const calculated_keys: string[] = ["default"];
const calculated_shoot_keys: string[] = [];

// for (const m of Object.values(make)) {
//   if (m.make_parent == undefined) m.make_parent = ["default"];
//   else m.make_parent.unshift("default");
// }

// clone functions

export const clone_array = function(arr: any[]) {
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
      for (const a of v) m_target[k].push(typeof a === "object" ? clone_object(a) : a);
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
      for (const a of v) m_target[k].push(typeof a === "object" ? clone_object(a) : a);
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
console.log(make);
// console.log(make_shapes);
// console.log(make_shoot);