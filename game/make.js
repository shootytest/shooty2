import { vector } from "../util/vector.js";
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
// @default
make.default = {};
// @environment
// @walls
make.wall = {
    wall_filter: "wall",
    style: "wall",
};
make.rock = {
    wall_filter: "wall",
    style: "wall_filled",
    keep_bullets: true,
};
make.spike = {
    wall_filter: "wall",
    style: "enemy",
    cover_z: false,
    keep_bullets: false,
    seethrough: true,
    damage: 100,
};
make.wall_floor = {
    wall_filter: "wall",
    style: "wall_floor",
    force_wall_body: true,
    seethrough: true,
};
make.wall_part = {
    wall_filter: "wall",
    style: "wall",
    force_wall_body: true,
    seethrough: true,
};
make.rock_part = {
    wall_filter: "wall",
    style: "wall_filled",
    force_wall_body: true,
    keep_bullets: true,
    seethrough: true,
};
make.wall_train = {
    make_parent: ["wall"],
    style: "train",
    style_: {
        width: 0.5,
        opacity: 0.7,
    },
    force_wall_body: true,
    force_max_z: true,
    seethrough: true,
    keep_bullets: true,
};
make.wall_tutorial_window = {
    // make_parent: ["wall"], // hmmm it's not needed for now
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
make.wall_tutorial_rock_breakable = {
    make_parent: ["rock"],
    hide_health: true,
    hide_health_until: 450,
    team: 7,
    health: {
        capacity: 1000,
    },
    xp: 0,
};
make.wall_tutorial_fake = {
    make_parent: ["wall"],
    style: "wall",
    style_: {
        opacity: 0.65,
    },
    hide_health: true,
    hide_health_until: 450,
    health: {
        capacity: 700,
    },
    xp: 150,
};
make.wall_streets_fake = {
    make_parent: ["wall"],
    style: "wall",
    style_: {
        opacity: 0.65,
    },
    hide_health: true,
    hide_health_until: 450,
    health: {
        capacity: 700,
    },
    xp: 200,
};
// @floors
make.floor = {
    floor: true,
    decoration: true,
    seethrough: true,
    keep_bullets: true,
    style: "floor",
};
make.floor_train = {
    make_parent: ["floor"],
    style: "train_floor",
};
make.floor_train_track = {
    make_parent: ["floor"],
    style: "train_track",
};
// @sensors
make.sensor = {
    style: "sensor",
    sensor: true,
    invisible: true,
    seethrough: true,
    keep_bullets: true,
};
make.sensor_path = {
    style: "sensor_path",
    decoration: true,
    invisible: true,
    seethrough: true,
    keep_bullets: true,
};
make.switch = {
    style: "switch",
    team: 0,
    switch: true,
    seethrough: true,
    restitution: 0,
};
make_shapes.switch = [{
        type: "circle",
        radius: 15,
    }];
make.checkpoint = {
    style: "switch",
    team: 0,
    switch: true,
    seethrough: true,
    restitution: 0,
};
make_shapes.checkpoint = [{
        type: "circle",
        radius: 50,
    }, {
        type: "polygon",
        sides: 7,
        radius: 50,
        z: 0.2,
        floor: true,
    }, {
        type: "circle",
        radius: 50,
        z: 0.1,
        style_: { stroke_opacity: 0, }
    }];
// @decorations
make.icon = {
    decoration: true,
    seethrough: true,
    style: "main",
    style_: {
        opacity: 0.6,
    },
};
make.icon_tutorial = {
    make_parent: ["icon"],
};
make.deco = {
    decoration: true,
    seethrough: true,
    keep_bullets: true,
};
make.deco_gun_basic = {
    make_parent: ["deco"],
    style: "collect_gun",
    style_: {
        stroke_opacity: 0.3,
        fill_opacity: 0,
    },
};
make_shapes.deco_gun_basic = [];
for (let i = 0; i < 10; i++) {
    make_shapes.deco_gun_basic.push({
        type: "polygon",
        sides: 7,
        angle: 0.175 * i,
        radius: 330 - i * 30,
        z: -(0.3 - i * 0.03),
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
    style: "enemy",
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
    style: "breakable",
};
// @e tutorial
make.enemy_tutorial = {
    make_parent: ["enemy"],
    team: 7,
};
// only used betwixt tutorial room 2 and tutorial room 2.5
make.enemy_tutorial_block = {
    make_parent: ["enemy_tutorial"],
    style: "coin_rock_1",
    movable: false,
    seethrough: false,
    angle: 0,
    health: {
        capacity: 500,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 1.5, detect_range_mult: 2 }, repeat: 6, angle_increment: 60 },
    ],
    xp: 100,
};
make_shapes.enemy_tutorial_block = [{
        type: "polygon",
        sides: 7,
        radius: 50,
    }];
// coin rock for tutorial
make.enemy_tutorial_rocky = {
    make_parent: ["enemy_tutorial"],
    movable: false,
    style: "coin_rock_1",
    health: {
        capacity: 400,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 2, detect_range_mult: 2 }, repeat: 5, angle_increment: 72 },
        { type: "collect_coin", stats: { make: "collect_coin_5", speed: 0, detect_range_mult: 2 }, repeat: 1 },
    ],
    xp: 100,
};
make_shapes.enemy_tutorial_rocky = [{
        type: "polygon",
        sides: 7,
        radius: 50,
        glowing: 0.1,
    }, {
        type: "polygon",
        style: "coin_rock_2",
        sides: 7,
        radius: 25,
        glowing: 0.5,
    }];
