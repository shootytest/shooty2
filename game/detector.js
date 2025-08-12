import { engine } from "../index.js";
import { Events } from "../matter.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { player } from "./player.js";
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
        // console.log(`Collision started betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                detector.collision_start_fns[b.id]?.(b);
                b.is_touching_player = true;
            }
        }
    },
    collision_end: (pair, ba, bb, flipped) => {
        const a = ba.parent.thing, b = bb.parent.thing;
        // console.log(`Collision ended betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                detector.collision_end_fns[b.id]?.(b);
                b.is_touching_player = false;
            }
        }
    },
    collision_during_fns: {
        ["tutorial room 1 sensor"]: (thing) => {
            thing.lookup("tutorial room 1 arrow").shapes[0].style.stroke_opacity = 1 - math.bound((player.position.x - thing.position.x) / 350, 0, 1);
        },
    },
    collision_start_fns: {
    // nothing for now
    },
    collision_end_fns: {
    // nothing for now
    },
    tick_fns: {
        ["tutorial door 1"]: (door) => {
            const vs = door.shapes[0].vertices;
            const diff = vector.sub(vs[1], vs[0]);
            const triggered = Boolean(door.lookup("tutorial door 1 sensor")?.is_touching_player);
            let exceeded = true;
            if (triggered)
                exceeded = door.position.y - door.target.position.y > diff.y;
            else
                exceeded = door.position.y <= door.target.position.y;
            if (!exceeded)
                door.translate(vector.normalise(diff, triggered ? 5 : -5));
        },
    },
};
