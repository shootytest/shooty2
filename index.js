import { Engine } from "./matter.js";
import { camera } from "./util/camera.js";
import { init_canvas } from "./util/canvas.js";
import { key, mouse } from "./util/key.js";
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
