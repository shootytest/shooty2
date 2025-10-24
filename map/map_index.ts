import { camera } from "../util/camera.js";
import { init_canvas } from "../util/canvas.js";
import { key, mouse } from "../util/key.js";
import { m_ui } from "./map_ui.js";

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

const init_all = () => {
  init_canvas();
  m_ui.init();
  key.init();
};

const tick_all = (timestamp_unused: number) => {

  m_ui.tick();
  m_ui.draw();
  camera.tick(16); // don't care about dt for now
  mouse.tick();

  requestAnimationFrame(tick_all);

};

requestAnimationFrame(tick_all);
window.addEventListener("load", init_all);