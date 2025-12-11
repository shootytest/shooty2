import { make, make_shapes } from "../game/make.js";
import { vector } from "../util/vector.js";
export default function () {
    make.map_shape = {
        decoration: true,
        seethrough: true,
        style: "map",
    };
    make.map_inverse = {
        make_parent: ["map_shape"],
        style: "map_inverse",
    };
    make.map_newline = {
        make_parent: ["map_shape"],
        style: "map_line",
    };
    make.map_line = {
        make_parent: ["map_shape"],
        style: "map_line",
    };
    make.map_line_dark = {
        make_parent: ["map_shape"],
        style: "map_line_dark",
    };
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
            stroke_opacity: 0.1,
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
            z: (0.3 - i * 0.03),
        });
    }
    make.deco_sad_streets_turret_1 = {
        make_parent: ["deco"],
        style: "enemy",
    };
    make_shapes.deco_sad_streets_turret_1 = [{
            type: "arc",
            radius: 15,
            arc_start: -1,
            arc_end: 1,
            offset: vector.create(-21, 0),
            style_: {
                fill_opacity: 0,
            },
        }, {
            type: "circle",
            radius: 1,
            offset: vector.createpolar_deg(45, 14),
        }, {
            type: "circle",
            radius: 1,
            offset: vector.createpolar_deg(315, 14),
        }];
}
;
