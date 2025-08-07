import { player } from "./game/player.js";
import { Thing } from "./game/thing.js";
import { Engine, Events, Runner } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser } from "./util/map_type.js";
import { do_visibility } from "./util/see.js";
import { vector, vector3 } from "./util/vector.js";
export const engine = Engine.create();
export const world = engine.world;
engine.gravity.x = 0;
engine.gravity.y = 0;
camera.move_by(vector.create(-window.innerWidth / 2, -window.innerHeight / 2));
export const runner = Runner.create();
Runner.run(runner, engine);
export const MAP = map_serialiser.load("auto");
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
    ctx.clear();
    ctx.fill_screen(color.blackground);
    // draw all shapes
    do_visibility();
};
Events.on(runner, "tick", tick_all);
map_serialiser.compute(MAP);
/*for (const shape of TEST_MAP.shapes ?? []) {
  const t = new Thing();
  t.make_map(shape);
}*/
const shapelist = MAP.shapes?.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0)) ?? [];
for (const map_shape of shapelist) {
    if (map_shape.vertices.length < 2)
        continue;
    if (false && map_shape.options.parent) {
        // Thing.things_lookup[map_shape.options.parent].make_map(map_shape);
    }
    else {
        const t = new Thing();
        t.make_map(map_shape);
    }
}
player.position = vector3.create_(MAP.computed?.shape_map.start.vertices[0] ?? vector.create());
player.create_player();
// todo remove debugs :()()
// console.log(Thing.things);
// console.log(Shape.shapes);
// autoreload map
window.addEventListener("storage", function (event) {
    if (event.key === "map_auto")
        window.location.reload();
});
