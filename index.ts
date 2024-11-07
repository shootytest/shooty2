import { Player } from "./game/player.js";
import { Shape } from "./game/shape.js";
import { Thing } from "./game/thing.js";
import { Engine, Events, Runner } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas } from "./util/canvas.js";
import { color } from "./util/color.js";
import { key, mouse } from "./util/key.js";
import { map_serialiser, TEST_MAP } from "./util/map_type.js";
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
  mouse.tick();
  Thing.tick_things();
  // clear screen
  // ctx.clear();
  ctx.begin();
  ctx.clear(color.blackground);
  ctx.fill();
  // draw all shapes
  Shape.draw();

};
Events.on(runner, "tick", tick_all);

const player = new Player();


map_serialiser.compute(TEST_MAP);
/*for (const shape of TEST_MAP.shapes ?? []) {
  const t = new Thing();
  t.make_map(shape);
}*/

const t = new Thing();
t.make_map(TEST_MAP!!.shapes!![0]);
t.make_map(TEST_MAP!!.shapes!![1]);