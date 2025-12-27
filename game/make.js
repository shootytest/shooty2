import load_bullets from "../make/bullets.js";
import load_collects from "../make/collects.js";
import load_deco from "../make/deco.js";
import load_enemies from "../make/enemies.js";
import load_env from "../make/env.js";
import load_items from "../make/items.js";
import load_players from "../make/players.js";
import load_shoots from "../make/shoots.js";
;
;
;
;
;
;
;
;
;
;
;
;
// make
export const make = {};
export const make_ = {};
export const make_shapes = {};
export const make_shoot = {};
// default
make.default = {};
// any order should work
load_env();
load_deco();
load_players();
load_bullets();
load_enemies();
load_collects();
load_items();
load_shoots();
const calculated_keys = ["default"];
const calculated_shoot_keys = [];
export const shallow_clone_array = function (arr) {
    const result = [];
    for (const a of arr)
        result.push(a);
    return result;
};
export const clone_object = function (obj) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) {
            result[k] = [];
            for (const a of v)
                result[k].push(typeof a === "object" && !Array.isArray(a) ? clone_object(a) : a);
        }
        else if (typeof v === "object") {
            result[k] = clone_object(v);
        }
        else {
            result[k] = v;
        }
    }
    return result;
};
export const override_object = function (m_target, m_override) {
    for (const [k, v] of Object.entries(m_override)) {
        if (Array.isArray(v)) {
            if (m_target[k] == undefined)
                m_target[k] = [];
            for (const [i, a] of v.entries()) {
                const is_object = typeof a === "object" && !Array.isArray(a);
                if (i >= m_target[k].length)
                    m_target[k].push(is_object ? clone_object(a) : a);
                else if (is_object)
                    override_object(m_target[k][i], a);
                else
                    m_target[k][i] = a;
            }
        }
        else if (typeof v === "object") {
            if (m_target[k] == undefined)
                m_target[k] = {};
            override_object(m_target[k], v);
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
export const multiply_and_override_object = function (m_target, m_override) {
    for (const [k, v] of Object.entries(m_override)) {
        if (typeof v === "number") {
            m_target[k] = (m_target[k] ?? 1) * v;
        }
        else if (Array.isArray(v)) {
            if (m_target[k] == undefined)
                m_target[k] = [];
            for (const [i, a] of v.entries()) {
                if (i >= m_target[k].length)
                    m_target[k].push(typeof a === "object" ? clone_object(a) : a);
                else if (typeof a === "object" && !Array.isArray(a))
                    override_object(m_target[k][i], a);
                else
                    m_target[k][i] = a;
            }
        }
        else if (typeof v === "object") {
            if (m_target[k] == undefined)
                m_target[k] = {};
            override_object(m_target[k], v);
        }
        else {
            m_target[k] = v;
        }
    }
};
const calculate_make = function (key) {
    const m = make[key];
    const result = {};
    let first_one = true;
    for (const parent_key of m.make_parent ?? []) {
        if (make[parent_key]) {
            if (!calculated_keys.includes(parent_key))
                calculate_make(parent_key);
            override_object(result, first_one ? make[parent_key] : make_[parent_key]);
            if (parent_key !== "default")
                first_one = false;
        }
        else
            console.error(`[make] while computing '${key}': make_shoot '${parent_key}' doesn't exist!`);
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
// must import
// console.log(make_rooms);
// console.log(make_waves);
// console.log(make_data);
