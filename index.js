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
import { config } from "./util/config.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, TEST_MAP } from "./util/map_type.js";
import { math } from "./util/math.js";
import { do_visibility, tick_colours } from "./util/see.js";
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
engine.timing.timeScale = config.timescale;
export let MAP = map_serialiser.load("auto");
if (MAP.shapes.length <= 0)
    MAP = TEST_MAP;
let time = -1; // Number(document.timeline.currentTime ?? 0);
const init_all = () => {
    init_canvas();
    // ui.init();
    detector.init();
    key.init();
    ui.init();
    requestAnimationFrame(tick_all);
};
const tick_all = (timestamp) => {
    const now = Math.round(timestamp * 10);
    if (time < 0)
        time = now;
    let real_dt = math.bound(now - time, 0, config.seconds * 100000);
    const dt = real_dt * engine.timing.timeScale;
    if (config.graphics.fps < 60) {
        const interval = config.seconds / config.graphics.fps;
        if (real_dt < interval) {
            requestAnimationFrame(tick_all);
            return;
        }
        real_dt = interval;
        time += real_dt;
    }
    else
        time = now;
    camera.location_target = player.camera_position();
    camera.scale_target = player.camera_scale();
    [camera.z, camera.look_z] = player.camera_zs();
    camera.scale_adjust2(camera.halfscreen);
    camera.tick(dt);
    player.tick(real_dt);
    if (!player.paused)
        Thing.tick_things(dt);
    Spawner.tick_spawners();
    Particle.tick_particles(dt);
    if (!player.paused && Thing.time > 500) {
        if (config.graphics.fps < 60)
            Engine.update(engine, 1000 / config.graphics.fps);
        else
            Engine.update(engine); // , real_dt / 10);
    }
    // ctx.clear();
    ctx.fill_screen(color.black);
    tick_colours(real_dt);
    do_visibility(dt); // draw all shapes
    ui.tick(real_dt);
    ui.draw();
    mouse.tick();
    requestAnimationFrame(tick_all);
};
map_serialiser.compute(MAP);
export const make_from_map_shape = function (map_shape) {
    if (map_shape.options.is_spawner) {
        if (map_shape.options.spawn_enemy) {
            const s = new Spawner();
            s.make_map(map_shape);
        }
        else {
            // is a wave
            const s = new Spawner();
            s.make_map(map_shape);
        }
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
save.load_settings();
tick_colours(99 * config.seconds);
// init!
window.addEventListener("load", init_all);
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
