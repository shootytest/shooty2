import { engine } from "../index.js";
import { Events } from "../matter.js";
import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { player } from "./player.js";
import type { Thing } from "./thing.js";

/**
 * 
 * Collisions between two bodies will obey the following rules:
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
 * ~ matter.js api docs
 * 
 */

export const filter_groups = {
  none: 0x0000,
  thing: 0x0001,
  bullet: 0x0002,
  wall: 0x0004,
  all: 0xFFFF,
};

export interface filter_type {
  group: number,
  category: number,
  mask: number
}

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
  thing: (team: number) => { return {
    group: -team,
    category: filter_groups.thing,
    mask: filter_groups.all,
  }},
  bullet: (team: number) => { return {
    group: -team,
    category: filter_groups.bullet,
    mask: filter_groups.all - filter_groups.bullet,
  }},
  wall: {
    group: 0,
    category: filter_groups.wall,
    mask: filter_groups.all,
  },
  pass: {
    group: 0,
    category: filter_groups.wall,
    mask: filter_groups.thing,
  },
};

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
    // console.log(`[detector/collision_start] Collision started betwixt ${ba.label} & ${bb.label}!`);
    if (a.is_player) {
      if (b.options.sensor) {
        detector.collision_start_fns[b.id]?.(b);
        b.is_touching_player = true;
      }
    }
    if (a.is_bullet) {
      if (!b.options.sensor && !b.options.keep_bullets) {
        a.remove();
      }
    }
    if (a.damage > 0 && b.health.capacity > 0 && a.team !== b.team) {
      console.log(`[detector/collision_start] ${a.id} hits ${b.id} for ${a.damage} damage!`);
      b.health.hit(a.damage);
    }
  },
  collision_end: (pair: Matter.Pair, ba: Matter.Body, bb: Matter.Body, flipped: boolean) => {
    const a = ((ba.parent as any).thing as Thing), b = ((bb.parent as any).thing as Thing);
    // console.log(`[detector/collision_end] Collision ended betwixt ${ba.label} & ${bb.label}!`);
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
  } as { [key: string]: (thing: Thing) => void },


  collision_start_fns: {
    // nothing for now
  } as { [key: string]: (thing: Thing) => void },
  

  collision_end_fns: {
    // nothing for now
  } as { [key: string]: (thing: Thing) => void },
  

  tick_fns: {
    ["tutorial room 1 door 1"]: (door) => {
      do_door(door, "tutorial room 1 door sensor");
    },
    ["tutorial room 1 door 2"]: (door) => {
      do_door(door, "tutorial room 1 door sensor");
    },
  } as { [key: string]: (thing: Thing) => void },

};

const do_door = (door: Thing, sensor_id: string, speed = 5, invert = false) => {
  const vs = door.shapes[0].vertices;
  const dir = vector.sub(vs[1], vs[0]);
  const offset = vector.sub(door.position, door.target.position);
  let triggered = Boolean(door.lookup(sensor_id)?.is_touching_player);
  if (invert) triggered = !triggered;
  let exceeded = true;
  if (triggered) exceeded = vector.length2(offset) > vector.length2(dir);
  else exceeded = vector.dot(offset, dir) < 0;
  if (!exceeded) door.translate_wall(vector.normalise(dir, triggered ? speed : -speed));
};