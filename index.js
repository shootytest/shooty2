import { player } from "./game/player.js";
import { Shape } from "./game/shape.js";
import { Thing } from "./game/thing.js";
import { Engine, Events, Runner } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, TEST_MAP } from "./util/map_type.js";
import { clip_visibility_polygon } from "./util/see.js";
import { vector } from "./util/vector.js";
export const engine = Engine.create();
export const world = engine.world;
engine.gravity.x = 0;
engine.gravity.y = 0;
camera.move_by(vector.create(-window.innerWidth / 2, -window.innerHeight / 2));
export const runner = Runner.create();
Runner.run(runner, engine);
const init_all = () => {
    init_canvas();
    // ui.init();
    key.init();
};
window.addEventListener("load", init_all);
const tick_all = () => {
    // ui.tick();
    // ui.draw();
    camera.tick();
    camera.location_target = player.position;
    mouse.tick();
    Thing.tick_things();
    // clear screen
    // ctx.clear();
    ctx.begin();
    ctx.clear(color.blackground);
    ctx.fill();
    // draw all shapes
    clip_visibility_polygon();
    Shape.draw();
};
Events.on(runner, "tick", tick_all);
player.create_player();
map_serialiser.compute(TEST_MAP);
/*for (const shape of TEST_MAP.shapes ?? []) {
  const t = new Thing();
  t.make_map(shape);
}*/
for (const map_shape of TEST_MAP.shapes ?? []) {
    if (map_shape.options?.part_of) {
        Thing.things_lookup[map_shape.options?.part_of].make_map(map_shape);
    }
    else {
        const t = new Thing();
        t.make_map(map_shape);
    }
}
// todo remove debug :()()
// console.log(Thing.things);
