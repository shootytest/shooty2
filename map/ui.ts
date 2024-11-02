import { math } from "../util/math.js";
import { vector } from "../util/vector.js";
import { camera } from "../util/camera.js";
import { ctx, view } from "../util/canvas.js";
import { color } from "../util/color.js";
import { key, keys, mouse } from "../util/key.js";
import { map_draw } from "../util/map_draw.js";
import { TEST_MAP, map_serialiser, map_type } from "../util/map_type.js";
import { settings_default } from "./settings.js";

// globals, why not?
let width = window.innerWidth;
let height = window.innerHeight;
let x: number, y: number, w: number, h: number;
let r: number, c: string, size: number;
let o: any;
let hover: boolean, hovering: boolean, clicking: boolean;

export const ui = {

  time: 0,

  map: TEST_MAP as map_type,
  
  settings: {
    slot: settings_default.slot,
  },

  mouse: {
    click: false,
    new_click: false,
    was_click: false,
    release_click: false,
    mclick: false,
    new_mclick: false,
    was_mclick: false,
    release_mclick: false,
    rclick: false,
    new_rclick: false,
    was_rclick: false,
    release_rclick: false,
    clickbuttons: [false, false, false],
    double_click: false,
    hover_target: {} as any,
    drag_target: [{}, {}, {}] as any[],
  },

  init: function() {

    key.add_keydown_listener((event) => {
      let dz = 0;
      if (event.code === "KeyQ" && event.shiftKey) dz -= 0.1;
      if (event.code === "KeyE" && event.shiftKey) dz += 0.1;
      camera.look_z += dz;
    });

  },

  tick: function() {
    ui.time++;
    ui.mouse.double_click = mouse.double_click;
    ui.mouse.click = mouse.buttons[0];
    ui.mouse.new_click = mouse.down_buttons[0];
    ui.mouse.was_click = ui.mouse.clickbuttons[0];
    ui.mouse.release_click = mouse.up_buttons[0];
    ui.mouse.mclick = mouse.buttons[1];
    ui.mouse.new_mclick = mouse.down_buttons[1];
    ui.mouse.was_mclick = ui.mouse.clickbuttons[1];
    ui.mouse.release_mclick = mouse.up_buttons[1];
    ui.mouse.rclick = mouse.buttons[2];
    ui.mouse.new_rclick = mouse.down_buttons[2];
    ui.mouse.was_rclick = ui.mouse.clickbuttons[2];
    ui.mouse.release_rclick = mouse.up_buttons[2];
    ui.mouse.clickbuttons = [ui.mouse.click, ui.mouse.mclick, ui.mouse.rclick];
    /*for (let b = 0; b < 3; b++) {
      if (mouse.up_buttons[b]) {
        ui.mouse.drag_target[b] = {};
      }
    }*/
    const MOVE_SPEED = 10;
    let dx = 0;
    let dy = 0;
    if (keys.KeyW) dy -= 1;
    if (keys.KeyS) dy += 1;
    if (keys.KeyA) dx -= 1;
    if (keys.KeyD) dx += 1;
    camera.move_by(vector.mult(vector.normalise(vector.create(dx, dy)), MOVE_SPEED / camera.scale));
    let dz = 1;
    if (keys.KeyQ && !(keys.ShiftLeft || keys.ShiftRight)) dz *= 1.08;
    if (keys.KeyE && !(keys.ShiftLeft || keys.ShiftRight)) dz /= 1.08;
    if (dz !== 1) camera.scale_by(camera.halfscreen, dz);
  },

  draw: () => {

    ui.draw_clear();
    ui.draw_grid();
    ui.draw_map();
    ui.draw_top();
    ui.draw_left();
    ui.draw_mouse();
    ui.update_camera();

  },

  draw_clear: () => {
    // draw all
    ctx.clear();
    ctx.fillStyle = color.black;
    ctx.begin();
    ctx.rect(0, 0, width, height);
    ctx.fill();
  },

  editor: {
    mode: "none",
    settings: false,
  },

  top: [
    {
      name: "clear",
      icon: "x",
      action: (): void => { ui.editor.mode = "none"; }
    },
    {
      name: "add",
      icon: "add",
      action: (): void => { ui.editor.mode = "add"; }
    },
    {
      name: "edit",
      icon: "edit",
      action: (): void => { ui.editor.mode = "edit"; }
    },
    {
      name: "select",
      icon: "select",
      action: (): void => { ui.editor.mode = "select"; }
    },
    {
      name: "delete",
      icon: "delete",
      action: (): void => { ui.editor.mode = "delete"; }
    },
    {
      name: "settings",
      icon: "settings",
      action: (): void => { ui.editor.settings = true; }
    },
  ],
  top_settings: [
    {
      name: "save",
      icon: "save",
      action: (): void => {
        map_serialiser.save(ui.settings.slot, ui.map);
      },
    },
    {
      name: "load",
      icon: "load",
      action: (): void => {
        ui.map = map_serialiser.load(ui.settings.slot);
      },
    },
    {
      name: "back",
      icon: "start_left",
      action: (): void => { ui.editor.settings = false; }
    },
  ],

  draw_top: () => {
    const top = ui.editor.settings ? ui.top_settings : ui.top;
    size = height * 0.065;
    ctx.fillStyle = color.white + "be";
    ctx.begin();
    ctx.rect(0, 0, width, size);
    ctx.fill();
    ctx.strokeStyle = color.white;
    ctx.lineWidth = 2;
    ctx.line(0, size, width, size);
    // draw the buttons
    w = width / (top.length + 0.5);
    x = w * 0.75;
    y = size / 2;
    ctx.fillStyle = color.black;
    for (const button of top) {
      ctx.beginPath();
      ctx.rectangle(x, y, w, size);
      hovering = ctx.point_in_path_v(mouse);
      clicking = hovering && ui.mouse.new_click;
      ctx.fillStyle = hovering ? color.red_dark : color.black;
      ctx.svg(button.icon, x, y, size * 0.8);
      if (button.name === ui.editor.mode) {
        ctx.strokeStyle = color.blue;
        ctx.line(x - w / 2, size, x + w / 2, size);
      } else if (hovering) {
        ctx.strokeStyle = color.red_dark;
        ctx.line(x - w / 2, size, x + w / 2, size);
      }
      x += w;
      if (clicking) button.action();
    }
  },

  draw_left: () => {
    ctx.save("draw_left");
    ctx.lineCap = "round";
    size = math.min(width * 0.065, 75);
    ctx.fillStyle = color.white + "be";
    ctx.begin();
    ctx.rect(0, height * 0.065, size, height * 0.935);
    ctx.fill();
    x = size / 2;
    ctx.strokeStyle = color.white;
    ctx.lineWidth = 2;
    ctx.line(size, height * 0.065, size, height);
    ctx.strokeStyle = color.black;
    ctx.lineWidth = 5;
    ctx.line(x, height * 0.1, x, height * 0.965);
    // circles
    r = size / 5;
    // first circle
    const one = 0.5 - 0.1 * camera.z / camera.scale;
    y = height * (0.1 + one * 0.865);
    ctx.fillStyle = color.blue;
    ctx.begin();
    ctx.circle(x, y, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color.black;
    ctx.set_font_condensed(10);
    ctx.text(math.round_dp(camera.z / camera.scale, 1) + "", x, y);
    hovering = ctx.point_in_path_v(mouse);
    clicking = hovering && ui.mouse.new_rclick;
    if (clicking) {
      ui.mouse.new_rclick = false;
      ui.mouse.drag_target[2] = { id: "_leftbar_z", change: 0, };
    }
    if (ui.mouse.drag_target[2].id === "_leftbar_z") {
      o = ui.mouse.drag_target[2] as { id: string, change: number, };
      let dy = (mouse.drag_change[2] as vector).y;
      dy /= height * 0.865 / 10;
      dy = camera.z / (camera.z / camera.scale - dy);
      camera.scale_to(camera.halfscreen, dy);
    }
    const two = 0.5 - 0.1 * camera.look_z;
    y = height * (0.1 + two * 0.865);
    ctx.fillStyle = color.green;
    ctx.begin();
    ctx.circle(x, y, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color.black;
    ctx.text(math.round_dp(camera.look_z, 1) + "", x, y);
    hovering = ctx.point_in_path_v(mouse);
    clicking = hovering && ui.mouse.new_rclick;
    if (clicking) {
      ui.mouse.new_rclick = false;
      ui.mouse.drag_target[2] = { id: "_leftbar_zlook", change: 0, };
    }
    if (ui.mouse.drag_target[2].id === "_leftbar_zlook") {
      o = ui.mouse.drag_target[2];
      let dy = (mouse.drag_change[2] as vector).y;
      dy /= height * 0.865 / 10;
      o.change -= dy;
      if (math.abs(o.change) >= 0.1) {
        const d = math.round_to(o.change, 0.1) ?? 0;
        camera.look_z += d;
        o.change -= d;
      }
    }
    // respond to mousedrag
    
    ctx.restore("draw_left");
  },

  draw_map: () => {
    ui.draw_a_map(ui.map);
  },
  
  draw_a_map: (map: map_type) => {
    map_draw.draw(ctx, map);
  },

  draw_selection: (map: map_type) => {
    
  },

  draw_grid: () => {
    const grid_size = camera.scale * 10;
    if (grid_size >= 6) {
      ui.draw_a_grid(grid_size, color.darkgrey, camera.sqrtscale * 0.4);
    }
    ui.draw_a_grid(grid_size * 5, color.darkgrey, camera.sqrtscale * 1.0);
    ui.draw_a_grid(1000000, color.darkgrey, camera.sqrtscale * 2);
  },

  draw_a_grid: (grid_size: number, color: string, line_width: number) => {
    let xx = (-camera.position.x * camera.scale);
    let yy = (-camera.position.y * camera.scale);
    let x = xx % grid_size;
    let y = yy % grid_size;
    ctx.strokeStyle = color;
    ctx.lineWidth = line_width;
    while (x < view.width) {
      ctx.line(x, 0, x, view.height);
      x += grid_size;
    }
    while (y < view.height) {
      ctx.line(0, y, view.width, y);
      y += grid_size;
    }
  },

  draw_mouse: () => {
    const size = 10;
    const mode = ui.editor.mode;
    let v = vector.clone(mouse);
    let offset = vector.create();
    if (mode === "select") offset = vector.create(size * 0.6, size);
    if (mode === "edit") offset = vector.create(size * 0.7, -size * 0.7);
    v = vector.add(v, offset);
    ctx.fillStyle = color.white;
    ctx.svg(ui.editor.mode, v.x, v.y, size * 2);
  },

  update_camera: () => {
    if (ui.mouse.click) {
      camera.move_by_mouse();
    }
    if (ui.mouse.rclick) {
      // do something
    }
    if (mouse.scroll != 0 && !keys.Shift) {
      if (mouse.scroll < 0) {
        camera.scale_by(vector.clone(mouse), 1.3);
      } else {
        camera.scale_by(vector.clone(mouse), 1 / 1.3);
      }
    }
  },

};

window.addEventListener("resize", (event) => {
  width = window.innerWidth;
  height = window.innerHeight;
});