import { engine, MAP } from "../index.js";
import { Events, Vertices } from "../matter.js";
import { STYLES } from "../util/color.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { Spawner } from "./enemy.js";
import { clone_object } from "./make.js";
import { player } from "./player.js";
import { save } from "./save.js";
/**
 *
 * Collisions between two bodies will obey the following rules:
 *
 *  - If the two bodies have the same non-zero value of `collisionFilter.group`,
 *    they will always collide if the value is positive, and they will never collide
 *    if the value is negative.
 *  - If the two bodies have different values of `collisionFilter.group` or if one
 *    (or both) of the bodies has a value of 0, then the category/mask rules apply as follows:
 *
 * Each body belongs to a collision category, given by `collisionFilter.category`. This
 * value is used as a bit field and the category should have only one bit set, meaning that
 * the value of this property is a power of two in the range [1, 2^31]. Thus, there are 32
 * different collision categories available.
 *
 * Each body also defines a collision bitmask, given by `collisionFilter.mask` which specifies
 * the categories it collides with (the value is the bitwise AND value of all these categories).
 *
 * Using the category/mask rules, two bodies `A` and `B` collide if each includes the other's
 * category in its mask, i.e. `(categoryA & maskB) !== 0` and `(categoryB & maskA) !== 0`
 * are both true.
 *
 * ~ matter.js api docs
 *
 */
