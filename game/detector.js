import { engine, MAP } from "../index.js";
import { make_data } from "../make/data.js";
import { Events } from "../matter.js";
import { camera } from "../util/camera.js";
import { STYLES } from "../util/color.js";
import { config } from "../util/config.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { Spawner } from "./enemy.js";
import { clone_object } from "./make.js";
import { Particle } from "./particle.js";
import { player } from "./player.js";
import { save } from "./save.js";
import { Thing } from "./thing.js";
/**
 *
 * Collisions betwixt two bodies will obey the following rules:
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
 * ~ matter.js api docs (a word is modified, i wonder which)
 *
 *
 * additionally, collisions betwixt two bodies with different z values are handled accordingly, i hope.
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
        mask: filter_groups.all - filter_groups.wall,
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
    // magic!
    meow_check: function (pair, ba, bb, a, b, type) {
        if (ba.z == undefined)
            return;
        const sc = "collisions_" + ba.parent.label.split("`")[0];
        const sp = "pairs_" + ba.parent.label.split("`")[0];
        if (type === "start") {
            // collision start
            if (bb[sc] == undefined) {
                bb[sc] = [ba.z];
                bb[sp] = [pair];
                pair.isSensor = true;
                pair.z_diff = true;
            }
            else {
                bb[sc].push(ba.z);
                bb[sp].push(pair);
                const min_z = Number(bb[sc].reduce((z1, z2) => Math.min(z1, z2)).toFixed(3));
                const max_z = Number(bb[sc].reduce((z1, z2) => Math.max(z1, z2)).toFixed(3));
                if (bb[sp].length === 2)
                    bb[sp][0].z_range = [min_z, max_z];
                pair.z_range = [min_z, max_z];
                if (!(min_z <= b.z && max_z > b.z)) { // doesn't hit!
                    for (const p of bb[sp]) {
                        p.isSensor = true;
                        p.z_diff = true;
                    }
                }
            }
        }
        else if (type === "middle") {
            if (pair.z_range == undefined)
                return;
            const [min_z, max_z] = pair.z_range;
            if (pair.z_diff) {
                // suddenly same z
                if (min_z <= b.z && max_z > b.z) { // hits!
                    // b.teleport_to(vector.add(b.position, vector.mult(pair.collision.normal, pair.collision.depth)));
                    for (const p of bb[sp]) {
                        p.isSensor = false;
                        p.z_diff = false;
                        detector.collision_start(p, p.bodyA.parent.thing, p.bodyB.parent.thing, true);
                        detector.collision_start(p, p.bodyB.parent.thing, p.bodyA.parent.thing, true);
                    }
                }
            }
            else {
                // suddenly different z
                if (!(min_z <= b.z && max_z > b.z)) {
                    for (const p of bb[sp]) {
                        p.isSensor = true;
                        p.z_diff = true;
                        detector.collision_end(p, p.bodyA.parent.thing, p.bodyB.parent.thing, true);
                        detector.collision_end(p, p.bodyB.parent.thing, p.bodyA.parent.thing, true);
                    }
                }
            }
        }
        else if (type === "end") {
            // collision end
            if (bb[sc] != undefined)
                bb[sc].remove(ba.z);
            if (bb[sp] != undefined)
                bb[sp].remove(pair);
            if (bb[sc].length >= 1) {
                const min_z = bb[sc].length >= 2 ? Number(bb[sc].reduce((z1, z2) => Math.min(z1, z2)).toFixed(3)) : bb[sc][0];
                const max_z = bb[sc].length >= 2 ? Number(bb[sc].reduce((z1, z2) => Math.max(z1, z2)).toFixed(3)) : bb[sc][0];
                for (const p of bb[sp]) {
                    p.z_range = [min_z, max_z];
                }
            }
        }
    },
    init: function () {
        Events.on(engine, "collisionStart", function (event) {
            for (const pair of event.pairs) {
                const ba = pair.bodyA, bb = pair.bodyB;
                const a = ba.parent.thing, b = bb.parent.thing;
                detector.meow_check(pair, ba, bb, a, b, "start");
                detector.meow_check(pair, bb, ba, b, a, "start");
                if (!a.cover_z && !b.cover_z && Math.abs(b.z - a.z) >= 0.1) {
                    pair.isSensor = true;
                    pair.z_diff = true;
                }
                detector.collision_start(pair, a, b);
                detector.collision_start(pair, b, a);
            }
        });
        Events.on(engine, "collisionActive", function (event) {
            for (const pair of event.pairs) {
                const ba = pair.bodyA, bb = pair.bodyB;
                const a = ba.parent.thing, b = bb.parent.thing;
                detector.meow_check(pair, ba, bb, a, b, "middle");
                detector.meow_check(pair, bb, ba, b, a, "middle");
                if (!a.cover_z && !b.cover_z) {
                    const diff = Math.abs(b.z - a.z);
                    if (pair.z_diff) {
                        // suddenly same z
                        if (diff < 0.1) {
                            // pair.isSensor = false;
                            pair.z_diff = false;
                            detector.collision_start(pair, a, b, true);
                            detector.collision_start(pair, b, a, true);
                        }
                    }
                    else {
                        // suddenly a different z
                        if (diff > 0.1) {
                            pair.isSensor = true;
                            pair.z_diff = true;
                            detector.collision_end(pair, a, b, true);
                            detector.collision_end(pair, b, a, true);
                        }
                    }
                }
            }
        });
        Events.on(engine, "collisionEnd", function (event) {
            for (const pair of event.pairs) {
                const ba = pair.bodyA, bb = pair.bodyB;
                const a = ba.parent.thing, b = bb.parent.thing;
                detector.meow_check(pair, ba, bb, a, b, "end");
                detector.meow_check(pair, bb, ba, b, a, "end");
                detector.collision_end(pair, a, b);
                detector.collision_end(pair, b, a);
            }
        });
    },
    collision_start: (pair, a, b, suddenlyz = false) => {
        const different_team = Math.floor(a.team) !== Math.floor(b.team);
        const hittingz = (!pair.isSensor || suddenlyz);
        // console.log(`[detector/collision_start] Collision started betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                const id = b.id.split("|")[0];
                detector.sensor_start_fns[id]?.(b);
                if (b.options.sensor_fov_mult != undefined)
                    player.fov_mult = b.options.sensor_fov_mult || 1;
                if (!b.options.sensor_dont_set_room)
                    player.change_room(b.room_id);
                b.is_touching_player = true;
            }
            if (b.health && b.options.breakable && different_team && hittingz) {
                b.health?.hit_all();
            }
        }
        if (!hittingz)
            return;
        if (a.is_bullet) {
            if (!b.options.sensor && !b.options.keep_bullets && !a.options.collectible && !b.options.breakable && different_team && !b.health?.invincible) {
                if (b.is_player)
                    a.options.death = []; // please don't explode if it hits the player // todo how about exploding coins?
                a.die();
            }
            else if (b.options.breakable || (!different_team && a.team > 0)) {
                pair.isSensor = true;
                a.object.breakables_hit = (a.object.breakables_hit ?? 0) + 1;
                if (b.options.xp)
                    b.options.xp *= a.object.breakables_hit;
            }
        }
        if (a.damage > 0 && b.health && b.health.capacity > 0 && different_team) {
            // console.log(`[detector/collision_start] ${a.id} hits ${b.id} for ${a.damage} damage!`);
            b.health?.hit(a.damage);
        }
        // player and collectibles
        if (Math.floor(a.team) === 1 && b.options.collectible) {
            const collect = b.options.collectible;
            if (collect.allow_bullet_collect || a.is_player) {
                player.collect(collect);
                b.die();
            }
        }
        // player/bullets and switches
        if (Math.floor(a.team) === 1 && b.options.switch) {
            if (b.options.checkpoint && !a.is_player)
                return; // no shooting to activate checkpoints!
            const switch_id = b.spawner.id;
            if (!save.check_switch(switch_id)) {
                save.set_switch(switch_id);
                save.set_switch_time(switch_id, b.thing_time);
            }
            if (b.shapes[0])
                b.shapes[0].options.glowing = 1;
            if (b.options.checkpoint) {
                player.health?.heal_all();
                player.object.checkpoint = b;
                player.object.checkpoint_pair = pair;
                player.set_checkpoint_here();
                player.change_room(player.checkpoint_room, true);
                player.reload_all_rooms([player.checkpoint_room]); // reload everything except current room
                // activate lol
                // pair.isSensor = true;
                // player.teleport_to(b.position);
                // ui.toggle_pause();
            }
        }
    },
    collision_end: (pair, a, b, z_diff = false) => {
        // console.log(`[detector/collision_end] Collision ended betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                detector.sensor_end_fns[b.id]?.(b);
                b.is_touching_player = false;
            }
        }
    },
    sensor_during_fns: {
        ["tutorial room 1 sensor"]: (thing, _dt) => {
            const style = thing.lookup("tutorial room 1 arrow").shapes[0].style;
            if (style && (style?.stroke_opacity ?? 1) > 0)
                style.opacity = 1 - math.bound((player.position.x - thing.position.x) / 350, 0, 1);
            player.set_checkpoint(vector3.create_(MAP.computed?.shape_map["start"].vertices[0] ?? vector.create(100, -100), 0), "tutorial room 1");
        },
        ["tutorial room 2 door sensor"]: (_thing, _dt) => {
            // const style = thing.lookup("tutorial room 2 arrow 1").shapes[0].style;
            // style.stroke_opacity = math.bound((style.stroke_opacity ?? 1) - 0.05, 0, 1);
        },
        ["tutorial room 4 sensor"]: (thing, _dt) => {
            const center = vector.clone(MAP.computed?.shape_map["tutorial room 4 gun"].vertices[0] ?? vector.create());
            const d = vector.length(vector.sub(player.position, center));
            if (d < 100)
                player.set_checkpoint(vector3.create_(center, 0), "tutorial room 4");
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
                    mouse_icon.offset = vector3.create(630, 200, 0);
                    mouse_icon.init_computed();
                }
                mouse_icon.style.fill = mouse_icon.style.stroke;
                mouse_icon.style.fill_opacity = math.bounce(thing.thing_time, config.graphics.blink_time * 2) * 0.5;
            }
        },
        ["station tutorial sensor start"]: (thing) => {
            const style = thing.lookup("train ceiling").shapes[0].style;
            if (!math.equal(style.fill_opacity ?? 0, 0.5))
                style.fill_opacity = math.lerp(style.fill_opacity ?? 0, 0.5, 0.1);
        },
        ["station streets sensor end"]: (thing) => {
            if (player.z < -0.39) {
                player.fov_mult = 0.95 - player.z / 2;
                if (player.checkpoint_room !== "station streets") {
                    player.set_checkpoint(vector3.create2(thing.position, -0.4), "station streets");
                }
            }
        },
        ["station tracks"]: (thing) => {
            const train_position = save.get_switch("train");
            if (math.equal(player.z, 0) && !thing.lookup("train sensor").is_touching_player)
                player.push_by(vector.create(train_position === 11.5 ? 10 : -10, 0));
        },
        set_train: (thing) => {
            const train = thing.lookup("train");
            const train_position = save.get_switch("train");
            if (train_position === 11 && (train.object.train_distance || 0) > 0) {
                const dv = vector.create(-(train.object.train_distance || 0), 0);
                for (const t of Thing.things) {
                    if (!t.id.startsWith("train"))
                        continue;
                    if (t.body)
                        t.translate(dv);
                    else
                        t.position = vector.add(t.position, dv);
                    if (t.object.original_position)
                        t.object.original_position = vector.add(t.object.original_position, dv);
                }
                train.object.train_distance = 0;
                Thing.lookup("train floor").options.invisible = false;
                Thing.lookup("train floor broken bottom").z = 0;
                Thing.lookup("train floor broken middle").z = 0;
                Thing.lookup("train floor broken top").z = 0;
            }
            else if (math.equal(train_position, 11.5) && train.object.train_distance !== 6150) {
                const dv = vector.create(6150 - (train.object.train_distance || 0), 0);
                for (const t of Thing.things) {
                    if (!t.id.startsWith("train"))
                        continue;
                    if (t.body)
                        t.translate(dv);
                    else
                        t.position = vector.add(t.position, dv);
                    if (t.object.original_position)
                        t.object.original_position = vector.add(t.object.original_position, dv);
                }
                train.object.train_distance = 6150;
                // also do crash
                player.object.train_time = 10 * config.seconds;
                train.object.crashed = 1;
                Thing.lookup("train floor").options.invisible = true;
                Thing.lookup("train floor broken bottom").z = -0.4;
                Thing.lookup("train floor broken middle").z = -0.2;
                Thing.lookup("train floor broken top").z = -0.4;
            }
        },
        ["station tutorial floor"]: (thing, dt) => {
            if (player.is_safe) {
                if (!save.check_switch("train"))
                    save.set_switch("train", 11);
                detector.sensor_during_fns.set_train(thing, dt);
            }
            else if (save.get_switch("train") === 11.5) {
                window.setTimeout(() => player.fov_mult = 1, 100);
                detector.sensor_during_fns.set_train(thing, dt);
            }
        },
        ["station streets floor 1"]: (thing, dt) => { if (player.is_safe)
            detector.sensor_during_fns.set_train(thing, dt); },
        ["station streets floor 2"]: (thing, dt) => { if (player.is_safe)
            detector.sensor_during_fns.set_train(thing, dt); },
        ["station streets floor 3"]: (thing, dt) => { if (player.is_safe)
            detector.sensor_during_fns.set_train(thing, dt); },
        ["station streets floor 4"]: (thing, dt) => { if (player.is_safe)
            detector.sensor_during_fns.set_train(thing, dt); },
        ["station streets floor 5"]: (thing, dt) => { if (player.is_safe)
            detector.sensor_during_fns.set_train(thing, dt); },
        ["train sensor"]: (thing, dt) => {
            if (player.z >= 0)
                player.fov_mult = 0.6;
            if (player.z >= 0.5 || player.z < 0)
                return;
            const train_time = (player.object.train_time ?? 0) + dt;
            player.object.train_time = train_time;
            save.visit_map("station map train");
            const train = Thing.lookup("train");
            if (train_time > 2.1 * config.seconds || train.object.crashed) {
                if (train.object.crashed) {
                    if (train_time < 2 * config.seconds)
                        player.object.train_time += 2 * config.seconds;
                    const t = (Thing.time - (train.object.crashed ?? 0)) / config.seconds;
                    if (t > 1.1)
                        return;
                    const z = -0.4 * (math.bound(t, 0, 1) ** 2);
                    Thing.lookup("train floor broken bottom").z = z;
                    Thing.lookup("train floor broken middle").z = z / 2;
                    Thing.lookup("train floor broken top").z = z;
                }
                else {
                    const train_speed = math.bound((train_time - 2.1 * config.seconds) / 1000, 0, Math.min(config.physics.train_speed, 6150 - (train.object.train_distance || 0)));
                    if (train_speed === 0 && (train.object.train_distance || 0) > 6149) {
                        // crash!
                        train.object.crashed = Thing.time;
                        Thing.lookup("train floor").options.invisible = true;
                        // player.push_by(vector.create(125, 0));
                        save.set_switch("train", 11.5);
                        player.save();
                    }
                    else {
                        // continue moving train
                        train.object.train_distance = (train.object.train_distance || 0) + train_speed;
                        const dv = vector.create(train_speed, 0);
                        for (const t of Thing.things) {
                            if (!t.id.startsWith("train") && !t.parent.is_player)
                                continue;
                            if (t.body)
                                t.translate(dv);
                            else
                                t.position = vector.add(t.position, dv);
                            if (t.object.original_position)
                                t.object.original_position = vector.add(t.object.original_position, dv);
                        }
                        camera.position.x += train_speed * 1.95;
                    }
                }
            }
            Thing.lookup("train ceiling").shapes[0].style.fill_opacity = 0.5 * math.bound(1 / (player.object.train_time / (0.2 * config.seconds)), 0, 1);
        },
    },
    sensor_start_fns: {
        // nothing for now
        ["tutorial room 1 door sensor"]: (_thing) => {
            Thing.lookup("tutorial room 1 arrow").shapes[0].style.stroke_opacity = 0;
        },
        ["tutorial room 2.5 sensor"]: (_thing) => {
            // const centre = Vertices.centre(Spawner.spawners_lookup["tutorial room 2 breakables 4"].vertices);
            // player.set_checkpoint(vector3.create_(centre, 0));
        },
        ["tutorial room 3 end sensor"]: (_thing) => {
            Thing.lookup("tutorial window 1")?.die();
            Thing.lookup("tutorial window 1 deco").shapes[0].style.stroke_opacity = 0;
        },
        ["tutorial room 5 sensor boss"]: (_thing) => {
            const boss = Spawner.get_enemy("tutorial room 5 boss");
            if (boss) {
                boss.object.start_activated = true;
                // boss.object.end_activated = true;
                // boss.options.enemy_detect_range = 2000;
            }
        },
        ["station tutorial sensor start"]: (thing) => {
            const centre = thing.position;
            player.set_checkpoint(vector3.create_(centre, 0), "station tutorial");
            player.object.train_time = 0;
        },
        ["station streets sensor start"]: (_thing) => {
            // player.object.train_crashed = true;
        },
        ["train sensor"]: (_thing) => {
            player.is_safe = false;
        },
        ["streets room 3 turret 1 button"]: (thing) => {
            const n = +thing.id.split("|")[1];
            thing.shapes[0].style.fill_opacity = 0.5;
            thing.shapes[0].style.stroke_opacity = 0.5;
            thing.shapes[1].style.stroke_opacity = 0.5;
            const parent = thing.parent;
            if (!parent.object.ns)
                parent.object.ns = [];
            const arr = parent.object.ns;
            if (!arr.includes(n)) {
                arr.push(n);
                parent.shield?.hit(100);
            }
            if (arr.length >= 6 || parent.shield?.is_zero) {
                for (const c of (parent.object.children ?? [])) {
                    for (const s of c.shapes)
                        s.opacity = 0.3;
                }
            }
        },
    },
    sensor_end_fns: {
        // nothing for now
        ["train sensor"]: (_thing) => {
            player.is_safe = true;
        },
    },
    // spawner/enemy functions
    before_spawn_fns: {
        ["enemy_streets_camera_small"]: (thing) => {
            if (save.check_switch("jump")) {
                const b = thing.options.behaviour?.normal;
                if (b)
                    b.shoot_mode = "normal";
                thing.options.enemy_safe = false;
                thing.health?.set_capacity(333);
                thing.options.xp = 75;
                const d = thing.options.death?.[0];
                if (d)
                    d.repeat = 3;
                thing.make_shape({
                    type: "line",
                    style: "enemy",
                    v1: vector.create(12, 0),
                    v2: vector.create(30, 0),
                    style_: {
                        opacity: 0.6,
                    },
                    shoot: "enemy_easy",
                });
            }
        },
        ["enemy_streets_turret_1"]: (thing) => {
            const centre = thing.position;
            thing.object.ns = [];
            thing.object.children = [];
            for (let i = 0; i < 6; i++) {
                const angle = 60 * i;
                const t = new Thing();
                t.parent = thing;
                t.position = vector3.add_(centre, vector.createpolar_deg(angle, 240));
                t.angle = vector.deg_to_rad(angle);
                t.make("button_streets_turret_1");
                t.create_id("streets room 3 turret 1 button|" + i);
                t.create_body();
                thing.object.children.push(t);
            }
            thing.remove_fn = () => {
                for (const c of thing.object.children ?? [])
                    c.remove();
            };
        },
    },
    before_death_fns: {
        // nothing for now
        ["tutorial room 2 enemy shooter"]: (thing) => {
            thing.remove_static();
            for (const shape of thing.shapes) {
                shape.style = clone_object(STYLES.main);
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
        ["streets room 3 enemy turret"]: (thing) => {
            thing.remove_static();
            delete thing.options.behaviour;
            // thing.options.enemy_safe = true;
            thing.shapes[1].remove();
            thing.make_shape_key("deco_sad_streets_turret_1");
            Thing.lookup("streets room 3 turret 1 button|0").object.dead = true;
            return true;
        },
    },
    spawner_calc_fns: {
        ["tutorial room 3 enemy 1"]: (spawner) => {
            if (spawner.wave_progress > 0 && spawner.check_progress("tutorial room 3 enemy 2") > 0) {
                spawner.thing_lookup("tutorial window 1")?.die();
                spawner.thing_lookup("tutorial window 1 deco").shapes[0].style.stroke_opacity = 0;
            }
        },
        ["tutorial room 3 enemy 2"]: (spawner) => {
            if (spawner.wave_progress > 0 && spawner.check_progress("tutorial room 3 enemy 1") > 0) {
                spawner.thing_lookup("tutorial window 1")?.die();
                spawner.thing_lookup("tutorial window 1 deco").shapes[0].style.stroke_opacity = 0;
            }
        },
    },
    map_shape_make_fns: {},
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
                        const shape = Thing.lookup("tutorial room 2 warning" + (i > 0 ? " " + i : "")).shapes[0];
                        shape.offset = vector3.create2(warning_offset);
                        shape.style.stroke = STYLES.enemy.stroke;
                        shape.style.stroke_opacity = 0.6;
                        shape.init_computed();
                    }
                    Thing.lookup("tutorial room 2 arrow 2").shapes[0].style.opacity = 0.6;
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
                Thing.lookup("tutorial room 2 arrow 2").shapes[0].style.opacity = 0;
            }
        },
        // tutorial doors
        ["tutorial room 2 door 1"]: (door) => {
            do_door(door, "tutorial room 2 door sensor");
        },
        ["tutorial room 2 door 2"]: (door) => {
            do_door(door, "tutorial room 2 door sensor");
        },
        ["tutorial room 3 door"]: (door) => {
            do_door(door, "tutorial room 3 door sensor");
        },
        // tutorial rocks
        ["tutorial rock 7"]: (door) => {
            switch_door(door, "tutorial room 2 switch", "tutorial room 2 switch path", 1);
        },
        ["tutorial room 2 map rock 1"]: (thing) => {
            // map_copy_position(thing, "tutorial rock 7");
            map_switch_door(thing, "tutorial room 2 switch", "tutorial room 2 switch path");
        },
        ["tutorial rock 11"]: (door) => {
            switch_door(door, Spawner.check_progress("tutorial room 2 enemy shooter") > 0 || door.lookup("tutorial room 2.1 sensor")?.is_touching_player, "tutorial room 2.1 switch path", 1);
        },
        ["tutorial room 2 map rock 9"]: (thing) => {
            map_copy_position(thing, "tutorial rock 11");
            // map_switch_door(thing, Spawner.check_progress("tutorial room 2 enemy shooter") > 0 || door.lookup("tutorial room 2.1 sensor")?.is_touching_player, "tutorial room 2.1 switch path");
        },
        // tutorial boss doors
        ["tutorial room 5 door start"]: (door) => {
            switch_door(door, Spawner.get_enemy("tutorial room 5 boss")?.object?.start_activated, "tutorial room 5 door start path", 6);
        },
        ["tutorial room 5 door end"]: (door) => {
            switch_door(door, Spawner.get_enemy("tutorial room 5 boss")?.object?.end_activated, "tutorial room 5 door end path", 6);
        },
        // station stuff
        ["train door left"]: (door) => {
            switch_door(door, player.object.train_time && player.object.train_time > 1 * config.seconds, "train door left path", 3, true);
        },
        ["train door right"]: (door) => {
            switch_door(door, player.object.train_time && player.object.train_time > 1 * config.seconds, "train door right path", 3, true);
        },
        ["station map train"]: (thing) => {
            const train = thing.lookup("train floor");
            if (train)
                map_copy_position(thing, train);
            else {
                const n = save.get_switch("train");
                let x = make_data.train_centre.x;
                for (const [d, v] of Object.entries(make_data.train_stations)) {
                    if (math.equal(n, +d))
                        x += v.distance;
                }
                thing.position = vector.create(x, make_data.train_centre.y);
            }
        },
        ["station tracks"]: (thing) => {
            if (!thing.object.first_time) {
                thing.object.first_time = 1;
                const shape = thing.lookup("station tracks particle")?.shapes?.[0];
                shape.opacity = 0;
            }
            return;
            // create particles
            // todo rewrite super spaghetti hardcoding in this function
            const opposite_direction = save.get_switch("train") === 11.5 || (player.object.train_distance || 0) > 0;
            if (thing.object.next_time == undefined || thing.thing_time > thing.object.next_time) {
                if (thing.object.next_time != undefined && !thing.object.first_time) {
                    thing.object.first_time = 1;
                    const shape = thing.lookup("station tracks particle")?.shapes?.[0];
                    if (!shape || !shape.computed)
                        return;
                    shape.style.stroke_opacity = 0.6;
                    shape.opacity = 0;
                    const time = 15.5 * config.seconds;
                    // particles not initialized yet! create from x = 1800 to 8300
                    const first_p = new Particle();
                    const p_list = [first_p];
                    let i = 0; // prevent infinite loop
                    while (i < 32) {
                        const p = new Particle();
                        p.style = clone_object(shape.style);
                        p.time = thing.thing_time + time;
                        p.z = shape.z;
                        const off = 417 * 0.5 * i;
                        p.vertices = vector3.add_list(shape.computed?.vertices ?? [], vector.create(opposite_direction ? off : 6500 - off, 0));
                        // p.offset = vector.create(opposite_direction ? off : 6500 - off, 0);
                        p.max_offset_length = 6500 - off;
                        p.velocity = vector.create(opposite_direction ? 417 : -417, 0);
                        p_list.push(p);
                        i++;
                    }
                }
                else if (thing.object.first_time) {
                    const shape = thing.lookup("station tracks particle").shapes[0];
                    shape.opacity = 0;
                    if (!shape.computed)
                        return;
                    const time = 15.5 * config.seconds;
                    const p = new Particle();
                    p.style = clone_object(shape.style);
                    p.time = thing.thing_time + time;
                    p.z = shape.z;
                    p.vertices = shape.computed?.vertices ?? [];
                    p.offset = vector.create(opposite_direction ? 0 : 6500, 0);
                    p.max_offset_length = 6500;
                    p.velocity = vector.create(opposite_direction ? 417 : -417, 0);
                }
                thing.object.next_time = thing.thing_time + 0.5 * config.seconds; // todo why must i wait 0.5 seconds before triggering the first time create
            }
        },
        // streets doors
        ["streets room 2 door 1"]: (door) => {
            switch_door(door, "streets room 2 checkpoint", "streets room 2 door 1");
        },
        ["streets room 2 door 2"]: (door) => {
            switch_door(door, "streets room 2 checkpoint", "streets room 2 door 2");
        },
        ["streets room 2 door 3"]: (door) => {
            switch_door(door, "streets room 2 checkpoint", "streets room 2 door 3");
        },
        ["streets room 2 door 4"]: (door) => {
            switch_door(door, "streets room 2 switch", "streets room 2 door 4");
        },
        ["streets room 3 door 1"]: (door) => {
            switch_door(door, Thing.lookup("streets room 3 turret 1 button|0")?.object.dead, "streets room 3 door 1");
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
        door.translate(vector.normalise(dir, triggered ? speed : -speed));
};
const switch_door = (door, switch_ids, path_id, speed = [5], reversible = false, invert = [false]) => {
    const path = door.lookup(path_id);
    if (path == undefined) {
        console.error(`[detector/switch_door] path "${path_id}" not found!`);
        return;
    }
    const vs = path.shapes[0].vertices;
    const pos = door.position;
    let step = door.object.step ?? 1;
    if (!Array.isArray(switch_ids))
        switch_ids = [switch_ids];
    if (typeof speed === "number")
        speed = [speed];
    if (step >= vs.length || step > switch_ids.length) {
        if (reversible)
            step--;
        else
            return;
    }
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
    if (triggered || (!triggered && reversible)) {
        const target_dv = vector.sub(vs[triggered ? step : step - 1], vs[0]);
        const door_dv = vector.sub(vector.add(door.object.original_position, target_dv), pos);
        const sped = speed[step] ?? speed[0];
        if (vector.equal(door_dv, vector.create())) {
            door.object.step = triggered ? step + 1 : step;
        }
        else if (vector.length(door_dv) <= sped) {
            door.translate(door_dv);
            door.object.step = triggered ? step + 1 : step;
        }
        else {
            door.translate(vector.normalise(door_dv, sped));
        }
    }
};
const map_switch_door = (door, switch_ids, path_id) => {
    let step = door.object.step ?? 1;
    if (door.object.step == undefined) {
        door.object.original_position = vector.clone(door.position);
        door.object.step = step;
    }
    if (!Array.isArray(switch_ids))
        switch_ids = [switch_ids];
    if (step > switch_ids.length)
        return;
    const sid = switch_ids[step - 1];
    if (typeof sid === "boolean" ? sid : save.check_switch(sid)) {
        const vs = MAP.computed?.shape_map[path_id].vertices;
        if (!vs || step >= vs.length)
            return;
        const v = vector.sub(vs[step], vs[0]);
        door.position = vector.add(door.object.original_position, v);
        step++;
        door.object.step = step;
    }
    else
        return;
};
const map_copy_position = (thing, other) => {
    if (typeof other === "string")
        other = thing.lookup(other);
    if (other?.position)
        thing.position = vector.clone(other.position);
};