// coin rock in tutorial room 5, only accessible from the tutorial station
make.enemy_tutorial_rocky_small = {
    make_parent: ["enemy_tutorial"],
    movable: false,
    style: "coin_rock_1",
    health: {
        capacity: 500,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 2, detect_range_mult: 3, }, repeat: 10, angle_increment: 36 },
        { type: "collect_coin", stats: { make: "collect_coin_5", speed: 0, detect_range_mult: 3, }, repeat: 1 },
    ],
    xp: 150,
};
make_shapes.enemy_tutorial_rocky_small = [{
        type: "polygon",
        sides: 7,
        radius: 30,
    }, {
        type: "polygon",
        style: "coin_rock_2",
        sides: 7,
        radius: 15,
        glowing: 0.6,
    }];
// testing in tutorial room 4 secret
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
// main enemy in tutorial room 2
make.enemy_tutorial_4way = {
    make_parent: ["enemy_tutorial"],
    movable: false,
    behaviour: {
        normal: {
            shoot_mode: "normal",
        },
        idle: {
            shoot_mode: "normal",
        },
    },
    angle: -360 / 14,
    enemy_detect_range: 360,
    focus_camera: true,
    health: {
        capacity: 750,
    },
    xp: 100,
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
// main enemies in tutorial room 3
make.enemy_tutorial_easy = {
    make_parent: ["enemy_tutorial"],
    behaviour: {
        normal: {
            shoot_mode: "normal",
            move_mode: "direct",
            face_mode: "direct",
            move_speed: 3,
        },
        idle: {
            face_mode: "wander",
            move_mode: "wander",
            move_speed: 0.5,
            wander_time: 2,
            wander_distance: 150,
            wander_cooldown: 0.6,
            face_smoothness: 0.05,
        },
    },
    enemy_detect_range: 500,
    health: {
        capacity: 250,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 2 },
    ],
    xp: 50,
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
// main enemy in tutorial room 5.5
make.enemy_tutorial_easy_static = {
    make_parent: ["enemy_tutorial"],
    behaviour: {
        normal: {
            shoot_mode: "normal",
            move_mode: "static",
            face_mode: "direct",
        },
        idle: {
            face_mode: "wander",
            move_mode: "static",
            wander_time: 0.5,
            wander_distance: 100,
            wander_cooldown: 0,
            face_smoothness: 0.05,
        },
    },
    enemy_detect_range: 500,
    health: {
        capacity: 450,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 4 },
    ],
    xp: 80,
};
make_shapes.enemy_tutorial_easy_static = [{
        type: "polygon",
        sides: 7,
        radius: 40,
    }, {
        type: "line",
        v2: vector.createpolar_deg(0, 40),
        shoot: "enemy_easy_static",
    }];