export const filter_groups = {
    none: 0x0000,
    thing: 0x0001,
    player_thing: 0x0002,
    enemy_thing: 0x0004,
    bullet: 0x0008,
    wall: 0x0010,
    all: 0xFFFF,
};
;
export const filters = {
    group: filter_groups,
    all: {
        group: 0,
        category: filter_groups.thing,
        mask: filter_groups.all,
    },
    none: {
        group: 0,
        category: filter_groups.thing,
        mask: filter_groups.none,
    },
    thing: (team) => {
        return {
            group: -team,
            category: filter_groups.thing,
            mask: filter_groups.all,
        };
    },
    bullet: (team) => {
        return {
            group: -team,
            category: filter_groups.bullet,
            mask: filter_groups.all - filter_groups.bullet,
        };
    },
    wall: {
        group: 0,
        category: filter_groups.wall,
        mask: filter_groups.all,
    },
    window: {
        group: 0,
        category: filter_groups.wall,
        mask: filter_groups.thing,
    },
    curtain: {
        group: 0,
        category: filter_groups.wall,
        mask: filter_groups.bullet,
    },
};
export const detector = {
    init: function () {
        Events.on(engine, "collisionStart", function (event) {
            for (const pair of event.pairs) {
                const ba = pair.bodyA, bb = pair.bodyB;
                detector.collision_start(pair, ba, bb, false);
                detector.collision_start(pair, bb, ba, true);
            }
        });
        Events.on(engine, "collisionEnd", function (event) {
            for (const pair of event.pairs) {
                const ba = pair.bodyA, bb = pair.bodyB;
                detector.collision_end(pair, ba, bb, false);
                detector.collision_end(pair, bb, ba, true);
            }
        });
    },
    collision_start: (pair, ba, bb, flipped) => {
        const a = ba.parent.thing, b = bb.parent.thing;
        const b_rittle = b.health && b.health.capacity > 0 && b.health.capacity < 1 - math.epsilon;
        const different_team = Math.floor(a.team) !== Math.floor(b.team);
        // console.log(`[detector/collision_start] Collision started betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                detector.sensor_start_fns[b.id]?.(b);
                if (b.options.sensor_fov_mult != undefined)
                    player.fov_mult = b.options.sensor_fov_mult || 1;
                if (!b.options.sensor_dont_set_room)
                    player.change_room(b.room_id);
                b.is_touching_player = true;
            }
            if (b.health && b_rittle && different_team) {
                b.health?.hit_all();
            }
        }
        if (a.is_bullet) {
            if (!b.options.sensor && !b.options.keep_bullets && !a.options.collectible && !b_rittle && different_team) {
                if (b.is_player)
                    a.options.death = []; // clear bullets on death if it hits the player
                a.die();
            }
            else if (b_rittle || (!different_team && a.team > 0)) {
                pair.isSensor = true;
                ba.temporarySensor = true;
            }
        }
        if (a.damage > 0 && b.health && b.health.capacity > 0 && different_team) {
            // console.log(`[detector/collision_start] ${a.id} hits ${b.id} for ${a.damage} damage!`);
            b.health?.hit(a.damage);
        }
        if (Math.floor(a.team) === 1 && b.options.collectible) {
            const collect = b.options.collectible;
            if (collect.allow_bullet_collect || a.is_player) {
                player.collect(collect);
                b.die();
            }
        }
        if (Math.floor(a.team) === 1 && b.options.switch) {
            const switch_id = b.spawner.id;
            if (!save.check_switch(switch_id)) {
                save.set_switch(switch_id);
                save.set_switch_time(switch_id, b.thing_time);
            }
            b.shapes[0].glowing = 1;
        }
        if (b.options.breakable)
            b.velocity = vector.mult(a.velocity, 0.5);
    },
    collision_end: (pair, ba, bb, flipped) => {
        const a = ba.parent.thing, b = bb.parent.thing;
        // console.log(`[detector/collision_end] Collision ended betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                detector.sensor_end_fns[b.id]?.(b);
                b.is_touching_player = false;
            }
        }
        if (ba.temporarySensor) {
            pair.isSensor = false;
        }
    },
    sensor_during_fns: {
        ["tutorial room 1 sensor"]: (thing) => {
            thing.lookup("tutorial room 1 arrow").shapes[0].style.stroke_opacity = 1 - math.bound((player.position.x - thing.position.x) / 350, 0, 1);
            player.set_checkpoint(vector.clone(MAP.computed?.shape_map["start"].vertices[0] ?? vector.create(100, -100)));
        },
        ["tutorial room 2 door sensor"]: (_thing) => {
            // const style = thing.lookup("tutorial room 2 arrow 1").shapes[0].style;
            // style.stroke_opacity = math.bound((style.stroke_opacity ?? 1) - 0.05, 0, 1);
        },
        ["tutorial room 4 sensor"]: (thing) => {
            const center = vector.clone(MAP.computed?.shape_map["tutorial room 4 gun"].vertices[0] ?? vector.create());
            const d = vector.length(vector.sub(player.position, center));
            if (d < 100)
                player.set_checkpoint(center);
            player.fov_mult = 1.25 - 0.5 * math.bound(1 - d / 500, 0, 1);
            // hmmm
            let i = 0;
            for (const s of Spawner.get_enemy("tutorial room 4 gun deco")?.shapes ?? []) {
                s.angle = d / 3000 * i;
                s.calculate();
                i++;
            }
            const mouse = thing.lookup("tutorial room 4 mouse");
            if (mouse) {
                const show_mouse = player.guns.length >= 1 && Spawner.check_progress("tutorial room 4 rocky 1") <= 0;
                const move_mouse = player.guns.length >= 1 && !show_mouse && Spawner.check_progress("tutorial room 4 rocky 2") <= 0;
                const mouse_icon = mouse.shapes[0];
                mouse_icon.style.opacity = (show_mouse || move_mouse) ? 1 : 0;
                if (move_mouse && !mouse.object.moved) {
                    mouse.object.moved = true;
                    mouse_icon.activate_scale = true;
                    mouse_icon.scale.x = -1;
                    mouse_icon.offset = vector.create(630, 200);
                    mouse_icon.init_computed();
                }
                mouse_icon.style.fill = mouse_icon.style.stroke;
                mouse_icon.style.fill_opacity = math.bounce(thing.thing_time, 30) * 0.5;
            }
        },
    },
    sensor_start_fns: {
        // nothing for now
        ["tutorial room 1 door sensor"]: (thing) => {
            thing.lookup("tutorial room 1 arrow").shapes[0].style.stroke_opacity = 0;
        },
        ["tutorial room 2.5 sensor"]: (_thing) => {
            const centre = Vertices.centre(Spawner.spawners_lookup["tutorial room 2 breakables 4"].vertices);
            player.set_checkpoint(centre); // todo remove
        },
        ["tutorial room 5 sensor"]: (thing) => {
            const boss = Spawner.get_enemy("tutorial room 5 boss");
            if (boss) {
                boss.object.activated = true;
                boss.options.enemy_detect_range = 2000;
            }
        },
    },
    sensor_end_fns: {
    // nothing for now
    },
    before_death_fns: {
        // nothing for now
        ["tutorial room 2 enemy shooter"]: (thing) => {
            thing.remove_static();
            for (const shape of thing.shapes) {
                shape.style = clone_object(STYLES.tutorial);
            }
            return true;
        },
        ["tutorial room 4 rocky"]: (thing) => {
            thing.remove_deco();
            for (const shape of thing.shapes) {
                shape.style.opacity = 0.5;
            }
            return true;
        },
    },
    spawner_calc_fns: {
        ["tutorial room 3 enemy 1"]: (spawner) => {
            if (spawner.wave_progress > 0 && spawner.check_progress("tutorial room 3 enemy 2") > 0) {
                spawner.thing_lookup("tutorial window 1").die();
                spawner.thing_lookup("tutorial window 1 deco").shapes[0].style.stroke_opacity = 0;
            }
        },
        ["tutorial room 3 enemy 2"]: (spawner) => {
            if (spawner.wave_progress > 0 && spawner.check_progress("tutorial room 3 enemy 1") > 0) {
                spawner.thing_lookup("tutorial window 1").die();
                spawner.thing_lookup("tutorial window 1 deco").shapes[0].style.stroke_opacity = 0;
            }
        },
    },
    tick_fns: {
        ["tutorial room 1 door 1"]: (door) => {
            do_door(door, "tutorial room 1 door sensor");
        },
        ["tutorial room 1 door 2"]: (door) => {
            do_door(door, "tutorial room 1 door sensor");
        },
        ["tutorial room 2 arrow 1"]: (thing) => {
            const show = player.guns.length >= 1;
            if (show) {
                if (!thing.object.done) {
                    thing.object.done = true;
                    thing.shapes[0].activate_scale = true;
                    thing.shapes[0].scale.x = -1;
                    const warning_offset = vector.create(160, 500);
                    for (let i = 0; i < 3; i++) {
                        const shape = thing.lookup("tutorial room 2 warning" + (i > 0 ? " " + i : "")).shapes[0];
                        shape.offset = vector.clone(warning_offset);
                        shape.style.stroke = STYLES.tutorial_enemy.stroke;
                        shape.style.stroke_opacity = 0.6;
                        shape.init_computed();
                    }
                    thing.lookup("tutorial room 2 arrow 2").shapes[0].style.opacity = 1;
                }
                if (!thing.object.block_done) {
                    const block = Spawner.get_enemy("tutorial room 2 block");
                    if (block) {
                        thing.object.block_done = true;
                        block.options.seethrough = true;
                        for (const s of block.shapes)
                            s.seethrough = true;
                    }
                }
            }
            else {
                thing.lookup("tutorial room 2 arrow 2").shapes[0].style.opacity = 0;
            }
        },
        ["tutorial room 2 door 1"]: (door) => {
            do_door(door, "tutorial room 2 door sensor");
        },
        ["tutorial room 2 door 2"]: (door) => {
            do_door(door, "tutorial room 2 door sensor");
        },
        ["tutorial room 3 door"]: (door) => {
            do_door(door, "tutorial room 3 door sensor");
        },
        ["tutorial rock 7"]: (door) => {
            switch_door(door, "tutorial room 2 switch", "tutorial room 2 switch path", 1);
        },
        ["tutorial rock 11"]: (door) => {
            switch_door(door, Spawner.check_progress("tutorial room 2 enemy shooter") > 0 || door.lookup("tutorial room 2.1 sensor").is_touching_player, "tutorial room 2.1 switch path", 1);
        },
        ["tutorial room 5 door"]: (door) => {
            switch_door(door, Spawner.get_enemy("tutorial room 5 boss")?.object?.activated, "tutorial room 5 switch path", 6);
        },
    },
};
const do_door = (door, sensor_id, speed = 5, invert = false) => {
    const vs = door.shapes[0].vertices;
    const dir = vector.sub(vs[1], vs[0]);
    const offset = vector.sub(door.position, door.target.position);
    let triggered = Boolean(door.lookup(sensor_id)?.is_touching_player);
    if (invert)
        triggered = !triggered;
    let exceeded = true;
    if (triggered)
        exceeded = vector.length2(offset) > vector.length2(dir);
    else
        exceeded = vector.dot(offset, dir) < 0;
    if (!exceeded)
        door.translate_wall(vector.normalise(dir, triggered ? speed : -speed));
};
const switch_door = (door, switch_ids, path_id, speed = [5], invert = [false]) => {
    const path = door.lookup(path_id);
    if (path == undefined)
        return;
    const vs = path.shapes[0].vertices;
    const pos = door.position;
    let step = door.object.step ?? 1;
    if (!Array.isArray(switch_ids))
        switch_ids = [switch_ids];
    if (typeof speed === "number")
        speed = [speed];
    if (step >= vs.length || step > switch_ids.length)
        return;
    if (door.object.step == undefined) {
        door.object.original_position = vector.clone(pos);
        door.object.step = step;
    }
    let switch_id = switch_ids[step - 1];
    let triggered = typeof switch_id === "string" ? save.check_switch(switch_id) : switch_id;
    if (invert[step - 1] ?? false)
        triggered = !triggered;
    // instant teleport?
    while (typeof switch_id === "string" && save.get_switch_time(switch_id) === -1 && triggered) {
        const target_dv = vector.sub(vs[step], vs[0]);
        const door_dv = vector.sub(vector.add(door.object.original_position, target_dv), pos);
        door.translate(door_dv);
        step++;
        door.object.step = step;
        switch_id = switch_ids[step - 1];
        triggered = typeof switch_id === "string" ? save.check_switch(switch_id) : switch_id;
        if (invert[step - 1] ?? false)
            triggered = !triggered;
    }
    // do normal stuff
    if (triggered) {
        const target_dv = vector.sub(vs[step], vs[0]);
        const door_dv = vector.sub(vector.add(door.object.original_position, target_dv), pos);
        const sped = speed[step] ?? speed[0];
        if (vector.length(door_dv) <= sped) {
            door.translate_wall(door_dv);
            door.object.step = step + 1;
        }
        else {
            door.translate_wall(vector.normalise(door_dv, sped));
        }
    }
};
