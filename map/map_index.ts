import { camera } from "../util/camera.js";
import { init_canvas } from "../util/canvas.js";
import { key, mouse } from "../util/key.js";
import { math } from "../util/math.js";
import { vector, vector3 } from "../util/vector.js";
import { m_ui } from "./map_ui.js";

// important: array remove!
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


const init_all = function() {
  init_canvas();
  m_ui.init();
  key.init();
  load_map_settings();
  requestAnimationFrame(tick_all);
};

const tick_all = function(timestamp_unused: number) {

  m_ui.tick();
  m_ui.draw();
  camera.tick(167); // don't care about dt for now
  mouse.tick();

  requestAnimationFrame(tick_all);

};


window.addEventListener("load", init_all);



export interface editor_save {
  camera: vector3;
  scale: number;
  editor: {
    map: boolean, // map_mode
    oldz: number, // old_look_z
  },
};

export const save_map_settings = function() {
  const o: editor_save = {
    camera: vector3.create2(vector.round(camera.position_target), +camera.look_z.toFixed(1)),
    scale: camera.scale_target,
    editor: {
      map: m_ui.editor.map_mode,
      oldz: m_ui.editor.old_look_z,
    },
  };
  const raw = zipson.stringify(o);
  localStorage.setItem("editor", raw);
};

const load_map_settings = function() {
  const raw = localStorage.getItem("editor");
  if (!raw) return;
  const o = zipson.parse(raw) as editor_save;
  camera.position_target = o.camera;
  camera.look_z = math.round_to(o.camera.z, 0.1);
  camera.scale_target = o.scale;
  m_ui.editor.map_mode = o.editor.map;
  m_ui.editor.old_look_z = o.editor.oldz;
  m_ui.update_directory();
  m_ui.update_properties();
  m_ui.update_right_sidebar();
};