// generic small breakable everywhere in the tutorial
make.enemy_tutorial_bit = {
    make_parent: ["enemy_tutorial", "enemy_breakable"],
    behaviour: {
        idle: {
            face_mode: "spin",
            move_mode: "direct",
        }
    },
    enemy_detect_range: 0,
    style_: {
        opacity: 0.6,
    },
    xp: 2,
};
make_shapes.enemy_tutorial_bit = [{
        type: "polygon",
        sides: 7,
        radius: 10,
    }];
// todo unused, maybe for tutorial's void decoration?
make.enemy_tutorial_big = {
    make_parent: ["enemy_tutorial"],
    behaviour: {
        idle: {
            face_mode: "spin",
            move_mode: "direct",
            move_speed: 0.5,
        }
    },
    enemy_detect_range: 0,
    style: "breakable",
};
make_shapes.enemy_tutorial_big = [{
        type: "polygon",
        sides: 7,
        radius: 100,
    }];
// blockage in tutorial room 2.5 secret
make.enemy_tutorial_down = {
    make_parent: ["enemy_tutorial"],
    style: "wall",
    movable: false,
    behaviour: {
        normal: {
            shoot_mode: "normal",
        }
    },
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
// tutorial room 5's huge boss
make.enemy_tutorial_boss = {
    make_parent: ["enemy_tutorial"],
    behaviour: {
        normal: [{
                time: 1,
                shoot_index: 0,
                shoot_mode: "single",
                face_mode: "predict2",
                // face_predict_amount: 0.7,
            }, {
                time: 0.5,
                shoot_index: [1, 2],
                shoot_mode: "single",
                face_mode: "predict2",
            }, {
                time: 0.5,
                shoot_index: 3,
                shoot_mode: "normal",
                face_mode: "direct",
            }],
    },
    movable: false,
    enemy_detect_range: 0,
    focus_camera: true,
    zzz_sleeping: true,
    repel_range: 200,
    repel_force: 100,
    angle: 90,
    health: {
        capacity: 10000,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_10", speed: 5 }, repeat: 36, angle_increment: 10 },
    ],
    shoots: ["enemy_tutorial_boss_spam"],
    xp: 999999, // lol
};
make_shapes.enemy_tutorial_boss = [{
        type: "polygon",
        sides: 7,
        radius: 150,
    }, {
        type: "line",
        v2: vector.createpolar_deg(0, 150),
        shoot: "enemy_tutorial_boss_homing",
    }, {
        type: "line",
        style: "enemy2",
        v2: vector.createpolar_deg(-360 / 14, 136),
        shoot: "enemy_tutorial_boss_split",
        shoot_: { delay: 0.5, angle: -360 / 14, },
    }, {
        type: "line",
        style: "enemy2",
        v2: vector.createpolar_deg(360 / 14, 136),
        shoot: "enemy_tutorial_boss_split",
        shoot_: { delay: 0.5, angle: 360 / 14, },
    }];
// @e streets
make.enemy_streets = {
    make_parent: ["enemy"],
    team: 3,
};
// coin rock for streets
make.enemy_streets_rocky = {
    make_parent: ["enemy_streets"],
    movable: false,
    style: "coin_rock_1",
    health: {
        capacity: 300,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 2.5, detect_range_mult: 2 }, repeat: 3, angle_increment: 120 },
        { type: "collect_coin", stats: { make: "collect_coin_5", speed: 1.5, detect_range_mult: 2 }, repeat: 3, angle_increment: 120, angle: 60 },
    ],
    xp: 100,
};
make_shapes.enemy_streets_rocky = [{
        type: "polygon",
        sides: 3,
        radius: 40,
    }, {
        type: "polygon",
        style: "coin_rock_2",
        sides: 3,
        radius: 15,
        glowing: 0.5,
    }];
// coin rock in station streets, easy to get
make.enemy_streets_rocky_small = {
    make_parent: ["enemy_streets"],
    movable: false,
    style: "coin_rock_1",
    health: {
        capacity: 250,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 2, detect_range_mult: 2 }, repeat: 6, angle_increment: 60 },
        // { type: "collect_coin", stats: { make: "collect_coin_5", speed: 0 }, repeat: 1 },
    ],
    xp: 50,
};
make_shapes.enemy_streets_rocky_small = [{
        type: "polygon",
        sides: 3,
        radius: 30,
    }, {
        type: "polygon",
        style: "coin_rock_2",
        sides: 3,
        radius: 10,
        glowing: 0.5,
    }];
