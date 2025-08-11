import { engine } from "../index.js";
import { Events, Pair } from "../matter.js";
import { vector } from "../util/vector.js";
import type { Thing } from "./thing.js";

export const detector = {
  init: function() {
    Events.on(engine, "collisionStart", function(event) {
      for (const pair of event.pairs) {
        const ba = pair.bodyA, bb = pair.bodyB;
        detector.collision_start(pair, ba, bb, false);
        detector.collision_start(pair, bb, ba, true);
      }
    });
    Events.on(engine, "collisionEnd", function(event) {
      for (const pair of event.pairs) {
        const ba = pair.bodyA, bb = pair.bodyB;
        detector.collision_end(pair, ba, bb, false);
        detector.collision_end(pair, bb, ba, true);
      }
    });
  },
  collision_start: (pair: Matter.Pair, ba: Matter.Body, bb: Matter.Body, flipped: boolean) => {
    const a = ((ba.parent as any).thing as Thing), b = ((bb.parent as any).thing as Thing);
    console.log(`Collision started betwixt ${ba.label} & ${bb.label}!`);
    if (a.is_player) {
      if (b.options.sensor) {
        b.is_touching_player = true;
      }
    }
  },
  collision_end: (pair: Matter.Pair, ba: Matter.Body, bb: Matter.Body, flipped: boolean) => {
    const a = ((ba.parent as any).thing as Thing), b = ((bb.parent as any).thing as Thing);
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
  } as { [key: string]: (thing: Thing) => void },
  

  tick_fns: {
    ["tutorial door 1"]: (door) => {
      const vs = door.shapes[0].vertices;
      if (door.position.y > door.target.position.y) door.translate(vector.normalise(vector.sub(vs[1], vs[0]), -5));
    },
  } as { [key: string]: (thing: Thing) => void },
};