import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";
export default function () {
    make.collect = {
        seethrough: true,
    };
    // @coins
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
    // @eggs
    make.collect_egg = {
        make_parent: ["collect"],
        style: "train",
        movable: false,
    };
    make.collect_egg_1 = {
        make_parent: ["collect_egg"],
        collectible: {
            currency_name: "egg",
            currency_amount: 1,
        },
    };
    make_shapes.collect_egg_1 = [{
            type: "circle",
            radius: 24,
            glowing: 0.1,
        }, {
            type: "circle",
            radius: 1,
        }];
    // @guns
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
                spin_speed: 2,
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
    // @shapey
    make.collect_shapey = {
        make_parent: ["collect"],
        movable: false,
    };
    make.collect_shapey_triangle_speed = {
        make_parent: ["collect_shapey"],
        collectible: {
            shapey: "triangle_speed",
        },
        style: "collect_streets",
    };
    make_shapes.collect_shapey_triangle_speed = [{
            type: "polygon",
            sides: 3,
            radius: 35,
        }, {
            type: "polygon",
            sides: 3,
            radius: 10,
            offset: vector.create(12, 0),
            style_: { width: 0.5, fill_opacity: 0, },
        }, {
            type: "line",
            v1: vector.create(3, 0),
            v2: vector.create(-12, 0),
            style_: { width: 0.5, },
        }, {
            type: "line",
            v1: vector.create(3, 4),
            v2: vector.create(-6, 4),
            style_: { width: 0.5, },
        }, {
            type: "line",
            v1: vector.create(3, -4),
            v2: vector.create(-9, -4),
            style_: { width: 0.5, },
        }];
}
;
