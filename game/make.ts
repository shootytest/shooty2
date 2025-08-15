import { style_type } from "../util/map_type";

export interface maketype {

  make_parent?: string[];

  // display options
  style?: string,
  style_?: style_type, // consider renaming to style_override (not really)
  
  // game booleans
  decoration?: boolean, // this won't add a physics object
  sensor?: boolean, // invisible physics sensor
  invisible?: boolean, // invisible shape
  movable?: boolean, // dynamic physics object
  seethrough?: boolean, // visibility
  keep_bullets?: boolean, // don't delete bullets if they collide

};

export type dictionary = { [key: string]: any };

export const make: { [key: string]: maketype } = {};

make.default = {
  make_parent: [],
  style: "error",
};

make.wall = {
  decoration: false,
  sensor: false,
  invisible: false,
  movable: false,
  seethrough: false,
  keep_bullets: false,
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
  sensor: false,
  invisible: false,
  movable: false,
  seethrough: true,
  keep_bullets: true,
};

make.floor_tutorial = {
  make_parent: ["floor"],
  style: "tutorial_floor",
};

make.sensor = {
  style: "sensor",
  decoration: false,
  sensor: true,
  invisible: true,
  movable: false,
  seethrough: true,
  keep_bullets: true,
};

make.enemy = {

};

const calculated_keys: string[] = ["default"];

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
      m_target[k] = [];
      for (const a of v) m_target[k].push(a);
    } else {
      m_target[k] = v;
    }
  }
};

const calculate_make = function(key: string) {
  const m = make[key];
  const result: maketype = {};
  for (const parent_key of m.make_parent ?? []) {
    if (!calculated_keys.includes(parent_key)) calculate_make(parent_key);
    override_object(result, make[parent_key]);
  }
  override_object(result, m);
  make[key] = result;
  calculated_keys.push(key);
};

for (const k of Object.keys(make)) {
  calculate_make(k);
}

// todo remove (debug)
console.log(make);