// small breakable
make.enemy_streets_bit = {
    make_parent: ["enemy_streets", "enemy_breakable"],
    behaviour: {
        idle: {
            face_mode: "spin",
            move_mode: "direct",
        }
    },
    enemy_detect_range: 0,
    style_: {
        opacity: 0.6,
    },
    xp: 3,
};
make_shapes.enemy_streets_bit = [{
        type: "polygon",
        sides: 3,
        radius: 10,
    }];
// scattered enemies in streets
make.enemy_streets_easy_1 = {
    make_parent: ["enemy_streets"],
    behaviour: {
        normal: {
            shoot_mode: "normal",
            move_mode: "direct",
            face_mode: "direct",
            move_speed: 3,
        },
        idle: {
            face_mode: "wander",
            move_mode: "wander",
            move_speed: 0.4,
            wander_time: 1.5,
            wander_distance: 100,
            wander_cooldown: 0.6,
            face_smoothness: 0.05,
        },
    },
    enemy_detect_range: 500,
    health: {
        capacity: 350,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 3 },
    ],
    xp: 60,
};
make_shapes.enemy_streets_easy_1 = [{
        type: "polygon",
        sides: 3,
        radius: 30,
    }, {
        type: "line",
        v2: vector.createpolar_deg(0, 30),
        shoot: "enemy_easy",
    }];
