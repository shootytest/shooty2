import { make, make_shapes } from "../game/make.js";
export default function () {
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
    make.bullet_triangle = {
        make_parent: ["bullet"],
    };
    make_shapes.bullet_triangle = [{
            type: "polygon",
            sides: 3,
            radius: 1,
        }];
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
}
;
