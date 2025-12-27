import { detector } from "./game/detector.js";
import { Spawner } from "./game/enemy.js";
import { Particle } from "./game/particle.js";
import { player } from "./game/player.js";
import { save } from "./game/save.js";
import { Thing } from "./game/thing.js";
import { ui } from "./game/ui.js";
import { always_loaded_rooms } from "./make/rooms.js";
import { Engine } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { config } from "./util/config.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, map_shape_type, TEST_MAP } from "./util/map_type.js";
import { math } from "./util/math.js";
import { do_visibility, tick_colours } from "./util/see.js";
import { vector, vector3 } from "./util/vector.js";

// important: array remove! why doesn't js have this :(
declare global {
  interface Array<T> {
    remove(val: T): Array<T>;
  }
}
Object.defineProperty(Array.prototype, "remove", { value: function<T>(val: T): Array<T> {
  const index = this.indexOf(val);
  if (index > -1) this.splice(index, 1);
  return this;
}});

export const engine = Engine.create();
export const world = engine.world;

engine.gravity.x = 0;
engine.gravity.y = 0;
engine.timing.timeScale = config.timescale;

export let MAP = map_serialiser.load("auto");
if (MAP.shapes.length <= 0) MAP = TEST_MAP;

let time = -1; // Number(document.timeline.currentTime ?? 0);

const init_all = () => {
  init_canvas();
  detector.init();
  key.init();
  ui.init();
  for (const r_id of always_loaded_rooms) {
    player.load_room(r_id);
  }
  ticks++;
  requestAnimationFrame(tick_all);
};

const tick_all = (timestamp: number) => {

  if (is_blur || ticks > 1) {
    ticks--;
    return;
  }

  const now = Math.round(performance.now() * 10 - blurtime);
  if (time < 0) time = now;
  let real_dt = math.bound(now - time, 0, config.seconds * 1);
  const dt = real_dt * engine.timing.timeScale;
  if (config.graphics.fps < 60) { // todo why does this block not work nicely now
    const interval = config.seconds / config.graphics.fps;
    if (real_dt < interval) {
      requestAnimationFrame(tick_all);
      return;
    }
    real_dt = interval;
    time += real_dt;
  }
  else time = now;
  camera.location_target = player.camera_position();
  camera.scale_target = player.camera_scale();
  [ camera.z, camera.look_z ] = player.camera_zs();
  camera.scale_adjust2(camera.halfscreen);
  camera.tick(dt);
  player.tick(real_dt);
  if (!player.paused) Thing.tick_things(dt);
  else if (player.map_mode) Thing.tick_map_things(dt);
  Spawner.tick_spawners();
  Particle.tick_particles(dt);
  if (!player.paused && Thing.time > 500) {
    if (config.graphics.fps < 60) Engine.update(engine, 1000 / config.graphics.fps);
    else Engine.update(engine); // , real_dt / 10);
  } else if (player.inventory_mode || player.shapes_mode) {
    if (config.graphics.fps < 60) Engine.update(player.temp_engine, 1000 / config.graphics.fps);
    else Engine.update(player.temp_engine);
  }
  // ctx.clear();
  ctx.fill_screen(color.black);
  tick_colours(real_dt);
  do_visibility(dt); // <-- shapes and particles are all drawn here!
  ui.tick(real_dt);
  ui.draw();
  mouse.tick();

  if (!is_blur) requestAnimationFrame(tick_all);
  else ticks--;

};

map_serialiser.compute(MAP);

export const make_from_map_shape = function(map_shape: map_shape_type) {
  detector.map_shape_make_fns[map_shape.id]?.(map_shape);
  if (map_shape.options.is_spawner) {
    const s = new Spawner();
    s.make_map(map_shape);
    return s;
  } else {
    if (map_shape.vertices.length < 2) return;
    if (map_shape.options.parent && map_shape.options.merge) {
      // todo merge
      // Thing.things_lookup[map_shape.options.parent].make_map(map_shape);
    } else {
      const t = new Thing();
      t.make_map(map_shape);
      return t;
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
let ticks = 0;
let is_blur = false; // document.hasFocus();
let blurtime = 0;
let blurstart = -1;
window.addEventListener("blur", function(event) {
  is_blur = true;
  blurstart = Math.round(performance.now() * 10);
});
window.addEventListener("focus", function(event) {
  if (blurstart >= 0) {
    blurtime += Math.round(performance.now() * 10 - blurstart);
  }
  is_blur = false;
  ticks++;
  requestAnimationFrame(tick_all);
});

// autoreload map
window.localStorage.removeItem("reload");
window.addEventListener("storage", function(event) {
  if (event.key === "map_auto") window.location.reload();
  if (event.key === "reload") window.location.reload();
});
window.addEventListener("beforeunload", function(event) {
  if (player.enemy_can_see) {
    player.save_but_health_only();
    save.changed(true, true);
    event.preventDefault();
    event.returnValue = true;
    return true;
  } else {
    if (!window.localStorage.getItem("reload")) save.changed(true);
  }
});