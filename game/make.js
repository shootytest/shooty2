import { vector } from "../util/vector.js";
;
;
;
// make
export const make = {};
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
// walls
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
    // density: 1,
    health: {
        capacity: 10,
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
make.enemy_tutorial_block = {
    make_parent: ["enemy"],
    style: "tutorial_enemy",
    team: 7,
    health: {
        capacity: 150,
    },
};
make.enemy_tutorial_bit = {
    make_parent: ["enemy"],
    style: "tutorial_enemy",
    style_: {
        opacity: 0.4,
    },
    team: 7,
    density: 1000,
    health: {
        capacity: 0.1,
    },
};
make.bullet = {
    // sensor: true,
    movable: true,
    seethrough: true,
    keep_bullets: true,
};
// make_shape
export const make_shapes = {};
make_shapes.player = [{
        type: "circle",
        radius: 31,
    }, {
        type: "line",
        v2: vector.createpolar_deg(0, 30),
        shoot: "player",
    }];
make_shapes.enemy_tutorial_block = [{
        type: "polygon",
        sides: 7,
        radius: 50,
    }];
make_shapes.enemy_tutorial_bit = [{
        type: "polygon",
        sides: 7,
        radius: 10,
    }];
// make_shoot
export const make_shoot = {};
make_shoot.player = {
    make: "bullet",
    size: 8,
    reload: 30,
    speed: 5,
    friction: 0.003,
    restitution: 1,
    recoil: 1,
    damage: 100,
};
make_shoot.half_reload = {
    reload: 0.5,
};
make_shoot.player_basic = {
    parent: ["player"],
};
const calculated_keys = ["default"];
const calculated_shoot_keys = [];
for (const m of Object.values(make)) {
    if (m.make_parent == undefined)
        m.make_parent = ["default"];
    else
        m.make_parent.unshift("default");
}
// clone functions
export const clone_array = function (arr) {
    const result = [];
    for (const a of arr)
        result.push(a);
    return result;
};
export const clone_object = function (obj) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "object") {
            result[k] = clone_object(v);
        }
        else if (Array.isArray(v)) {
            result[k] = [];
            for (const a of v)
                result[k].push(a);
        }
        else {
            result[k] = v;
        }
    }
    return result;
};
export const override_object = function (m_target, m_override) {
    for (const [k, v] of Object.entries(m_override)) {
        if (typeof v === "object") {
            if (m_target[k] == undefined)
                m_target[k] = {};
            override_object(m_target[k], v);
        }
        else if (Array.isArray(v)) {
            if (m_target[k] == undefined)
                m_target[k] = [];
            for (const a of v)
                m_target[k].push(a);
        }
        else {
            m_target[k] = v;
        }
    }
};
export const multiply_object = function (o_target, o_multiply) {
    for (const [k, v] of Object.entries(o_multiply)) {
        if (typeof v !== "number")
            continue;
        if (o_target[k] == undefined)
            continue;
        o_target[k] *= v;
    }
};
const calculate_make = function (key) {
    const m = make[key];
    const result = {};
    for (const parent_key of m.make_parent ?? []) {
        if (make[parent_key]) {
            if (!calculated_keys.includes(parent_key))
                calculate_make(parent_key);
            override_object(result, make[parent_key]);
        }
        else
            console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
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
const calculate_make_shoot = function (key) {
    const m = make_shoot[key];
    const result = {};
    for (const parent_key of m.parent ?? []) {
        if (make_shoot[parent_key]) {
            if (!calculated_shoot_keys.includes(parent_key))
                calculate_make_shoot(parent_key);
            override_object(result, make_shoot[parent_key]);
        }
        else
            console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
    }
    for (const mult_key of m.mult ?? []) {
        if (make_shoot[mult_key]) {
            if (!calculated_shoot_keys.includes(mult_key))
                calculate_make_shoot(mult_key);
            multiply_object(result, make_shoot[mult_key]);
        }
        else
            console.error(`[make] while computing '${key}': make_shoot '${mult_key}' doesn't exist!`);
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
