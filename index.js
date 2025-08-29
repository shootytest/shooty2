import { detector } from "./game/detector.js";
import { Spawner } from "./game/enemy.js";
import { Particle } from "./game/particle.js";
import { player } from "./game/player.js";
import { save } from "./game/save.js";
import { Thing } from "./game/thing.js";
import { ui } from "./game/ui.js";
import { Engine } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, TEST_MAP } from "./util/map_type.js";
import { do_visibility } from "./util/see.js";
import { vector, vector3 } from "./util/vector.js";
Object.defineProperty(Array.prototype, "remove", { value: function (val) {
        const index = this.indexOf(val);
        if (index > -1)
            this.splice(index, 1);
        return this;
    } });
export const engine = Engine.create();
export const world = engine.world;
engine.gravity.x = 0;
engine.gravity.y = 0;
export let MAP = map_serialiser.load("auto");
if (MAP.shapes.length <= 0)
    MAP = TEST_MAP;
const init_all = () => {
    init_canvas();
    // ui.init();
    detector.init();
    key.init();
    ui.init();
};
window.addEventListener("load", init_all);
let time = -1;
const tick_all = (timestamp_unused) => {
    const now = performance.now();
    const _dt = (time > -1) ? now - time : 0;
    time = now;
    camera.tick();
    camera.scale_target = player.camera_scale();
    camera.location_target = player.camera_position();
    camera.scale_adjust2(camera.halfscreen);
    mouse.tick();
    Thing.tick_things();
    Spawner.tick_spawners();
    Particle.tick_particles();
    if (Thing.time > 10)
        Engine.update(engine);
    // ctx.clear();
    ctx.fill_screen(color.black);
    do_visibility(); // draw all shapes
    ui.tick();
    ui.draw();
    requestAnimationFrame(tick_all);
};
requestAnimationFrame(tick_all);
map_serialiser.compute(MAP);
for (const shape of MAP.shapes ?? []) {
    const room_id = MAP.computed?.shape_room[shape.id] ?? "";
    shape.options.room_id = room_id;
}
export const make_from_map_shape = function (map_shape) {
    if (map_shape.options.is_spawner) {
        const s = new Spawner();
        s.make_map(map_shape);
    }
    else {
        if (map_shape.vertices.length < 2)
            return;
        if (map_shape.options.parent && map_shape.options.merge) {
            // todo merge
            // Thing.things_lookup[map_shape.options.parent].make_map(map_shape);
        }
        else {
            const t = new Thing();
            t.make_map(map_shape);
        }
    }
};
player.position = vector3.create_(MAP.computed?.shape_map.start.vertices[0] ?? vector.create());
player.room_id = MAP.computed?.shape_map.start.options.room_connections?.[0] ?? "";
player.old_position = player.position;
player.set_checkpoint(player.position);
player.fov_mult = MAP.computed?.shape_map.start.options.sensor_fov_mult ?? 1;
player.create_player();
save.load_from_storage();
// const shapelist = MAP.shapes?.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0)) ?? [];
// for (const map_shape of shapelist) {
//   make_from_map_shape(map_shape);
// }
// autoreload map
window.localStorage.removeItem("reload");
window.addEventListener("storage", function (event) {
    if (event.key === "map_auto")
        window.location.reload();
    if (event.key === "reload")
        window.location.reload();
});
window.addEventListener("beforeunload", function (event) {
    if (player.enemy_can_see) {
        player.save_but_health_only();
        save.changed(true);
        event.preventDefault();
        event.returnValue = true;
        return true;
    }
    else {
        if (!window.localStorage.getItem("reload"))
            save.changed(true);
    }
});
