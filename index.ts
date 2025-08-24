import { detector } from "./game/detector.js";
import { Enemy, Spawner } from "./game/enemy.js";
import { Particle } from "./game/particle.js";
import { player } from "./game/player.js";
import { save } from "./game/save.js";
import { Thing } from "./game/thing.js";
import { Engine, Runner } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, TEST_MAP } from "./util/map_type.js";
import { do_visibility } from "./util/see.js";
import { vector, vector3 } from "./util/vector.js";

export const engine = Engine.create();
export const world = engine.world;

engine.gravity.x = 0;
engine.gravity.y = 0;

// todo move camera straight to player position
// camera.move_by(vector.create(-window.innerWidth / 2, -window.innerHeight / 2));
// camera.position_jump();

export const runner = Runner.create();
Runner.run(runner, engine);

export let MAP = map_serialiser.load("auto");
if (MAP.shapes.length <= 0) MAP = TEST_MAP;


const init_all = () => {
  init_canvas();
  // ui.init();
  detector.init();
  key.init();
};
window.addEventListener("load", init_all);

/*const tick_all = (event: Matter.IEventTimestamped<Runner>) => {

  // ui.tick();
  // ui.draw();
  camera.tick();
  camera.location_target = player.position;
  camera.scale_target = player.camera_scale();
  mouse.tick();
  Thing.tick_things();
  // clear screen
  // ctx.clear();
  ctx.clear();
  ctx.fill_screen(color.blackground);
  // draw all shapes
  do_visibility();

};
Events.on(runner, "tick", tick_all);*/

let time = -1;
const tick_all = (timestamp_unused: number) => {

  const now = performance.now();
  const dt = (time > -1) ? now - time : 0;
  time = now;
  camera.tick();
  camera.scale_target = player.camera_scale();
  camera.location_target = player.camera_position();
  camera.scale_adjust2(camera.halfscreen);
  mouse.tick();
  Thing.tick_things();
  Enemy.tick();
  Spawner.tick_spawners();
  Particle.tick_particles();
  Engine.update(engine);
  ctx.clear();
  ctx.fill_screen(color.blackground);
  do_visibility(); // draw all shapes
  Particle.draw_particles();
  requestAnimationFrame(tick_all);

};

requestAnimationFrame(tick_all);

map_serialiser.compute(MAP);
/*for (const shape of TEST_MAP.shapes ?? []) {
  const t = new Thing();
  t.make_map(shape);
}*/

player.position = vector3.create_(MAP.computed?.shape_map.start.vertices[0] ?? vector.create());
player.old_position = player.position;
player.checkpoint = player.position;
player.fov_mult = MAP.computed?.shape_map.start.options.sensor_fov_mult ?? 1;
player.create_player();
save.load_from_storage();
 
const shapelist = MAP.shapes?.sort((s1, s2) => (s1.computed?.depth ?? 0) - (s2.computed?.depth ?? 0)) ?? [];
for (const map_shape of shapelist) {
  if (map_shape.options.is_spawner) {
    const s = new Spawner();
    s.make_map(map_shape);
  } else {
    if (map_shape.vertices.length < 2) continue;
    if (map_shape.options.parent && map_shape.options.merge) {
      // todo merge
      // Thing.things_lookup[map_shape.options.parent].make_map(map_shape);
    } else {
      const t = new Thing();
      t.make_map(map_shape);
    }
  }
}


// autoreload map
window.localStorage.removeItem("reload");
window.addEventListener("storage", function(event) {
  if (event.key === "map_auto") window.location.reload();
  if (event.key === "reload") window.location.reload();
});
window.addEventListener("beforeunload", function(event) {
  if (player.enemy_can_see) {
    player.save_but_health_only();
    save.changed(true);
    event.preventDefault();
    event.returnValue = true;
    return true;
  } else {
    if (!window.localStorage.getItem("reload")) save.changed(true);
  }
});