import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";
export default function () {
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
    // @tutorial
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
        enemy_detect_range: 350,
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
        repel_force: 1,
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
                move_speed: 2.5,
            },
            idle: {
                face_mode: "spin",
                move_mode: "direct",
                move_speed: 0.5,
                face_smoothness: 0.05,
            },
        },
        enemy_detect_range: 400,
        health: {
            capacity: 360,
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
            shoot: "enemy_streets_easy_1",
        }, {
            type: "line",
            v1: vector.createpolar_deg(120, 15),
            v2: vector.createpolar_deg(120, 30),
            shoot: "enemy_streets_easy_back",
            shoot_: { angle: 120, always_shoot: true, },
        }, {
            type: "line",
            v1: vector.createpolar_deg(240, 15),
            v2: vector.createpolar_deg(240, 30),
            shoot: "enemy_streets_easy_back",
            shoot_: { delay: 0.5, angle: 240, always_shoot: true, },
        }];
    make.enemy_streets_easy_2 = {
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
                move_speed: 0.5,
                wander_time: 1.5,
                wander_distance: 100,
                wander_cooldown: 0.6,
                face_smoothness: 0.05,
            },
        },
        enemy_detect_range: 400,
        health: {
            capacity: 480,
        },
        death: [
            { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 4 },
        ],
        xp: 80,
    };
    make_shapes.enemy_streets_easy_2 = [{
            type: "polygon",
            sides: 3,
            radius: 33,
        }, {
            type: "line",
            v2: vector.createpolar_deg(0, 15),
            shoot: "enemy_streets_easy_2",
        }, {
            type: "line",
            v1: vector.createpolar_deg(0, -9),
            v2: vector.createpolar_deg(0, -9),
        }];
    make.enemy_streets_ram_1 = {
        make_parent: ["enemy_streets"],
        behaviour: {
            normal: {
                shoot_mode: "normal",
                move_mode: "direct",
                face_mode: "direct",
                move_speed: 4,
            },
            idle: {
                shoot_mode: "normal",
                face_mode: "wander",
                move_mode: "wander",
                move_speed: 0.5,
                wander_time: 1.5,
                wander_distance: 100,
                wander_cooldown: 0.6,
                face_smoothness: 0.05,
            },
        },
        enemy_detect_range: 300,
        health: {
            capacity: 250,
        },
        damage: 100,
        death: [
            { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 2 },
        ],
        xp: 40,
    };
    make_shapes.enemy_streets_ram_1 = [{
            type: "polygon",
            sides: 3,
            radius: 25,
        }, {
            type: "line",
            v2: vector.create(-12, 0),
            shoot: "enemy_streets_ram_1",
            shoot_: { angle: 180, },
        }, {
            type: "line",
            v1: vector.create(0, 7),
            v2: vector.create(-12, 10),
            shoot: "enemy_streets_ram_1",
            shoot_: { angle: 165, },
        }, {
            type: "line",
            v1: vector.create(0, -7),
            v2: vector.create(-12, -10),
            shoot: "enemy_streets_ram_1",
            shoot_: { angle: 195, },
        }];
    make.enemy_streets_turret_1 = {
        make_parent: ["enemy_streets"],
        movable: false,
        behaviour: {
            normal: {
                shoot_mode: "normal",
                move_mode: "static",
                face_mode: "predict",
                face_predict_amount: 0.5,
            },
            idle: {
                face_mode: "wander",
                move_mode: "static",
                wander_time: 1,
                wander_distance: 100,
                wander_cooldown: 0,
                face_smoothness: 0.04,
            },
        },
        enemy_detect_range: 500,
        health: {
            capacity: 650,
        },
        shield: {
            capacity: 600,
        },
        hide_shield: true,
        repel_force: 1,
        repel_range: 100,
        repel_angles: [[0, 360]],
        death: [
            { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 6 },
        ],
        xp: 150,
    };
    make_shapes.enemy_streets_turret_1 = [{
            type: "polygon",
            sides: 3,
            radius: 48,
        }, {
            type: "line",
            v1: vector.createpolar_deg(0, -24),
            v2: vector.createpolar_deg(0, 48),
            shoot: "enemy_streets_turret_1",
        }];
    make.enemy_streets_turret_spam = {
        make_parent: ["enemy_streets"],
        movable: false,
        behaviour: {
            normal: {
                shoot_mode: "normal",
            },
            idle: {
                shoot_mode: "normal",
            },
        },
        enemy_detect_range: 400,
        health: {
            capacity: 200,
        },
        repel_force: 1,
        repel_range: 50,
        repel_angles: [[-120, 120]],
        death: [
            { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.6, spread_angle: -1 }, repeat: 3 },
        ],
        xp: 100,
    };
    make_shapes.enemy_streets_turret_spam = [{
            type: "polygon",
            sides: 3,
            radius: 36,
        }, {
            type: "line",
            v1: vector.createpolar_deg(0, -18),
            v2: vector.createpolar_deg(0, 36),
            shoot: "enemy_streets_turret_spam",
        }];
    make.enemy_streets_turret_reward = {
        make_parent: ["enemy_streets_turret_spam"],
        death: [
            { type: "collect_egg", stats: { make: "collect_egg_1" }, repeat: 1 },
        ],
    };
    make_shapes.enemy_streets_turret_reward = make_shapes.enemy_streets_turret_spam;
    // scattered cameras in streets
    make.enemy_streets_camera_small = {
        make_parent: ["enemy_streets"],
        team: 13,
        style: "enemy_camera",
        movable: false,
        behaviour: {
            normal: {
                // shoot_mode: "normal",
                move_mode: "static",
                face_mode: "direct",
                face_smoothness: 0.1,
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
            { type: "collect_coin", stats: { make: "collect_coin_1", speed: 0.9, spread_angle: -1 }, repeat: 1 },
        ],
        xp: 20,
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
}
;
