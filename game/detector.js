import { engine } from "../index.js";
import { Events } from "../matter.js";
import { vector } from "../util/vector.js";
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
        console.log(`Collision started betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                b.is_touching_player = true;
            }
        }
    },
    collision_end: (pair, ba, bb, flipped) => {
        const a = ba.parent.thing, b = bb.parent.thing;
        console.log(`Collision ended betwixt ${ba.label} & ${bb.label}!`);
        if (a.is_player) {
            if (b.options.sensor) {
                b.is_touching_player = false;
            }
        }
    },
    collision_fns: {
        ["tutorial door 1 sensor"]: (thing) => {
            const door = thing.lookup("tutorial door 1");
            if (door) {
                const vs = door.shapes[0].vertices;
                const diff = vector.sub(vs[1], vs[0]);
                const exceeded = door.position.y - door.target.position.y > diff.y;
                door.translate(vector.normalise(diff, exceeded ? 5 : 10));
            }
        },
    },
    tick_fns: {
        ["tutorial door 1"]: (door) => {
            const vs = door.shapes[0].vertices;
            if (door.position.y > door.target.position.y)
                door.translate(vector.normalise(vector.sub(vs[1], vs[0]), -5));
        },
    },
};
