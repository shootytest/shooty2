import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";
export default function () {
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
    make.wall_door = {
        wall_filter: "wall",
        style: "door",
        translucent: 0.5,
        style_: {
            stroke_opacity: 0.5,
        },
    };
    make.wall_window = {
        wall_filter: "window",
        style: "wall_window",
        keep_bullets: true,
        seethrough: true,
    };
    make.wall_floor = {
        wall_filter: "wall",
        style: "wall_floor",
        force_wall_body: true,
        seethrough: true,
    };
    make.wall_floor_halfwidth = {
        wall_filter: "wall",
        style: "wall_floor",
        force_wall_body: true,
        seethrough: true,
        style_: {
            width: 0.5,
        },
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
    make.wall_tutorial_curtain = {
        wall_filter: "curtain",
        style: "tutorial_curtain",
        seethrough: true,
    };
    make.wall_tutorial_rock_breakable = {
        make_parent: ["rock"],
        keep_bullets: false,
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
            opacity: 0.6,
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
    make.button_streets_turret_1 = {
        make_parent: ["sensor"],
        invisible: false,
    };
    make_shapes.button_streets_turret_1 = [{
            type: "polygon",
            sides: 3,
            radius: 15,
            style_: { stroke_opacity: 0.2, },
        }, {
            type: "line",
            v1: vector.create(-7, 0),
            v2: vector.create(-140, 0),
            style: "sensor_path",
            style_: { width: 0.5, stroke_opacity: 0.2, },
        }];
    // @checkpoints
    make.checkpoint = {
        style: "switch",
        team: 0,
        switch: true,
        checkpoint: true,
        seethrough: true,
        restitution: 0,
        safe_floor: true,
    };
    make.checkpoint_map = {
        style: "switch",
        team: 0,
        seethrough: true,
        style_: { stroke_opacity: 0 },
    };
    make.checkpoint_tutorial_room_2 = {
        make_parent: ["checkpoint"],
    };
    make_shapes.checkpoint_tutorial_room_2 = [{
            type: "circle",
            radius: 50,
        }, {
            type: "polygon",
            sides: 7,
            radius: 150,
            floor: true,
            style_: { stroke_opacity: 0 },
        }, {
            type: "polygon",
            sides: 7,
            radius: 50,
            z: 0.25,
            floor: true,
            safe_floor: false,
            style_: { stroke_opacity: 0 },
        }];
    make.checkpoint_streets_room_2 = {
        make_parent: ["checkpoint"],
        angle: 30,
    };
    make_shapes.checkpoint_streets_room_2 = [{
            type: "circle",
            radius: 60,
        }, {
            type: "polygon",
            sides: 3,
            radius: 360,
            floor: true,
            style_: { stroke_opacity: 0 },
        }, {
            type: "polygon",
            sides: 3,
            radius: 60,
            z: 0.2,
            floor: true,
            safe_floor: false,
            style_: { stroke_opacity: 0 },
        }];
    make.checkpoint_map_streets_room_2 = {
        make_parent: ["checkpoint_map"],
        angle: 30,
    };
    make_shapes.checkpoint_map_streets_room_2 = [{
            type: "circle",
            radius: 60,
        }, {
            type: "polygon",
            sides: 3,
            radius: 360,
        }];
}
;