// scattered cameras in streets
make.enemy_streets_camera_small = {
    make_parent: ["enemy_streets"],
    style: "enemy_camera",
    movable: false,
    behaviour: {
        normal: {
            // shoot_mode: "normal",
            move_mode: "static",
            face_mode: "direct",
        },
        idle: {
            move_mode: "static",
            face_mode: "wander",
            wander_time: 1.5,
            wander_distance: 100,
            wander_cooldown: 1,
            face_smoothness: 0.05,
        },
    },
    enemy_detect_range: 400,
    enemy_safe: true,
    health: {
        capacity: 250,
    },
    death: [
        { type: "collect_coin", stats: { make: "collect_coin_1", speed: 1, spread_angle: -1 }, repeat: 1 },
    ],
    xp: 10,
};
make_shapes.enemy_streets_camera_small = [{
        type: "polygon",
        sides: 3,
        radius: 30,
    }, {
        type: "line",
        v1: vector.create(6, 0),
        v2: vector.create(6, 0),
    }, /*{
      type: "line",
      v2: vector.createpolar_deg(0, 30),
      shoot: "enemy_easy",
    }*/
];
// @bullets
make.bullet = {
    movable: true,
    seethrough: true,
};
make.bullet_homing = {
    make_parent: ["bullet"],
    behaviour: {
        normal: {
            move_mode: "direct",
            face_mode: "direct",
            move_speed: 5,
        }
    },
    enemy_detect_range: 1000,
};
make.bullet_tutorial_boss_split = {
    make_parent: ["bullet"],
};
make_shapes.bullet_tutorial_boss_split = [{
        type: "circle",
        radius: 1,
    }, {
        type: "circle",
        style: "enemy",
        style_: {
            fill_opacity: 0.07,
            stroke_opacity: 0,
        },
        radius: 7,
    }, {
        type: "circle",
        style: "enemy",
        style_: {
            fill_opacity: 0.03,
            stroke_opacity: 0.3,
        },
        radius: 7,
        clip: {
            shape: "circle",
            timing: "bullet",
            start: 0,
            end: 1,
        },
    }];
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
    behaviour: {
        normal: {
            face_mode: "direct",
            move_mode: "direct",
            move_speed: 4.5,
        }
    },
    enemy_detect_range: 250,
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
    behaviour: {
        idle: {
            face_mode: "spin",
            spin_speed: 0.02,
        }
    },
    enemy_detect_range: 0,
    collectible: {
        gun: "basic",
        restore_all_health: true,
    },
    xp: 500,
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
    reload: 0.5,
    speed: 8,
    spread_angle: 0.03,
    friction: 0.0025,
    restitution: 1,
    recoil: 1,
    damage: 100,
    time: 0.8,
};
make_shoot.half_reload = {
    reload: 0.5,
};
make_shoot.player_basic = {
    parent: ["player"],
};
make_shoot.collect_coin = {
    speed: 2.5,
    spread_angle: 0.03,
    spread_speed: 0.1,
    friction: 0.06,
};
make_shoot.enemy = {
    make: "bullet",
    size: 10,
    reload: 0.42,
    speed: 8,
    friction: 0,
    restitution: 1,
    recoil: 1,
    damage: 100,
    time: 1,
};
make_shoot.enemy_easy = {
    parent: ["enemy"],
    size: 11,
    spread_angle: 0.05,
    reload: 1.1,
    speed: 4,
    time: 2,
};
make_shoot.enemy_easy_static = {
    parent: ["enemy"],
    size: 12,
    spread_angle: 0.02,
    reload: 0.6,
    speed: 5,
    time: 1.5,
};
make_shoot.enemy_block = {
    parent: ["enemy"],
    size: 13,
    spread_angle: 0,
    reload: 0.05,
    speed: 10,
    time: 1.6,
    density: 999999,
    damage: 0,
};
make_shoot.enemy_4way = {
    parent: ["enemy"],
    size: 12,
    reload: 1,
    speed: 4,
    recoil: 0,
    time: 1.7,
};
make_shoot.enemy_tutorial_boss_spam = {
    parent: ["enemy"],
    size: 10,
    reload: 0.05,
    speed: 11,
    spread_angle: 0.01,
    damage: 100,
    time: 3,
    friction: 0.005,
};
make_shoot.enemy_tutorial_boss_homing = {
    parent: ["enemy"],
    size: 18,
    reload: 0.5,
    speed: 10,
    spread_angle: 0.06,
    damage: 200,
    time: 3,
    death: [{
            type: "enemy_tutorial_boss_homing",
            stats: { make: "bullet_homing", death: [{ type: "none" }], speed: 15, friction: 0.06, time: 0.5, damage: 200, },
            repeat: 1,
            angle: 180,
            offset: vector.create(0, -10),
        }],
};
make_shoot.enemy_tutorial_boss_split = {
    parent: ["enemy"],
    make: "bullet_tutorial_boss_split",
    style: "tutorial_boss",
    size: 25,
    reload: 0.5,
    speed: 23,
    random_speed: 7,
    spread_angle: 0.05,
    damage: 200,
    time: 1.5,
    friction: 0.05,
    death: [{ type: "enemy_tutorial_boss_splitted", repeat: 14, angle_increment: 360 / 14, }],
};
make_shoot.enemy_tutorial_boss_splitted = {
    parent: ["enemy"],
    size: 10,
    speed: 40,
    spread_angle: 0.05,
    damage: 100,
    time: 0.45,
    friction: 0.19,
};
// @rooms and @areas
export const make_areas = {
// todo
};
;
export const make_rooms = {
    ["default"]: {
        theme: "default",
    },
    ["home"]: {
        theme: "home",
    },
    ["station"]: {
        theme: "train",
    },
    ["station tutorial"]: {
        theme: "tutorial",
        theme_mix: "train",
        theme_mix_strength: 0.2,
    },
    ["station streets"]: {
        theme: "streets",
        theme_mix: "train",
        theme_mix_strength: 0.2,
    },
    ["tutorial room 1"]: {
        theme: "tutorial",
    },
    ["tutorial room 2"]: {
        theme: "tutorial",
    },
    ["tutorial room 3"]: {
        theme: "tutorial",
    },
    ["tutorial room 4"]: {
        theme: "tutorial",
    },
    ["tutorial room 5"]: {
        theme: "tutorial",
    },
    ["streets room 1"]: {
        theme: "streets",
    },
};
const calculated_keys = ["default"];
const calculated_shoot_keys = [];
// for (const m of Object.values(make)) {
//   if (m.make_parent == undefined) m.make_parent = ["default"];
//   else m.make_parent.unshift("default");
// }
// clone functions
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
                result[k].push(typeof a === "object" ? clone_object(a) : a);
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
                if (i >= m_target[k].length)
                    m_target[k].push(typeof a === "object" ? clone_object(a) : a);
                else if (typeof a === "object")
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
                else if (typeof a === "object")
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
