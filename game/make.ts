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

  shoots?: string[];

};

export interface maketype_shape {

  type: "circle" | "polygon" | "line";
  z?: number;
  sides?: number;
  radius?: number;
  angle?: number;
  offset?: vector;
  scale?: vector;
  v1?: vector;
  v2?: vector;
  shoot?: string;

};

export type shoot_stats = {
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
};


export type dictionary = { [key: string]: any };


// make

export const make: { [key: string]: maketype } = {};

make.default = {
  make_parent: [],
  style: "error",
  decoration: false,
  sensor: false,
  invisible: false,
  movable: false,
  seethrough: false,
  keep_bullets: false,
};

make.wall = {
  // nothing different from default yet
};

make.wall_tutorial = {
  make_parent: ["wall"],
  style: "tutorial",
};

make.wall_tutorial_rock = {
  make_parent: ["wall_tutorial"],
  keep_bullets: true,
};

make.floor = {
  decoration: true,
  seethrough: true,
  keep_bullets: true,
};

make.floor_tutorial = {
  make_parent: ["floor"],
  style: "tutorial_floor",
};

make.sensor = {
  style: "sensor",
  sensor: true,
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

make.player = {
  style: "player",
  movable: true,
  seethrough: true,
};

make.enemy = {
  movable: true,
  seethrough: true,
};

make.enemy_tutorial = {
  make_parent: ["enemy"],
  style: "tutorial",
};

make.bullet = {
  movable: true,
  seethrough: true,
  keep_bullets: true,
};


// make_shape

export const make_shapes: { [key: string]: maketype_shape[] } = {};

make_shapes.player = [{
  type: "circle",
  radius: 31,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 30),
  shoot: "player",
}];

make_shapes.enemy_tutorial = [{
  type: "polygon",
  sides: 7,
  radius: 50,
}, {
  type: "line",
  v2: vector.createpolar_deg(0, 50),
}];


// make_shoot

export const make_shoot: { [key: string]: shoot_stats } = {};

make_shoot.player = {
  make: "bullet",
  size: 80,
  reload: 30,
  speed: 5,
  friction: 0.003,
  restitution: 1,
  recoil: 1,
};

make_shoot.half_reload = {
  reload: 0.5,
};

make_shoot.player_basic = {
  parent: ["player"],
};



const calculated_keys: string[] = ["default"];
const calculated_shoot_keys: string[] = [];

for (const m of Object.values(make)) {
  if (m.make_parent == undefined) m.make_parent = ["default"];
  else m.make_parent.unshift("default");
}


export const clone_object = function(obj: dictionary) {
  const result: dictionary = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object") {
      result[k] = clone_object(v);
    } else if (Array.isArray(v)) {
      result[k] = [];
      for (const a of v) result[k].push(a);
    } else {
      result[k] = v;
    }
  }
  return result;
};

export const override_object = function(m_target: dictionary, m_override: dictionary) {
  for (const [k, v] of Object.entries(m_override)) {
    if (typeof v === "object") {
      if (m_target[k] == undefined) m_target[k] = {};
      override_object(m_target[k], v);
    } else if (Array.isArray(v)) {
      if (m_target[k] == undefined) m_target[k] = [];
      for (const a of v) m_target[k].push(a);
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


const calculate_make = function(key: string) {
  const m = make[key];
  const result: maketype = {};
  for (const parent_key of m.make_parent ?? []) {
    if (make[parent_key]) {
      if (!calculated_keys.includes(parent_key)) calculate_make(parent_key);
      override_object(result, make[parent_key]);
    } else console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
  }
  override_object(result, m);
  make[key] = result;
  calculated_keys.push(key);
};

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


// todo remove all 3 (debug)
console.log(make);
console.log(make_shapes);
console.log(make_shoot);