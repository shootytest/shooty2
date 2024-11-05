import { Shape } from "./game/shape.js";
import { Engine, Events, Runner } from "./matter.js";
import { camera } from "./util/camera.js";
import { ctx, init_canvas, view } from "./util/canvas.js";
import { key, keys, mouse } from "./util/key.js";

new Shape();

export const engine = Engine.create();
export const world = engine.world;

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

  // console.log(runner.delta);

};
Events.on(runner, "tick", tick_all);