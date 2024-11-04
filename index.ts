import { Shape } from "./game/shape.js";
import { Engine } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas, view } from "./util/canvas.js";
import { key, keys, mouse } from "./util/key.js";

new Shape();

export const engine = Engine.create();
export const world = engine.world;

console.log(world);

const init_all = () => {
  init_canvas();
  // ui.init();
  key.init();
};

const tick_all = () => {

  // ui.tick();
  // ui.draw();
  camera.tick();
  mouse.tick();

  requestAnimationFrame(tick_all);

};

requestAnimationFrame(tick_all);
window.addEventListener("load", init_all);