import { camera } from "../util/camera.js";
import { ctx, init_canvas, view } from "../util/canvas.js";
import { key, keys, mouse } from "../util/key.js";
import { ui } from "./ui.js";

const init_all = () => {
  init_canvas();
  ui.init();
  key.init();
};

const tick_all = (timestamp_unused: number) => {

  ui.tick();
  ui.draw();
  camera.tick();
  mouse.tick();

  requestAnimationFrame(tick_all);

};

requestAnimationFrame(tick_all);
window.addEventListener("load", init_all);